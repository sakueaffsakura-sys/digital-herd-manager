// Guarda de manutenção e bloqueios aplicada no servidor antes de qualquer conteúdo protegido.
// O estado vem do banco (cache curto por worker); a decisão nunca depende de dados do navegador.
import { renderManutencaoPage } from "./manutencao-page";

type Estado = { status: "ativo" | "manutencao" | "bloqueado"; titulo: string; mensagem: string; modulos: string[] };
type Cache = { estado: Estado; ips: Set<string>; disps: Set<string>; ate: number };

const TTL = 8_000;
let cache: Cache | null = null;
let carregando: Promise<Cache> | null = null;
const adminTokens = new Map<string, { admin: boolean; userId: string | null; ate: number }>();
const negacoes = new Map<string, { n: number; ate: number; manip: number }>();
const tentativaLog = new Map<string, number>();

export const COOKIE_DISPOSITIVO = "pd_disp";
const LIMITE_REPETICAO = 20; // respostas de bloqueio ignoradas em 2 min = tentativa confirmada
const JANELA = 120_000;

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

async function carregar(): Promise<Cache> {
  const sb = await admin();
  const [cfg, bl] = await Promise.all([
    sb.from("manutencao_config").select("status,titulo,mensagem,modulos").eq("id", 1).maybeSingle(),
    carregarBloqueios(sb),
  ]);
  if (cfg.error) throw cfg.error;
  if (!cfg.data) throw new Error("Configuração de manutenção indisponível.");
  const agora = Date.now();
  const ips = new Set<string>(); const disps = new Set<string>();
  for (const b of bl) {
    if (b.expira_em && new Date(b.expira_em).getTime() <= agora) continue;
    (b.tipo === "ip" ? ips : disps).add(b.valor);
  }
  const estado = (cfg.data as Estado | null) ?? { status: "ativo", titulo: "", mensagem: "", modulos: [] };
  return { estado, ips, disps, ate: agora + TTL };
}

async function carregarBloqueios(sb: Awaited<ReturnType<typeof admin>>) {
  const rows: { tipo: string; valor: string; expira_em: string | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const r = await sb.from("bloqueios_acesso").select("tipo,valor,expira_em")
      .eq("ativo", true).in("tipo", ["ip", "dispositivo"]).order("id").range(from, from + 999);
    if (r.error) throw r.error;
    rows.push(...(r.data ?? []));
    if ((r.data?.length ?? 0) < 1000) return rows;
  }
}

async function obter(): Promise<Cache | null> {
  if (cache && cache.ate > Date.now()) return cache;
  carregando ??= carregar().finally(() => { carregando = null; });
  try { cache = await carregando; } catch (e) { console.error("manutencao: falha ao ler estado", e); }
  return cache; // em falha mantém o último estado; sem estado inicial responde indisponível
}

export function invalidarCacheManutencao() { cache = null; }

async function verificarAdmin(token: string | null) {
  if (!token) return { admin: false, userId: null as string | null };
  const c = adminTokens.get(token);
  if (c && c.ate > Date.now()) return c;
  const sb = await admin();
  let r = { admin: false, userId: null as string | null };
  const { data } = await sb.auth.getUser(token);
  if (data.user) {
    const { createClient } = await import("@supabase/supabase-js");
    const { data: role, error } = await createClient(
      process.env["SUPABASE_URL"] ?? "",
      process.env["SUPABASE_PUBLISHABLE_KEY"] ?? "",
      { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } },
    ).rpc("sou_admin");
    if (error) throw error;
    r = { admin: role === true, userId: data.user.id };
  }
  if (adminTokens.size > 5000) adminTokens.clear();
  adminTokens.set(token, { ...r, ate: Date.now() + 60_000 });
  return r;
}

function moduloDoCaminho(p: string): string | null {
  if (p.startsWith("/api/yui")) return "yui";
  if (p.startsWith("/api/public/app/")) {
    const fim = p.slice("/api/public/app/".length);
    if (fim === "status" || fim === "login") return null; // login continua disponível para o administrador
    return "api";
  }
  if (p.startsWith("/_serverFn")) return "api";
  return null;
}

const PARAMS_SUSPEITOS = /(bypass|manuten|maintenance|skip_?guard|debug_?admin|force_?access|is_?admin|role)=/i;

function temManipulacao(req: Request, url: URL) {
  if (PARAMS_SUSPEITOS.test(url.search)) return "Parâmetros de endereço para ignorar a manutenção.";
  for (const h of req.headers.keys()) if (/^x-(bypass|maintenance|manutencao|admin|override)/i.test(h)) return `Cabeçalho de requisição forjado (${h}).`;
  return null;
}

function bearer(req: Request) {
  const a = req.headers.get("authorization");
  return a?.startsWith("Bearer ") ? a.slice(7).trim() : null;
}

export function dispositivoDe(req: Request): string | null {
  const ck = req.headers.get("cookie") ?? "";
  const m = ck.match(new RegExp(`(?:^|;\\s*)${COOKIE_DISPOSITIVO}=([a-zA-Z0-9-]{8,80})`));
  const h = req.headers.get("x-pd-dispositivo");
  return m?.[1] ?? (h && /^[a-zA-Z0-9-]{8,80}$/.test(h) ? h : null);
}

async function incidente(a: { tipo: string; severidade: string; ip: string; disp: string | null; user: string | null; req: Request; caminho: string; motivo: string; detalhes?: Record<string, unknown>; bloquear: boolean }) {
  try {
    const sb = await admin();
    const r = await sb.rpc("seg_registrar_incidente", {
      _tipo: a.tipo, _severidade: a.severidade, _ip: a.ip, _disp: a.disp ?? "", _user: a.user as string, _caminho: a.caminho,
      _metodo: a.req.method, _agente: a.req.headers.get("user-agent") ?? "", _motivo: a.motivo, _detalhes: (a.detalhes ?? {}) as never, _bloquear: a.bloquear,
    });
    if (r.error) throw r.error;
    if (a.bloquear) invalidarCacheManutencao();
  } catch (e) { console.error("manutencao: falha ao registrar incidente", e); }
}

function json(status: number, corpo: Record<string, unknown>) {
  return new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "retry-after": "60" } });
}

/** Retorna uma resposta de bloqueio, ou null quando a requisição pode seguir. */
export async function guardaManutencao(req: Request, ip: string): Promise<Response | null> {
  const url = new URL(req.url);
  const p = url.pathname;
  if (p.startsWith("/assets/") || p.startsWith("/@") || p.startsWith("/node_modules/") || p.startsWith("/src/") || /\.(png|jpe?g|webp|svg|ico|css|js|woff2?|webmanifest|txt)$/.test(p)) return null;
  // O login continua alcançável; autenticar não concede acesso aos módulos bloqueados.
  if (p === "/" || p === "/admin" || p === "/api/public/app/login" || p === "/api/public/app/status") return null;
  const c = await obter();
  if (!c) return json(503, { erro: "Não foi possível verificar a disponibilidade do sistema. Tente novamente em instantes.", codigo: "estado_indisponivel" });
  const disp = dispositivoDe(req);
  const ehApi = p.startsWith("/api/") || p.startsWith("/_serverFn");
  const ehPaginaApp = p === "/app" || p.startsWith("/app/");

  // 1) IP ou dispositivo bloqueado: barra áreas protegidas; administrador autenticado nunca fica preso.
  const ipBloq = c.ips.has(ip); const dispBloq = !!disp && c.disps.has(disp);
  if ((ipBloq || dispBloq) && (ehApi || ehPaginaApp)) {
    const adm = ehApi ? await verificarAdmin(bearer(req)) : { admin: false };
    if (!adm.admin) {
      const chave = `${ip}|${disp}`;
      if ((tentativaLog.get(chave) ?? 0) < Date.now()) {
        if (tentativaLog.size >= 20_000) tentativaLog.clear();
        tentativaLog.set(chave, Date.now() + 60_000);
        const sb = await admin();
        if (ipBloq) void sb.rpc("seg_tentativa_bloqueado", { _tipo: "ip", _valor: ip });
        if (dispBloq && disp) void sb.rpc("seg_tentativa_bloqueado", { _tipo: "dispositivo", _valor: disp });
      }
      const msg = "Acesso bloqueado por segurança. Se acredita que é um engano, fale com o administrador.";
      return ehApi ? json(403, { erro: msg, codigo: "acesso_bloqueado" })
        : new Response(renderManutencaoPage("Acesso bloqueado", msg, "bloqueado"), { status: 403, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
    }
  }

  // 2) Manutenção ativa: APIs restritas respondem 503 a quem não é administrador.
  const e = c.estado;
  if (e.status === "ativo") return null;
  const mod = moduloDoCaminho(p);
  const total = e.status === "bloqueado" || e.modulos.includes("todos");
  if (!mod || !(total || e.modulos.includes(mod))) return null;
  const adm = await verificarAdmin(bearer(req));
  if (adm.admin) return null;

  // Contagem de insistência: só bloqueia com evidência (muitas tentativas após já receber 503, ou manipulação repetida).
  const chave = `${ip}|${disp ?? "-"}`;
  const agora = Date.now();
  let n = negacoes.get(chave);
  if (!n || n.ate < agora) { n = { n: 0, ate: agora + JANELA, manip: 0 }; negacoes.set(chave, n); }
  if (negacoes.size > 20_000) negacoes.clear();
  n.n++;
  const manip = temManipulacao(req, url);
  if (manip) {
    n.manip++;
    if (n.manip === 1) void incidente({ tipo: "manipulacao_requisicao", severidade: "aviso", ip, disp, user: adm.userId, req, caminho: p, motivo: manip, bloquear: false });
  }
  if (n.n === 1 && !manip) void incidente({ tipo: "acesso_negado_manutencao", severidade: "info", ip, disp, user: adm.userId, req, caminho: p, motivo: "Acesso a área restrita durante a manutenção (sem bloqueio).", bloquear: false });
  const confirmado = n.n === LIMITE_REPETICAO || n.manip === 3;
  if (confirmado) {
    void incidente({
      tipo: n.manip >= 3 ? "burlar_manutencao_manipulacao" : "burlar_manutencao_repeticao", severidade: "critico", ip, disp, user: adm.userId, req, caminho: p,
      motivo: n.manip >= 3 ? "Tentativas repetidas de forjar parâmetros/cabeçalhos para ignorar a manutenção." : `Insistiu ${LIMITE_REPETICAO} vezes em área restrita após receber o aviso de manutenção.`,
      detalhes: { tentativas: n.n, manipulacoes: n.manip, modulo: mod }, bloquear: true,
    });
  }
  return json(503, { erro: e.mensagem, titulo: e.titulo, codigo: "manutencao" });
}

export function novoDispositivo() {
  return crypto.randomUUID();
}

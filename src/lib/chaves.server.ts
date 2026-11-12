// Chaves salvas pelo painel: cifradas no banco, lidas só no servidor. Sem chave no painel, usa o segredo do ambiente.
import type { SupabaseClient } from "@supabase/supabase-js";
import { cifrar, decifrar, ehNomeChave, finalDaChave, iguais, NOMES_CHAVES, type NomeChave } from "./chaves";
import { clienteDoSite, dentroDoLimite, falha, ipDe, lerCorpo, resposta } from "./conta.server";
import { allowRequest } from "./rate-limit";
import { invalidarCacheManutencao } from "./manutencao.server";

type RpcSolta = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const cache = new Map<NomeChave, { v: string | null; ate: number }>();

async function servico(): Promise<SupabaseClient> {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin as unknown as SupabaseClient;
}
/**
 * Chave que cifra as outras. Preferência para CHAVES_MESTRA; sem ela, usa a chave de serviço
 * do banco, que só existe no servidor — assim o painel já funciona sem mais nenhum ajuste.
 * Quem trocar a chave de serviço precisa colar as chaves de novo no painel (o aviso aparece lá).
 */
function mestra(): string | null {
  return process.env["CHAVES_MESTRA"] || process.env["SUPABASE_SERVICE_ROLE_KEY"] || null;
}
async function evento(request: Request, tipo: string, severidade: "info" | "aviso" | "critico", detalhe: string) {
  const { registrarEvento } = await import("./security-events.server");
  registrarEvento({ tipo, severidade, ip: ipDe(request), caminho: new URL(request.url).pathname.slice(0, 120), detalhe: detalhe.slice(0, 300) });
}

/** Valor da chave: primeiro a do painel, depois a do ambiente. Cache de 30s por worker. */
export async function lerChave(nome: NomeChave): Promise<string | null> {
  const c = cache.get(nome);
  if (c && c.ate > Date.now()) return c.v ?? process.env[nome] ?? null;
  let v: string | null = null;
  const m = mestra();
  if (m) {
    try {
      const { data } = await (await servico()).from("chaves_sistema").select("valor_cifrado").eq("nome", nome).maybeSingle();
      const cif = (data as { valor_cifrado?: string } | null)?.valor_cifrado;
      if (cif) v = await decifrar(cif, m);
    } catch { v = null; }
  }
  cache.set(nome, { v, ate: Date.now() + 30_000 });
  return v ?? process.env[nome] ?? null;
}

async function exigirAdmin(request: Request) {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return falha(401, "Entre novamente.");
  const sb = clienteDoSite(token);
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return falha(401, "Sua sessão expirou. Entre novamente.");
  if (!allowRequest(`chaves:${data.user.id}`, 30, 60_000, 60_000)) return falha(429, "Muitos pedidos. Espere um minuto.");
  const adm = await (sb.rpc.bind(sb) as unknown as RpcSolta)("sou_admin");
  if (adm.data !== true) return falha(403, "Só administradores.");
  return data.user;
}

// GET /api/admin/chaves → [{ nome, origem, final, alterado_em }]
export async function handleListarChaves(request: Request) {
  const u = await exigirAdmin(request);
  if (u instanceof Response) return u;
  const { data } = await (await servico()).from("chaves_sistema").select("nome,final,alterado_em,valor_cifrado");
  const linhas = (data ?? []) as { nome: string; final: string; alterado_em: string; valor_cifrado: string }[];
  const m = mestra();
  const chaves = [];
  for (const nome of NOMES_CHAVES) {
    const l = linhas.find((x) => x.nome === nome);
    // Confere se a chave guardada ainda abre: se a chave mestra mudou, ela não abre mais
    // e o painel precisa dizer isso, em vez de mostrar tudo certo e o pagamento falhar.
    const legivel = l ? (m ? (await decifrar(l.valor_cifrado, m)) !== null : false) : true;
    chaves.push({
      nome,
      origem: l ? "painel" : process.env[nome] ? "ambiente" : "nenhuma",
      final: l?.final ?? "",
      alterado_em: l?.alterado_em ?? null,
      legivel,
    });
  }
  return resposta(200, { mestra: !!m, chaves }, { "cache-control": "no-store" });
}

// POST /api/admin/chaves { nome, valor | null } — salva (ou apaga com valor null)
export async function handleSalvarChave(request: Request) {
  const u = await exigirAdmin(request);
  if (u instanceof Response) return u;
  const m = mestra();
  if (!m) return falha(503, "A proteção das chaves ainda não está pronta. Tente novamente em instantes.");
  const corpo = await lerCorpo<{ nome?: unknown; valor?: unknown }>(request, 5000);
  if (!ehNomeChave(corpo?.nome)) return falha(400, "Chave desconhecida.");
  const nome = corpo.nome;
  const sb = await servico();
  if (corpo.valor === null) {
    await sb.from("chaves_sistema").delete().eq("nome", nome);
    await evento(request, "chave_removida", "aviso", `${nome} removida do painel por ${u.email ?? u.id}.`);
  } else {
    const valor = typeof corpo.valor === "string" ? corpo.valor.trim() : "";
    if (valor.length < 12 || valor.length > 2000 || /\s/.test(valor)) return falha(400, "A chave precisa ter pelo menos 12 caracteres, sem espaços.");
    const { error } = await sb.from("chaves_sistema").upsert({ nome, valor_cifrado: await cifrar(valor, m), final: finalDaChave(valor), alterado_por: u.id, alterado_em: new Date().toISOString() });
    if (error) return falha(500, "Não foi possível salvar a chave. Tente de novo.");
    await evento(request, "chave_alterada", "aviso", `${nome} alterada no painel por ${u.email ?? u.id}.`);
  }
  cache.delete(nome);
  return resposta(200, { ok: true });
}

// POST /api/admin/chaves/testar — confere o token do Mercado Pago
export async function handleTestarMercadoPago(request: Request) {
  const u = await exigirAdmin(request);
  if (u instanceof Response) return u;
  const token = await lerChave("MERCADOPAGO_ACCESS_TOKEN");
  if (!token) return resposta(200, { ok: false, mensagem: "Nenhum token configurado." });
  try {
    const r = await fetch("https://api.mercadopago.com/users/me", { headers: { authorization: `Bearer ${token}` } });
    return resposta(200, r.ok ? { ok: true, mensagem: "Token aceito pelo Mercado Pago." } : { ok: false, mensagem: "O Mercado Pago recusou este token. Confira se é o Access Token de produção." });
  } catch {
    return resposta(200, { ok: false, mensagem: "Não foi possível falar com o Mercado Pago agora." });
  }
}

// POST /api/public/resgate { chave } — desliga a manutenção com a chave de resgate
export async function handleResgate(request: Request) {
  const ip = ipDe(request);
  if (!allowRequest(`resgate:${ip}`, 5, 60_000, 600_000)) return falha(429, "Muitas tentativas. Espere alguns minutos.");
  if (!(await dentroDoLimite(`resgate:${ip}`, 10, 3600))) return falha(429, "Muitas tentativas. Tente de novo daqui a uma hora.");
  const corpo = await lerCorpo<{ chave?: unknown }>(request, 3000);
  const enviada = typeof corpo?.chave === "string" ? corpo.chave.trim() : "";
  const certa = await lerChave("CHAVE_RESGATE");
  if (!certa) return falha(503, "O resgate não está configurado.");
  if (!enviada || !iguais(enviada, certa)) {
    await evento(request, "resgate_chave_errada", "critico", "Tentativa de resgate com chave errada.");
    return falha(401, "Chave de resgate incorreta.");
  }
  const sb = await servico();
  const atual = await sb.from("manutencao_config").select("status").eq("id", 1).maybeSingle();
  const anterior = (atual.data as { status?: string } | null)?.status ?? null;
  const { error } = await sb.from("manutencao_config").update({ status: "ativo", atualizado_em: new Date().toISOString(), atualizado_por: null }).eq("id", 1);
  if (error) return falha(500, "Não foi possível desligar a manutenção.");
  await sb.from("manutencao_historico").insert({ status_anterior: anterior, status_novo: "ativo", detalhes: { origem: "chave_de_resgate" }, ip });
  await evento(request, "resgate_usado", "critico", "Manutenção desligada com a chave de resgate.");
  invalidarCacheManutencao();
  return resposta(200, { ok: true });
}

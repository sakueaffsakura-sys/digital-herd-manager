// Assinatura paga (Mercado Pago Checkout Pro) e leitura protegida dos eBooks.
// Segredos só no servidor: MERCADOPAGO_ACCESS_TOKEN e MERCADOPAGO_WEBHOOK_SECRET (Lovable Cloud → Secrets).
// O navegador manda só o plano e a propriedade: preço, validade e liberação vêm do banco.
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { allowRequest } from "./rate-limit";
import { clienteDoSite, dentroDoLimite, falha, ipDe, lerCorpo, origemSegura, resposta } from "./conta.server";
import { decidirPagamento, validarAviso, type PagamentoBanco, type PagamentoMP } from "./mercadopago";

const MP = "https://api.mercadopago.com";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type RpcSolta = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;

async function servico(): Promise<SupabaseClient> {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin as unknown as SupabaseClient;
}
async function evento(request: Request, tipo: string, severidade: "info" | "aviso" | "critico", detalhe: string) {
  const { registrarEvento } = await import("./security-events.server");
  registrarEvento({ tipo, severidade, ip: ipDe(request), caminho: new URL(request.url).pathname.slice(0, 120), detalhe: detalhe.slice(0, 300) });
}

/** Lê o "aal" do token já conferido pelo Auth (sem confiar no navegador para mais nada). */
function nivelDoToken(token: string): string {
  try {
    const p = token.split(".")[1] ?? "";
    const json = JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(p.length / 4) * 4, "=")));
    return typeof json.aal === "string" ? json.aal : "aal1";
  } catch {
    return "aal1";
  }
}
/** Conta com duas etapas ligadas precisa de sessão confirmada pelo código. */
function faltaCodigo(user: User, token: string) {
  return (user.factors ?? []).some((f) => f.status === "verified") && nivelDoToken(token) !== "aal2";
}

async function usuario(request: Request, limitePorMinuto: number) {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return falha(401, "Entre na sua conta para continuar.");
  const token = auth.slice(7).trim();
  const supabase = clienteDoSite(token);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return falha(401, "Sua sessão expirou. Entre novamente.");
  if (!allowRequest(`ass-user:${data.user.id}`, limitePorMinuto, 60_000, 60_000)) return falha(429, "Muitos pedidos. Espere um minuto.");
  if (faltaCodigo(data.user, token)) return falha(403, "Confirme o código da verificação em duas etapas.");
  return { supabase, user: data.user, token };
}

// ---------------------------------------------------------------------------
// POST /api/assinatura/checkout { plano_id, propriedade_id } → { url } do Mercado Pago
// ---------------------------------------------------------------------------
export async function handleCheckout(request: Request) {
  const u = await usuario(request, 20);
  if (u instanceof Response) return u;
  const token = process.env["MERCADOPAGO_ACCESS_TOKEN"];
  if (!token) return falha(503, "Os pagamentos ainda não foram configurados. Avise o administrador do site.");
  if (!(await dentroDoLimite(`checkout:${u.user.id}`, 10, 3600))) return falha(429, "Muitas tentativas de pagamento. Tente de novo daqui a uma hora.");
  const corpo = await lerCorpo<{ plano_id?: unknown; propriedade_id?: unknown }>(request, 2000);
  const planoId = typeof corpo?.plano_id === "string" ? corpo.plano_id : "";
  const propId = typeof corpo?.propriedade_id === "string" ? corpo.propriedade_id : "";
  if (!UUID.test(planoId) || !UUID.test(propId)) return falha(400, "Escolha o plano e a propriedade.");

  // Preço e plano lidos do banco com as regras de acesso da pessoa (só planos ativos e com preço).
  const plano = await u.supabase.from("planos").select("id,nome,descricao,meses,preco_centavos,ativo").eq("id", planoId).maybeSingle();
  const p = plano.data as { id: string; nome: string; descricao: string | null; meses: number; preco_centavos: number; ativo: boolean } | null;
  if (!p || !p.ativo || p.preco_centavos <= 0) return falha(404, "Este plano não está disponível.");
  const prop = await u.supabase.from("propriedades").select("id,nome,proprietario_id").eq("id", propId).maybeSingle();
  const pr = prop.data as { id: string; nome: string; proprietario_id: string } | null;
  if (!pr || pr.proprietario_id !== u.user.id) return falha(403, "Só o dono da propriedade pode assinar por ela.");

  const sb = await servico();
  const novo = await sb.from("pagamentos")
    .insert({ user_id: u.user.id, propriedade_id: pr.id, plano_id: p.id, plano_nome: p.nome, meses: p.meses, valor_centavos: p.preco_centavos, status: "pendente" })
    .select("id").single();
  if (novo.error || !novo.data) { console.error("checkout: pagamento", novo.error?.message); return falha(500, "Não foi possível começar o pagamento."); }
  const pagamentoId = (novo.data as { id: string }).id;
  const origem = origemSegura(request);
  const agora = new Date();
  const preferencia = {
    items: [{ id: p.id, title: `Pecuária Digital Premium — ${p.nome}`, description: `${p.meses} mês(es) de Premium para ${pr.nome}`.slice(0, 250), quantity: 1, currency_id: "BRL", unit_price: p.preco_centavos / 100 }],
    payer: { email: u.user.email },
    external_reference: pagamentoId,
    notification_url: `${origem}/api/public/mercadopago/webhook`,
    back_urls: {
      success: `${origem}/app/assinatura?retorno=sucesso`,
      pending: `${origem}/app/assinatura?retorno=pendente`,
      failure: `${origem}/app/assinatura?retorno=falha`,
    },
    auto_return: "approved",
    binary_mode: false,
    expires: true,
    expiration_date_from: agora.toISOString(),
    expiration_date_to: new Date(agora.getTime() + 24 * 3600_000).toISOString(),
    statement_descriptor: "PECUARIADIGITAL",
    metadata: { pagamento_id: pagamentoId },
  };
  let r: Response;
  try {
    r = await fetch(`${MP}/checkout/preferences`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json", "x-idempotency-key": pagamentoId },
      body: JSON.stringify(preferencia),
    });
  } catch (e) {
    console.error("checkout: rede", e);
    return falha(502, "O Mercado Pago não respondeu. Tente de novo.");
  }
  const dados = (await r.json().catch(() => ({}))) as { id?: string; init_point?: string; message?: string };
  if (!r.ok || !dados.init_point || !dados.id) {
    console.error("checkout: Mercado Pago", r.status, dados.message);
    await (sb.rpc.bind(sb) as unknown as RpcSolta)("mp_registrar_status", { _pagamento: pagamentoId, _status: "cancelado", _mp_payment_id: null, _metodo: null, _detalhes: { erro: "preferencia", http: r.status } });
    return falha(502, "Não foi possível abrir o pagamento agora. Tente de novo.");
  }
  await sb.from("pagamentos").update({ mp_preference_id: dados.id, atualizado_em: new Date().toISOString() }).eq("id", pagamentoId);
  return resposta(200, { url: dados.init_point });
}

// ---------------------------------------------------------------------------
// POST /api/public/mercadopago/webhook — aviso do Mercado Pago (assinado)
// ---------------------------------------------------------------------------
export async function handleWebhook(request: Request) {
  const segredo = process.env["MERCADOPAGO_WEBHOOK_SECRET"];
  const token = process.env["MERCADOPAGO_ACCESS_TOKEN"];
  if (!segredo || !token) return falha(503, "não configurado");
  if (!allowRequest(`mp-aviso:${ipDe(request)}`, 300, 60_000, 60_000)) return falha(429, "excesso");
  const url = new URL(request.url);
  const corpo = (await lerCorpo<{ type?: string; action?: string; data?: { id?: string | number } }>(request, 20_000)) ?? {};
  const tipo = url.searchParams.get("type") ?? url.searchParams.get("topic") ?? corpo.type ?? "";
  const dataId = url.searchParams.get("data.id") ?? (corpo.data?.id != null ? String(corpo.data.id) : null);
  const v = await validarAviso({ xSignature: request.headers.get("x-signature"), xRequestId: request.headers.get("x-request-id"), dataId, segredo });
  if (!v.ok) {
    await evento(request, "pagamento_aviso_invalido", "aviso", `Aviso do Mercado Pago recusado (${v.motivo}).`);
    return falha(401, "assinatura inválida");
  }
  if (tipo !== "payment" || !dataId) return resposta(200, { ok: true, ignorado: tipo || "sem tipo" });

  // Nunca confiar no corpo do aviso: busca o pagamento na API com o token do servidor.
  let mp: PagamentoMP;
  try {
    const r = await fetch(`${MP}/v1/payments/${encodeURIComponent(dataId)}`, { headers: { authorization: `Bearer ${token}` } });
    if (r.status === 404) return resposta(200, { ok: true, ignorado: "pagamento inexistente" });
    if (!r.ok) return falha(502, "falha ao consultar");
    mp = (await r.json()) as PagamentoMP;
  } catch {
    return falha(502, "falha ao consultar");
  }
  const ref = String(mp.external_reference ?? "");
  if (!UUID.test(ref)) return resposta(200, { ok: true, ignorado: "sem referência nossa" });
  const sb = await servico();
  const rpc = sb.rpc.bind(sb) as unknown as RpcSolta;
  const banco = await sb.from("pagamentos").select("id,valor_centavos,moeda,status,mp_payment_id").eq("id", ref).maybeSingle();
  const d = decidirPagamento((banco.data as PagamentoBanco | null) ?? null, mp);
  const detalhes = {
    status: mp.status, status_detail: mp.status_detail ?? null, payment_type_id: mp.payment_type_id ?? null,
    payment_method_id: mp.payment_method_id ?? null, transaction_amount: mp.transaction_amount ?? null, date_approved: mp.date_approved ?? null,
  };
  if (d.acao === "ativar") {
    const r = await rpc("mp_ativar_assinatura", { _pagamento: ref, _mp_payment_id: String(mp.id), _metodo: d.metodo, _detalhes: detalhes });
    if (r.error) { console.error("aviso: ativar", r.error.message); return falha(500, "erro"); }
  } else if (d.acao === "estornar") {
    const r = await rpc("mp_estornar", { _mp_payment_id: String(mp.id), _motivo: mp.status === "charged_back" ? "contestado" : "estornado" });
    if (r.error) { console.error("aviso: estorno", r.error.message); return falha(500, "erro"); }
  } else if (d.acao === "recusar" || d.acao === "aguardar") {
    await rpc("mp_registrar_status", { _pagamento: ref, _status: d.status, _mp_payment_id: String(mp.id), _metodo: mp.payment_type_id ?? null, _detalhes: detalhes });
  } else if (d.motivo === "valor_ou_moeda_diferente" || d.motivo === "outro_pagamento") {
    await evento(request, "pagamento_divergente", "critico", `Pagamento ${String(mp.id)} não liberado: ${d.motivo}.`);
  }
  return resposta(200, { ok: true });
}

// ---------------------------------------------------------------------------
// GET /api/admin/pagamentos/estado — o administrador vê se os segredos existem (nunca os valores)
// ---------------------------------------------------------------------------
export async function handleEstadoPagamentos(request: Request) {
  const u = await usuario(request, 30);
  if (u instanceof Response) return u;
  const { data } = await (u.supabase.rpc.bind(u.supabase) as unknown as RpcSolta)("sou_admin");
  if (data !== true) return falha(403, "Só administradores.");
  return resposta(200, {
    token: !!process.env["MERCADOPAGO_ACCESS_TOKEN"],
    segredo: !!process.env["MERCADOPAGO_WEBHOOK_SECRET"],
    url_aviso: `${origemSegura(request)}/api/public/mercadopago/webhook`,
  });
}

// ---------------------------------------------------------------------------
// GET /api/ebooks/:id/arquivo — o PDF passa pelo servidor (nunca um link do armazenamento)
// ---------------------------------------------------------------------------
const mascarar = (ip: string) => (ip.includes(".") ? ip.split(".").slice(0, 3).join(".") + ".x" : ip.includes(":") ? ip.split(":").slice(0, 4).join(":") + ":x" : ip);

// O leitor busca o PDF em pedaços: depois de conferir tudo uma vez, a mesma pessoa e o mesmo livro
// passam direto por 60 segundos (o token continua sendo conferido em todo pedido).
const liberados = new Map<string, { caminho: string; ate: number }>();

export async function handleEbookArquivo(request: Request, id: string) {
  if (!UUID.test(id)) return falha(404, "eBook não encontrado.");
  const u = await usuario(request, 240);
  if (u instanceof Response) return u;
  const chave = `${u.user.id}:${id}`;
  const sb = await servico();
  const emCache = liberados.get(chave);
  let caminho = emCache && emCache.ate > Date.now() ? emCache.caminho : null;
  if (!caminho) {
    const rpcUsuario = u.supabase.rpc.bind(u.supabase) as unknown as RpcSolta;
    const assinante = await rpcUsuario("sou_assinante");
    if (assinante.data !== true) return falha(403, "A biblioteca é só para assinantes.");
    const eb = await u.supabase.from("ebooks").select("id,arquivo_path,publicado").eq("id", id).maybeSingle();
    const e = eb.data as { id: string; arquivo_path: string | null; publicado: boolean } | null;
    if (!e || !e.publicado || !e.arquivo_path) return falha(404, "eBook não encontrado.");
    const acesso = await (sb.rpc.bind(sb) as unknown as RpcSolta)("ebook_registrar_acesso", { _ebook: e.id, _user: u.user.id, _ip: mascarar(ipDe(request)) });
    if (acesso.error) return falha(503, "Leitura indisponível agora. Tente de novo.");
    if ((acesso.data as { permitido?: boolean } | null)?.permitido !== true) return falha(429, "Você abriu muitos eBooks hoje. A leitura volta amanhã.");
    caminho = e.arquivo_path;
    if (liberados.size > 5000) liberados.clear();
    liberados.set(chave, { caminho, ate: Date.now() + 60_000 });
  }

  const assinado = await sb.storage.from("ebooks").createSignedUrl(caminho, 60);
  if (assinado.error || !assinado.data?.signedUrl) return falha(404, "Arquivo do eBook não encontrado.");
  const range = request.headers.get("range");
  let origem: Response;
  try {
    origem = await fetch(assinado.data.signedUrl, { headers: range && /^bytes=\d*-\d*$/.test(range) ? { range } : {} });
  } catch {
    return falha(502, "Não foi possível ler o arquivo agora.");
  }
  if (!origem.ok || !origem.body) return falha(502, "Não foi possível ler o arquivo agora.");
  const cab = new Headers({
    "content-type": "application/pdf",
    "content-disposition": 'inline; filename="ebook.pdf"',
    "cache-control": "private, no-store, max-age=0",
    "accept-ranges": "bytes",
    "x-content-type-options": "nosniff",
    "cross-origin-resource-policy": "same-origin",
    "x-robots-tag": "noindex, nofollow",
  });
  for (const h of ["content-length", "content-range"]) {
    const v = origem.headers.get(h);
    if (v) cab.set(h, v);
  }
  return new Response(origem.body, { status: origem.status === 206 ? 206 : 200, headers: cab });
}

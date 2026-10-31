/**
 * Regras do pagamento pelo Mercado Pago, sem rede (testadas em src/lib/__tests__/mercadopago.test.ts).
 * O servidor usa estas funções para: conferir a assinatura do aviso (webhook) e decidir o que fazer
 * com um pagamento que ele mesmo buscou na API do Mercado Pago (nunca no corpo do aviso).
 */

export const TOLERANCIA_AVISO_MS = 10 * 60_000;

function hex(buf: ArrayBuffer) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Comparação em tempo constante (não vaza, pelo tempo, quantos caracteres batem). */
export function iguaisTempoConstante(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** Lê "ts=...,v1=..." do cabeçalho x-signature. */
export function lerCabecalhoAssinatura(x: string | null) {
  const partes = Object.fromEntries(
    (x ?? "").split(",").map((p) => p.split("=").map((s) => s.trim())).filter((p) => p.length === 2 && p[0] && p[1]),
  ) as Record<string, string>;
  return { ts: partes["ts"] ?? null, v1: partes["v1"] ?? null };
}

export type ResultadoAssinatura = { ok: true } | { ok: false; motivo: "sem_cabecalho" | "sem_id" | "antigo" | "diferente" };

/**
 * Valida o aviso do Mercado Pago: HMAC-SHA256 com a assinatura secreta sobre
 * "id:<data.id>;request-id:<x-request-id>;ts:<ts>;" e recusa avisos com mais de 10 minutos.
 */
export async function validarAviso({
  xSignature, xRequestId, dataId, segredo, agoraMs = Date.now(), toleranciaMs = TOLERANCIA_AVISO_MS,
}: { xSignature: string | null; xRequestId: string | null; dataId: string | null; segredo: string; agoraMs?: number; toleranciaMs?: number }): Promise<ResultadoAssinatura> {
  const { ts, v1 } = lerCabecalhoAssinatura(xSignature);
  if (!ts || !v1 || !xRequestId) return { ok: false, motivo: "sem_cabecalho" };
  if (!dataId || !/^[A-Za-z0-9_-]{1,64}$/.test(dataId)) return { ok: false, motivo: "sem_id" };
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return { ok: false, motivo: "sem_cabecalho" };
  const tsMs = tsNum > 1e12 ? tsNum : tsNum * 1000; // aceita segundos ou milissegundos
  if (Math.abs(agoraMs - tsMs) > toleranciaMs) return { ok: false, motivo: "antigo" };
  // O Mercado Pago pede o id em minúsculas quando ele é alfanumérico.
  const id = /^[A-Za-z0-9]+$/.test(dataId) ? dataId.toLowerCase() : dataId;
  const manifesto = `id:${id};request-id:${xRequestId};ts:${ts};`;
  const chave = await crypto.subtle.importKey("raw", new TextEncoder().encode(segredo), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const assinatura = hex(await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(manifesto)));
  return iguaisTempoConstante(assinatura, v1.toLowerCase()) ? { ok: true } : { ok: false, motivo: "diferente" };
}

/** O que o banco diz do pagamento (criado pelo próprio servidor no checkout). */
export type PagamentoBanco = { id: string; valor_centavos: number; moeda: string; status: string; mp_payment_id: string | null };
/** O que a API do Mercado Pago devolve (só os campos usados). */
export type PagamentoMP = {
  id: number | string;
  status: string; // approved, pending, in_process, rejected, cancelled, refunded, charged_back, in_mediation
  status_detail?: string;
  external_reference?: string | null;
  transaction_amount?: number;
  currency_id?: string;
  payment_type_id?: string;
  payment_method_id?: string;
  date_approved?: string | null;
};

export type Decisao =
  | { acao: "ativar"; metodo: string }
  | { acao: "estornar" }
  | { acao: "recusar"; status: "recusado" | "cancelado" }
  | { acao: "aguardar"; status: "pendente" | "em_analise" }
  | { acao: "ignorar"; motivo: string };

/**
 * Decide o que fazer. Só ativa quando: o pagamento é nosso (external_reference), está aprovado, a moeda é
 * real e o valor é exatamente o do banco. Pagamento já aprovado com o mesmo id do Mercado Pago = nada a fazer
 * (o aviso chega mais de uma vez).
 */
export function decidirPagamento(banco: PagamentoBanco | null, mp: PagamentoMP): Decisao {
  if (!banco) return { acao: "ignorar", motivo: "referencia_desconhecida" };
  if (String(mp.external_reference ?? "") !== banco.id) return { acao: "ignorar", motivo: "referencia_diferente" };
  const mpId = String(mp.id);
  if (banco.mp_payment_id && banco.mp_payment_id !== mpId) return { acao: "ignorar", motivo: "outro_pagamento" };
  const valorMP = Math.round(Number(mp.transaction_amount ?? NaN) * 100);
  const valorOk = Number.isFinite(valorMP) && valorMP === banco.valor_centavos && (mp.currency_id ?? "") === (banco.moeda || "BRL");
  switch (mp.status) {
    case "approved":
      if (!valorOk) return { acao: "ignorar", motivo: "valor_ou_moeda_diferente" };
      if (banco.status === "aprovado") return { acao: "ignorar", motivo: "ja_aprovado" };
      if (banco.status === "estornado") return { acao: "ignorar", motivo: "ja_estornado" };
      return { acao: "ativar", metodo: mp.payment_type_id || mp.payment_method_id || "mercadopago" };
    case "refunded":
    case "charged_back":
      if (banco.status === "estornado") return { acao: "ignorar", motivo: "ja_estornado" };
      return banco.status === "aprovado" ? { acao: "estornar" } : { acao: "recusar", status: "cancelado" };
    case "rejected":
      return banco.status === "aprovado" ? { acao: "ignorar", motivo: "ja_aprovado" } : { acao: "recusar", status: "recusado" };
    case "cancelled":
      return banco.status === "aprovado" ? { acao: "ignorar", motivo: "ja_aprovado" } : { acao: "recusar", status: "cancelado" };
    case "in_process":
    case "in_mediation":
      return banco.status === "aprovado" ? { acao: "ignorar", motivo: "ja_aprovado" } : { acao: "aguardar", status: "em_analise" };
    default:
      return banco.status === "aprovado" ? { acao: "ignorar", motivo: "ja_aprovado" } : { acao: "aguardar", status: "pendente" };
  }
}

/** Nome do meio de pagamento para a tela. */
export function nomeDoMetodo(m: string | null | undefined) {
  switch (m) {
    case "bank_transfer": case "pix": return "Pix";
    case "credit_card": return "Cartão de crédito";
    case "debit_card": return "Cartão de débito";
    case "ticket": case "bolbradesco": return "Boleto";
    case "account_money": return "Saldo do Mercado Pago";
    default: return m ? "Mercado Pago" : "—";
  }
}

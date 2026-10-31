import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decidirPagamento, iguaisTempoConstante, lerCabecalhoAssinatura, validarAviso, type PagamentoBanco } from "../mercadopago";

const SEGREDO = "segredo-de-teste";
const assinar = (id: string, req: string, ts: string) => createHmac("sha256", SEGREDO).update(`id:${id};request-id:${req};ts:${ts};`).digest("hex");

describe("aviso do Mercado Pago (webhook)", () => {
  const agora = 1_793_500_000_000;
  const ts = String(Math.floor(agora / 1000));

  it("aceita assinatura válida", async () => {
    const v1 = assinar("123456", "req-1", ts);
    expect(await validarAviso({ xSignature: `ts=${ts},v1=${v1}`, xRequestId: "req-1", dataId: "123456", segredo: SEGREDO, agoraMs: agora })).toEqual({ ok: true });
  });

  it("recusa assinatura feita com outro segredo ou outro id", async () => {
    const v1 = createHmac("sha256", "outro").update(`id:123456;request-id:req-1;ts:${ts};`).digest("hex");
    expect(await validarAviso({ xSignature: `ts=${ts},v1=${v1}`, xRequestId: "req-1", dataId: "123456", segredo: SEGREDO, agoraMs: agora })).toEqual({ ok: false, motivo: "diferente" });
    const certo = assinar("123456", "req-1", ts);
    expect(await validarAviso({ xSignature: `ts=${ts},v1=${certo}`, xRequestId: "req-1", dataId: "999", segredo: SEGREDO, agoraMs: agora })).toEqual({ ok: false, motivo: "diferente" });
  });

  it("recusa aviso antigo (mais de 10 minutos)", async () => {
    const velho = String(Math.floor((agora - 11 * 60_000) / 1000));
    const v1 = assinar("123456", "req-1", velho);
    expect(await validarAviso({ xSignature: `ts=${velho},v1=${v1}`, xRequestId: "req-1", dataId: "123456", segredo: SEGREDO, agoraMs: agora })).toEqual({ ok: false, motivo: "antigo" });
  });

  it("recusa sem cabeçalho ou com id estranho", async () => {
    expect((await validarAviso({ xSignature: null, xRequestId: "r", dataId: "1", segredo: SEGREDO })).ok).toBe(false);
    expect((await validarAviso({ xSignature: `ts=${ts},v1=ab`, xRequestId: "r", dataId: "1;drop", segredo: SEGREDO, agoraMs: agora })).ok).toBe(false);
  });

  it("lê o cabeçalho e compara em tempo constante", () => {
    expect(lerCabecalhoAssinatura("ts=1,v1=abc")).toEqual({ ts: "1", v1: "abc" });
    expect(iguaisTempoConstante("abc", "abc")).toBe(true);
    expect(iguaisTempoConstante("abc", "abd")).toBe(false);
    expect(iguaisTempoConstante("abc", "ab")).toBe(false);
  });
});

describe("decisão sobre o pagamento", () => {
  const banco: PagamentoBanco = { id: "pag-1", valor_centavos: 4990, moeda: "BRL", status: "pendente", mp_payment_id: null };
  const mp = { id: 777, status: "approved", external_reference: "pag-1", transaction_amount: 49.9, currency_id: "BRL", payment_type_id: "bank_transfer" };

  it("ativa quando aprovado com valor e moeda certos", () => {
    expect(decidirPagamento(banco, mp)).toEqual({ acao: "ativar", metodo: "bank_transfer" });
  });
  it("não ativa com valor diferente (alguém mexeu no preço)", () => {
    expect(decidirPagamento(banco, { ...mp, transaction_amount: 0.5 })).toEqual({ acao: "ignorar", motivo: "valor_ou_moeda_diferente" });
    expect(decidirPagamento(banco, { ...mp, currency_id: "USD" })).toEqual({ acao: "ignorar", motivo: "valor_ou_moeda_diferente" });
  });
  it("aviso repetido não ativa duas vezes", () => {
    expect(decidirPagamento({ ...banco, status: "aprovado", mp_payment_id: "777" }, mp)).toEqual({ acao: "ignorar", motivo: "ja_aprovado" });
  });
  it("estorno ou contestação retira o que foi liberado", () => {
    expect(decidirPagamento({ ...banco, status: "aprovado", mp_payment_id: "777" }, { ...mp, status: "refunded" })).toEqual({ acao: "estornar" });
    expect(decidirPagamento({ ...banco, status: "aprovado", mp_payment_id: "777" }, { ...mp, status: "charged_back" })).toEqual({ acao: "estornar" });
    expect(decidirPagamento({ ...banco, status: "estornado", mp_payment_id: "777" }, { ...mp, status: "refunded" })).toEqual({ acao: "ignorar", motivo: "ja_estornado" });
  });
  it("ignora pagamento de outra referência ou outro id", () => {
    expect(decidirPagamento(null, mp)).toEqual({ acao: "ignorar", motivo: "referencia_desconhecida" });
    expect(decidirPagamento(banco, { ...mp, external_reference: "outro" })).toEqual({ acao: "ignorar", motivo: "referencia_diferente" });
    expect(decidirPagamento({ ...banco, mp_payment_id: "555" }, mp)).toEqual({ acao: "ignorar", motivo: "outro_pagamento" });
  });
  it("Pix pendente e boleto em análise ficam aguardando", () => {
    expect(decidirPagamento(banco, { ...mp, status: "pending" })).toEqual({ acao: "aguardar", status: "pendente" });
    expect(decidirPagamento(banco, { ...mp, status: "in_process" })).toEqual({ acao: "aguardar", status: "em_analise" });
    expect(decidirPagamento(banco, { ...mp, status: "rejected" })).toEqual({ acao: "recusar", status: "recusado" });
  });
});

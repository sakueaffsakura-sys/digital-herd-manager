import { beforeAll, describe, expect, it } from "vitest";
import { cunharToken, donoDoToken, tokenDoCabecalho } from "../conta/token-curto";

const NAIR = "11111111-1111-4111-8111-111111111111";
const JOAO = "22222222-2222-4222-8222-222222222222";

beforeAll(() => {
  process.env["CHAVE_MESTRA"] = "chave-de-conferencia";
});

describe("o token curto", () => {
  it("o que nós cunhamos volta valendo, e é da pessoa certa", () => {
    expect(donoDoToken(cunharToken(NAIR).token)).toBe(NAIR);
  });

  it("dura cinco minutos", () => {
    const { expiraEm } = cunharToken(NAIR);
    const faltam = expiraEm - Math.floor(Date.now() / 1000);
    expect(faltam).toBeGreaterThan(290);
    expect(faltam).toBeLessThanOrEqual(300);
  });

  it("trocar de quem é o token invalida a assinatura", () => {
    const { token } = cunharToken(NAIR);
    const [versao, , ate, assinatura] = token.split(".");
    expect(donoDoToken(`${versao}.${JOAO}.${ate}.${assinatura}`)).toBe(null);
  });

  it("esticar o prazo invalida a assinatura", () => {
    const { token } = cunharToken(NAIR);
    const [versao, id, ate, assinatura] = token.split(".");
    expect(donoDoToken(`${versao}.${id}.${Number(ate) + 86_400}.${assinatura}`)).toBe(null);
  });

  it("prazo vencido não vale, mesmo com assinatura nossa", () => {
    // Um token que nós mesmos assinaríamos, mas com a hora no passado.
    const antes = Math.floor(Date.now() / 1000) - 10;
    const falso = cunharToken(NAIR).token.split(".");
    expect(donoDoToken(`${falso[0]}.${falso[1]}.${antes}.${falso[3]}`)).toBe(null);
  });

  it("assinatura inventada não vale", () => {
    const { token } = cunharToken(NAIR);
    const [versao, id, ate] = token.split(".");
    expect(donoDoToken(`${versao}.${id}.${ate}.qualquercoisa`)).toBe(null);
    expect(donoDoToken(`${versao}.${id}.${ate}.`)).toBe(null);
  });

  it("formato estranho não vale, e não quebra", () => {
    for (const ruim of ["", "   ", "um.dois", "a.b.c.d.e", null, undefined, 42, {}, "x".repeat(500)]) {
      expect(donoDoToken(ruim as unknown), String(ruim)).toBe(null);
    }
  });

  it("um token de outra versão não vale: é o que permite trocar o formato depois", () => {
    const { token } = cunharToken(NAIR);
    const [, id, ate, assinatura] = token.split(".");
    expect(donoDoToken(`v2.${id}.${ate}.${assinatura}`)).toBe(null);
  });

  it("o token não carrega se a pessoa é administrador", () => {
    // Quem é administrador sai do banco em cada pedido. Um token cunhado antes de alguém
    // perder o cargo não pode continuar dizendo que ele é.
    const { token } = cunharToken(NAIR);
    expect(token).not.toMatch(/admin/i);
    expect(token.split(".")).toHaveLength(4);
  });
});

describe("o token do cabeçalho", () => {
  const pedido = (cabecalho?: string) =>
    new Request("https://exemplo.com/api/x", { headers: cabecalho ? { authorization: cabecalho } : {} });

  it("lê o Bearer", () => {
    expect(tokenDoCabecalho(pedido("Bearer abc123"))).toBe("abc123");
    expect(tokenDoCabecalho(pedido("bearer abc123"))).toBe("abc123");
    expect(tokenDoCabecalho(pedido("  Bearer   abc123  "))).toBe("abc123");
  });

  it("sem cabeçalho, ou com outro esquema, não devolve nada", () => {
    expect(tokenDoCabecalho(pedido())).toBe(null);
    expect(tokenDoCabecalho(pedido("Basic dXNlcjpzZW5oYQ=="))).toBe(null);
    expect(tokenDoCabecalho(pedido("Bearer"))).toBe(null);
    expect(tokenDoCabecalho(pedido("Bearer    "))).toBe(null);
  });
});

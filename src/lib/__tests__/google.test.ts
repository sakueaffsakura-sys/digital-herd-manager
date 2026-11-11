import { beforeAll, describe, expect, it } from "vitest";
import { paraTeste } from "../conta/google.server";

const { montarEstado, estadoValido, lerIdToken } = paraTeste;

beforeAll(() => {
  process.env["CHAVE_MESTRA"] = "chave-de-conferencia";
});

/** Monta um id_token de mentira: só o miolo importa, que é o que o código lê. */
const idTokenFalso = (dados: Record<string, unknown>) =>
  `cabecalho.${Buffer.from(JSON.stringify(dados), "utf8").toString("base64url")}.assinatura`;

describe("o state da entrada pelo Google", () => {
  it("o que nós montamos volta valendo", () => {
    expect(estadoValido(montarEstado())).toBe(true);
  });
  it("um valor inventado não vale", () => {
    expect(estadoValido("qualquer.1763000000.coisa")).toBe(false);
  });
  it("mexer num pedaço invalida o resto", () => {
    const bom = montarEstado();
    const [valor, quando, assinatura] = bom.split(".");
    // A assinatura é dos dois primeiros pedaços: trocar a hora quebra a conta.
    expect(estadoValido(`${valor}.${Number(quando) + 1}.${assinatura}`)).toBe(false);
    expect(estadoValido(`${valor}x.${quando}.${assinatura}`)).toBe(false);
  });
  it("um state de uma hora atrás já passou do prazo", () => {
    const antigo = montarEstado();
    const [valor] = antigo.split(".");
    const horaVelha = String(Math.floor(Date.now() / 1000) - 3600);
    expect(estadoValido(`${valor}.${horaVelha}.qualquer`)).toBe(false);
  });
  it("sem os três pedaços não vale", () => {
    expect(estadoValido("")).toBe(false);
    expect(estadoValido("um.dois")).toBe(false);
  });
});

describe("o que o Google respondeu", () => {
  it("lê quem é a pessoa", () => {
    const g = lerIdToken(idTokenFalso({ sub: "11223344", email: "Maria@Exemplo.com", email_verified: true, name: "Maria" }));
    expect(g.sub).toBe("11223344");
    expect(g.email).toBe("maria@exemplo.com");
    expect(g.emailConfirmado).toBe(true);
    expect(g.nome).toBe("Maria");
  });
  it("e-mail não confirmado fica marcado como não confirmado", () => {
    expect(lerIdToken(idTokenFalso({ sub: "1", email: "a@b.com", email_verified: false })).emailConfirmado).toBe(false);
    expect(lerIdToken(idTokenFalso({ sub: "1", email: "a@b.com" })).emailConfirmado).toBe(false);
  });
  it("sem e-mail ou sem identificador, recusa", () => {
    expect(() => lerIdToken(idTokenFalso({ sub: "1" }))).toThrow();
    expect(() => lerIdToken(idTokenFalso({ email: "a@b.com" }))).toThrow();
  });
  it("resposta que não é um token recusa, em vez de passar vazia", () => {
    expect(() => lerIdToken("nada")).toThrow();
    expect(() => lerIdToken("a.nao-e-json.c")).toThrow();
  });
});

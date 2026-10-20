import { describe, expect, it } from "vitest";
import { BUSCA_MAX, escapeILikeValue, orSearch, quoteOrValue, termoDeBusca } from "../busca";

describe("termoDeBusca", () => {
  it("tira espaços repetidos, controles e limita o tamanho", () => {
    expect(termoDeBusca("  vaca   mastite \n")).toBe("vaca mastite");
    expect(termoDeBusca("a\u0000b")).toBe("a b");
    expect(termoDeBusca("x".repeat(500))).toHaveLength(BUSCA_MAX);
    expect(termoDeBusca("   ")).toBe("");
  });
});

describe("escapeILikeValue / quoteOrValue", () => {
  it("escapa curingas do ILIKE", () => {
    expect(escapeILikeValue("50%")).toBe("50\\%");
    expect(escapeILikeValue("a_b")).toBe("a\\_b");
    expect(escapeILikeValue("c:\\x")).toBe("c:\\\\x");
  });
  it("coloca entre aspas e protege aspas e barras", () => {
    expect(quoteOrValue("a,b(c)")).toBe('"a,b(c)"');
    expect(quoteOrValue('diz "oi"')).toBe('"diz \\"oi\\""');
    expect(quoteOrValue("a\\b")).toBe('"a\\\\b"');
  });
});

describe("orSearch", () => {
  it("monta um termo por coluna, separados por vírgula", () => {
    expect(orSearch(["observacao", "alimentacao"], "sal")).toBe(
      'observacao.ilike."%sal%",alimentacao.ilike."%sal%"',
    );
  });
  it("vírgula, parênteses e curingas na busca ficam dentro das aspas", () => {
    const r = orSearch(["observacao"], "Silva, João (50%)")!;
    expect(r).toBe('observacao.ilike."%Silva, João (50\\\\%)%"');
    // com duas colunas, a vírgula do texto fica dentro das aspas e a separadora fora delas
    expect(orSearch(["a", "b"], "x,y")).toBe('a.ilike."%x,y%",b.ilike."%x,y%"');
  });
  it("sem termo ou sem colunas não filtra", () => {
    expect(orSearch(["a"], "   ")).toBeNull();
    expect(orSearch([], "x")).toBeNull();
    expect(orSearch(undefined, "x")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { BUSCA_MAX, escapeILikeValue, orInUuids, orSearch, quoteOrValue, termoDeBusca } from "../busca";

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

describe("orInUuids", () => {
  const A = "11111111-1111-4111-8111-111111111111";
  const B = "22222222-2222-4222-8222-222222222222";
  it("monta o filtro com os identificadores", () => {
    expect(orInUuids("animal_id", [A, B])).toBe(`animal_id.in.(${A},${B})`);
  });
  it("tira repetidos", () => {
    expect(orInUuids("animal_id", [A, A])).toBe(`animal_id.in.(${A})`);
  });
  it("recusa o que não é identificador (nada de injeção)", () => {
    expect(orInUuids("animal_id", ["não-é-uuid", "1);drop table animais;--"])).toBeNull();
    expect(orInUuids("animal_id", [])).toBeNull();
  });
  it("respeita o limite de quantos entram", () => {
    const muitos = Array.from({ length: 150 }, (_, i) => `1111111${i % 10}-1111-4111-8111-111111111111`);
    expect(orInUuids("animal_id", muitos, 5)!.split(",").length).toBe(5);
  });
});

describe("orSearch com extras", () => {
  it("junta as colunas e as condições prontas no mesmo ou", () => {
    expect(orSearch(["observacao"], "cio", ["animal_id.in.(a)"])).toBe('observacao.ilike."%cio%",animal_id.in.(a)');
  });
  it("funciona só com as condições prontas", () => {
    expect(orSearch([], "cio", ["animal_id.in.(a)"])).toBe("animal_id.in.(a)");
  });
  it("sem termo digitado, não filtra nada", () => {
    expect(orSearch(["observacao"], "   ", ["animal_id.in.(a)"])).toBeNull();
  });
});

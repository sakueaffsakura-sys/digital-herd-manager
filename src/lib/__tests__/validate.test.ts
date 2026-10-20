import { describe, expect, it } from "vitest";
import {
  escapeILike,
  naturalKeyFor,
  normalizeAndValidate,
  parseFlexibleDate,
  parseNumber,
  type ImportField,
} from "../validate";

const fields: ImportField[] = [
  { key: "numero_brinco", label: "Número do brinco", required: true },
  { key: "nome", label: "Nome" },
  { key: "data_nascimento", label: "Data de nascimento", type: "date" },
  { key: "peso_kg", label: "Peso (kg)", type: "number" },
];

describe("normalizeAndValidate", () => {
  it("aceita linha válida e formata data/número", () => {
    const { value, errors } = normalizeAndValidate(fields, {
      numero_brinco: " 1001 ",
      data_nascimento: "15/03/2023",
      peso_kg: "1.234,56",
    }, 1);
    expect(errors).toEqual([]);
    expect(value).toMatchObject({
      numero_brinco: "1001",
      data_nascimento: "2023-03-15",
      peso_kg: 1234.56,
      nome: null,
    });
  });

  it("rejeita obrigatório ausente e número inválido", () => {
    const { errors } = normalizeAndValidate(fields, { peso_kg: "abc" }, 2);
    expect(errors.join(";")).toContain("obrigatório");
    expect(errors.join(";")).toContain("número");
  });

  it("rejeita data inválida", () => {
    const { errors } = normalizeAndValidate(fields, {
      numero_brinco: "1",
      data_nascimento: "32/13/2023",
    }, 3);
    expect(errors.join(";")).toContain("data");
  });

  it("valida valores de select", () => {
    const { errors } = normalizeAndValidate(
      [{ key: "situacao", label: "Situação", type: "select", required: true, options: [{ value: "ativo", label: "Ativo" }] }],
      { situacao: "vendido" },
      4,
    );
    expect(errors.join(";")).toContain("Situação");
  });
});

describe("naturalKeyFor", () => {
  it("gera chave estável por brinco para animais", () => {
    const key = naturalKeyFor("animais");
    expect(key({ numero_brinco: " BRINCO-7 " })).toEqual(key({ numero_brinco: "brinco-7" }));
  });

  it("combina animal e data nas pesagens", () => {
    const key = naturalKeyFor("pesagens");
    expect(key({ animal_id: "a1", data: "2024-01-02" })).toBe(
      key({ animal_id: "a1", data: "2024-01-02" }),
    );
    expect(key({ animal_id: "a1", data: "2024-01-02" })).not.toBe(
      key({ animal_id: "a1", data: "2024-01-03" }),
    );
  });
});

describe("escapeILike", () => {
  it("escapa curingas do ILIKE", () => {
    expect(escapeILike("50%")).toBe("50\\%");
    expect(escapeILike("a_b")).toBe("a\\_b");
    expect(escapeILike("12\\5")).toBe("12\\\\5");
  });
});
describe("parseFlexibleDate", () => {
  it("aceita formatos brasileiros e ISO, só datas que existem", () => {
    expect(parseFlexibleDate("2026-03-15")).toBe("2026-03-15");
    expect(parseFlexibleDate("15/03/2026")).toBe("2026-03-15");
    expect(parseFlexibleDate("5/3/2026")).toBe("2026-03-05");
    expect(parseFlexibleDate("15.03.2026")).toBe("2026-03-15");
    expect(parseFlexibleDate("2026/03/15")).toBe("2026-03-15");
    expect(parseFlexibleDate("31/02/2026")).toBeNull();
    expect(parseFlexibleDate("2026-02-30")).toBeNull();
    expect(parseFlexibleDate("32/13/2023")).toBeNull();
    expect(parseFlexibleDate("")).toBeNull();
    expect(parseFlexibleDate("ontem")).toBeNull();
  });
});

describe("parseNumber", () => {
  it("entende 1.234,56, 1234.56 e R$", () => {
    expect(parseNumber("1.234,56")).toBe(1234.56);
    expect(parseNumber("1234.56")).toBe(1234.56);
    expect(parseNumber("R$ 1.500,00")).toBe(1500);
    expect(parseNumber("-3,5")).toBe(-3.5);
    expect(parseNumber("12")).toBe(12);
  });
  it("rejeita o que não é número de verdade", () => {
    expect(parseNumber("abc")).toBeNull();
    expect(parseNumber("1e3")).toBeNull();
    expect(parseNumber("0x10")).toBeNull();
    expect(parseNumber("1,2,3")).toBeNull();
    expect(parseNumber("")).toBeNull();
  });
});

describe("normalizeAndValidate: tipos extras", () => {
  it("select aceita valor, rótulo e maiúsculas", () => {
    const f: ImportField[] = [{ key: "situacao", label: "Situação", type: "select", options: [{ value: "em_andamento", label: "Em andamento" }, { value: "confirmada", label: "Confirmada" }] }];
    expect(normalizeAndValidate(f, { situacao: "em_andamento" }, 1).value.situacao).toBe("em_andamento");
    expect(normalizeAndValidate(f, { situacao: "Em andamento" }, 1).value.situacao).toBe("em_andamento");
    expect(normalizeAndValidate(f, { situacao: "CONFIRMADA" }, 1).value.situacao).toBe("confirmada");
    expect(normalizeAndValidate(f, { situacao: "outra" }, 1).errors).toHaveLength(1);
  });
  it("boolean reconhece sim/não e recusa o resto", () => {
    const f: ImportField[] = [{ key: "ativo", label: "Ativo", type: "boolean" }];
    expect(normalizeAndValidate(f, { ativo: "Sim" }, 1).value.ativo).toBe(true);
    expect(normalizeAndValidate(f, { ativo: "não" }, 1).value.ativo).toBe(false);
    expect(normalizeAndValidate(f, { ativo: "talvez" }, 1).errors).toHaveLength(1);
  });
  it("valor só com espaços conta como ausente", () => {
    const f: ImportField[] = [{ key: "nome", label: "Nome", required: true }];
    expect(normalizeAndValidate(f, { nome: "   " }, 1).errors).toHaveLength(1);
  });
  it("data impossível é recusada", () => {
    const f: ImportField[] = [{ key: "data", label: "Data", type: "date", required: true }];
    expect(normalizeAndValidate(f, { data: "31/04/2026" }, 5).errors).toHaveLength(1);
  });
});

describe("naturalKeyFor: anotações", () => {
  it("duas anotações no mesmo dia para o mesmo animal não são duplicatas se o texto difere", () => {
    const key = naturalKeyFor("anotacoes_producao");
    const base = { data: "2026-03-01", animal_id: "a1" };
    expect(key({ ...base, observacao: "manhã: calma" })).not.toBe(key({ ...base, observacao: "tarde: agitada" }));
    expect(key({ ...base, observacao: " Manhã: Calma " })).toBe(key({ ...base, observacao: "manhã: calma" }));
  });
});

import { describe, expect, it } from "vitest";
import {
  escapeILike,
  naturalKeyFor,
  normalizeAndValidate,
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
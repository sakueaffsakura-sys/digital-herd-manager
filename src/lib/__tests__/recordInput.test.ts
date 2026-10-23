import { describe, expect, it } from "vitest";
import { resolveRecordInputs } from "../recordInput";
import type { Field, FormRefs } from "@/components/app/shared";

const refs: FormRefs = {
  animals: [
    { id: "female", nome: "Mimosa", numero_brinco: "001", sexo: "F", situacao: "ativo", data_nascimento: null },
    { id: "male", nome: "Touro", numero_brinco: "002", sexo: "M", situacao: "ativo", data_nascimento: null },
    { id: "sold", nome: "Vendida", numero_brinco: "003", sexo: "F", situacao: "vendido", data_nascimento: null },
  ],
  lots: [{ id: "lot", nome: "Pasto Norte" }],
  vaccines: [{ id: "vaccine", nome: "Raiva" }],
};
const animal: Field = { key: "animal_id", label: "Animal", type: "animal", sex: "F", activeOnly: true };

describe("escrita em todos os cadastros", () => {
  it("resolve vacina escrita para o vínculo real", () => {
    expect(resolveRecordInputs([{ key: "tipo_vacina_id", label: "Vacina", type: "vacina" }], {}, { tipo_vacina_id: " raiva " }, refs, null).values.tipo_vacina_id).toBe("vaccine");
  });
  it("resolve lote e animal antes das validações", () => {
    const result = resolveRecordInputs([animal, { key: "lote_id", label: "Lote", type: "lote" }], {}, { animal_id: "001", lote_id: "Pasto Norte" }, refs, null);
    expect(result).toEqual({ values: { animal_id: "female", lote_id: "lot" } });
  });
  it("mantém restrição de fêmeas", () => {
    expect(resolveRecordInputs([animal], {}, { animal_id: "002" }, refs, null).error).toBeTruthy();
  });
  it("mantém restrição de animais ativos", () => {
    expect(resolveRecordInputs([animal], {}, { animal_id: "003" }, refs, null).error).toBeTruthy();
  });
  it("permite manter vínculo histórico ao editar", () => {
    expect(resolveRecordInputs([animal], { animal_id: "sold" }, { animal_id: "003" }, refs, { animal_id: "sold" })).toEqual({ values: { animal_id: "sold" } });
  });
  it("normaliza sexo escrito sem acento para o código existente", () => {
    expect(resolveRecordInputs([{ key: "sexo", label: "Sexo", type: "select", options: [{ value: "F", label: "Fêmea" }, { value: "M", label: "Macho" }] }], { sexo: " femea " }, {}, refs, null).values.sexo).toBe("F");
  });
  it("normaliza situação escrita com espaços", () => {
    expect(resolveRecordInputs([{ key: "situacao", label: "Situação", type: "select", options: [{ value: "em_andamento", label: "em andamento" }] }], { situacao: "EM ANDAMENTO" }, {}, refs, null).values.situacao).toBe("em_andamento");
  });
  it("recusa tipo financeiro fora das opções válidas", () => {
    expect(resolveRecordInputs([{ key: "tipo", label: "Tipo", type: "select", options: ["receita", "despesa", "investimento"].map(value => ({ value, label: value })) }], { tipo: "outro" }, {}, refs, null).error).toBeTruthy();
  });
  it("limpa vínculo opcional digitado em branco", () => {
    expect(resolveRecordInputs([animal], { animal_id: "female" }, { animal_id: " " }, refs, null).values.animal_id).toBeNull();
  });
  it("não aceita referência escrita quando os cadastros não carregaram", () => {
    expect(resolveRecordInputs([animal], {}, { animal_id: "001" }, undefined, null).error).toBeTruthy();
  });
});
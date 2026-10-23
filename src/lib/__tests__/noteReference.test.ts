import { describe, expect, it } from "vitest";
import { resolveNoteReference } from "../noteReference";

describe("vínculos escritos nas anotações", () => {
  const rows = [{ id: "a1", nome: "Mimosa", numero_brinco: "012" }, { id: "a2", nome: "Mimosa", numero_brinco: "013" }];
  it("vincula brinco escrito ao cadastro correto", () => {
    expect(resolveNoteReference(" 012 ", rows)).toEqual({ id: "a1" });
  });
  it("recusa nomes ambíguos em vez de escolher outro animal", () => {
    expect(resolveNoteReference("Mimosa", rows).error).toBeTruthy();
  });
  it("não grava texto sem cadastro como identificador", () => {
    expect(resolveNoteReference("Animal inexistente", rows)).toMatchObject({ id: null, error: expect.any(String) });
  });
  it("permite deixar vínculo opcional vazio", () => {
    expect(resolveNoteReference("", rows)).toEqual({ id: null });
  });
  it("resolve lote por nome sem diferenciar maiúsculas", () => {
    expect(resolveNoteReference(" pasto norte ", [{ id: "l1", nome: "Pasto Norte" }])).toEqual({ id: "l1" });
  });
});
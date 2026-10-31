import { describe, expect, it } from "vitest";
import { avaliarSenha, motivoSenhaFraca } from "../senha";

describe("regras de senha", () => {
  it("aceita senha com 10+ caracteres, letra e número, fora da lista comum", () => {
    expect(avaliarSenha("Curral-azul-2731", "maria@exemplo.com").ok).toBe(true);
    expect(motivoSenhaFraca("Pasto verde 77 sol", "joao@exemplo.com")).toBeNull();
  });

  it("recusa curta, sem número ou sem letra", () => {
    expect(motivoSenhaFraca("abc12", null)).toMatch(/pelo menos 10/);
    expect(motivoSenhaFraca("somenteletrasaqui", null)).toMatch(/número/);
    expect(motivoSenhaFraca("12345678901234", null)).toMatch(/letra/);
  });

  it("recusa senhas comuns, inclusive com números no fim e sem acento", () => {
    expect(motivoSenhaFraca("flamengo2024", null)).toMatch(/comum/);
    expect(motivoSenhaFraca("Senha123456", null)).toMatch(/comum/);
    expect(motivoSenhaFraca("Pecuária2026", null)).toMatch(/comum/);
    expect(motivoSenhaFraca("aaaaaaaaaaaa1", null)).not.toBeNull();
  });

  it("recusa senha com o e-mail da pessoa", () => {
    expect(motivoSenhaFraca("joaosilva2024!", "joaosilva@exemplo.com")).toMatch(/e-mail/);
  });

  it("respeita o limite de 72 caracteres do Auth", () => {
    expect(motivoSenhaFraca(`a1${"x".repeat(80)}`, null)).toMatch(/no máximo/);
  });

  it("marca regra por regra para a lista ao digitar", () => {
    const { regras } = avaliarSenha("abc", null);
    expect(regras.find((r) => r.id === "letra")?.ok).toBe(true);
    expect(regras.find((r) => r.id === "numero")?.ok).toBe(false);
    expect(regras.find((r) => r.id === "tamanho")?.ok).toBe(false);
  });
});

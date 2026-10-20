import { describe, expect, it } from "vitest";
import {
  emailValido,
  normalizarUrl,
  sanitizarLinha,
  sanitizarTexto,
  telefoneValido,
  urlValida,
} from "../texto";

describe("sanitizarLinha", () => {
  it("colapsa espaços e remove tags/HTML", () => {
    expect(sanitizarLinha("  João <b>Silva</b>  ", 150)).toBe("João Silva");
  });

  it("remove caracteres de controle", () => {
    // o caractere NUL é descartado (não vira espaço); a quebra de linha vira espaço
    expect(sanitizarLinha("a\u0000b\nc", 10)).toBe("ab c");
  });

  it("trunca no limite", () => {
    expect(sanitizarLinha("abcdef", 3)).toBe("abc");
  });
});

describe("sanitizarTexto", () => {
  it("preserva quebras e colapsa linhas em branco repetidas", () => {
    expect(sanitizarTexto("linha1\n\n\n\nlinha2", 100)).toBe("linha1\n\nlinha2");
  });

  it("trunca no limite", () => {
    expect(sanitizarTexto("abcdefghij", 5)).toBe("abcde");
  });
});

describe("telefoneValido", () => {
  it("aceita vazio (opcional)", () => {
    expect(telefoneValido("")).toBe(true);
  });

  it("aceita DDD + 8 ou 9 dígitos", () => {
    expect(telefoneValido("(11) 98765-4321")).toBe(true);
    expect(telefoneValido("11987654321")).toBe(true);
    expect(telefoneValido("(11) 8765-4321")).toBe(true);
  });

  it("rejeita número curto demais", () => {
    expect(telefoneValido("123")).toBe(false);
  });
});

describe("emailValido", () => {
  it("aceita vazio (opcional)", () => {
    expect(emailValido("")).toBe(true);
  });

  it("aceita e-mail válido", () => {
    expect(emailValido("a@b.com")).toBe(true);
  });

  it("rejeita sem domínio", () => {
    expect(emailValido("a@b")).toBe(false);
  });
});

describe("normalizarUrl / urlValida", () => {
  it("adiciona https:// quando o esquema está ausente", () => {
    expect(normalizarUrl("fazenda.com.br")).toBe("https://fazenda.com.br");
  });

  it("aceita vazio (opcional)", () => {
    expect(urlValida("")).toBe(true);
  });

  it("aceita http/https", () => {
    expect(urlValida("http://x.com")).toBe(true);
    expect(urlValida("https://x.com")).toBe(true);
  });

  it("rejeita protocolo não permitido", () => {
    expect(urlValida("ftp://x.com")).toBe(false);
  });

  it("rejeita URL inválida", () => {
    expect(urlValida("não é uma url")).toBe(false);
  });
});
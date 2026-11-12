import { describe, expect, it } from "vitest";
import { codigoAgora, codigoDoContador, conferirCodigo, deBase32, enderecoDoQr, novoSegredo, paraBase32 } from "../conta/totp";

// Segredo de exemplo publicado na norma: o texto "12345678901234567890".
const SEGREDO = paraBase32(Buffer.from("12345678901234567890", "ascii"));

describe("código de 6 dígitos (2 fatores)", () => {
  it("escreve o segredo em base32 como a norma manda", () => {
    expect(SEGREDO).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
  });

  it("escrever e ler o segredo devolve os mesmos bytes", () => {
    const bytes = Buffer.from([0, 1, 2, 127, 128, 250, 255]);
    expect(Buffer.compare(deBase32(paraBase32(bytes)), bytes)).toBe(0);
    expect(deBase32(novoSegredo()).length).toBe(20);
  });

  // Os seis valores que a própria RFC 6238 publica. Se algum mudar, o aplicativo
  // de códigos do celular deixa de bater com o site.
  it.each([
    [59, "94287082"],
    [1111111109, "07081804"],
    [1111111111, "14050471"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
    [20000000000, "65353130"],
  ])("confere com o exemplo oficial em T=%i", (segundos, esperado) => {
    expect(codigoDoContador(SEGREDO, Math.floor(segundos / 30), 8)).toBe(esperado);
  });

  it("aceita o relógio do celular um pouco adiantado ou atrasado", () => {
    const agora = 1_700_000_000_000;
    expect(conferirCodigo(SEGREDO, codigoAgora(SEGREDO, agora), agora)).toBe(true);
    expect(conferirCodigo(SEGREDO, codigoAgora(SEGREDO, agora - 30_000), agora)).toBe(true);
    expect(conferirCodigo(SEGREDO, codigoAgora(SEGREDO, agora + 30_000), agora)).toBe(true);
  });

  it("recusa código vencido, curto, vazio ou com letra", () => {
    const agora = 1_700_000_000_000;
    expect(conferirCodigo(SEGREDO, codigoAgora(SEGREDO, agora - 300_000), agora)).toBe(false);
    expect(conferirCodigo(SEGREDO, "12345", agora)).toBe(false);
    expect(conferirCodigo(SEGREDO, "", agora)).toBe(false);
    expect(conferirCodigo(SEGREDO, "abcdef", agora)).toBe(false);
  });

  it("monta o endereço que o aplicativo de códigos lê no QR", () => {
    const url = enderecoDoQr(SEGREDO, "dona.nair@exemplo.com");
    expect(url).toContain("otpauth://totp/Pecu%C3%A1ria%20Digital%3Adona.nair%40exemplo.com");
    expect(url).toContain(`secret=${SEGREDO}`);
    expect(url).toContain("period=30");
  });
});

import { describe, expect, it } from "vitest";
import { crc32, criarZip, paraCsv } from "../zip";

const enc = new TextEncoder();

describe("zip mínimo", () => {
  it("crc32 bate com o valor conhecido", () => {
    expect(crc32(enc.encode("abc")).toString(16)).toBe("352441c2");
    expect(crc32(new Uint8Array())).toBe(0);
  });

  it("gera assinatura local, diretório central e fim de arquivo", () => {
    const z = criarZip([{ nome: "a.csv", dados: enc.encode("x;y") }, { nome: "pasta/b.csv", dados: enc.encode("") }]);
    const v = new DataView(z.buffer);
    expect(v.getUint32(0, true)).toBe(0x04034b50);
    expect(v.getUint32(z.length - 22, true)).toBe(0x06054b50);
    expect(v.getUint16(z.length - 22 + 10, true)).toBe(2);
  });
});

describe("CSV para Excel em português", () => {
  it("usa ponto e vírgula, BOM e escapa aspas", () => {
    const csv = paraCsv([{ nome: 'Mimosa "boa"', litros: 12.5 }]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('nome;litros');
    expect(csv).toContain('"Mimosa ""boa""";12.5');
  });

  it("neutraliza fórmulas em texto, mas não em números", () => {
    const csv = paraCsv([{ a: "=HYPERLINK(1)", b: -150, c: "@x" }]);
    expect(csv).toContain("'=HYPERLINK(1);-150;'@x");
  });

  it("aceita lista vazia", () => {
    expect(paraCsv([])).toBe("﻿");
  });
});

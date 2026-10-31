import { describe, expect, it } from "vitest";
import { gerarQr, qrParaSvg } from "../qr";

const XOR_FORMATO = 0b101010000010010;
// Posições da primeira cópia da informação de formato, do bit 0 ao 14 (linha, coluna).
const POSICOES_FORMATO: [number, number][] = [
  [0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [7, 8], [8, 8],
  [8, 7], [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
];

function lerFormato(m: boolean[][]) {
  let bits = 0;
  POSICOES_FORMATO.forEach(([l, c], i) => { bits |= (m[l][c] ? 1 : 0) << i; });
  const cru = bits ^ XOR_FORMATO;
  return { correcao: (cru >> 13) & 3, mascara: (cru >> 10) & 7, bits };
}

/** A segunda cópia (repartida entre os outros dois olhos) precisa dizer a mesma coisa. */
function lerFormatoRepetido(m: boolean[][]) {
  const n = m.length;
  let bits = 0;
  for (let i = 0; i <= 7; i++) bits |= (m[8][n - 1 - i] ? 1 : 0) << i;
  for (let i = 8; i <= 14; i++) bits |= (m[n - 15 + i][8] ? 1 : 0) << i;
  return bits;
}

const olhoCerto = (m: boolean[][], l0: number, c0: number) => {
  for (let l = 0; l <= 6; l++) {
    for (let c = 0; c <= 6; c++) {
      const esperado = l === 0 || l === 6 || c === 0 || c === 6 || (l >= 2 && l <= 4 && c >= 2 && c <= 4);
      if (m[l0 + l][c0 + c] !== esperado) return false;
    }
  }
  return true;
};

describe("gerarQr", () => {
  it("escolhe a menor versão que cabe o texto", () => {
    expect(gerarQr("a".repeat(14)).length).toBe(21); // versão 1
    expect(gerarQr("a".repeat(15)).length).toBe(25); // versão 2
    expect(gerarQr("a".repeat(26)).length).toBe(25);
    expect(gerarQr("a".repeat(27)).length).toBe(29); // versão 3
  });

  it("desenha os três olhos e o módulo sempre escuro", () => {
    const m = gerarQr("https://boooh.sbs/aplicativo");
    const n = m.length;
    expect(olhoCerto(m, 0, 0)).toBe(true);
    expect(olhoCerto(m, 0, n - 7)).toBe(true);
    expect(olhoCerto(m, n - 7, 0)).toBe(true);
    expect(m[n - 8][8]).toBe(true);
  });

  it("separa os olhos do resto com uma faixa clara", () => {
    const m = gerarQr("PECUARIA");
    const n = m.length;
    for (let i = 0; i <= 7; i++) {
      expect(m[7][i]).toBe(false);
      expect(m[i][7]).toBe(false);
      expect(m[7][n - 1 - i]).toBe(false);
      expect(m[n - 1 - i][7]).toBe(false);
    }
  });

  it("alterna a linha e a coluna de tempo", () => {
    const m = gerarQr("PECUARIA");
    for (let i = 8; i < m.length - 8; i++) {
      expect(m[6][i]).toBe(i % 2 === 0);
      expect(m[i][6]).toBe(i % 2 === 0);
    }
  });

  it("grava o formato (correção M) duas vezes e com a mesma máscara", () => {
    for (const texto of ["PECUARIA", "https://boooh.sbs/aplicativo", "x".repeat(150)]) {
      const m = gerarQr(texto);
      const f = lerFormato(m);
      expect(f.correcao).toBe(0); // 00 = correção M
      expect(f.mascara).toBeGreaterThanOrEqual(0);
      expect(f.mascara).toBeLessThanOrEqual(7);
      expect(lerFormatoRepetido(m)).toBe(f.bits);
    }
  });

  it("não deixa o código quase todo claro nem quase todo escuro", () => {
    const m = gerarQr("https://boooh.sbs/arquivos/apecuaria-digital-7.4.apk");
    const escuros = m.flat().filter(Boolean).length;
    const parte = escuros / (m.length * m.length);
    expect(parte).toBeGreaterThan(0.35);
    expect(parte).toBeLessThan(0.65);
  });

  it("aceita acento e emoji (UTF-8) e muda com o texto", () => {
    const a = gerarQr("Ação e pão");
    const b = gerarQr("Ação e pao");
    expect(a.length).toBe(b.length);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it("é sempre igual para o mesmo texto", () => {
    expect(JSON.stringify(gerarQr("https://boooh.sbs"))).toBe(JSON.stringify(gerarQr("https://boooh.sbs")));
  });

  it("recusa texto grande demais", () => {
    expect(() => gerarQr("a".repeat(214))).toThrow();
  });
});

describe("qrParaSvg", () => {
  it("devolve um SVG quadrado com borda", () => {
    const svg = qrParaSvg("https://boooh.sbs");
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain('viewBox="0 0 33 33"'); // 25 módulos + 4 de borda de cada lado
    expect(svg).toContain("</svg>");
  });
});

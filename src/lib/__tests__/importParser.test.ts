import { describe, expect, it } from "vitest";
import {
  chunk,
  detectAndParse,
  fnv1a,
  normalizeHeader,
  parseCSV,
  parseJSONArray,
  parseJSONL,
  splitInHalf,
  stripBom,
} from "../importParser";

describe("normalizeHeader", () => {
  it("normaliza cabeçalhos para chaves do banco", () => {
    expect(normalizeHeader("Número do brinco")).toBe("numero_do_brinco");
    expect(normalizeHeader("Número do brinco")).toBe("numero_do_brinco");
    expect(normalizeHeader("  ProDuto-Animal  ")).toBe("produto_animal");
    expect(normalizeHeader("Situação")).toBe("situacao");
    expect(normalizeHeader("data_aplicacao")).toBe("data_aplicacao");
  });
});

describe("parseCSV", () => {
  it("parseia CSV simples com CRLF", () => {
    const { headers, rows } = parseCSV("brinco,nome\r\n1001,Mariana\r\n1002,Touro X\r\n");
    expect(headers).toEqual(["brinco", "nome"]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ brinco: "1001", nome: "Mariana" });
  });

  it("trata aspas, vírgulas e quebras dentro do campo", () => {
    const { rows } = parseCSV('nome,obs\n"Mariana, a vaca","linha1\nlinha2""ok"""\n');
    expect(rows[0]).toEqual({ nome: "Mariana, a vaca", obs: 'linha1\nlinha2"ok"' });
  });

  it("aceita linhas com menos colunas que o cabeçalho", () => {
    const { rows } = parseCSV("a,b,c\n1,2\n1,2,3\n");
    expect(rows[0]).toEqual({ a: "1", b: "2", c: "" });
  });
});

describe("stripBom / JSON", () => {
  it("remove BOM e parseia array JSON", () => {
    const { headers, rows } = parseJSONArray("\uFEFF[{ \"brinco\": 1001, \"nome\": \"X\" }]");
    expect(headers.sort()).toEqual(["brinco", "nome"]);
    expect(rows[0].brinco).toBe("1001");
  });

  it("parseia JSONL", () => {
    const { rows } = parseJSONL('{"brinco":1}\n{"brinco":2}');
    expect(rows).toHaveLength(2);
  });

  it("detectAndParse decide o formato", () => {
    expect(detectAndParse("x.json", '[{"a":1}]').rows).toHaveLength(1);
    expect(detectAndParse("x.csv", "a\n1\n").rows).toHaveLength(1);
  });
});

describe("chunk / splitInHalf", () => {
  it("divide em lotes e ao meio", () => {
    const items = Array.from({ length: 105 }, (_, i) => i);
    expect(chunk(items, 50).map((c) => c.length)).toEqual([50, 50, 5]);
    const [a, b] = splitInHalf([1, 2, 3, 4, 5]);
    expect(a).toEqual([1, 2, 3]);
    expect(b).toEqual([4, 5]);
  });
});

describe("fnv1a", () => {
  it("é estável e determinística", () => {
    expect(fnv1a("arquivo.csv")).toBe(fnv1a("arquivo.csv"));
    expect(fnv1a("arquivo.csv")).toMatch(/^[0-9a-f]{8}$/);
  });
});
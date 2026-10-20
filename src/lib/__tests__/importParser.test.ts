import { describe, expect, it } from "vitest";
import {
  buildAliases,
  chunk,
  detectDelimiter,
  novoUuid,
  detectAndParse,
  fnv1a,
  normalizeHeader,
  parseCSV,
  parseJSONArray,
  parseJSONL,
  remapHeaders,
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
describe("detectDelimiter / detectAndParse", () => {
  it("reconhece CSV com ponto e vírgula (Excel em português)", () => {
    const texto = "Brinco;Nome;Peso\n1001;Mariana;450,5\n";
    expect(detectDelimiter(texto, "animais.csv")).toBe(";");
    const { headers, rows } = detectAndParse("animais.csv", texto);
    expect(headers).toEqual(["brinco", "nome", "peso"]);
    expect(rows[0]).toEqual({ brinco: "1001", nome: "Mariana", peso: "450,5" });
  });
  it("vírgula é o padrão e TSV usa tabulação", () => {
    expect(detectDelimiter("a,b,c\n1,2,3", "x.csv")).toBe(",");
    expect(detectDelimiter("a\tb\n1\t2", "x.tsv")).toBe("\t");
    expect(detectDelimiter("a\tb\n1\t2", "x.txt")).toBe("\t");
    expect(detectAndParse("x.tsv", "a\tb\n1\t2").rows[0]).toEqual({ a: "1", b: "2" });
  });
  it("separador dentro de aspas no cabeçalho não conta", () => {
    expect(detectDelimiter('"a;b;c",d\n1,2', "x.csv")).toBe(",");
  });
});

describe("parseCSV: linhas em branco no fim", () => {
  it("ignora linhas vazias depois dos dados", () => {
    const { rows } = parseCSV("a,b\n1,2\n\n\n,\n");
    expect(rows).toHaveLength(1);
  });
});

describe("buildAliases / remapHeaders", () => {
  const fields = [
    { key: "numero_brinco", label: "Número do brinco" },
    { key: "mae_id", label: "Mãe", type: "animal" },
    { key: "pai_id", label: "Pai", type: "animal" },
    { key: "data_nascimento", label: "Data de nascimento", type: "date" },
  ];
  it("aceita rótulo da tela e apelidos, sem confundir campos do mesmo tipo", () => {
    const al = buildAliases(fields);
    expect(al["numero_do_brinco"]).toBe("numero_brinco");
    expect(al["brinco"]).toBe("numero_brinco");
    expect(al["nascimento"]).toBe("data_nascimento");
    expect(al["mae"]).toBe("mae_id");
    // há dois campos "animal": o apelido genérico "animal" não pode apontar para nenhum
    expect(al["animal"]).toBeUndefined();
  });
  it("apelido por tipo vale quando só há um campo do tipo", () => {
    const al = buildAliases([{ key: "animal_id", label: "Animal", type: "animal" }, { key: "peso_kg", label: "Peso (kg)", type: "number" }]);
    expect(al["brinco"]).toBe("animal_id");
    expect(al["peso_kg"]).toBe("peso_kg");
  });
  it("remapeia cabeçalhos de CSV e de JSON", () => {
    const al = buildAliases(fields);
    const csv = remapHeaders(parseCSV("Número do Brinco;Nascimento\n7;01/02/2020".replace(/;/g, ",")), al);
    expect(csv.headers).toEqual(["numero_brinco", "data_nascimento"]);
    expect(csv.rows[0]).toEqual({ numero_brinco: "7", data_nascimento: "01/02/2020" });
    const json = remapHeaders(parseJSONArray('[{"Brinco":"9","coluna estranha":"x"}]'), al);
    expect(json.rows[0]).toEqual({ numero_brinco: "9", coluna_estranha: "x" });
  });
});

describe("novoUuid", () => {
  it("gera UUIDs v4 diferentes", () => {
    const a = novoUuid(), b = novoUuid();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a === b).toBe(false);
  });
});

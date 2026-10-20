import { describe, expect, it } from "vitest";
import { fetchAllRows, fetchAllRowsInfo } from "../fetchAll";

const fonte = (total: number) => async (from: number, to: number) => ({
  data: Array.from({ length: Math.max(0, Math.min(to + 1, total) - from) }, (_, i) => from + i),
  error: null as unknown,
});

describe("fetchAllRowsInfo", () => {
  it("junta as páginas e não marca truncado quando acaba antes do teto", async () => {
    const r = await fetchAllRowsInfo(fonte(2500));
    expect(r.rows).toHaveLength(2500);
    expect(r.truncated).toBe(false);
    expect(r.rows[2499]).toBe(2499);
  });
  it("lista vazia e página exata de 1000 (a próxima vem vazia)", async () => {
    expect((await fetchAllRowsInfo(fonte(0))).rows).toHaveLength(0);
    const r = await fetchAllRowsInfo(fonte(1000));
    expect(r.rows).toHaveLength(1000);
    expect(r.truncated).toBe(false);
  });
  it("avisa quando o teto corta a lista", async () => {
    const r = await fetchAllRowsInfo(fonte(50000), 3000);
    expect(r.rows).toHaveLength(3000);
    expect(r.truncated).toBe(true);
  });
  it("propaga erro do servidor", async () => {
    let falhou = false;
    try {
      await fetchAllRows(async () => ({ data: null, error: new Error("boom") }));
    } catch {
      falhou = true;
    }
    expect(falhou).toBe(true);
  });
});

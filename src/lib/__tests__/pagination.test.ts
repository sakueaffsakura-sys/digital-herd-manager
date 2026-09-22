import { describe, expect, it } from "vitest";
import { clampPage, maxPage, pageSummary, pageWindow, rangeOf } from "../pagination";

describe("maxPage", () => {
  it("calcula quantidade de páginas", () => {
    expect(maxPage({ total: 0, pageSize: 25 })).toBe(1);
    expect(maxPage({ total: 25, pageSize: 25 })).toBe(1);
    expect(maxPage({ total: 26, pageSize: 25 })).toBe(2);
    expect(maxPage({ total: 1_000_000, pageSize: 100 })).toBe(10_000);
  });
});

describe("clampPage", () => {
  it("limita a página dentro do intervalo válido", () => {
    expect(clampPage(0, 1000, 25)).toBe(1);
    expect(clampPage(1, 1000, 25)).toBe(1);
    expect(clampPage(40, 1000, 25)).toBe(40);
    expect(clampPage(999, 1000, 25)).toBe(40);
  });
});

describe("rangeOf", () => {
  it("gera o intervalo inclusivo para PostgREST", () => {
    expect(rangeOf(1, 25)).toEqual({ from: 0, to: 24 });
    expect(rangeOf(2, 50)).toEqual({ from: 50, to: 99 });
  });
});

describe("pageWindow", () => {
  it("gera janela de páginas ao redor da atual", () => {
    expect(pageWindow(1, 1000, 25, 2)).toEqual([1, 2, 3]);
    expect(pageWindow(20, 1000, 25, 2)).toEqual([18, 19, 20, 21, 22]);
    expect(pageWindow(40, 1000, 25, 2)).toEqual([38, 39, 40]);
  });
});

describe("pageSummary", () => {
  it("resume faixa exibida", () => {
    expect(pageSummary({ page: 1, pageSize: 25, total: 0 })).toEqual({ de: 0, ate: 0, total: 0 });
    expect(pageSummary({ page: 1, pageSize: 25, total: 1_234 })).toEqual({ de: 1, ate: 25, total: 1_234 });
    expect(pageSummary({ page: 50, pageSize: 25, total: 1_234 })).toEqual({ de: 1226, ate: 1234, total: 1_234 });
  });
});
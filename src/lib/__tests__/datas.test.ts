import { describe, expect, it } from "vitest";
import {
  dataLocalISO,
  formatarDataBR,
  dataNoFuso,
  dataValida,
  diasNoMes,
  isoValido,
  mesLocalISO,
  primeiroDiaDoMes,
  somarDias,
} from "../datas";

describe("dataLocalISO", () => {
  it("usa o dia do relógio local, não o de UTC", () => {
    // 23:30 local do dia 15 — em UTC-3 já seria dia 16 às 02:30 UTC
    expect(dataLocalISO(new Date(2026, 2, 15, 23, 30))).toBe("2026-03-15");
    expect(dataLocalISO(new Date(2026, 0, 1, 0, 5))).toBe("2026-01-01");
  });
  it("mesLocalISO devolve AAAA-MM", () => {
    expect(mesLocalISO(new Date(2026, 11, 31, 23, 59))).toBe("2026-12");
  });
});

describe("dataNoFuso", () => {
  it("converte o instante para a data do fuso pedido", () => {
    const instante = new Date("2026-03-16T01:30:00Z"); // 22:30 do dia 15 em Brasília
    expect(dataNoFuso(instante, "America/Sao_Paulo")).toBe("2026-03-15");
    expect(dataNoFuso(instante, "UTC")).toBe("2026-03-16");
  });
  it("fuso inválido cai para a data local sem lançar erro", () => {
    expect(dataNoFuso(new Date(2026, 5, 2, 12), "Nao/Existe")).toBe("2026-06-02");
  });
});

describe("dataValida / isoValido", () => {
  it("rejeita datas que não existem", () => {
    expect(dataValida(2026, 2, 29)).toBe(false);
    expect(dataValida(2024, 2, 29)).toBe(true);
    expect(dataValida(2026, 13, 1)).toBe(false);
    expect(dataValida(2026, 4, 31)).toBe(false);
    expect(dataValida(1800, 1, 1)).toBe(false);
    expect(isoValido("2026-02-30")).toBe(false);
    expect(isoValido("2026-12-31")).toBe(true);
    expect(isoValido("26-12-31")).toBe(false);
  });
  it("diasNoMes", () => {
    expect(diasNoMes(2026, 2)).toBe(28);
    expect(diasNoMes(2028, 2)).toBe(29);
    expect(diasNoMes(2026, 12)).toBe(31);
  });
});

describe("somarDias / primeiroDiaDoMes", () => {
  it("atravessa mês e ano", () => {
    expect(somarDias("2026-12-31", 1)).toBe("2027-01-01");
    expect(somarDias("2026-03-01", -1)).toBe("2026-02-28");
    expect(somarDias("2026-01-31", 30)).toBe("2026-03-02");
  });
  it("calcula o primeiro dia de meses vizinhos", () => {
    const base = new Date(2026, 0, 20);
    expect(primeiroDiaDoMes(0, base)).toBe("2026-01-01");
    expect(primeiroDiaDoMes(-11, base)).toBe("2025-02-01");
    expect(primeiroDiaDoMes(2, base)).toBe("2026-03-01");
  });
});

describe("formatarDataBR", () => {
  it("formata sem mexer no dia", () => {
    expect(formatarDataBR("2026-03-15")).toBe("15/03/2026");
    expect(formatarDataBR("2026-03-15T23:59:59-03:00")).toBe("15/03/2026");
    expect(formatarDataBR(null)).toBe("—");
    expect(formatarDataBR("lixo")).toBe("—");
  });
});

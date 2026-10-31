import { describe, expect, it } from "vitest";
import {
  arrobasParaPesoVivo, calagem, dosePorPeso, lerNumero, lotacao, pesoVivoParaArrobas,
  previsaoParto, quadradoPearson, racaoPorDia, valorDaVenda,
} from "../calculos";

describe("lerNumero", () => {
  it("entende número escrito em português", () => {
    expect(lerNumero("12,5")).toBe(12.5);
    expect(lerNumero("1.234,5")).toBe(1234.5);
    expect(lerNumero(" 480 ")).toBe(480);
  });
  it("devolve null para vazio ou texto", () => {
    expect(lerNumero("")).toBeNull();
    expect(lerNumero("   ")).toBeNull();
    expect(lerNumero("abc")).toBeNull();
  });
});

describe("dosePorPeso", () => {
  it("1 mL para cada 50 kg em um boi de 320 kg dá 6,4 mL", () => {
    expect(dosePorPeso(320, 50)).toBeCloseTo(6.4, 10);
  });
  it("recusa peso ou proporção inválidos", () => {
    expect(dosePorPeso(0, 50)).toBeNull();
    expect(dosePorPeso(320, 0)).toBeNull();
    expect(dosePorPeso(null, 50)).toBeNull();
  });
});

describe("quadradoPearson", () => {
  it("milho 9% e soja 45% para chegar a 18% dá 25% de soja", () => {
    const r = quadradoPearson(45, 9, 18)!;
    expect(r.parteAlto).toBeCloseTo(0.25, 10);
    expect(r.parteBaixo).toBeCloseTo(0.75, 10);
  });
  it("as partes sempre somam 1", () => {
    const r = quadradoPearson(44, 8, 20)!;
    expect(r.parteAlto + r.parteBaixo).toBeCloseTo(1, 10);
  });
  it("recusa alvo fora do intervalo ou ingredientes trocados", () => {
    expect(quadradoPearson(45, 9, 50)).toBeNull();
    expect(quadradoPearson(45, 9, 5)).toBeNull();
    expect(quadradoPearson(9, 45, 18)).toBeNull();
  });
});

describe("calagem", () => {
  it("CTC 8, V de 40% para 70% e PRNT 85% dá 2,82 t/ha", () => {
    expect(calagem(8, 40, 70, 85)).toBeCloseTo(2.8235, 3);
  });
  it("não precisa calcário quando o V já está bom", () => {
    expect(calagem(8, 75, 70, 85)).toBe(0);
  });
  it("recusa PRNT ou CTC zerados", () => {
    expect(calagem(0, 40, 70, 85)).toBeNull();
    expect(calagem(8, 40, 70, 0)).toBeNull();
  });
});

describe("lotacao", () => {
  it("50 animais de 450 kg em 25 ha dá 2 UA/ha", () => {
    const r = lotacao(50, 450, 25)!;
    expect(r.ua).toBeCloseTo(50, 10);
    expect(r.uaPorHa).toBeCloseTo(2, 10);
    expect(r.kgPorHa).toBeCloseTo(900, 10);
  });
  it("recusa área zero", () => {
    expect(lotacao(50, 450, 0)).toBeNull();
  });
});

describe("arrobas", () => {
  it("480 kg com 52% de rendimento dá 16,64 arrobas", () => {
    const r = pesoVivoParaArrobas(480, 52)!;
    expect(r.carcacaKg).toBeCloseTo(249.6, 10);
    expect(r.arrobas).toBeCloseTo(16.64, 10);
  });
  it("a volta bate com a ida", () => {
    const r = pesoVivoParaArrobas(480, 52)!;
    expect(arrobasParaPesoVivo(r.arrobas, 52)).toBeCloseTo(480, 8);
  });
  it("recusa rendimento acima de 100%", () => {
    expect(pesoVivoParaArrobas(480, 120)).toBeNull();
    expect(arrobasParaPesoVivo(16, 0)).toBeNull();
  });
  it("calcula o valor da venda", () => {
    expect(valorDaVenda(16.64, 320)).toBeCloseTo(5324.8, 8);
    expect(valorDaVenda(null, 320)).toBeNull();
  });
});

describe("previsaoParto", () => {
  it("soma os dias de gestação sem erro de fuso", () => {
    expect(previsaoParto("2026-01-10", 283)).toBe("2026-10-20");
    expect(previsaoParto("2026-03-01", 283)).toBe("2026-12-09");
  });
  it("atravessa o fim do ano", () => {
    expect(previsaoParto("2026-06-15", 283)).toBe("2027-03-25");
  });
  it("recusa data inválida ou gestação fora da faixa", () => {
    expect(previsaoParto("10/01/2026")).toBeNull();
    expect(previsaoParto("2026-01-10", 10)).toBeNull();
  });
});

describe("racaoPorDia", () => {
  it("450 kg a 2,5% dá 11,25 kg por animal", () => {
    const r = racaoPorDia(450, 2.5, 20)!;
    expect(r.porAnimal).toBeCloseTo(11.25, 10);
    expect(r.total).toBeCloseTo(225, 10);
  });
  it("recusa percentual zerado", () => {
    expect(racaoPorDia(450, 0)).toBeNull();
  });
});

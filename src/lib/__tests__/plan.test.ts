import { describe, expect, it } from "vitest";
import {
  avaliarPlano,
  premiumAtivo,
  situacaoPlano,
  statusTitulo,
} from "../plan";

describe("premiumAtivo", () => {
  it("falso sem plano premium", () => {
    expect(premiumAtivo({ plano: "gratuito" })).toBe(false);
  });

  it("falso com status não ativo", () => {
    expect(premiumAtivo({ plano: "premium", status: "cancelado" })).toBe(false);
  });

  it("falso com data de expiração no passado", () => {
    const agora = new Date("2026-09-22T12:00:00Z");
    expect(
      premiumAtivo(
        { plano: "premium", status: "ativo", data_expiracao: "2026-09-01T00:00:00Z" },
        agora,
      ),
    ).toBe(false);
  });

  it("verdadeiro com ativo/trial vigente", () => {
    const agora = new Date("2026-09-22T12:00:00Z");
    expect(
      premiumAtivo(
        { plano: "premium", status: "ativo", data_expiracao: "2026-12-01T00:00:00Z" },
        agora,
      ),
    ).toBe(true);
    expect(premiumAtivo({ plano: "premium", status: "trial", data_expiracao: null }, agora)).toBe(
      true,
    );
  });
});

describe("avaliarPlano", () => {
  it("marca demonstração pela origem", () => {
    expect(avaliarPlano({ plano: "premium", status: "ativo", origem: "demonstracao" }).demonstracao).toBe(true);
  });
});

describe("situacaoPlano", () => {
  const agora = new Date("2026-09-22T12:00:00Z");

  it("exibe Gratuito sem plano/premium", () => {
    expect(situacaoPlano({}, agora).label).toBe("Gratuito");
    expect(situacaoPlano({ plano: "gratuito" }, agora).label).toBe("Gratuito");
  });

  it("exibe Premium ativo", () => {
    expect(situacaoPlano({ plano: "premium", status: "ativo" }, agora).label).toBe("Premium ativo");
    expect(situacaoPlano({ plano: "premium", status: "trial" }, agora).label).toBe("Premium ativo");
  });

  it("exibe Premium de demonstração", () => {
    expect(
      situacaoPlano({ plano: "premium", status: "ativo", origem: "demonstracao" }, agora).label,
    ).toBe("Premium de demonstração");
  });

  it("exibe Premium expirado", () => {
    expect(
      situacaoPlano(
        { plano: "premium", status: "ativo", data_expiracao: "2026-09-01T00:00:00Z" },
        agora,
      ).label,
    ).toBe("Premium expirado");
    expect(situacaoPlano({ plano: "premium", status: "expirado" }, agora).label).toBe(
      "Premium expirado",
    );
  });

  it("exibe Premium cancelado", () => {
    expect(situacaoPlano({ plano: "premium", status: "cancelado" }, agora).label).toBe(
      "Premium cancelado",
    );
  });
});

describe("statusTitulo", () => {
  it("traduz status sem assinatura", () => {
    expect(statusTitulo(null)).toBe("Sem assinatura");
    expect(statusTitulo("ativo")).toBe("Ativo");
  });
});
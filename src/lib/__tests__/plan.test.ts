import { describe, expect, it } from "vitest";
import {
  avaliarPlano,
  formatarDataHora,
  planoTitulo,
  premiumAtivo,
  statusTitulo,
} from "../plan";

const AGORA = new Date("2026-09-21T12:00:00Z");

describe("premiumAtivo", () => {
  it("premium ativo sem expiração", () => {
    expect(premiumAtivo({ plano: "premium", status: "ativo" }, AGORA)).toBe(true);
    expect(premiumAtivo({ plano: "premium", status: "trial" }, AGORA)).toBe(true);
  });

  it("não é premium em outras combinações", () => {
    expect(premiumAtivo({ plano: "premium", status: "cancelado" }, AGORA)).toBe(false);
    expect(premiumAtivo({ plano: "premium", status: "expirado" }, AGORA)).toBe(false);
    expect(premiumAtivo({ plano: "premium", status: "pendente" }, AGORA)).toBe(false);
    expect(premiumAtivo({ plano: "gratuito", status: "ativo" }, AGORA)).toBe(false);
    expect(premiumAtivo({ plano: null, status: null }, AGORA)).toBe(false);
  });

  it("expira na data", () => {
    const futura = "2026-09-22T00:00:00Z";
    const passada = "2026-09-20T00:00:00Z";
    expect(premiumAtivo({ plano: "premium", status: "ativo", data_expiracao: futura }, AGORA)).toBe(true);
    expect(premiumAtivo({ plano: "premium", status: "ativo", data_expiracao: passada }, AGORA)).toBe(false);
  });
});

describe("avaliarPlano", () => {
  it("resume demo premium", () => {
    const r = avaliarPlano(
      { plano: "premium", status: "trial", origem: "demonstracao" },
      AGORA,
    );
    expect(r.premium_ativo).toBe(true);
    expect(r.demonstracao).toBe(true);
    expect(r.label).toBe("Premium");
    expect(r.status_label).toBe("trial");
  });

  it("resume gratuito", () => {
    const r = avaliarPlano({ plano: "gratuito" }, AGORA);
    expect(r.premium_ativo).toBe(false);
    expect(r.label).toBe("Gratuito");
  });
});

describe("rótulos", () => {
  it("planoTitulo", () => {
    expect(planoTitulo({ plano: "premium" })).toBe("Premium");
    expect(planoTitulo({ plano: "gratuito" })).toBe("Gratuito");
  });

  it("statusTitulo", () => {
    expect(statusTitulo("ativo")).toBe("Ativo");
    expect(statusTitulo("trial")).toBe("Período de teste");
    expect(statusTitulo("cancelado")).toBe("Cancelado");
    expect(statusTitulo("expirado")).toBe("Expirado");
    expect(statusTitulo("pendente")).toBe("Pendente");
    expect(statusTitulo(null)).toBe("Sem assinatura");
  });

  it("formatarDataHora", () => {
    expect(formatarDataHora(null)).toBeNull();
    expect(formatarDataHora("invalido")).toBeNull();
    expect(formatarDataHora("2026-09-21T12:00:00Z", "pt-BR")).toContain("21/09/2026");
  });
});
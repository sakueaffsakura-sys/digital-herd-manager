/**
 * Avaliação de plano/assinatura — lógica pura (testável sem banco).
 * A fonte da verdade é a RPC `public.minha_assinatura`; estas funções servem
 * para pré-visualizar estados na UI (formulário do administrador) e para
 * exibição otimista.
 */

export type Plano = "gratuito" | "premium";
export type StatusAssinatura =
  | "ativo"
  | "trial"
  | "cancelado"
  | "expirado"
  | "pendente";

export type AssinaturaView = {
  id?: string | null;
  user_id?: string | null;
  propriedade_id?: string | null;
  plano?: Plano | null;
  status?: StatusAssinatura | null;
  origem?: string | null;
  data_inicio?: string | null;
  data_expiracao?: string | null;
  premium_ativo?: boolean | null;
  demonstracao?: boolean | null;
};

export const PLANO_GRATUITO: AssinaturaView = {
  id: null,
  user_id: null,
  propriedade_id: null,
  plano: "gratuito",
  status: null,
  origem: null,
  data_inicio: null,
  data_expiracao: null,
  premium_ativo: false,
  demonstracao: false,
};

export type PlanoInput = {
  plano?: Plano | null;
  status?: StatusAssinatura | null;
  data_expiracao?: string | null;
  origem?: string | null;
};

export type PlanoResultado = {
  premium_ativo: boolean;
  demonstracao: boolean;
  label: string;
  status_label: string | null;
};

/** Uma assinatura "ativa/trial premimum" é premium enquanto não expira. */
export function premiumAtivo(p: PlanoInput, now: Date = new Date()): boolean {
  if (p.plano !== "premium") return false;
  if (p.status !== "ativo" && p.status !== "trial") return false;
  if (p.data_expiracao && new Date(p.data_expiracao).getTime() <= now.getTime())
    return false;
  return true;
}

export function avaliarPlano(p: PlanoInput, now: Date = new Date()): PlanoResultado {
  const ativo = premiumAtivo(p, now);
  const demonstracao = p?.origem === "demonstracao";
  const label = ativo ? "Premium" : "Gratuito";
  const status_label = p?.status ?? null;
  return { premium_ativo: ativo, demonstracao, label, status_label };
}

export const planoTitulo = (p: PlanoInput): string =>
  p?.plano === "premium" ? "Premium" : "Gratuito";

export const statusTitulo = (s: StatusAssinatura | null | undefined): string => {
  switch (s) {
    case "ativo":
      return "Ativo";
    case "trial":
      return "Período de teste";
    case "cancelado":
      return "Cancelado";
    case "expirado":
      return "Expirado";
    case "pendente":
      return "Pendente";
    default:
      return "Sem assinatura";
  }
};

export type SituacaoPlano =
  | "sem_assinatura"
  | "gratuito"
  | "premium_ativo"
  | "premium_demo"
  | "premium_expirado"
  | "premium_cancelado"
  | "premium_pendente";

export function situacaoPlano(
  p: PlanoInput,
  now: Date = new Date(),
): { chave: SituacaoPlano; label: string } {
  if (!p?.plano || p.plano === "gratuito") {
    return { chave: "gratuito", label: "Gratuito" };
  }
  if (p.status === "cancelado") {
    return { chave: "premium_cancelado", label: "Premium cancelado" };
  }
  if (
    p.status === "expirado" ||
    (p.data_expiracao &&
      new Date(p.data_expiracao).getTime() <= now.getTime())
  ) {
    return { chave: "premium_expirado", label: "Premium expirado" };
  }
  if (p.origem === "demonstracao") {
    return { chave: "premium_demo", label: "Premium de demonstração" };
  }
  if (p.status === "ativo" || p.status === "trial") {
    return { chave: "premium_ativo", label: "Premium ativo" };
  }
  return { chave: "premium_pendente", label: "Premium pendente" };
}

export const formatarDataHora = (
  iso: string | null | undefined,
  locale = "pt-BR",
): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(locale);
};
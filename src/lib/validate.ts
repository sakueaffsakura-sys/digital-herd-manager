export type ImportField = {
  key: string;
  label: string;
  type?: "text" | "number" | "date" | "boolean" | "select";
  required?: boolean;
  options?: { value: string; label: string }[];
};

export type ValidationResult = {
  value: Record<string, unknown>;
  errors: string[];
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const onlyDigits = (s: string) => s.replace(/[^\d]/g, "");

const parseFlexibleDate = (raw: string): string | null => {
  const t = raw.trim();
  if (!t) return null;
  if (ISO_DATE.test(t)) return t;
  const mdy = t.match(/^(\d{2})[/.-](\d{2})[/.-](\d{4})$/);
  if (mdy) return `${mdy[3]}-${mdy[2]}-${mdy[1]}`;
  const ymd = t.match(/^(\d{4})[/.-](\d{2})[/.-](\d{2})$/);
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;
  return null;
};

const parseNumber = (raw: string): number | null => {
  const t = raw.trim();
  if (!t) return null;
  // BR: 1.234,56 (separador de milhar '.', decimal ',').
  // Internacional: 1234.56 (decimal '.').
  const normalized = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
};

/**
 * Valida e normaliza uma linha de importação contra o schema do módulo.
 * Linhas com valor nulo em campos não obrigatórios viram null (em branco).
 */
export function normalizeAndValidate(
  fields: ImportField[],
  raw: Record<string, string>,
  linha: number,
): ValidationResult {
  const value: Record<string, unknown> = {};
  const errors: string[] = [];
  const had = (k: string) => Object.prototype.hasOwnProperty.call(raw, k) && raw[k] !== "";

  for (const f of fields) {
    const rawValue = raw[f.key];
    const present = had(f.key);

    if (!present) {
      if (f.required) {
        errors.push(`Linha ${linha}: campo obrigatório "${f.label}" ausente.`);
        continue;
      }
      value[f.key] = null;
      continue;
    }

    if (f.type === "number") {
      const n = parseNumber(rawValue);
      if (n === null) {
        errors.push(`Linha ${linha}: "${f.label}" deve ser um número (recebido "${rawValue}").`);
      } else {
        value[f.key] = n;
      }
      continue;
    }

    if (f.type === "date") {
      const d = parseFlexibleDate(rawValue);
      if (!d) {
        errors.push(`Linha ${linha}: "${f.label}" deve ser uma data (AAAA-MM-DD).`);
      } else {
        value[f.key] = d;
      }
      continue;
    }

    if (f.type === "boolean") {
      const t = rawValue.trim().toLowerCase();
      value[f.key] = ["true", "sim", "s", "1", "ativo"].includes(t);
      continue;
    }

    if (f.type === "select") {
      const allowed = f.options?.map((o) => o.value) ?? [];
      if (!allowed.includes(rawValue)) {
        errors.push(
          `Linha ${linha}: "${f.label}" inválido. Valores aceitos: ${allowed.join(", ")}.`,
        );
      } else {
        value[f.key] = rawValue;
      }
      continue;
    }

    value[f.key] = rawValue;
  }

  return { value, errors };
}

/** Chave natural de deduplicação por tabela (não inclui propriedade). */
export const naturalKeyFor = (tabela: string) => {
  const map: Record<string, (r: Record<string, unknown>) => string> = {
    animais: (r) => `brinco:${String(r["numero_brinco"] ?? "").trim().toLowerCase()}`,
    pesagens: (r) => `pesagem:${String(r["animal_id"] ?? "")}:${String(r["data"] ?? "")}`,
    vacinacoes: (r) =>
      `vac:${String(r["tipo_vacina_id"] ?? "")}:${String(r["data_aplicacao"] ?? "")}:${String(
        r["animal_id"] ?? r["lote_id"] ?? "",
      )}`,
    inseminacoes: (r) => `insem:${String(r["animal_id"] ?? "")}:${String(r["data_inseminacao"] ?? "")}`,
    nascimentos: (r) => `nasc:${String(r["bezerro_id"] ?? "")}`,
    producao_leite: (r) => `leite:${String(r["animal_id"] ?? "")}:${String(r["data"] ?? "")}`,
    anotacoes_producao: (r) =>
      `nota:${String(r["data"] ?? "")}:${String(r["animal_id"] ?? r["lote_id"] ?? "")}`,
    movimentacoes_financeiras: (r) =>
      `fin:${String(r["tipo"] ?? "")}:${String(r["descricao"] ?? "")}:${String(
        r["valor"] ?? "",
      )}:${String(r["data"] ?? "")}`,
    lotes: (r) => `lote:${String(r["nome"] ?? "").trim().toLowerCase()}`,
    tipos_vacinas: (r) => `tvac:${String(r["nome"] ?? "").trim().toLowerCase()}`,
    compras: (r) =>
      `compra:${String(r["data"] ?? "")}:${String(r["produto_animal"] ?? r["item"] ?? "")}:${String(
        r["valor"] ?? "",
      )}:${String(r["quantidade"] ?? "")}`,
    vendas: (r) =>
      `vin:${String(r["data"] ?? "")}:${String(r["item"] ?? r["produto_animal"] ?? "")}:${String(
        r["valor"] ?? "",
      )}:${String(r["quantidade"] ?? "")}`,
  };
  return map[tabela] ?? ((r) => JSON.stringify(r));
};
export const naturalKeyForTable = (tabela: string, row: Record<string, unknown>) =>
  naturalKeyFor(tabela)(row);

/** remove caracteres de controle antes de passar ao ilike do PostgREST */
export const escapeILike = (value: string) =>
  value.replace(/[\\%_]/g, (m) => `\\${m}`);
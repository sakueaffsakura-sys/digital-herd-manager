import { dataValida, isoValido } from "./datas";

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

/** Aceita AAAA-MM-DD, AAAA/MM/DD e DD/MM/AAAA (também com "." ou "-"); só datas que existem. */
export const parseFlexibleDate = (raw: string): string | null => {
  const t = raw.trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return isoValido(t) ? t : null;
  const dmy = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (dmy) {
    const [d, m, y] = [Number(dmy[1]), Number(dmy[2]), Number(dmy[3])];
    return dataValida(y, m, d) ? `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` : null;
  }
  const ymd = t.match(/^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/);
  if (ymd) {
    const [y, m, d] = [Number(ymd[1]), Number(ymd[2]), Number(ymd[3])];
    return dataValida(y, m, d) ? `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` : null;
  }
  return null;
};

/**
 * Número em formato brasileiro (1.234,56) ou internacional (1234.56).
 * Ignora "R$" e espaços. Rejeita "abc", "1e3", "0x10", "1,2,3".
 */
export const parseNumber = (raw: string): number | null => {
  const t = raw.replace(/R\$/gi, "").replace(/\s/g, "");
  if (!t) return null;
  const normalized = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
};

const SIM = ["true", "sim", "s", "1", "ativo", "yes", "y"];
const NAO = ["false", "nao", "não", "n", "0", "inativo", "no"];

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
  const had = (k: string) => Object.prototype.hasOwnProperty.call(raw, k) && String(raw[k] ?? "").trim() !== "";

  for (const f of fields) {
    const present = had(f.key);
    // espaços nas pontas nunca fazem parte do dado ("  1001 " -> "1001")
    const rawValue = present ? String(raw[f.key]).trim() : "";

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
        errors.push(`Linha ${linha}: "${f.label}" deve ser uma data que exista (AAAA-MM-DD ou DD/MM/AAAA), recebido "${rawValue}".`);
      } else {
        value[f.key] = d;
      }
      continue;
    }

    if (f.type === "boolean") {
      const t = rawValue.toLowerCase();
      if (SIM.includes(t)) value[f.key] = true;
      else if (NAO.includes(t)) value[f.key] = false;
      else errors.push(`Linha ${linha}: "${f.label}" deve ser sim ou não (recebido "${rawValue}").`);
      continue;
    }

    if (f.type === "select") {
      const options = f.options ?? [];
      const alvo = rawValue.toLowerCase();
      // aceita o valor do banco ("em_andamento") ou o rótulo da tela ("Em andamento"), sem diferenciar maiúsculas
      const achada = options.find(
        (o) => o.value.toLowerCase() === alvo || o.label.toLowerCase() === alvo || o.value.replaceAll("_", " ").toLowerCase() === alvo,
      );
      if (!achada) {
        errors.push(
          `Linha ${linha}: "${f.label}" inválido. Valores aceitos: ${options.map((o) => o.value).join(", ")}.`,
        );
      } else {
        value[f.key] = achada.value;
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
    // Anotações não têm identificador natural: duas no mesmo dia para o mesmo animal
    // são normais. Só é duplicata se o texto também for igual.
    anotacoes_producao: (r) =>
      `nota:${String(r["data"] ?? "")}:${String(r["animal_id"] ?? r["lote_id"] ?? "")}:${String(
        r["observacao"] ?? "",
      ).trim().toLowerCase()}:${String(r["producao"] ?? "")}`,
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

/** Escapa os curingas do ILIKE (`\`, `%`, `_`) para o texto valer literalmente. */
export const escapeILike = (value: string) =>
  value.replace(/[\\%_]/g, (m) => `\\${m}`);
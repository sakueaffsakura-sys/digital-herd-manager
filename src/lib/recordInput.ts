import type { Field, FormRefs, Row } from "@/components/app/shared";
import { supabase } from "@/integrations/supabase/client";
import { resolveNoteReference } from "./noteReference";

const normalize = (text: string) => text.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[_\s]+/g, " ");


export function recordReferenceRows(field: Field, refs: FormRefs | undefined, currentId: unknown) {
  if (field.type === "animal") return (refs?.animals ?? []).filter((animal) =>
    (!field.sex || animal.sexo === field.sex) && (!field.activeOnly || animal.situacao === "ativo" || animal.id === currentId));
  if (field.type === "vacina") return refs?.vaccines ?? [];
  return refs?.lots ?? [];
}

export function resolveRecordInputs(fields: readonly Field[], form: Row, writtenRefs: Record<string, string>, refs: FormRefs | undefined, original: Row | null): { values: Row; error?: string } {
  const values = { ...form };
  for (const field of fields) {
    if (["animal", "lote", "vacina"].includes(field.type ?? "") && writtenRefs[field.key] !== undefined) {
      const result = resolveNoteReference(writtenRefs[field.key], recordReferenceRows(field, refs, original?.[field.key]));
      if (result.error) return { values, error: `${field.label}: ${result.error}` };
      values[field.key] = result.id;
    }
    if (field.type === "select") {
      const text = normalize(String(values[field.key] ?? ""));
      if (!text) { values[field.key] = null; continue; }
      const matches = (field.options ?? []).filter((option) => [option.value, option.label].some((value) => normalize(value) === text));
      if (matches.length !== 1) return { values, error: `${field.label}: informe ${(field.options ?? []).map((option) => option.label).join(", ")}.` };
      values[field.key] = matches[0].value;
    }
  }
  return { values };
}

const referenceColumns = "id,nome,numero_brinco,sexo,situacao,data_nascimento";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Consulta a fonte oficial, inclusive quando a lista local está desatualizada. */
async function findReference(field: Field, text: string, propertyId: string, currentId: unknown): Promise<{ id?: string; error?: string }> {
  const pattern = text.replace(/[\\%_]/g, "\\$&");
  const queries = field.type === "animal"
    ? [supabase.from("animais").select(referenceColumns).eq("propriedade_id", propertyId).ilike("numero_brinco", pattern).limit(2),
       supabase.from("animais").select(referenceColumns).eq("propriedade_id", propertyId).ilike("nome", pattern).limit(2)]
    : [supabase.from(field.type === "vacina" ? "tipos_vacinas" : "lotes").select("id,nome,ativo").eq("propriedade_id", propertyId).ilike("nome", pattern).limit(2)];
  if (uuid.test(text)) {
    queries.unshift(field.type === "animal"
      ? supabase.from("animais").select(referenceColumns).eq("propriedade_id", propertyId).eq("id", text).limit(1)
      : supabase.from(field.type === "vacina" ? "tipos_vacinas" : "lotes").select("id,nome,ativo").eq("propriedade_id", propertyId).eq("id", text).limit(1));
  }
  const results = await Promise.all(queries);
  const failed = results.find((result) => result.error);
  if (failed) return { error: "Não foi possível conferir o cadastro. Tente novamente." };
  const rows = [...new Map(results.flatMap((result) => result.data ?? []).map((row) => [row.id, row])).values()];
  // Um brinco/identificador exato tem prioridade sobre nomes repetidos.
  const exact = rows.filter((row) => row.id === text || ("numero_brinco" in row && normalize(String(row.numero_brinco)) === normalize(text)));
  const candidates = exact.length ? exact : rows;
  if (candidates.length > 1) return { error: "Há mais de um cadastro com esse nome. Digite o brinco ou o identificador." };
  const found = candidates[0];
  if (!found) return {};
  if (field.type === "animal" && "sexo" in found) {
    if (field.sex && found.sexo !== field.sex) return { error: `O animal já existe, mas deve ser ${field.sex === "F" ? "fêmea" : "macho"} neste campo. Use outro animal.` };
    if (field.activeOnly && found.situacao !== "ativo" && found.id !== currentId) return { error: "O animal já existe, mas não está ativo. Use um animal ativo." };
  }
  return { id: found.id };
}

/** Cria somente após conferir o banco; uma disputa de inserção reutiliza o vencedor. */
async function createReference(field: Field, text: string, propertyId: string, currentId: unknown): Promise<{ id?: string; error?: string; created?: boolean }> {
  const existing = await findReference(field, text, propertyId, currentId);
  if (existing.id || existing.error) return existing;
  const recover = async (error: { code?: string; message: string }) => {
    if (error.code === "23505") {
      const found = await findReference(field, text, propertyId, currentId);
      if (found.id || found.error) return found;
    }
    return { error: "Não foi possível criar o cadastro. Confira os dados e tente novamente." };
  };
  if (field.type === "animal") {
    const { data, error } = await supabase.from("animais").insert({
      propriedade_id: propertyId,
      numero_brinco: text,
      nome: text,
      sexo: field.sex ?? "F",
      situacao: "ativo",
    }).select("id").single();
    if (error) return recover(error);
    return { id: data.id, created: true };
  }
  if (field.type === "vacina") {
    const { data, error } = await supabase.from("tipos_vacinas").insert({ propriedade_id: propertyId, nome: text, ativo: true }).select("id").single();
    if (error) return recover(error);
    return { id: data.id, created: true };
  }
  const { data, error } = await supabase.from("lotes").insert({ propriedade_id: propertyId, nome: text, ativo: true }).select("id").single();
  if (error) return recover(error);
  return { id: data.id, created: true };
}

/** Lote é contexto quando há um animal; aplicações coletivas usam só o lote. */
export function vaccinationTarget(values: Row): Row {
  return values.animal_id ? { ...values, lote_id: null } : values;
}

/**
 * Resolve os campos digitados; quando o nome não existe, cria o cadastro
 * correspondente (animal, lote ou vacina) em vez de bloquear o salvamento.
 */
export async function ensureRecordReferences(
  fields: readonly Field[],
  form: Row,
  writtenRefs: Record<string, string>,
  refs: FormRefs | undefined,
  original: Row | null,
  propertyId: string,
): Promise<{ values: Row; error?: string; created: string[] }> {
  const values = { ...form };
  const created: string[] = [];
  for (const field of fields) {
    if (["animal", "lote", "vacina"].includes(field.type ?? "") && writtenRefs[field.key] !== undefined) {
      const text = writtenRefs[field.key].trim();
      const result = resolveNoteReference(text, recordReferenceRows(field, refs, original?.[field.key]));
      if (result.error) {
        if (!text) { values[field.key] = null; continue; }
        if (result.error.includes("mais de um")) return { values, error: `${field.label}: ${result.error}`, created };
        const novo = await createReference(field, text, propertyId, original?.[field.key]);
        if (novo.error) return { values, error: `${field.label}: ${novo.error}`, created };
        values[field.key] = novo.id;
        if (novo.created) created.push(`${field.label} "${text}"`);
        continue;
      }
      values[field.key] = result.id;
    }
    if (field.type === "select") {
      const text = normalize(String(values[field.key] ?? ""));
      if (!text) { values[field.key] = null; continue; }
      const matches = (field.options ?? []).filter((option) => [option.value, option.label].some((value) => normalize(value) === text));
      if (matches.length !== 1) return { values, error: `${field.label}: informe ${(field.options ?? []).map((option) => option.label).join(", ")}.`, created };
      values[field.key] = matches[0].value;
    }
  }
  return { values, created };
}

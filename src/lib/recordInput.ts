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

/** Cria automaticamente o cadastro digitado quando ele ainda não existe. */
async function createReference(field: Field, text: string, propertyId: string): Promise<{ id?: string; error?: string }> {
  if (field.type === "animal") {
    const { data, error } = await supabase.from("animais").insert({
      propriedade_id: propertyId,
      numero_brinco: text,
      nome: text,
      sexo: field.sex ?? "F",
      situacao: "ativo",
    }).select("id").single();
    if (error) return { error: error.message.includes("numero_brinco") ? "já existe um animal com esse brinco." : "não foi possível criar o cadastro do animal." };
    return { id: data.id };
  }
  if (field.type === "vacina") {
    const { data, error } = await supabase.from("tipos_vacinas").insert({ propriedade_id: propertyId, nome: text, ativo: true }).select("id").single();
    if (error) return { error: "não foi possível criar o cadastro da vacina." };
    return { id: data.id };
  }
  const { data, error } = await supabase.from("lotes").insert({ propriedade_id: propertyId, nome: text, ativo: true }).select("id").single();
  if (error) return { error: "não foi possível criar o cadastro do lote." };
  return { id: data.id };
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
        const novo = await createReference(field, text, propertyId);
        if (novo.error) return { values, error: `${field.label}: ${novo.error}`, created };
        values[field.key] = novo.id;
        created.push(`${field.label} "${text}"`);
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

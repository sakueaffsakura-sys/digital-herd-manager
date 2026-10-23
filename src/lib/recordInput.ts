import type { Field, FormRefs, Row } from "@/components/app/shared";
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
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAll";
import type { FormRefs } from "./shared";

/** One cache contract for every record form, with complete selection lists. */
export async function loadFormRefs(propertyId: string): Promise<FormRefs> {
  const [animals, lots, vaccines] = await Promise.all([
    fetchAllRows((a, b) => supabase.from("animais").select("id,nome,numero_brinco,data_nascimento,sexo,situacao").eq("propriedade_id", propertyId).order("numero_brinco").order("id").range(a, b)),
    fetchAllRows((a, b) => supabase.from("lotes").select("id,nome").eq("propriedade_id", propertyId).eq("ativo", true).order("id").range(a, b)),
    fetchAllRows((a, b) => supabase.from("tipos_vacinas").select("id,nome").eq("propriedade_id", propertyId).eq("ativo", true).order("id").range(a, b)),
  ]);
  return { animals, lots, vaccines };
}
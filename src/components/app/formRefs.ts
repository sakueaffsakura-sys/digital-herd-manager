import { dados } from "@/lib/dados";
import { supabaseDinamico } from "@/lib/supabaseDinamico";
import { fetchAllRows } from "@/lib/fetchAll";
import type { Field, FormRefs } from "./shared";

/** Tabela ligada e a coluna que mostra o nome dela. */
export type RefExtra = { tabela: string; rotulo: string };

/** As tabelas ligadas que um formulário precisa, sem repetir. */
export function tabelasDeReferencia(fields: readonly Field[]): RefExtra[] {
  const porTabela = new Map<string, RefExtra>();
  for (const f of fields) {
    if (f.type !== "ref" || !f.refTabela) continue;
    porTabela.set(f.refTabela, { tabela: f.refTabela, rotulo: f.refRotulo ?? "nome" });
  }
  return [...porTabela.values()].sort((a, b) => a.tabela.localeCompare(b.tabela));
}

/** Parte da chave de cache: formulários com as mesmas tabelas ligadas compartilham a lista. */
export const chaveDeReferencias = (extras: readonly RefExtra[]) => extras.map((e) => `${e.tabela}:${e.rotulo}`).join(",");

/** One cache contract for every record form, with complete selection lists. */
export async function loadFormRefs(propertyId: string, extras: readonly RefExtra[] = []): Promise<FormRefs> {
  const [animals, lots, vaccines, ...listas] = await Promise.all([
    fetchAllRows((a, b) => dados.from("animais").select("id,nome,numero_brinco,data_nascimento,sexo,situacao").eq("propriedade_id", propertyId).order("numero_brinco").order("id").range(a, b)),
    fetchAllRows((a, b) => dados.from("lotes").select("id,nome").eq("propriedade_id", propertyId).eq("ativo", true).order("id").range(a, b)),
    fetchAllRows((a, b) => dados.from("tipos_vacinas").select("id,nome").eq("propriedade_id", propertyId).eq("ativo", true).order("id").range(a, b)),
    // A coluna do nome muda por tabela, então a lista de colunas é montada em tempo de
    // execução; o `as "*"` só avisa o TypeScript disso (o cliente aqui já é sem tipos).
    ...extras.map((e) =>
      fetchAllRows<Record<string, unknown>>((a, b) =>
        supabaseDinamico.from(e.tabela).select(`id,${e.rotulo}` as "*").eq("propriedade_id", propertyId).order(e.rotulo).order("id").range(a, b),
      ),
    ),
  ]);
  const extrasPorTabela: Record<string, { id: string; nome: string }[]> = {};
  extras.forEach((e, i) => {
    extrasPorTabela[e.tabela] = (listas[i] ?? []).map((row) => ({ id: String(row["id"]), nome: String(row[e.rotulo] ?? "") }));
  });
  return { animals, lots, vaccines, extras: extrasPorTabela };
}

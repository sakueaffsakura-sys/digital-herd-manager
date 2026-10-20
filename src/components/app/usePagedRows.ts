import { type QueryClient, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { clampPage, rangeOf } from "@/lib/pagination";
import { escapeILikeValue, orSearch, termoDeBusca } from "@/lib/busca";

export { escapeILikeValue };

export type GridFilter = {
  key: string;
  op: "eq" | "ilike" | "gte" | "lte" | "is-null";
  value: string | null;
};

export type FilterBag = GridFilter[];

export function useDebouncedValue<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

const serialize = (filters: FilterBag | undefined, search: string) =>
  `${search}\u0000${JSON.stringify(filters?.map((f) => [f.key, f.op, f.value]))}`;

function baseScopedQuery(
  table: string,
  propertyId: string,
  search: string,
  searchColumns: string[] | undefined,
  filters: FilterBag | undefined,
) {
  let q = (supabase.from(table as any) as any).select();
  q = q.eq("propriedade_id", propertyId);
  for (const f of filters ?? []) {
    if (!f) continue;
    if (f.op === "is-null") {
      q = q.is(f.key, null);
      continue;
    }
    if (f.value === null || f.value === "") continue;
    q = q[f.op](f.key, f.op === "ilike" ? `%${escapeILikeValue(f.value)}%` : f.value);
  }
  const compiled = orSearch(searchColumns, search);
  if (compiled) q = q.or(compiled);
  return q;
}

export function createPageableTable({ table, propertyId }: { table: string; propertyId: string }) {
  return {
    count: async ({
      search,
      searchColumns,
      filters,
    }: {
      search: string;
      searchColumns?: string[];
      filters?: FilterBag;
    }) => {
      const q = baseScopedQuery(table, propertyId, search, searchColumns, filters);
      const { count, error } = await (q as any).select("id", { count: "exact", head: true });
      return { count: (count ?? 0) as number, error };
    },

    rows: async ({
      cols,
      page,
      pageSize,
      search,
      searchColumns,
      filters,
    }: {
      cols: string;
      page: number;
      pageSize: number;
      search: string;
      searchColumns?: string[];
      filters?: FilterBag;
    }) => {
      const { from, to } = rangeOf(page, pageSize);
      let q = baseScopedQuery(table, propertyId, search, searchColumns, filters);
      q = q.order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, to);
      const { data, error } = await q.select(cols);
      return { data: (data ?? []) as Record<string, unknown>[], error };
    },

    invalidate: (qc: QueryClient) => {
      void qc.invalidateQueries({ queryKey: [table, propertyId] });
      void qc.invalidateQueries({ queryKey: [`${table}-rows`, propertyId] });
      void qc.invalidateQueries({ queryKey: [`${table}-total`, propertyId] });
    },
  };
}

export type UsePagedRowsArgs = {
  table: string;
  propertyId: string;
  cols: string;
  page: number;
  pageSize: number;
  search: string;
  searchColumns?: string[];
  filters?: FilterBag;
};

/**
 * Listagem servida do banco com paginação (range) e busca ilike. Não carrega
 * a tabela inteira no navegador.
 *
 * A lista e o total são consultas separadas: as linhas aparecem assim que
 * chegam, sem esperar o `count(*)` — que em fazendas com milhões de registros
 * é a parte mais lenta. Enquanto o total não chega (`totalReady === false`)
 * quem usa não deve "corrigir" a página atual.
 */
export function usePagedRows({
  table,
  propertyId,
  cols,
  page,
  pageSize,
  search,
  searchColumns,
  filters,
}: UsePagedRowsArgs) {
  const finalPage = clampPage(page, Number.MAX_SAFE_INTEGER, pageSize);
  const termo = termoDeBusca(search);
  const cacheKey = serialize(filters, termo);

  const list = useQuery({
    queryKey: [table, propertyId, "rows", cols, finalPage, pageSize, cacheKey],
    queryFn: async () => {
      const res = await createPageableTable({ table, propertyId }).rows({
        cols,
        page: finalPage,
        pageSize,
        search: termo,
        searchColumns,
        filters,
      });
      if (res.error) throw res.error;
      return res.data;
    },
    placeholderData: (prev) => prev,
  });

  const total = useQuery({
    queryKey: [table, propertyId, "total", cacheKey],
    queryFn: async () => {
      const res = await createPageableTable({ table, propertyId }).count({
        search: termo,
        searchColumns,
        filters,
      });
      if (res.error) throw res.error;
      return res.count;
    },
    placeholderData: (prev) => prev,
    // o total muda pouco; evita recontar a cada troca de página ou de aba
    staleTime: 20_000,
  });

  return {
    rows: (list.data ?? []) as Record<string, unknown>[],
    total: (total.data ?? 0) as number,
    /** true só na primeira carga das linhas (depois, a lista anterior fica na tela). */
    isPending: list.isPending,
    /** true enquanto o total ainda não foi calculado nenhuma vez. */
    totalPending: total.isPending,
    totalReady: !total.isPending && !total.isError,
    isFetching: list.isFetching,
    isError: list.isError,
    error: (list.error ?? total.error) as unknown as Error | null,
    refetch: () => {
      void list.refetch();
      void total.refetch();
    },
  };
}

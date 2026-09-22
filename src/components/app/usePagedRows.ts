import { type QueryClient, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { clampPage, rangeOf } from "@/lib/pagination";

export type GridFilter = {
  key: string;
  op: "eq" | "ilike" | "gte" | "lte" | "is-null";
  value: string | null;
};

export type FilterBag = GridFilter[];

/**
 * Escapa um valor para uso dentro de `.or("...")` do PostgREST em um único
 * passe: separadores `,` / `()` / aspas / barra e curingas `%_` viram literais.
 */
export const escapeOrValue = (value: string) =>
  value.replace(/[\\"(),%_]/g, (m) => `\\${m}`);

const orTerm = (key: string, value: string) => `${key}.ilike.%${escapeOrValue(value)}%`;

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

function applyKludges(
  table: string,
  propertyId: string,
  search: string,
  searchColumns: string[] | undefined,
  filters: FilterBag | undefined,
) {
  const base = supabase.from(table as any);
  let q = base.eq("propriedade_id", propertyId);
  for (const f of filters ?? []) {
    if (!f) continue;
    if (f.op === "is-null") {
      q = q.is(f.key, null);
      continue;
    }
    if (f.value === null || f.value === "") continue;
    q = q[f.op](f.key, f.op === "ilike" ? `%${escapeILikeValue(f.value)}%` : f.value);
  }
  if (search && (searchColumns?.length ?? 0) > 0) {
    const compiled = searchColumns!.length === 1
      ? orTerm(searchColumns![0], search)
      : `(${searchColumns!.map((c) => orTerm(c, search)).join(",")})`;
    q = q.or(compiled);
  }
  return q;
}

/** Escapa curingas do ILIKE mantendo o valor literal. */
export const escapeILikeValue = (value: string) =>
  value.replace(/[\\%_]/g, (m) => `\\${m}`);

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
      const q = applyKludges(table, propertyId, search, searchColumns, filters);
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
      let q = applyKludges(table, propertyId, search, searchColumns, filters);
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
 * Listagem servida do banco com paginação (range), contagem exata e busca
 * ilike. Não carrega a tabela inteira no navegador.
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
  const cacheKey = serialize(filters, search);

  const list = useQuery({
    queryKey: [`${table}-rows`, propertyId, cols, finalPage, pageSize, cacheKey],
    queryFn: async () => {
      const res = await createPageableTable({ table, propertyId }).rows({
        cols,
        page: finalPage,
        pageSize,
        search,
        searchColumns,
        filters,
      });
      if (res.error) throw res.error;
      return res.data;
    },
    placeholderData: (prev) => prev,
  });

  const total = useQuery({
    queryKey: [`${table}-total`, propertyId, cacheKey],
    queryFn: async () => {
      const res = await createPageableTable({ table, propertyId }).count({
        search,
        searchColumns,
        filters,
      });
      if (res.error) throw res.error;
      return res.count;
    },
    placeholderData: (prev) => prev,
  });

  return {
    rows: (list.data ?? []) as Record<string, unknown>[],
    total: (total.data ?? 0) as number,
    isPending: list.isPending || total.isPending,
    isError: list.isError || total.isError,
    error: (list.error ?? total.error) as unknown as Error | null,
    refetch: () => {
      void list.refetch();
      void total.refetch();
    },
  };
}
import { type QueryClient, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { clampPage, rangeOf } from "@/lib/pagination";
import { escapeILike } from "@/lib/validate";

export type GridFilter = {
  key: string;
  op: "eq" | "ilike" | "gte" | "lte";
  value: string | null;
};

export type PageableTable = ReturnType<typeof createPageableTable>;

/** Escapa valor para uso dentro do `.or()` do PostgREST. */
export const escapeOrValue = (value: string) =>
  value.replace(/[\\,".,()]/g, (m) => `\\${m}`);

const orTerm = (key: string, value: string) => `${key}.ilike.%${escapeOrValue(escapeILike(value))}%`;

export function useDebouncedValue<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function createPageableTable({ table, propertyId }: { table: string; propertyId: string }) {
  return {
    /** Contagem exata com os mesmos filtros/busca (COUNT no banco). */
    count: async ({
      search,
      searchColumns,
      filters,
    }: {
      search: string;
      searchColumns?: string[];
      filters?: GridFilter[];
    }) => {
      let q = supabase
        .from(table as never)
        .select("id", { count: "exact", head: true })
        .eq("propriedade_id", propertyId);
      for (const f of filters ?? []) {
        if (!f || !f.value) continue;
        q = q[f.op](f.key, f.op === "ilike" ? `%${escapeILike(f.value)}%` : f.value);
      }
      if (search && (searchColumns?.length ?? 0) > 0) {
        q = q.or(searchColumns!.map((c) => orTerm(c, search)).join(","));
      }
      const { count, error } = await q;
      return { count: count ?? 0, error };
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
      filters?: GridFilter[];
    }) => {
      const { from, to } = rangeOf(page, pageSize);
      let q = supabase
        .from(table as never)
        .select(cols)
        .eq("propriedade_id", propertyId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to);
      for (const f of filters ?? []) {
        if (!f || !f.value) continue;
        q = q[f.op](f.key, f.op === "ilike" ? `%${escapeILike(f.value)}%` : f.value);
      }
      if (search && (searchColumns?.length ?? 0) > 0) {
        q = q.or(searchColumns!.map((c) => orTerm(c, search)).join(","));
      }
      const { data, error } = await q;
      return { data: (data ?? []) as Record<string, unknown>[], error };
    },

    invalidate: (qc: QueryClient) => {
      qc.invalidateQueries({ queryKey: [table, propertyId] });
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
  filters?: GridFilter[];
};

/**
 * Listagem servida do banco com paginação, contagem real e busca ilike.
 * Retorna estado para tabela virtualizada no cliente.
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
  const safePage = clampPage(page, Number.MAX_SAFE_INTEGER, pageSize);
  const finalPage = page > safePage ? safePage : page;

  const list = useQuery({
    queryKey: [`${table}-rows`, propertyId, cols, finalPage, pageSize, search, filters],
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
    queryKey: [`${table}-total`, propertyId, search, filters],
    queryFn: async () => {
      const res = await createPageableTable({ table, propertyId }).count({ search, searchColumns, filters });
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
    error: (list.error ?? total.error) as Error | null,
    refetch: () => {
      void list.refetch();
      void total.refetch();
    },
    queryClient: list.queryClient,
  };
}
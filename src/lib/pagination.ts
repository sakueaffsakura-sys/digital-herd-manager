export const PAGE_SIZES = [25, 50, 100, 500, 1000] as const;
export const DEFAULT_PAGE_SIZE = 25;

export type PageState = {
  page: number;
  pageSize: number;
  total: number;
};

export const maxPage = ({ total, pageSize }: { total: number; pageSize: number }) =>
  Math.max(1, Math.ceil(total / pageSize));

export const clampPage = (page: number, total: number, pageSize: number) =>
  Math.min(Math.max(1, Math.floor(page)), maxPage({ total, pageSize }));

/** Intervalo [from, to] para PostgREST `.range()`. */
export const rangeOf = (page: number, pageSize: number) => ({
  from: (page - 1) * pageSize,
  to: page * pageSize - 1,
});

/** Janela de páginas numeradas ao redor da página atual (p/ botões). */
export const pageWindow = (
  page: number,
  total: number,
  pageSize: number,
  width = 2,
): number[] => {
  const last = maxPage({ total, pageSize });
  const start = Math.max(1, page - width);
  const end = Math.min(last, page + width);
  const result: number[] = [];
  for (let i = start; i <= end; i++) result.push(i);
  return result;
};

/** Resumo "1–50 de 1.234 registros" */
export const pageSummary = ({ page, pageSize, total }: PageState) => {
  if (total === 0) return { de: 0, ate: 0, total: 0 };
  const de = (page - 1) * pageSize + 1;
  const ate = Math.min(page * pageSize, total);
  return { de, ate, total };
};
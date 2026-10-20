/**
 * Busca linhas em blocos de 1000 (limite do servidor) até `max`.
 *
 * Quem chama precisa montar uma consulta com ORDEM TOTAL (inclua `id` no fim do
 * order): paginar com `range` sobre uma ordem com empates faz o PostgreSQL repetir
 * ou pular linhas entre uma página e outra.
 */
export type FetchAllResult<T> = { rows: T[]; truncated: boolean };

export async function fetchAllRowsInfo<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  max = 20000,
): Promise<FetchAllResult<T>> {
  const out: T[] = [];
  const step = 1000;
  for (let from = 0; from < max; from += step) {
    const { data, error } = await build(from, from + step - 1);
    if (error) throw error;
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < step) return { rows: out, truncated: false };
  }
  // chegou ao teto com a última página cheia: pode haver mais linhas no servidor
  return { rows: out, truncated: true };
}

/** Igual a fetchAllRowsInfo, mas devolve só as linhas (listas de seleção). */
export async function fetchAllRows<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  max = 20000,
): Promise<T[]> {
  return (await fetchAllRowsInfo(build, max)).rows;
}

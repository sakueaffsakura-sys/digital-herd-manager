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
  const paralelo = 4; // busca 4 páginas ao mesmo tempo: listas grandes carregam ~4x mais rápido
  for (let base = 0; base < max; base += step * paralelo) {
    const inicios: number[] = [];
    for (let f = base; f < Math.min(base + step * paralelo, max); f += step) inicios.push(f);
    const paginas = await Promise.all(inicios.map((f) => build(f, f + step - 1)));
    for (const { data, error } of paginas) {
      if (error) throw error;
      const rows = data ?? [];
      out.push(...rows);
      if (rows.length < step) return { rows: out, truncated: false };
    }
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

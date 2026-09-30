/**
 * Busca linhas em blocos de 1000 (limite do servidor) até `max`, para listas de
 * seleção não "sumirem" com registros acima de 1000.
 */
export async function fetchAllRows<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  max = 20000,
): Promise<T[]> {
  const out: T[] = [];
  const step = 1000;
  for (let from = 0; from < max; from += step) {
    const { data, error } = await build(from, from + step - 1);
    if (error) throw error;
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < step) break;
  }
  return out;
}

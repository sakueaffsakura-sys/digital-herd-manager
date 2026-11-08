/**
 * Montagem segura de filtros de busca para o PostgREST (supabase-js).
 * Fica em um módulo próprio, sem importar o cliente do Supabase, para poder
 * ser testado sem rede.
 */

/** Tamanho máximo do termo digitado (evita consultas gigantes e abuso). */
export const BUSCA_MAX = 100;

/** Normaliza o que a pessoa digitou: tira espaços das pontas/duplicados e limita o tamanho. */
export const termoDeBusca = (raw: string): string =>
  Array.from(raw, (c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127 ? " " : c).join("").replace(/\s+/g, " ").trim().slice(0, BUSCA_MAX);

/** Escapa os curingas do ILIKE (`\`, `%`, `_`) para o termo valer literalmente. */
export const escapeILikeValue = (value: string) => value.replace(/[\\%_]/g, (m) => `\\${m}`);

/**
 * Coloca um valor entre aspas para filtros lógicos (`.or(...)`) do PostgREST.
 * Sem as aspas, uma vírgula ou parêntese na busca ("Silva, João") quebra o
 * filtro inteiro; dentro das aspas só `"` e `\` precisam de barra.
 */
export const quoteOrValue = (value: string) => `"${value.replace(/[\\"]/g, (m) => `\\${m}`)}"`;

/** `coluna.ilike."%termo%"` com o termo já escapado para ILIKE e para o PostgREST. */
export const orIlikeTerm = (column: string, term: string) =>
  `${column}.ilike.${quoteOrValue(`%${escapeILikeValue(term)}%`)}`;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `coluna.in.(id1,id2)` para procurar também pelos registros ligados (ex.: as anotações
 * de um animal cujo brinco bate com a busca). Só aceita identificadores UUID, e no máximo
 * `limite` deles, para o filtro não virar uma consulta gigante.
 */
export function orInUuids(column: string, ids: readonly string[], limite = 100): string | null {
  const limpos = [...new Set(ids.filter((id) => UUID.test(id)))].slice(0, limite);
  return limpos.length ? `${column}.in.(${limpos.join(",")})` : null;
}

/**
 * Condição `.or(...)` que procura o termo em qualquer uma das colunas.
 * `extras` são condições prontas (ex.: `animal_id.in.(...)`) que entram no mesmo "ou".
 * Devolve null quando não há o que filtrar.
 */
export function orSearch(columns: readonly string[] | undefined, rawTerm: string, extras: readonly string[] = []): string | null {
  const term = termoDeBusca(rawTerm);
  const limpos = extras.filter(Boolean);
  if (!term) return null;
  const colunas = columns && columns.length > 0 ? columns.map((c) => orIlikeTerm(c, term)) : [];
  const todas = [...colunas, ...limpos];
  return todas.length ? todas.join(",") : null;
}

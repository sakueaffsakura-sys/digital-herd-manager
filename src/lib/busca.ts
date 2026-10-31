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

/**
 * Condição `.or(...)` que procura o termo em qualquer uma das colunas.
 * Devolve null quando não há o que filtrar.
 */
export function orSearch(columns: readonly string[] | undefined, rawTerm: string): string | null {
  const term = termoDeBusca(rawTerm);
  if (!term || !columns || columns.length === 0) return null;
  return columns.map((c) => orIlikeTerm(c, term)).join(",");
}

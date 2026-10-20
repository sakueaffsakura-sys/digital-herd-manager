export type ParsedImport = {
  headers: string[];
  rows: Record<string, string>[];
};

export const stripBom = (text: string) =>
  text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

/**
 * Normaliza um cabeçalho para o nome de coluna do banco:
 * "Número do brinco" -> "numero_do_brinco", "ProDuto-Animal" -> "produto_animal".
 * Remove acentos (qualquer letra, não só as do português) e troca qualquer
 * sequência de espaços/pontuação por um único "_".
 */
export const normalizeHeader = (header: string) =>
  header
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '');

/**
 * Descobre o separador do arquivo olhando a primeira linha (fora das aspas):
 * o Excel em português salva CSV com ";" e o Google Planilhas com ",".
 */
export function detectDelimiter(text: string, fileName = ''): ',' | ';' | '\t' {
  if (fileName.toLowerCase().endsWith('.tsv')) return '\t';
  const first = stripBom(text).split(/\r?\n/, 1)[0] ?? '';
  const count: Record<string, number> = { ',': 0, ';': 0, '\t': 0 };
  let inQuotes = false;
  for (const ch of first) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch in count) count[ch] += 1;
  }
  if (count['\t'] > 0 && count['\t'] >= count[';'] && count['\t'] >= count[',']) return '\t';
  if (count[';'] > count[',']) return ';';
  return ',';
}

/**
 * Parser CSV defensivo: aspas duplas, CRLF, campos com quebra de linha,
 * aspas escapadas (""), cabeçalhos e linhas com tamanhos diferentes.
 */
export function parseCSV(text: string, delimiter: string = ','): ParsedImport {
  const src = stripBom(text).replace(/\r\n/g, '\n');
  const rows: string[][] = [];
  let cur = '';
  let row: string[] = [];
  let inQuotes = false;

  const pushCell = () => {
    row.push(cur);
    cur = '';
  };
  const pushRow = () => {
    pushCell();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      pushCell();
    } else if (ch === '\n') {
      pushRow();
    } else {
      cur += ch;
    }
  }
  if (cur.length > 0 || row.length > 0) pushRow();

  // linhas em branco no fim do arquivo (muito comum depois de editar no Excel)
  while (rows.length > 1 && rows[rows.length - 1].every((cell) => cell.trim() === '')) rows.pop();

  if (rows.length < 2) return { headers: [], rows: [] };

  const headers = rows[0].map(normalizeHeader);
  const body = rows.slice(1);
  const headersLength = headers.length;

  const out: Record<string, string>[] = [];
  for (const line of body) {
    const record: Record<string, string> = {};
    for (let i = 0; i < headersLength; i++) {
      const header = headers[i];
      if (!header) continue;
      record[header] = (line[i] ?? '').trim();
    }
    out.push(record);
  }
  return { headers, rows: out };
}

const SINONIMOS_POR_TIPO: Record<string, string[]> = {
  animal: ['animal', 'brinco', 'numero_brinco', 'nome_animal', 'vaca'],
  lote: ['lote', 'nome_lote'],
  vacina: ['vacina', 'tipo_vacina', 'nome_vacina'],
};

const SINONIMOS_POR_CAMPO: Record<string, string[]> = {
  numero_brinco: ['brinco', 'n_brinco'],
  data_nascimento: ['nascimento', 'data_de_nascimento'],
  observacao: ['obs', 'observacoes', 'anotacao'],
};

/**
 * Nomes que cada campo aceita no arquivo: a chave do banco ("numero_brinco"),
 * o rótulo da tela ("Número do brinco") e apelidos comuns ("brinco"). Apelidos
 * por tipo (animal/lote/vacina) só valem quando o cadastro tem um único campo
 * daquele tipo; a chave do banco nunca perde para um apelido.
 */
export function buildAliases(
  fields: { key: string; label: string; type?: string }[],
): Record<string, string> {
  const out: Record<string, string> = {};
  const donos = new Set(fields.map((f) => f.key));
  const add = (nome: string, key: string) => {
    const n = normalizeHeader(nome);
    if (!n || (donos.has(n) && n !== key)) return; // nunca roubar o nome de outro campo
    if (out[n] === undefined) out[n] = key;
  };
  for (const f of fields) add(f.key, f.key);
  for (const f of fields) add(f.label, f.key);
  for (const f of fields) for (const a of SINONIMOS_POR_CAMPO[f.key] ?? []) add(a, f.key);
  const porTipo = new Map<string, number>();
  for (const f of fields) porTipo.set(f.type ?? '', (porTipo.get(f.type ?? '') ?? 0) + 1);
  for (const f of fields) {
    if (porTipo.get(f.type ?? '') !== 1) continue;
    for (const a of SINONIMOS_POR_TIPO[f.type ?? ''] ?? []) add(a, f.key);
  }
  return out;
}

/**
 * Troca os nomes de colunas do arquivo pelos nomes de campo do cadastro.
 * `aliases` mapeia um cabeçalho já normalizado ("numero_do_brinco") para a chave
 * do campo ("numero_brinco"). Colunas desconhecidas ficam como estão; se duas
 * colunas apontam para o mesmo campo, vale a primeira que tiver valor.
 */
export function remapHeaders(data: ParsedImport, aliases: Record<string, string>): ParsedImport {
  const target = (h: string) => {
    const n = normalizeHeader(h);
    return aliases[n] ?? n;
  };
  const headers = [...new Set(data.headers.map(target))];
  const rows = data.rows.map((row) => {
    const out: Record<string, string> = {};
    for (const [h, v] of Object.entries(row)) {
      const k = target(h);
      if (out[k] === undefined || (out[k] === '' && v !== '')) out[k] = v;
    }
    return out;
  });
  return { headers, rows };
}

export function parseJSONArray(text: string): ParsedImport {
  const data = JSON.parse(stripBom(text));
  if (!Array.isArray(data)) throw new Error('O arquivo JSON deve conter uma lista de registros.');
  const headers = [...new Set(data.flatMap((r) => Object.keys(r)))] as string[];
  const rows = data.map((r) => {
    const record: Record<string, string> = {};
    for (const h of headers) record[h] = r?.[h] == null ? '' : String(r[h]);
    return record;
  });
  return { headers, rows };
}

export function parseJSONL(text: string): ParsedImport {
  const lines = stripBom(text).split(/\r?\n/).filter((l) => l.trim() !== '');
  const data = lines.map((l) => JSON.parse(l));
  return parseJSONArray(JSON.stringify(data));
}

export const isProbablyJSON = (text: string) => {
  const head = stripBom(text).trimStart();
  return head.startsWith('[') || head.startsWith('{');
};

export const detectAndParse = (fileName: string, text: string): ParsedImport => {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.json') || isProbablyJSON(text)) {
    return stripBom(text).trimStart().startsWith('[') ? parseJSONArray(text) : parseJSONL(text);
  }
  return parseCSV(text, detectDelimiter(text, fileName));
};

export const chunk = <T>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

export const splitInHalf = <T>(items: T[]): [T[], T[]] => {
  const mid = Math.ceil(items.length / 2);
  return [items.slice(0, mid), items.slice(mid)];
};

/** Hash FNV-1a (32 bits) — estável entre reloads (importação retomável). */
export const fnv1a = (input: string): string => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

/**
 * UUID v4 gerado no navegador. Cada linha importada ganha o seu antes de ser enviada:
 * se a resposta do servidor se perder e o lote for reenviado, as linhas que já entraram
 * têm o mesmo id e são ignoradas (ON CONFLICT DO NOTHING) em vez de duplicadas.
 */
export const novoUuid = (): string => {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = Math.floor(Math.random() * 16);
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
};

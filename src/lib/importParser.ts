export type ParsedImport = {
  headers: string[];
  rows: Record<string, string>[];
};

export const stripBom = (text: string) =>
  text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

const TRIM_TRANSLATE: Record<string, string> = {
  ' ': '',
  '-': '_',
  '/': '_',
  '.': '_',
  'ã': 'a',
  'á': 'a',
  'à': 'a',
  'â': 'a',
  'é': 'e',
  'ê': 'e',
  'í': 'i',
  'ó': 'o',
  'ô': 'o',
  'õ': 'o',
  'ú': 'u',
  'ç': 'c',
};

/** Normaliza um cabeçalho para o nome de coluna do banco. */
export const normalizeHeader = (header: string) => {
  const lower = header.trim().toLowerCase();
  let out = '';
  for (const ch of lower) out += TRIM_TRANSLATE[ch] ?? ch;
  return out.replace(/_{2,}/g, '_').replace(/^_|_$/g, '');
};

/**
 * Parser CSV defensivo: aspas duplas, CRLF, campos com quebra de linha,
 * aspas escapadas (""), cabeçalhos e linhas com tamanhos diferentes.
 */
export function parseCSV(text: string, delimiter = ','): ParsedImport {
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
  const delimiter = lower.endsWith('.tsv') || /;\s/.test(text.slice(0, 2000)) ? ';' : ',';
  return parseCSV(text, delimiter);
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
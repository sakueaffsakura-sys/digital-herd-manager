/**
 * Sanitização e validação de texto — lógica pura (testável sem banco).
 * Usada pelo Meu Perfil e pelo Perfil da Propriedade.
 */

export const LIMITES_TEXTO = {
  nome: 150,
  exibicao: 60,
  telefone: 30,
  cargo: 100,
  biografia: 1000,
  descricao: 500,
  email: 120,
  endereco: 200,
  website: 200,
  texto: 2000,
} as const;

export function quitarControles(v: string): string {
  return Array.from(v).filter((c) => {
    const n = c.charCodeAt(0);
    return n !== 127 && (n >= 32 || n === 9 || n === 10 || n === 13);
  }).join("");
}

/** Sanitiza texto de uma única linha: remove tags/HTML, colapsa espaços e trunca. */
export function sanitizarLinha(v: string, max: number): string {
  return quitarControles(v)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** Sanitiza texto multilinha: remove tags/HTML, preserva quebras e trunca. */
export function sanitizarTexto(v: string, max: number): string {
  return quitarControles(v)
    .replace(/<[^>]*>/g, " ")
    .split("\n")
    .map((linha) => linha.replace(/\s+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

export function digitosDeTelefone(v: string): string {
  return quitarControles(v).replace(/\D/g, "");
}

/** Aceita vazio (opcional) ou DDD + 8/9 dígitos (10 a 11 dígitos). */
export function telefoneValido(v: string): boolean {
  const d = digitosDeTelefone(v);
  if (d.length === 0) return true;
  return d.length >= 10 && d.length <= 11;
}

/** Aceita vazio (opcional) ou um e-mail com domínio. */
export function emailValido(v: string): boolean {
  const e = sanitizarLinha(v, LIMITES_TEXTO.email).toLowerCase();
  if (e === "") return true;
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(e);
}

export function normalizarUrl(v: string): string {
  const t = sanitizarLinha(v, LIMITES_TEXTO.website);
  if (!t) return t;
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

/** Aceita vazio (opcional) ou uma URL http(s) válida. */
export function urlValida(v: string): boolean {
  const t = sanitizarLinha(v, LIMITES_TEXTO.website);
  if (!t) return true;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(t) && !/^https?:\/\//i.test(t)) return false;
  try {
    const u = new URL(normalizarUrl(t));
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
/** "1 vaca" / "3 vacas" — escreve o número junto com a palavra no singular ou no plural. */
export function plural(quantidade: number | null | undefined, singular: string, pluralForma?: string): string {
  const n = Number(quantidade ?? 0);
  const palavra = Math.abs(n) === 1 ? singular : (pluralForma ?? `${singular}s`);
  return `${n.toLocaleString("pt-BR")} ${palavra}`;
}

/** Só a palavra, sem o número ("vaca" ou "vacas"). */
export function palavraPlural(quantidade: number | null | undefined, singular: string, pluralForma?: string): string {
  return Math.abs(Number(quantidade ?? 0)) === 1 ? singular : (pluralForma ?? `${singular}s`);
}

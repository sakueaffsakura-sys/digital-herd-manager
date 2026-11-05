// Funções puras das chaves do painel (cifragem AES-GCM e máscara). Sem acesso ao banco.
export const NOMES_CHAVES = ["MERCADOPAGO_ACCESS_TOKEN", "MERCADOPAGO_WEBHOOK_SECRET", "CHAVE_RESGATE"] as const;
export type NomeChave = (typeof NOMES_CHAVES)[number];
export const ehNomeChave = (n: unknown): n is NomeChave => typeof n === "string" && (NOMES_CHAVES as readonly string[]).includes(n);

/** Só os 4 últimos caracteres; chaves curtas não revelam nada. */
export function finalDaChave(valor: string): string {
  return valor.length >= 12 ? valor.slice(-4) : "";
}

const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const deB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function chaveAes(mestra: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(mestra));
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function cifrar(valor: string, mestra: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const c = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await chaveAes(mestra), new TextEncoder().encode(valor));
  return `${b64(iv)}.${b64(new Uint8Array(c))}`;
}

export async function decifrar(texto: string, mestra: string): Promise<string | null> {
  try {
    const [iv, dados] = texto.split(".");
    if (!iv || !dados) return null;
    const p = await crypto.subtle.decrypt({ name: "AES-GCM", iv: deB64(iv) }, await chaveAes(mestra), deB64(dados));
    return new TextDecoder().decode(p);
  } catch {
    return null;
  }
}

/** Comparação em tempo constante. */
export function iguais(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let d = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return d === 0;
}

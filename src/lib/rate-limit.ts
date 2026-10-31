// Limite de requisições em memória por instância do servidor (janela simples).
// Vale só dentro de cada servidor: os caminhos sensíveis (login, cadastro, Yui) usam também o contador
// compartilhado do banco (src/lib/limite-banco.server.ts).
type Bucket = { count: number; reset: number; blockedUntil: number };
const buckets = new Map<string, Bucket>();
const MAX_CHAVES = 50_000;

/** Libera espaço sem zerar tudo: primeiro as chaves vencidas; se ainda faltar, as mais antigas que não estão bloqueadas. */
function podar(now: number) {
  for (const [k, b] of buckets) if (now > b.reset && now >= b.blockedUntil) buckets.delete(k);
  if (buckets.size <= MAX_CHAVES) return;
  let sobrando = buckets.size - Math.floor(MAX_CHAVES * 0.9);
  for (const [k, b] of buckets) {
    if (sobrando <= 0) break;
    if (now < b.blockedUntil) continue;
    buckets.delete(k);
    sobrando--;
  }
}

export function allowRequest(key: string, max: number, windowMs: number, blockMs = 60_000): boolean {
  const now = Date.now();
  if (buckets.size > MAX_CHAVES) podar(now);
  let b = buckets.get(key);
  if (!b || now > b.reset) {
    b = { count: 0, reset: now + windowMs, blockedUntil: b?.blockedUntil ?? 0 };
    buckets.set(key, b);
  }
  if (now < b.blockedUntil) return false;
  b.count++;
  if (b.count > max) {
    b.blockedUntil = now + blockMs;
    return false;
  }
  return true;
}

/**
 * IP de quem chamou. Só o cabeçalho da Cloudflare é confiável: x-forwarded-for e x-real-ip podem ser
 * escritos pelo próprio cliente e serviriam para escapar do limite trocando o "IP" a cada pedido.
 */
export function clientIp(request: Request): string {
  return request.headers.get("cf-connecting-ip")?.trim() || "desconhecido";
}

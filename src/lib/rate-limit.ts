// Limite de requisições em memória por instância do servidor (janela deslizante simples).
type Bucket = { count: number; reset: number; blockedUntil: number };
const buckets = new Map<string, Bucket>();

export function allowRequest(key: string, max: number, windowMs: number, blockMs = 60_000): boolean {
  const now = Date.now();
  if (buckets.size > 50_000) buckets.clear();
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

export function clientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "desconhecido"
  );
}

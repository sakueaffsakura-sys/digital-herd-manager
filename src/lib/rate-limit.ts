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
 * Quantos servidores nossos ficam na frente do site (o servidor web da hospedagem conta como um).
 * Serve para achar o IP verdadeiro sem acreditar no que o cliente escreve. Zero = ninguém na frente.
 */
const proxiesConfiaveis = () => Math.max(0, Math.trunc(Number(process.env["PROXIES_CONFIAVEIS"] ?? "1")) || 0);

/**
 * IP de quem chamou, usado para o limite de requisições.
 *
 * O cliente pode escrever qualquer coisa em x-forwarded-for, então ler o primeiro endereço da lista
 * deixaria qualquer um trocar de "IP" a cada pedido e escapar do limite. Mas o servidor que está na
 * nossa frente *acrescenta* o endereço real no fim da lista. Contando de trás para frente a
 * quantidade de servidores nossos, chega-se ao endereço que o cliente não tem como forjar.
 *
 * Atrás da Cloudflare, o cabeçalho dela resolve direto.
 */
export function clientIp(request: Request): string {
  const cf = request.headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  const nossos = proxiesConfiaveis();
  if (nossos > 0) {
    const lista = (request.headers.get("x-forwarded-for") ?? "").split(",").map((p) => p.trim()).filter(Boolean);
    const ip = lista[lista.length - nossos];
    if (ip) return ip;
  }
  return "desconhecido";
}

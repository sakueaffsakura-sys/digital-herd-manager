/**
 * Sessão de quem entrou.
 *
 * O cookie leva um número sorteado. O banco guarda só o resumo (sha256) desse número.
 * Quem levar uma cópia do banco não consegue entrar com ela, porque do resumo não se
 * volta para o número. É a mesma ideia de guardar senha com hash.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const COOKIE_SESSAO = "pd_sessao";
/** Quanto tempo a sessão dura sem ninguém usar. */
export const DIAS_DE_VALIDADE = 30;

/** Número sorteado que vai no cookie. 32 bytes: não dá para adivinhar. */
export function novoToken(): string {
  return randomBytes(32).toString("base64url");
}

export function resumoDoToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Compara dois resumos sem deixar o tempo da comparação contar quantos caracteres bateram. */
export function resumosIguais(a: string, b: string): boolean {
  const x = Buffer.from(a ?? "", "utf8");
  const y = Buffer.from(b ?? "", "utf8");
  return x.length === y.length && timingSafeEqual(x, y);
}

export function validadeDaSessao(agora = new Date()): Date {
  return new Date(agora.getTime() + DIAS_DE_VALIDADE * 86400_000);
}

/**
 * Cookie da sessão.
 * HttpOnly: o JavaScript da página não lê, então um script injetado não rouba a sessão.
 * Secure: só viaja por HTTPS. SameSite=Lax: não vai junto em pedido vindo de outro site.
 */
export function cookieDaSessao(token: string, agora = new Date()): string {
  const segundos = Math.floor((validadeDaSessao(agora).getTime() - agora.getTime()) / 1000);
  return `${COOKIE_SESSAO}=${token}; Path=/; Max-Age=${segundos}; HttpOnly; Secure; SameSite=Lax`;
}

export function cookieDeSaida(): string {
  return `${COOKIE_SESSAO}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

/** Lê o token do cabeçalho de cookies, sem confundir com outro cookie de nome parecido. */
export function tokenDoPedido(request: Request): string | null {
  const cru = request.headers.get("cookie");
  if (!cru) return null;
  for (const parte of cru.split(";")) {
    const [nome, ...resto] = parte.trim().split("=");
    if (nome === COOKIE_SESSAO) {
      const valor = resto.join("=").trim();
      return valor.length > 0 ? valor : null;
    }
  }
  return null;
}

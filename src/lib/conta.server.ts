// Rotas de servidor da conta (recuperar senha, cadastro, conferir senha, baixar dados).
// Tudo que é sensível passa por aqui com limite de tentativas; o navegador nunca decide sozinho.
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { allowRequest, clientIp } from "./rate-limit";
import { limiteBanco } from "./limite-banco.server";

export const resposta = (status: number, corpo: unknown, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra },
  });
export const falha = (status: number, mensagem: string) => resposta(status, { erro: mensagem });

function env() {
  const url = process.env["SUPABASE_URL"];
  const pub = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !pub) throw new Error("config");
  return { url, pub };
}

/** Cliente com a chave pública; com token, age como a pessoa (as regras de acesso do banco valem). */
export function clienteDoSite(token?: string): SupabaseClient {
  const { url, pub } = env();
  return createClient(url, pub, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (h.get("Authorization") === `Bearer ${pub}`) h.delete("Authorization");
        h.set("apikey", pub);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

/** Confere o token do cabeçalho Authorization e devolve a pessoa (ou a resposta de erro). */
export async function exigirUsuario(request: Request): Promise<{ supabase: SupabaseClient; user: User; token: string } | Response> {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return falha(401, "Entre na sua conta para continuar.");
  const token = auth.slice(7).trim();
  let supabase: SupabaseClient;
  try { supabase = clienteDoSite(token); } catch { return falha(503, "Serviço indisponível no momento."); }
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return falha(401, "Sua sessão expirou. Entre novamente.");
  if (!allowRequest(`conta-user:${data.user.id}`, 60, 60_000, 60_000)) return falha(429, "Muitas tentativas. Espere um minuto.");
  return { supabase, user: data.user, token };
}

/** Limite no banco (vale entre todas as instâncias do servidor) + limite em memória. */
export async function dentroDoLimite(chave: string, max: number, segundos: number): Promise<boolean> {
  if (!allowRequest(`mem:${chave}`, max, segundos * 1000, 60_000)) return false;
  return limiteBanco(chave, max, segundos);
}

export const ipDe = clientIp;

const ORIGENS = [/^https:\/\/(www\.)?boooh\.sbs$/, /^https:\/\/[a-z0-9-]+\.lovable\.app$/, /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/];

/**
 * Endereço do site para links em e-mails. Só aceita os domínios do próprio site; qualquer outro
 * (cabeçalho Host forjado) vira o domínio oficial — o link de senha nunca aponta para fora.
 */
export function origemSegura(request: Request): string {
  try {
    const o = new URL(request.url).origin;
    if (ORIGENS.some((r) => r.test(o))) return o;
  } catch {
    /* endereço inválido */
  }
  return "https://boooh.sbs";
}

export const EMAIL_VALIDO = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;

export async function lerCorpo<T>(request: Request, max = 20_000): Promise<T | null> {
  if (Number(request.headers.get("content-length") ?? 0) > max) return null;
  try {
    const t = await request.text();
    if (t.length > max) return null;
    return JSON.parse(t) as T;
  } catch {
    return null;
  }
}

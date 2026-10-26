// API para aplicativos externos (Android/iOS) e para o app instalado.
// Todas as rotas verificam o token do usuário; o acesso aos dados respeita as regras de cada propriedade.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { allowRequest, clientIp } from "./rate-limit";

export const TABELAS_APP = [
  "animais", "lotes", "tipos_vacinas", "vacinacoes", "inseminacoes", "nascimentos", "pesagens",
  "producao_leite", "anotacoes_producao", "movimentacoes_financeiras", "compras", "vendas", "investimentos",
] as const;
export type TabelaApp = (typeof TABELAS_APP)[number];
export const ehTabelaApp = (t: unknown): t is TabelaApp => typeof t === "string" && (TABELAS_APP as readonly string[]).includes(t);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};

export const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...CORS } });
export const erro = (status: number, mensagem: string) => json(status, { erro: mensagem });
export const preflight = () => new Response(null, { status: 204, headers: CORS });

function env() {
  const url = process.env["SUPABASE_URL"];
  const pub = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !pub) throw new Error("config");
  return { url, pub };
}

export function clientePublico(token?: string): SupabaseClient {
  const { url, pub } = env();
  return createClient(url, pub, {
    auth: { persistSession: false, autoRefreshToken: false },
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

export function limitarIp(request: Request, nome: string, max: number) {
  return allowRequest(`app-${nome}:${clientIp(request)}`, max, 60_000, 60_000);
}

/** Verifica o token e devolve um cliente que age como o usuário. */
export async function autenticar(request: Request): Promise<{ supabase: SupabaseClient; userId: string } | Response> {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return erro(401, "Entre na sua conta para continuar.");
  const token = auth.slice(7).trim();
  let supabase: SupabaseClient;
  try { supabase = clientePublico(token); } catch { return erro(500, "Serviço indisponível no momento."); }
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return erro(401, "Sua sessão expirou. Entre novamente.");
  if (!allowRequest(`app-user:${data.user.id}`, 240, 60_000, 30_000)) return erro(429, "Muitas requisições. Aguarde um minuto.");
  return { supabase, userId: data.user.id };
}

export async function lerJson<T>(request: Request, max = 1_000_000): Promise<T | null> {
  const tam = Number(request.headers.get("content-length") ?? 0);
  if (tam > max) return null;
  try {
    const txt = await request.text();
    if (txt.length > max) return null;
    return JSON.parse(txt) as T;
  } catch { return null; }
}

export const sessaoPublica = (s: { access_token: string; refresh_token: string; expires_at?: number; user: { id: string; email?: string } }) => ({
  access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at ?? null,
  usuario: { id: s.user.id, email: s.user.email ?? null },
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const ehUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

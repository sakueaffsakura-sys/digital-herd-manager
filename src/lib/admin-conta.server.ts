// Bloquear/desbloquear conta e promover/remover administrador, com o efeito também no login (Auth).
// Só administradores (conferido no banco com o token da própria pessoa). A chave service_role fica só aqui no servidor.
import { createClient } from "@supabase/supabase-js";
import { allowRequest } from "./rate-limit";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type RpcSolta = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>;

const resposta = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

export async function handleAdminConta(request: Request): Promise<Response> {
  const url = process.env["SUPABASE_URL"];
  const pub = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !pub) return resposta(500, { erro: "Serviço indisponível no momento." });

  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return resposta(401, { erro: "Entre novamente para continuar." });
  const token = auth.slice(7).trim();
  const sb = createClient(url, pub, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: `Bearer ${token}` },
      fetch: (input, init) => { const h = new Headers(init?.headers); h.set("apikey", pub); return fetch(input, { ...init, headers: h }); },
    },
  });
  const { data: u, error: ue } = await sb.auth.getUser(token);
  if (ue || !u.user) return resposta(401, { erro: "Sua sessão expirou. Entre novamente." });
  if (!allowRequest(`admin-conta:${u.user.id}`, 30, 60_000)) return resposta(429, { erro: "Muitas alterações seguidas. Aguarde um minuto." });

  const rpc = sb.rpc.bind(sb) as unknown as RpcSolta;
  const admin = await rpc("sou_admin");
  if (admin.error || admin.data !== true) return resposta(403, { erro: "Somente administradores podem fazer isso." });

  let corpo: { user_id?: unknown; bloqueado?: unknown; admin?: unknown };
  try { corpo = (await request.json()) as typeof corpo; } catch { return resposta(400, { erro: "Pedido inválido." }); }
  const alvo = corpo.user_id;
  if (typeof alvo !== "string" || !UUID.test(alvo)) return resposta(400, { erro: "Conta inválida." });
  const bloqueado = typeof corpo.bloqueado === "boolean" ? corpo.bloqueado : null;
  const tornarAdmin = typeof corpo.admin === "boolean" ? corpo.admin : null;
  if (bloqueado === null && tornarAdmin === null) return resposta(400, { erro: "Nada para alterar." });

  // A RPC confere de novo que quem chama é administrador e impede bloquear/rebaixar a si mesmo.
  const r = await rpc("admin_definir_conta", { _user_id: alvo, _bloqueado: bloqueado, _admin: tornarAdmin });
  if (r.error) return resposta(400, { erro: r.error.message ?? "Não foi possível alterar a conta." });

  if (bloqueado !== null) {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      // Bane no Auth: a conta não entra nem renova a sessão. O acesso aos dados já foi cortado pelo banco acima.
      const { error } = await supabaseAdmin.auth.admin.updateUserById(alvo, { ban_duration: bloqueado ? "876000h" : "none" });
      if (error) throw error;
    } catch (e) {
      console.error("admin/conta: falha ao atualizar o login", e);
      return resposta(207, {
        ok: false,
        parcial: true,
        erro: bloqueado
          ? "A conta foi bloqueada no sistema, mas o login não pôde ser travado agora. Tente de novo."
          : "A conta foi desbloqueada no sistema, mas o login continua travado. Tente de novo.",
      });
    }
  }
  return resposta(200, { ok: true });
}

/** Chamada do painel admin (usa o token da sessão atual). */
export type RespostaAdminConta = { ok?: boolean; erro?: string; parcial?: boolean };

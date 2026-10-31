// Exclusão de conta pelo administrador: atende um pedido (LGPD) ou exclui direto pela aba Contas.
// Nos dois casos o servidor também apaga as fotos da pessoa e das propriedades dela.
import type { SupabaseClient } from "@supabase/supabase-js";
import { allowRequest } from "./rate-limit";
import { clienteDoSite, falha, lerCorpo, resposta } from "./conta.server";

type RpcSolta = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function apagarPasta(sb: SupabaseClient, balde: string, pasta: string) {
  const { data } = await sb.storage.from(balde).list(pasta, { limit: 1000 });
  const nomes = (data ?? []).map((f) => `${pasta}/${f.name}`);
  if (nomes.length) await sb.storage.from(balde).remove(nomes);
  return nomes.length;
}

export async function handleConcluirExclusao(request: Request) {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return falha(401, "Entre na sua conta.");
  const token = auth.slice(7).trim();
  const usuario = clienteDoSite(token);
  const { data: u } = await usuario.auth.getUser(token);
  if (!u.user) return falha(401, "Sessão expirada.");
  if (!allowRequest(`admin-exclusao:${u.user.id}`, 20, 60_000, 60_000)) return falha(429, "Muitas ações seguidas. Espere um minuto.");
  const rpc = usuario.rpc.bind(usuario) as unknown as RpcSolta;
  if ((await rpc("sou_admin")).data !== true) return falha(403, "Só administradores.");

  const corpo = await lerCorpo<{ id?: unknown; user_id?: unknown }>(request, 1000);
  const pedidoId = typeof corpo?.id === "string" && UUID.test(corpo.id) ? corpo.id : null;
  const direto = typeof corpo?.user_id === "string" && UUID.test(corpo.user_id) ? corpo.user_id : null;
  if (!pedidoId && !direto) return falha(400, "Pedido inválido.");

  let alvo: string;
  if (pedidoId) {
    // O administrador lê o pedido com as regras de acesso dele.
    const pedido = await usuario.from("solicitacoes_exclusao").select("id,user_id,status").eq("id", pedidoId).maybeSingle();
    const p = pedido.data as { id: string; user_id: string; status: string } | null;
    if (!p || p.status !== "pendente") return falha(404, "Pedido não encontrado ou já atendido.");
    alvo = p.user_id;
  } else {
    alvo = direto!;
  }
  if (alvo === u.user.id) return falha(400, "Você não pode excluir a própria conta por aqui.");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const sb = supabaseAdmin as unknown as SupabaseClient;
  // Guarda as propriedades antes: depois da exclusão não há mais como achar as pastas das fotos.
  const props = await sb.from("propriedades").select("id").eq("proprietario_id", alvo);
  const propIds = ((props.data ?? []) as { id: string }[]).map((p) => p.id);

  // O banco confere de novo se quem pede é administrador e se a conta alvo não é de administrador.
  const r = pedidoId ? await rpc("admin_concluir_exclusao", { _id: pedidoId }) : await rpc("admin_excluir_conta", { _user_id: alvo });
  if (r.error) return falha(400, r.error.message || "Não foi possível excluir a conta.");

  let arquivos = 0;
  try {
    arquivos += await apagarPasta(sb, "profile-avatars", alvo);
    for (const id of propIds) {
      for (const balde of ["property-logos", "property-banners", "property-images"]) arquivos += await apagarPasta(sb, balde, id);
    }
  } catch (e) {
    console.error("exclusão: arquivos", e);
  }
  try { await sb.auth.admin.deleteUser(alvo); } catch { /* a conta já foi apagada pelo banco */ }
  return resposta(200, { ok: true, arquivos, resultado: r.data });
}

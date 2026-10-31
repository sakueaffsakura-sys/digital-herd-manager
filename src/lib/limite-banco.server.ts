// Contador de limite guardado no banco (public.checar_limite): vale entre todos os servidores,
// ao contrário do limite em memória. Só roda no servidor, com a chave service_role.
type RpcSolta = (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;

/**
 * true = pode seguir. Se o banco não responder, deixa passar (o limite em memória continua valendo):
 * uma falha do contador não pode tirar o login do ar.
 */
export async function limiteBanco(chave: string, max: number, segundos: number): Promise<boolean> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rpc = supabaseAdmin.rpc.bind(supabaseAdmin) as unknown as RpcSolta;
    const { data, error } = await rpc("checar_limite", { _chave: chave.slice(0, 200), _max: max, _segundos: segundos });
    if (error) {
      console.error("limiteBanco: falha no contador", error);
      return true;
    }
    return data !== false;
  } catch (e) {
    console.error("limiteBanco: falha no contador", e);
    return true;
  }
}

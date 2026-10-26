import { createFileRoute } from "@tanstack/react-router";
import { autenticar, erro, json, preflight } from "@/lib/app-api.server";

// GET → dados do usuário e propriedades a que ele tem acesso.
export const Route = createFileRoute("/api/public/app/eu")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const a = await autenticar(request);
        if (a instanceof Response) return a;
        const [perfil, props] = await Promise.all([
          a.supabase.from("profiles").select("nome_completo, nome_exibicao, avatar_url, bloqueado").eq("id", a.userId).maybeSingle(),
          a.supabase.from("propriedades").select("id, nome, cidade, estado, periodo_gestacao_dias, ativo").order("nome"),
        ]);
        if (props.error) return erro(500, "Não foi possível carregar suas propriedades.");
        if (perfil.data?.bloqueado) return erro(403, "Esta conta está bloqueada.");
        return json(200, { usuario_id: a.userId, perfil: perfil.data ?? null, propriedades: props.data ?? [] });
      },
    },
  },
});

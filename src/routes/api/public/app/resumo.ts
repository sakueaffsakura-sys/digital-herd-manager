import { createFileRoute } from "@tanstack/react-router";
import { autenticar, ehUuid, erro, json, preflight } from "@/lib/app-api.server";

// GET ?propriedade_id=... → mesmo resumo da tela Início.
export const Route = createFileRoute("/api/public/app/resumo")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const a = await autenticar(request);
        if (a instanceof Response) return a;
        const prop = new URL(request.url).searchParams.get("propriedade_id");
        if (!ehUuid(prop)) return erro(400, "propriedade_id inválido.");
        const { data, error } = await a.supabase.rpc("dashboard_resumo", { _propriedade_id: prop } as never);
        if (error) return erro(400, "Não foi possível carregar o resumo.");
        return json(200, data);
      },
    },
  },
});

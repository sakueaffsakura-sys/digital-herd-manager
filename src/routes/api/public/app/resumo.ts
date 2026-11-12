import { createFileRoute } from "@tanstack/react-router";
import { autenticar, ehUuid, erro, json, preflight } from "@/lib/app-api.server";
import { BANCO_NOVO } from "@/lib/dados";
import { quemNoApp } from "@/lib/app-api-novo.server";
import { rodarConsulta } from "@/lib/dados/consultas.server";
import { AcessoNegado } from "@/lib/dados/acesso";

// GET ?propriedade_id=... → mesmo resumo da tela Início.
export const Route = createFileRoute("/api/public/app/resumo")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const prop = new URL(request.url).searchParams.get("propriedade_id");
        if (!ehUuid(prop)) return erro(400, "propriedade_id inválido.");

        // O aplicativo lê o mesmo resumo das telas: um cálculo só, num lugar só.
        if (BANCO_NOVO) {
          const quem = await quemNoApp(request);
          if (!quem) return erro(401, "Sessão expirada. Entre novamente.");
          try {
            return json(200, await rodarConsulta("dashboard_resumo", quem, { propriedade_id: prop }));
          } catch (e) {
            if (e instanceof AcessoNegado) return erro(403, e.message);
            console.error("Falha no resumo do aplicativo", e);
            return erro(500, "Não foi possível carregar o resumo.");
          }
        }

        const a = await autenticar(request);
        if (a instanceof Response) return a;
        const { data, error } = await a.supabase.rpc("dashboard_resumo", { _propriedade_id: prop } as never);
        if (error) return erro(400, "Não foi possível carregar o resumo.");
        return json(200, data);
      },
    },
  },
});

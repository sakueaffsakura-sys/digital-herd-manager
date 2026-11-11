import { createFileRoute } from "@tanstack/react-router";
import { resposta } from "@/lib/conta.server";
import { sair } from "@/lib/conta/login.server";

// POST — encerra a sessão deste navegador. Não recusa quem já estava fora: sair tem de
// funcionar sempre, inclusive com a sessão já vencida.
export const Route = createFileRoute("/api/conta/sair")({
  server: {
    handlers: {
      POST: async ({ request }) => resposta(200, { ok: true }, { "set-cookie": await sair(request) }),
    },
  },
});

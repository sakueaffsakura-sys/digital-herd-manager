import { createFileRoute } from "@tanstack/react-router";
import { handleDados, preflight } from "@/lib/dados/api.server";

// POST — a porta única por onde as telas e o aplicativo leem e gravam dados no MySQL.
// Quem está pedindo sai da sessão (cookie no site, token no aplicativo); o que o cliente
// manda sobre quem ele é não tem efeito nenhum.
export const Route = createFileRoute("/api/dados")({
  server: {
    handlers: {
      // O aplicativo Android é outra origem: o navegador pergunta antes de mandar.
      OPTIONS: () => preflight(),
      POST: ({ request }) => handleDados(request),
    },
  },
});

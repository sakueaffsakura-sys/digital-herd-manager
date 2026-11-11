import { createFileRoute } from "@tanstack/react-router";
import { handleDados } from "@/lib/dados/api.server";

// POST — a porta única por onde as telas leem e gravam dados no MySQL.
// Quem está pedindo sai da sessão; o que o navegador manda é sempre conferido de novo.
export const Route = createFileRoute("/api/dados")({
  server: { handlers: { POST: ({ request }) => handleDados(request) } },
});

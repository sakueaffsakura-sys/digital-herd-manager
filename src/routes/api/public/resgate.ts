import { createFileRoute } from "@tanstack/react-router";
import { handleResgate } from "@/lib/chaves.server";

// Público de propósito: a chave de resgate é a autorização (tempo constante, limite por IP, registro).
export const Route = createFileRoute("/api/public/resgate")({
  server: { handlers: { POST: ({ request }) => handleResgate(request) } },
});

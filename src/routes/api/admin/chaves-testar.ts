import { createFileRoute } from "@tanstack/react-router";
import { handleTestarMercadoPago } from "@/lib/chaves.server";

export const Route = createFileRoute("/api/admin/chaves-testar")({
  server: { handlers: { POST: ({ request }) => handleTestarMercadoPago(request) } },
});

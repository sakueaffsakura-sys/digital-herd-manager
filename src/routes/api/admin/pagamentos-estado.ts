import { createFileRoute } from "@tanstack/react-router";
import { handleEstadoPagamentos } from "@/lib/assinatura.server";

// GET → { token, segredo, url_aviso }: se os segredos do Mercado Pago existem (nunca os valores). Só administradores.
export const Route = createFileRoute("/api/admin/pagamentos-estado")({
  server: { handlers: { GET: ({ request }) => handleEstadoPagamentos(request) } },
});

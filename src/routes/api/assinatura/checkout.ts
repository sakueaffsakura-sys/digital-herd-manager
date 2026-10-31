import { createFileRoute } from "@tanstack/react-router";
import { handleCheckout } from "@/lib/assinatura.server";

// POST { plano_id, propriedade_id } → { url } do pagamento no Mercado Pago (preço vem do banco).
export const Route = createFileRoute("/api/assinatura/checkout")({
  server: { handlers: { POST: ({ request }) => handleCheckout(request) } },
});

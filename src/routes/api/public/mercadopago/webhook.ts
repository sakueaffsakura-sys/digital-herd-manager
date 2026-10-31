import { createFileRoute } from "@tanstack/react-router";
import { handleWebhook } from "@/lib/assinatura.server";

// Aviso de pagamento do Mercado Pago (assinatura x-signature conferida antes de qualquer coisa).
export const Route = createFileRoute("/api/public/mercadopago/webhook")({
  server: { handlers: { POST: ({ request }) => handleWebhook(request) } },
});

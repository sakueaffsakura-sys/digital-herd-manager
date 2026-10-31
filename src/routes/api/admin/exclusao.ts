import { createFileRoute } from "@tanstack/react-router";
import { handleConcluirExclusao } from "@/lib/admin-exclusao.server";

// POST { id } atende um pedido de exclusão (LGPD); POST { user_id } exclui direto pela aba Contas. Só administradores.
export const Route = createFileRoute("/api/admin/exclusao")({
  server: { handlers: { POST: ({ request }) => handleConcluirExclusao(request) } },
});

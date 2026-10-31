import { createFileRoute } from "@tanstack/react-router";
import { handleAdminConta } from "@/lib/admin-conta.server";

// POST { user_id, bloqueado?, admin? } — só administradores. Bloquear também trava o login no Auth.
export const Route = createFileRoute("/api/admin/conta")({
  server: { handlers: { POST: ({ request }) => handleAdminConta(request) } },
});

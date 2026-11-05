import { createFileRoute } from "@tanstack/react-router";
import { handleListarChaves, handleSalvarChave } from "@/lib/chaves.server";

// Só administradores: lista (sem valores) e salva/apaga chaves.
export const Route = createFileRoute("/api/admin/chaves")({
  server: { handlers: { GET: ({ request }) => handleListarChaves(request), POST: ({ request }) => handleSalvarChave(request) } },
});

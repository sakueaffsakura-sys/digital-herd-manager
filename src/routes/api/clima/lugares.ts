import { createFileRoute } from "@tanstack/react-router";
import { handleLugares } from "@/lib/clima.server";

// GET ?nome= — procura a cidade e devolve as coordenadas.
export const Route = createFileRoute("/api/clima/lugares")({
  server: { handlers: { GET: ({ request }) => handleLugares(request) } },
});

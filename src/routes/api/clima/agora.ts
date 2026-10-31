import { createFileRoute } from "@tanstack/react-router";
import { handleClima } from "@/lib/clima.server";

// GET ?lat=&lon= — tempo de agora e dos próximos 7 dias (Open-Meteo, guardado por 1 hora).
export const Route = createFileRoute("/api/clima/agora")({
  server: { handlers: { GET: ({ request }) => handleClima(request) } },
});

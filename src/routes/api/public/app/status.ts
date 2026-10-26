import { createFileRoute } from "@tanstack/react-router";
import { json, preflight, TABELAS_APP } from "@/lib/app-api.server";

// Informações públicas para o aplicativo saber se o servidor está no ar.
export const Route = createFileRoute("/api/public/app/status")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: () => json(200, { ok: true, versao_api: 1, hora_servidor: new Date().toISOString(), tabelas: TABELAS_APP }),
    },
  },
});

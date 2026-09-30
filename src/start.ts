import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { allowRequest, clientIp } from "./lib/rate-limit";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const MAX_BODY_BYTES = 2 * 1024 * 1024;

// Proteção contra abuso (DoS/DDoS): rajada curta + limite por minuto por IP,
// tamanho máximo de envio, registro de eventos para o painel admin e cabeçalhos de segurança.
const protectionMiddleware = createMiddleware().server(async ({ next, request }) => {
  const ip = clientIp(request);
  const url = new URL(request.url);
  const caminho = url.pathname.slice(0, 120);
  const { registrarEvento, contarRequisicao } = await import("./lib/security-events.server");
  contarRequisicao(ip, caminho);
  const isFn = url.pathname.startsWith("/_serverFn") || url.pathname.startsWith("/api/");
  const rajadaOk = allowRequest(`burst:${ip}`, isFn ? 30 : 60, 5_000, 180_000);
  const ok = rajadaOk && (isFn ? allowRequest(`fn:${ip}`, 120, 60_000, 120_000) : allowRequest(`pg:${ip}`, 300, 60_000));
  if (!ok) {
    registrarEvento({ tipo: rajadaOk ? "limite_minuto" : "rajada", severidade: rajadaOk ? "aviso" : "critico", ip, caminho, detalhe: rajadaOk ? "Excedeu o limite de requisições por minuto." : "Rajada de requisições em poucos segundos (padrão de ataque)." });
    return new Response("Muitas requisições. Tente novamente em instantes.", {
      status: 429,
      headers: { "retry-after": "120", "content-type": "text/plain; charset=utf-8" },
    });
  }
  const len = Number(request.headers.get("content-length") ?? 0);
  if (len > MAX_BODY_BYTES) {
    registrarEvento({ tipo: "envio_grande", severidade: "aviso", ip, caminho, detalhe: `Envio de ${Math.round(len / 1024)} KB recusado.` });
    return new Response("Envio muito grande.", { status: 413 });
  }

  const result = await next();
  const res = (result as { response?: Response }).response;
  if (res?.headers) {
    try {
      res.headers.set("X-Content-Type-Options", "nosniff");
      res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
      res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)");
      res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    } catch {
      /* cabeçalhos imutáveis */
    }
  }
  return result;
});

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [protectionMiddleware, errorMiddleware, csrfMiddleware],
}));

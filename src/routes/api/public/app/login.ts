import { createFileRoute } from "@tanstack/react-router";
import { clientePublico, erro, json, lerJson, limitarIp, preflight, sessaoPublica } from "@/lib/app-api.server";

// POST { email, senha } → sessão. POST { refresh_token } → renova a sessão.
export const Route = createFileRoute("/api/public/app/login")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      POST: async ({ request }) => {
        if (!limitarIp(request, "login", 10)) return erro(429, "Muitas tentativas. Aguarde um minuto.");
        const body = await lerJson<{ email?: string; senha?: string; refresh_token?: string }>(request, 4096);
        if (!body) return erro(400, "Pedido inválido.");
        const sb = clientePublico();
        if (typeof body.refresh_token === "string" && body.refresh_token) {
          const { data, error } = await sb.auth.refreshSession({ refresh_token: body.refresh_token });
          if (error || !data.session) return erro(401, "Sessão expirada. Entre novamente.");
          return json(200, sessaoPublica(data.session));
        }
        const email = typeof body.email === "string" ? body.email.trim() : "";
        const senha = typeof body.senha === "string" ? body.senha : "";
        if (!email || !senha) return erro(400, "Informe e-mail e senha.");
        const { data, error } = await sb.auth.signInWithPassword({ email, password: senha });
        if (error || !data.session) return erro(401, "E-mail ou senha incorretos.");
        return json(200, sessaoPublica(data.session));
      },
    },
  },
});

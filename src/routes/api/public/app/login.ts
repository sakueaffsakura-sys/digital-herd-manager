import { createFileRoute } from "@tanstack/react-router";
import { clientePublico, contaBloqueada, erro, json, lerJson, limitarIp, preflight, sessaoPublica } from "@/lib/app-api.server";
import { limiteBanco } from "@/lib/limite-banco.server";
import { clientIp } from "@/lib/rate-limit";

const MUITAS = "Muitas tentativas. Aguarde alguns minutos.";

// POST { email, senha, codigo? } → sessão (codigo = 6 números, só para conta com duas etapas).
// POST { refresh_token } → renova a sessão.
export const Route = createFileRoute("/api/public/app/login")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      POST: async ({ request }) => {
        const ip = clientIp(request);
        // Limite em memória (rápido) + no banco (vale entre servidores).
        if (!limitarIp(request, "login", 10)) return erro(429, MUITAS);
        const body = await lerJson<{ email?: string; senha?: string; refresh_token?: string; codigo?: string }>(request, 4096);
        if (!body) return erro(400, "Pedido inválido.");
        const sb = clientePublico();
        if (typeof body.refresh_token === "string" && body.refresh_token) {
          if (!(await limiteBanco(`app-renovar-ip:${ip}`, 120, 600))) return erro(429, MUITAS);
          const { data, error } = await sb.auth.refreshSession({ refresh_token: body.refresh_token });
          if (error || !data.session) return erro(401, "Sessão expirada. Entre novamente.");
          if (await contaBloqueada(clientePublico(data.session.access_token))) return erro(403, "Esta conta está bloqueada.");
          return json(200, sessaoPublica(data.session));
        }
        const email = typeof body.email === "string" ? body.email.trim() : "";
        const senha = typeof body.senha === "string" ? body.senha : "";
        if (!email || !senha) return erro(400, "Informe e-mail e senha.");
        if (!(await limiteBanco(`app-login-ip:${ip}`, 30, 600)) || !(await limiteBanco(`app-login-email:${email.toLowerCase()}`, 10, 900))) {
          return erro(429, MUITAS);
        }
        const { data, error } = await sb.auth.signInWithPassword({ email, password: senha });
        if (error || !data.session) return erro(401, "E-mail ou senha incorretos.");
        if (await contaBloqueada(clientePublico(data.session.access_token))) return erro(403, "Esta conta está bloqueada.");
        // Conta com verificação em duas etapas: a sessão só vale depois do código do aplicativo autenticador.
        const fator = data.user.factors?.find((f) => f.factor_type === "totp" && f.status === "verified");
        if (fator) {
          const codigo = typeof body.codigo === "string" ? body.codigo.replace(/\D/g, "") : "";
          if (codigo.length !== 6) {
            await sb.auth.signOut({ scope: "local" }).catch(() => {});
            return json(401, { erro: "Esta conta usa verificação em duas etapas. Digite o código do aplicativo autenticador.", precisa_codigo: true });
          }
          const v = await sb.auth.mfa.challengeAndVerify({ factorId: fator.id, code: codigo });
          const sessao = v.error ? null : (await sb.auth.getSession()).data.session;
          if (!sessao) {
            await sb.auth.signOut({ scope: "local" }).catch(() => {});
            return json(401, { erro: "Código errado ou vencido.", precisa_codigo: true });
          }
          return json(200, sessaoPublica(sessao));
        }
        return json(200, sessaoPublica(data.session));
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import { clienteDoSite, dentroDoLimite, exigirUsuario, falha, ipDe, lerCorpo, resposta } from "@/lib/conta.server";

// POST { senha } — confere a senha atual antes de trocar, sem trocar a sessão do navegador.
export const Route = createFileRoute("/api/conta/conferir-senha")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const u = await exigirUsuario(request);
        if (u instanceof Response) return u;
        const corpo = await lerCorpo<{ senha?: unknown }>(request);
        const senha = typeof corpo?.senha === "string" ? corpo.senha : "";
        if (!senha || senha.length > 72) return falha(400, "Digite a senha atual.");
        if (!(await dentroDoLimite(`conf-senha:${u.user.id}`, 5, 900)) || !(await dentroDoLimite(`conf-senha-ip:${ipDe(request)}`, 20, 3600))) {
          return falha(429, "Muitas tentativas. Espere 15 minutos.");
        }
        if (!u.user.email) return falha(400, "Esta conta não tem e-mail com senha.");
        const teste = clienteDoSite();
        const { data, error } = await teste.auth.signInWithPassword({ email: u.user.email, password: senha });
        if (error || !data.session) return falha(401, "A senha atual não confere.");
        // A sessão criada só para conferir é encerrada na hora.
        await teste.auth.signOut({ scope: "local" }).catch(() => {});
        return resposta(200, { ok: true });
      },
    },
  },
});

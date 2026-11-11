import { createFileRoute } from "@tanstack/react-router";
import { dentroDoLimite, falha, ipDe, lerCorpo, resposta } from "@/lib/conta.server";
import { abrirSessao } from "@/lib/conta/login.server";
import { LinkInvalido, trocarSenhaComLink } from "@/lib/conta/recuperacao.server";

// POST { token, senha } — troca a senha usando o link do e-mail e já entra no site.
//
// Entrar na hora é de propósito: quem acabou de provar que tem o e-mail da conta e
// escolheu uma senha nova não precisa digitá-la de novo na tela seguinte.
export const Route = createFileRoute("/api/conta/redefinir")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const corpo = await lerCorpo<{ token?: unknown; senha?: unknown }>(request);
        const token = typeof corpo?.token === "string" ? corpo.token : "";
        const senha = typeof corpo?.senha === "string" ? corpo.senha : "";
        if (!token || !senha) return falha(400, "Abra o link do e-mail e escolha a senha nova.");
        if (!(await dentroDoLimite(`redefinir-ip:${ipDe(request)}`, 20, 3600))) {
          return falha(429, "Muitas tentativas. Espere uma hora.");
        }
        try {
          const { userId } = await trocarSenhaComLink(token, senha);
          const { cookie } = await abrirSessao(request, userId);
          return resposta(200, { ok: true }, { "set-cookie": cookie });
        } catch (erro) {
          if (erro instanceof LinkInvalido) return falha(400, erro.message);
          if (erro instanceof Error) return falha(400, erro.message);
          throw erro;
        }
      },
    },
  },
});

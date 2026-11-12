import { createFileRoute } from "@tanstack/react-router";
import { dentroDoLimite, falha, ipDe, lerCorpo, origemSegura, resposta, EMAIL_VALIDO } from "@/lib/conta.server";
import { pedirRecuperacao } from "@/lib/conta/recuperacao.server";

// POST { email } — manda o link de troca de senha.
//
// Responde 200 sempre, mesmo sem conta, sem e-mail configurado ou com erro no envio: a
// resposta não pode dizer quem tem conta aqui. O que falhou de verdade vai para o registro
// do servidor, onde só o administrador vê.
export const Route = createFileRoute("/api/conta/recuperar")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const corpo = await lerCorpo<{ email?: unknown }>(request);
        const email = typeof corpo?.email === "string" ? corpo.email.trim().toLowerCase() : "";
        if (!EMAIL_VALIDO.test(email)) return falha(400, "Confira o e-mail.");
        // Limite pelo endereço de quem pede, para o site não virar ferramenta de despejo
        // de e-mail na caixa de outra pessoa.
        if (!(await dentroDoLimite(`recuperar-ip:${ipDe(request)}`, 10, 3600))) {
          return falha(429, "Muitos pedidos. Espere uma hora.");
        }
        try {
          await pedirRecuperacao(email, origemSegura(request));
        } catch (erro) {
          console.error("Falha ao mandar o link de senha", erro);
        }
        return resposta(200, { ok: true });
      },
    },
  },
});

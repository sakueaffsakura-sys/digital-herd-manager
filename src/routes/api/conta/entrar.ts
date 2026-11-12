import { createFileRoute } from "@tanstack/react-router";
import { dentroDoLimite, falha, ipDe, lerCorpo, resposta, EMAIL_VALIDO } from "@/lib/conta.server";
import { entrar, EntradaBloqueada, EntradaRecusada } from "@/lib/conta/login.server";

// POST { email, senha } — entra no site e devolve o cookie da sessão.
//
// A mensagem de recusa é a mesma para e-mail que não existe e para senha errada: dizer
// qual dos dois errou entrega quem tem conta aqui. O limite é por e-mail E por IP — só
// por e-mail, uma lista de e-mails passa pelo limite; só por IP, um atacante com vários
// endereços passa.
export const Route = createFileRoute("/api/conta/entrar")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const corpo = await lerCorpo<{ email?: unknown; senha?: unknown }>(request);
        const email = typeof corpo?.email === "string" ? corpo.email.trim().toLowerCase() : "";
        const senha = typeof corpo?.senha === "string" ? corpo.senha : "";
        if (!EMAIL_VALIDO.test(email) || !senha || senha.length > 200) {
          return falha(400, "Confira o e-mail e a senha.");
        }
        if (!(await dentroDoLimite(`entrar:${email}`, 8, 900)) || !(await dentroDoLimite(`entrar-ip:${ipDe(request)}`, 30, 900))) {
          return falha(429, "Muitas tentativas. Espere 15 minutos.");
        }
        try {
          const { cookie } = await entrar(request, email, senha);
          return resposta(200, { ok: true }, { "set-cookie": cookie });
        } catch (erro) {
          if (erro instanceof EntradaBloqueada) return falha(403, erro.message);
          if (erro instanceof EntradaRecusada) return falha(401, erro.message);
          throw erro;
        }
      },
    },
  },
});

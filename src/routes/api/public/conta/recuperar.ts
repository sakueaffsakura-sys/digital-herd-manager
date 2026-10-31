import { createFileRoute } from "@tanstack/react-router";
import { clienteDoSite, dentroDoLimite, EMAIL_VALIDO, falha, ipDe, lerCorpo, origemSegura, resposta } from "@/lib/conta.server";

// Mesma resposta exista ou não a conta: ninguém descobre quem tem cadastro por aqui.
const GENERICA = "Se houver uma conta com este e-mail, enviamos um link para criar uma nova senha. Confira também o spam.";

// POST { email } — envia o link de nova senha (3 pedidos por hora por e-mail, 10 por hora por endereço de rede).
export const Route = createFileRoute("/api/public/conta/recuperar")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const corpo = await lerCorpo<{ email?: unknown }>(request);
        const email = typeof corpo?.email === "string" ? corpo.email.trim().toLowerCase() : "";
        if (!EMAIL_VALIDO.test(email)) return falha(400, "Digite um e-mail válido.");
        const ip = ipDe(request);
        if (!(await dentroDoLimite(`rec-ip:${ip}`, 10, 3600))) return falha(429, "Muitos pedidos deste aparelho. Tente de novo daqui a uma hora.");
        // Passou do limite do e-mail: responde igual, sem enviar (não revela nada e não lota a caixa da pessoa).
        if (!(await dentroDoLimite(`rec-email:${email}`, 3, 3600))) return resposta(200, { mensagem: GENERICA });
        try {
          const { error } = await clienteDoSite().auth.resetPasswordForEmail(email, { redirectTo: `${origemSegura(request)}/redefinir-senha` });
          if (error && !/not found|user/i.test(error.message)) console.error("recuperar senha:", error.message);
        } catch (e) {
          console.error("recuperar senha:", e);
        }
        return resposta(200, { mensagem: GENERICA });
      },
    },
  },
});

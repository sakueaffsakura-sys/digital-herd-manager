import { createFileRoute } from "@tanstack/react-router";
import { falha, resposta } from "@/lib/conta.server";
import { quemEsta } from "@/lib/conta/login.server";
import { consultarUm } from "@/lib/dados/banco.server";
import { cunharToken } from "@/lib/conta/token-curto";
import { talvezFaxinar } from "@/lib/conta/faxina.server";

/**
 * GET — quem está nesta sessão, e um token curto para as telas usarem como Bearer.
 *
 * O formato imita o do cliente antigo (`{ user: { id, email } }`) para as telas trocarem
 * só a linha do import. O `access_token` aqui não é o valor do cookie: é um token separado
 * de cinco minutos, que não renova sozinho — pedir outro exige o cookie, e o cookie o
 * script da página não lê.
 */
export const Route = createFileRoute("/api/conta/eu")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const quem = await quemEsta(request);
        if (!quem) return falha(401, "Sessão encerrada.");
        const pessoa = await consultarUm<{ email: string; criado_em: Date | string }>(
          "SELECT email, criado_em FROM usuarios WHERE id = ?",
          [quem.userId],
        );
        const { token, expiraEm } = cunharToken(quem.userId);
        // De vez em quando (um pedido em quinhentos), limpa sessão vencida e link usado.
        // Não espera: a faxina acontece atrás, e quem pediu não é atrasado por ela.
        talvezFaxinar();
        return resposta(200, {
          user: {
            id: quem.userId,
            email: pessoa?.email ?? null,
            created_at: pessoa?.criado_em ? new Date(pessoa.criado_em).toISOString() : null,
          },
          // Vai junto porque a tela já sabe o que fazer com cada um, e assim ela não
          // precisa de uma segunda ida ao servidor para montar o estado inicial.
          admin: quem.admin,
          propriedades: quem.propriedades,
          aal: quem.aal ?? "aal1",
          access_token: token,
          expires_at: expiraEm,
        });
      },
    },
  },
});

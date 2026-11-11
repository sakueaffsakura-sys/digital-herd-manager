import { createFileRoute } from "@tanstack/react-router";
import { falha, lerCorpo, resposta } from "@/lib/conta.server";
import { derrubarOutrasSessoes, quemEsta, sair } from "@/lib/conta/login.server";
import { tokenDoPedido } from "@/lib/conta/sessao";

/**
 * POST — encerra a sessão deste navegador, ou só as outras.
 *
 * `{ escopo: "outras" }` derruba os outros aparelhos e mantém este: é o que a tela chama
 * depois de trocar a senha, para quem tenha entrado antes sair sem a pessoa se deslogar da
 * tela em que está.
 *
 * Sair não recusa quem já estava fora: tem de funcionar sempre, inclusive com a sessão já
 * vencida.
 */
export const Route = createFileRoute("/api/conta/sair")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const corpo = await lerCorpo<{ escopo?: unknown }>(request);
        if (corpo?.escopo === "outras") {
          const quem = await quemEsta(request);
          if (!quem) return falha(401, "Entre na sua conta.");
          const quantas = await derrubarOutrasSessoes(quem.userId, tokenDoPedido(request));
          return resposta(200, { ok: true, encerradas: quantas });
        }
        return resposta(200, { ok: true }, { "set-cookie": await sair(request) });
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import { dentroDoLimite, ipDe, origemSegura } from "@/lib/conta.server";
import { cookieDoEstadoVencido, GoogleNaoConfigurado, GoogleRecusado, terminarEntradaGoogle } from "@/lib/conta/google.server";

/**
 * GET ?code&state — a volta do Google.
 *
 * Responde sempre com um desvio para uma tela, nunca com JSON: quem chega aqui é o
 * navegador da pessoa saindo do Google, e ela precisa ver uma página. O que deu errado vai
 * na barra de endereço como motivo curto, e o detalhe fica no registro do servidor.
 */
export const Route = createFileRoute("/api/conta/google/retorno")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const site = origemSegura(request);
        const desvio = (caminho: string, cookies: string[]) =>
          new Response(null, {
            status: 302,
            // O cookie do `state` é apagado nos dois casos: ele já cumpriu a função.
            headers: [["location", `${site}${caminho}`], ...cookies.map((c) => ["set-cookie", c] as [string, string])],
          });

        const url = new URL(request.url);
        // O Google manda `error` quando a pessoa fecha a tela ou nega o acesso. Não é falha.
        if (url.searchParams.get("error")) return desvio("/entrar", [cookieDoEstadoVencido()]);
        if (!(await dentroDoLimite(`google-ip:${ipDe(request)}`, 20, 900))) {
          return desvio("/entrar?erro=espere", [cookieDoEstadoVencido()]);
        }
        try {
          const { cookie } = await terminarEntradaGoogle(
            request,
            url.searchParams.get("code") ?? "",
            url.searchParams.get("state") ?? "",
            site,
          );
          return desvio("/app", [cookie, cookieDoEstadoVencido()]);
        } catch (erro) {
          if (erro instanceof GoogleRecusado || erro instanceof GoogleNaoConfigurado) {
            console.warn("Entrada pelo Google recusada:", erro.message);
            return desvio("/entrar?erro=google", [cookieDoEstadoVencido()]);
          }
          console.error("Falha na entrada pelo Google", erro);
          return desvio("/entrar?erro=google", [cookieDoEstadoVencido()]);
        }
      },
    },
  },
});

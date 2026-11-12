import { createFileRoute } from "@tanstack/react-router";
import { falha, origemSegura } from "@/lib/conta.server";
import { comecarEntradaGoogle, GoogleNaoConfigurado } from "@/lib/conta/google.server";

// GET — manda a pessoa para o Google, com o cookie que amarra a volta a este navegador.
export const Route = createFileRoute("/api/conta/google")({
  server: {
    handlers: {
      GET: ({ request }) => {
        try {
          const { url, cookie } = comecarEntradaGoogle(origemSegura(request));
          return new Response(null, { status: 302, headers: { location: url, "set-cookie": cookie } });
        } catch (erro) {
          if (erro instanceof GoogleNaoConfigurado) return falha(503, erro.message);
          throw erro;
        }
      },
    },
  },
});

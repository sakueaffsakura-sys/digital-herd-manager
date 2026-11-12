import { createFileRoute } from "@tanstack/react-router";
import { dentroDoLimite, falha, ipDe, lerCorpo, resposta } from "@/lib/conta.server";
import { quemEsta } from "@/lib/conta/login.server";
import { tokenDoPedido } from "@/lib/conta/sessao";
import { AcessoNegado } from "@/lib/dados/acesso";
import { conferirSenhaAtual, SenhaRecusada, trocarSenha } from "@/lib/conta/senha.server";

/**
 * POST { acao: "conferir" | "trocar" } — a senha de quem já está dentro.
 *
 * As duas ações são uma só história: conferir a senha atual deixa uma marca na sessão, e
 * trocar exige essa marca recente. Separadas, quem chamasse só a segunda trocaria a senha
 * sem saber a primeira — e uma sessão roubada viraria a conta inteira.
 */
export const Route = createFileRoute("/api/conta/senha")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const quem = await quemEsta(request);
        if (!quem) return falha(401, "Entre na sua conta.");
        const corpo = await lerCorpo<{ acao?: unknown; senha?: unknown; nova?: unknown }>(request);
        const acao = String(corpo?.acao ?? "");

        try {
          if (acao === "conferir") {
            const senha = typeof corpo?.senha === "string" ? corpo.senha : "";
            if (!senha || senha.length > 200) return falha(400, "Digite a senha atual.");
            if (!(await dentroDoLimite(`senha-conf:${quem.userId}`, 5, 900))
              || !(await dentroDoLimite(`senha-conf-ip:${ipDe(request)}`, 20, 3600))) {
              return falha(429, "Muitas tentativas. Espere 15 minutos.");
            }
            await conferirSenhaAtual(quem, senha);
            return resposta(200, { ok: true });
          }

          if (acao === "trocar") {
            const nova = typeof corpo?.nova === "string" ? corpo.nova : "";
            if (!nova) return falha(400, "Escolha a senha nova.");
            // A sessão deste navegador fica; as outras caem.
            await trocarSenha(quem, nova, tokenDoPedido(request));
            return resposta(200, { ok: true });
          }

          return falha(400, "Pedido desconhecido.");
        } catch (erro) {
          if (erro instanceof SenhaRecusada) return falha(400, erro.message);
          if (erro instanceof AcessoNegado) return falha(403, erro.message);
          console.error("Falha ao mexer na senha", erro);
          return falha(500, "Não deu para concluir. Tente de novo.");
        }
      },
    },
  },
});

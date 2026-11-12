import { createFileRoute } from "@tanstack/react-router";
import { dentroDoLimite, falha, lerCorpo, resposta } from "@/lib/conta.server";
import { quemEsta } from "@/lib/conta/login.server";
import { consultarUm } from "@/lib/dados/banco.server";
import { AcessoNegado } from "@/lib/dados/acesso";
import {
  cadastrarFator, CodigoRecusado, listarFatores, temDoisFatores, tirarFator, verificarCodigo,
} from "@/lib/conta/dois-fatores.server";

/**
 * POST { acao } — a verificação em duas etapas.
 *
 * O limite de tentativas é por conta, apertado: seis dígitos são um milhão de
 * possibilidades, e sem limite dá para percorrer boa parte delas. Com cinco por minuto,
 * não dá.
 */
export const Route = createFileRoute("/api/conta/2fa")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const quem = await quemEsta(request);
        if (!quem) return falha(401, "Entre na sua conta.");
        const corpo = await lerCorpo<{ acao?: unknown; fatorId?: unknown; codigo?: unknown }>(request);
        const acao = String(corpo?.acao ?? "");
        const fatorId = typeof corpo?.fatorId === "string" ? corpo.fatorId : undefined;
        const codigo = typeof corpo?.codigo === "string" ? corpo.codigo : "";

        try {
          switch (acao) {
            case "listar":
              return resposta(200, { fatores: await listarFatores(quem), aal: quem.aal ?? "aal1", ligado: await temDoisFatores(quem.userId) });

            case "cadastrar": {
              // Cadastrar cria segredo; sem limite, daria para encher a tabela.
              if (!(await dentroDoLimite(`2fa-novo:${quem.userId}`, 5, 3600))) {
                return falha(429, "Muitos cadastros seguidos. Espere uma hora.");
              }
              const pessoa = await consultarUm<{ email: string }>("SELECT email FROM usuarios WHERE id = ?", [quem.userId]);
              const novo = await cadastrarFator(quem, pessoa?.email ?? "conta");
              // O segredo volta uma vez só, agora: é o que a pessoa põe no aplicativo.
              return resposta(200, { id: novo.id, segredo: novo.segredo, qr: novo.qr });
            }

            case "verificar": {
              if (!(await dentroDoLimite(`2fa:${quem.userId}`, 5, 60))) {
                return falha(429, "Muitas tentativas. Espere um minuto.");
              }
              return resposta(200, await verificarCodigo(quem, codigo, fatorId));
            }

            case "tirar": {
              if (!fatorId) return falha(400, "Diga qual verificação tirar.");
              if (!(await dentroDoLimite(`2fa:${quem.userId}`, 5, 60))) {
                return falha(429, "Muitas tentativas. Espere um minuto.");
              }
              await tirarFator(quem, fatorId, codigo || undefined);
              return resposta(200, { ok: true });
            }

            default:
              return falha(400, "Pedido desconhecido.");
          }
        } catch (erro) {
          if (erro instanceof CodigoRecusado) return falha(400, erro.message);
          if (erro instanceof AcessoNegado) return falha(403, erro.message);
          console.error("Falha na verificação em duas etapas", erro);
          return falha(500, "Não deu para concluir. Tente de novo.");
        }
      },
    },
  },
});

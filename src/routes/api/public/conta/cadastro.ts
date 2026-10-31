import { createFileRoute } from "@tanstack/react-router";
import { clienteDoSite, dentroDoLimite, EMAIL_VALIDO, falha, ipDe, lerCorpo, origemSegura, resposta } from "@/lib/conta.server";
import { motivoSenhaFraca } from "@/lib/senha";

type Corpo = { nome?: unknown; email?: unknown; senha?: unknown; site?: unknown; inicio?: unknown };

// POST { nome, email, senha } — cria a conta com limite por endereço de rede e campo anti-robô.
export const Route = createFileRoute("/api/public/conta/cadastro")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const c = await lerCorpo<Corpo>(request);
        if (!c) return falha(400, "Pedido inválido.");
        // Campo escondido preenchido ou formulário enviado rápido demais = robô. Resposta neutra.
        const rapidoDemais = typeof c.inicio === "number" && Date.now() - c.inicio < 1500;
        if ((typeof c.site === "string" && c.site.trim() !== "") || rapidoDemais) return falha(400, "Não foi possível criar a conta agora. Tente de novo.");
        const nome = typeof c.nome === "string" ? c.nome.trim().replace(/\s+/g, " ").slice(0, 120) : "";
        const email = typeof c.email === "string" ? c.email.trim().toLowerCase() : "";
        const senha = typeof c.senha === "string" ? c.senha : "";
        if (nome.length < 2) return falha(400, "Digite o seu nome.");
        if (!EMAIL_VALIDO.test(email)) return falha(400, "Digite um e-mail válido.");
        const fraca = motivoSenhaFraca(senha, email);
        if (fraca) return falha(400, fraca);
        const ip = ipDe(request);
        if (!(await dentroDoLimite(`cad-ip:${ip}`, 5, 3600))) return falha(429, "Muitos cadastros deste aparelho. Tente de novo daqui a uma hora.");
        const { data, error } = await clienteDoSite().auth.signUp({
          email, password: senha, options: { data: { nome_completo: nome }, emailRedirectTo: `${origemSegura(request)}/` },
        });
        if (error) {
          if (/already|registered|exists/i.test(error.message)) return falha(409, "Não foi possível criar a conta com esse e-mail. Se você já tem conta, entre ou recupere a senha.");
          if (/pwned|weak|breach|leaked/i.test(error.message)) return falha(400, "Essa senha apareceu em vazamentos de dados na internet. Escolha outra.");
          if (/rate|too many/i.test(error.message)) return falha(429, "Muitas tentativas. Aguarde alguns minutos.");
          console.error("cadastro:", error.message);
          return falha(400, "Não foi possível criar a conta agora. Tente de novo.");
        }
        // Com confirmação de e-mail ligada, não vem sessão: a pessoa confirma pelo e-mail.
        if (!data.session) return resposta(200, { confirmar: true });
        return resposta(200, { sessao: { access_token: data.session.access_token, refresh_token: data.session.refresh_token } });
      },
    },
  },
});

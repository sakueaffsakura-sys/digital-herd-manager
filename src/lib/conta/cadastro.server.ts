/**
 * Criar conta no banco novo.
 *
 * Três decisões, e as duas primeiras são sobre o que a resposta NÃO conta:
 *
 *   **"E-mail já existe" não é dito.** A resposta para e-mail novo e para e-mail que já
 *   tem conta é a mesma. Se diferisse, qualquer pessoa testaria uma lista de e-mails e
 *   saberia quem tem conta aqui — e, num site de fazenda, isso é saber quem é produtor,
 *   onde e com o que trabalha.
 *
 *   **Quando o e-mail já existe, a pessoa recebe um aviso por e-mail.** Não a senha nem
 *   um link de entrada: só "alguém tentou criar conta com o seu e-mail; se foi você, entre
 *   normalmente ou recupere a senha". Assim quem está tentando de verdade não fica sem
 *   saber por que não entrou, e quem só estava sondando não aprende nada.
 *
 *   **A conta nasce pronta para entrar.** Não há confirmação de e-mail obrigatória: o site
 *   não manda nada de valor por e-mail antes da pessoa entrar, e exigir confirmação num
 *   celular de fazenda, com sinal ruim, é onde se perde quem estava chegando.
 */
import { consultarUm, executar, instanteUtc } from "@/lib/dados/banco.server";
import { abrirSessao } from "./login.server";
import { guardarSenha } from "./senha";
import { enviarEmail, temEmail } from "./email.server";
import type { Quem } from "@/lib/dados/acesso";

export class CadastroRecusado extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "CadastroRecusado";
  }
}

export async function criarConta(
  request: Request,
  nome: string,
  email: string,
  senha: string,
): Promise<{ quem: Quem; cookie: string; token: string } | { jaExistia: true }> {
  const limpo = email.trim().toLowerCase();

  const existente = await consultarUm<{ id: string }>("SELECT id FROM usuarios WHERE email = ? LIMIT 1", [limpo]);
  if (existente) {
    // Avisa a pessoa de verdade, sem contar nada a quem está sondando.
    if (temEmail()) {
      await enviarEmail(
        limpo,
        "Alguém tentou criar uma conta com o seu e-mail",
        [
          "Alguém tentou criar uma conta na Pecuária Digital com este e-mail, que já tem conta.",
          "",
          "Se foi você: entre normalmente com a sua senha. Se não lembrar dela, use",
          "\"Esqueci minha senha\" na tela de entrada.",
          "",
          "Se não foi você, não precisa fazer nada. Sua conta e sua senha continuam as mesmas.",
        ].join("\n"),
      ).catch((erro) => console.error("Aviso de cadastro duplicado não saiu", erro));
    }
    return { jaExistia: true };
  }

  const userId = crypto.randomUUID();
  await executar(
    "INSERT INTO usuarios (id, email, senha_hash, email_confirmado_em) VALUES (?, ?, ?, ?)",
    [userId, limpo, await guardarSenha(senha), instanteUtc(new Date())],
  );
  await executar(
    "INSERT INTO profiles (id, nome_completo) VALUES (?, ?) ON DUPLICATE KEY UPDATE nome_completo = VALUES(nome_completo)",
    [userId, nome.trim().replace(/\s+/g, " ").slice(0, 120)],
  );
  return abrirSessao(request, userId);
}

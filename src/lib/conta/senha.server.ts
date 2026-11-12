/**
 * Conferir a senha atual e trocar a senha, já dentro do site.
 *
 * O ponto todo está na ligação entre as duas: **trocar a senha exige ter digitado a antiga
 * há pouco, nesta mesma sessão.**
 *
 * Antes isso era combinado entre as telas — a tela chamava "conferir senha" e depois
 * "trocar senha", e quem chamasse só a segunda trocava a senha sem saber a primeira. Com a
 * sessão em cookie isso ficaria pior ainda: uma sessão roubada vira a conta inteira, sem
 * precisar descobrir senha nenhuma.
 *
 * Agora conferir a senha deixa uma marca na sessão, e trocar exige essa marca recente. É a
 * diferença entre uma ordem que se espera que a tela siga e uma que o servidor garante.
 */
import { consultarUm, executar, instanteUtc } from "@/lib/dados/banco.server";
import { AcessoNegado, type Quem } from "@/lib/dados/acesso";
import { conferirForca, conferirSenha, guardarSenha } from "./senha";
import { derrubarOutrasSessoes } from "./login.server";
import { temDoisFatores } from "./dois-fatores.server";

/** Cinco minutos entre digitar a senha atual e trocar: o tempo de preencher o formulário. */
const JANELA_MIN = 5;

export class SenhaRecusada extends Error {
  constructor(mensagem = "A senha atual não confere.") {
    super(mensagem);
    this.name = "SenhaRecusada";
  }
}

/**
 * Confere a senha atual e marca a sessão. Sem a marca, trocar a senha é recusado.
 *
 * Uma conta que entra só pelo Google não tem senha: aí não há o que conferir, e a marca é
 * dada — a pessoa provou quem é ao entrar.
 */
export async function conferirSenhaAtual(quem: Quem, senha: string): Promise<void> {
  const pessoa = await consultarUm<{ senha_hash: string | null }>(
    "SELECT senha_hash FROM usuarios WHERE id = ?",
    [quem.userId],
  );
  if (!pessoa) throw new AcessoNegado("Conta não encontrada.");

  if (pessoa.senha_hash) {
    const { confere, regravar } = await conferirSenha(senha, pessoa.senha_hash);
    if (!confere) throw new SenhaRecusada();
    // Guardada com um custo antigo: aproveita que a senha está em mãos para regravar.
    if (regravar) {
      await executar("UPDATE usuarios SET senha_hash = ? WHERE id = ?", [await guardarSenha(senha), quem.userId]);
    }
  }
  if (quem.sessaoId) {
    await executar("UPDATE sessoes SET senha_conferida_em = ? WHERE id = ?", [instanteUtc(new Date()), quem.sessaoId]);
  }
}

/** A senha atual foi digitada nesta sessão há pouco? */
async function conferidaHaPouco(quem: Quem): Promise<boolean> {
  if (!quem.sessaoId) return false;
  const linha = await consultarUm<{ q: number }>(
    `SELECT COUNT(*) AS q FROM sessoes
     WHERE id = ? AND senha_conferida_em IS NOT NULL AND senha_conferida_em > ?`,
    [quem.sessaoId, instanteUtc(new Date(Date.now() - JANELA_MIN * 60_000))],
  );
  return Number(linha?.q ?? 0) > 0;
}

/**
 * Troca a senha. Depois disso, as outras sessões caem.
 *
 * Derrubar as outras é o fim da história, não um detalhe: quem troca a senha porque
 * desconfia que alguém entrou precisa que esse alguém saia. Esta sessão fica — seria
 * estranho a pessoa ser expulsa da tela em que acabou de trocar a senha.
 */
export async function trocarSenha(quem: Quem, nova: string, tokenAtual?: string | null): Promise<void> {
  const forca = conferirForca(nova);
  if (!forca.ok) throw new SenhaRecusada(forca.motivo);
  if (!(await conferidaHaPouco(quem))) {
    throw new AcessoNegado("Digite a senha atual antes de escolher a nova.");
  }
  // Com verificação em duas etapas ligada, só uma sessão que passou por ela troca a senha.
  // Senão a segunda etapa protegeria a entrada e não protegeria a troca — que é o que dá
  // a conta de vez a quem estiver dentro.
  if (quem.aal !== "aal2" && (await temDoisFatores(quem.userId))) {
    throw new AcessoNegado("Confirme o código das duas etapas antes de trocar a senha.");
  }

  await executar("UPDATE usuarios SET senha_hash = ? WHERE id = ?", [await guardarSenha(nova), quem.userId]);
  // A marca é gasta: trocar de novo pede a senha atual outra vez.
  if (quem.sessaoId) {
    await executar("UPDATE sessoes SET senha_conferida_em = NULL WHERE id = ?", [quem.sessaoId]);
  }
  await derrubarOutrasSessoes(quem.userId, tokenAtual ?? null);
}

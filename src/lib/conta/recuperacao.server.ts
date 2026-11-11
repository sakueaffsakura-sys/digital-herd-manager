/**
 * "Esqueci minha senha": pedir o link e trocar a senha com ele.
 *
 * Três decisões que parecem detalhe e são o que faz isto não virar um jeito de invadir
 * conta ou de descobrir quem tem conta no site:
 *
 *   **Pedir nunca diz se o e-mail existe.** A resposta é a mesma para quem tem conta e
 *   para quem não tem. Se diferisse, qualquer pessoa poderia testar uma lista de e-mails
 *   e saber quais são de produtores daqui.
 *
 *   **O token não fica guardado.** No banco vai só o resumo (sha256) dele, como se faz com
 *   senha: quem leia o banco não consegue usar os links que estão de pé.
 *
 *   **Usar o link derruba as outras sessões.** Quem troca a senha porque desconfia que
 *   alguém entrou precisa que esse alguém saia — senão a troca não resolve nada.
 *
 * O link vale uma hora e serve uma vez só.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { consultar, consultarUm, executar, instanteUtc } from "@/lib/dados/banco.server";
import { conferirForca, guardarSenha } from "./senha";
import { derrubarOutrasSessoes } from "./login.server";
import { enviarEmail, temEmail } from "./email.server";

/** Uma hora: tempo de ir ao e-mail e voltar, não de deixar o link vivo o dia inteiro. */
const VALIDADE_MIN = 60;
/** Quantos pedidos a mesma conta aceita por hora, para o e-mail dela não virar despejo. */
const PEDIDOS_POR_HORA = 5;

export class LinkInvalido extends Error {
  constructor(mensagem = "Este link não serve mais. Peça outro.") {
    super(mensagem);
    this.name = "LinkInvalido";
  }
}

const resumo = (token: string) => createHash("sha256").update(token).digest("hex");

/** Comparação que não entrega, pelo tempo de resposta, quanto do valor estava certo. */
function igualSemVazar(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}

/**
 * Pede o link. Devolve sempre o mesmo resultado, exista a conta ou não.
 *
 * `enderecoDoSite` vem de quem chamou (a rota sabe o domínio do pedido), e não de um
 * cabeçalho do navegador: montar o link com o `Host` que chegou deixaria qualquer um
 * mandar para a vítima um e-mail nosso com link para o site dele.
 */
export async function pedirRecuperacao(email: string, enderecoDoSite: string): Promise<void> {
  const limpo = String(email ?? "").trim().toLowerCase();
  if (!limpo || limpo.length > 320) return;

  const pessoa = await consultarUm<{ id: string; bloqueado: number }>(
    "SELECT id, bloqueado FROM usuarios WHERE email = ? LIMIT 1",
    [limpo],
  );
  // Sem conta, conta bloqueada ou servidor sem e-mail configurado: sai calado. A pessoa
  // do outro lado vê a mesma tela nos quatro casos.
  if (!pessoa || pessoa.bloqueado || !temEmail()) return;

  const desdeUmaHora = instanteUtc(new Date(Date.now() - 3_600_000));
  const recentes = await consultarUm<{ q: number }>(
    "SELECT COUNT(*) AS q FROM recuperacoes_senha WHERE user_id = ? AND criado_em > ?",
    [pessoa.id, desdeUmaHora],
  );
  if (Number(recentes?.q ?? 0) >= PEDIDOS_POR_HORA) return;

  const token = randomBytes(32).toString("base64url");
  await executar(
    "INSERT INTO recuperacoes_senha (id, user_id, token_hash, expira_em) VALUES (UUID(), ?, ?, ?)",
    [pessoa.id, resumo(token), instanteUtc(new Date(Date.now() + VALIDADE_MIN * 60_000))],
  );

  const link = `${enderecoDoSite.replace(/\/+$/, "")}/entrar/nova-senha?t=${token}`;
  await enviarEmail(
    limpo,
    "Trocar a senha da Pecuária Digital",
    [
      "Alguém pediu para trocar a senha desta conta na Pecuária Digital.",
      "",
      "Se foi você, abra este endereço para escolher a senha nova:",
      link,
      "",
      `O endereço vale ${VALIDADE_MIN} minutos e só funciona uma vez.`,
      "",
      "Se não foi você, não precisa fazer nada: sua senha continua a mesma.",
    ].join("\n"),
  );
}

/**
 * Troca a senha usando o link. Devolve de quem é a conta.
 *
 * Tudo numa ordem que importa: primeiro confere a força da senha (para não gastar o link
 * numa senha que seria recusada), depois marca o link como usado, depois grava a senha, e
 * só então derruba as outras sessões.
 */
export async function trocarSenhaComLink(token: string, senhaNova: string): Promise<{ userId: string }> {
  const limpo = String(token ?? "").trim();
  if (!limpo || limpo.length > 200) throw new LinkInvalido();

  const forca = conferirForca(senhaNova);
  if (!forca.ok) throw new Error(forca.motivo);

  const agora = new Date();
  const candidatos = await consultar<{ id: string; user_id: string; token_hash: string }>(
    `SELECT id, user_id, token_hash FROM recuperacoes_senha
     WHERE expira_em > ? AND usado_em IS NULL`,
    [instanteUtc(agora)],
  );
  const pedido = candidatos.find((c) => igualSemVazar(c.token_hash, resumo(limpo)));
  if (!pedido) throw new LinkInvalido();

  // Marcar como usado antes de gravar a senha fecha a porta de dois pedidos ao mesmo
  // tempo com o mesmo link: o segundo não encontra mais nada para usar.
  const { afetadas } = await executar(
    "UPDATE recuperacoes_senha SET usado_em = ? WHERE id = ? AND usado_em IS NULL",
    [instanteUtc(agora), pedido.id],
  );
  if (afetadas === 0) throw new LinkInvalido();

  await executar("UPDATE usuarios SET senha_hash = ? WHERE id = ?", [await guardarSenha(senhaNova), pedido.user_id]);
  // Os outros links pendentes desta conta também perdem valor.
  await executar(
    "UPDATE recuperacoes_senha SET usado_em = ? WHERE user_id = ? AND usado_em IS NULL",
    [instanteUtc(agora), pedido.user_id],
  );
  await derrubarOutrasSessoes(pedido.user_id, null);
  return { userId: pedido.user_id };
}

/** Limpeza de rotina: os pedidos vencidos não servem para nada. */
export async function limparRecuperacoesVencidas(): Promise<number> {
  const { afetadas } = await executar(
    "DELETE FROM recuperacoes_senha WHERE expira_em < ?",
    [instanteUtc(new Date(Date.now() - 7 * 86_400_000))],
  );
  return afetadas;
}

/**
 * Verificação em duas etapas: cadastrar o aplicativo de códigos, confirmar, usar e tirar.
 *
 * Quatro decisões que são a própria segurança disto:
 *
 *   **O segredo é cifrado no banco.** Com a mesma chave mestra das outras chaves. Quem
 *   leia o banco não consegue gerar os códigos de ninguém — e se não fosse cifrado, um
 *   vazamento de banco derrubaria a segunda etapa de todas as contas de uma vez.
 *
 *   **O fator só conta depois de confirmado.** Cadastrar devolve o segredo e espera um
 *   código feito a partir dele. Antes disso o fator existe mas não protege nem atrapalha:
 *   quem cadastrar e fechar a tela sem confirmar não fica trancado fora da conta.
 *
 *   **Cada código vale uma vez.** O intervalo aceito fica guardado, e um código do mesmo
 *   intervalo não entra de novo. Sem isso, quem vir o código por cima do ombro tem até
 *   meio minuto para usá-lo em outro lugar.
 *
 *   **Tirar a verificação exige um código válido.** Não basta estar na sessão: se
 *   bastasse, quem roubasse uma sessão desligaria a segunda etapa e ficaria com a conta.
 */
import { consultar, consultarUm, executar, instanteUtc } from "@/lib/dados/banco.server";
import { cifrar, decifrar } from "@/lib/chaves";
import { contadorQueConfere, enderecoDoQr, novoSegredo } from "./totp";
import { AcessoNegado, type Quem } from "@/lib/dados/acesso";

export class CodigoRecusado extends Error {
  constructor(mensagem = "O código não confere. Tente o próximo que o aplicativo mostrar.") {
    super(mensagem);
    this.name = "CodigoRecusado";
  }
}

/** A mesma chave que cifra as outras chaves do painel. */
function mestra(): string {
  const k = process.env["CHAVES_MESTRA"] || process.env["CHAVE_MESTRA"] || process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!k) throw new AcessoNegado("A verificação em duas etapas não está configurada neste servidor.");
  return k;
}

export type Fator = { id: string; tipo: string; confirmado: boolean; criado_em: string };

/** Os fatores da pessoa. O segredo nunca sai daqui. */
export async function listarFatores(quem: Quem): Promise<Fator[]> {
  const linhas = await consultar<{ id: string; tipo: string; confirmado_em: Date | null; criado_em: Date }>(
    "SELECT id, tipo, confirmado_em, criado_em FROM fatores_2fa WHERE user_id = ? ORDER BY criado_em",
    [quem.userId],
  );
  return linhas.map((l) => ({
    id: l.id,
    tipo: l.tipo,
    confirmado: l.confirmado_em !== null,
    criado_em: new Date(l.criado_em).toISOString(),
  }));
}

/** A verificação está ligada nesta conta? Só fator confirmado conta. */
export async function temDoisFatores(userId: string): Promise<boolean> {
  const linha = await consultarUm<{ q: number }>(
    "SELECT COUNT(*) AS q FROM fatores_2fa WHERE user_id = ? AND confirmado_em IS NOT NULL",
    [userId],
  );
  return Number(linha?.q ?? 0) > 0;
}

/**
 * Começa o cadastro: cria o segredo e devolve o endereço do QR Code.
 *
 * O segredo volta uma vez, aqui, porque a pessoa precisa dele para montar o aplicativo. Da
 * próxima vez não volta mais: no banco está cifrado, e o servidor não o mostra de novo.
 */
export async function cadastrarFator(quem: Quem, email: string): Promise<{ id: string; segredo: string; qr: string }> {
  const abertos = await consultarUm<{ q: number }>(
    "SELECT COUNT(*) AS q FROM fatores_2fa WHERE user_id = ? AND confirmado_em IS NULL",
    [quem.userId],
  );
  // Um cadastro pendente por vez: vários segredos esperando confirmação só confundem.
  if (Number(abertos?.q ?? 0) >= 3) {
    throw new AcessoNegado("Há cadastros pendentes. Confirme ou apague um antes de começar outro.");
  }
  const segredo = novoSegredo();
  const id = crypto.randomUUID();
  await executar(
    "INSERT INTO fatores_2fa (id, user_id, tipo, segredo_cifrado) VALUES (?, ?, 'totp', ?)",
    [id, quem.userId, await cifrar(segredo, mestra())],
  );
  return { id, segredo, qr: enderecoDoQr(segredo, email) };
}

type LinhaFator = { id: string; segredo_cifrado: string; confirmado_em: Date | null; ultimo_contador: number | null };

async function fatorDe(userId: string, fatorId?: string): Promise<LinhaFator | null> {
  if (fatorId) {
    return consultarUm<LinhaFator>(
      "SELECT id, segredo_cifrado, confirmado_em, ultimo_contador FROM fatores_2fa WHERE id = ? AND user_id = ?",
      [fatorId, userId],
    );
  }
  return consultarUm<LinhaFator>(
    `SELECT id, segredo_cifrado, confirmado_em, ultimo_contador FROM fatores_2fa
     WHERE user_id = ? AND confirmado_em IS NOT NULL ORDER BY confirmado_em LIMIT 1`,
    [userId],
  );
}

/**
 * Confere um código e, se servir, guarda o intervalo usado.
 *
 * Devolve o fator conferido. Recusa código repetido mesmo estando certo: o intervalo já
 * foi usado.
 */
async function conferir(userId: string, codigo: string, fatorId?: string): Promise<LinhaFator> {
  const fator = await fatorDe(userId, fatorId);
  if (!fator) throw new CodigoRecusado("Não há verificação em duas etapas nesta conta.");
  const segredo = await decifrar(fator.segredo_cifrado, mestra());
  if (!segredo) throw new AcessoNegado("Não deu para ler a verificação desta conta. Fale com o suporte.");

  const contador = contadorQueConfere(segredo, codigo);
  if (contador === null) throw new CodigoRecusado();
  if (fator.ultimo_contador !== null && contador <= Number(fator.ultimo_contador)) {
    throw new CodigoRecusado("Este código já foi usado. Espere o próximo que o aplicativo mostrar.");
  }
  // Grava o intervalo com a condição no WHERE: dois pedidos ao mesmo tempo, com o mesmo
  // código, e só um passa.
  const { afetadas } = await executar(
    "UPDATE fatores_2fa SET ultimo_contador = ? WHERE id = ? AND (ultimo_contador IS NULL OR ultimo_contador < ?)",
    [contador, fator.id, contador],
  );
  if (afetadas === 0) throw new CodigoRecusado("Este código já foi usado. Espere o próximo.");
  return fator;
}

/**
 * Digita o código. Faz as duas coisas que o código serve para fazer, conforme o caso:
 *
 *   fator ainda não confirmado  confirma o cadastro, e a conta passa a pedir o código
 *   fator já confirmado         sobe esta sessão para "passou pela segunda etapa"
 *
 * É uma função só porque, para quem usa, é uma coisa só: digitar o número que o aplicativo
 * mostra. A tela não deveria precisar saber em qual dos dois casos está.
 */
export async function verificarCodigo(
  quem: Quem,
  codigo: string,
  fatorId?: string,
): Promise<{ confirmou: boolean; aal: "aal1" | "aal2" }> {
  const fator = await conferir(quem.userId, codigo, fatorId);
  const confirmou = !fator.confirmado_em;
  if (confirmou) {
    await executar("UPDATE fatores_2fa SET confirmado_em = ? WHERE id = ?", [instanteUtc(new Date()), fator.id]);
  }
  // Quem acabou de provar que tem o aplicativo passou pela segunda etapa, nos dois casos.
  if (quem.sessaoId) {
    await executar("UPDATE sessoes SET aal = 'aal2' WHERE id = ?", [quem.sessaoId]);
  }
  return { confirmou, aal: "aal2" };
}

/**
 * Tira a verificação. Exige um código válido do próprio aplicativo.
 *
 * Estar na sessão não basta: se bastasse, quem roubasse uma sessão desligaria a segunda
 * etapa e ficaria com a conta. Um cadastro que nunca foi confirmado sai sem código — ele
 * não protege nada, e exigir código dele trancaria quem perdeu o celular no meio do
 * cadastro.
 */
export async function tirarFator(quem: Quem, fatorId: string, codigo?: string): Promise<void> {
  const fator = await fatorDe(quem.userId, fatorId);
  if (!fator) throw new AcessoNegado("Verificação não encontrada nesta conta.");
  if (fator.confirmado_em) {
    if (!codigo) throw new CodigoRecusado("Digite o código do aplicativo para desligar a verificação.");
    await conferir(quem.userId, codigo, fatorId);
  }
  await executar("DELETE FROM fatores_2fa WHERE id = ? AND user_id = ?", [fatorId, quem.userId]);
  // Sem fator confirmado, nenhuma sessão continua marcada como tendo passado pela segunda
  // etapa: a marca diria algo que já não é verdade.
  if (!(await temDoisFatores(quem.userId))) {
    await executar("UPDATE sessoes SET aal = 'aal1' WHERE user_id = ?", [quem.userId]);
  }
}

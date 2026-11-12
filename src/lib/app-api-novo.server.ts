/**
 * A porta do aplicativo Android no banco novo.
 *
 * O aplicativo não é uma página: são arquivos dentro do aparelho falando com o site. Não
 * existe cookie de mesma origem para mandar, então ele guarda o token da sessão e o manda
 * no cabeçalho `Authorization`. É o mesmo token de sessão do site — a diferença é só por
 * onde ele viaja.
 *
 * Duas coisas aqui não são óbvias e são o que impede o aplicativo de virar a porta dos
 * fundos:
 *
 *   **A verificação em duas etapas vale aqui também.** No site, quem tem 2FA e entra só
 *   com a senha fica numa sessão de primeiro nível, e a tela não deixa passar sem o
 *   código. O aplicativo não tem essa tela — então é esta rota que recusa. Sem isso,
 *   bastaria abrir o aplicativo para pular a segunda etapa de quem a ligou.
 *
 *   **`access_token` e `refresh_token` são o mesmo valor, de propósito.** A sessão aqui já
 *   se renova sozinha a cada uso (trinta dias rolando), então não há dois segredos
 *   diferentes para guardar. Devolver os dois campos é o que mantém o aplicativo que já
 *   está instalado entendendo a resposta — ele confere os dois antes de aceitar a sessão.
 */
import { consultarUm } from "@/lib/dados/banco.server";
import { entrar, EntradaBloqueada, EntradaRecusada, quemEsta } from "@/lib/conta/login.server";
import { temDoisFatores, verificarCodigo, CodigoRecusado } from "@/lib/conta/dois-fatores.server";
import { tokenDoPedido, validadeDaSessao } from "@/lib/conta/sessao";
import { erro, json } from "./app-api.server";

/*
 * O aviso de "falta o código" vai no campo `precisa_codigo`, que é o que o aplicativo já
 * instalado procura. Inventar um nome novo aqui quebraria a tela de código dele.
 */

const emSegundos = (d: Date) => Math.floor(d.getTime() / 1000);

/** A resposta de sessão no formato que o aplicativo já sabe ler. */
function sessaoParaApp(token: string, userId: string, email: string | null) {
  return {
    access_token: token,
    // O mesmo valor: ver o comentário no topo deste arquivo.
    refresh_token: token,
    expires_at: emSegundos(validadeDaSessao(new Date())),
    usuario: { id: userId, email },
  };
}

/** Entrar pelo aplicativo: e-mail, senha e, quando a conta tem, o código de 2FA. */
export async function entrarNoApp(
  request: Request,
  email: string,
  senha: string,
  codigo?: string,
): Promise<Response> {
  let aberta: Awaited<ReturnType<typeof entrar>>;
  try {
    aberta = await entrar(request, email, senha);
  } catch (e) {
    if (e instanceof EntradaBloqueada) return erro(429, e.message);
    if (e instanceof EntradaRecusada) return erro(401, e.message);
    throw e;
  }

  // Conta com 2FA: a senha abre a sessão, mas ela não serve para nada sem o código.
  if (await temDoisFatores(aberta.quem.userId)) {
    if (!codigo) {
      return json(401, { erro: "Esta conta usa verificação em duas etapas. Digite o código do aplicativo autenticador.", precisa_codigo: true });
    }
    try {
      await verificarCodigo(aberta.quem, codigo);
    } catch (e) {
      if (e instanceof CodigoRecusado) return json(401, { erro: e.message, precisa_codigo: true });
      throw e;
    }
  }

  const pessoa = await consultarUm<{ email: string }>("SELECT email FROM usuarios WHERE id = ?", [aberta.quem.userId]);
  return json(200, sessaoParaApp(aberta.token, aberta.quem.userId, pessoa?.email ?? null));
}

/**
 * Renovar: confere o token que o aplicativo guardou e devolve a validade nova.
 *
 * Não cria token novo. A sessão já se estende a cada uso, então renovar é só o aplicativo
 * perguntando "ainda vale?" e recebendo até quando.
 */
export async function renovarNoApp(request: Request, token: string): Promise<Response> {
  const comToken = new Request(request.url, { headers: { authorization: `Bearer ${token}` } });
  const quem = await quemEsta(comToken);
  if (!quem) return erro(401, "Sessão expirada. Entre novamente.");
  // Com 2FA ligado, a sessão só continua valendo se já passou pela segunda etapa.
  if (quem.aal !== "aal2" && (await temDoisFatores(quem.userId))) {
    return json(401, { erro: "Esta conta usa verificação em duas etapas. Digite o código do aplicativo autenticador.", precisa_codigo: true });
  }
  const pessoa = await consultarUm<{ email: string }>("SELECT email FROM usuarios WHERE id = ?", [quem.userId]);
  return json(200, sessaoParaApp(token, quem.userId, pessoa?.email ?? null));
}

/** Quem está pedindo, pelo token do cabeçalho. `null` quando não há sessão válida. */
export const quemNoApp = (request: Request) => quemEsta(request);

export { tokenDoPedido };

/**
 * O token curto que as telas mandam como Bearer para as nossas próprias rotas.
 *
 * Oito telas já faziam isso com o token do Supabase (`session.access_token`): a Yui, o
 * painel do administrador, o clima, o PDF do eBook. Com a sessão em cookie esse token não
 * existe mais, e a saída fácil — devolver o valor do cookie ao JavaScript — é exatamente o
 * que não se pode fazer: o cookie é `HttpOnly` de propósito, para que um script injetado
 * na página não consiga lê-lo e usar a sessão de outro lugar.
 *
 * Então o servidor cunha um token separado, a partir do cookie, com três propriedades:
 *
 *   **Dura cinco minutos.** Se vazar, vaza por cinco minutos. E não se renova sozinho:
 *   pedir outro exige o cookie, que o script não tem.
 *
 *   **Não é guardado em lugar nenhum.** É só assinatura: `v1`, de quem é, até quando, e o
 *   resumo dos três com a chave do servidor. Conferir é recalcular. Sem tabela para
 *   consultar, sem tabela para crescer, e nada a limpar depois.
 *
 *   **Carrega só o identificador da pessoa.** Não carrega "é administrador". Parece
 *   economia de consulta e seria um buraco: quem é administrador sai do banco em cada
 *   pedido, nunca de algo que veio do navegador — mesmo que esse algo esteja assinado por
 *   nós, porque um token cunhado antes de alguém perder o cargo continuaria valendo.
 *
 * Não é JWT de propósito: JWT traria uma dependência e um formato com partes que não
 * usamos, e cada parte que não se usa é uma decisão que alguém pode configurar errado.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/** Cinco minutos: o bastante para a tela carregar e pedir o que precisa. */
const VALIDADE_S = 300;
const VERSAO = "v1";

const chave = () => process.env["CHAVE_MESTRA"] ?? process.env["TOKEN_CHAVE"] ?? "";

const assinar = (corpo: string) => createHmac("sha256", chave()).update(corpo).digest("base64url");

/** Cunha um token para esta pessoa. Quem chamou já conferiu o cookie. */
export function cunharToken(userId: string): { token: string; expiraEm: number } {
  const ate = Math.floor(Date.now() / 1000) + VALIDADE_S;
  const corpo = `${VERSAO}.${userId}.${ate}`;
  return { token: `${corpo}.${assinar(corpo)}`, expiraEm: ate };
}

/**
 * De quem é este token, ou nada.
 *
 * Devolve `null` para tudo que não serve — assinatura errada, prazo vencido, formato
 * estranho. Quem chama não precisa saber qual dos três foi, e contar isso só ajudaria
 * quem está tentando adivinhar.
 */
export function donoDoToken(token: unknown): string | null {
  const texto = String(token ?? "");
  if (!texto || texto.length > 400) return null;
  const partes = texto.split(".");
  if (partes.length !== 4) return null;
  const [versao, userId, ate, assinatura] = partes as [string, string, string, string];
  if (versao !== VERSAO || !userId) return null;

  const prazo = Number(ate);
  if (!Number.isFinite(prazo) || prazo < Math.floor(Date.now() / 1000)) return null;

  const esperada = Buffer.from(assinar(`${versao}.${userId}.${ate}`), "utf8");
  const vinda = Buffer.from(assinatura, "utf8");
  if (vinda.length !== esperada.length || !timingSafeEqual(vinda, esperada)) return null;
  return userId;
}

/** O token do cabeçalho `Authorization: Bearer ...`, se houver. */
export function tokenDoCabecalho(request: Request): string | null {
  const cabecalho = request.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(cabecalho.trim());
  return m?.[1]?.trim() || null;
}

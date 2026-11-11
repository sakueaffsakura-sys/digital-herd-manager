/**
 * Entrar pelo Google, sem o Supabase no meio.
 *
 * Sete pessoas entram no site assim hoje, e nenhuma delas tem senha aqui: se isto não
 * funcionar no dia da virada, elas ficam de fora da própria conta.
 *
 * O caminho é o padrão (OAuth 2.0 com OpenID Connect), e tem três pontos onde o descuido
 * custa a conta de alguém:
 *
 *   **O `state` é amarrado ao navegador.** Vai num cookie e é conferido na volta. Só
 *   sortear um valor não basta: o que protege é ele ter voltado no MESMO navegador que
 *   começou. Sem isso, alguém prepara um "retorno" e faz a vítima clicar, entrando com a
 *   conta do atacante na sessão dela.
 *
 *   **Só e-mail confirmado pelo Google liga a uma conta que já existe.** A ligação é por
 *   e-mail, então aceitar e-mail não confirmado deixaria qualquer pessoa criar uma conta
 *   Google com o endereço de um produtor e entrar como ele.
 *
 *   **O código é trocado pelo servidor, falando direto com o Google.** A chave secreta não
 *   passa pelo navegador, e a resposta vem por um canal que já é autenticado por TLS — é
 *   por isso que o `id_token` pode ser lido sem buscar a chave pública do Google: ele não
 *   chegou por terceiros.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { consultarUm, executar } from "@/lib/dados/banco.server";
import { abrirSessao } from "./login.server";
import type { Quem } from "@/lib/dados/acesso";

const AUTORIZAR = "https://accounts.google.com/o/oauth2/v2/auth";
const TROCAR = "https://oauth2.googleapis.com/token";
export const COOKIE_ESTADO = "pd_google";
/** Dez minutos: o tempo de escolher a conta no Google, não de deixar a porta aberta. */
const VALIDADE_ESTADO_S = 600;

export class GoogleNaoConfigurado extends Error {
  constructor() {
    super("A entrada pelo Google ainda não está configurada neste servidor.");
    this.name = "GoogleNaoConfigurado";
  }
}

export class GoogleRecusado extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "GoogleRecusado";
  }
}

type Config = { id: string; segredo: string };

function config(): Config | null {
  const id = process.env["GOOGLE_CLIENT_ID"]?.trim();
  const segredo = process.env["GOOGLE_CLIENT_SECRET"];
  return id && segredo ? { id, segredo } : null;
}

/** A entrada pelo Google está configurada neste servidor? */
export const temGoogle = () => config() !== null;

const chaveDeAssinatura = () =>
  process.env["CHAVE_MESTRA"] ?? process.env["GOOGLE_CLIENT_SECRET"] ?? "";

/**
 * O `state`: um valor sorteado, a hora, e a assinatura dos dois. A assinatura é o que
 * permite conferir na volta que o valor é nosso, sem guardar nada no servidor.
 */
function montarEstado(): string {
  const corpo = `${randomBytes(16).toString("base64url")}.${Math.floor(Date.now() / 1000)}`;
  const assinatura = createHmac("sha256", chaveDeAssinatura()).update(corpo).digest("base64url");
  return `${corpo}.${assinatura}`;
}

function estadoValido(estado: string): boolean {
  const partes = String(estado ?? "").split(".");
  if (partes.length !== 3) return false;
  const [valor, quando, assinatura] = partes as [string, string, string];
  const esperada = createHmac("sha256", chaveDeAssinatura()).update(`${valor}.${quando}`).digest("base64url");
  const a = Buffer.from(assinatura);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  const idade = Math.floor(Date.now() / 1000) - Number(quando);
  return Number.isFinite(idade) && idade >= 0 && idade <= VALIDADE_ESTADO_S;
}

const cookieDoEstado = (estado: string, segura: boolean) =>
  `${COOKIE_ESTADO}=${estado}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${VALIDADE_ESTADO_S}${segura ? "; Secure" : ""}`;

export const cookieDoEstadoVencido = () =>
  `${COOKIE_ESTADO}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

function estadoDoPedido(request: Request): string | null {
  const bruto = request.headers.get("cookie") ?? "";
  for (const pedaco of bruto.split(";")) {
    const [nome, ...resto] = pedaco.trim().split("=");
    if (nome === COOKIE_ESTADO) return resto.join("=");
  }
  return null;
}

/** Para onde mandar a pessoa, e o cookie que amarra a volta a este navegador. */
export function comecarEntradaGoogle(enderecoDoSite: string): { url: string; cookie: string } {
  const c = config();
  if (!c) throw new GoogleNaoConfigurado();
  const estado = montarEstado();
  const base = enderecoDoSite.replace(/\/+$/, "");
  const url = new URL(AUTORIZAR);
  url.searchParams.set("client_id", c.id);
  url.searchParams.set("redirect_uri", `${base}/api/conta/google/retorno`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", estado);
  // Pede a tela de escolha de conta: em celular compartilhado, entrar direto na conta de
  // quem usou antes é um problema, não uma comodidade.
  url.searchParams.set("prompt", "select_account");
  return { url: url.toString(), cookie: cookieDoEstado(estado, base.startsWith("https://")) };
}

type Identidade = { sub: string; email: string; emailConfirmado: boolean; nome: string | null };

/** Lê o miolo do `id_token`. Veio direto do Google por TLS; não passou por terceiros. */
function lerIdToken(idToken: string): Identidade {
  const meio = String(idToken ?? "").split(".")[1];
  if (!meio) throw new GoogleRecusado("O Google respondeu de um jeito que não entendi.");
  let dados: Record<string, unknown>;
  try {
    dados = JSON.parse(Buffer.from(meio, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    throw new GoogleRecusado("O Google respondeu de um jeito que não entendi.");
  }
  const sub = typeof dados["sub"] === "string" ? dados["sub"] : "";
  const email = typeof dados["email"] === "string" ? dados["email"].toLowerCase() : "";
  if (!sub || !email) throw new GoogleRecusado("O Google não informou o e-mail desta conta.");
  return {
    sub,
    email,
    emailConfirmado: dados["email_verified"] === true || dados["email_verified"] === "true",
    nome: typeof dados["name"] === "string" ? dados["name"] : null,
  };
}

async function trocarCodigo(codigo: string, enderecoDoSite: string): Promise<Identidade> {
  const c = config();
  if (!c) throw new GoogleNaoConfigurado();
  const resposta = await fetch(TROCAR, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: codigo,
      client_id: c.id,
      client_secret: c.segredo,
      redirect_uri: `${enderecoDoSite.replace(/\/+$/, "")}/api/conta/google/retorno`,
      grant_type: "authorization_code",
    }),
  });
  if (!resposta.ok) {
    // O corpo do erro pode citar a chave secreta; não vai para a tela nem para o registro.
    throw new GoogleRecusado("O Google não confirmou esta entrada. Tente de novo.");
  }
  const json = (await resposta.json()) as { id_token?: string };
  if (!json.id_token) throw new GoogleRecusado("O Google não informou quem é você.");
  return lerIdToken(json.id_token);
}

/**
 * Fecha a entrada: confere o `state`, troca o código e abre a sessão.
 *
 * Três caminhos, nesta ordem: a identidade Google já está ligada a uma conta; não está,
 * mas existe conta com aquele e-mail (liga, se o Google confirmou o e-mail); não existe
 * nada (cria a conta, sem senha — quem entrar por aqui entra por aqui, e pode criar uma
 * senha depois em "Minha conta").
 */
export async function terminarEntradaGoogle(
  request: Request,
  codigo: string,
  estadoVindo: string,
  enderecoDoSite: string,
): Promise<{ quem: Quem; cookie: string; criou: boolean }> {
  const estadoCookie = estadoDoPedido(request);
  if (!codigo) throw new GoogleRecusado("A entrada não foi concluída.");
  if (!estadoCookie || !estadoVindo || estadoCookie !== estadoVindo || !estadoValido(estadoCookie)) {
    throw new GoogleRecusado("Esta entrada não começou neste navegador. Tente de novo.");
  }

  const g = await trocarCodigo(codigo, enderecoDoSite);

  const ligada = await consultarUm<{ user_id: string; bloqueado: number }>(
    `SELECT i.user_id, u.bloqueado FROM identidades i JOIN usuarios u ON u.id = i.user_id
     WHERE i.provedor = 'google' AND i.provedor_id = ? LIMIT 1`,
    [g.sub],
  );
  if (ligada) {
    if (ligada.bloqueado) throw new GoogleRecusado("Esta conta está bloqueada.");
    return { ...(await abrirSessao(request, ligada.user_id)), criou: false };
  }

  const porEmail = await consultarUm<{ id: string; bloqueado: number }>(
    "SELECT id, bloqueado FROM usuarios WHERE email = ? LIMIT 1",
    [g.email],
  );
  if (porEmail) {
    if (porEmail.bloqueado) throw new GoogleRecusado("Esta conta está bloqueada.");
    // Ligar por e-mail dá acesso a uma conta que pode ter senha. Só vale se o Google
    // confirmou o endereço: senão bastaria criar uma conta Google com o e-mail alheio.
    if (!g.emailConfirmado) {
      throw new GoogleRecusado("O Google não confirmou este e-mail. Entre com a senha desta conta.");
    }
    await executar(
      "INSERT INTO identidades (id, user_id, provedor, provedor_id, email) VALUES (UUID(), ?, 'google', ?, ?)",
      [porEmail.id, g.sub, g.email],
    );
    return { ...(await abrirSessao(request, porEmail.id)), criou: false };
  }

  if (!g.emailConfirmado) throw new GoogleRecusado("O Google não confirmou este e-mail.");
  const userId = crypto.randomUUID();
  // Sem senha: `senha_hash` nulo. Quem entra pelo Google não tem senha para vazar, e o
  // caminho de "esqueci minha senha" simplesmente não encontra conta para recuperar.
  await executar(
    "INSERT INTO usuarios (id, email, email_confirmado_em) VALUES (?, ?, NOW(3))",
    [userId, g.email],
  );
  await executar(
    "INSERT INTO identidades (id, user_id, provedor, provedor_id, email) VALUES (UUID(), ?, 'google', ?, ?)",
    [userId, g.sub, g.email],
  );
  if (g.nome) {
    // O nome do Google só preenche o que está em branco: se a pessoa já escolheu como
    // quer ser chamada aqui, entrar pelo Google não desfaz essa escolha.
    await executar(
      `INSERT INTO profiles (id, nome_completo) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE nome_completo = COALESCE(profiles.nome_completo, VALUES(nome_completo))`,
      [userId, g.nome.slice(0, 120)],
    );
  }
  return { ...(await abrirSessao(request, userId)), criou: true };
}

export const paraTeste = { montarEstado, estadoValido, lerIdToken };

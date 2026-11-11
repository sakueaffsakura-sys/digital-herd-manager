/**
 * Entrar, sair e saber quem está do outro lado.
 *
 * Regras que valem para tudo aqui:
 * - a resposta de entrada errada é sempre a mesma, não importa se foi o e-mail ou a senha.
 *   Dizer qual dos dois errou entrega quais e-mails existem no site.
 * - quem está pedindo sai SEMPRE da sessão guardada no banco, nunca de algo que o
 *   navegador mandou. É o que impede alguém de se declarar administrador.
 * - tentativa errada é contada por e-mail e por endereço, e demais tentativas travam.
 */
import { consultar, consultarUm, executar, instanteUtc } from "@/lib/dados/banco.server";
import type { Quem } from "@/lib/dados/acesso";
import { allowRequest, clientIp } from "@/lib/rate-limit";
import { conferirSenha, ERRO_ENTRADA, guardarSenha } from "./senha";
import { cookieDaSessao, cookieDeSaida, novoToken, resumoDoToken, tokenDoPedido, validadeDaSessao } from "./sessao";

type LinhaUsuario = { id: string; email: string; senha_hash: string | null; bloqueado: number };

export class EntradaRecusada extends Error {
  readonly status = 401;
  constructor(mensagem = ERRO_ENTRADA) {
    super(mensagem);
    this.name = "EntradaRecusada";
  }
}

export class EntradaBloqueada extends Error {
  readonly status = 429;
  constructor(mensagem = "Muitas tentativas. Espere alguns minutos e tente de novo.") {
    super(mensagem);
    this.name = "EntradaBloqueada";
  }
}

/** Mesmo com e-mail inexistente, gasta um tempo parecido: senão o relógio entrega quem existe. */
const HASH_FALSO = "$2b$12$C6UzMDM.H6dfI/f/IKcEe.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

export async function entrar(request: Request, email: string, senha: string): Promise<{ quem: Quem; cookie: string }> {
  const endereco = clientIp(request);
  const alvo = (email ?? "").trim().toLowerCase();
  if (!allowRequest(`entrada:ip:${endereco}`, 10, 5 * 60_000, 10 * 60_000)) throw new EntradaBloqueada();
  if (!allowRequest(`entrada:conta:${alvo}`, 5, 5 * 60_000, 10 * 60_000)) throw new EntradaBloqueada();

  const usuario = await consultarUm<LinhaUsuario>(
    "SELECT id, email, senha_hash, bloqueado FROM usuarios WHERE email = ? LIMIT 1",
    [alvo],
  );
  const { confere, regravar } = await conferirSenha(senha ?? "", usuario?.senha_hash ?? HASH_FALSO);
  if (!usuario || !confere) throw new EntradaRecusada();
  if (usuario.bloqueado) throw new EntradaRecusada("Esta conta está bloqueada. Fale com o suporte.");

  if (regravar) {
    // A senha veio do login antigo com proteção mais fraca: regrava mais forte agora
    // que a senha está em mãos, sem pedir nada a quem entrou.
    await executar("UPDATE usuarios SET senha_hash = ? WHERE id = ?", [await guardarSenha(senha), usuario.id]);
  }
  return abrirSessao(request, usuario.id);
}

export async function abrirSessao(request: Request, userId: string): Promise<{ quem: Quem; cookie: string }> {
  const token = novoToken();
  const agora = new Date();
  await executar(
    "INSERT INTO sessoes (id, user_id, token_hash, criada_em, ultimo_uso, expira_em, navegador, ip) VALUES (?,?,?,?,?,?,?,?)",
    [
      crypto.randomUUID(),
      userId,
      resumoDoToken(token),
      instanteUtc(agora),
      instanteUtc(agora),
      instanteUtc(validadeDaSessao(agora)),
      (request.headers.get("user-agent") ?? "").slice(0, 500),
      clientIp(request).slice(0, 64),
    ],
  );
  await executar("UPDATE usuarios SET ultimo_acesso = ? WHERE id = ?", [instanteUtc(agora), userId]);
  return { quem: await montarQuem(userId), cookie: cookieDaSessao(token, agora) };
}

/** Monta quem é a pessoa a partir do banco: papel e fazendas nunca vêm do navegador. */
export async function montarQuem(userId: string): Promise<Quem> {
  const [papeis, fazendas] = await Promise.all([
    consultar<{ role: string }>("SELECT role FROM user_roles WHERE user_id = ?", [userId]),
    consultar<{ id: string }>(
      `SELECT p.id FROM propriedades p WHERE p.proprietario_id = ?
       UNION
       SELECT m.propriedade_id FROM propriedade_membros m WHERE m.user_id = ?`,
      [userId, userId],
    ),
  ]);
  return {
    userId,
    admin: papeis.some((p) => p.role === "administrador"),
    propriedades: fazendas.map((f) => f.id),
  };
}

/** Quem está do outro lado agora, ou nada. Renova a sessão que está sendo usada. */
export async function quemEsta(request: Request): Promise<Quem | null> {
  const token = tokenDoPedido(request);
  if (!token) return null;
  const agora = new Date();
  const sessao = await consultarUm<{ id: string; user_id: string; bloqueado: number }>(
    `SELECT s.id, s.user_id, u.bloqueado
     FROM sessoes s JOIN usuarios u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expira_em > ? LIMIT 1`,
    [resumoDoToken(token), instanteUtc(agora)],
  );
  if (!sessao || sessao.bloqueado) return null;
  await executar("UPDATE sessoes SET ultimo_uso = ?, expira_em = ? WHERE id = ?", [
    instanteUtc(agora),
    instanteUtc(validadeDaSessao(agora)),
    sessao.id,
  ]);
  return montarQuem(sessao.user_id);
}

export async function sair(request: Request): Promise<string> {
  const token = tokenDoPedido(request);
  if (token) await executar("DELETE FROM sessoes WHERE token_hash = ?", [resumoDoToken(token)]);
  return cookieDeSaida();
}

/** Ao trocar a senha, todas as outras sessões caem: senha trocada é senha comprometida. */
export async function derrubarOutrasSessoes(userId: string, tokenAtual?: string | null): Promise<number> {
  const { afetadas } = tokenAtual
    ? await executar("DELETE FROM sessoes WHERE user_id = ? AND token_hash <> ?", [userId, resumoDoToken(tokenAtual)])
    : await executar("DELETE FROM sessoes WHERE user_id = ?", [userId]);
  return afetadas;
}

/** Limpeza das sessões vencidas, para a tabela não crescer sem fim. */
export async function limparSessoesVencidas(): Promise<number> {
  const { afetadas } = await executar("DELETE FROM sessoes WHERE expira_em < ?", [instanteUtc()]);
  return afetadas;
}

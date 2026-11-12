/**
 * Senha da conta.
 *
 * As senhas que vêm do login antigo estão em bcrypt, e o bcrypt continua sendo usado
 * aqui para que ninguém precise trocar de senha na mudança de hospedagem. A biblioteca
 * é a de JavaScript puro de propósito: hospedagem compartilhada quase nunca compila
 * biblioteca nativa, e um login que não sobe é um site fora do ar.
 */
import bcrypt from "bcryptjs";

/** Custo do cálculo. Mais alto = mais lento para quem tenta adivinhar, e para o servidor. */
const CUSTO = 12;
export const TAMANHO_MINIMO = 8;

/** Senhas que aparecem em qualquer lista de senhas vazadas. Não adianta medir força: essas saem. */
const PROIBIDAS = new Set([
  "12345678", "123456789", "1234567890", "senha123", "password", "qwerty123",
  "pecuaria", "fazenda1", "11111111", "abcd1234", "admin123", "mudar123",
]);

export type ProblemaDaSenha = { ok: false; motivo: string } | { ok: true };

/** Diz, em português claro, por que a senha não serve. */
export function conferirForca(senha: string, email?: string): ProblemaDaSenha {
  const s = senha ?? "";
  if (s.length < TAMANHO_MINIMO) return { ok: false, motivo: `A senha precisa de pelo menos ${TAMANHO_MINIMO} caracteres.` };
  if (s.length > 200) return { ok: false, motivo: "A senha está longa demais." };
  if (PROIBIDAS.has(s.toLowerCase())) return { ok: false, motivo: "Essa senha é das mais usadas no mundo. Escolha outra." };
  if (/^(.)\1+$/.test(s)) return { ok: false, motivo: "A senha não pode ser o mesmo caractere repetido." };
  const apelido = email?.split("@")[0]?.toLowerCase();
  if (apelido && apelido.length >= 3 && s.toLowerCase().includes(apelido)) {
    return { ok: false, motivo: "A senha não pode conter o seu e-mail." };
  }
  return { ok: true };
}

export async function guardarSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, CUSTO);
}

/**
 * Confere a senha digitada. Devolve também se o registro precisa ser regravado, que é o
 * caso das senhas vindas do login antigo com custo menor que o nosso.
 */
export async function conferirSenha(senha: string, guardada: string | null): Promise<{ confere: boolean; regravar: boolean }> {
  if (!guardada) return { confere: false, regravar: false };
  let confere = false;
  try {
    confere = await bcrypt.compare(senha, guardada);
  } catch {
    confere = false; // registro estragado conta como senha errada, nunca como acerto
  }
  const custoGuardado = Number(guardada.split("$")[2] ?? 0);
  return { confere, regravar: confere && custoGuardado < CUSTO };
}

/**
 * Entrada em dois passos nunca deve dizer se foi o e-mail ou a senha que errou:
 * isso entrega quais e-mails existem. Esta é a única mensagem de erro de entrada.
 */
export const ERRO_ENTRADA = "E-mail ou senha não conferem.";

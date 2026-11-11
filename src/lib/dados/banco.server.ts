/**
 * Conversa com o MySQL.
 *
 * Dois cuidados que decidem se as datas vão ficar certas ou erradas no site inteiro:
 *
 * timezone "Z"  o MySQL guarda a hora sem dizer o fuso. Nós gravamos tudo em UTC, então
 *               a conexão precisa avisar que é UTC. Sem isso, a biblioteca entende a hora
 *               como se fosse do fuso da máquina e o horário sai deslocado.
 * dateStrings   coluna de DATA (sem hora) volta como texto "2026-11-10", e não como um
 *               instante. Virar instante é o que faz a data andar um dia para trás ou
 *               para frente conforme o fuso de quem lê.
 */
import mysql from "mysql2/promise";

let poolAtual: mysql.Pool | null = null;

function configuracao(): mysql.PoolOptions {
  const faltando = ["DB_HOST", "DB_USER", "DB_NAME"].filter((n) => !process.env[n]);
  if (faltando.length) {
    throw new Error(`Faltam dados de conexão com o banco: ${faltando.join(", ")}.`);
  }
  return {
    host: process.env["DB_HOST"],
    port: Number(process.env["DB_PORT"] ?? 3306),
    user: process.env["DB_USER"],
    password: process.env["DB_PASSWORD"] ?? "",
    database: process.env["DB_NAME"],
    // Hospedagem compartilhada costuma limitar as conexões simultâneas por conta.
    connectionLimit: Number(process.env["DB_CONEXOES"] ?? 6),
    waitForConnections: true,
    queueLimit: 0,
    timezone: "Z",
    dateStrings: ["DATE"] as never,
    charset: "utf8mb4_unicode_ci",
    supportBigNumbers: true,
    bigNumberStrings: false,
    // Uma chamada só nunca pode mandar vários comandos juntos: é o que transforma
    // uma falha de montagem de consulta em invasão por comando colado.
    multipleStatements: false,
  };
}

export function pool(): mysql.Pool {
  if (!poolAtual) poolAtual = mysql.createPool(configuracao());
  return poolAtual;
}

/** Para os testes: troca o pool por outro (ou devolve ao normal com null). */
export function usarPool(p: mysql.Pool | null): void {
  poolAtual = p;
}

/** O que o driver aceita como valor. Converter aqui evita espalhar conversão pelo código. */
type ValoresDoDriver = Parameters<mysql.Pool["execute"]>[1];
const valoresPara = (valores: readonly unknown[]) => valores as unknown as ValoresDoDriver;

export async function consultar<T = Record<string, unknown>>(sql: string, valores: readonly unknown[] = []): Promise<T[]> {
  const [linhas] = await pool().execute(sql, valoresPara(valores));
  return linhas as T[];
}

export async function consultarUm<T = Record<string, unknown>>(sql: string, valores: readonly unknown[] = []): Promise<T | null> {
  const linhas = await consultar<T>(sql, valores);
  return linhas[0] ?? null;
}

export async function executar(sql: string, valores: readonly unknown[] = []): Promise<{ afetadas: number }> {
  const [r] = await pool().execute(sql, valoresPara(valores));
  return { afetadas: (r as mysql.ResultSetHeader).affectedRows ?? 0 };
}

/** O mesmo `executar`, mas dentro de uma transação já aberta por `emTransacao`. */
export async function executarEm(
  conexao: mysql.PoolConnection,
  sql: string,
  valores: readonly unknown[] = [],
): Promise<{ afetadas: number }> {
  const [r] = await conexao.execute(sql, valoresPara(valores));
  return { afetadas: (r as mysql.ResultSetHeader).affectedRows ?? 0 };
}

/** Várias gravações que só valem juntas (gravar a venda e o lançamento financeiro, por exemplo). */
export async function emTransacao<T>(tarefa: (conexao: mysql.PoolConnection) => Promise<T>): Promise<T> {
  const conexao = await pool().getConnection();
  try {
    await conexao.beginTransaction();
    const resultado = await tarefa(conexao);
    await conexao.commit();
    return resultado;
  } catch (erro) {
    await conexao.rollback().catch(() => {});
    throw erro;
  } finally {
    conexao.release();
  }
}

/** Instante no jeito que o MySQL guarda: sempre UTC, com milissegundos. */
export function instanteUtc(quando: Date = new Date()): string {
  return quando.toISOString().replace("T", " ").replace("Z", "").slice(0, 23);
}

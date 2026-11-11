/**
 * A única porta de entrada aos dados.
 *
 * Nenhuma tela monta SQL. Tudo passa por aqui, e aqui toda consulta nasce com a condição
 * de acesso de quem pediu (src/lib/dados/acesso.ts) e com os nomes de coluna peneirados
 * pela lista do banco (src/lib/dados/colunas.ts).
 *
 * Valor nunca entra colado no texto da consulta: vai sempre separado, com "?". Nome de
 * coluna não pode ir separado (o banco não aceita), então ele é conferido contra a lista
 * e, se não existir, a consulta nem é montada.
 */
import { conferirGravacao, filtroDeLeitura, type Condicao, type Quem, AcessoNegado } from "./acesso";
import { colunaValida, COLUNAS_DA_TABELA, type Feitio } from "./colunas";
import { consultar, executar, instanteUtc } from "./banco.server";

export type Ordem = { coluna: string; crescente?: boolean };
export type Comparacao = "=" | "<>" | ">" | ">=" | "<" | "<=" | "contem" | "vazio" | "naoVazio" | "entre" | "em";
export type Filtro = { coluna: string; op: Comparacao; valor?: unknown; ate?: unknown };

export type Busca = {
  tabela: string;
  filtros?: readonly Filtro[];
  /** Procura o texto em várias colunas ao mesmo tempo. */
  texto?: { termo: string; colunas: readonly string[] };
  ordem?: readonly Ordem[];
  pagina?: number;
  porPagina?: number;
};

const POR_PAGINA_PADRAO = 25;
const POR_PAGINA_MAXIMO = 200;

function crase(nome: string): string {
  // O nome já foi conferido contra a lista; a crase é só para nome igual a palavra do SQL.
  return "`" + nome + "`";
}

function exigirColuna(tabela: string, coluna: string): Feitio {
  const feitio = colunaValida(tabela, coluna);
  if (!feitio) throw new AcessoNegado(`O campo "${coluna}" não existe nesta área.`);
  return feitio;
}

/** Ajeita o valor para o feitio da coluna, para o banco não ter de adivinhar. */
export function valorParaBanco(feitio: Feitio, valor: unknown): unknown {
  if (valor === undefined || valor === null || valor === "") return null;
  switch (feitio) {
    case "sim":
      return valor === true || valor === 1 || valor === "true" || valor === "1" ? 1 : 0;
    case "inteiro": {
      const n = Math.trunc(Number(valor));
      return Number.isFinite(n) ? n : null;
    }
    case "numero": {
      const n = Number(valor);
      return Number.isFinite(n) ? n : null;
    }
    case "instante":
      return valor instanceof Date ? instanteUtc(valor) : instanteUtc(new Date(String(valor)));
    case "data":
      return String(valor).slice(0, 10);
    case "json":
      return typeof valor === "string" ? valor : JSON.stringify(valor);
    default:
      return String(valor);
  }
}

function pedacoDoFiltro(tabela: string, f: Filtro): Condicao {
  const feitio = exigirColuna(tabela, f.coluna);
  const col = crase(f.coluna);
  switch (f.op) {
    case "vazio":
      return { sql: `${col} IS NULL`, valores: [] };
    case "naoVazio":
      return { sql: `${col} IS NOT NULL`, valores: [] };
    case "contem": {
      // Os curingas do próprio texto são escapados: quem procura "100%" procura isso mesmo.
      const termo = String(f.valor ?? "").replace(/[\\%_]/g, "\\$&");
      return { sql: `${col} LIKE ?`, valores: [`%${termo}%`] };
    }
    case "entre":
      return { sql: `${col} BETWEEN ? AND ?`, valores: [valorParaBanco(feitio, f.valor), valorParaBanco(feitio, f.ate)] };
    case "em": {
      const lista = Array.isArray(f.valor) ? f.valor : [];
      if (lista.length === 0) return { sql: "1 = 0", valores: [] };
      const marcas = lista.map(() => "?").join(",");
      return { sql: `${col} IN (${marcas})`, valores: lista.map((v) => valorParaBanco(feitio, v)) };
    }
    default:
      return { sql: `${col} ${f.op} ?`, valores: [valorParaBanco(feitio, f.valor)] };
  }
}

function montarOnde(tabela: string, quem: Quem, filtros: readonly Filtro[] = [], texto?: Busca["texto"]): Condicao {
  const partes: string[] = [];
  const valores: unknown[] = [];
  const acesso = filtroDeLeitura(tabela, quem);
  partes.push(`(${acesso.sql})`);
  valores.push(...acesso.valores);
  for (const f of filtros) {
    const p = pedacoDoFiltro(tabela, f);
    partes.push(`(${p.sql})`);
    valores.push(...p.valores);
  }
  if (texto && texto.termo.trim() && texto.colunas.length > 0) {
    const termo = texto.termo.trim().replace(/[\\%_]/g, "\\$&");
    const pedacos = texto.colunas.map((c) => {
      exigirColuna(tabela, c);
      valores.push(`%${termo}%`);
      return `${crase(c)} LIKE ?`;
    });
    partes.push(`(${pedacos.join(" OR ")})`);
  }
  return { sql: partes.join(" AND "), valores };
}

function montarOrdem(tabela: string, ordem: readonly Ordem[] = []): string {
  const pedacos = ordem.map((o) => {
    exigirColuna(tabela, o.coluna);
    return `${crase(o.coluna)} ${o.crescente ? "ASC" : "DESC"}`;
  });
  // A última ordenação é sempre o id, para a paginação não repetir nem pular linha em empate.
  if (colunaValida(tabela, "id")) pedacos.push("`id` ASC");
  return pedacos.length ? ` ORDER BY ${pedacos.join(", ")}` : "";
}

export async function listar<T = Record<string, unknown>>(quem: Quem, busca: Busca): Promise<{ linhas: T[]; total: number }> {
  const { tabela } = busca;
  if (!COLUNAS_DA_TABELA[tabela]) throw new AcessoNegado("Área desconhecida.");
  const onde = montarOnde(tabela, quem, busca.filtros, busca.texto);
  const porPagina = Math.min(Math.max(1, busca.porPagina ?? POR_PAGINA_PADRAO), POR_PAGINA_MAXIMO);
  const pagina = Math.max(1, busca.pagina ?? 1);
  const pulo = (pagina - 1) * porPagina;
  const [linhas, contagem] = await Promise.all([
    // Limite e pulo entram já conferidos como número, nunca como texto do navegador.
    consultar<T>(`SELECT * FROM ${crase(tabela)} WHERE ${onde.sql}${montarOrdem(tabela, busca.ordem)} LIMIT ${porPagina} OFFSET ${pulo}`, onde.valores),
    consultar<{ total: number }>(`SELECT COUNT(*) AS total FROM ${crase(tabela)} WHERE ${onde.sql}`, onde.valores),
  ]);
  return { linhas, total: Number(contagem[0]?.total ?? 0) };
}

export async function obter<T = Record<string, unknown>>(quem: Quem, tabela: string, id: string): Promise<T | null> {
  const { linhas } = await listar<T>(quem, { tabela, filtros: [{ coluna: "id", op: "=", valor: id }], porPagina: 1 });
  return linhas[0] ?? null;
}

/** Só as colunas que existem na tabela entram; o resto do que vier é descartado. */
function peneirar(tabela: string, linha: Record<string, unknown>): Record<string, unknown> {
  const limpa: Record<string, unknown> = {};
  for (const [chave, valor] of Object.entries(linha)) {
    const feitio = colunaValida(tabela, chave);
    if (feitio) limpa[chave] = valorParaBanco(feitio, valor);
  }
  return limpa;
}

export async function criar(quem: Quem, tabela: string, linha: Record<string, unknown>): Promise<string> {
  if (!COLUNAS_DA_TABELA[tabela]) throw new AcessoNegado("Área desconhecida.");
  const limpa = peneirar(tabela, linha);
  conferirGravacao(tabela, quem, limpa);
  if (colunaValida(tabela, "id") && !limpa["id"]) limpa["id"] = crypto.randomUUID();
  const colunas = Object.keys(limpa);
  if (colunas.length === 0) throw new AcessoNegado("Não há nada para gravar.");
  const marcas = colunas.map(() => "?").join(",");
  await executar(
    `INSERT INTO ${crase(tabela)} (${colunas.map(crase).join(",")}) VALUES (${marcas})`,
    colunas.map((c) => limpa[c]),
  );
  return String(limpa["id"] ?? "");
}

export async function atualizar(quem: Quem, tabela: string, id: string, mudancas: Record<string, unknown>): Promise<boolean> {
  if (!COLUNAS_DA_TABELA[tabela]) throw new AcessoNegado("Área desconhecida.");
  // Quem pode ver é quem pode mexer: se a linha não aparece para esta pessoa, não existe para ela.
  const atual = await obter<Record<string, unknown>>(quem, tabela, id);
  if (!atual) throw new AcessoNegado("Registro não encontrado.");
  const limpa = peneirar(tabela, mudancas);
  delete limpa["id"];
  // A fazenda de uma linha não muda por pedido do navegador: seria mover dado de uma fazenda
  // para outra. Quem quiser mudar, apaga e cria de novo, passando pelas mesmas conferências.
  delete limpa["propriedade_id"];
  delete limpa["user_id"];
  conferirGravacao(tabela, quem, { ...atual, ...limpa });
  const colunas = Object.keys(limpa);
  if (colunas.length === 0) return false;
  if (colunaValida(tabela, "updated_at")) limpa["updated_at"] = instanteUtc();
  const todas = Object.keys(limpa);
  const { afetadas } = await executar(
    `UPDATE ${crase(tabela)} SET ${todas.map((c) => `${crase(c)} = ?`).join(", ")} WHERE \`id\` = ?`,
    [...todas.map((c) => limpa[c]), id],
  );
  return afetadas > 0;
}

export async function apagar(quem: Quem, tabela: string, id: string): Promise<boolean> {
  if (!COLUNAS_DA_TABELA[tabela]) throw new AcessoNegado("Área desconhecida.");
  const atual = await obter<Record<string, unknown>>(quem, tabela, id);
  if (!atual) throw new AcessoNegado("Registro não encontrado.");
  conferirGravacao(tabela, quem, atual);
  const { afetadas } = await executar(`DELETE FROM ${crase(tabela)} WHERE \`id\` = ?`, [id]);
  return afetadas > 0;
}

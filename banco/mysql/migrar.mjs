/*
 * Lê os dados do banco atual (Supabase/PostgreSQL) e escreve o SQL para o MySQL novo.
 *
 * Como usar:
 *   SUPABASE_URL=...  SUPABASE_SERVICE_ROLE_KEY=...  node migrar.mjs
 *
 * Opções:
 *   --saida=pasta        onde gravar (padrão: ./dados)
 *   --marcas-dias=30     quantos dias de marcas de exclusão levar (padrão 30; 0 = nenhuma)
 *   --marcas-tudo        leva todas as marcas de exclusão, sem corte
 *
 * O que ele NÃO leva, de propósito:
 *   chaves_sistema  as chaves estão cifradas com uma chave que não existe no servidor novo;
 *                   viriam ilegíveis. Depois de migrar, cole as chaves de novo no painel.
 *   rate_limits     contador de uso do momento; nasce de novo sozinho.
 *   presenca_usuarios  quem estava online agora; não faz sentido levar.
 *
 * Nada é apagado do banco atual. Este programa só lê.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const args = new Map(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, "").split("=");
  return [k, v ?? "sim"];
}));

const URL_BASE = process.env["SUPABASE_URL"];
const CHAVE = process.env["SUPABASE_SERVICE_ROLE_KEY"];
if (!URL_BASE || !CHAVE) {
  console.error("Faltam SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.");
  process.exit(1);
}

const PASTA = args.get("saida") ?? join(AQUI, "dados");
const MARCAS_DIAS = args.has("marcas-tudo") ? null : Number(args.get("marcas-dias") ?? 30);
const NAO_LEVAR = new Set(["chaves_sistema", "rate_limits", "presenca_usuarios"]);

/** Tipo de cada coluna, lido do mesmo arquivo que gerou o esquema. */
function lerTipos() {
  const tipos = {};
  for (const linha of readFileSync(join(AQUI, "colunas.txt"), "utf8").trim().split("\n")) {
    const [tabela, ...cols] = linha.split("|");
    tipos[tabela] = {};
    for (const c of cols) {
      const [nome, tipo] = c.split(":");
      // Coluna calculada pelo próprio banco (valor_total do leite): o MySQL recusa
      // receber valor nela, então ela não entra no INSERT.
      if (c.includes(":GERADA=")) continue;
      tipos[tabela][nome] = tipo;
    }
  }
  return tipos;
}

/** Coluna que ordena a leitura em páginas, para nenhuma linha vir duas vezes nem faltar. */
function lerChaves() {
  const pk = {};
  for (const linha of readFileSync(join(AQUI, "chaves.txt"), "utf8").trim().split("\n")) {
    const [tabela, tipo, cols] = linha.split(" ");
    if (tipo === "PK") pk[tabela] = cols.split(",");
  }
  return pk;
}

const aspas = (t) => "'" + String(t).replace(/\\/g, "\\\\").replace(/'/g, "''").replace(/\0/g, "") + "'";

/** Converte um valor do PostgreSQL para o jeito do MySQL. */
function valorSql(valor, tipo) {
  if (valor === null || valor === undefined) return "NULL";
  if (tipo === "boolean") return valor ? "1" : "0";
  if (tipo && tipo.startsWith("timestamp")) {
    // Guardamos sempre em UTC: o MySQL não leva o fuso junto com a hora.
    const d = new Date(valor);
    if (Number.isNaN(d.getTime())) return "NULL";
    return aspas(d.toISOString().replace("T", " ").replace("Z", "").slice(0, 23));
  }
  if (tipo === "date") return aspas(String(valor).slice(0, 10));
  if (tipo === "jsonb" || tipo === "json" || tipo === "ARRAY") return aspas(JSON.stringify(valor));
  if (typeof valor === "number") return String(valor);
  if (typeof valor === "object") return aspas(JSON.stringify(valor));
  // numeric chega como texto do PostgREST; vai sem aspas quando é mesmo um número.
  if (/^-?\d+(\.\d+)?$/.test(String(valor)) && tipo !== "text" && tipo !== "uuid") return String(valor);
  return aspas(valor);
}

async function lerPagina(tabela, ordem, inicio, tamanho, filtro = "") {
  const url = `${URL_BASE}/rest/v1/${tabela}?select=*&order=${ordem}&limit=${tamanho}&offset=${inicio}${filtro}`;
  const r = await fetch(url, { headers: { apikey: CHAVE, Authorization: `Bearer ${CHAVE}` } });
  if (!r.ok) throw new Error(`${tabela}: ${r.status} ${await r.text()}`);
  return r.json();
}

const tipos = lerTipos();
const pks = lerChaves();
const ordemTabelas = readFileSync(join(AQUI, "ordem.txt"), "utf8").trim().split("\n");

mkdirSync(PASTA, { recursive: true });
const resumo = [];
let arquivo = 1;
let linhasNoArquivo = 0;
let buffer = ["SET NAMES utf8mb4;", "SET FOREIGN_KEY_CHECKS = 0;", ""];

function gravarArquivo() {
  if (linhasNoArquivo === 0) return;
  buffer.push("SET FOREIGN_KEY_CHECKS = 1;", "");
  const nome = join(PASTA, `dados-${String(arquivo).padStart(2, "0")}.sql`);
  writeFileSync(nome, buffer.join("\n"), "utf8");
  console.log(`  gravado ${nome} (${linhasNoArquivo} linhas)`);
  arquivo++;
  linhasNoArquivo = 0;
  buffer = ["SET NAMES utf8mb4;", "SET FOREIGN_KEY_CHECKS = 0;", ""];
}

for (const tabela of ordemTabelas) {
  if (NAO_LEVAR.has(tabela)) {
    resumo.push(`${tabela}: não levado de propósito`);
    continue;
  }
  let filtro = "";
  if (tabela === "registros_excluidos" && MARCAS_DIAS !== null) {
    const corte = new Date(Date.now() - MARCAS_DIAS * 86400000).toISOString();
    filtro = `&excluido_em=gte.${corte}`;
  }
  const ordem = (pks[tabela] ?? ["id"]).join(",");
  let inicio = 0;
  let total = 0;
  const colunas = Object.keys(tipos[tabela]);
  for (;;) {
    const linhas = await lerPagina(tabela, ordem, inicio, 1000, filtro);
    if (linhas.length === 0) break;
    for (const linha of linhas) {
      const valores = colunas.map((c) => valorSql(linha[c], tipos[tabela][c])).join(",");
      buffer.push(`INSERT INTO \`${tabela}\` (${colunas.map((c) => "`" + c + "`").join(",")}) VALUES (${valores});`);
      linhasNoArquivo++;
      // Arquivos de no máximo 20 mil linhas: o phpMyAdmin engasga com arquivo grande.
      if (linhasNoArquivo >= 20000) gravarArquivo();
    }
    total += linhas.length;
    inicio += linhas.length;
    if (linhas.length < 1000) break;
  }
  resumo.push(`${tabela}: ${total}`);
  if (total > 0) console.log(`${tabela}: ${total} linha(s)`);
}
gravarArquivo();

writeFileSync(join(PASTA, "resumo.txt"), resumo.join("\n") + "\n", "utf8");
console.log(`\nResumo em ${join(PASTA, "resumo.txt")}`);
if (MARCAS_DIAS !== null) {
  console.log(`As marcas de exclusão levadas foram só as dos últimos ${MARCAS_DIAS} dias.`);
  console.log("Use --marcas-tudo para levar todas (o arquivo fica muito maior).");
}
console.log("Nada foi apagado do banco atual.");

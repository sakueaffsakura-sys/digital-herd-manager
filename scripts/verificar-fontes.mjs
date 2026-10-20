#!/usr/bin/env node
// Verificação estática rápida do código-fonte (não precisa de build nem de rede):
//   1. erros de sintaxe em todos os .ts/.tsx;
//   2. imports relativos e "@/..." que apontam para arquivo que não existe;
//   3. imports nomeados que o módulo local não exporta;
//   4. pacotes importados que não estão no package.json;
//   5. tabelas e funções do Supabase usadas no código que não existem em src/integrations/supabase/types.ts.
// Uso: node scripts/verificar-fontes.mjs   (sai com código 1 se achar problema)
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
let ts;
try { ts = require("typescript"); } catch {
  console.error("typescript não encontrado. Rode `bun install` (ou npm install) primeiro.");
  process.exit(2);
}

const pkg = JSON.parse(readFileSync(join(raiz, "package.json"), "utf8"));
const declarados = new Set([...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})]);
const embutidos = new Set(require("node:module").builtinModules);

function listar(dir, acc = []) {
  for (const nome of readdirSync(dir)) {
    if (nome === "node_modules" || nome.startsWith(".")) continue;
    const p = join(dir, nome);
    const st = statSync(p);
    if (st.isDirectory()) listar(p, acc);
    else if (/\.(ts|tsx)$/.test(nome) && !nome.endsWith(".d.ts")) acc.push(p);
  }
  return acc;
}

const arquivos = [...listar(join(raiz, "src")), ...listar(join(raiz, "scripts"))].filter(() => true);
const erros = [];
const erro = (arq, msg) => erros.push(`${relative(raiz, arq)}: ${msg}`);

const EXT = ["", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".json", ".css", "/index.ts", "/index.tsx"];
const resolverLocal = (base) => EXT.map((e) => base + e).find((c) => existsSync(c) && statSync(c).isFile());

// Pré-carrega os exports de cada arquivo local
const infos = new Map();
function lerInfo(arq) {
  if (infos.has(arq)) return infos.get(arq);
  const texto = readFileSync(arq, "utf8");
  const sf = ts.createSourceFile(arq, texto, ts.ScriptTarget.Latest, true, arq.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const exports = new Set();
  let estrela = false;
  const imports = [];
  const sintaxe = sf.parseDiagnostics ?? [];
  for (const st of sf.statements) {
    const mods = ts.canHaveModifiers(st) ? ts.getModifiers(st) ?? [] : [];
    const exportado = mods.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    const padrao = mods.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);
    if (exportado) {
      if (padrao) exports.add("default");
      if (ts.isVariableStatement(st)) st.declarationList.declarations.forEach((d) => ts.isIdentifier(d.name) ? exports.add(d.name.text) : d.name.elements?.forEach((e) => e.name && ts.isIdentifier(e.name) && exports.add(e.name.text)));
      else if (st.name) exports.add(st.name.text);
    }
    if (ts.isExportAssignment(st)) exports.add("default");
    if (ts.isExportDeclaration(st)) {
      if (!st.exportClause) estrela = true;
      else if (ts.isNamedExports(st.exportClause)) st.exportClause.elements.forEach((e) => exports.add(e.name.text));
      else if (ts.isNamespaceExport(st.exportClause)) exports.add(st.exportClause.name.text);
      if (st.moduleSpecifier) imports.push({ spec: st.moduleSpecifier.text, nomes: [], reexport: true });
    }
    if (ts.isImportDeclaration(st) && ts.isStringLiteral(st.moduleSpecifier)) {
      const nomes = [];
      const ic = st.importClause;
      const soTipo = ic?.isTypeOnly ?? false;
      if (ic?.name) nomes.push("default");
      if (ic?.namedBindings && ts.isNamedImports(ic.namedBindings)) ic.namedBindings.elements.forEach((e) => nomes.push((e.propertyName ?? e.name).text));
      imports.push({ spec: st.moduleSpecifier.text, nomes, soTipo });
    }
  }
  // import("...") dinâmico
  const visita = (n) => {
    if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword && n.arguments[0] && ts.isStringLiteral(n.arguments[0])) imports.push({ spec: n.arguments[0].text, nomes: [], dinamico: true });
    ts.forEachChild(n, visita);
  };
  visita(sf);
  const info = { texto, sf, exports, estrela, imports, sintaxe };
  infos.set(arq, info);
  return info;
}

for (const arq of arquivos) {
  const info = lerInfo(arq);
  for (const d of info.sintaxe) {
    const { line } = info.sf.getLineAndCharacterOfPosition(d.start ?? 0);
    erro(arq, `sintaxe (linha ${line + 1}): ${ts.flattenDiagnosticMessageText(d.messageText, " ")}`);
  }
  for (const imp of info.imports) {
    const s = imp.spec.replace(/\?.*$/, ""); // "arquivo.css?url" (Vite) -> "arquivo.css"
    let alvo = null;
    if (s.startsWith("@/")) alvo = resolverLocal(join(raiz, "src", s.slice(2)));
    else if (s.startsWith(".")) alvo = resolverLocal(resolve(dirname(arq), s));
    else {
      if (s.startsWith("node:") || embutidos.has(s)) continue;
      const nome = s.startsWith("@") ? s.split("/").slice(0, 2).join("/") : s.split("/")[0];
      if (!declarados.has(nome) && !/^(virtual:|cloudflare:|~)/.test(s)) erro(arq, `pacote "${nome}" é importado mas não está no package.json`);
      continue;
    }
    if (!alvo) { erro(arq, `import "${s}" não encontra o arquivo`); continue; }
    if (!/\.(ts|tsx)$/.test(alvo) || imp.soTipo || imp.dinamico) continue;
    const alvoInfo = lerInfo(alvo);
    if (alvoInfo.estrela) continue;
    for (const n of imp.nomes) {
      if (!alvoInfo.exports.has(n)) erro(arq, `"${n}" não é exportado por ${relative(raiz, alvo)}`);
    }
  }
}

// ---- Supabase: tabelas, views e funções usadas × tipos gerados ----
try {
  const tipos = readFileSync(join(raiz, "src/integrations/supabase/types.ts"), "utf8");
  const bloco = (nome) => {
    const i = tipos.indexOf(`${nome}: {`);
    if (i < 0) return "";
    let prof = 0, j = tipos.indexOf("{", i);
    const ini = j;
    for (; j < tipos.length; j++) { if (tipos[j] === "{") prof++; else if (tipos[j] === "}" && --prof === 0) break; }
    return tipos.slice(ini, j);
  };
  const chaves = (txt) => new Set([...txt.matchAll(/^\s{6}(\w+): \{/gm)].map((m) => m[1]));
  const tabelas = new Set([...chaves(bloco("Tables")), ...chaves(bloco("Views"))]);
  const funcoes = chaves(bloco("Functions"));
  for (const arq of arquivos) {
    if (arq.endsWith("types.ts")) continue;
    const { texto } = lerInfo(arq);
    for (const m of texto.matchAll(/\.from\(\s*["'`]([a-z_0-9]+)["'`]/g)) {
      if (!tabelas.has(m[1]) && !/storage/.test(texto.slice(Math.max(0, m.index - 40), m.index))) erro(arq, `tabela/view "${m[1]}" não existe em types.ts`);
    }
    for (const m of texto.matchAll(/\.rpc\(\s*["'`]([a-z_0-9]+)["'`]/g)) if (!funcoes.has(m[1])) erro(arq, `função "${m[1]}" não existe em types.ts`);
    for (const m of texto.matchAll(/\brpc\(\s*["'`]([a-z_0-9]+)["'`]/g)) if (!funcoes.has(m[1])) erro(arq, `função "${m[1]}" não existe em types.ts`);
  }
} catch (e) {
  erro(join(raiz, "src/integrations/supabase/types.ts"), `não foi possível conferir tabelas/funções: ${e.message}`);
}

const unicos = [...new Set(erros)];
if (unicos.length) {
  console.error(`✖ ${unicos.length} problema(s) em ${arquivos.length} arquivos:\n` + unicos.map((e) => "  - " + e).join("\n"));
  process.exit(1);
}
console.log(`✔ ${arquivos.length} arquivos conferidos: sintaxe, imports, exports, pacotes e tabelas/funções do Supabase.`);

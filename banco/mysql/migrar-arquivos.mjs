/*
 * Baixa os arquivos do Supabase Storage e grava na pasta da hospedagem nova.
 *
 * É o irmão do migrar.mjs: aquele leva os dados, este leva os eBooks, o APK, as capas e as
 * imagens de perfil e de fazenda.
 *
 * Como usar, no servidor novo:
 *   SUPABASE_URL=...  SUPABASE_SERVICE_ROLE_KEY=...  ARQUIVOS_DIR=/home/suaconta/arquivos-pecuaria  \
 *     node migrar-arquivos.mjs
 *
 * Opções:
 *   --so=ebooks,aplicativo   leva só estes baldes (padrão: todos)
 *   --refazer                baixa de novo o que já está na pasta (padrão: pula)
 *   --conferir               não grava nada; só diz o que falta e o que já está lá
 *
 * Nada é apagado do Supabase. Este programa só lê de lá.
 *
 * Dá para rodar quantas vezes quiser: o que já chegou é pulado, e o que falhou no meio
 * entra na próxima rodada. Numa conexão de fazenda isso não é luxo — é como o APK de 60 MB
 * chega sem precisar começar do zero a cada queda.
 */
import { createWriteStream, existsSync, mkdirSync, statSync } from "node:fs";
import { readdir, rm } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const args = new Map(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, "").split("=");
  return [k, v ?? "sim"];
}));

const URL_BASE = process.env["SUPABASE_URL"];
const CHAVE = process.env["SUPABASE_SERVICE_ROLE_KEY"];
const DESTINO = process.env["ARQUIVOS_DIR"];

if (!URL_BASE || !CHAVE) {
  console.error("Faltam SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
if (!DESTINO) {
  console.error("Falta ARQUIVOS_DIR: a pasta onde os arquivos vão morar (FORA de public_html).");
  process.exit(1);
}
// Um engano que custaria caro: a pasta dentro de public_html é servida pelo Apache direto,
// e os eBooks são pagos.
if (/[\\/]public_html([\\/]|$)/.test(DESTINO)) {
  console.error("ARQUIVOS_DIR está dentro de public_html. Os arquivos ficariam abertos a quem");
  console.error("adivinhasse o endereço. Use uma pasta ao lado, por exemplo:");
  console.error("  /home/suaconta/arquivos-pecuaria");
  process.exit(1);
}

/** Os mesmos baldes do site. O nome tem de bater com o de `arquivos/armazem.server.ts`. */
const BALDES = ["ebooks", "ebook-capas", "aplicativo", "yui-chat-wallpapers",
  "profile-avatars", "property-logos", "property-banners", "property-images"];

const escolhidos = args.has("so")
  ? String(args.get("so")).split(",").map((b) => b.trim()).filter((b) => BALDES.includes(b))
  : BALDES;
const soConferir = args.has("conferir");
const refazer = args.has("refazer");

const cabecalhos = { apikey: CHAVE, authorization: `Bearer ${CHAVE}` };

/** Lista tudo de um balde, inclusive o que está dentro de pastas. */
async function listar(balde, prefixo = "") {
  const achados = [];
  let pagina = 0;
  for (;;) {
    const r = await fetch(`${URL_BASE}/storage/v1/object/list/${balde}`, {
      method: "POST",
      headers: { ...cabecalhos, "content-type": "application/json" },
      body: JSON.stringify({ prefix: prefixo, limit: 100, offset: pagina * 100, sortBy: { column: "name", order: "asc" } }),
    });
    if (!r.ok) throw new Error(`Não deu para listar ${balde}/${prefixo}: ${r.status}`);
    const itens = await r.json();
    if (!Array.isArray(itens) || itens.length === 0) break;
    for (const item of itens) {
      const caminho = prefixo ? `${prefixo}/${item.name}` : item.name;
      // Pasta vem sem metadados; arquivo vem com tamanho.
      if (item.id === null || item.metadata === null) achados.push(...await listar(balde, caminho));
      else achados.push({ caminho, bytes: item.metadata?.size ?? null });
    }
    if (itens.length < 100) break;
    pagina++;
  }
  return achados;
}

/** O caminho no disco, fechado dentro da pasta do balde — a mesma regra do site. */
function destinoDe(balde, caminho) {
  const raiz = resolve(DESTINO, balde);
  const cheio = resolve(raiz, caminho.replace(/^\/+/, ""));
  if (cheio !== raiz && !cheio.startsWith(raiz + sep)) {
    throw new Error(`Caminho suspeito, recusado: ${balde}/${caminho}`);
  }
  return cheio;
}

/**
 * Baixa um arquivo. Escreve primeiro num nome temporário e só então renomeia: se a conexão
 * cair no meio, o que fica na pasta é um arquivo pela metade com nome de temporário, e não
 * um eBook truncado com nome de eBook — que a próxima rodada pularia por já existir.
 */
async function baixar(balde, caminho, destino) {
  const r = await fetch(`${URL_BASE}/storage/v1/object/${balde}/${encodeURI(caminho)}`, { headers: cabecalhos });
  if (!r.ok || !r.body) throw new Error(`falha ao baixar (${r.status})`);
  mkdirSync(dirname(destino), { recursive: true });
  const temporario = `${destino}.baixando`;
  try {
    await pipeline(Readable.fromWeb(r.body), createWriteStream(temporario));
    const { renameSync } = await import("node:fs");
    renameSync(temporario, destino);
  } catch (erro) {
    await rm(temporario, { force: true });
    throw erro;
  }
}

const emMb = (b) => (b == null ? "?" : (b / 1024 / 1024).toFixed(1));

console.log(soConferir ? "== Conferindo (nada será gravado) ==" : "== Levando os arquivos ==");
console.log(`   de:   ${URL_BASE}`);
console.log(`   para: ${DESTINO}\n`);

let levados = 0, pulados = 0, falhas = 0, bytes = 0;

for (const balde of escolhidos) {
  let itens;
  try {
    itens = await listar(balde);
  } catch (erro) {
    console.log(`${balde}: não deu para listar — ${erro.message}`);
    falhas++;
    continue;
  }
  if (itens.length === 0) {
    console.log(`${balde}: vazio`);
    continue;
  }
  console.log(`${balde}: ${itens.length} arquivo(s)`);

  for (const item of itens) {
    const destino = destinoDe(balde, item.caminho);
    // Já está lá, do mesmo tamanho: não baixa de novo.
    if (!refazer && existsSync(destino) && (item.bytes == null || statSync(destino).size === item.bytes)) {
      pulados++;
      continue;
    }
    if (soConferir) {
      console.log(`   falta  ${item.caminho} (${emMb(item.bytes)} MB)`);
      levados++;
      continue;
    }
    try {
      await baixar(balde, item.caminho, destino);
      bytes += item.bytes ?? statSync(destino).size;
      levados++;
      console.log(`   ok     ${item.caminho} (${emMb(item.bytes)} MB)`);
    } catch (erro) {
      falhas++;
      console.log(`   FALHA  ${item.caminho} — ${erro.message}`);
    }
  }
}

console.log();
if (soConferir) {
  console.log(`${levados} por levar · ${pulados} já estão lá · ${falhas} balde(s) sem resposta`);
} else {
  console.log(`${levados} levados (${emMb(bytes)} MB) · ${pulados} já estavam lá · ${falhas} falha(s)`);
}
if (falhas > 0) {
  console.log("\nRode de novo: o que já chegou é pulado e só o que faltou é baixado.");
  process.exit(1);
}

// Uma conferência que não custa nada e pega o engano mais caro.
try {
  const dentro = await readdir(join(DESTINO, "ebooks")).catch(() => []);
  if (dentro.length > 0) {
    console.log("\nConfira uma vez, pelo navegador, que esta pasta NÃO abre pela web:");
    console.log(`   ${join(DESTINO, "ebooks")}`);
    console.log("Se abrir, ela está dentro de public_html e precisa sair de lá.");
  }
} catch {
  /* conferência de cortesia */
}

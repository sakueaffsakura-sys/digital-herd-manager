// Fotos das telas para conferir o visual (roda no GitHub Actions, workflow "Capturas").
// Uso: BASE_URL=http://127.0.0.1:5173 PW_DIR=/tmp/pw node scripts/capturas/capturar.mjs
// O Supabase é simulado (scripts/capturas/mock.mjs): nenhuma chamada chega ao banco real.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { responderRest, sessaoFalsa, usuarioAuth } from "./mock.mjs";

const require = createRequire(`${process.env.PW_DIR ?? "/tmp/pw"}/`);
const { chromium } = require("playwright");

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:5173";
const SAIDA = process.env.SAIDA ?? "capturas";
const REF = "ccdctoudetbyfpwqdiip";
mkdirSync(SAIDA, { recursive: true });

const TAMANHOS = {
  computador: { width: 1440, height: 900 },
  celular: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  celular360: { width: 360, height: 780, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
};

/** Cada cena: caminho, se está logado, se é admin, tamanhos, temas e uma ação opcional antes da foto. */
const CENAS = [
  { nome: "entrar", caminho: "/", logado: false, tamanhos: ["computador", "celular"], temas: ["light", "dark"] },
  { nome: "recuperar-senha", caminho: "/recuperar-senha", logado: false, tamanhos: ["computador", "celular360"], temas: ["light"] },
  { nome: "redefinir-senha", caminho: "/redefinir-senha", logado: false, tamanhos: ["celular360"], temas: ["light"] },
  { nome: "inicio", caminho: "/app/inicio", logado: true, tamanhos: ["computador", "celular", "celular360"], temas: ["light", "dark"] },
  { nome: "rebanho", caminho: "/app/rebanho", logado: true, tamanhos: ["computador", "celular360"], temas: ["light"] },
  { nome: "vacinacao", caminho: "/app/vacinacao", logado: true, tamanhos: ["computador"], temas: ["light", "dark"] },
  { nome: "producao", caminho: "/app/producao", logado: true, tamanhos: ["computador"], temas: ["light"] },
  { nome: "financeiro", caminho: "/app/financeiro", logado: true, tamanhos: ["computador"], temas: ["light"] },
  { nome: "relatorios", caminho: "/app/relatorios", logado: true, tamanhos: ["computador"], temas: ["light"] },
  { nome: "perfil", caminho: "/app/perfil", logado: true, tamanhos: ["computador"], temas: ["light"] },
  { nome: "admin", caminho: "/admin", logado: true, admin: true, tamanhos: ["computador"], temas: ["light"] },
];

const filtro = process.env.CENAS ? new Set(process.env.CENAS.split(",")) : null;
const relatorio = [];
const browser = await chromium.launch();

for (const cena of CENAS) {
  if (filtro && !filtro.has(cena.nome)) continue;
  for (const tamanho of cena.tamanhos) {
    for (const tema of cena.temas) {
      const arquivo = `${cena.nome}--${tamanho}--${tema === "dark" ? "escuro" : "claro"}.png`;
      const info = { arquivo, caminho: cena.caminho, erros: [], falhas: [], estouroHorizontal: false, fontes: {} };
      const context = await browser.newContext({
        ...TAMANHOS[tamanho], colorScheme: tema, locale: "pt-BR", timezoneId: "America/Sao_Paulo",
      });
      const sessao = sessaoFalsa();
      if (cena.logado) {
        await context.addInitScript(({ chave, valor }) => {
          try { localStorage.setItem(chave, valor); } catch { /* sem armazenamento */ }
        }, { chave: `sb-${REF}-auth-token`, valor: JSON.stringify(sessao) });
      }
      await context.route((url) => url.hostname.endsWith(".supabase.co"), async (route) => {
        const req = route.request();
        const url = new URL(req.url());
        const caminho = url.pathname;
        const headers = req.headers();
        if (caminho.startsWith("/auth/v1/")) {
          const fim = caminho.slice("/auth/v1/".length);
          if (fim === "user") {
            return cena.logado
              ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(usuarioAuth()) })
              : route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ code: 401, msg: "No session" }) });
          }
          if (fim.startsWith("token")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(sessao) });
          if (fim === "logout") return route.fulfill({ status: 204, body: "" });
          if (fim === "recover") return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
          if (fim.startsWith("factors")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ all: [], totp: [], phone: [] }) });
          return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
        }
        if (caminho.startsWith("/rest/v1/")) {
          const r = responderRest({
            caminho: caminho.slice("/rest/v1/".length), metodo: req.method(), params: url.searchParams,
            cabecalhos: headers, admin: !!cena.admin,
          });
          return route.fulfill({ status: r.status, headers: r.headers, body: r.body });
        }
        // Storage, funções e tempo real: nada a mostrar nas fotos.
        return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ message: "não encontrado" }) });
      });
      const page = await context.newPage();
      page.on("console", (m) => { if (m.type() === "error") info.erros.push(m.text().slice(0, 300)); });
      page.on("pageerror", (e) => info.erros.push(`pageerror: ${String(e.message).slice(0, 300)}`));
      page.on("requestfailed", (r) => {
        const u = r.url();
        if (!u.includes("supabase.co")) info.falhas.push(`${r.failure()?.errorText ?? "falhou"} ${u.slice(0, 160)}`);
      });
      try {
        await page.goto(`${BASE}${cena.caminho}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
        await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
        if (cena.acao) await cena.acao(page);
        await page.waitForTimeout(1200);
        info.urlFinal = page.url().replace(BASE, "");
        info.estouroHorizontal = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
        info.fontes = await page.evaluate(async () => {
          await document.fonts.ready;
          const fam = new Set();
          document.fonts.forEach((f) => { if (f.status === "loaded") fam.add(f.family.replace(/"/g, "")); });
          return [...fam];
        });
        await page.screenshot({ path: join(SAIDA, arquivo), fullPage: true });
      } catch (e) {
        info.erros.push(`captura: ${String(e).slice(0, 300)}`);
      }
      relatorio.push(info);
      await context.close();
      console.log(`${arquivo}: ${info.erros.length} erro(s)${info.estouroHorizontal ? ", ESTOURO HORIZONTAL" : ""} → ${info.urlFinal ?? "?"}`);
    }
  }
}

await browser.close();
writeFileSync(join(SAIDA, "relatorio.json"), JSON.stringify(relatorio, null, 2));

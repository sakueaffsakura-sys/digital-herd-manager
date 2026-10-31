// Fotos das telas para conferir o visual (roda no GitHub Actions, workflow "Capturas").
// Uso: BASE_URL=http://127.0.0.1:5173 PW_DIR=/tmp/pw node scripts/capturas/capturar.mjs
// O Supabase é simulado (scripts/capturas/servidor-mock.mjs): nenhuma chamada chega ao banco real.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sessaoFalsa } from "./mock.mjs";

const require = createRequire(`${process.env.PW_DIR ?? "/tmp/pw"}/`);
const { chromium } = require("playwright");

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:5173";
const SAIDA = process.env.SAIDA ?? "capturas";
// O site aponta para o Supabase de mentira (servidor-mock.mjs); a chave da sessão usa o "nome" do host.
const MOCK = process.env.MOCK_URL ?? "http://127.0.0.1:54321";
const CHAVE_SESSAO = `sb-${new URL(MOCK).hostname.split(".")[0]}-auth-token`;
mkdirSync(SAIDA, { recursive: true });

const TAMANHOS = {
  computador: { viewport: { width: 1440, height: 900 } },
  celular: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  celular360: { viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
};

/** Abre uma aba do painel do administrador pelo menu lateral. */
const abaAdmin = (nome) => async (page) => {
  await page.getByRole("button", { name: new RegExp(`^${nome}`) }).first().click();
  await page.waitForTimeout(1500);
};

/** Cada cena: caminho, se está logado, se é admin/assinante, tamanhos, temas e uma ação opcional antes da foto. */
const CENAS = [
  { nome: "entrar", caminho: "/", logado: false, tamanhos: ["computador", "celular"], temas: ["light", "dark"] },
  { nome: "recuperar-senha", caminho: "/recuperar-senha", logado: false, tamanhos: ["computador", "celular360"], temas: ["light"] },
  { nome: "redefinir-senha", caminho: "/redefinir-senha", logado: false, tamanhos: ["celular360"], temas: ["light"] },
  { nome: "inicio", caminho: "/app/inicio", logado: true, tamanhos: ["computador", "celular", "celular360"], temas: ["light", "dark"] },
  { nome: "rebanho", caminho: "/app/rebanho", logado: true, tamanhos: ["computador", "celular360"], temas: ["light"] },
  { nome: "agenda", caminho: "/app/agenda", logado: true, tamanhos: ["computador", "celular360"], temas: ["light"] },
  { nome: "seguranca", caminho: "/app/seguranca", logado: true, tamanhos: ["computador"], temas: ["light"] },
  { nome: "privacidade", caminho: "/privacidade", logado: false, tamanhos: ["celular360"], temas: ["light"] },
  { nome: "ficha-animal", caminho: "/app/rebanho?animal=00000000-0000-4000-8000-000000000020", logado: true, tamanhos: ["computador"], temas: ["light"] },
  { nome: "lancar", caminho: "/app/inicio", logado: true, tamanhos: ["celular360"], temas: ["light"], acao: async (page) => { await page.getByRole("button", { name: "Lançar" }).click(); await page.waitForTimeout(600); } },
  { nome: "vacinacao", caminho: "/app/vacinacao", logado: true, tamanhos: ["computador"], temas: ["light", "dark"] },
  { nome: "producao", caminho: "/app/producao", logado: true, tamanhos: ["computador"], temas: ["light"] },
  { nome: "financeiro", caminho: "/app/financeiro", logado: true, tamanhos: ["computador"], temas: ["light"] },
  { nome: "relatorios", caminho: "/app/relatorios", logado: true, tamanhos: ["computador"], temas: ["light"] },
  { nome: "perfil", caminho: "/app/perfil", logado: true, tamanhos: ["computador"], temas: ["light"] },
  { nome: "assinatura", caminho: "/app/assinatura", logado: true, tamanhos: ["computador", "celular360"], temas: ["light"] },
  { nome: "assinatura-ativa", caminho: "/app/assinatura", logado: true, assinante: true, tamanhos: ["computador"], temas: ["light"] },
  { nome: "biblioteca-bloqueada", caminho: "/app/biblioteca", logado: true, tamanhos: ["celular360"], temas: ["light"] },
  { nome: "biblioteca", caminho: "/app/biblioteca", logado: true, assinante: true, tamanhos: ["computador", "celular360"], temas: ["light", "dark"] },
  { nome: "leitor-ebook", caminho: "/app/biblioteca?ebook=00000000-0000-4000-8000-000000000101", logado: true, assinante: true, tamanhos: ["computador", "celular360"], temas: ["light"] },
  { nome: "indicadores", caminho: "/app/indicadores", logado: true, tamanhos: ["computador", "celular360"], temas: ["light", "dark"] },
  { nome: "ferramentas", caminho: "/app/ferramentas", logado: true, tamanhos: ["computador", "celular360"], temas: ["light"] },
  { nome: "aplicativo", caminho: "/app/aplicativo", logado: true, tamanhos: ["computador", "celular360"], temas: ["light"] },
  { nome: "ajuda", caminho: "/app/ajuda", logado: true, tamanhos: ["computador", "celular360"], temas: ["light"] },
  { nome: "admin", caminho: "/admin", logado: true, admin: true, tamanhos: ["computador", "celular360"], temas: ["light"] },
  { nome: "admin-assinaturas", caminho: "/admin", logado: true, admin: true, tamanhos: ["computador"], temas: ["light"], acao: abaAdmin("Assinaturas") },
  { nome: "admin-ebooks", caminho: "/admin", logado: true, admin: true, tamanhos: ["computador"], temas: ["light"], acao: abaAdmin("eBooks") },
  { nome: "admin-exclusoes", caminho: "/admin", logado: true, admin: true, tamanhos: ["computador"], temas: ["light"], acao: abaAdmin("Pedidos de exclusão") },
  { nome: "admin-acesso", caminho: "/admin", logado: true, admin: true, tamanhos: ["computador"], temas: ["light"], acao: abaAdmin("Duas etapas") },
  { nome: "admin-contas", caminho: "/admin", logado: true, admin: true, tamanhos: ["computador"], temas: ["dark"], acao: abaAdmin("Contas") },
  { nome: "admin-suporte", caminho: "/admin", logado: true, admin: true, tamanhos: ["computador"], temas: ["light"], acao: abaAdmin("Suporte e aplicativo") },
];

const filtro = process.env.CENAS ? new Set(process.env.CENAS.split(",")) : null;
const relatorio = [];
const browser = await chromium.launch();

for (const cena of CENAS) {
  if (filtro && !filtro.has(cena.nome)) continue;
  for (const tamanho of cena.tamanhos) {
    for (const tema of cena.temas) {
      const arquivo = `${cena.nome}--${tamanho}--${tema === "dark" ? "escuro" : "claro"}.png`;
      const info = { arquivo, caminho: cena.caminho, erros: [], falhas: [], estouroHorizontal: false, fontes: [] };
      const context = await browser.newContext({
        ...TAMANHOS[tamanho], colorScheme: tema, locale: "pt-BR", timezoneId: "America/Sao_Paulo",
      });
      const sessao = sessaoFalsa();
      if (cena.logado) {
        await context.addInitScript(({ chave, valor }) => {
          try { localStorage.setItem(chave, valor); } catch { /* sem armazenamento */ }
        }, { chave: CHAVE_SESSAO, valor: JSON.stringify(sessao) });
      }
      await fetch(`${MOCK}/__cena`, { method: "POST", body: JSON.stringify({ admin: !!cena.admin, assinante: !!cena.assinante }) });
      const page = await context.newPage();
      page.on("console", (m) => { if (m.type() === "error") info.erros.push(m.text().slice(0, 300)); });
      page.on("pageerror", (e) => info.erros.push(`pageerror: ${String(e.message).slice(0, 300)}`));
      page.on("requestfailed", (r) => {
        const u = r.url();
        info.falhas.push(`${r.failure()?.errorText ?? "falhou"} ${u.slice(0, 160)}`);
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
        }).catch(() => []);
        // Largura real do conteúdo: no celular, maior que a tela = rolagem para o lado.
        info.larguraPagina = await page.evaluate(() => document.documentElement.scrollWidth);
        if (TAMANHOS[tamanho].viewport.width < info.larguraPagina - 1) info.estouroHorizontal = true;
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

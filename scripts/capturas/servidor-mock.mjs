// Supabase de mentira (Auth + PostgREST) para as fotos de tela.
// O site em modo de desenvolvimento aponta para cá (SUPABASE_URL e VITE_SUPABASE_URL),
// tanto no navegador quanto no servidor. Uso: node scripts/capturas/servidor-mock.mjs
import { createServer } from "node:http";
import { responderRest, sessaoFalsa, usuarioAuth } from "./mock.mjs";

const PORTA = Number(process.env.PORTA_MOCK ?? 54321);
let cena = { admin: false };

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,HEAD,OPTIONS",
  "access-control-allow-headers": "*",
  "access-control-expose-headers": "content-range, x-total-count",
  "access-control-max-age": "600",
};

function enviar(res, status, corpo, cabecalhos = {}) {
  const texto = corpo === undefined ? "" : typeof corpo === "string" ? corpo : JSON.stringify(corpo);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", ...CORS, ...cabecalhos });
  res.end(texto);
}

function lerCorpo(req) {
  return new Promise((ok) => {
    let t = "";
    req.on("data", (c) => { t += c; });
    req.on("end", () => ok(t));
  });
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORTA}`);
  const caminho = url.pathname;
  if (req.method === "OPTIONS") return enviar(res, 204, undefined);
  if (caminho === "/__cena") {
    try { cena = { ...cena, ...JSON.parse((await lerCorpo(req)) || "{}") }; } catch { /* mantém */ }
    return enviar(res, 200, cena);
  }
  const logado = (req.headers.authorization ?? "").includes("assinatura-falsa");
  if (caminho.startsWith("/auth/v1/")) {
    const fim = caminho.slice("/auth/v1/".length);
    if (fim === "user") return logado ? enviar(res, 200, usuarioAuth()) : enviar(res, 401, { code: 401, error_code: "no_authorization", msg: "Sem sessão" });
    if (fim.startsWith("token") || fim === "signup") return enviar(res, 200, sessaoFalsa());
    if (fim === "logout") return enviar(res, 204, undefined);
    if (fim === "recover" || fim === "otp" || fim === "resend") return enviar(res, 200, {});
    if (fim.startsWith("factors")) return enviar(res, 200, { all: [], totp: [], phone: [] });
    return enviar(res, 200, {});
  }
  if (caminho.startsWith("/rest/v1/")) {
    if (req.method !== "GET" && req.method !== "HEAD") await lerCorpo(req);
    const r = responderRest({
      caminho: caminho.slice("/rest/v1/".length), metodo: req.method, params: url.searchParams,
      cabecalhos: req.headers, admin: !!cena.admin,
    });
    res.writeHead(r.status, { ...CORS, ...r.headers });
    return res.end(r.body);
  }
  return enviar(res, 404, { message: "não encontrado" });
}).listen(PORTA, "127.0.0.1", () => console.log(`mock do Supabase em http://127.0.0.1:${PORTA}`));

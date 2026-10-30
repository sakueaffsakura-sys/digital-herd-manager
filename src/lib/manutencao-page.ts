const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function renderManutencaoPage(titulo: string, mensagem: string, tipo: "manutencao" | "bloqueado" = "manutencao") {
  const cor = tipo === "bloqueado" ? "#f87171" : "#4ade80";
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(titulo)} | Pecuária Digital</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at 50% 0%,#14301e,#07100b 60%);color:#e8f5ec;font-family:system-ui,sans-serif;padding:24px}
.c{max-width:520px;text-align:center;border:1px solid #1f3a29;background:#0b1710cc;border-radius:24px;padding:40px 28px;box-shadow:0 30px 80px #0008}
.i{width:64px;height:64px;margin:0 auto 18px;border-radius:18px;display:grid;place-items:center;background:${cor}22;color:${cor};font-size:30px}
h1{margin:0 0 10px;font-size:26px}p{margin:0;color:#a7c3b0;line-height:1.6}a{display:inline-block;margin-top:24px;color:${cor}}</style></head>
<body><main class="c"><div class="i">${tipo === "bloqueado" ? "&#9940;" : "&#128736;"}</div><h1>${esc(titulo)}</h1><p>${esc(mensagem)}</p><a href="/">Voltar ao início</a></main></body></html>`;
}

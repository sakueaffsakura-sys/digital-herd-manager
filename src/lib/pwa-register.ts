// Único ponto que registra o modo offline. Nunca roda no editor/preview nem em desenvolvimento.
const PREVIEW = /^(?:id-preview|preview)(?:-[a-z0-9]+)?--.+$/;

function bloqueado(): boolean {
  if (!import.meta.env.PROD) return true;
  try { if (window.self !== window.top) return true; } catch { return true; }
  const host = window.location.hostname.toLowerCase();
  const label = host.split(".")[0] ?? "";
  if (/\.(lovable\.app|gpt-eng\.com|gptengineer\.run)$/.test(host) && (PREVIEW.test(label) || /^project--.+-dev$/.test(label))) return true;
  if (/(^|\.)lovableproject(-dev)?\.com$/.test(host) || /(^|\.)beta\.lovable\.dev$/.test(host)) return true;
  if (new URLSearchParams(window.location.search).get("sw") === "off") return true;
  return false;
}

export async function registrarPwa() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  if (bloqueado()) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.filter((r) => r.active?.scriptURL.endsWith("/sw.js")).map((r) => r.unregister()));
    return;
  }
  const { registerSW } = await import("virtual:pwa-register");
  registerSW({ immediate: true });
}

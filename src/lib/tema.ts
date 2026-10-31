// Tema claro/escuro: escolha da pessoa ou o do aparelho ("automático").
// A escolha fica só neste navegador (conveniência); o script do <head> aplica antes de pintar.
import { useSyncExternalStore } from "react";

export type Tema = "claro" | "escuro" | "automatico";
const CHAVE = "pd-tema";
const EVENTO = "pd-tema";

export function lerTema(): Tema {
  try {
    const v = localStorage.getItem(CHAVE);
    if (v === "claro" || v === "escuro" || v === "automatico") return v;
  } catch {
    /* sem armazenamento: segue o aparelho */
  }
  return "automatico";
}

function sistemaEscuro() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches === true;
}

export function temaEscuro(t: Tema = lerTema()) {
  return t === "escuro" || (t === "automatico" && sistemaEscuro());
}

export function aplicarTema(t: Tema = lerTema()) {
  if (typeof document === "undefined") return;
  const escuro = temaEscuro(t);
  document.documentElement.classList.toggle("dark", escuro);
  document.documentElement.style.colorScheme = escuro ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", escuro ? "#0b140f" : "#12301f");
}

export function escolherTema(t: Tema) {
  try {
    localStorage.setItem(CHAVE, t);
  } catch {
    /* sem armazenamento: vale só nesta visita */
  }
  aplicarTema(t);
  window.dispatchEvent(new Event(EVENTO));
}

function assinar(aviso: () => void) {
  const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
  const aoMudarSistema = () => {
    if (lerTema() === "automatico") aplicarTema("automatico");
    aviso();
  };
  window.addEventListener(EVENTO, aviso);
  mq?.addEventListener?.("change", aoMudarSistema);
  return () => {
    window.removeEventListener(EVENTO, aviso);
    mq?.removeEventListener?.("change", aoMudarSistema);
  };
}

/** Tema escolhido ("claro" | "escuro" | "automatico"). */
export function useTema(): Tema {
  return useSyncExternalStore(assinar, lerTema, () => "automatico");
}

/** Se a tela está escura agora (para componentes que precisam saber, como os avisos). */
export function useTemaEscuro(): boolean {
  return useSyncExternalStore(assinar, () => temaEscuro(), () => false);
}

/** Script do <head>: aplica o tema antes da primeira pintura, sem piscar. */
export const SCRIPT_TEMA = `(function(){try{var t=localStorage.getItem('${CHAVE}');var d=t==='escuro'||((!t||t==='automatico')&&window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;if(d){r.classList.add('dark');r.style.colorScheme='dark'}}catch(e){}})();`;

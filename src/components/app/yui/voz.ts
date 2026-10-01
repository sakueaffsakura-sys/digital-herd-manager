// Voz da Yui: usa a voz realista de IA (servidor, Gemini TTS) e, se falhar,
// cai para a síntese de fala do navegador. Fala frase por frase e é cancelável.
import { supabase } from "@/integrations/supabase/client";

let geracao = 0;
let audioAtual: HTMLAudioElement | null = null;
let abortAtual: AbortController | null = null;

export const vozDisponivel = () => typeof window !== "undefined";

// ---------- Fallback: voz do navegador ----------
let vozEscolhida: SpeechSynthesisVoice | null = null;
const temSintese = () => typeof window !== "undefined" && "speechSynthesis" in window;

function pontuar(v: SpeechSynthesisVoice): number {
  const n = `${v.name} ${v.voiceURI}`.toLowerCase();
  let p = 0;
  if (v.lang === "pt-BR") p += 100;
  else if (v.lang.toLowerCase().startsWith("pt")) p += 40;
  if (/natural|neural|online/.test(n)) p += 60;
  if (/google/.test(n)) p += 45;
  if (/microsoft/.test(n)) p += 35;
  if (/francisca|luciana|maria|vitoria|vitória|thalita|leticia|letícia|camila|female|feminina/.test(n)) p += 25;
  if (!v.localService) p += 15;
  if (/compact|espeak|robot/.test(n)) p -= 50;
  return p;
}

function escolherVoz() {
  if (!temSintese()) return null;
  if (vozEscolhida) return vozEscolhida;
  const vozes = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("pt"));
  if (!vozes.length) return null;
  vozEscolhida = [...vozes].sort((a, b) => pontuar(b) - pontuar(a))[0] ?? null;
  return vozEscolhida;
}
if (temSintese()) speechSynthesis.onvoiceschanged = () => { vozEscolhida = null; escolherVoz(); };

function falarNavegador(texto: string, minha: number): Promise<boolean> {
  if (!temSintese()) {
    return new Promise((ok) => setTimeout(() => ok(minha === geracao), Math.max(3500, texto.length * 55)));
  }
  const frases = texto.match(/[^.!?]+[.!?]*/g)?.map((f) => f.trim()).filter(Boolean) ?? [texto];
  return new Promise((ok) => {
    let i = 0;
    const proxima = () => {
      if (minha !== geracao) return ok(false);
      if (i >= frases.length) return ok(true);
      const u = new SpeechSynthesisUtterance(frases[i++]);
      u.lang = "pt-BR";
      u.rate = 0.98;
      u.pitch = 1.05;
      const v = escolherVoz();
      if (v) u.voice = v;
      let feito = false;
      const fim = () => { if (feito) return; feito = true; clearTimeout(guarda); proxima(); };
      const guarda = setTimeout(fim, Math.max(4000, u.text.length * 110));
      u.onend = fim;
      u.onerror = fim;
      speechSynthesis.speak(u);
    };
    proxima();
  });
}

// ---------- Voz realista de IA ----------
async function falarIA(texto: string, minha: number): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token || minha !== geracao) return false;

  const abort = new AbortController();
  abortAtual = abort;
  let resp: Response;
  try {
    resp = await fetch("/api/yui/voz", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ texto }),
      signal: abort.signal,
    });
  } catch {
    return false;
  } finally {
    if (abortAtual === abort) abortAtual = null;
  }
  if (!resp.ok || minha !== geracao) return false;

  const blob = await resp.blob();
  if (minha !== geracao || !blob.size) return false;

  return new Promise((ok) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audioAtual = audio;
    let feito = false;
    const fim = (terminou: boolean) => {
      if (feito) return;
      feito = true;
      if (audioAtual === audio) audioAtual = null;
      URL.revokeObjectURL(url);
      ok(terminou && minha === geracao);
    };
    audio.onended = () => fim(true);
    audio.onerror = () => fim(false);
    audio.play().catch(() => fim(false));
  });
}

/** Fala o texto; resolve true se terminou, false se foi cancelada. */
export async function falar(texto: string, comVoz: boolean): Promise<boolean> {
  const minha = ++geracao;
  if (!comVoz) {
    return new Promise((ok) => setTimeout(() => ok(minha === geracao), Math.max(3500, texto.length * 55)));
  }
  calarAudio();
  if (temSintese()) speechSynthesis.cancel();

  // Tenta a voz realista de IA; se falhar, usa a voz do navegador.
  const falou = await falarIA(texto, minha);
  if (falou || minha !== geracao) return falou;
  return falarNavegador(texto, minha);
}

function calarAudio() {
  abortAtual?.abort();
  abortAtual = null;
  if (audioAtual) {
    audioAtual.pause();
    audioAtual = null;
  }
}

export function calar() {
  geracao++;
  calarAudio();
  if (temSintese()) speechSynthesis.cancel();
}

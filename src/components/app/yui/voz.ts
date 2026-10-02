// Voz da Yui: usa a voz realista de IA (servidor, Gemini TTS) e, se falhar,
// cai para a síntese de fala do navegador. Fala frase por frase e é cancelável.
import { supabase } from "@/integrations/supabase/client";

let geracao = 0;
let audioAtual: HTMLAudioElement | null = null;

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
      u.pitch = 1;
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
// Cache de áudios já gerados/em geração: permite pré-carregar os próximos passos
// e eliminar a espera entre uma fala e outra.
const cache = new Map<string, Promise<Blob | null>>();

function gerarAudio(texto: string): Promise<Blob | null> {
  const existente = cache.get(texto);
  if (existente) return existente;
  const p = (async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return null;
    try {
      const resp = await fetch("/api/yui/voz", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ texto }),
      });
      if (!resp.ok) return null;
      const blob = await resp.blob();
      return blob.size ? blob : null;
    } catch {
      return null;
    }
  })();
  cache.set(texto, p);
  // Falhas não ficam no cache, para poder tentar de novo depois.
  void p.then((b) => { if (!b) cache.delete(texto); });
  if (cache.size > 40) cache.delete(cache.keys().next().value as string);
  return p;
}

/** Começa a gerar a voz de um texto em segundo plano (sem tocar). */
export function prepararVoz(texto: string) {
  void gerarAudio(texto);
}

async function falarIA(texto: string, minha: number, aoComecar?: () => void): Promise<boolean> {
  // Se a voz demorar demais, desiste e usa a voz do navegador para não travar o tour.
  const blob = await Promise.race([gerarAudio(texto), new Promise<null>((r) => setTimeout(() => r(null), 6000))]);
  if (minha !== geracao || !blob) return false;

  return new Promise((ok) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audioAtual = audio;
    let feito = false;
    // Vigia: alguns navegadores não disparam "ended" (ou o áudio trava no meio).
    // Se o áudio parar de avançar ou passar muito do tempo esperado, segue em frente.
    let ultimoTempo = -1, parado = 0;
    const limite = Date.now() + Math.max(8000, texto.length * 120);
    const vigia = setInterval(() => {
      if (minha !== geracao) return fim(false);
      const d = audio.duration;
      if (Number.isFinite(d) && d > 0 && audio.currentTime >= d - 0.15) return fim(true);
      if (audio.currentTime > 0 && audio.currentTime === ultimoTempo) parado++; else { parado = 0; ultimoTempo = audio.currentTime; }
      if (parado >= 6 || Date.now() > limite) fim(true);
    }, 500);
    const fim = (terminou: boolean) => {
      if (feito) return;
      feito = true;
      clearInterval(vigia);
      audio.pause();
      if (audioAtual === audio) audioAtual = null;
      URL.revokeObjectURL(url);
      ok(terminou && minha === geracao);
    };
    audio.onended = () => fim(true);
    audio.onerror = () => fim(false);
    audio.play().then(() => aoComecar?.()).catch(() => fim(false));
    // Se o navegador nem começar a tocar em 5s, desiste e usa a voz do navegador.
    setTimeout(() => { if (!feito && audio.currentTime === 0) fim(false); }, 5000);
  });
}

/** Fala o texto; resolve true se terminou, false se foi cancelada. */
export async function falar(texto: string, comVoz: boolean, aoComecar?: () => void): Promise<boolean> {
  const minha = ++geracao;
  if (!comVoz) {
    return new Promise((ok) => setTimeout(() => ok(minha === geracao), Math.max(3500, texto.length * 55)));
  }
  calarAudio();
  if (temSintese()) speechSynthesis.cancel();

  // Tenta a voz realista de IA; se falhar, usa a voz do navegador.
  const falou = await falarIA(texto, minha, aoComecar);
  if (falou || minha !== geracao) return falou;
  aoComecar?.();
  return falarNavegador(texto, minha);
}

function calarAudio() {
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

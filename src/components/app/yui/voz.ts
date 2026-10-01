// Voz da Yui usando a síntese de fala do próprio navegador (pt-BR).
// Escolhe a voz mais natural disponível (neural/online/feminina) e fala
// frase por frase (navegadores cortam falas longas). Pode ser cancelada.
let vozEscolhida: SpeechSynthesisVoice | null = null;
let geracao = 0;

export const vozDisponivel = () => typeof window !== "undefined" && "speechSynthesis" in window;

/** Pontua a voz: quanto maior, mais natural/humana ela tende a ser. */
function pontuar(v: SpeechSynthesisVoice): number {
  const n = `${v.name} ${v.voiceURI}`.toLowerCase();
  let p = 0;
  if (v.lang === "pt-BR") p += 100;
  else if (v.lang.toLowerCase().startsWith("pt")) p += 40;
  // Vozes neurais/naturais soam bem mais humanas.
  if (/natural|neural|online/.test(n)) p += 60;
  if (/google/.test(n)) p += 45; // vozes Google pt-BR são das mais naturais
  if (/microsoft/.test(n)) p += 35;
  // Femininas conhecidas em pt-BR.
  if (/francisca|antonio|luciana|maria|vitoria|vitória|thalita|leticia|letícia|camila|female|feminina/.test(n)) p += 25;
  // Vozes de rede (não locais) costumam ter melhor qualidade.
  if (!v.localService) p += 15;
  // Evita vozes compactas/robóticas.
  if (/compact|espeak|robot/.test(n)) p -= 50;
  return p;
}

function escolherVoz() {
  if (!vozDisponivel()) return null;
  if (vozEscolhida) return vozEscolhida;
  const vozes = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("pt"));
  if (!vozes.length) return null;
  vozEscolhida = [...vozes].sort((a, b) => pontuar(b) - pontuar(a))[0] ?? null;
  return vozEscolhida;
}
if (vozDisponivel()) speechSynthesis.onvoiceschanged = () => { vozEscolhida = null; escolherVoz(); };

/** Fala o texto; resolve true se terminou, false se foi cancelada. Sem voz, espera um tempo proporcional ao texto. */
export function falar(texto: string, comVoz: boolean): Promise<boolean> {
  const minha = ++geracao;
  if (!comVoz || !vozDisponivel()) {
    return new Promise((ok) => setTimeout(() => ok(minha === geracao), Math.max(3500, texto.length * 55)));
  }
  speechSynthesis.cancel();
  const frases = texto.match(/[^.!?]+[.!?]*/g)?.map((f) => f.trim()).filter(Boolean) ?? [texto];
  return new Promise((ok) => {
    let i = 0;
    const proxima = () => {
      if (minha !== geracao) return ok(false);
      if (i >= frases.length) return ok(true);
      const u = new SpeechSynthesisUtterance(frases[i++]);
      u.lang = "pt-BR";
      // Ritmo e tom mais próximos de fala natural.
      u.rate = 0.98;
      u.pitch = 1.05;
      u.volume = 1;
      const v = escolherVoz();
      if (v) u.voice = v;
      let feito = false;
      const fim = () => { if (feito) return; feito = true; clearTimeout(guarda); proxima(); };
      // Proteção: alguns navegadores não disparam "end".
      const guarda = setTimeout(fim, Math.max(4000, (u.text.length * 110)));
      u.onend = fim;
      u.onerror = fim;
      speechSynthesis.speak(u);
    };
    proxima();
  });
}

export function calar() {
  geracao++;
  if (vozDisponivel()) speechSynthesis.cancel();
}

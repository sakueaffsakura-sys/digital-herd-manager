// Voz da Yui usando a síntese de fala do próprio navegador (pt-BR).
// Fala frase por frase (navegadores cortam falas longas) e pode ser cancelada.
let vozEscolhida: SpeechSynthesisVoice | null = null;
let geracao = 0;

export const vozDisponivel = () => typeof window !== "undefined" && "speechSynthesis" in window;

function escolherVoz() {
  if (!vozDisponivel()) return null;
  if (vozEscolhida) return vozEscolhida;
  const vozes = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("pt"));
  const fem = /(female|feminina|luciana|francisca|maria|vitoria|vitória|thalita|letícia|leticia|google português)/i;
  vozEscolhida = vozes.find((v) => v.lang === "pt-BR" && fem.test(v.name)) ?? vozes.find((v) => v.lang === "pt-BR") ?? vozes[0] ?? null;
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
      u.rate = 1.03;
      u.pitch = 1.15;
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

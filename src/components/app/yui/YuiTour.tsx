import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, NotebookPen, Pause, Play, Volume2, VolumeX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useYuiAvatar } from "./useYuiAvatar";
import { acharAlvo, type TourStep } from "./tourSteps";
import { calar, falar, prepararVoz, vozDisponivel } from "./voz";

type Rect = { top: number; left: number; width: number; height: number };
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function YuiTour({ go, abrirMenu, onSair, passos, isAdmin }: { go: (s: string) => void; abrirMenu: (aberto: boolean) => void; onSair: () => void; passos: readonly TourStep[]; isAdmin: boolean }) {
  const yuiAvatar = useYuiAvatar(isAdmin);
  const [idx, setIdx] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [comVoz, setComVoz] = useState(vozDisponivel());
  const [falando, setFalando] = useState(false);
  const [carregandoVoz, setCarregandoVoz] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);
  const [minimizadoManual, setMinimizadoManual] = useState<boolean | null>(null);
  const alvoRef = useRef<HTMLElement | null>(null);
  const passo = passos[idx];
  const ultimo = idx === passos.length - 1;

  // Fecha o formulário de demonstração ao sair do passo ou do tour.
  useEffect(() => {
    if (!passo.demonstracaoAnotacao) return;
    return () => { window.dispatchEvent(new Event("yui:demo-fim")); };
  }, [passo]);

  const sair = useCallback(() => { calar(); abrirMenu(false); onSair(); }, [abrirMenu, onSair]);

  // Mantém o destaque acompanhando o elemento (rolagem, redimensionamento, animações).
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const el = alvoRef.current;
      if (el && el.isConnected) {
        const r = el.getBoundingClientRect();
        setRect((p) => (p && Math.abs(p.top - r.top) < 0.5 && Math.abs(p.left - r.left) < 0.5 && Math.abs(p.width - r.width) < 0.5 && Math.abs(p.height - r.height) < 0.5 ? p : { top: r.top, left: r.left, width: r.width, height: r.height }));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Executa o passo atual: navega, destaca, fala e avança sozinho.
  useEffect(() => {
    let vivo = true;
    (async () => {
      calar();
      setFalando(false);
      // Gera a voz deste passo e dos próximos já em paralelo com a navegação (sem espera entre falas).
       if (comVoz) for (let k = idx; k < Math.min(idx + 4, passos.length); k++) prepararVoz(passos[k].fala);
      if (passo.section) { go(passo.section); await esperar(200); }
      if (passo.demonstracaoAnotacao) { window.dispatchEvent(new Event("yui:show-notes")); await esperar(250); }
      const mobile = window.matchMedia("(max-width: 1023px)").matches;
      const precisaMenu = mobile && passo.alvo.includes("nav-");
      abrirMenu(precisaMenu);
      if (precisaMenu) await esperar(250);
      let el: HTMLElement | null = null;
      for (let t = 0; t < 15 && vivo && !el; t++) { el = acharAlvo(passo.alvo); if (!el) await esperar(120); }
      if (!vivo) return;
      if (passo.demonstracaoAnotacao && el) {
        // Mostra o botão e abre o formulário real preenchendo sozinho (nunca salva).
        alvoRef.current = el;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        await esperar(1200);
        if (!vivo) return;
        window.dispatchEvent(new CustomEvent("yui:demo-nota", { detail: {
          producao: "12.5",
          observacao: "Vaca comeu bem e ficou calma na ordenha da manhã.",
          comportamento: "Tranquila",
          alimentacao: "Silagem e ração no cocho, água à vontade.",
        } }));
        for (let t = 0; t < 15 && vivo; t++) { const d = acharAlvo("[data-tour='demo-dialog']"); if (d) { el = d; break; } await esperar(120); }
        if (!vivo) return;
      }
      el ??= acharAlvo("[data-tour='conteudo']");
      alvoRef.current = el;
      if (!el) setRect(null);
      el?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      if (pausado) return;
      setFalando(true);
      setCarregandoVoz(comVoz);
      const terminou = await falar(passo.fala, comVoz, () => vivo && setCarregandoVoz(false));
      setCarregandoVoz(false);
      if (!vivo) return;
      setFalando(false);
       if (terminou && !passo.demonstracaoAnotacao) {
        await esperar(150);
        if (vivo) { if (ultimo) sair(); else setIdx((i) => i + 1); }
      }
    })();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, pausado, comVoz, passos]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "Escape") sair();
      if (e.key === "ArrowRight" && !ultimo) setIdx((i) => i + 1);
      if (e.key === "ArrowLeft" && idx > 0) setIdx((i) => i - 1);
      if (e.key === " ") { e.preventDefault(); setPausado((p) => !p); }
    };
    window.addEventListener("keydown", tecla);
    return () => { window.removeEventListener("keydown", tecla); calar(); };
  }, [idx, ultimo, sair]);

  const pad = 8;
  const embaixo = !rect || rect.top + rect.height / 2 < window.innerHeight * 0.55;
  // No modo automático o cartão minimiza sozinho para não tampar a demonstração;
  // ao pausar ele expande. O usuário pode forçar um dos dois estados.
  const minimizado = minimizadoManual ?? !pausado;

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Tour guiado pela Yui">
      {/* bloqueia cliques no site durante o modo automático */}
      <div className="absolute inset-0" />
      {rect ? (
        <div
          className="pointer-events-none absolute rounded-xl ring-2 ring-primary transition-all duration-500 ease-out"
          style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2, boxShadow: "0 0 0 9999px color-mix(in oklab, var(--background) 78%, transparent), 0 0 32px 4px color-mix(in oklab, var(--primary) 45%, transparent)" }}
        >
          <span className="absolute inset-0 animate-pulse rounded-xl ring-4 ring-primary/30" />
        </div>
      ) : <div className="absolute inset-0 bg-background/80" />}

      {minimizado ? (
        /* Pílula compacta: acompanha o tour sem tampar a tela */
        <div className="absolute bottom-4 right-4 flex items-center gap-2 rounded-full border border-primary/40 bg-popover/95 py-1.5 pl-1.5 pr-2 shadow-2xl backdrop-blur transition-all duration-500">
          <div className="relative shrink-0">
            <img src={yuiAvatar} alt="Yui" width={36} height={36} className={`size-9 rounded-full border-2 border-primary bg-primary/10 object-cover ${falando ? "animate-[pulse_1.2s_ease-in-out_infinite]" : ""}`} />
            {falando && <span className="absolute -bottom-0.5 -right-0.5 flex h-4 items-end gap-0.5 rounded-full bg-primary px-1 py-0.5">{[0, 1, 2].map((i) => <span key={i} className="w-0.5 animate-bounce rounded bg-primary-foreground" style={{ height: 5 + i * 2, animationDelay: `${i * 120}ms` }} />)}</span>}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Yui · {idx + 1}/{passos.length}</p>
            <p className="max-w-40 truncate text-xs font-semibold leading-tight">{passo.titulo}</p>
          </div>
          <div className="h-1 w-14 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all duration-500" style={{ width: `${((idx + 1) / passos.length) * 100}%` }} /></div>
          <Button type="button" size="icon-sm" variant="ghost" onClick={() => { setPausado((p) => !p); if (!pausado) calar(); }} aria-label={pausado ? "Continuar" : "Pausar"}>{pausado ? <Play className="size-4" /> : <Pause className="size-4" />}</Button>
          <Button type="button" size="icon-sm" variant="ghost" onClick={() => setMinimizadoManual(false)} aria-label="Expandir explicação"><Maximize2 className="size-4" /></Button>
          <Button type="button" size="icon-sm" variant="ghost" onClick={sair} aria-label="Sair do tour"><X className="size-4" /></Button>
        </div>
      ) : (
      <div className={`absolute left-1/2 w-[min(560px,calc(100vw-24px))] -translate-x-1/2 transition-all duration-500 ${embaixo ? "bottom-4" : "top-4"}`}>
        <div className="overflow-hidden rounded-2xl border border-primary/40 bg-popover shadow-2xl">
           <div className="h-1 bg-muted"><div className="h-full bg-primary transition-all duration-500" style={{ width: `${((idx + 1) / passos.length) * 100}%` }} /></div>
          <div className="flex gap-4 p-4">
             <div className="relative shrink-0">
              <img src={yuiAvatar} alt="Yui" width={64} height={64} className={`size-16 rounded-full border-2 border-primary bg-primary/10 object-cover ${falando ? "animate-[pulse_1.2s_ease-in-out_infinite]" : ""}`} />
              {falando && <span className="absolute -bottom-1 -right-1 flex h-5 items-end gap-0.5 rounded-full bg-primary px-1.5 py-1">{[0, 1, 2].map((i) => <span key={i} className="w-0.5 animate-bounce rounded bg-primary-foreground" style={{ height: 8 + i * 2, animationDelay: `${i * 120}ms` }} />)}</span>}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                 <p className="text-[11px] font-bold uppercase tracking-wide text-primary">Yui · passo {idx + 1} de {passos.length}</p>
                 <Button type="button" size="icon-sm" variant="ghost" onClick={() => setMinimizadoManual(true)} className="ml-auto" aria-label="Minimizar explicação"><Minimize2 className="size-4" /></Button>
                 <Button type="button" size="icon-sm" variant="ghost" onClick={sair} aria-label="Sair do tour"><X className="size-4" /></Button>
              </div>
              <h3 className="mt-0.5 text-lg font-bold leading-tight">{passo.titulo}</h3>
               <p className="mt-1.5 text-sm leading-relaxed text-foreground/85">{passo.fala}</p>
              {passo.passos && (
                <ol className="mt-2.5 space-y-1 rounded-lg border border-border bg-card/60 p-2.5 text-xs">
                  <li className="mb-1 font-semibold text-primary">Como fazer:</li>
                  {passo.passos.map((t, i) => <li key={i} className="flex gap-2"><span className="grid size-4 shrink-0 place-items-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">{i + 1}</span><span className="text-foreground/85">{t}</span></li>)}
                </ol>
              )}
              {passo.dica && <p className="mt-2 text-xs text-muted-foreground"><span className="font-semibold text-chart-4">Dica: </span>{passo.dica}</p>}
               {passo.demonstracaoAnotacao && <p className="mt-2 flex items-center gap-2 rounded-md border border-primary/30 bg-background/70 p-2 text-xs text-muted-foreground"><NotebookPen className="size-4 shrink-0 text-primary" />Estou preenchendo o formulário de verdade só para você ver. Nada será salvo.</p>}

            </div>
          </div>
          <div className="flex items-center gap-2 border-t border-border bg-card/60 px-4 py-2.5">
            <Button size="sm" variant="ghost" onClick={() => setIdx((i) => i - 1)} disabled={idx === 0}><ChevronLeft />Voltar</Button>
            <Button size="sm" variant="outline" onClick={() => { setPausado((p) => !p); if (!pausado) calar(); }}>{pausado ? <><Play />Continuar</> : <><Pause />Pausar</>}</Button>
            {vozDisponivel() && <Button size="icon" variant="ghost" onClick={() => setComVoz((v) => !v)} aria-label={comVoz ? "Desligar voz" : "Ligar voz"}>{comVoz ? <Volume2 /> : <VolumeX />}</Button>}
            <div className="ml-auto flex gap-2">
             {ultimo ? <Button size="sm" onClick={sair}>Concluir</Button> : <Button size="sm" onClick={() => setIdx((i) => i + 1)}>{passo.demonstracaoAnotacao ? "Entendi" : "Avançar"}<ChevronRight /></Button>}
            </div>
          </div>
        </div>
        {pausado ? <p className="mt-2 text-center text-xs text-muted-foreground">Tour pausado. Toque em Continuar quando quiser.</p> : carregandoVoz && <p className="mt-2 text-center text-xs text-muted-foreground">Preparando a voz da Yui…</p>}
      </div>
      )}
      <span className="sr-only" aria-live="polite">{passo.titulo}. {passo.fala}</span>
    </div>
  );
}

import { useEffect, useRef, useState, type RefObject } from "react";
import { LoaderCircle, Minus, Plus, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Ebook } from "./Biblioteca";

type PdfDoc = { numPages: number; getPage: (n: number) => Promise<PdfPagina>; destroy: () => Promise<void> };
type PdfPagina = {
  getViewport: (o: { scale: number }) => { width: number; height: number };
  render: (o: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<void>; cancel: () => void };
};

/** Marca d'água desenhada DENTRO da página (vai junto em qualquer captura de tela). */
function marcaDagua(ctx: CanvasRenderingContext2D, largura: number, altura: number, texto: string) {
  ctx.save();
  ctx.globalAlpha = 0.085;
  ctx.fillStyle = "#15231a";
  const tam = Math.max(12, Math.round(largura / 46));
  ctx.font = `700 ${tam}px "Atkinson Hyperlegible Next", Arial, sans-serif`;
  ctx.translate(largura / 2, altura / 2);
  ctx.rotate(-Math.PI / 6);
  const passoY = tam * 11;
  const passoX = ctx.measureText(texto).width + tam * 7;
  for (let y = -altura; y < altura; y += passoY) {
    for (let x = -largura * 1.2; x < largura * 1.2; x += passoX) ctx.fillText(texto, x + ((y / passoY) % 2) * (passoX / 2), y);
  }
  ctx.restore();
}

/**
 * Leitor de eBook: as páginas são desenhadas em canvas (sem botão de baixar ou imprimir), com a marca de
 * quem está lendo. O PDF vem do servidor, que confere a assinatura a cada pedido.
 */
export function Leitor({ ebook, aoFechar }: { ebook: Ebook; aoFechar: () => void }) {
  const [doc, setDoc] = useState<PdfDoc | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pagina, setPagina] = useState(1);
  const [proporcao, setProporcao] = useState(1.414);
  const [marca, setMarca] = useState("");
  const rolagem = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(800);

  // Abre o PDF (com o token da sessão) e prepara a marca d'água com nome, e-mail e data.
  useEffect(() => {
    let vivo = true;
    let aberto: PdfDoc | null = null;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const sessao = data.session;
        if (!sessao) { setErro("Entre na sua conta para ler."); return; }
        const perfil = await supabase.from("profiles").select("nome_exibicao,nome_completo").eq("id", sessao.user.id).maybeSingle();
        const nome = perfil.data?.nome_exibicao || perfil.data?.nome_completo || "";
        setMarca(`${nome ? `${nome} · ` : ""}${sessao.user.email ?? ""} · ${new Date().toLocaleDateString("pt-BR")}`);
        const pdfjs = await import("pdfjs-dist");
        const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
        pdfjs.GlobalWorkerOptions.workerSrc = worker;
        const tarefa = pdfjs.getDocument({
          url: `/api/ebooks/${ebook.id}/arquivo`,
          httpHeaders: { Authorization: `Bearer ${sessao.access_token}` },
          rangeChunkSize: 1 << 21,
          disableAutoFetch: true,
          isEvalSupported: false,
        });
        const d = (await tarefa.promise) as unknown as PdfDoc;
        aberto = d;
        if (!vivo) { void d.destroy(); return; }
        const p1 = await d.getPage(1);
        const vp = p1.getViewport({ scale: 1 });
        setProporcao(vp.height / vp.width);
        setDoc(d);
      } catch (e) {
        const status = (e as { status?: number })?.status;
        setErro(status === 403 ? "A biblioteca é só para assinantes." : status === 429 ? "Você abriu muitos eBooks hoje. A leitura volta amanhã." : "Não foi possível abrir este eBook agora. Tente de novo.");
      }
    })();
    return () => { vivo = false; if (aberto) void aberto.destroy(); };
  }, [ebook.id]);

  // Largura útil para as páginas.
  useEffect(() => {
    const el = rolagem.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setLargura(Math.min(el.clientWidth - 24, 1000)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Sem imprimir, salvar, copiar ou menu do botão direito enquanto o leitor está aberto.
  useEffect(() => {
    const bloquear = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ["p", "s", "c"].includes(e.key.toLowerCase())) {
        e.preventDefault();
        toast.info("Imprimir, salvar e copiar ficam desligados na leitura.");
      }
      if (e.key === "Escape") aoFechar();
    };
    window.addEventListener("keydown", bloquear);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", bloquear); document.body.style.overflow = ""; };
  }, [aoFechar]);

  const larguraPagina = Math.round(largura * zoom);
  const alturaPagina = Math.round(larguraPagina * proporcao);

  return (
    <div className="leitor-ebook fixed inset-0 z-[70] flex flex-col bg-[#26302a] text-white" role="dialog" aria-modal="true" aria-label={`Lendo ${ebook.titulo}`} onContextMenu={(e) => e.preventDefault()}>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-white/10 px-3 sm:px-5">
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[1.35rem] font-extrabold leading-tight">{ebook.titulo}</p>
          <p className="text-sm text-white/70">{doc ? `Página ${pagina} de ${doc.numPages}` : "Abrindo…"}</p>
        </div>
        <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 hover:text-white" onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.2).toFixed(1)))} aria-label="Diminuir"><Minus /></Button>
        <span className="w-12 text-center text-sm tabular-nums">{Math.round(zoom * 100)}%</span>
        <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 hover:text-white" onClick={() => setZoom((z) => Math.min(2.4, +(z + 0.2).toFixed(1)))} aria-label="Aumentar"><Plus /></Button>
        <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 hover:text-white" onClick={aoFechar} aria-label="Fechar o leitor"><X /></Button>
      </header>
      <div ref={rolagem} className="min-h-0 flex-1 select-none overflow-auto px-3 py-4" onDragStart={(e) => e.preventDefault()}>
        {erro ? (
          <div className="mx-auto mt-16 max-w-md text-center">
            <p className="text-lg font-bold">{erro}</p>
            <Button className="mt-4 h-12" onClick={aoFechar}>Voltar à biblioteca</Button>
          </div>
        ) : !doc ? (
          <p className="mt-16 flex items-center justify-center gap-2 text-white/80"><LoaderCircle className="size-5 animate-spin" />Abrindo o eBook…</p>
        ) : (
          <div className="mx-auto flex flex-col items-center gap-4" style={{ width: larguraPagina }}>
            {Array.from({ length: doc.numPages }, (_, i) => (
              <PaginaPdf key={`${i + 1}-${larguraPagina}`} doc={doc} numero={i + 1} largura={larguraPagina} altura={alturaPagina} marca={marca} raiz={rolagem} aoVer={setPagina} />
            ))}
          </div>
        )}
      </div>
      <footer className="flex shrink-0 items-center gap-2 border-t border-white/10 px-4 py-2 text-sm text-white/75">
        <ShieldCheck className="size-4 shrink-0" />
        Conteúdo licenciado para você. É proibido copiar ou repassar; as páginas levam o seu nome e e-mail.
      </footer>
    </div>
  );
}

function PaginaPdf({
  doc, numero, largura, altura, marca, raiz, aoVer,
}: {
  doc: PdfDoc; numero: number; largura: number; altura: number; marca: string;
  raiz: RefObject<HTMLDivElement | null>; aoVer: (n: number) => void;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const tela = useRef<HTMLCanvasElement>(null);
  const [perto, setPerto] = useState(false);

  // Só desenha as páginas perto da tela (livros grandes não pesam no celular).
  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (es) => es.forEach((e) => setPerto(e.isIntersecting)),
      { root: raiz.current, rootMargin: "150% 0px" },
    );
    const visivel = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) aoVer(numero); }), { root: raiz.current, threshold: 0.5 });
    obs.observe(el);
    visivel.observe(el);
    return () => { obs.disconnect(); visivel.disconnect(); };
  }, [raiz, numero, aoVer]);

  useEffect(() => {
    const canvas = tela.current;
    if (!perto || !canvas) {
      if (canvas) { canvas.width = 0; canvas.height = 0; }
      return;
    }
    let cancelado = false;
    let tarefa: { cancel: () => void } | null = null;
    void (async () => {
      try {
        const p = await doc.getPage(numero);
        if (cancelado) return;
        const base = p.getViewport({ scale: 1 });
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const vp = p.getViewport({ scale: (largura / base.width) * dpr });
        canvas.width = Math.floor(vp.width);
        canvas.height = Math.floor(vp.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const r = p.render({ canvasContext: ctx, viewport: vp });
        tarefa = r;
        await r.promise;
        if (!cancelado && marca) marcaDagua(ctx, canvas.width, canvas.height, marca);
      } catch {
        /* página cancelada ou sessão vencida: some e tenta de novo ao voltar */
      }
    })();
    return () => { cancelado = true; tarefa?.cancel(); };
  }, [perto, doc, numero, largura, marca]);

  return (
    <div ref={caixa} className="relative shrink-0 bg-white shadow-lg" style={{ width: largura, height: altura }}>
      <canvas ref={tela} className="block h-full w-full" aria-label={`Página ${numero}`} />
    </div>
  );
}

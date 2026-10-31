import { useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileUp, LoaderCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { diaBR } from "@/lib/datas";
import { plural } from "@/lib/texto";
import { Capa } from "../biblioteca/Biblioteca";
import { CampoArquivo } from "../shared";

const MAX_PDF = 100 * 1024 * 1024;
const MAX_CAPA = 5 * 1024 * 1024;
type Linha = { id: string; titulo: string; autor: string | null; categoria: string | null; descricao: string | null; paginas: number | null; capa_path: string | null; arquivo_path: string | null; tamanho_bytes: number | null; publicado: boolean; publicado_em: string | null; created_at: string };

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const mb = (n: number | null) => (n ? `${(n / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB` : "—");

/** Lê o PDF no navegador: confere a assinatura %PDF-, conta as páginas e desenha a capa (página 1) se faltar. */
async function lerPdf(arquivo: File): Promise<{ paginas: number; sha256: string; capa: Blob | null }> {
  const cabeca = new TextDecoder().decode(await arquivo.slice(0, 5).arrayBuffer());
  if (cabeca !== "%PDF-") throw new Error("Este arquivo não é um PDF de verdade.");
  const buf = await arquivo.arrayBuffer();
  const sha256 = hex(await crypto.subtle.digest("SHA-256", buf));
  const pdfjs = await import("pdfjs-dist");
  const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf.slice(0)), isEvalSupported: false }).promise;
  let capa: Blob | null = null;
  try {
    const p = await doc.getPage(1);
    const base = p.getViewport({ scale: 1 });
    const vp = p.getViewport({ scale: 900 / Math.max(base.width, base.height) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(vp.width);
    canvas.height = Math.round(vp.height);
    const ctx = canvas.getContext("2d");
    if (ctx) {
      await p.render({ canvasContext: ctx, viewport: vp }).promise;
      capa = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/webp", 0.85));
    }
  } catch {
    capa = null;
  }
  const paginas = doc.numPages;
  await doc.destroy();
  return { paginas, sha256, capa };
}

function NovoEbook() {
  const qc = useQueryClient();
  const pdfRef = useRef<HTMLInputElement>(null);
  const capaRef = useRef<HTMLInputElement>(null);
  const [titulo, setTitulo] = useState("");
  const [autor, setAutor] = useState("");
  const [categoria, setCategoria] = useState("");
  const [descricao, setDescricao] = useState("");
  const [etapa, setEtapa] = useState<string | null>(null);
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const pdf = pdfRef.current?.files?.[0];
    const capaArq = capaRef.current?.files?.[0] ?? null;
    if (!pdf) { toast.error("Escolha o arquivo PDF."); return; }
    if (pdf.size > MAX_PDF) { toast.error("O PDF pode ter no máximo 100 MB."); return; }
    if (capaArq && (capaArq.size > MAX_CAPA || !/^image\/(jpeg|png|webp)$/.test(capaArq.type))) { toast.error("A capa precisa ser JPG, PNG ou WEBP de até 5 MB."); return; }
    const id = crypto.randomUUID();
    const enviados: { balde: string; caminho: string }[] = [];
    try {
      setEtapa("Conferindo o PDF…");
      const info = await lerPdf(pdf);
      setEtapa("Enviando o PDF…");
      const arquivo_path = `${id}.pdf`;
      const up = await supabase.storage.from("ebooks").upload(arquivo_path, pdf, { contentType: "application/pdf", upsert: false, cacheControl: "0" });
      if (up.error) throw new Error(/size|large|exceed/i.test(up.error.message) ? "O arquivo passou do limite de tamanho do armazenamento." : "Não foi possível enviar o PDF.");
      enviados.push({ balde: "ebooks", caminho: arquivo_path });
      let capa_path: string | null = null;
      const capa = capaArq ?? info.capa;
      if (capa) {
        setEtapa("Enviando a capa…");
        const ext = capaArq ? capaArq.type.split("/")[1].replace("jpeg", "jpg") : "webp";
        capa_path = `${id}.${ext}`;
        const c = await supabase.storage.from("ebook-capas").upload(capa_path, capa, { contentType: capaArq?.type ?? "image/webp", upsert: true });
        if (c.error) capa_path = null;
        else enviados.push({ balde: "ebook-capas", caminho: capa_path });
      }
      setEtapa("Salvando…");
      const { error } = await supabase.from("ebooks").insert({
        id, titulo: titulo.trim(), autor: autor.trim() || null, categoria: categoria.trim() || null, descricao: descricao.trim() || null,
        paginas: info.paginas, capa_path, arquivo_path, tamanho_bytes: pdf.size, sha256: info.sha256, publicado: false,
      });
      if (error) throw new Error("Não foi possível salvar os dados do eBook.");
      toast.success("eBook enviado. Confira e publique quando quiser.");
      setTitulo(""); setAutor(""); setCategoria(""); setDescricao("");
      if (pdfRef.current) pdfRef.current.value = "";
      if (capaRef.current) capaRef.current.value = "";
      void qc.invalidateQueries({ queryKey: ["admin-ebooks"] });
    } catch (er) {
      for (const f of enviados) await supabase.storage.from(f.balde).remove([f.caminho]);
      toast.error((er as Error).message || "Não foi possível enviar.");
    } finally {
      setEtapa(null);
    }
  };
  return (
    <section className="painel p-4 sm:p-6">
      <h3 className="titulo-secao">Enviar eBook</h3>
      <p className="mt-1 text-sm text-muted-foreground">O PDF fica guardado em área restrita; os assinantes leem pelo site, com a marca d'água deles, sem baixar.</p>
      <form onSubmit={enviar} className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Label htmlFor="eb-titulo">Título</Label><Input id="eb-titulo" required minLength={2} maxLength={160} value={titulo} onChange={(e) => setTitulo(e.target.value)} /></div>
        <div><Label htmlFor="eb-autor">Autor</Label><Input id="eb-autor" maxLength={120} value={autor} onChange={(e) => setAutor(e.target.value)} /></div>
        <div><Label htmlFor="eb-cat">Assunto</Label><Input id="eb-cat" maxLength={60} value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Ex.: Sanidade" /></div>
        <div className="sm:col-span-2"><Label htmlFor="eb-desc">Descrição</Label><Textarea id="eb-desc" maxLength={2000} value={descricao} onChange={(e) => setDescricao(e.target.value)} /></div>
        <CampoArquivo id="eb-pdf" rotulo="Arquivo PDF" ajuda="Até 100 MB." accept="application/pdf,.pdf" obrigatorio inputRef={pdfRef} />
        <CampoArquivo id="eb-capa" rotulo="Capa (opcional)" ajuda="JPG, PNG ou WEBP até 5 MB. Sem capa, usamos a primeira página do PDF." accept="image/jpeg,image/png,image/webp" inputRef={capaRef} />
        <div className="sm:col-span-2"><Button type="submit" className="h-12" disabled={!!etapa}>{etapa ? <><LoaderCircle className="animate-spin" />{etapa}</> : <><FileUp />Enviar eBook</>}</Button></div>
      </form>
    </section>
  );
}

function Lista() {
  const qc = useQueryClient();
  const [apagar, setApagar] = useState<Linha | null>(null);
  const livros = useQuery({
    queryKey: ["admin-ebooks"],
    queryFn: async (): Promise<Linha[]> => {
      const { data, error } = await supabase.from("ebooks").select("id,titulo,autor,categoria,descricao,paginas,capa_path,arquivo_path,tamanho_bytes,publicado,publicado_em,created_at").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const resumo = useQuery({
    queryKey: ["admin-ebooks-resumo"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_ebooks_resumo");
      if (error) throw error;
      return new Map((data ?? []).map((r) => [r.ebook_id, r]));
    },
  });
  const publicar = async (l: Linha, sim: boolean) => {
    const { error } = await supabase.from("ebooks").update({ publicado: sim, publicado_em: sim ? new Date().toISOString() : l.publicado_em, updated_at: new Date().toISOString() }).eq("id", l.id);
    if (error) toast.error("Não foi possível mudar a publicação.");
    else { toast.success(sim ? "Publicado: os assinantes já veem." : "Despublicado: saiu da biblioteca."); void qc.invalidateQueries({ queryKey: ["admin-ebooks"] }); }
  };
  const excluir = async (l: Linha) => {
    if (l.arquivo_path) await supabase.storage.from("ebooks").remove([l.arquivo_path]);
    if (l.capa_path) await supabase.storage.from("ebook-capas").remove([l.capa_path]);
    const { error } = await supabase.from("ebooks").delete().eq("id", l.id);
    if (error) toast.error("Não foi possível excluir.");
    else { toast.success("eBook excluído."); void qc.invalidateQueries({ queryKey: ["admin-ebooks"] }); }
  };
  return (
    <section className="painel p-4 sm:p-6">
      <h3 className="titulo-secao">eBooks</h3>
      {livros.isLoading ? <p className="mt-3 text-muted-foreground">Carregando…</p> : (livros.data ?? []).length === 0 ? <p className="mt-3 text-muted-foreground">Nenhum eBook enviado ainda.</p> : (
        <ul className="mt-3 divide-y divide-border">
          {livros.data!.map((l) => {
            const r = resumo.data?.get(l.id);
            return (
              <li key={l.id} className="flex flex-wrap items-center gap-4 py-3">
                <Capa caminho={l.capa_path} titulo={l.titulo} pequena className="h-24 w-[4.5rem] shrink-0 rounded-lg border border-border" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{l.titulo}</p>
                  <p className="text-sm text-muted-foreground">{[l.autor, l.categoria, l.paginas ? `${l.paginas} páginas` : null, mb(l.tamanho_bytes)].filter(Boolean).join(" · ")}</p>
                  <p className="text-sm text-muted-foreground">{r ? `${plural(r.aberturas, "abertura")} por ${plural(r.leitores, "pessoa")}${r.ultima ? `, a última em ${diaBR(r.ultima)}` : ""}` : "Sem leituras ainda"}</p>
                </div>
                <label className="flex items-center gap-2 font-bold"><Switch checked={l.publicado} onCheckedChange={(v) => void publicar(l, v)} />{l.publicado ? "Publicado" : "Rascunho"}</label>
                <Button variant="outline" size="icon" className="text-alerta" aria-label={`Excluir ${l.titulo}`} onClick={() => setApagar(l)}><Trash2 /></Button>
              </li>
            );
          })}
        </ul>
      )}
      <AlertDialog open={!!apagar} onOpenChange={(v) => !v && setApagar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir “{apagar?.titulo}”?</AlertDialogTitle>
            <AlertDialogDescription>O PDF e a capa são apagados e o eBook sai da biblioteca de todos. Isso não pode ser desfeito.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-12">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="h-12 bg-alerta text-white hover:bg-alerta/90 dark:text-[#0e1712]" onClick={() => { const l = apagar; setApagar(null); if (l) void excluir(l); }}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

export function EbooksAdmin() {
  return (
    <div className="space-y-6">
      <NovoEbook />
      <Lista />
    </div>
  );
}

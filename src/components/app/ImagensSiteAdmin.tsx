import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImageUp, Link2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IMAGENS_INFO, IMAGENS_PADRAO, IMAGENS_QUERY, useImagensSite, type ChaveImagem } from "./imagensSite";

async function reduzir(file: File, maxL: number, maxA: number): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => erro(new Error()); i.src = url; });
    const esc = Math.min(1, maxL / img.width, maxA / img.height);
    const c = document.createElement("canvas"); c.width = Math.round(img.width * esc); c.height = Math.round(img.height * esc);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    for (const q of [0.82, 0.7, 0.55, 0.4]) {
      const webp = c.toDataURL("image/webp", q);
      const d = webp.startsWith("data:image/webp") ? webp : c.toDataURL("image/jpeg", q);
      if (d.length <= 1_400_000) return d;
    }
    throw new Error("grande");
  } finally { URL.revokeObjectURL(url); }
}

function Item({ info }: { info: (typeof IMAGENS_INFO)[number] }) {
  const imagem = useImagensSite();
  const atual = imagem(info.chave);
  const qc = useQueryClient();
  const arquivo = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState("");
  const [previa, setPrevia] = useState<string | null>(null);

  const salvar = useMutation({
    mutationFn: async (valor: string | null) => {
      const t = supabase.from("imagens_site" as never);
      if (valor === null) { const { error } = await t.delete().eq("chave", info.chave); if (error) throw error; return; }
      const { data: u } = await supabase.auth.getUser();
      const { error } = await t.upsert({ chave: info.chave, valor, atualizado_em: new Date().toISOString(), atualizado_por: u.user?.id ?? null } as never);
      if (error) throw error;
    },
    onSuccess: (_d, v) => { qc.invalidateQueries({ queryKey: IMAGENS_QUERY }); setPrevia(null); setLink(""); toast.success(v === null ? "Imagem original restaurada." : "Imagem atualizada para todos."); },
    onError: (e: Error) => toast.error(e.message.includes("row-level") ? "Só administradores podem trocar imagens." : "Não foi possível salvar a imagem."),
  });

  const usarLink = () => {
    try {
      const u = new URL(link.trim()); if (u.protocol !== "https:") throw new Error();
      const t = new Image(); t.onload = () => setPrevia(u.toString()); t.onerror = () => toast.error("Esse link não abriu uma imagem."); t.src = u.toString();
    } catch { toast.error("Cole um link válido começando com https://"); }
  };
  const escolher = async (f?: File) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast.error("Escolha um arquivo de imagem (JPG, PNG ou WebP).");
    if (f.size > 15 * 1024 * 1024) return toast.error("Imagem muito grande (máximo 15 MB).");
    try { setPrevia(await reduzir(f, info.largura, info.altura)); } catch { toast.error("Não consegui usar essa imagem."); }
  };
  const padrao = atual === IMAGENS_PADRAO[info.chave as ChaveImagem];
  const vertical = info.chave === "fundo_menu";

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold">{info.titulo}</h3>
      <p className="mb-4 text-xs text-muted-foreground">{info.dica}</p>
      <div className={vertical ? "grid gap-5 sm:grid-cols-[120px_1fr]" : "space-y-4"}>
        <div>
          <img src={previa ?? atual} alt={info.titulo} className={`w-full rounded-lg border border-border object-cover ${vertical ? "aspect-[3/10]" : "aspect-[16/6]"}`} />
          <p className="mt-1 text-[11px] text-muted-foreground">{previa ? "Prévia — ainda não salva" : padrao ? "Imagem original" : "Imagem atual"}</p>
        </div>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="https://exemplo.com/imagem.jpg" value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => e.key === "Enter" && usarLink()} />
            <Button variant="outline" onClick={usarLink} disabled={!link.trim()}><Link2 />Ver</Button>
          </div>
          <input ref={arquivo} type="file" accept="image/*" className="hidden" onChange={(e) => { escolher(e.target.files?.[0]); e.target.value = ""; }} />
          <Button variant="outline" onClick={() => arquivo.current?.click()}><ImageUp />Enviar imagem</Button>
          <div className="flex flex-wrap gap-2 border-t border-border pt-3">
            <Button disabled={!previa || salvar.isPending} onClick={() => previa && salvar.mutate(previa)}>{salvar.isPending ? "Salvando…" : "Salvar"}</Button>
            {previa && <Button variant="ghost" onClick={() => setPrevia(null)}>Cancelar</Button>}
            <Button variant="ghost" className="ml-auto" disabled={salvar.isPending || padrao} onClick={() => { if (confirm("Voltar à imagem original?")) salvar.mutate(null); }}><RotateCcw />Original</Button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ImagensSiteAdmin() {
  return <div className="grid gap-4 lg:grid-cols-2">{IMAGENS_INFO.map((i) => <Item key={i.chave} info={i} />)}</div>;
}

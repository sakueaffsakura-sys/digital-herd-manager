import { pdfParaImagem, ACEITA_IMAGEM_OU_PDF } from "@/lib/pdfImagem";
import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImageUp, Link2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useYuiAvatar, YUI_FOTO_CHAVE, YUI_FOTO_PADRAO, YUI_FOTO_QUERY } from "./useYuiAvatar";

/** Reduz a imagem para 320px (quadrado, centralizado) em WebP/JPEG. */
async function reduzir(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => erro(new Error("Imagem inválida")); i.src = url; });
    const lado = Math.min(img.width, img.height);
    const c = document.createElement("canvas"); c.width = 320; c.height = 320;
    c.getContext("2d")!.drawImage(img, (img.width - lado) / 2, (img.height - lado) / 2, lado, lado, 0, 0, 320, 320);
    const webp = c.toDataURL("image/webp", 0.85);
    return webp.startsWith("data:image/webp") ? webp : c.toDataURL("image/jpeg", 0.85);
  } finally { URL.revokeObjectURL(url); }
}

export function YuiFotoAdmin() {
  const atual = useYuiAvatar();
  const qc = useQueryClient();
  const arquivo = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState("");
  const [previa, setPrevia] = useState<string | null>(null);

  const salvar = useMutation({
    mutationFn: async (valor: string | null) => {
      if (valor === null) {
        const { error } = await supabase.from("configuracoes_sistema").delete().eq("chave", YUI_FOTO_CHAVE);
        if (error) throw error;
        return;
      }
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("configuracoes_sistema").upsert({ chave: YUI_FOTO_CHAVE, valor, atualizado_em: new Date().toISOString(), atualizado_por: u.user?.id ?? null });
      if (error) throw error;
    },
     onSuccess: (_d, valor) => { qc.invalidateQueries({ queryKey: YUI_FOTO_QUERY }); setPrevia(null); setLink(""); toast.success(valor === null ? "Foto padrão da Yui restaurada." : "Foto da Yui atualizada para administradores."); },
    onError: (e: Error) => toast.error(e.message.includes("row-level") ? "Só administradores podem trocar a foto." : "Não foi possível salvar a foto."),
  });

  const usarLink = () => {
    try {
      const u = new URL(link.trim());
      if (u.protocol !== "https:") throw new Error();
      const teste = new Image();
      teste.onload = () => setPrevia(u.toString());
      teste.onerror = () => toast.error("Esse link não abriu uma imagem. Confira o endereço.");
      teste.src = u.toString();
    } catch { toast.error("Cole um link válido começando com https://"); }
  };

  const escolherArquivo = async (arq?: File) => {
    if (!arq) return;
    let f: File; try { f = await pdfParaImagem(arq); } catch (e) { toast.error((e as Error).message); return; }
    if (!f.type.startsWith("image/")) { toast.error("Escolha um arquivo de imagem (JPG, PNG ou WebP)."); return; }
    if (f.size > 10 * 1024 * 1024) { toast.error("Imagem muito grande (máximo 10 MB)."); return; }
    try { setPrevia(await reduzir(f)); } catch { toast.error("Não consegui abrir essa imagem."); }
  };

  const mostrada = previa ?? atual;
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h3 className="mb-1 text-sm font-semibold">Foto da Yui</h3>
       <p className="mb-5 text-xs text-muted-foreground">A foto personalizada aparece somente para administradores no botão de ajuda, no chat e no tour. Outras contas veem a foto padrão.</p>
      <div className="grid gap-6 md:grid-cols-[160px_1fr]">
        <div className="flex flex-col items-center gap-2">
          <img src={mostrada} alt="Foto da Yui" width={128} height={128} className="size-32 rounded-full border-2 border-primary bg-primary/10 object-cover" />
          <span className="text-xs text-muted-foreground">{previa ? "Prévia — ainda não salva" : atual === YUI_FOTO_PADRAO ? "Foto padrão" : "Foto atual"}</span>
        </div>
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="yui-link">Usar um link</Label>
            <div className="flex gap-2">
              <Input id="yui-link" placeholder="https://exemplo.com/foto.png" value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => e.key === "Enter" && usarLink()} />
              <Button variant="outline" onClick={usarLink} disabled={!link.trim()}><Link2 />Ver</Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Ou enviar do computador/celular</Label>
            <input ref={arquivo} type="file" accept={ACEITA_IMAGEM_OU_PDF} className="hidden" onChange={(e) => { escolherArquivo(e.target.files?.[0]); e.target.value = ""; }} />
            <Button variant="outline" onClick={() => arquivo.current?.click()}><ImageUp />Escolher imagem</Button>
            <p className="text-xs text-muted-foreground">A imagem é recortada em quadrado e reduzida automaticamente.</p>
          </div>
          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <Button disabled={!previa || salvar.isPending} onClick={() => previa && salvar.mutate(previa)}>{salvar.isPending ? "Salvando…" : "Salvar foto"}</Button>
            {previa && <Button variant="ghost" onClick={() => setPrevia(null)}>Cancelar</Button>}
            <Button variant="ghost" className="ml-auto" disabled={salvar.isPending || atual === YUI_FOTO_PADRAO} onClick={() => salvar.mutate(null)}><RotateCcw />Voltar à foto padrão</Button>
          </div>
        </div>
      </div>
    </section>
  );
}

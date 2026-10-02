import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImageUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useYuiWallpaper, YUI_WALLPAPER_BUCKET, YUI_WALLPAPER_KEY, YUI_WALLPAPER_QUERY } from "./useYuiWallpaper";

const TIPOS: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "video/mp4": "mp4" };

export function YuiWallpaperAdmin() {
  const input = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const { data: atual, isLoading, isError } = useYuiWallpaper();
  const [selecionado, setSelecionado] = useState<File | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);

  useEffect(() => {
    if (!selecionado) { setPrevia(null); return; }
    const url = URL.createObjectURL(selecionado);
    setPrevia(url);
    return () => URL.revokeObjectURL(url);
  }, [selecionado]);

  const salvar = useMutation({
    mutationFn: async (file: File) => {
      const ext = TIPOS[file.type];
      if (!ext || file.size > 20 * 1024 * 1024) throw new Error("Escolha JPG, PNG, GIF ou MP4 com até 20 MB.");
      const { data: user, error: authError } = await supabase.auth.getUser();
      if (authError || !user.user) throw new Error("Entre novamente na sua conta.");
      const path = `${crypto.randomUUID()}.${ext}`;
      const bucket = supabase.storage.from(YUI_WALLPAPER_BUCKET);
      const { error: uploadError } = await bucket.upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      const { error: saveError } = await supabase.from("configuracoes_sistema").upsert({ chave: YUI_WALLPAPER_KEY, valor: path, atualizado_em: new Date().toISOString(), atualizado_por: user.user.id });
      if (saveError) {
        await bucket.remove([path]);
        throw saveError;
      }
      if (atual?.path && atual.path !== path) await bucket.remove([atual.path]);
    },
    onSuccess: async () => { setSelecionado(null); await qc.invalidateQueries({ queryKey: YUI_WALLPAPER_QUERY }); toast.success("Fundo do chat atualizado para administradores."); },
    onError: (error: Error) => toast.error(error.message),
  });

  const remover = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("configuracoes_sistema").delete().eq("chave", YUI_WALLPAPER_KEY);
      if (error) throw error;
      if (atual?.path) await supabase.storage.from(YUI_WALLPAPER_BUCKET).remove([atual.path]);
    },
    onSuccess: async () => { setSelecionado(null); await qc.invalidateQueries({ queryKey: YUI_WALLPAPER_QUERY }); toast.success("Fundo original do chat restaurado."); },
    onError: (error: Error) => toast.error(error.message),
  });

  const url = previa ?? atual?.url;
  const video = selecionado ? selecionado.type === "video/mp4" : atual?.video;
  return <section className="rounded-xl border border-border bg-card p-5">
    <h3 className="mb-1 text-sm font-semibold">Fundo do chat da Yui</h3>
    <p className="mb-5 text-xs text-muted-foreground">Sem fundo personalizado, o chat usa o fundo original para todas as contas. Um fundo personalizado aparece somente para administradores.</p>
    <div className="grid gap-6 md:grid-cols-[160px_1fr]">
      <div className="relative flex aspect-[3/4] items-center justify-center overflow-hidden rounded-md border border-border bg-background text-center text-xs text-muted-foreground">
        {url ? video ? <video key={url} src={url} autoPlay muted loop playsInline className="size-full object-cover" /> : <img src={url} alt="Prévia do fundo da Yui" className="size-full object-cover" /> : <span className="px-3">{isLoading ? "Carregando…" : isError ? "Não foi possível carregar o fundo." : "Sem wallpaper"}</span>}
      </div>
      <div className="flex flex-col justify-between gap-5">
        <div className="space-y-3">
          <p className="text-sm font-medium">Enviar imagem ou vídeo</p>
          <input ref={input} type="file" accept=".jpg,.jpeg,.png,.gif,.mp4,image/jpeg,image/png,image/gif,video/mp4" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; if (!TIPOS[f.type] || f.size > 20 * 1024 * 1024) { toast.error("Escolha JPG, PNG, GIF ou MP4 com até 20 MB."); return; } setSelecionado(f); }} />
          <Button variant="outline" onClick={() => input.current?.click()} disabled={salvar.isPending || remover.isPending}><ImageUp />Escolher arquivo</Button>
          <p className="text-xs text-muted-foreground">JPG, PNG, GIF ou MP4 · até 20 MB. Vídeos tocam sem som e repetem automaticamente.</p>
          {selecionado && <p className="break-all text-xs text-foreground">Prévia: {selecionado.name}</p>}
        </div>
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <Button disabled={!selecionado || salvar.isPending || remover.isPending} onClick={() => selecionado && salvar.mutate(selecionado)}>{salvar.isPending ? "Salvando…" : "Salvar fundo"}</Button>
          {selecionado && <Button variant="ghost" disabled={salvar.isPending} onClick={() => setSelecionado(null)}>Cancelar</Button>}
          <Button variant="outline" disabled={!atual || atual.padrao || salvar.isPending || remover.isPending} onClick={() => { if (confirm("Voltar ao fundo original do chat da Yui?")) remover.mutate(); }}><Trash2 />Voltar ao fundo original</Button>
        </div>
      </div>
    </div>
  </section>;
}
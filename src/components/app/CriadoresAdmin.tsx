import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { CRIADORES_CHAVE, CRIADORES_QUERY, useCriadores, urlSocial, type Criador } from "./criadores";

export function CriadoresAdmin() {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useCriadores(true);
  const [lista, setLista] = useState<Criador[]>([]);
  const [alterado, setAlterado] = useState(false);

  useEffect(() => { if (data && !alterado) setLista(data); }, [data, alterado]);
  const mudar = (proximo: Criador[]) => { setLista(proximo); setAlterado(true); };

  const salvar = useMutation({
    mutationFn: async () => {
      const normalizado = lista.map((c) => ({ id: c.id, nome: c.nome.trim(), redes: c.redes.map((r) => ({ nome: r.nome.trim(), url: r.url.trim() })) }));
      if (normalizado.some((c) => !c.nome)) throw new Error("Preencha o nome de cada criador.");
      if (normalizado.some((c) => c.redes.some((r) => !r.nome || !urlSocial(r.url)))) throw new Error("Preencha o nome da rede e um link válido começando com https:// em cada rede social.");
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error("Entre novamente na sua conta.");
      if (normalizado.length === 0) {
        const { error } = await supabase.from("configuracoes_sistema").delete().eq("chave", CRIADORES_CHAVE);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("configuracoes_sistema").upsert({ chave: CRIADORES_CHAVE, valor: JSON.stringify(normalizado), atualizado_em: new Date().toISOString(), atualizado_por: auth.user.id });
        if (error) throw error;
      }
    },
    onSuccess: async () => { setAlterado(false); await qc.invalidateQueries({ queryKey: CRIADORES_QUERY }); toast.success("Criadores atualizados na janela Sobre."); },
    onError: (error: Error) => toast.error(error.message),
  });

  return <section className="rounded-lg border border-border bg-card p-4 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
       <div><h3 className="font-semibold">Criadores do site</h3><p className="mt-1 text-sm text-muted-foreground">Os nomes e links salvos aparecem somente para administradores na janela Sobre.</p></div>
      <Button variant="outline" disabled={lista.length >= 20 || isLoading || isError} onClick={() => mudar([...lista, { id: crypto.randomUUID(), nome: "", redes: [] }])}><Plus />Adicionar criador</Button>
    </div>
    {isLoading ? <p className="mt-5 text-sm text-muted-foreground">Carregando criadores…</p> : isError ? <div className="mt-5 flex items-center gap-2 text-sm text-alerta">Não foi possível carregar os criadores. <Button variant="outline" size="sm" onClick={() => refetch()}>Tentar novamente</Button></div> : lista.length === 0 ? <p className="mt-5 border-t border-border pt-5 text-sm text-muted-foreground">Nenhum criador cadastrado.</p> : <div className="mt-5 space-y-5">
      {lista.map((criador, index) => <div key={criador.id} className="border-t border-border pt-5">
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1 space-y-2"><Label htmlFor={`criador-${criador.id}`}>Nome do criador {index + 1}</Label><Input id={`criador-${criador.id}`} maxLength={100} value={criador.nome} placeholder="Nome ou equipe" onChange={(e) => mudar(lista.map((c) => c.id === criador.id ? { ...c, nome: e.target.value } : c))} /></div>
          <Button size="icon" variant="ghost" aria-label={`Remover criador ${index + 1}`} title="Remover criador" onClick={() => mudar(lista.filter((c) => c.id !== criador.id))}><Trash2 /></Button>
        </div>
        <div className="mt-4 space-y-3 sm:pl-4">
          {criador.redes.map((rede, i) => <div key={i} className="flex flex-wrap items-end gap-2 sm:flex-nowrap">
            <div className="w-full space-y-1 sm:w-36"><Label htmlFor={`rede-${criador.id}-${i}`}>Rede social</Label><Input id={`rede-${criador.id}-${i}`} maxLength={50} placeholder="Instagram" value={rede.nome} onChange={(e) => mudar(lista.map((c) => c.id === criador.id ? { ...c, redes: c.redes.map((r, ri) => ri === i ? { ...r, nome: e.target.value } : r) } : c))} /></div>
            <div className="min-w-0 flex-1 space-y-1"><Label htmlFor={`link-${criador.id}-${i}`}>Link</Label><Input id={`link-${criador.id}-${i}`} type="url" maxLength={500} placeholder="https://..." value={rede.url} onChange={(e) => mudar(lista.map((c) => c.id === criador.id ? { ...c, redes: c.redes.map((r, ri) => ri === i ? { ...r, url: e.target.value } : r) } : c))} /></div>
            <Button size="icon" variant="ghost" aria-label={`Remover rede social ${i + 1}`} title="Remover rede social" onClick={() => mudar(lista.map((c) => c.id === criador.id ? { ...c, redes: c.redes.filter((_, ri) => ri !== i) } : c))}><Trash2 /></Button>
          </div>)}
          <Button size="sm" variant="ghost" disabled={criador.redes.length >= 5} onClick={() => mudar(lista.map((c) => c.id === criador.id ? { ...c, redes: [...c.redes, { nome: "", url: "" }] } : c))}><Plus />Adicionar rede social</Button>
        </div>
      </div>)}
    </div>}
    <div className="mt-5 flex justify-end border-t border-border pt-4"><Button disabled={!alterado || salvar.isPending || isError || isLoading} onClick={() => salvar.mutate()}>{salvar.isPending ? "Salvando…" : "Salvar criadores"}</Button></div>
  </section>;
}
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpenText, Lock, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Empty, PageTitle } from "../shared";
import { Leitor } from "./Leitor";

export type Ebook = { id: string; titulo: string; autor: string | null; descricao: string | null; categoria: string | null; paginas: number | null; capa_path: string | null; publicado_em: string | null };

/** Capa vinda do armazenamento privado (link curto, só para quem está logado). */
export function Capa({ caminho, titulo, className, pequena, reservarRodape }: { caminho: string | null; titulo: string; className?: string; pequena?: boolean; reservarRodape?: boolean }) {
  const url = useQuery({
    queryKey: ["capa-ebook", caminho],
    enabled: !!caminho,
    staleTime: 50 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("ebook-capas").createSignedUrl(caminho!, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });
  if (!caminho || !url.data) {
    return (
      <div className={`grid place-items-center overflow-hidden bg-capa text-center text-white ${pequena ? "p-1.5" : "p-4"} ${reservarRodape ? "pb-14" : ""} ${className ?? ""}`} aria-hidden={!!titulo}>
        <span className={`font-display font-extrabold leading-[1.05] ${pequena ? "line-clamp-5 text-sm" : "text-2xl"}`}>{titulo}</span>
      </div>
    );
  }
  return <img src={url.data} alt={`Capa de ${titulo}`} className={`object-cover ${className ?? ""}`} loading="lazy" />;
}

export default function Biblioteca({ ebookAberto, aoAbrir, aoFechar, aoIr }: { ebookAberto?: string; aoAbrir: (id: string) => void; aoFechar: () => void; aoIr: (s: string) => void }) {
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState<string | null>(null);
  const assinante = useQuery({ queryKey: ["sou-assinante"], queryFn: async () => (await supabase.rpc("sou_assinante")).data === true });
  const livros = useQuery({
    queryKey: ["ebooks-publicados"],
    queryFn: async (): Promise<Ebook[]> => {
      const { data, error } = await supabase.from("ebooks").select("id,titulo,autor,descricao,categoria,paginas,capa_path,publicado_em").eq("publicado", true).order("publicado_em", { ascending: false }).limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });
  const categorias = useMemo(() => [...new Set((livros.data ?? []).map((l) => l.categoria).filter(Boolean) as string[])].sort(), [livros.data]);
  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return (livros.data ?? []).filter((l) => (!categoria || l.categoria === categoria) && (!t || `${l.titulo} ${l.autor ?? ""} ${l.descricao ?? ""}`.toLowerCase().includes(t)));
  }, [livros.data, busca, categoria]);
  const aberto = livros.data?.find((l) => l.id === ebookAberto);
  const pode = assinante.data === true;

  return (
    <div>
      <PageTitle
        title="Biblioteca"
        description={pode ? "eBooks para ler aqui no site, no computador ou no celular." : "eBooks sobre manejo, sanidade, leite e gestão, liberados para assinantes."}
        action={!pode && assinante.isSuccess ? <Button className="h-12" onClick={() => aoIr("assinatura")}>Assinar para ler</Button> : undefined}
      />
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-1 basis-64 sm:max-w-md">
          <span className="sr-only">Buscar na biblioteca</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-10" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Título, autor ou assunto" />
        </label>
        {categorias.length > 0 && (
          <div role="group" aria-label="Assunto" className="flex flex-wrap gap-2">
            {[null, ...categorias].map((c) => (
              <button key={c ?? "todas"} type="button" aria-pressed={categoria === c} onClick={() => setCategoria(c)}
                className={`h-11 rounded-full border px-4 text-sm font-bold ${categoria === c ? "border-primary bg-sucesso-fundo text-primary" : "border-input text-muted-foreground"}`}>
                {c ?? "Todos"}
              </button>
            ))}
          </div>
        )}
      </div>
      {livros.isLoading ? <p className="text-muted-foreground">Carregando…</p> : lista.length === 0 ? (
        <Empty message={(livros.data ?? []).length ? "Nenhum eBook com essa busca." : "A biblioteca ainda não tem eBooks publicados. Volte em breve."} />
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {lista.map((l) => (
            <li key={l.id}>
              <button type="button" onClick={() => (pode ? aoAbrir(l.id) : aoIr("assinatura"))} className="group block w-full text-left">
                <span className="relative block aspect-[3/4] overflow-hidden rounded-xl border border-border">
                  <Capa caminho={l.capa_path} titulo={l.titulo} reservarRodape={!pode} className="h-full w-full" />
                  {!pode && (
                    <>
                      <span aria-hidden className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 to-transparent" />
                      <span className="absolute inset-x-2 bottom-2 inline-flex items-center justify-center gap-1.5 rounded-full bg-card/95 px-3 py-1.5 text-sm font-bold">
                        <Lock className="size-4 shrink-0" />Para assinantes
                      </span>
                    </>
                  )}
                </span>
                <span className="mt-2 block font-bold leading-snug group-hover:underline">{l.titulo}</span>
                <span className="block text-sm text-muted-foreground">{[l.autor, l.paginas ? `${l.paginas} páginas` : null].filter(Boolean).join(" · ")}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {pode && aberto && <Leitor ebook={aberto} aoFechar={aoFechar} />}
      {pode && ebookAberto && livros.isSuccess && !aberto && (
        <p role="alert" className="mt-4 text-alerta"><BookOpenText className="mr-1 inline size-4" />Esse eBook não está mais disponível.</p>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { escapeILikeValue, quoteOrValue, termoDeBusca } from "@/lib/busca";
import { useDebouncedValue } from "../usePagedRows";
import { Brinco } from "../Brinco";
import type { GrupoMenu } from "./navegacao";

type Achado = { id: string; nome: string | null; numero_brinco: string; situacao: string };

/**
 * Busca de todo o site (Ctrl+K): páginas pelo nome e animais pelo brinco ou nome.
 * Escolher um animal abre a ficha dele no Meu rebanho.
 */
export function BuscaGlobal({
  aberta, aoMudar, grupos, propriedadeId, aoIr, aoAbrirAnimal,
}: {
  aberta: boolean;
  aoMudar: (v: boolean) => void;
  grupos: GrupoMenu[];
  propriedadeId: string | null;
  aoIr: (secao: string) => void;
  aoAbrirAnimal: (id: string) => void;
}) {
  const [texto, setTexto] = useState("");
  const termo = useDebouncedValue(texto.trim(), 250);

  useEffect(() => {
    const atalho = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        aoMudar(!aberta);
      }
    };
    window.addEventListener("keydown", atalho);
    return () => window.removeEventListener("keydown", atalho);
  }, [aberta, aoMudar]);
  useEffect(() => { if (!aberta) setTexto(""); }, [aberta]);

  const animais = useQuery({
    queryKey: ["busca-global", propriedadeId, termo],
    enabled: aberta && !!propriedadeId && termo.length >= 1,
    staleTime: 30_000,
    queryFn: async (): Promise<Achado[]> => {
      const t = escapeILikeValue(termoDeBusca(termo));
      const { data, error } = await supabase
        .from("animais")
        .select("id,nome,numero_brinco,situacao")
        .eq("propriedade_id", propriedadeId!)
        .or(`numero_brinco.ilike.${quoteOrValue(`${t}%`)},nome.ilike.${quoteOrValue(`%${t}%`)}`)
        .order("numero_brinco")
        .limit(8);
      if (error) throw error;
      return data ?? [];
    },
  });

  const paginas = grupos.flatMap((g) => g.itens);
  const ir = (fn: () => void) => { aoMudar(false); fn(); };

  return (
    <Dialog open={aberta} onOpenChange={aoMudar}>
      <DialogContent className="top-[12vh] translate-y-0 overflow-hidden p-0 sm:max-w-xl sm:rounded-2xl">
        <DialogTitle className="sr-only">Buscar</DialogTitle>
        <DialogDescription className="sr-only">Digite o brinco ou o nome do animal, ou o nome de uma página.</DialogDescription>
        <CommandPrimitive shouldFilter={false} className="flex flex-col" label="Buscar no site">
          <div className="flex items-center gap-2 border-b border-border px-4">
            <Search className="size-5 shrink-0 text-muted-foreground" />
            <CommandPrimitive.Input
              value={texto}
              onValueChange={setTexto}
              placeholder="Brinco, nome do animal ou página"
              className="h-14 w-full bg-transparent text-[17px] outline-none placeholder:text-muted-foreground"
            />
          </div>
          <CommandPrimitive.List className="max-h-[60vh] overflow-y-auto p-2">
            {termo.length >= 1 && (
              <CommandPrimitive.Group heading="Animais" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-sm [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:text-muted-foreground">
                {animais.isFetching && !animais.data && <p className="px-3 py-3 text-muted-foreground">Procurando…</p>}
                {animais.data?.length === 0 && <p className="px-3 py-3 text-muted-foreground">Nenhum animal com esse brinco ou nome.</p>}
                {animais.data?.map((a) => (
                  <CommandPrimitive.Item
                    key={a.id}
                    value={`animal-${a.id}`}
                    onSelect={() => ir(() => aoAbrirAnimal(a.id))}
                    className="flex min-h-14 cursor-pointer items-center gap-3 rounded-[10px] px-2 data-[selected=true]:bg-accent"
                  >
                    <Brinco tamanho="pequeno" valor={a.numero_brinco} />
                    <span className="min-w-0">
                      <span className="block truncate font-bold">{a.nome || `Brinco ${a.numero_brinco}`}</span>
                      <span className="block text-sm capitalize text-muted-foreground">{a.situacao}</span>
                    </span>
                  </CommandPrimitive.Item>
                ))}
              </CommandPrimitive.Group>
            )}
            <CommandPrimitive.Group heading="Páginas" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-sm [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:text-muted-foreground">
              {paginas
                .filter((p) => !termo || p.rotulo.toLowerCase().includes(termo.toLowerCase()) || p.frase.toLowerCase().includes(termo.toLowerCase()))
                .map((p) => {
                  const Icone = p.icone;
                  return (
                    <CommandPrimitive.Item
                      key={p.chave}
                      value={`pagina-${p.chave}`}
                      onSelect={() => ir(() => aoIr(p.chave))}
                      className="flex min-h-12 cursor-pointer items-center gap-3 rounded-[10px] px-3 data-[selected=true]:bg-accent"
                    >
                      <Icone className="size-5 shrink-0 text-primary" />
                      <span className="min-w-0">
                        <span className="block font-bold">{p.rotulo}</span>
                        <span className="block truncate text-sm text-muted-foreground">{p.frase}</span>
                      </span>
                    </CommandPrimitive.Item>
                  );
                })}
            </CommandPrimitive.Group>
          </CommandPrimitive.List>
        </CommandPrimitive>
      </DialogContent>
    </Dialog>
  );
}

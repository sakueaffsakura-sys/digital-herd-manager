import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Bell, CalendarClock, Info } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export type Aviso = { chave: string; nivel: "alerta" | "aviso" | "info"; secao: string; titulo: string; texto: string };
type Notificacao = { id: string; titulo: string; mensagem: string; created_at: string };

const COR: Record<Aviso["nivel"], string> = { alerta: "text-alerta", aviso: "text-aviso", info: "text-primary" };
const ICONE = { alerta: AlertTriangle, aviso: CalendarClock, info: Info } as const;

export function useAvisos(propriedadeId: string | null) {
  return useQuery({
    queryKey: ["avisos", propriedadeId],
    enabled: !!propriedadeId,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    queryFn: async () => {
      const [calc, notas] = await Promise.all([
        supabase.rpc("central_avisos", { _propriedade_id: propriedadeId! }),
        supabase.from("notificacoes").select("id,titulo,mensagem,created_at").eq("lida", false).is("chave", null).order("created_at", { ascending: false }).limit(20),
      ]);
      return {
        avisos: calc.error ? [] : ((calc.data ?? []) as unknown as Aviso[]),
        notificacoes: notas.error ? [] : ((notas.data ?? []) as Notificacao[]),
        erro: !!calc.error,
      };
    },
  });
}

/** Sino da barra do topo: o que precisa de atenção agora, com o caminho para resolver. */
export function Avisos({ propriedadeId, aoIr }: { propriedadeId: string | null; aoIr: (secao: string) => void }) {
  const qc = useQueryClient();
  const q = useAvisos(propriedadeId);
  const avisos = q.data?.avisos ?? [];
  const notas = q.data?.notificacoes ?? [];
  const total = avisos.length + notas.length;

  const marcarVisto = async (a: Aviso) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const { error } = await supabase.from("notificacoes").upsert(
      { user_id: data.user.id, propriedade_id: propriedadeId, chave: a.chave, titulo: a.titulo, mensagem: a.texto, lida: true },
      { onConflict: "user_id,chave" },
    );
    if (error) toast.error("Não foi possível marcar como visto. Tente de novo.");
    else void qc.invalidateQueries({ queryKey: ["avisos", propriedadeId] });
  };
  const marcarLida = async (n: Notificacao) => {
    const { error } = await supabase.from("notificacoes").update({ lida: true }).eq("id", n.id);
    if (error) toast.error("Não foi possível marcar como lida.");
    else void qc.invalidateQueries({ queryKey: ["avisos", propriedadeId] });
  };

  return (
    <Popover>
      <PopoverTrigger className="relative grid size-12 place-items-center rounded-[10px] hover:bg-accent" aria-label={total ? `Avisos: ${total} para ver` : "Avisos: nada pendente"}>
        <Bell className="size-6" />
        {total > 0 && (
          <span className="absolute right-1.5 top-1.5 grid min-w-5 place-items-center rounded-full bg-alerta px-1 text-xs font-bold leading-5 text-white dark:text-[#0e1712]">
            {total > 9 ? "9+" : total}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(380px,calc(100vw-16px))] rounded-2xl p-0">
        <div className="border-b border-border px-4 py-3">
          <h2 className="titulo-secao text-[1.4rem]">Avisos</h2>
          <p className="text-sm text-muted-foreground">O que precisa de atenção na propriedade.</p>
        </div>
        <div className="max-h-[min(70vh,520px)] overflow-y-auto p-2">
          {q.isLoading && <p className="px-2 py-6 text-center text-muted-foreground">Conferindo…</p>}
          {!q.isLoading && total === 0 && (
            <p className="px-2 py-6 text-center text-muted-foreground">Nada pendente. Quando uma vacina atrasar ou um parto se aproximar, o aviso aparece aqui.</p>
          )}
          {avisos.map((a) => {
            const Icone = ICONE[a.nivel];
            return (
              <div key={a.chave} className={`aviso-barra my-1 rounded-xl px-3 py-2.5 ${COR[a.nivel]}`}>
                <div className="flex gap-2 text-foreground">
                  <Icone className={`mt-0.5 size-5 shrink-0 ${COR[a.nivel]}`} />
                  <div className="min-w-0">
                    <p className="font-bold leading-snug">{a.titulo}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{a.texto}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button size="sm" className="h-10" onClick={() => aoIr(a.secao)}>Abrir</Button>
                      <Button size="sm" variant="outline" className="h-10" onClick={() => void marcarVisto(a)}>Marcar como visto</Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {notas.map((n) => (
            <div key={n.id} className="aviso-barra my-1 rounded-xl px-3 py-2.5 text-tinta-suave">
              <div className="text-foreground">
                <p className="font-bold leading-snug">{n.titulo}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{n.mensagem}</p>
                <Button size="sm" variant="outline" className="mt-2 h-10" onClick={() => void marcarLida(n)}>Marcar como lida</Button>
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

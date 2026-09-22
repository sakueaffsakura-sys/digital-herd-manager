import { useQuery } from "@tanstack/react-query";
import { Activity, RefreshCw, ShieldAlert, Timer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Empty, PageTitle, Panel, pretty, type Row } from "./shared";

type DiagnosticoItem = { tabela: string; contagem: number; ultima_atualizacao: string | null; tempo_ms: number };
type Inconsistencia = { checagem: string; registros: Row[] };

export default function Diagnostics({ propertyId }: { propertyId: string }) {
  const diagnostic = useQuery({
    queryKey: ["diagnostico", propertyId],
    queryFn: async () => {
      const [{ data, error }, inconsistent] = await Promise.all([
        supabase.rpc("diagnostico_propriedade", { _propriedade_id: propertyId }),
        supabase.rpc("registros_inconsistentes", { _propriedade_id: propertyId }),
      ]);
      if (error) throw error;
      const rows = ((data ?? []) as unknown as DiagnosticoItem[]).sort((a, b) => b.tempo_ms - a.tempo_ms);
      const checagens = ((inconsistent.data ?? []) as unknown as Inconsistencia[]);
      return { rows, checagens };
    },
  });
  const total = (diagnostic.data?.rows ?? []).reduce((sum, r) => sum + Number(r.contagem || 0), 0);
  const tempo = (diagnostic.data?.rows ?? []).reduce((sum, r) => sum + Number(r.tempo_ms || 0), 0);
  const inconsistentCount = (diagnostic.data?.checagens ?? []).reduce((sum, c) => sum + Number(c.registros?.length ?? 0), 0);

  return (
    <div className="space-y-5">
      <PageTitle icon={Activity} title="Diagnóstico" description="Saúde dos dados e desempenho das consultas da propriedade." action={<Button variant="outline" onClick={() => void diagnostic.refetch()} disabled={diagnostic.isFetching}><RefreshCw className={diagnostic.isFetching ? "animate-spin" : ""} />Atualizar</Button>} />

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Contagens por módulo" subtitle="COUNT(*) reais servidos do banco">
          {diagnostic.isLoading ? <p className="text-sm text-muted-foreground">Medindo…</p> : !diagnostic.data?.rows.length ? <Empty message="Nenhum dado para esta propriedade." /> : (
            <div className="divide-y divide-border">
              <div className="flex items-center justify-between py-3 text-xs font-semibold text-muted-foreground first:pt-0">
                <span className="flex items-center gap-2"><Timer className="size-3.5" />Tempo total: {tempo.toFixed(1)} ms</span>
                <span>Total: {total.toLocaleString("pt-BR")} registros</span>
              </div>
              {diagnostic.data.rows.map((r) => (
                <div className="flex items-center justify-between gap-3 py-3 first:pt-0" key={r.tabela}>
                  <div>
                    <strong className="block text-sm capitalize">{r.tabela.replaceAll("_", " ")}</strong>
                    <span className="text-xs text-muted-foreground">Última atualização: {pretty(r.ultima_atualizacao)}</span>
                  </div>
                  <div className="text-right">
                    <strong className="block text-sm">{Number(r.contagem || 0).toLocaleString("pt-BR")}</strong>
                    <span className="text-xs text-muted-foreground">{Number(r.tempo_ms || 0).toFixed(1)} ms</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Revisão de consistência" subtitle={`${inconsistentCount} possível(is) irregularidade(s) — nenhum dado é apagado`} >
          {diagnostic.isLoading ? <p className="text-sm text-muted-foreground">Verificando…</p> : !diagnostic.data?.checagens.length || inconsistentCount === 0 ? (
            <Empty message="Nenhuma inconsistência detectada." />
          ) : (
            <div className="space-y-5">
              {diagnostic.data.checagens.map((c) => (
                <div key={c.checagem} className="rounded-lg border border-border bg-muted/20 p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold"><ShieldAlert className="size-4 text-amber-500" />{c.checagem}</p>
                  {c.registros.length ? (
                    <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-muted-foreground">
                      {c.registros.slice(0, 20).map((r, i) => (
                        <li key={i}>{pretty(r["detalhe"])}</li>
                      ))}
                      {c.registros.length > 20 && <li>…e mais {c.registros.length - 20}.</li>}
                    </ul>
                  ) : <p className="mt-1 text-xs text-muted-foreground">OK</p>}
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, UserX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { dataNoFuso, diaBR } from "@/lib/datas";
import { plural } from "@/lib/texto";

type Pedido = { id: string; user_id: string; email: string | null; motivo: string | null; status: string; criado_em: string; prazo: string; concluida_em: string | null };

const DIA = 86_400_000;
function diasAte(prazo: string) {
  const hoje = Date.parse(`${dataNoFuso()}T00:00:00Z`);
  return Math.round((Date.parse(`${prazo}T00:00:00Z`) - hoje) / DIA);
}

function Confirmar({ pedido, aoFechar }: { pedido: Pedido; aoFechar: () => void }) {
  const qc = useQueryClient();
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const alvo = (pedido.email ?? "").trim().toLowerCase();
  const confere = alvo.length > 0 && texto.trim().toLowerCase() === alvo;
  const concluir = async () => {
    setEnviando(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) throw new Error("Sua sessão expirou. Entre novamente.");
      const r = await fetch("/api/admin/exclusao", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: pedido.id }),
      });
      const corpo = (await r.json().catch(() => ({}))) as { ok?: boolean; erro?: string; arquivos?: number };
      if (!r.ok || corpo.ok !== true) throw new Error(corpo.erro ?? "Não foi possível concluir a exclusão.");
      toast.success(`Conta excluída${corpo.arquivos ? ` com ${plural(corpo.arquivos, "arquivo")}` : ""}. O pedido foi marcado como atendido.`);
      void qc.invalidateQueries({ queryKey: ["admin-exclusoes"] });
      void qc.invalidateQueries({ queryKey: ["admin-contas"] });
      aoFechar();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setEnviando(false);
    }
  };
  return (
    <Dialog open onOpenChange={(v) => !v && !enviando && aoFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir a conta de {pedido.email ?? "sem e-mail"}?</DialogTitle>
          <DialogDescription>
            Apaga a conta, as propriedades em que ela é a dona com todos os registros, as fotos e as conversas com a Yui. Não dá para desfazer.
          </DialogDescription>
        </DialogHeader>
        {alvo ? (
          <div>
            <Label htmlFor="conf-email">Para confirmar, digite o e-mail da conta</Label>
            <Input id="conf-email" autoComplete="off" spellCheck={false} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={pedido.email ?? ""} />
          </div>
        ) : (
          <p className="text-alerta">Este pedido não tem e-mail. Confira a conta na aba Contas antes de excluir.</p>
        )}
        <DialogFooter>
          <Button variant="outline" className="h-12" onClick={aoFechar} disabled={enviando}>Cancelar</Button>
          <Button className="h-12 bg-alerta text-white hover:bg-alerta/90 dark:text-[#0e1712]" disabled={!confere || enviando} onClick={() => void concluir()}>
            {enviando ? <><LoaderCircle className="animate-spin" />Excluindo…</> : <><UserX />Excluir conta</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ExclusoesAdmin() {
  const [alvo, setAlvo] = useState<Pedido | null>(null);
  const lista = useQuery({
    queryKey: ["admin-exclusoes"],
    refetchInterval: 60_000,
    queryFn: async (): Promise<Pedido[]> => {
      const { data, error } = await supabase.from("solicitacoes_exclusao").select("id,user_id,email,motivo,status,criado_em,prazo,concluida_em").order("criado_em", { ascending: false }).limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
  const pendentes = (lista.data ?? []).filter((p) => p.status === "pendente");
  const outros = (lista.data ?? []).filter((p) => p.status !== "pendente").slice(0, 30);
  return (
    <div className="space-y-6">
      <section className="painel p-4 sm:p-6">
        <h3 className="titulo-secao">Aguardando</h3>
        <p className="mt-1 text-sm text-muted-foreground">A LGPD dá 15 dias para atender. Antes de excluir, avise a pessoa se houver assinatura paga em andamento.</p>
        {lista.isLoading ? <p className="mt-3 text-muted-foreground">Carregando…</p> : lista.isError ? <p className="mt-3 text-alerta">Não foi possível carregar os pedidos.</p> : pendentes.length === 0 ? (
          <p className="mt-3 text-muted-foreground">Nenhum pedido de exclusão aguardando.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {pendentes.map((p) => {
              const d = diasAte(p.prazo);
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{p.email ?? "Sem e-mail"}</p>
                    <p className="text-sm text-muted-foreground">Pedido em {diaBR(p.criado_em)}{p.motivo ? `. Motivo: ${p.motivo}` : ""}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-sm font-bold ${d < 0 ? "bg-alerta-fundo text-alerta" : d <= 3 ? "bg-aviso-fundo text-aviso" : "bg-muted text-muted-foreground"}`}>
                    {d < 0 ? `Prazo passou há ${plural(-d, "dia")}` : d === 0 ? "Prazo termina hoje" : `${d === 1 ? "Falta" : "Faltam"} ${plural(d, "dia")}`}
                  </span>
                  <Button variant="outline" className="h-11 border-alerta/60 text-alerta hover:bg-alerta-fundo hover:text-alerta" onClick={() => setAlvo(p)}><UserX />Concluir exclusão</Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {outros.length > 0 && (
        <section className="painel p-4 sm:p-6">
          <h3 className="titulo-secao">Atendidos e cancelados</h3>
          <ul className="mt-3 divide-y divide-border">
            {outros.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="min-w-0 truncate">{p.email ?? "Sem e-mail"}</span>
                <span className="text-sm text-muted-foreground">{p.status === "concluida" ? `Excluída em ${diaBR(p.concluida_em)}` : "Cancelado pela pessoa"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {alvo && <Confirmar pedido={alvo} aoFechar={() => setAlvo(null)} />}
    </div>
  );
}

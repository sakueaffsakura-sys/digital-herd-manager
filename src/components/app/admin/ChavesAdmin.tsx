import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Linha = { nome: string; origem: "painel" | "ambiente" | "nenhuma"; final: string; alterado_em: string | null };
const INFO: Record<string, { titulo: string; ajuda: string }> = {
  MERCADOPAGO_ACCESS_TOKEN: { titulo: "Mercado Pago — Access Token", ajuda: "Suas integrações → Credenciais de produção → Access Token (começa com APP_USR-)." },
  MERCADOPAGO_WEBHOOK_SECRET: { titulo: "Mercado Pago — assinatura do aviso", ajuda: "Suas integrações → Webhooks → Assinatura secreta." },
  CHAVE_RESGATE: { titulo: "Chave de resgate", ajuda: "Invente uma senha longa. Com ela, em /resgate, você desliga a manutenção se o painel ficar inacessível." },
};

async function chamar(url: string, init?: RequestInit) {
  const t = (await supabase.auth.getSession()).data.session?.access_token ?? "";
  const r = await fetch(url, { ...init, headers: { "content-type": "application/json", authorization: `Bearer ${t}` } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { erro?: string }).erro ?? "Não foi possível concluir.");
  return j;
}

export function ChavesAdmin() {
  const q = useQuery({ queryKey: ["admin-chaves"], queryFn: () => chamar("/api/admin/chaves") as Promise<{ mestra: boolean; chaves: Linha[] }> });
  if (q.isLoading) return <p className="text-muted-foreground">Carregando chaves…</p>;
  if (q.error) return <p className="text-destructive">{(q.error as Error).message}</p>;
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground">As chaves ficam guardadas de forma protegida. Depois de salvas, só aparecem os 4 últimos caracteres.</p>
      {q.data?.chaves.map((c) => <CartaoChave key={c.nome} c={c} />)}
    </div>
  );
}

function CartaoChave({ c }: { c: Linha }) {
  const qc = useQueryClient();
  const [valor, setValor] = useState("");
  const info = INFO[c.nome];
  const salvar = useMutation({
    mutationFn: (v: string | null) => chamar("/api/admin/chaves", { method: "POST", body: JSON.stringify({ nome: c.nome, valor: v }) }),
    onSuccess: (_d, v) => { setValor(""); toast.success(v === null ? "Chave removida do painel." : "Chave salva."); void qc.invalidateQueries({ queryKey: ["admin-chaves"] }); void qc.invalidateQueries({ queryKey: ["mp-estado"] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  const testar = useMutation({
    mutationFn: () => chamar("/api/admin/chaves-testar", { method: "POST" }) as Promise<{ ok: boolean; mensagem: string }>,
    onSuccess: (r) => (r.ok ? toast.success(r.mensagem) : toast.error(r.mensagem)),
    onError: (e) => toast.error((e as Error).message),
  });
  const status = c.origem === "painel" ? `Salva no painel ${c.final ? `(••••${c.final})` : ""}${c.alterado_em ? ` em ${new Date(c.alterado_em).toLocaleString("pt-BR")}` : ""}`
    : c.origem === "ambiente" ? "Usando a chave configurada no servidor" : "Não configurada";
  return (
    <section className="painel space-y-3 p-4 sm:p-6">
      <div>
        <h3 className="titulo-secao">{info?.titulo ?? c.nome}</h3>
        <p className="text-muted-foreground">{info?.ajuda}</p>
        <p className="mt-1 font-medium">{status}</p>
      </div>
      <form className="flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={(e) => { e.preventDefault(); if (valor.trim()) salvar.mutate(valor.trim()); }}>
        <div className="flex-1 space-y-1">
          <Label htmlFor={`ch-${c.nome}`}>Nova chave</Label>
          <Input id={`ch-${c.nome}`} type="password" autoComplete="off" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Cole aqui" />
        </div>
        <Button type="submit" disabled={salvar.isPending || valor.trim().length < 12}>{salvar.isPending ? "Salvando…" : "Salvar"}</Button>
        {c.origem === "painel" && <Button type="button" variant="outline" disabled={salvar.isPending} onClick={() => { if (confirm("Remover esta chave do painel?")) salvar.mutate(null); }}>Remover</Button>}
        {c.nome === "MERCADOPAGO_ACCESS_TOKEN" && <Button type="button" variant="secondary" disabled={testar.isPending} onClick={() => testar.mutate()}>{testar.isPending ? "Testando…" : "Testar"}</Button>}
      </form>
    </section>
  );
}

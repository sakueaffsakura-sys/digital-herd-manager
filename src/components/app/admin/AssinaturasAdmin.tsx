import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Copy, Plus, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { diaBR } from "@/lib/datas";
import { nomeDoMetodo } from "@/lib/mercadopago";
import { Status, money } from "../shared";

type Plano = { id: string; nome: string; descricao: string | null; meses: number; preco_centavos: number; ativo: boolean; ordem: number };

async function token() {
  return (await supabase.auth.getSession()).data.session?.access_token ?? "";
}

function EstadoMercadoPago() {
  const estado = useQuery({
    queryKey: ["mp-estado"],
    queryFn: async () => {
      const r = await fetch("/api/admin/pagamentos-estado", { headers: { authorization: `Bearer ${await token()}` } });
      if (!r.ok) throw new Error("estado");
      return (await r.json()) as { token: boolean; segredo: boolean; url_aviso: string };
    },
  });
  const item = (ok: boolean | undefined, texto: string) => (
    <li className="flex items-center gap-2">{ok ? <CheckCircle2 className="size-5 text-primary" /> : <XCircle className="size-5 text-alerta" />}{texto}: <strong>{ok ? "configurado" : "falta configurar"}</strong></li>
  );
  return (
    <section className="painel p-4 sm:p-6">
      <h3 className="titulo-secao">Mercado Pago</h3>
      {estado.isLoading ? <p className="mt-2 text-muted-foreground">Conferindo…</p> : (
        <>
          <ul className="mt-3 space-y-1.5">
            {item(estado.data?.token, "Access Token de produção (MERCADOPAGO_ACCESS_TOKEN)")}
            {item(estado.data?.segredo, "Assinatura secreta do webhook (MERCADOPAGO_WEBHOOK_SECRET)")}
          </ul>
          <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
            <li>No Lovable, abra o projeto, vá em Cloud, Secrets, e crie os dois segredos acima com os valores do painel do Mercado Pago (Suas integrações, Credenciais de produção). Nunca envie esses valores por mensagem.</li>
            <li>No painel do Mercado Pago, em Webhooks, cadastre a URL abaixo, marque o evento Pagamentos e copie a assinatura secreta para o segredo do passo 1.</li>
            <li>Defina o preço e ligue pelo menos um plano aqui embaixo. Sem plano ligado com preço, o botão de assinar não aparece.</li>
          </ol>
          {estado.data?.url_aviso && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <code className="break-all rounded-lg bg-muted px-3 py-2 text-sm">{estado.data.url_aviso}</code>
              <Button variant="outline" className="h-11" onClick={() => void navigator.clipboard.writeText(estado.data!.url_aviso).then(() => toast.success("Endereço copiado."))}><Copy />Copiar</Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function LinhaPlano({ plano }: { plano: Plano }) {
  const qc = useQueryClient();
  const [nome, setNome] = useState(plano.nome);
  const [descricao, setDescricao] = useState(plano.descricao ?? "");
  const [meses, setMeses] = useState(String(plano.meses));
  const [preco, setPreco] = useState((plano.preco_centavos / 100).toFixed(2).replace(".", ","));
  const [ativo, setAtivo] = useState(plano.ativo);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { setAtivo(plano.ativo); }, [plano.ativo]);
  const centavos = Math.round(Number(preco.replace(/\./g, "").replace(",", ".")) * 100);
  const salvar = async () => {
    const m = Number(meses);
    if (!Number.isInteger(m) || m < 1 || m > 36) { toast.error("Meses: de 1 a 36."); return; }
    if (!Number.isFinite(centavos) || centavos < 0) { toast.error("Preço inválido."); return; }
    if (ativo && centavos <= 0) { toast.error("Defina um preço antes de ligar o plano."); return; }
    setSalvando(true);
    const { error } = await supabase.from("planos").update({ nome: nome.trim(), descricao: descricao.trim() || null, meses: m, preco_centavos: centavos, ativo, atualizado_em: new Date().toISOString() }).eq("id", plano.id);
    setSalvando(false);
    if (error) toast.error("Não foi possível salvar o plano.");
    else { toast.success("Plano salvo."); void qc.invalidateQueries({ queryKey: ["admin-planos"] }); void qc.invalidateQueries({ queryKey: ["planos-ativos"] }); }
  };
  return (
    <li className="grid gap-3 rounded-2xl border border-border p-4 sm:grid-cols-[1.2fr_2fr_6rem_8rem_auto] sm:items-end">
      <div><Label htmlFor={`n-${plano.id}`}>Nome</Label><Input id={`n-${plano.id}`} value={nome} maxLength={60} onChange={(e) => setNome(e.target.value)} /></div>
      <div><Label htmlFor={`d-${plano.id}`}>Descrição</Label><Input id={`d-${plano.id}`} value={descricao} maxLength={500} onChange={(e) => setDescricao(e.target.value)} /></div>
      <div><Label htmlFor={`m-${plano.id}`}>Meses</Label><Input id={`m-${plano.id}`} inputMode="numeric" value={meses} onChange={(e) => setMeses(e.target.value)} /></div>
      <div><Label htmlFor={`p-${plano.id}`}>Preço (R$)</Label><Input id={`p-${plano.id}`} inputMode="decimal" value={preco} onChange={(e) => setPreco(e.target.value)} /></div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 font-bold"><Switch checked={ativo} onCheckedChange={setAtivo} />{ativo ? "Ligado" : "Desligado"}</label>
        <Button className="h-12" disabled={salvando} onClick={() => void salvar()}>Salvar</Button>
      </div>
    </li>
  );
}

function Planos() {
  const qc = useQueryClient();
  const planos = useQuery({
    queryKey: ["admin-planos"],
    queryFn: async (): Promise<Plano[]> => {
      const { data, error } = await supabase.from("planos").select("id,nome,descricao,meses,preco_centavos,ativo,ordem").order("ordem");
      if (error) throw error;
      return data ?? [];
    },
  });
  const novo = async () => {
    const { error } = await supabase.from("planos").insert({ nome: "Novo plano", meses: 6, preco_centavos: 0, ativo: false, ordem: (planos.data?.length ?? 0) + 1 });
    if (error) toast.error("Não foi possível criar o plano.");
    else void qc.invalidateQueries({ queryKey: ["admin-planos"] });
  };
  return (
    <section className="painel p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="titulo-secao">Planos e preços</h3>
        <Button variant="outline" className="h-11" onClick={() => void novo()}><Plus />Novo plano</Button>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">O preço vale para os próximos pagamentos; quem já pagou não é afetado.</p>
      {planos.isLoading ? <p className="mt-3 text-muted-foreground">Carregando…</p> : (
        <ul className="mt-4 space-y-3">{(planos.data ?? []).map((p) => <LinhaPlano key={p.id} plano={p} />)}</ul>
      )}
    </section>
  );
}

function Pagamentos() {
  const [status, setStatus] = useState("todos");
  const lista = useQuery({
    queryKey: ["admin-pagamentos", status],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_pagamentos", status === "todos" ? { _limite: 300 } : { _status: status, _limite: 300 });
      if (error) throw error;
      return data ?? [];
    },
  });
  const aprovados = (lista.data ?? []).filter((g) => g.status === "aprovado");
  return (
    <section className="painel p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="titulo-secao">Pagamentos</h3>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-52" aria-label="Situação"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[["todos", "Todos"], ["aprovado", "Aprovados"], ["pendente", "Em aberto"], ["em_analise", "Em análise"], ["recusado", "Recusados"], ["cancelado", "Cancelados"], ["estornado", "Estornados"]].map(([v, r]) => <SelectItem key={v} value={v}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {status === "todos" && aprovados.length > 0 && <p className="mt-2 text-muted-foreground">Aprovados nesta lista: <strong className="text-foreground">{money(aprovados.reduce((s, g) => s + g.valor_centavos, 0) / 100)}</strong></p>}
      {lista.isLoading ? <p className="mt-3 text-muted-foreground">Carregando…</p> : (lista.data ?? []).length === 0 ? <p className="mt-3 text-muted-foreground">Nenhum pagamento.</p> : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead className="text-sm text-muted-foreground"><tr><th className="py-2 pr-3">Data</th><th className="pr-3">Conta</th><th className="pr-3">Propriedade</th><th className="pr-3">Plano</th><th className="pr-3">Valor</th><th className="pr-3">Meio</th><th>Situação</th></tr></thead>
            <tbody className="divide-y divide-border">
              {lista.data!.map((g) => (
                <tr key={g.id} className="h-14">
                  <td className="pr-3">{diaBR(g.criado_em)}</td>
                  <td className="max-w-56 truncate pr-3">{g.email ?? "—"}</td>
                  <td className="max-w-48 truncate pr-3">{g.propriedade ?? "—"}</td>
                  <td className="pr-3">{g.plano_nome}</td>
                  <td className="pr-3 tabular-nums">{money(g.valor_centavos / 100)}</td>
                  <td className="pr-3">{nomeDoMetodo(g.metodo)}</td>
                  <td><Status value={g.status === "em_analise" ? "pendente" : g.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function AssinaturasAdmin() {
  return (
    <div className="space-y-6">
      <EstadoMercadoPago />
      <Planos />
      <Pagamentos />
    </div>
  );
}

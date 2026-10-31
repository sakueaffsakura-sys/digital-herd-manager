import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpenText, Check, Crown, LoaderCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { diaBR } from "@/lib/datas";
import { plural } from "@/lib/texto";
import { nomeDoMetodo } from "@/lib/mercadopago";
import { PageTitle, Status, money } from "../shared";
import { PlanPage, RECURSOS_PREMIUM } from "../account";

type Plano = { id: string; nome: string; descricao: string | null; meses: number; preco_centavos: number };
type AssinaturaResumo = { propriedade_id: string; propriedade: string; plano: string; status: string | null; origem: string | null; data_expiracao: string | null; ativa: boolean; dias_restantes: number | null };
type Area = { assinante: boolean; assinaturas: AssinaturaResumo[] };
type Pagamento = { id: string; criado_em: string; plano_nome: string; valor_centavos: number; status: string; metodo: string | null; aprovado_em: string | null };

const BENEFICIOS = ["Biblioteca de eBooks sobre manejo, sanidade, leite e gestão", ...RECURSOS_PREMIUM, "Relatórios completos em planilha"];

/** Endereços aceitos para abrir o pagamento (o servidor manda o link; aqui só conferimos o domínio). */
const PAGAMENTO_OK = /^https:\/\/(www\.)?mercadopago\.com\.br\//;

export default function AreaAssinante({
  propriedades, propriedadeId, ehAdmin, retorno, aoIr,
}: {
  propriedades: { id: string; nome: string; proprietario_id: string }[];
  propriedadeId: string | null;
  ehAdmin: boolean;
  retorno?: string;
  aoIr: (secao: string) => void;
}) {
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => { void supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null)); }, []);
  const minhas = useMemo(() => propriedades.filter((p) => p.proprietario_id === userId), [propriedades, userId]);
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const propriedadeDoPagamento = escolhida ?? (minhas.some((p) => p.id === propriedadeId) ? propriedadeId : minhas[0]?.id ?? null);
  const [abrindo, setAbrindo] = useState<string | null>(null);
  const [esperando, setEsperando] = useState(retorno === "sucesso" || retorno === "pendente");

  const area = useQuery({
    queryKey: ["area-assinante"],
    refetchInterval: esperando ? 5000 : false,
    queryFn: async (): Promise<Area> => {
      const { data, error } = await supabase.rpc("minha_area_assinante");
      if (error) throw error;
      return (data ?? { assinante: false, assinaturas: [] }) as unknown as Area;
    },
  });
  const planos = useQuery({
    queryKey: ["planos-ativos"],
    queryFn: async (): Promise<Plano[]> => {
      const { data, error } = await supabase.from("planos").select("id,nome,descricao,meses,preco_centavos").eq("ativo", true).gt("preco_centavos", 0).order("ordem");
      if (error) throw error;
      return data ?? [];
    },
  });
  const pagamentos = useQuery({
    queryKey: ["meus-pagamentos"],
    refetchInterval: esperando ? 5000 : false,
    queryFn: async (): Promise<Pagamento[]> => {
      const { data, error } = await supabase.from("pagamentos").select("id,criado_em,plano_nome,valor_centavos,status,metodo,aprovado_em").order("criado_em", { ascending: false }).limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Voltou do Mercado Pago: a página não libera nada sozinha; espera o aviso do Mercado Pago chegar ao servidor.
  useEffect(() => {
    if (retorno === "falha") toast.error("O pagamento não foi concluído. Você pode tentar de novo.");
    if (retorno === "sucesso" || retorno === "pendente") toast.info("Pagamento recebido pelo Mercado Pago. A assinatura é liberada assim que ele confirmar.");
  }, [retorno]);
  const ultimo = pagamentos.data?.[0];
  useEffect(() => {
    if (!esperando) return;
    if (ultimo?.status === "aprovado") {
      setEsperando(false);
      toast.success("Pagamento confirmado. Sua assinatura está ativa.");
      void qc.invalidateQueries({ queryKey: ["plan"] });
    }
    const t = setTimeout(() => setEsperando(false), 3 * 60_000);
    return () => clearTimeout(t);
  }, [esperando, ultimo?.status, qc]);

  const assinar = async (plano: Plano) => {
    if (!propriedadeDoPagamento) { toast.error("Cadastre uma propriedade sua para assinar."); return; }
    setAbrindo(plano.id);
    try {
      const { data } = await supabase.auth.getSession();
      const r = await fetch("/api/assinatura/checkout", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${data.session?.access_token ?? ""}` },
        body: JSON.stringify({ plano_id: plano.id, propriedade_id: propriedadeDoPagamento }),
      });
      const corpo = (await r.json().catch(() => ({}))) as { url?: string; erro?: string };
      if (!r.ok || !corpo.url || !PAGAMENTO_OK.test(corpo.url)) { toast.error(corpo.erro ?? "Não foi possível abrir o pagamento agora."); return; }
      window.location.assign(corpo.url);
    } finally {
      setAbrindo(null);
    }
  };

  const ativas = (area.data?.assinaturas ?? []).filter((a) => a.ativa);
  const vencendo = ativas.find((a) => a.dias_restantes != null && a.dias_restantes <= 7);

  return (
    <div>
      <PageTitle
        title="Assinatura"
        description={area.data?.assinante ? "Seu Premium, a validade e os pagamentos." : "Assine o Premium e libere a biblioteca de eBooks e os recursos extras."}
        action={area.data?.assinante ? <Button className="h-12" onClick={() => aoIr("biblioteca")}><BookOpenText />Abrir a biblioteca</Button> : undefined}
      />

      {esperando && (
        <div role="status" className="aviso-barra mb-6 flex items-center gap-3 rounded-xl bg-aviso-fundo py-3 pr-4 text-aviso">
          <LoaderCircle className="size-5 shrink-0 animate-spin" />
          <span className="text-foreground">Esperando a confirmação do Mercado Pago. Pix costuma levar alguns segundos; boleto pode levar até 3 dias úteis.</span>
        </div>
      )}
      {vencendo && (
        <div role="alert" className="aviso-barra mb-6 rounded-xl bg-aviso-fundo py-3 pr-4 text-aviso">
          <p className="font-bold text-foreground">Seu Premium da {vencendo.propriedade} vence em {vencendo.dias_restantes === 0 ? "menos de um dia" : plural(vencendo.dias_restantes ?? 0, "dia")}.</p>
          <p className="text-sm text-foreground/80">Renove abaixo para não perder a biblioteca e os recursos Premium.</p>
        </div>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          <section className="painel p-4 sm:p-6" aria-labelledby="situacao">
            <h2 id="situacao" className="titulo-secao flex items-center gap-2"><Crown className="size-6 text-primary" />Situação</h2>
            {area.isLoading ? <p className="mt-3 text-muted-foreground">Carregando…</p> : (area.data?.assinaturas ?? []).length === 0 ? (
              <p className="mt-3 text-muted-foreground">Nenhuma assinatura ainda.</p>
            ) : (
              <ul className="mt-3 divide-y divide-border">
                {area.data!.assinaturas.map((a) => (
                  <li key={a.propriedade_id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">{a.propriedade}</p>
                      <p className="text-sm text-muted-foreground">
                        {a.ativa
                          ? a.data_expiracao ? `Premium até ${diaBR(a.data_expiracao)} (${plural(a.dias_restantes ?? 0, "dia")})` : "Premium sem data de vencimento"
                          : a.plano === "premium" ? "Premium vencido" : "Plano gratuito"}
                        {a.origem === "demonstracao" ? " · liberado pelo administrador" : ""}
                      </p>
                    </div>
                    {a.ativa ? <Status value="ativo" /> : a.plano === "premium" ? <Status value="expirado" /> : (
                      <span className="rounded-full bg-muted px-3 py-1 text-sm font-bold text-muted-foreground">Sem assinatura</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="painel p-4 sm:p-6" aria-labelledby="planos">
            <h2 id="planos" className="titulo-secao">{area.data?.assinante ? "Renovar" : "Planos"}</h2>
            {minhas.length > 1 && (
              <div className="mt-3 max-w-sm">
                <p className="mb-1.5 text-[15px] font-bold">Para qual propriedade?</p>
                <Select value={propriedadeDoPagamento ?? ""} onValueChange={setEscolhida}>
                  <SelectTrigger aria-label="Propriedade da assinatura"><SelectValue /></SelectTrigger>
                  <SelectContent>{minhas.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {planos.isLoading ? <p className="mt-3 text-muted-foreground">Carregando…</p> : (planos.data ?? []).length === 0 ? (
              <p className="mt-3 text-muted-foreground">As assinaturas ainda não estão abertas. Volte em breve.</p>
            ) : minhas.length === 0 ? (
              <p className="mt-3 text-muted-foreground">Só o dono da propriedade pode assinar. Cadastre uma propriedade sua para assinar.</p>
            ) : (
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {planos.data!.map((p) => (
                  <li key={p.id} className="flex flex-col rounded-2xl border border-border p-4">
                    <p className="font-bold">{p.nome}</p>
                    <p className="mt-1 font-display text-[2.4rem] font-extrabold leading-none tabular-nums">{money(p.preco_centavos / 100)}</p>
                    <p className="text-sm text-muted-foreground">{p.meses === 1 ? "por 1 mês" : `por ${p.meses} meses (${money(p.preco_centavos / 100 / p.meses)} por mês)`}</p>
                    {p.descricao && <p className="mt-2 text-sm">{p.descricao}</p>}
                    <Button className="mt-4 h-12" disabled={!!abrindo} onClick={() => void assinar(p)}>
                      {abrindo === p.id ? <LoaderCircle className="animate-spin" /> : area.data?.assinante ? "Renovar com Mercado Pago" : "Assinar com Mercado Pago"}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 flex items-start gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
              Pagamento pelo Mercado Pago com Pix, cartão ou boleto. Não guardamos dados do cartão. A assinatura não se renova sozinha. Desistiu em até 7 dias? Peça o reembolso pelo suporte.
            </p>
          </section>

          <section className="painel p-4 sm:p-6" aria-labelledby="historico">
            <h2 id="historico" className="titulo-secao">Pagamentos</h2>
            {pagamentos.isLoading ? <p className="mt-3 text-muted-foreground">Carregando…</p> : (pagamentos.data ?? []).length === 0 ? (
              <p className="mt-3 text-muted-foreground">Nenhum pagamento ainda.</p>
            ) : (
              <ul className="mt-3 divide-y divide-border">
                {pagamentos.data!.map((g) => (
                  <li key={g.id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">{g.plano_nome} · {money(g.valor_centavos / 100)}</p>
                      <p className="text-sm text-muted-foreground">{diaBR(g.criado_em)} · {nomeDoMetodo(g.metodo)}</p>
                    </div>
                    <Status value={g.status === "em_analise" ? "pendente" : g.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="painel p-4 sm:p-6" aria-labelledby="beneficios">
          <h2 id="beneficios" className="titulo-secao">O que o Premium libera</h2>
          <ul className="mt-3 space-y-2">
            {BENEFICIOS.map((b) => <li key={b} className="flex gap-2"><Check className="mt-0.5 size-5 shrink-0 text-primary" />{b}</li>)}
          </ul>
        </aside>
      </div>

      {ehAdmin && propriedadeId && (
        <details className="painel mt-6 p-4 sm:p-6">
          <summary className="cursor-pointer font-bold">Administração: liberar ou retirar o Premium desta propriedade (demonstração)</summary>
          <div className="mt-4"><PlanPage propertyId={propriedadeId} /></div>
        </details>
      )}
    </div>
  );
}

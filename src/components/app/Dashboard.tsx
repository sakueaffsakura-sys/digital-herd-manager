import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Baby, CalendarClock, FlaskConical, Milk, Plus, Syringe, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import cattleImage from "@/assets/cattle-dashboard.jpg";
import cattleImageMobile from "@/assets/cattle-dashboard-800.webp";
import cattleImageWide from "@/assets/cattle-dashboard.webp";
import { HerdIcon } from "./HerdIcon";
import { Delta, Empty, Metric, MiniList, Panel, Status, dateNow, money, pretty, variacao, type Row } from "./shared";
import { BUCKETS, StorageImage, usePropertyProfile } from "./account";

const tip = { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 };
const axis = { fill: "var(--muted-foreground)", fontSize: 11 };
const compact = (v: number) => Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(v);
const fmtDate = (d: unknown) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "—");

export default function Dashboard({ propertyId, propertyName, go }: { propertyId: string; propertyName: string; go: (s: string) => void }) {
  const propertyProfile = usePropertyProfile(propertyId);
  const query = useQuery({
    queryKey: ["dashboard", propertyId],
    staleTime: 30_000,
    queryFn: async () => {
      const start = new Date();
      start.setDate(1);
      start.setMonth(start.getMonth() - 11);
      const desde = start.toISOString().slice(0, 10);
      const hoje = dateNow();
      const em30 = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
      const [summary, finance, milk, vaccines, lots, inseminations, vencidas, partos] = await Promise.all([
        supabase.rpc("dashboard_resumo", { _propriedade_id: propertyId }),
        supabase.from("v_financeiro_mensal").select("mes,receitas,despesas").eq("propriedade_id", propertyId).gte("mes", desde).order("mes"),
        supabase.from("v_producao_mensal").select("mes,total_litros").eq("propriedade_id", propertyId).gte("mes", desde).order("mes"),
        supabase.from("v_vacinacoes_status").select("*").eq("propriedade_id", propertyId).order("proxima_aplicacao").limit(5),
        supabase.from("v_animais_por_lote").select("*").eq("propriedade_id", propertyId),
        supabase.from("inseminacoes").select("id,data_inseminacao,previsao_parto,situacao,animais(nome,numero_brinco)").eq("propriedade_id", propertyId).in("situacao", ["em_andamento", "confirmada"]).order("previsao_parto").limit(5),
        supabase.from("v_vacinacoes_status").select("*", { count: "exact", head: true }).eq("propriedade_id", propertyId).ilike("status_calculado", "vencid%"),
        supabase.from("inseminacoes").select("id", { count: "exact", head: true }).eq("propriedade_id", propertyId).in("situacao", ["em_andamento", "confirmada"]).gte("previsao_parto", hoje).lte("previsao_parto", em30),
      ]);
      const err = [summary, finance, milk, vaccines, lots, inseminations].map((x) => x.error).find(Boolean);
      if (err) throw err;
      return {
        summary: (summary.data ?? {}) as Row, finance: finance.data ?? [], milk: milk.data ?? [], vaccines: vaccines.data ?? [],
        lots: ((lots.data ?? []) as Row[]).filter((l) => Number(l.quantidade_animais) > 0).sort((a, b) => Number(b.quantidade_animais) - Number(a.quantidade_animais)).slice(0, 8),
        inseminations: inseminations.data ?? [], vencidas: vencidas.count ?? 0, partos: partos.count ?? 0,
      };
    },
  });
  const data = query.data;
  const months = useMemo(() => {
    const list = Array.from({ length: 12 }, (_, i) => {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - 11 + i);
      return { key: d.toISOString().slice(0, 7), mes: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""), receitas: 0, despesas: 0, leite: 0 };
    });
    const fin = new Map((data?.finance ?? []).map((r) => [String(r.mes).slice(0, 7), r]));
    const mk = new Map((data?.milk ?? []).map((r) => [String(r.mes).slice(0, 7), r]));
    list.forEach((m) => {
      const f = fin.get(m.key);
      m.receitas = Number(f?.receitas ?? 0);
      m.despesas = Number(f?.despesas ?? 0);
      m.leite = Number(mk.get(m.key)?.total_litros ?? 0);
    });
    return list;
  }, [data]);

  const s = data?.summary ?? {};
  const n = (k: string) => Number(s[k] ?? 0);
  const profit = n("receitas_mes") - n("despesas_mes") - n("investimentos_mes");
  const prev = months[10], cur = months[11];
  const loading = query.isLoading;
  const v = (x: string | number) => (loading ? "…" : x);
  const hasFinance = months.some((m) => m.receitas || m.despesas);
  const hasMilk = months.some((m) => m.leite);
  const hoje = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const alerts = [
    data?.vencidas ? { icon: AlertTriangle, text: `${data.vencidas} vacinação(ões) vencida(s)`, cls: "border-destructive/40 bg-destructive/10 text-destructive", to: "vacinacao" } : null,
    data?.partos ? { icon: CalendarClock, text: `${data.partos} parto(s) previsto(s) nos próximos 30 dias`, cls: "border-chart-4/40 bg-chart-4/10 text-chart-4", to: "inseminacao" } : null,
  ].filter(Boolean) as { icon: typeof AlertTriangle; text: string; cls: string; to: string }[];

  return <div className="space-y-5">
    <section className="relative min-h-[220px] overflow-hidden rounded-xl border border-border">
      <StorageImage bucket={BUCKETS.banners} path={propertyProfile.data?.banner_url} alt="Banner da propriedade" className="absolute inset-0 h-full w-full object-cover" fallback={<img src={cattleImage} srcSet={`${cattleImageWide} 1600w, ${cattleImageMobile} 800w`} sizes="100vw" width={1600} height={608} alt="Gado Nelore em uma pastagem verde" className="absolute inset-0 h-full w-full object-cover" />} />
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-background/10" />
      <div className="relative flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-xl">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-primary first-letter:uppercase">{hoje}</p>
          <h1 className="text-3xl font-bold sm:text-4xl">{propertyName}</h1>
          <p className="mt-2 text-sm text-foreground/75">Resumo do rebanho, da produção e das finanças da propriedade.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={() => go("rebanho")}><Plus />Cadastrar animal</Button>
            <Button variant="outline" className="bg-background/60 backdrop-blur" onClick={() => go("producao")}><Milk />Registrar leite</Button>
            <Button variant="outline" className="bg-background/60 backdrop-blur" onClick={() => go("vacinacao")}><Syringe />Vacinação</Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:max-w-sm">
          <div className="rounded-lg border border-border bg-background/70 px-4 py-3 backdrop-blur"><span className="text-[11px] text-muted-foreground">Resultado do mês</span><strong className={`block text-xl tabular-nums ${profit < 0 ? "text-destructive" : "text-primary"}`}>{v(money(profit))}</strong></div>
          <div className="rounded-lg border border-border bg-background/70 px-4 py-3 backdrop-blur"><span className="text-[11px] text-muted-foreground">Leite no mês</span><strong className="block text-xl tabular-nums">{v(`${n("leite_mes").toLocaleString("pt-BR")} L`)}</strong></div>
        </div>
      </div>
    </section>

    {alerts.length > 0 && <div className="flex flex-col gap-2 sm:flex-row">{alerts.map((a) => <button key={a.text} type="button" onClick={() => go(a.to)} className={`flex flex-1 items-center gap-2 rounded-lg border px-4 py-3 text-left text-sm font-medium transition-opacity hover:opacity-80 ${a.cls}`}><a.icon className="size-4 shrink-0" />{a.text}<span className="ml-auto text-xs underline">Ver</span></button>)}</div>}
    {query.error && <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">Não foi possível carregar o resumo. <button className="underline" onClick={() => query.refetch()}>Tentar de novo</button></div>}

    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Metric label="Total de animais" value={v(n("total_animais").toLocaleString("pt-BR"))} icon={HerdIcon} onClick={() => go("rebanho")} hint={<span className="text-[11px] text-muted-foreground">{n("animais_ativos").toLocaleString("pt-BR")} ativos</span>} />
      <Metric label="Bezerros em evolução" value={v(n("bezerros").toLocaleString("pt-BR"))} icon={Baby} tone="chart-3" onClick={() => go("bezerros")} />
      <Metric label="Vacinações em dia" value={v(n("vacinacoes_em_dia").toLocaleString("pt-BR"))} icon={Syringe} tone="chart-4" onClick={() => go("vacinacao")} hint={data?.vencidas ? <span className="text-[11px] font-semibold text-destructive">{data.vencidas} vencida(s)</span> : <span className="text-[11px] text-muted-foreground">nenhuma vencida</span>} />
      <Metric label="Inseminações" value={v(n("inseminacoes").toLocaleString("pt-BR"))} icon={FlaskConical} tone="chart-2" onClick={() => go("inseminacao")} hint={<span className="text-[11px] text-muted-foreground">{data?.partos ?? 0} parto(s) em 30 dias</span>} />
      <Metric label="Receitas no mês" value={v(money(cur?.receitas))} icon={TrendingUp} onClick={() => go("lucros")} hint={<Delta value={variacao(cur?.receitas ?? 0, prev?.receitas ?? 0)} label="vs mês anterior" />} />
      <Metric label="Despesas no mês" value={v(money(cur?.despesas))} icon={TrendingDown} tone="destructive" onClick={() => go("lucros")} hint={<Delta invert value={variacao(cur?.despesas ?? 0, prev?.despesas ?? 0)} label="vs mês anterior" />} />
      <Metric label="Investimentos no mês" value={v(money(n("investimentos_mes")))} icon={Wallet} tone="chart-4" onClick={() => go("lucros")} />
      <Metric label="Produção de leite" value={v(`${compact(cur?.leite ?? 0)} L`)} icon={Milk} tone="chart-3" onClick={() => go("producao")} hint={<Delta value={variacao(cur?.leite ?? 0, prev?.leite ?? 0)} label="vs mês anterior" />} />
    </div>

    <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
      <Panel title="Receitas x despesas" subtitle="Últimos 12 meses">{loading ? <div className="h-72 animate-pulse rounded-lg bg-muted/40" /> : hasFinance ? <div className="h-72"><ResponsiveContainer width="100%" height="100%"><AreaChart data={months} margin={{ left: -8 }}><defs><linearGradient id="gRec" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.35} /><stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} /></linearGradient><linearGradient id="gDes" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--destructive)" stopOpacity={0.25} /><stop offset="95%" stopColor="var(--destructive)" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="mes" tick={axis} axisLine={false} tickLine={false} /><YAxis tick={axis} axisLine={false} tickLine={false} tickFormatter={compact} /><Tooltip contentStyle={tip} formatter={(x) => money(x)} /><Legend wrapperStyle={{ fontSize: 12 }} /><Area type="monotone" name="Receitas" dataKey="receitas" stroke="var(--chart-1)" strokeWidth={2} fill="url(#gRec)" /><Area type="monotone" name="Despesas" dataKey="despesas" stroke="var(--destructive)" strokeWidth={2} fill="url(#gDes)" /></AreaChart></ResponsiveContainer></div> : <Empty message="Nenhum lançamento financeiro nos últimos 12 meses." />}</Panel>
      <Panel title="Produção de leite" subtitle="Litros por mês">{loading ? <div className="h-72 animate-pulse rounded-lg bg-muted/40" /> : hasMilk ? <div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={months} margin={{ left: -8 }}><CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="mes" tick={axis} axisLine={false} tickLine={false} /><YAxis tick={axis} axisLine={false} tickLine={false} tickFormatter={compact} /><Tooltip contentStyle={tip} cursor={{ fill: "var(--muted)", opacity: 0.4 }} formatter={(x) => [`${Number(x).toLocaleString("pt-BR")} L`, "Leite"]} /><Bar dataKey="leite" fill="var(--chart-3)" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div> : <Empty message="Nenhuma produção de leite nos últimos 12 meses." />}</Panel>
    </div>

    <div className="grid gap-5 xl:grid-cols-3">
      <Panel title="Animais por lote" subtitle="Maiores lotes">{data?.lots.length ? <div className="space-y-3">{data.lots.map((l) => { const max = Number(data.lots[0]?.quantidade_animais) || 1; const q = Number(l.quantidade_animais); return <div key={String(l.lote_id ?? l.lote_nome)}><div className="mb-1 flex justify-between text-sm"><span className="truncate">{pretty(l.lote_nome)}</span><strong className="tabular-nums">{q.toLocaleString("pt-BR")}</strong></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-chart-2" style={{ width: `${(q / max) * 100}%` }} /></div></div>; })}</div> : <Empty message={loading ? "Carregando…" : "Nenhum lote com animais ainda."} />}</Panel>
      <Panel title="Próximas vacinações" subtitle="Atenção sanitária" action={<Button size="sm" variant="ghost" onClick={() => go("vacinacao")}>Ver todas</Button>}><MiniList rows={data?.vaccines ?? []} empty="Nenhuma vacinação programada." render={(r) => <><div className="min-w-0"><strong className="truncate">{pretty(r["tipo_vacina_nome"])}</strong><span>{pretty(r["animal_nome"] || r["lote_nome"])} · {fmtDate(r["proxima_aplicacao"])}</span></div><Status value={String(r["status_calculado"] ?? "")} /></>} /></Panel>
      <Panel title="Previsões de parto" subtitle="Inseminações em acompanhamento" action={<Button size="sm" variant="ghost" onClick={() => go("inseminacao")}>Ver todas</Button>}><MiniList rows={data?.inseminations ?? []} empty="Nenhuma inseminação em andamento." render={(r) => <><div className="min-w-0"><strong className="truncate">{pretty((r["animais"] as Row)?.["nome"] || (r["animais"] as Row)?.["numero_brinco"])}</strong><span>Previsão: {fmtDate(r["previsao_parto"])}</span></div><Status value={String(r["situacao"])} /></>} /></Panel>
    </div>
  </div>;
}


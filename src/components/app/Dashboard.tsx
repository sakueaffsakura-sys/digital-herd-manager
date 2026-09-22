import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Beef,
  FlaskConical,
  Plus,
  Syringe,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import cattleImage from "@/assets/cattle-dashboard.jpg";
import cattleImageMobile from "@/assets/cattle-dashboard-800.webp";
import cattleImageWide from "@/assets/cattle-dashboard.webp";
import { Empty, MiniList, Panel, Status, money, pretty, type Row } from "./shared";

export default function Dashboard({ propertyId, propertyName, go }: { propertyId: string; propertyName: string; go: (s: string) => void }) {
  const query = useQuery({
    queryKey: ["dashboard", propertyId],
    queryFn: async () => {
      const start = new Date();
      start.setMonth(start.getMonth() - 11);
      const [summary, animals, finance, milk, vaccines, lots, inseminations] = await Promise.all([
        supabase.rpc("dashboard_resumo", { _propriedade_id: propertyId }),
        supabase.from("animais").select("id,created_at,situacao").eq("propriedade_id", propertyId),
        supabase.from("movimentacoes_financeiras").select("data,tipo,valor").eq("propriedade_id", propertyId).gte("data", start.toISOString().slice(0, 10)),
        supabase.from("producao_leite").select("data,litros,valor_total").eq("propriedade_id", propertyId).gte("data", start.toISOString().slice(0, 10)),
        supabase.from("v_vacinacoes_status").select("*").eq("propriedade_id", propertyId).order("proxima_aplicacao").limit(5),
        supabase.from("v_animais_por_lote").select("*").eq("propriedade_id", propertyId),
        supabase.from("inseminacoes").select("id,data_inseminacao,previsao_parto,situacao,animais(nome,numero_brinco)").eq("propriedade_id", propertyId).in("situacao", ["em_andamento", "confirmada"]).order("previsao_parto").limit(5),
      ]);
      const errors = [summary, animals, finance, milk, vaccines, lots, inseminations].map((x) => x.error).filter(Boolean);
      if (errors[0]) throw errors[0];
      return { summary: (summary.data ?? {}) as Row, animals: animals.data ?? [], finance: finance.data ?? [], milk: milk.data ?? [], vaccines: vaccines.data ?? [], lots: lots.data ?? [], inseminations: inseminations.data ?? [] };
    },
  });
  const data = query.data;
  const monthMap = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - 11 + i);
      return { key: d.toISOString().slice(0, 7), mes: d.toLocaleDateString("pt-BR", { month: "short" }), receitas: 0, despesas: 0, leite: 0 };
    });
    data?.finance.forEach((r) => {
      const m = months.find((x) => x.key === String(r.data).slice(0, 7));
      if (m) {
        if (r.tipo === "receita") m.receitas += Number(r.valor);
        else m.despesas += Number(r.valor);
      }
    });
    data?.milk.forEach((r) => {
      const m = months.find((x) => x.key === String(r.data).slice(0, 7));
      if (m) m.leite += Number(r.litros);
    });
    return months;
  }, [data]);
  const s = data?.summary ?? {};
  const profit = Number(s["receitas_mes"] || 0) - Number(s["despesas_mes"] || 0);
  const cards = [
    { label: "Total de animais", value: s["total_animais"] ?? 0, icon: Beef, tone: "text-primary" },
    { label: "Bezerros em evolução", value: s["bezerros"] ?? 0, icon: Activity, tone: "text-chart-3" },
    { label: "Vacinações em dia", value: s["vacinacoes_em_dia"] ?? 0, icon: Syringe, tone: "text-chart-4" },
    { label: "Inseminações", value: s["inseminacoes"] ?? 0, icon: FlaskConical, tone: "text-chart-2" },
    { label: "Resultado do mês", value: money(profit), icon: profit < 0 ? TrendingDown : TrendingUp, tone: profit < 0 ? "text-destructive" : "text-primary" },
  ];
  return <div className="space-y-5"><section className="relative min-h-[210px] overflow-hidden rounded-lg border border-border"><img src={cattleImage} srcSet={`${cattleImageWide} 1600w, ${cattleImageMobile} 800w`} sizes="100vw" width={1600} height={608} alt="Gado Nelore em uma pastagem verde" className="absolute inset-0 h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-r from-background via-background/70 to-transparent" /><div className="relative max-w-xl p-7 sm:p-9"><p className="mb-2 text-xs font-bold uppercase text-primary">Visão geral da propriedade</p><h1 className="text-3xl font-bold sm:text-4xl">{propertyName}</h1><p className="mt-3 text-sm text-foreground/75">Gestão do rebanho, produção e finanças em um só lugar.</p><Button className="mt-6" onClick={() => go("rebanho")}><Plus />Cadastrar animal</Button></div></section>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{cards.map((c) => <article key={c.label} className="rounded-lg border border-border bg-card p-4 shadow-sm"><div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{c.label}</span><c.icon className={`size-5 ${c.tone}`} /></div><strong className="mt-4 block text-2xl">{query.isLoading ? "…" : String(c.value)}</strong><span className="mt-1 block text-[11px] text-muted-foreground">Atualizado com os registros reais</span></article>)}</div>
    <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]"><Panel title="Movimentação financeira" subtitle="Últimos 12 meses"><div className="h-72"><ResponsiveContainer width="100%" height="100%"><AreaChart data={monthMap}><defs><linearGradient id="income" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--chart-1)" stopOpacity={.35} /><stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="mes" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} /><YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} /><Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 6 }} /><Area type="monotone" dataKey="receitas" stroke="var(--chart-1)" fill="url(#income)" /><Area type="monotone" dataKey="despesas" stroke="var(--destructive)" fill="transparent" /></AreaChart></ResponsiveContainer></div></Panel><Panel title="Animais por lote" subtitle="Distribuição atual">{data?.lots.length ? <div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.lots} layout="vertical"><CartesianGrid stroke="var(--border)" horizontal={false} /><XAxis type="number" hide /><YAxis type="category" dataKey="lote_nome" width={110} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} /><Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)" }} /><Bar dataKey="quantidade_animais" fill="var(--chart-2)" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div> : <Empty message="Nenhum lote com animais ainda." />}</Panel></div>
    <div className="grid gap-5 xl:grid-cols-2"><Panel title="Próximas vacinações" subtitle="Atenção sanitária"><MiniList rows={data?.vaccines ?? []} empty="Nenhuma vacinação programada." render={(r) => <><div><strong>{pretty(r["tipo_vacina_nome"])}</strong><span>{pretty(r["animal_nome"] || r["lote_nome"])}</span></div><Status value={String(r["status_calculado"] ?? "")} /></>} /></Panel><Panel title="Previsões de parto" subtitle="Inseminações em acompanhamento"><MiniList rows={data?.inseminations ?? []} empty="Nenhuma inseminação em andamento." render={(r) => <><div><strong>{pretty((r["animais"] as Row)?.["nome"] || (r["animais"] as Row)?.["numero_brinco"])}</strong><span>Previsão: {pretty(r["previsao_parto"])}</span></div><Status value={String(r["situacao"])} /></>} /></Panel></div></div>;
}
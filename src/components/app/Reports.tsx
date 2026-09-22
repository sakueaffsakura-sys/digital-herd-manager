import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Download, Lock } from "lucide-react";
import { toast } from "sonner";
import {
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Empty, Metric, PageTitle, Panel, dateNow, money, type Row } from "./shared";
import { usePlan } from "./account";

type Indicadores = Record<string, number | null>;

export default function Reports({ propertyId }: { propertyId: string }) {
  const plan = usePlan(propertyId);
  const premium = plan.data?.premium_ativo ?? false;
  const currentMonth = dateNow().slice(0, 7);
  const [period, setPeriod] = useState<"monthly" | "annual">("monthly");
  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentMonth.slice(0, 4));

  const range = useMemo(() => {
    if (period === "monthly") {
      const [y, m] = month.split("-").map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      return { de: `${month}-01`, ate: `${month}-${String(lastDay).padStart(2, "0")}` };
    }
    return { de: `${year}-01-01`, ate: `${year}-12-31` };
  }, [period, month, year]);

  const q = useQuery({
    queryKey: ["reports", propertyId, range.de, range.ate],
    queryFn: async () => {
      const [indicators, fin, milk, categories, lots] = await Promise.all([
        supabase.rpc("relatorio_indicadores", { _propriedade_id: propertyId, _de: range.de, _ate: range.ate }),
        supabase.from("v_financeiro_mensal").select("*").eq("propriedade_id", propertyId).order("mes"),
        supabase.from("v_producao_mensal").select("*").eq("propriedade_id", propertyId).order("mes"),
        supabase.from("v_financeiro_por_categoria").select("*").eq("propriedade_id", propertyId).order("total", { ascending: false }),
        supabase.from("v_producao_por_lote").select("*").eq("propriedade_id", propertyId).order("total_litros", { ascending: false }),
      ]);
      const error = indicators.error || fin.error || milk.error || categories.error || lots.error;
      if (error) throw error;
      return {
        indicators: (indicators.data ?? {}) as unknown as Indicadores,
        fin: fin.data ?? [],
        milk: milk.data ?? [],
        categories: categories.data ?? [],
        lots: lots.data ?? [],
      };
    },
  });

  const years = useMemo(() => {
    const values = new Set<string>([currentMonth.slice(0, 4)]);
    q.data?.fin.forEach((r) => values.add(String(r.mes).slice(0, 4)));
    q.data?.milk.forEach((r) => values.add(String(r.mes).slice(0, 4)));
    return [...values].sort().reverse();
  }, [q.data, currentMonth]);

  const indicator = q.data?.indicators ?? {};
  const inPeriod = (mes: string | null) => mes != null && String(mes) >= range.de.slice(0, 7) && String(mes) <= range.ate.slice(0, 7);
  const fin = q.data?.fin.filter((r) => inPeriod(String(r.mes))) ?? [];
  const milk = q.data?.milk.filter((r) => inPeriod(String(r.mes))) ?? [];
  const categories = q.data?.categories.filter((r) => inPeriod(String(r.mes))) ?? [];
  const lots = q.data?.lots.filter((r) => inPeriod(String(r.mes))) ?? [];

  const liters = Number(indicator["litros"] ?? 0);
  const income = Number(indicator["receitas"] ?? 0);
  const expenses = Number(indicator["despesas"] ?? 0) + Number(indicator["investimentos"] ?? 0);

  const categoryMap = useMemo(() => {
    const map = new Map<string, number>();
    categories.forEach((r) => {
      const key = `${String(r.categoria ?? "sem categoria")} (${String(r.tipo ?? "")})`;
      map.set(key, (map.get(key) ?? 0) + Number(r.total ?? 0));
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, total]) => ({ name, total }));
  }, [categories]);

  const exportCSV = () => {
    if (!premium) {
      toast.error("A exportação de dados é um recurso do plano Premium.");
      return;
    }
    const rows = [
      ["indicador", "valor"],
      ["animais_cadastrados", indicator["animais_cadastrados"] ?? ""],
      ["nascidos", indicator["nascidos"] ?? ""],
      ["litros", indicator["litros"] ?? ""],
      ["receitas", indicator["receitas"] ?? ""],
      ["despesas", indicator["despesas"] ?? ""],
      ["investimentos", indicator["investimentos"] ?? ""],
      ["vendas_valor", indicator["vendas_valor"] ?? ""],
      ["compras_valor", indicator["compras_valor"] ?? ""],
      ...fin.map((r) => ["fin", String(r.mes), r.receitas ?? 0, r.despesas ?? 0]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-${range.de}_${range.ate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return <div className="space-y-5"><PageTitle icon={BarChart3} title="Relatórios" description="Indicadores calculados no banco por período." action={<div className="flex flex-wrap items-center gap-2">{!premium&&<span className="inline-flex items-center gap-1 rounded-full bg-[#f59e0b]/15 px-2 py-1 text-[10px] font-bold uppercase text-[#f59e0b]"><Lock className="size-3"/>Premium</span>}<Button variant="outline" onClick={exportCSV} title={premium?"Exportar dados em CSV":"Disponível no plano Premium"}><Download />Exportar CSV</Button></div>} /><div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-end"><div className="flex gap-2"><Button variant={period === "monthly" ? "default" : "outline"} onClick={() => setPeriod("monthly")}>Mensal</Button><Button variant={period === "annual" ? "default" : "outline"} onClick={() => setPeriod("annual")}>Anual</Button></div>{period === "monthly" ? <div className="sm:ml-auto"><Label htmlFor="report-month">Mês</Label><Input id="report-month" type="month" value={month} max={currentMonth} onChange={(event) => setMonth(event.target.value)} className="mt-1 w-full sm:w-48" /></div> : <div className="sm:ml-auto"><Label>Ano</Label><Select value={year} onValueChange={setYear}><SelectTrigger className="mt-1 w-full sm:w-40"><SelectValue /></SelectTrigger><SelectContent>{years.map((value) => <SelectItem value={value} key={value}>{value}</SelectItem>)}</SelectContent></Select></div>}</div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><Metric label="Animais cadastrados" value={q.isLoading ? "…" : String(indicator["animais_cadastrados"] ?? 0)} /><Metric label="Nascimentos" value={q.isLoading ? "…" : String(indicator["nascidos"] ?? 0)} /><Metric label="Produção" value={q.isLoading ? "…" : `${liters.toLocaleString("pt-BR")} L`} /><Metric label="Receitas" value={q.isLoading ? "…" : money(income)} /><Metric label="Resultado" value={q.isLoading ? "…" : money(income - expenses)} /></div><div className="grid gap-5 xl:grid-cols-2"><Panel title="Resultado financeiro" subtitle={period === "monthly" ? "Mês selecionado" : "Meses do ano selecionado"}>{fin.length ? <div className="h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={[...fin].reverse()}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="mes" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} /><YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} /><Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)" }} /><Bar dataKey="receitas" fill="var(--chart-1)" radius={[4, 4, 0, 0]} /><Bar dataKey="despesas" fill="var(--destructive)" radius={[4, 4, 0, 0]} /><Bar dataKey="investimentos" fill="var(--chart-4)" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div> : <Empty message="Sem lançamentos no período." />}</Panel><Panel title="Financeiro por categoria" subtitle="Maiores valores do período">{categoryMap.length ? <div className="h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={categoryMap} layout="vertical" margin={{ left: 8, right: 8 }}><CartesianGrid stroke="var(--border)" horizontal={false} /><XAxis type="number" hide /><YAxis type="category" dataKey="name" width={160} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} /><Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)" }} /><Bar dataKey="total" fill="var(--chart-2)" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div> : <Empty message="Sem categorias no período." />}</Panel></div><div className="grid gap-5 xl:grid-cols-2"><Panel title="Produção de leite no período" subtitle="Litros por mês">{milk.length ? <div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={[...milk].reverse()}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="mes" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} /><YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} /><Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)" }} /><Bar dataKey="total_litros" fill="var(--chart-3)" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div> : <Empty message="Sem produção no período." />}</Panel><Panel title="Produção por lote" subtitle="Litros e valor no período">{lots.length ? <div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={lots} layout="vertical" margin={{ left: 8, right: 8 }}><CartesianGrid stroke="var(--border)" horizontal={false} /><XAxis type="number" hide /><YAxis type="category" dataKey="lote_nome" width={140} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} /><Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)" }} /><Bar dataKey="total_litros" fill="var(--chart-3)" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div> : <Empty message="Sem produção por lote no período." />}</Panel></div></div>;
}
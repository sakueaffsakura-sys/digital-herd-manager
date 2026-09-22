import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Empty, Metric, PageTitle, Panel, dateNow, money, type Row } from "./shared";

export default function Reports({ propertyId }: { propertyId: string }) {
  const currentMonth = dateNow().slice(0, 7);
  const [period, setPeriod] = useState<"monthly" | "annual">("monthly");
  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentMonth.slice(0, 4));
  const q = useQuery({
    queryKey: ["reports", propertyId],
    queryFn: async () => {
      const [fin, milk, animals, births] = await Promise.all([
        supabase.from("v_financeiro_mensal").select("*").eq("propriedade_id", propertyId).order("mes"),
        supabase.from("v_producao_mensal").select("*").eq("propriedade_id", propertyId).order("mes"),
        supabase.from("animais").select("id,situacao,created_at").eq("propriedade_id", propertyId),
        supabase.from("nascimentos").select("id,data_nascimento").eq("propriedade_id", propertyId),
      ]);
      const error = fin.error || milk.error || animals.error || births.error;
      if (error) throw error;
      return { fin: fin.data ?? [], milk: milk.data ?? [], animals: animals.data ?? [], births: births.data ?? [] };
    },
  });
  const years = useMemo(() => {
    const values = new Set<string>([currentMonth.slice(0, 4)]);
    q.data?.fin.forEach((r) => values.add(String(r.mes).slice(0, 4)));
    q.data?.milk.forEach((r) => values.add(String(r.mes).slice(0, 4)));
    q.data?.births.forEach((r) => values.add(String(r.data_nascimento).slice(0, 4)));
    return [...values].sort().reverse();
  }, [q.data, currentMonth]);
  const prefix = period === "monthly" ? month : year;
  const fin = q.data?.fin.filter((r) => String(r.mes).startsWith(prefix)) ?? [];
  const milk = q.data?.milk.filter((r) => String(r.mes).startsWith(prefix)) ?? [];
  const births = q.data?.births.filter((r) => String(r.data_nascimento).startsWith(prefix)) ?? [];
  const animals = q.data?.animals.filter((r) => String(r.created_at).startsWith(prefix)) ?? [];
  const income = fin.reduce((sum, r) => sum + Number(r.receitas || 0), 0);
  const expenses = fin.reduce((sum, r) => sum + Number(r.despesas || 0) + Number(r.investimentos || 0), 0);
  const liters = milk.reduce((sum, r) => sum + Number(r.total_litros || 0), 0);
  return <div className="space-y-5"><PageTitle icon={BarChart3} title="Relatórios" description="Indicadores mensais e anuais calculados a partir dos registros." /><div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-end"><div className="flex gap-2"><Button variant={period === "monthly" ? "default" : "outline"} onClick={() => setPeriod("monthly")}>Mensal</Button><Button variant={period === "annual" ? "default" : "outline"} onClick={() => setPeriod("annual")}>Anual</Button></div>{period === "monthly" ? <div className="sm:ml-auto"><Label htmlFor="report-month">Mês</Label><Input id="report-month" type="month" value={month} max={currentMonth} onChange={(event) => setMonth(event.target.value)} className="mt-1 w-full sm:w-48" /></div> : <div className="sm:ml-auto"><Label>Ano</Label><Select value={year} onValueChange={setYear}><SelectTrigger className="mt-1 w-full sm:w-40"><SelectValue /></SelectTrigger><SelectContent>{years.map((value) => <SelectItem value={value} key={value}>{value}</SelectItem>)}</SelectContent></Select></div>}</div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><Metric label="Animais cadastrados" value={animals.length} /><Metric label="Nascimentos" value={births.length} /><Metric label="Produção" value={`${liters.toLocaleString("pt-BR")} L`} /><Metric label="Receitas" value={money(income)} /><Metric label="Resultado" value={money(income - expenses)} /></div><div className="grid gap-5 xl:grid-cols-2"><Panel title="Resultado financeiro" subtitle={period === "monthly" ? "Mês selecionado" : "Meses do ano selecionado"}>{fin.length ? <div className="h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={fin}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="mes" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} /><YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} /><Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)" }} /><Bar dataKey="receitas" fill="var(--chart-1)" /><Bar dataKey="despesas" fill="var(--destructive)" /><Bar dataKey="investimentos" fill="var(--chart-4)" /></BarChart></ResponsiveContainer></div> : <Empty message="Nenhuma movimentação no período selecionado." />}</Panel><Panel title="Produção de leite" subtitle={period === "monthly" ? "Mês selecionado" : "Meses do ano selecionado"}>{milk.length ? <div className="h-80"><ResponsiveContainer width="100%" height="100%"><AreaChart data={milk}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="mes" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} /><YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} /><Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)" }} /><Area dataKey="total_litros" stroke="var(--chart-2)" fill="var(--chart-2)" fillOpacity={.15} /></AreaChart></ResponsiveContainer></div> : <Empty message="Nenhuma produção no período selecionado." />}</Panel></div></div>;
}
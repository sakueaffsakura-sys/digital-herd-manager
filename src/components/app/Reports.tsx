import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, Wallet, Scale, Hash, BarChart3, CalendarRange, ChevronLeft, ChevronRight, Download, Lock, Milk, PiggyBank, ShoppingCart, LayoutGrid } from "lucide-react";
import { CalfIcon } from "./CalfIcon";
import { toast } from "sonner";
import { Legend, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Delta, variacao, Empty, Metric, PageTitle, Panel, dateNow, money, pretty, type Row } from "./shared";
import { usePlan } from "./account";
import { fetchAllRows } from "@/lib/fetchAll";

type ReportType = "geral" | "financeiro" | "leite" | "rebanho" | "comercial";
const TYPES: { id: ReportType; label: string; icon: typeof BarChart3 }[] = [
  { id: "geral", label: "Visão geral", icon: LayoutGrid },
  { id: "financeiro", label: "Financeiro", icon: PiggyBank },
  { id: "leite", label: "Produção de leite", icon: Milk },
  { id: "rebanho", label: "Nascimentos", icon: Baby },
  { id: "comercial", label: "Compra e venda", icon: ShoppingCart },
];
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const STORE = "pd-relatorios-filtro";
const tip = { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 };
const compact = (v: number) => Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(v);
const axis = { fill: "var(--muted-foreground)", fontSize: 10 };
const fmtDate = (d: unknown) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "—");

type Filter = { type: ReportType; year: number; month: number }; // month 0 = ano inteiro

function loadFilter(): Filter {
  const now = dateNow();
  const base: Filter = { type: "geral", year: Number(now.slice(0, 4)), month: Number(now.slice(5, 7)) };
  if (typeof window === "undefined") return base;
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORE) ?? "null");
    if (saved && TYPES.some((t) => t.id === saved.type) && saved.year > 1990 && saved.month >= 0 && saved.month <= 12) return saved;
  } catch { /* ignore */ }
  return base;
}

export default function Reports({ propertyId }: { propertyId: string }) {
  const plan = usePlan(propertyId);
  const premium = plan.data?.premium_ativo ?? false;
  const [f, setF] = useState<Filter>(() => ({ type: "geral", year: Number(dateNow().slice(0, 4)), month: Number(dateNow().slice(5, 7)) }));
  useEffect(() => setF(loadFilter()), []);
  useEffect(() => { sessionStorage.setItem(STORE, JSON.stringify(f)); }, [f]);

  const range = useMemo(() => {
    if (f.month === 0) return { de: `${f.year}-01-01`, ate: `${f.year}-12-31` };
    const mm = String(f.month).padStart(2, "0");
    const last = new Date(f.year, f.month, 0).getDate();
    return { de: `${f.year}-${mm}-01`, ate: `${f.year}-${mm}-${String(last).padStart(2, "0")}` };
  }, [f.year, f.month]);
  const label = f.month === 0 ? `Ano de ${f.year}` : `${MONTHS[f.month - 1]} de ${f.year}`;
  const thisYear = Number(dateNow().slice(0, 4));
  const years = Array.from({ length: 11 }, (_, i) => thisYear - i);

  const shift = (d: number) => setF((p) => {
    if (p.month === 0) return { ...p, year: p.year + d };
    let m = p.month + d, y = p.year;
    if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; }
    return { ...p, month: m, year: y };
  });

  const q = useQuery({
    placeholderData: (old) => old,
    staleTime: 30_000,
    queryKey: ["reports", propertyId, f.type, range.de, range.ate],
    queryFn: async () => {
      const { de, ate } = range;
      const inRange = <T,>(table: string, sel: string, col = "data") =>
        fetchAllRows<T>((a, b) => (supabase.from(table as "vendas").select(sel) as any).eq("propriedade_id", propertyId).gte(col, de).lte(col, ate).order(col).range(a, b));
      const out: Record<string, unknown> = {};
      if (f.type === "geral") {
        const r = await supabase.rpc("relatorio_indicadores", { _propriedade_id: propertyId, _de: de, _ate: ate });
        if (r.error) throw r.error;
        out.ind = r.data ?? {};
        out.fin = await inRange<Row>("movimentacoes_financeiras", "tipo,valor,data");
      }
      if (f.type === "financeiro") out.fin = await inRange<Row>("movimentacoes_financeiras", "id,tipo,categoria,descricao,valor,data");
      if (f.type === "leite") out.milk = await inRange<Row>("producao_leite", "id,data,litros,valor_total,animais(numero_brinco,nome),lotes(nome)");
      if (f.type === "rebanho") out.births = await inRange<Row>("nascimentos", "id,data_nascimento,sexo,vaca:animais!nascimentos_vaca_id_fkey(numero_brinco,nome),bezerro:animais!nascimentos_bezerro_id_fkey(numero_brinco,nome),lotes(nome)", "data_nascimento");
      if (f.type === "comercial") {
        const [c, v] = await Promise.all([inRange<Row>("compras", "id,data,produto_animal,quantidade,valor,fornecedor,categoria"), inRange<Row>("vendas", "id,data,item,quantidade,valor,comprador,categoria")]);
        out.compras = c; out.vendas = v;
      }
      return out;
    },
  });

  const prevRange = useMemo(() => {
    if (f.month === 0) return { de: `${f.year - 1}-01-01`, ate: `${f.year - 1}-12-31` };
    const y = f.month === 1 ? f.year - 1 : f.year, m = f.month === 1 ? 12 : f.month - 1;
    return { de: `${y}-${String(m).padStart(2, "0")}-01`, ate: `${y}-${String(m).padStart(2, "0")}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}` };
  }, [f.year, f.month]);
  const prevLabel = f.month === 0 ? "vs ano anterior" : "vs mês anterior";
  const prevQ = useQuery({
    queryKey: ["reports-prev", propertyId, prevRange.de],
    enabled: f.type === "geral" || f.type === "financeiro",
    staleTime: 60_000,
    queryFn: async () => {
      const list = await fetchAllRows<Row>((a, b) => supabase.from("movimentacoes_financeiras").select("tipo,valor").eq("propriedade_id", propertyId).gte("data", prevRange.de).lte("data", prevRange.ate).range(a, b) as any);
      const t: Record<string, number> = {}; list.forEach((r) => { t[String(r.tipo)] = (t[String(r.tipo)] ?? 0) + Number(r.valor); }); return t;
    },
  });
  const prevFin = prevQ.data ?? {};
  const d = q.data ?? {};
  const rows = (k: string) => ((d[k] as Row[]) ?? []).filter((r) => { const x = String(r.data ?? r.data_nascimento ?? "").slice(0, 10); return x >= range.de && x <= range.ate; });
  const sum = (list: Row[], k: string) => list.reduce((s, r) => s + Number(r[k] ?? 0), 0);
  const bucket = (list: Row[], valKey: string, dateKey = "data") => {
    const map = new Map<string, number>();
    list.forEach((r) => { const x = String(r[dateKey]); const key = f.month === 0 ? MONTHS[Number(x.slice(5, 7)) - 1].slice(0, 3) : x.slice(8, 10); map.set(key, (map.get(key) ?? 0) + Number(r[valKey] ?? 1)); });
    return [...map.entries()].map(([name, total]) => ({ name, total }));
  };

  const fin = rows("fin");
  const byTipo = (t: string) => sum(fin.filter((r) => r.tipo === t), "valor");
  const receitas = byTipo("receita"), despesas = byTipo("despesa"), invest = byTipo("investimento");

  const exportCSV = (): void => {
    if (!premium) { toast.error("A exportação de dados é um recurso do plano Premium."); return; }
    const list: Row[] = f.type === "leite" ? rows("milk") : f.type === "rebanho" ? rows("births") : f.type === "comercial" ? [...rows("compras").map((r) => ({ tipo: "compra", ...r })), ...rows("vendas").map((r) => ({ tipo: "venda", ...r }))] : fin;
    if (!list.length) { toast.error("Não há dados no período selecionado."); return; }
    const keys = Object.keys(list[0]).filter((k) => typeof list[0][k] !== "object");
    const csv = [keys, ...list.map((r) => keys.map((k) => r[k] ?? ""))].map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `relatorio-${f.type}-${range.de}_${range.ate}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const noData = (msg: string) => <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center"><CalendarRange className="mx-auto mb-3 size-8 text-muted-foreground" /><p className="font-semibold">Nenhum registro em {label}</p><p className="mt-1 text-sm text-muted-foreground">{msg} Escolha outro período ou tipo de relatório.</p></div>;
  const chart = (data: { name: string; total: number }[], color: string) => <div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ left: -8 }}><CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={axis} axisLine={false} tickLine={false} /><YAxis tick={axis} axisLine={false} tickLine={false} tickFormatter={compact} /><Tooltip contentStyle={tip} cursor={{ fill: "var(--muted)", opacity: 0.4 }} /><Bar dataKey="total" fill={color} radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>;
  const table = (cols: [string, (r: Row) => string][], list: Row[]) => <div className="max-h-[480px] overflow-auto rounded-lg border border-border"><table className="w-full min-w-[560px] text-sm"><thead className="sticky top-0 bg-card"><tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">{cols.map(([h]) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr></thead><tbody>{list.slice(0, 300).map((r, i) => <tr key={String(r.id ?? i)} className="border-b border-border/50 hover:bg-muted/30">{cols.map(([h, fn]) => <td key={h} className="px-3 py-2 tabular-nums">{fn(r)}</td>)}</tr>)}</tbody></table>{list.length > 300 && <p className="p-3 text-xs text-muted-foreground">Mostrando 300 de {list.length} registros. Exporte o CSV para ver todos.</p>}</div>;

  const body = () => {
    if (q.isLoading) return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-lg bg-muted/40" />)}</div>;
    if (q.error) return <Empty message="Não foi possível carregar o relatório. Tente novamente." />;
    if (f.type === "geral") {
      const ind = (d.ind ?? {}) as Record<string, number | null>;
      const has = fin.length || Object.values(ind).some((v) => Number(v) > 0);
      if (!has) return noData("Não há lançamentos, nascimentos ou produção neste período.");
      const lucro = receitas - despesas - invest;
      const evo = (() => { const m = new Map<string, { name: string; receitas: number; despesas: number }>(); fin.forEach((r) => { const x = String(r.data); const key = f.month === 0 ? x.slice(5, 7) : x.slice(8, 10); const name = f.month === 0 ? MONTHS[Number(key) - 1].slice(0, 3) : key; const o = m.get(key) ?? { name, receitas: 0, despesas: 0 }; if (r.tipo === "receita") o.receitas += Number(r.valor); else o.despesas += Number(r.valor); m.set(key, o); }); return [...m.entries()].sort().map(([, o]) => o); })();
      return <><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Receitas" value={money(receitas)} icon={TrendingUp} hint={<Delta value={variacao(receitas, Number(prevFin.receita ?? 0))} label={prevLabel} />} /><Metric label="Despesas" value={money(despesas)} icon={TrendingDown} tone="destructive" hint={<Delta invert value={variacao(despesas, Number(prevFin.despesa ?? 0))} label={prevLabel} />} /><Metric label="Investimentos" value={money(invest)} icon={Wallet} tone="chart-4" /><Metric label="Lucro" value={money(lucro)} icon={Scale} tone={lucro < 0 ? "destructive" : "primary"} /><Metric label="Nascimentos" value={String(ind.nascidos ?? 0)} icon={Baby} tone="chart-5" /><Metric label="Produção de leite" value={`${Number(ind.litros ?? 0).toLocaleString("pt-BR")} L`} icon={Milk} tone="chart-3" /><Metric label="Vendas" value={money(ind.vendas_valor)} icon={ShoppingCart} tone="chart-2" /><Metric label="Compras" value={money(ind.compras_valor)} icon={ShoppingCart} tone="chart-4" /></div><Panel title="Receitas x despesas" subtitle={f.month ? `Por dia · ${label}` : `Por mês · ${label}`}>{evo.length ? <div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={evo} margin={{ left: -8 }}><CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={axis} axisLine={false} tickLine={false} /><YAxis tick={axis} axisLine={false} tickLine={false} tickFormatter={compact} /><Tooltip contentStyle={tip} cursor={{ fill: "var(--muted)", opacity: 0.4 }} formatter={(v) => money(v)} /><Legend wrapperStyle={{ fontSize: 12 }} /><Bar name="Receitas" dataKey="receitas" fill="var(--chart-1)" radius={[4, 4, 0, 0]} /><Bar name="Despesas + investimentos" dataKey="despesas" fill="var(--destructive)" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div> : <Empty message="Sem lançamentos financeiros no período." />}</Panel></>;
    }
    if (f.type === "financeiro") {
      if (!fin.length) return noData("Não há receitas, despesas ou investimentos lançados.");
      const cat = new Map<string, number>(); fin.forEach((r) => { const k = `${pretty(r.categoria)} (${r.tipo})`; cat.set(k, (cat.get(k) ?? 0) + Number(r.valor)); });
      return <><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Receitas" value={money(receitas)} icon={TrendingUp} hint={<Delta value={variacao(receitas, Number(prevFin.receita ?? 0))} label={prevLabel} />} /><Metric label="Despesas" value={money(despesas)} icon={TrendingDown} tone="destructive" hint={<Delta invert value={variacao(despesas, Number(prevFin.despesa ?? 0))} label={prevLabel} />} /><Metric label="Investimentos" value={money(invest)} icon={Wallet} tone="chart-4" /><Metric label="Lucro" value={money(receitas - despesas - invest)} icon={Scale} tone={receitas - despesas - invest < 0 ? "destructive" : "primary"} /></div><div className="grid gap-5 xl:grid-cols-2"><Panel title="Por categoria" subtitle={label}><div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={[...cat].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, total]) => ({ name, total }))} layout="vertical"><CartesianGrid stroke="var(--border)" horizontal={false} /><XAxis type="number" hide /><YAxis type="category" dataKey="name" width={150} tick={axis} axisLine={false} /><Tooltip contentStyle={tip} formatter={(v) => money(v)} /><Bar dataKey="total" fill="var(--chart-2)" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div></Panel><Panel title={f.month ? "Movimento por dia" : "Movimento por mês"} subtitle="Soma dos lançamentos">{chart(bucket(fin, "valor"), "var(--chart-1)")}</Panel></div><Panel title="Lançamentos" subtitle={`${fin.length} registros`}>{table([["Data", (r) => fmtDate(r.data)], ["Tipo", (r) => pretty(r.tipo)], ["Categoria", (r) => pretty(r.categoria)], ["Descrição", (r) => pretty(r.descricao)], ["Valor", (r) => money(r.valor)]], fin)}</Panel></>;
    }
    if (f.type === "leite") {
      const milk = rows("milk");
      if (!milk.length) return noData("Não há produção de leite registrada.");
      const litros = sum(milk, "litros"); const dias = new Set(milk.map((r) => r.data)).size;
      const lot = new Map<string, number>(); milk.forEach((r) => { const k = String((r.lotes as Row | null)?.nome ?? "Sem lote"); lot.set(k, (lot.get(k) ?? 0) + Number(r.litros)); });
      return <><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Total de litros" value={`${litros.toLocaleString("pt-BR")} L`} icon={Milk} tone="chart-3" /><Metric label="Média diária" value={`${(litros / Math.max(dias, 1)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} L`} icon={BarChart3} tone="chart-2" /><Metric label="Valor total" value={money(sum(milk, "valor_total"))} icon={Wallet} /><Metric label="Registros" value={milk.length.toLocaleString("pt-BR")} icon={Hash} tone="chart-4" /></div><div className="grid gap-5 xl:grid-cols-2"><Panel title={f.month ? "Litros por dia" : "Litros por mês"} subtitle={label}>{chart(bucket(milk, "litros"), "var(--chart-3)")}</Panel><Panel title="Por lote" subtitle="Litros no período">{chart([...lot].map(([name, total]) => ({ name, total })), "var(--chart-2)")}</Panel></div><Panel title="Registros de produção" subtitle={`${milk.length} registros`}>{table([["Data", (r) => fmtDate(r.data)], ["Animal", (r) => { const a = r.animais as Row | null; return a ? `${a.numero_brinco}${a.nome ? " · " + a.nome : ""}` : "—"; }], ["Lote", (r) => pretty((r.lotes as Row | null)?.nome)], ["Litros", (r) => `${Number(r.litros).toLocaleString("pt-BR")} L`], ["Valor", (r) => money(r.valor_total)]], milk)}</Panel></>;
    }
    if (f.type === "rebanho") {
      const b = rows("births");
      if (!b.length) return noData("Não há nascimentos registrados.");
      const an = (x: unknown) => { const a = x as Row | null; return a ? `${a.numero_brinco}${a.nome ? " · " + a.nome : ""}` : "—"; };
      return <><div className="grid gap-3 sm:grid-cols-3"><Metric label="Nascimentos" value={b.length} icon={Baby} /><Metric label="Machos" value={b.filter((r) => r.sexo === "M").length} icon={Baby} tone="chart-3" /><Metric label="Fêmeas" value={b.filter((r) => r.sexo === "F").length} icon={Baby} tone="chart-5" /></div><Panel title={f.month ? "Nascimentos por dia" : "Nascimentos por mês"} subtitle={label}>{chart(bucket(b, "_", "data_nascimento"), "var(--chart-1)")}</Panel><Panel title="Nascimentos" subtitle={`${b.length} registros`}>{table([["Data", (r) => fmtDate(r.data_nascimento)], ["Vaca", (r) => an(r.vaca)], ["Bezerro", (r) => an(r.bezerro)], ["Sexo", (r) => (r.sexo === "M" ? "Macho" : "Fêmea")], ["Lote", (r) => pretty((r.lotes as Row | null)?.nome)]], b)}</Panel></>;
    }
    const c = rows("compras"), v = rows("vendas");
    if (!c.length && !v.length) return noData("Não há compras ou vendas registradas.");
    return <><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Vendas" value={money(sum(v, "valor"))} icon={TrendingUp} /><Metric label="Compras" value={money(sum(c, "valor"))} icon={TrendingDown} tone="destructive" /><Metric label="Saldo" value={money(sum(v, "valor") - sum(c, "valor"))} icon={Scale} tone={sum(v, "valor") - sum(c, "valor") < 0 ? "destructive" : "primary"} /><Metric label="Operações" value={c.length + v.length} icon={Hash} tone="chart-4" /></div><div className="grid gap-5 xl:grid-cols-2"><Panel title="Vendas" subtitle={`${v.length} registros`}>{v.length ? table([["Data", (r) => fmtDate(r.data)], ["Item", (r) => pretty(r.item)], ["Qtd.", (r) => String(r.quantidade)], ["Comprador", (r) => pretty(r.comprador)], ["Valor", (r) => money(r.valor)]], v) : <Empty message="Sem vendas no período." />}</Panel><Panel title="Compras" subtitle={`${c.length} registros`}>{c.length ? table([["Data", (r) => fmtDate(r.data)], ["Produto", (r) => pretty(r.produto_animal)], ["Qtd.", (r) => String(r.quantidade)], ["Fornecedor", (r) => pretty(r.fornecedor)], ["Valor", (r) => money(r.valor)]], c) : <Empty message="Sem compras no período." />}</Panel></div></>;
  };

  return <div className="space-y-5">
    <PageTitle icon={BarChart3} title="Relatórios" description="Escolha o relatório e o período. Só aparecem registros do período escolhido." action={<div className="flex flex-wrap items-center gap-2">{!premium && <span className="inline-flex items-center gap-1 rounded-full bg-chart-4/15 px-2 py-1 text-[10px] font-bold uppercase text-chart-4"><Lock className="size-3" />Premium</span>}<Button variant="outline" onClick={exportCSV}><Download />Exportar CSV</Button></div>} />
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div><p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">1. Tipo de relatório</p><div className="flex flex-wrap gap-2">{TYPES.map((t) => <Button key={t.id} size="sm" variant={f.type === t.id ? "default" : "outline"} onClick={() => setF((p) => ({ ...p, type: t.id }))}><t.icon />{t.label}</Button>)}</div></div>
      <div><p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">2. Período</p><div className="flex flex-wrap items-center gap-2">
        <Button size="icon" variant="outline" onClick={() => shift(-1)} aria-label="Período anterior"><ChevronLeft /></Button>
        <Select value={String(f.month)} onValueChange={(m) => setF((p) => ({ ...p, month: Number(m) }))}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="0">Ano inteiro</SelectItem>{MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent></Select>
        <Select value={String(f.year)} onValueChange={(y) => setF((p) => ({ ...p, year: Number(y) }))}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger><SelectContent>{(years.includes(f.year) ? years : [f.year, ...years]).map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select>
        <Button size="icon" variant="outline" onClick={() => shift(1)} aria-label="Próximo período"><ChevronRight /></Button>
        <Button size="sm" variant="ghost" onClick={() => setF((p) => ({ ...p, year: thisYear, month: Number(dateNow().slice(5, 7)) }))}>Mês atual</Button>
        <span className="ml-auto rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">{TYPES.find((t) => t.id === f.type)?.label} · {label}</span>
      </div></div>
    </div>
    {body()}
  </div>;
}

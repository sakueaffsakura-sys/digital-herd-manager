import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, BellRing, ShieldAlert, Activity, ArrowLeft, BarChart3, Database, Eye, Gauge, HardDrive, Lock, MoreHorizontal, Pause, Play, Radio, Search, ShieldCheck, ShieldX, Trash2, Unlock, Users, Zap } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Área Admin | Pecuária Digital" },
      { name: "description", content: "Painel administrativo: contas, métricas e desempenho do sistema." },
      { property: "og:title", content: "Área Admin | Pecuária Digital" },
      { property: "og:description", content: "Contas, métricas e desempenho do sistema." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

type Conta = {
  user_id: string; email: string; nome: string | null; criado_em: string; ultimo_acesso: string | null;
  bloqueado: boolean; admin: boolean; propriedades: number; registros: number; bytes_estimados: number;
};
type Sistema = {
  banco_bytes: number; armazenamento_bytes: number; arquivos: number; usuarios: number; propriedades: number;
  conexoes_ativas: number; conexoes_total: number; cache_hit: number | null; ping_ms: number; novos_7d: number; ativos_7d: number;
  tabelas: { tabela: string; linhas: number; bytes: number }[];
  cadastros_30d: { dia: string; qtd: number }[];
  consultas_lentas: { consulta: string; chamadas: number; media_ms: number }[];
};
type Detalhe = {
  id: string; email: string; admin: boolean; criado_em: string; ultimo_acesso: string | null;
  perfil: ({ nome_completo?: string; nome_exibicao?: string; cargo?: string; biografia?: string; telefone?: string; bloqueado?: boolean } | null);
  armazenamento: { bucket: string; bytes: number }[]; armazenamento_total: number;
  propriedades: { id: string; nome: string; cidade: string | null; estado: string | null; criado_em: string; animais: number; producao: number; financeiro: number; plano: { plano: string; status: string; data_expiracao: string | null; origem: string } | null }[];
};
type Metricas = {
  cadastros_90d: { dia: string; qtd: number }[];
  acessos_30d: { dia: string; qtd: number }[];
  registros_dia: { dia: string; tabela: string; qtd: number }[];
  litros_mes: { mes: string; litros: number }[];
  financeiro_mes: { mes: string; receita: number; despesa: number; investimento: number }[];
  totais: { usuarios: number; propriedades: number; animais: number; litros: number; movimentacoes: number; vendas: number; compras: number; premium_ativos: number; contas_bloqueadas: number };
};
type Saude = {
  consultas_lentas: { consulta: string; chamadas: number; media_ms: number; total_ms: number }[];
  rate_limits: { chave: string; janela: string; contador: number }[];
  rate_limit_total: number;
  seq_scans: { tabela: string; scans: number; linhas_lidas: number }[];
  manutencao: { tabela: string; mortas: number }[];
  bloqueios: number;
};

const rpc = supabase.rpc.bind(supabase) as unknown as (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;

const bytes = (n: number) => {
  if (!n) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"]; const i = Math.min(4, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${u[i]}`;
};
const data = (s: string | null) => (s ? new Date(s).toLocaleString("pt-BR") : "—");
const diaCurto = (s: string) => new Date(s + (s.length === 10 ? "T12:00:00" : "")).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
const mesCurto = (s: string) => new Date(s).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });

function AdminPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Aba>("tempo");
  const [busca, setBusca] = useState("");
  const [latencia, setLatencia] = useState<number | null>(null);
  const [detalheId, setDetalheId] = useState<string | null>(null);

  const isAdmin = useQuery({ queryKey: ["sou-admin"], queryFn: async () => { const r = await rpc("sou_admin"); if (r.error) throw r.error; return r.data === true; } });
  const sistema = useQuery({
    queryKey: ["admin-sistema"], enabled: isAdmin.data === true, refetchInterval: 30000,
    queryFn: async () => { const t = performance.now(); const r = await rpc("admin_sistema"); setLatencia(Math.round(performance.now() - t)); if (r.error) throw r.error; return r.data as Sistema; },
  });
  const alertas = useQuery({ queryKey: ["admin-alertas"], enabled: isAdmin.data === true, refetchInterval: 15000, queryFn: async () => { const r = await rpc("admin_alertas"); if (r.error) throw r.error; return r.data as Alertas; } });
  const avisados = useRef(new Set<string>());
  useEffect(() => {
    (alertas.data?.alertas ?? []).filter((a) => a.severidade !== "info").forEach((a) => {
      if (avisados.current.has(a.titulo)) return;
      avisados.current.add(a.titulo);
      (a.severidade === "critico" ? toast.error : toast.warning)(a.titulo, { description: a.detalhe, duration: 10000 });
    });
  }, [alertas.data]);
  const contas = useQuery({ queryKey: ["admin-contas"], enabled: isAdmin.data === true, queryFn: async () => { const r = await rpc("admin_contas"); if (r.error) throw r.error; return (r.data ?? []) as Conta[]; } });

  const acao = useMutation({
    mutationFn: async (a: { user_id: string; bloqueado?: boolean; admin?: boolean }) => {
      const r = await rpc("admin_definir_conta", { _user_id: a.user_id, _bloqueado: a.bloqueado ?? null, _admin: a.admin ?? null });
      if (r.error) throw r.error;
    },
    onSuccess: () => { toast.success("Conta atualizada."); qc.invalidateQueries({ queryKey: ["admin-contas"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (contas.data ?? []).filter((c) => !q || c.email?.toLowerCase().includes(q) || c.nome?.toLowerCase().includes(q));
  }, [contas.data, busca]);

  if (isAdmin.isPending) return <Shell><p className="text-muted-foreground">Verificando acesso…</p></Shell>;
  if (!isAdmin.data) return <Shell><div className="rounded-xl border border-border bg-card p-8 text-center"><ShieldCheck className="mx-auto size-10 text-destructive" /><h2 className="mt-3 text-lg font-semibold">Acesso restrito</h2><p className="mt-1 text-sm text-muted-foreground">Somente administradores do sistema podem ver esta área.</p></div></Shell>;

  const s = sistema.data;
  const titulos = { tempo: ["Tempo real", "Desempenho do site ao vivo, atualizado a cada 3 segundos."], contas: ["Contas", "Todas as contas, espaço usado e ações de administração."], metricas: ["Métricas", "Crescimento, uso e movimentação do sistema."], desempenho: ["Desempenho", "Saúde do banco de dados e consultas lentas."], seguranca: ["Segurança e alertas", "Proteção contra ataques DoS/DDoS e avisos de desempenho, atualizado a cada 15 segundos."] } as const;
  return (
    <Shell tab={tab} setTab={setTab} alertaCount={(alertas.data?.alertas ?? []).filter((a) => a.severidade !== "info").length}>
      <div>
        <h2 className="text-xl font-bold tracking-tight">{titulos[tab][0]}</h2>
        <p className="text-sm text-muted-foreground">{titulos[tab][1]}</p>
      </div>
      <AlertasFaixa dados={alertas.data} erro={!!alertas.error} onVer={() => setTab("seguranca")} esconderVer={tab === "seguranca"} />
      {(tab === "contas" || tab === "desempenho") && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card icon={Users} label="Contas" value={s?.usuarios ?? "…"} sub={`${s?.novos_7d ?? 0} novas · ${s?.ativos_7d ?? 0} ativas em 7 dias`} />
          <Card icon={Database} label="Banco de dados" value={s ? bytes(s.banco_bytes) : "…"} sub={`${s?.propriedades ?? 0} propriedades`} />
          <Card icon={HardDrive} label="Arquivos" value={s ? bytes(s.armazenamento_bytes) : "…"} sub={`${s?.arquivos ?? 0} arquivos`} />
          <Card icon={Zap} label="Velocidade" value={latencia != null ? `${latencia} ms` : "…"} sub={`Consulta no banco: ${s?.ping_ms ?? "…"} ms`} />
        </div>
      )}

      {tab === "tempo" && <TempoRealTab />}
      {tab === "seguranca" && <SegurancaTab dados={alertas.data} carregando={alertas.isLoading} />}
      {tab === "contas" && <ContasTab filtradas={filtradas} contas={contas} busca={busca} setBusca={setBusca} acao={acao} onDetalhe={setDetalheId} />}
      {tab === "metricas" && <MetricasTab />}
      {tab === "desempenho" && <DesempenhoTab sistema={s} latencia={latencia} />}

      {detalheId && <ContaDialog id={detalheId} onClose={() => { setDetalheId(null); qc.invalidateQueries({ queryKey: ["admin-contas"] }); qc.invalidateQueries({ queryKey: ["admin-sistema"] }); }} />}
    </Shell>
  );
}

type Amostra = {
  ts: number; commits: number; rollbacks: number; lidas: number; inseridas: number; atualizadas: number; removidas: number;
  blks_hit: number; blks_read: number; deadlocks: number; conexoes_ativas: number; conexoes_ociosas: number; conexoes_total: number;
  conexoes_max: number; bloqueios: number; consulta_mais_longa_s: number; banco_bytes: number; usuarios_online: number; usuarios_hora: number; sessoes_abertas: number; online_lista: { email: string; pagina: string | null; visto_em: string }[]; ping_ms: number;
};
type Ponto = { hora: string; latencia: number; banco: number; tps: number; leituras: number; escritas: number; conexoes: number; cache: number };

function TempoRealTab() {
  const [pausado, setPausado] = useState(false);
  const [serie, setSerie] = useState<Ponto[]>([]);
  const [ultima, setUltima] = useState<Amostra | null>(null);
  const [erros, setErros] = useState(0);
  const [nav, setNav] = useState<{ carregamento: number; ttfb: number; memoria: number | null } | null>(null);
  const [fps, setFps] = useState<number | null>(null);
  const [online, setOnline] = useState(true);
  const anterior = useRef<Amostra | null>(null);

  useEffect(() => {
    const n = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    if (n) setNav({ carregamento: Math.round(n.loadEventEnd || n.domContentLoadedEventEnd), ttfb: Math.round(n.responseStart - n.requestStart), memoria: mem ? mem.usedJSHeapSize : null });
    let frames = 0, t0 = performance.now(), raf = 0;
    const loop = (t: number) => { frames++; if (t - t0 >= 1000) { setFps(Math.round((frames * 1000) / (t - t0))); frames = 0; t0 = t; } raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    const on = () => setOnline(navigator.onLine);
    window.addEventListener("online", on); window.addEventListener("offline", on);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("online", on); window.removeEventListener("offline", on); };
  }, []);

  useEffect(() => {
    if (pausado) return;
    let vivo = true;
    const coletar = async () => {
      const t = performance.now();
      const r = await rpc("admin_tempo_real");
      const lat = Math.round(performance.now() - t);
      if (!vivo) return;
      if (r.error) { setErros((e) => e + 1); return; }
      const a = r.data as Amostra;
      const p = anterior.current;
      const dt = p ? Math.max(0.5, a.ts - p.ts) : 1;
      const dHit = p ? a.blks_hit - p.blks_hit : 0, dRead = p ? a.blks_read - p.blks_read : 0;
      const ponto: Ponto = {
        hora: new Date().toLocaleTimeString("pt-BR"),
        latencia: lat, banco: Number(a.ping_ms),
        tps: p ? Math.max(0, Math.round((a.commits + a.rollbacks - p.commits - p.rollbacks) / dt)) : 0,
        leituras: p ? Math.max(0, Math.round((a.lidas - p.lidas) / dt)) : 0,
        escritas: p ? Math.max(0, Math.round((a.inseridas + a.atualizadas + a.removidas - p.inseridas - p.atualizadas - p.removidas) / dt)) : 0,
        conexoes: a.conexoes_ativas,
        cache: dHit + dRead > 0 ? Math.round((1000 * dHit) / (dHit + dRead)) / 10 : 100,
      };
      anterior.current = a;
      setUltima(a);
      if (p) setSerie((s) => [...s.slice(-59), ponto]);
    };
    coletar();
    const id = setInterval(coletar, 3000);
    return () => { vivo = false; clearInterval(id); };
  }, [pausado]);

  const atual = serie[serie.length - 1];
  const media = serie.length ? Math.round(serie.reduce((s, p) => s + p.latencia, 0) / serie.length) : null;
  const pico = serie.length ? Math.max(...serie.map((p) => p.latencia)) : null;
  const saude = !atual ? "…" : atual.latencia < 400 && (ultima?.bloqueios ?? 0) === 0 ? "Ótimo" : atual.latencia < 1200 ? "Atenção" : "Lento";
  const corSaude = saude === "Ótimo" ? "text-primary" : saude === "Atenção" ? "text-warning" : "text-destructive";
  const uso = ultima ? Math.round((100 * ultima.conexoes_total) / ultima.conexoes_max) : 0;
  const eixo = { tick: { fontSize: 10, fill: "var(--muted-foreground)" }, axisLine: false, tickLine: false };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
        <span className="relative flex size-2.5">{!pausado && <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />}<span className={`relative inline-flex size-2.5 rounded-full ${pausado ? "bg-muted-foreground" : "bg-primary"}`} /></span>
        <span className="text-sm font-medium">{pausado ? "Pausado" : "Ao vivo"}</span>
        <span className="text-xs text-muted-foreground">{atual ? `Última leitura ${atual.hora}` : "Coletando…"} · {serie.length} leituras{erros ? ` · ${erros} falhas` : ""}</span>
        <span className={`ml-auto text-sm font-semibold ${corSaude}`}>Situação: {saude}</span>
        <Button size="sm" variant="outline" onClick={() => setPausado((p) => !p)}>{pausado ? <><Play />Retomar</> : <><Pause />Pausar</>}</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card icon={Zap} label="Resposta do servidor" value={atual ? `${atual.latencia} ms` : "…"} sub={`Média ${media ?? "…"} ms · pico ${pico ?? "…"} ms`} />
        <Card icon={Activity} label="Transações por segundo" value={atual ? atual.tps.toLocaleString("pt-BR") : "…"} sub={`${atual?.leituras.toLocaleString("pt-BR") ?? 0} linhas lidas · ${atual?.escritas.toLocaleString("pt-BR") ?? 0} gravadas /s`} />
        <Card icon={Users} label="Usuários online agora" value={ultima?.usuarios_online ?? "…"} sub={`${ultima?.usuarios_hora ?? 0} na última hora · ${ultima?.sessoes_abertas ?? 0} sessões abertas`} />
        <Card icon={Database} label="Conexões" value={ultima ? `${ultima.conexoes_ativas} / ${ultima.conexoes_total}` : "…"} sub={`ativas / abertas · ${uso}% da capacidade`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Tempo de resposta (ms)">
          <div className="h-56"><ResponsiveContainer><AreaChart data={serie}><CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} /><XAxis dataKey="hora" {...eixo} interval="preserveStartEnd" /><YAxis {...eixo} /><Tooltip contentStyle={tip} /><Legend wrapperStyle={{ fontSize: 11 }} /><Area isAnimationActive={false} type="monotone" dataKey="latencia" name="Site → servidor" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.18} /><Area isAnimationActive={false} type="monotone" dataKey="banco" name="Dentro do banco" stroke="var(--chart-2)" fill="var(--chart-2)" fillOpacity={0.12} /></AreaChart></ResponsiveContainer></div>
        </Panel>
        <Panel title="Leituras e gravações por segundo">
          <div className="h-56"><ResponsiveContainer><LineChart data={serie}><CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} /><XAxis dataKey="hora" {...eixo} interval="preserveStartEnd" /><YAxis {...eixo} /><Tooltip contentStyle={tip} /><Legend wrapperStyle={{ fontSize: 11 }} /><Line isAnimationActive={false} type="monotone" dataKey="leituras" name="Leituras" stroke="var(--primary)" strokeWidth={2} dot={false} /><Line isAnimationActive={false} type="monotone" dataKey="escritas" name="Gravações" stroke="var(--chart-4)" strokeWidth={2} dot={false} /><Line isAnimationActive={false} type="monotone" dataKey="tps" name="Transações" stroke="var(--chart-2)" strokeWidth={1.5} dot={false} /></LineChart></ResponsiveContainer></div>
        </Panel>
        <Panel title="Conexões ativas">
          <div className="h-48"><ResponsiveContainer><BarChart data={serie}><CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} /><XAxis dataKey="hora" {...eixo} interval="preserveStartEnd" /><YAxis allowDecimals={false} {...eixo} /><Tooltip contentStyle={tip} /><Bar isAnimationActive={false} dataKey="conexoes" name="Conexões" fill="var(--primary)" radius={3} /></BarChart></ResponsiveContainer></div>
        </Panel>
        <Panel title={`Quem está online agora (${ultima?.usuarios_online ?? 0})`}>
          {!ultima ? <p className="text-sm text-muted-foreground">Coletando…</p> : ultima.online_lista.length === 0 ? <p className="text-sm text-muted-foreground">Ninguém com o sistema aberto nos últimos 2 minutos.</p> :
            <div className="max-h-48 space-y-1 overflow-auto">{ultima.online_lista.map((u) => <div key={u.email} className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm"><span className="size-2 shrink-0 rounded-full bg-primary" /><span className="truncate">{u.email}</span><span className="ml-auto shrink-0 text-xs text-muted-foreground">{u.pagina ?? "—"} · {new Date(u.visto_em).toLocaleTimeString("pt-BR")}</span></div>)}</div>}
        </Panel>
        <Panel title="Saúde agora" className="lg:col-span-2">
          <div className="grid grid-cols-2 gap-2 text-sm lg:grid-cols-5">
            <Info label="Acerto de cache" value={atual ? `${atual.cache}%` : "…"} ok={(atual?.cache ?? 100) >= 95} />
            <Info label="Consultas travadas" value={ultima?.bloqueios ?? "…"} ok={(ultima?.bloqueios ?? 0) === 0} />
            <Info label="Consulta mais longa" value={ultima ? `${Number(ultima.consulta_mais_longa_s).toFixed(1)} s` : "…"} ok={(ultima?.consulta_mais_longa_s ?? 0) < 5} />
            <Info label="Deadlocks (total)" value={ultima?.deadlocks ?? "…"} ok={(ultima?.deadlocks ?? 0) === 0} />
            <Info label="Tamanho do banco" value={ultima ? bytes(ultima.banco_bytes) : "…"} ok />
            <Info label="Sua internet" value={online ? "Online" : "Offline"} ok={online} />
            <Info label="Carregamento (seu navegador)" value={nav ? `${nav.carregamento} ms` : "…"} ok={(nav?.carregamento ?? 0) < 3000} />
            <Info label="Fluidez (sua tela)" value={fps != null ? `${fps} FPS` : "…"} ok={(fps ?? 60) >= 45} />
            {nav?.memoria != null && <Info label="Memória (seu navegador)" value={bytes(nav.memoria)} ok />}
            <Info label="1º byte do servidor" value={nav ? `${nav.ttfb} ms` : "…"} ok={(nav?.ttfb ?? 0) < 800} />
          </div>
        </Panel>
      </div>
    </div>
  );
}

const tip = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 };

function Info({ label, value, ok }: { label: string; value: React.ReactNode; ok: boolean }) {
  return <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2"><span className="text-xs text-muted-foreground">{label}</span><span className={`font-semibold ${ok ? "text-foreground" : "text-destructive"}`}>{value}</span></div>;
}

function ContasTab({ filtradas, contas, busca, setBusca, acao, onDetalhe }: {
  filtradas: Conta[]; contas: { isError: boolean; isPending: boolean }; busca: string; setBusca: (v: string) => void;
  acao: { isPending: boolean; mutate: (a: { user_id: string; bloqueado?: boolean; admin?: boolean }) => void }; onDetalhe: (id: string) => void;
}) {
  const [filtro, setFiltro] = useState<"todas" | "ativas" | "bloqueadas" | "admins">("todas");
  const [ordem, setOrdem] = useState<"recentes" | "acesso" | "espaco" | "registros">("recentes");
  const lista = useMemo(() => {
    const f = filtradas.filter((c) => filtro === "todas" || (filtro === "ativas" && !c.bloqueado) || (filtro === "bloqueadas" && c.bloqueado) || (filtro === "admins" && c.admin));
    const val = (c: Conta) => ordem === "acesso" ? new Date(c.ultimo_acesso ?? 0).getTime() : ordem === "espaco" ? Number(c.bytes_estimados) : ordem === "registros" ? Number(c.registros) : new Date(c.criado_em).getTime();
    return [...f].sort((a, b) => val(b) - val(a));
  }, [filtradas, filtro, ordem]);
  const maxEspaco = Math.max(1, ...filtradas.map((c) => Number(c.bytes_estimados)));
  const cont = { todas: filtradas.length, ativas: filtradas.filter((c) => !c.bloqueado).length, bloqueadas: filtradas.filter((c) => c.bloqueado).length, admins: filtradas.filter((c) => c.admin).length };
  const recente = (s: string | null) => !!s && Date.now() - new Date(s).getTime() < 86400000;

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center">
        <div className="relative w-full lg:max-w-xs"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar por nome ou e-mail" value={busca} onChange={(e) => setBusca(e.target.value)} /></div>
        <div className="flex flex-wrap gap-1">
          {([["todas", "Todas"], ["ativas", "Ativas"], ["bloqueadas", "Bloqueadas"], ["admins", "Admins"]] as const).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setFiltro(k)} className={`h-8 rounded-full border px-3 text-xs font-medium transition-colors ${filtro === k ? "border-primary/50 bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>{l} <span className="ml-1 opacity-70">{cont[k]}</span></button>
          ))}
        </div>
        <select value={ordem} onChange={(e) => setOrdem(e.target.value as typeof ordem)} className="h-9 rounded-md border border-input bg-background px-3 text-sm lg:ml-auto">
          <option value="recentes">Mais recentes</option><option value="acesso">Último acesso</option><option value="espaco">Mais espaço</option><option value="registros">Mais registros</option>
        </select>
      </div>
      {contas.isError && <p className="p-4 text-sm text-destructive">Não foi possível carregar as contas.</p>}
      {contas.isPending ? <div className="space-y-2 p-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-muted/40" />)}</div> :
        lista.length === 0 ? <div className="p-10 text-center"><Users className="mx-auto size-8 text-muted-foreground" /><p className="mt-2 text-sm text-muted-foreground">Nenhuma conta encontrada.</p></div> :
        <div className="overflow-x-auto"><table className="w-full min-w-[860px] text-sm">
          <thead className="bg-muted/30 text-left text-[11px] uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-2.5 font-medium">Conta</th><th className="font-medium">Situação</th><th className="font-medium">Último acesso</th><th className="text-right font-medium">Propr.</th><th className="text-right font-medium">Registros</th><th className="w-40 pl-6 font-medium">Espaço</th><th /></tr></thead>
          <tbody>{lista.map((c) => {
            const nome = c.nome || c.email.split("@")[0];
            const pct = Math.round((100 * Number(c.bytes_estimados)) / maxEspaco);
            return <tr key={c.user_id} className="cursor-pointer border-t border-border/60 transition-colors hover:bg-muted/25" onClick={() => onDetalhe(c.user_id)}>
              <td className="px-4 py-3"><div className="flex items-center gap-3">
                <span className={`relative grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold uppercase ${c.admin ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>{nome.slice(0, 2)}{recente(c.ultimo_acesso) && <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-card bg-primary" />}</span>
                <div className="min-w-0"><div className="truncate font-medium">{nome}</div><div className="truncate text-xs text-muted-foreground">{c.email} · desde {new Date(c.criado_em).toLocaleDateString("pt-BR")}</div></div>
              </div></td>
              <td><div className="flex gap-1">{c.bloqueado ? <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] font-medium text-destructive">Bloqueada</span> : <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">Ativa</span>}{c.admin && <span className="rounded-full border border-primary/40 px-2 py-0.5 text-[11px] font-medium text-primary">Admin</span>}</div></td>
              <td className="text-xs text-muted-foreground">{data(c.ultimo_acesso)}</td>
              <td className="text-right tabular-nums">{c.propriedades}</td>
              <td className="text-right tabular-nums">{Number(c.registros).toLocaleString("pt-BR")}</td>
              <td className="pl-6"><div className="text-xs tabular-nums">{bytes(Number(c.bytes_estimados))}</div><div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(pct, 2)}%` }} /></div></td>
              <td className="px-4 text-right" onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label="Ações"><MoreHorizontal /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="dark">
                    <DropdownMenuItem onClick={() => onDetalhe(c.user_id)}><Eye />Ver detalhes</DropdownMenuItem>
                    <DropdownMenuItem disabled={acao.isPending} onClick={() => acao.mutate({ user_id: c.user_id, bloqueado: !c.bloqueado })}>{c.bloqueado ? <><Unlock />Desbloquear</> : <><Lock />Bloquear</>}</DropdownMenuItem>
                    <DropdownMenuItem disabled={acao.isPending} onClick={() => acao.mutate({ user_id: c.user_id, admin: !c.admin })}><ShieldCheck />{c.admin ? "Remover admin" : "Tornar admin"}</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>;
          })}</tbody></table></div>}
    </section>
  );
}

function MetricasTab() {
  const q = useQuery({ queryKey: ["admin-metricas"], queryFn: async () => { const r = await rpc("admin_metricas"); if (r.error) throw r.error; return r.data as Metricas; } });
  const m = q.data;
  const cadastros = useMemo(() => (m?.cadastros_90d ?? []).map((d) => ({ ...d, label: diaCurto(d.dia) })), [m]);
  const acessos = useMemo(() => (m?.acessos_30d ?? []).map((d) => ({ ...d, label: diaCurto(d.dia) })), [m]);
  const registros = useMemo(() => {
    type Linha = { label: string; [k: string]: string | number };
    const mapa = new Map<string, Linha>();
    for (const r of m?.registros_dia ?? []) {
      const linha: Linha = mapa.get(r.dia) ?? { label: diaCurto(r.dia) };
      linha[r.tabela] = Number(linha[r.tabela] ?? 0) + Number(r.qtd);
      mapa.set(r.dia, linha);
    }
    return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v);
  }, [m]);
  const litros = useMemo(() => (m?.litros_mes ?? []).map((d) => ({ ...d, label: mesCurto(d.mes) })), [m]);
  const financeiro = useMemo(() => (m?.financeiro_mes ?? []).map((d) => ({ ...d, label: mesCurto(d.mes) })), [m]);
  const t = m?.totais;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card icon={Users} label="Propriedades" value={t?.propriedades ?? "…"} sub={`${t?.animais ?? 0} animais cadastrados`} />
        <Card icon={Database} label="Leite produzido" value={t ? `${Number(t.litros).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} L` : "…"} sub={`${t?.movimentacoes ?? 0} lançamentos financeiros`} />
        <Card icon={Activity} label="Compra e venda" value={t ? `${t.vendas} / ${t.compras}` : "…"} sub="vendas / compras no sistema" />
        <Card icon={ShieldCheck} label="Planos Premium" value={t?.premium_ativos ?? "…"} sub={`${t?.contas_bloqueadas ?? 0} contas bloqueadas`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Novos cadastros (90 dias)">
          <div className="h-56"><ResponsiveContainer><LineChart data={cadastros}><CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} /><XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" /><YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} /><Tooltip contentStyle={tip} cursor={{ fill: "var(--muted)", opacity: 0.3 }} /><Line type="monotone" dataKey="qtd" name="Cadastros" stroke="var(--primary)" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></div>
        </Panel>
        <Panel title="Usuários ativos por dia (30 dias)">
          <div className="h-56"><ResponsiveContainer><BarChart data={acessos}><CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} /><XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" /><YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} /><Tooltip contentStyle={tip} cursor={{ fill: "var(--muted)", opacity: 0.3 }} /><Bar dataKey="qtd" name="Acessos" fill="var(--primary)" radius={4} /></BarChart></ResponsiveContainer></div>
        </Panel>
        <Panel title="Registros criados por tipo (90 dias)">
          <div className="h-64"><ResponsiveContainer><BarChart data={registros}><CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} /><XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" /><YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} /><Tooltip contentStyle={tip} cursor={{ fill: "var(--muted)", opacity: 0.3 }} /><Legend wrapperStyle={{ fontSize: 11 }} /><Bar dataKey="animais" stackId="a" name="Animais" fill="var(--primary)" /><Bar dataKey="producao_leite" stackId="a" name="Leite" fill="var(--chart-2)" /><Bar dataKey="movimentacoes" stackId="a" name="Financeiro" fill="var(--chart-3)" /><Bar dataKey="vacinacoes" stackId="a" name="Vacinas" fill="var(--chart-4)" /><Bar dataKey="nascimentos" stackId="a" name="Nascimentos" fill="var(--chart-5)" /><Bar dataKey="pesagens" stackId="a" name="Pesagens" fill="var(--muted-foreground)" /></BarChart></ResponsiveContainer></div>
        </Panel>
        <Panel title="Leite produzido por mês (12 meses)">
          <div className="h-64"><ResponsiveContainer><AreaChart data={litros}><CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} /><XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" /><YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} /><Tooltip contentStyle={tip} formatter={(v: number) => `${Number(v).toLocaleString("pt-BR")} L`} /><Area type="monotone" dataKey="litros" name="Litros" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.2} /></AreaChart></ResponsiveContainer></div>
        </Panel>
        <Panel title="Financeiro por mês (12 meses)" className="lg:col-span-2">
          <div className="h-64"><ResponsiveContainer><BarChart data={financeiro}><CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} /><XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" /><YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} /><Tooltip contentStyle={tip} formatter={(v: number) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} /><Legend wrapperStyle={{ fontSize: 11 }} /><Bar dataKey="receita" name="Receitas" fill="var(--primary)" radius={3} /><Bar dataKey="despesa" name="Despesas" fill="var(--destructive)" radius={3} /><Bar dataKey="investimento" name="Investimentos" fill="var(--chart-4)" radius={3} /></BarChart></ResponsiveContainer></div>
        </Panel>
      </div>
    </div>
  );
}

function DesempenhoTab({ sistema, latencia }: { sistema: Sistema | undefined; latencia: number | null }) {
  const q = useQuery({ queryKey: ["admin-saude"], refetchInterval: 30000, queryFn: async () => { const r = await rpc("admin_saude"); if (r.error) throw r.error; return r.data as Saude; } });
  const saude = q.data;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card icon={Zap} label="Latência da página" value={latencia != null ? `${latencia} ms` : "…"} sub={`Consulta no banco: ${sistema?.ping_ms ?? "…"} ms`} />
        <Card icon={Activity} label="Conexões ativas" value={sistema?.conexoes_ativas ?? "…"} sub={`${sistema?.conexoes_total ?? 0} abertas`} />
        <Card icon={Activity} label="Acerto de cache" value={sistema?.cache_hit != null ? `${sistema.cache_hit}%` : "—"} sub="Quanto maior, mais rápido" />
        <Card icon={ShieldX} label="Bloqueios no banco" value={saude?.bloqueios ?? "…"} sub="Consultas travadas agora" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Consultas mais lentas">
          {(saude?.consultas_lentas ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Sem dados de consultas no momento.</p> :
            <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="text-left text-muted-foreground"><tr><th className="py-2">Consulta</th><th>Chamadas</th><th>Média</th><th>Total</th></tr></thead><tbody>{saude!.consultas_lentas.map((c, i) => <tr key={i} className="border-t border-border/50"><td className="max-w-[420px] truncate py-1.5 font-mono">{c.consulta}</td><td>{c.chamadas}</td><td>{c.media_ms} ms</td><td>{Number(c.total_ms).toLocaleString("pt-BR")} ms</td></tr>)}</tbody></table></div>}
        </Panel>
        <Panel title="Uso dos limites de requisição (2 horas)">
          {(saude?.rate_limits ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma conta atingiu os limites nas últimas horas.</p> :
            <div className="max-h-64 overflow-auto text-sm">{saude!.rate_limits.map((r, i) => <div key={i} className="border-b border-border/50 py-1.5"><div className="truncate font-mono text-xs">{r.chave}</div><div className="text-xs text-muted-foreground">{data(r.janela)} · {r.contador} requisições</div></div>)}</div>}
          <p className="mt-2 text-xs text-muted-foreground">{Number(saude?.rate_limit_total ?? 0).toLocaleString("pt-BR")} requisições contadas nas últimas 24 h</p>
        </Panel>
        <Panel title="Tabelas mais escaneadas (sem índice)">
          {(saude?.seq_scans ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma tabela pesada para verificar.</p> :
            <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="text-left text-muted-foreground"><tr><th className="py-2">Tabela</th><th>Escaneamentos</th><th>Linhas lidas</th></tr></thead><tbody>{saude!.seq_scans.map((r, i) => <tr key={i} className="border-t border-border/50"><td className="py-1.5">{r.tabela}</td><td>{Number(r.scans).toLocaleString("pt-BR")}</td><td>{Number(r.linhas_lidas).toLocaleString("pt-BR")}</td></tr>)}</tbody></table></div>}
        </Panel>
        <Panel title="Espaço por tabela">
          <div className="max-h-56 overflow-auto text-sm">{(sistema?.tabelas ?? []).map((t) => <div key={t.tabela} className="flex justify-between border-b border-border/50 py-1.5"><span>{t.tabela}</span><span className="text-muted-foreground">{t.linhas.toLocaleString("pt-BR")} linhas · {bytes(t.bytes)}</span></div>)}</div>
        </Panel>
        <Panel title="Limpeza pendente (registros removidos)" className="lg:col-span-2">
          {(saude?.manutencao ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Tudo em ordem — nenhuma tabela precisa de limpeza.</p> :
            <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="text-left text-muted-foreground"><tr><th className="py-2">Tabela</th><th>Registros removidos ainda não limpos</th></tr></thead><tbody>{saude!.manutencao.map((r, i) => <tr key={i} className="border-t border-border/50"><td className="py-1.5">{r.tabela}</td><td>{Number(r.mortas).toLocaleString("pt-BR")}</td></tr>)}</tbody></table></div>}
        </Panel>
      </div>
    </div>
  );
}

type PerfilForm = { nome_completo: string; nome_exibicao: string; cargo: string; biografia: string; telefone: string };

function ContaDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<PerfilForm | null>(null);
  const q = useQuery({
    queryKey: ["admin-conta", id],
    queryFn: async () => { const r = await rpc("admin_conta_detalhe", { _user_id: id }); if (r.error) throw r.error; return r.data as Detalhe; },
  });
  useEffect(() => {
    if (q.data && form === null) setForm({ nome_completo: q.data.perfil?.nome_completo ?? "", nome_exibicao: q.data.perfil?.nome_exibicao ?? "", cargo: q.data.perfil?.cargo ?? "", biografia: q.data.perfil?.biografia ?? "", telefone: q.data.perfil?.telefone ?? "" });
  }, [q.data, form]);

  const salvarPerfil = useMutation({
    mutationFn: async () => { const r = await rpc("admin_definir_perfil", { _user_id: id, _payload: form }); if (r.error) throw r.error; },
    onSuccess: () => { toast.success("Perfil atualizado."); qc.invalidateQueries({ queryKey: ["admin-conta", id] }); qc.invalidateQueries({ queryKey: ["admin-contas"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const acao = useMutation({
    mutationFn: async (a: { bloqueado?: boolean; admin?: boolean }) => { const r = await rpc("admin_definir_conta", { _user_id: id, _bloqueado: a.bloqueado ?? null, _admin: a.admin ?? null }); if (r.error) throw r.error; },
    onSuccess: () => { toast.success("Conta atualizada."); qc.invalidateQueries({ queryKey: ["admin-conta", id] }); qc.invalidateQueries({ queryKey: ["admin-contas"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const plano = useMutation({
    mutationFn: async (a: { pid: string; modo: "premium" | "gratuito" | "cancelar" }) => {
      if (a.modo === "cancelar") { const r = await rpc("cancelar_plano_demonstracao", { _propriedade_id: a.pid, _motivo: "Cancelado pela área admin" }); if (r.error) throw r.error; return; }
      const r = await rpc("setar_plano_demonstracao", { _propriedade_id: a.pid, _plano: a.modo, _status: "ativo", _motivo: a.modo === "premium" ? "Premium ativado pela área admin" : "Voltou para o plano gratuito" });
      if (r.error) throw r.error;
    },
    onSuccess: () => { toast.success("Plano atualizado."); qc.invalidateQueries({ queryKey: ["admin-conta", id] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const excluir = useMutation({
    mutationFn: async () => { const r = await rpc("admin_excluir_conta", { _user_id: id }); if (r.error) throw r.error; return r.data as { propriedades_excluidas: number }; },
    onSuccess: (res) => { toast.success(`Conta excluída (${res.propriedades_excluidas} propriedade(s) removida(s)).`); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const pedirExclusao = () => {
    if (!confirm("Excluir esta conta e TODOS os dados dela? Esta ação é permanente.")) return;
    if (!confirm("Confirma de novo? Todos os animais, relatórios e arquivos da conta serão apagados.")) return;
    excluir.mutate();
  };

  const d = q.data;
  const setF = (k: keyof PerfilForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((p) => (p ? { ...p, [k]: e.target.value } : p));
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="dark max-h-[85vh] overflow-y-auto border-border bg-card sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Detalhes da conta</DialogTitle>
          <DialogDescription>{d?.email ?? q.error?.message ?? "Carregando…"}</DialogDescription>
        </DialogHeader>
        {q.isPending || !d ? <p className="text-sm text-muted-foreground">Carregando detalhes…</p> : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/40 p-3 text-sm sm:grid-cols-4">
              <div><p className="text-xs text-muted-foreground">Cadastro</p><p>{data(d.criado_em)}</p></div>
              <div><p className="text-xs text-muted-foreground">Último acesso</p><p>{data(d.ultimo_acesso)}</p></div>
              <div><p className="text-xs text-muted-foreground">Situação</p><p>{d.perfil?.["bloqueado"] ? "Bloqueada" : "Ativa"}</p></div>
              <div><p className="text-xs text-muted-foreground">Arquivos</p><p>{bytes(d.armazenamento_total)}</p></div>
            </div>

            {(form && salvarPerfil) ? (
              <section className="space-y-3">
                <h3 className="font-semibold">Editar perfil</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1"><Label>Nome completo</Label><Input value={form.nome_completo} onChange={setF("nome_completo")} /></div>
                  <div className="space-y-1"><Label>Nome de exibição</Label><Input value={form.nome_exibicao} onChange={setF("nome_exibicao")} /></div>
                  <div className="space-y-1"><Label>Cargo</Label><Input value={form.cargo} onChange={setF("cargo")} /></div>
                  <div className="space-y-1"><Label>Telefone</Label><Input value={form.telefone} onChange={setF("telefone")} /></div>
                </div>
                <div className="space-y-1"><Label>Biografia</Label><Textarea value={form.biografia} onChange={setF("biografia")} rows={3} /></div>
                <div className="flex gap-2">
                  <Button size="sm" disabled={salvarPerfil.isPending} onClick={() => salvarPerfil.mutate()}>Salvar perfil</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setForm(null); requestAnimationFrame(() => setForm({ nome_completo: d.perfil?.nome_completo ?? "", nome_exibicao: d.perfil?.nome_exibicao ?? "", cargo: d.perfil?.cargo ?? "", biografia: d.perfil?.biografia ?? "", telefone: d.perfil?.telefone ?? "" })); }}>Desfazer</Button>
                </div>
              </section>
            ) : (
              <section className="space-y-1">
                <h3 className="font-semibold">Perfil</h3>
                <p className="text-sm text-muted-foreground">Nome: {d.perfil?.nome_completo || "—"} · Exibição: {d.perfil?.nome_exibicao || "—"} · Cargo: {d.perfil?.cargo || "—"} · Telefone: {d.perfil?.telefone || "—"}</p>
                <Button size="sm" variant="outline" onClick={() => setForm({ nome_completo: d.perfil?.nome_completo ?? "", nome_exibicao: d.perfil?.nome_exibicao ?? "", cargo: d.perfil?.cargo ?? "", biografia: d.perfil?.biografia ?? "", telefone: d.perfil?.telefone ?? "" })}>Editar perfil</Button>
              </section>
            )}

            {d.armazenamento.length > 0 && (
              <section className="space-y-1">
                <h3 className="font-semibold">Arquivos</h3>
                {d.armazenamento.map((a) => <div key={a.bucket} className="flex justify-between border-b border-border/50 py-1 text-sm"><span>{a.bucket}</span><span className="text-muted-foreground">{bytes(a.bytes)}</span></div>)}
              </section>
            )}

            <section className="space-y-2">
              <h3 className="font-semibold">Propriedades ({d.propriedades.length})</h3>
              {d.propriedades.length === 0 ? <p className="text-sm text-muted-foreground">Esta conta não tem propriedades.</p> : d.propriedades.map((p) => (
                <div key={p.id} className="rounded-lg border border-border bg-muted/30 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{p.nome} <span className="text-xs text-muted-foreground">{p.cidade ? `· ${p.cidade}${p.estado ? `/${p.estado}` : ""}` : ""}</span></p>
                      <p className="text-xs text-muted-foreground">{p.animais.toLocaleString("pt-BR")} animais · {p.producao.toLocaleString("pt-BR")} registros de leite · {p.financeiro.toLocaleString("pt-BR")} lançamentos</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      {p.plano ? <span className={`rounded px-2 py-0.5 text-xs ${p.plano.plano === "premium" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>{p.plano.plano === "premium" ? "Premium" : "Gratuito"}{p.plano.origem === "demonstracao" ? " (demonstração)" : ""}</span> : <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">Sem plano</span>}
                      <Button size="sm" variant="outline" disabled={plano.isPending || p.plano?.plano === "premium"} onClick={() => plano.mutate({ pid: p.id, modo: "premium" })}>Premium</Button>
                      <Button size="sm" variant="ghost" disabled={plano.isPending || (p.plano?.plano !== "premium")}>Gratuito</Button>
                      <Button size="sm" variant="ghost" disabled={plano.isPending || !p.plano} onClick={() => plano.mutate({ pid: p.id, modo: "cancelar" })}>Cancelar plano</Button>
                    </div>
                  </div>
                </div>
              ))}
            </section>

            <section className="flex flex-wrap gap-2 border-t border-border pt-4">
              <Button variant="outline" size="sm" disabled={acao.isPending} onClick={() => acao.mutate({ bloqueado: !d.perfil?.["bloqueado"] })}>{d.perfil?.["bloqueado"] ? "Desbloquear conta" : "Bloquear conta"}</Button>
              <Button variant="ghost" size="sm" disabled={acao.isPending} onClick={() => acao.mutate({ admin: !d.admin })}>{d.admin ? "Remover admin" : "Tornar admin"}</Button>
              <Button variant="destructive" size="sm" className="ml-auto" disabled={excluir.isPending || d.admin} title={d.admin ? "Remova o papel de admin antes de excluir" : undefined} onClick={pedirExclusao}><Trash2 />Excluir conta</Button>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

type Aba = "tempo" | "seguranca" | "contas" | "metricas" | "desempenho";
const ABAS: { k: Aba; label: string; icon: typeof Users }[] = [
  { k: "tempo", label: "Tempo real", icon: Radio },
  { k: "seguranca", label: "Segurança e alertas", icon: ShieldAlert },
  { k: "contas", label: "Contas", icon: Users },
  { k: "metricas", label: "Métricas", icon: BarChart3 },
  { k: "desempenho", label: "Desempenho", icon: Gauge },
];

function Shell({ children, tab, setTab, alertaCount }: { children: React.ReactNode; tab?: Aba; setTab?: (t: Aba) => void; alertaCount?: number }) {
  return (
    <main className="dark min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-[1500px] flex-col lg:flex-row">
        <aside className="border-b border-border bg-sidebar lg:sticky lg:top-0 lg:h-screen lg:w-60 lg:shrink-0 lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-2 p-4">
            <Button asChild variant="ghost" size="icon"><Link to="/app/$section" params={{ section: "inicio" }} aria-label="Voltar ao sistema"><ArrowLeft /></Link></Button>
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-primary/15 text-primary"><ShieldCheck className="size-4" /></span>
              <div><p className="text-sm font-bold leading-tight">Área Admin</p><p className="text-[11px] text-muted-foreground">Pecuária Digital</p></div>
            </div>
          </div>
          {setTab && (
            <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible">
              {ABAS.map(({ k, label, icon: Icon }) => (
                <button key={k} type="button" onClick={() => setTab(k)}
                  className={`flex h-10 shrink-0 items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition-colors ${tab === k ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"}`}>
                  <Icon className="size-4" />{label}
                  {k === "tempo" && <span className="ml-auto size-1.5 rounded-full bg-primary" />}
                  {k === "seguranca" && (alertaCount ?? 0) > 0 && <span className="ml-auto rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">{alertaCount}</span>}
                </button>
              ))}
            </nav>
          )}
          <p className="hidden px-6 pt-4 text-[11px] text-muted-foreground lg:block">Visível apenas para administradores do sistema.</p>
        </aside>
        <div className="min-w-0 flex-1 space-y-5 p-4 sm:p-8">{children}</div>
      </div>
    </main>
  );
}
function Card({ icon: Icon, label, value, sub }: { icon: typeof Users; label: string; value: React.ReactNode; sub: string }) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40">
      <div className="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full bg-primary/5 transition-colors group-hover:bg-primary/10" />
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><span className="grid size-7 place-items-center rounded-md bg-primary/12 text-primary"><Icon className="size-3.5" /></span>{label}</div>
      <div className="mt-3 text-2xl font-bold tabular-nums tracking-tight">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}
function Panel({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-border bg-card p-5 ${className ?? ""}`}><h3 className="mb-4 text-sm font-semibold">{title}</h3>{children}</section>;
}

type Alerta = { categoria: "seguranca" | "desempenho"; severidade: "info" | "aviso" | "critico"; titulo: string; detalhe: string };
type Alertas = {
  alertas: Alerta[]; bloqueios_10min: number; bloqueios_60min: number; ips_60min: number; conexoes: number; conexoes_max: number; cache: number;
  eventos: { criado_em: string; tipo: string; severidade: string; ip: string | null; caminho: string | null; quantidade: number; detalhe: string | null }[];
  por_hora: { hora: string; total: number }[]; top_ips: { ip: string | null; total: number; ultimo: string }[];
};
const sevCls = { critico: "border-destructive/50 bg-destructive/10 text-destructive", aviso: "border-chart-4/50 bg-chart-4/10 text-chart-4", info: "border-border bg-muted/30 text-muted-foreground" } as const;
const TIPOS: Record<string, string> = { rajada: "Rajada de acessos", limite_minuto: "Limite por minuto", pico_global: "Pico geral (DDoS)", envio_grande: "Envio grande demais" };

function AlertasFaixa({ dados, erro, onVer, esconderVer }: { dados?: Alertas; erro: boolean; onVer: () => void; esconderVer: boolean }) {
  const lista = (dados?.alertas ?? []).filter((a) => a.severidade !== "info");
  if (erro) return <div className={`rounded-xl border p-3 text-sm ${sevCls.aviso}`}>Não foi possível verificar os alertas agora.</div>;
  if (!lista.length) return null;
  return <div className="space-y-2">{lista.map((a) => (
    <div key={a.titulo} role="alert" className={`flex items-start gap-3 rounded-xl border p-3 ${sevCls[a.severidade]}`}>
      {a.severidade === "critico" ? <AlertTriangle className="mt-0.5 size-5 shrink-0 animate-pulse" /> : <BellRing className="mt-0.5 size-5 shrink-0" />}
      <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{a.titulo}</p><p className="text-xs text-foreground/80">{a.detalhe}</p></div>
      {!esconderVer && <Button size="sm" variant="outline" onClick={onVer}>Ver</Button>}
    </div>))}</div>;
}

function SegurancaTab({ dados, carregando }: { dados?: Alertas; carregando: boolean }) {
  if (carregando || !dados) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  const nivel = dados.alertas.some((a) => a.severidade === "critico") ? "critico" : dados.alertas.some((a) => a.severidade === "aviso") ? "aviso" : "ok";
  const horas = Array.from({ length: 24 }, (_, i) => { const d = new Date(Date.now() - (23 - i) * 3600e3); d.setMinutes(0, 0, 0); const f = dados.por_hora.find((x) => new Date(x.hora).getTime() === d.getTime()); return { hora: `${String(d.getHours()).padStart(2, "0")}h`, total: Number(f?.total ?? 0) }; });
  return <div className="space-y-5">
    <div className={`flex items-center gap-4 rounded-xl border p-5 ${nivel === "ok" ? "border-primary/40 bg-primary/10" : sevCls[nivel]}`}>
      {nivel === "ok" ? <ShieldCheck className="size-10 text-primary" /> : <ShieldX className="size-10" />}
      <div><p className="text-lg font-bold">{nivel === "ok" ? "Site protegido — nenhum ataque detectado" : nivel === "critico" ? "Atenção: problema grave detectado" : "Há avisos para verificar"}</p>
      <p className="text-sm text-muted-foreground">A proteção bloqueia automaticamente quem faz acessos em excesso (rajadas de mais de 30–60 pedidos em 5 segundos ou mais de 120–300 por minuto).</p></div>
    </div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Card icon={ShieldX} label="Bloqueios (10 min)" value={dados.bloqueios_10min} sub="acessos recusados" />
      <Card icon={ShieldAlert} label="Bloqueios (1 hora)" value={dados.bloqueios_60min} sub={`${dados.ips_60min} endereço(s) diferentes`} />
      <Card icon={Users} label="Conexões do banco" value={`${dados.conexoes}/${dados.conexoes_max}`} sub={`${Math.round((100 * dados.conexoes) / Math.max(1, dados.conexoes_max))}% da capacidade`} />
      <Card icon={Gauge} label="Cache do banco" value={`${dados.cache}%`} sub={dados.cache >= 95 ? "ótimo" : dados.cache >= 90 ? "bom" : "baixo"} />
    </div>
    <Panel title="Alertas ativos">{dados.alertas.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum alerta de segurança ou desempenho no momento.</p> :
      <div className="space-y-2">{dados.alertas.map((a) => <div key={a.titulo} className={`rounded-lg border p-3 ${sevCls[a.severidade]}`}><div className="flex items-center gap-2 text-sm font-semibold">{a.categoria === "seguranca" ? <ShieldAlert className="size-4" /> : <Gauge className="size-4" />}{a.titulo}<span className="ml-auto text-[10px] uppercase">{a.categoria === "seguranca" ? "Segurança" : "Desempenho"}</span></div><p className="mt-1 text-xs text-foreground/80">{a.detalhe}</p></div>)}</div>}
    </Panel>
    <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
      <Panel title="Acessos bloqueados nas últimas 24 horas"><div className="h-60"><ResponsiveContainer width="100%" height="100%"><BarChart data={horas}><CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="hora" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} interval={2} /><YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} allowDecimals={false} /><Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} formatter={(v) => [v, "Bloqueios"]} /><Bar dataKey="total" fill="var(--destructive)" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div></Panel>
      <Panel title="Endereços mais bloqueados (24h)">{dados.top_ips.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum endereço bloqueado.</p> : <div className="space-y-2 text-sm">{dados.top_ips.map((i) => <div key={String(i.ip)} className="flex items-center justify-between border-b border-border/50 pb-1.5"><span className="font-mono text-xs">{i.ip ?? "desconhecido"}</span><span className="text-xs text-muted-foreground">{i.total} · {new Date(i.ultimo).toLocaleTimeString("pt-BR")}</span></div>)}</div>}</Panel>
    </div>
    <Panel title="Últimos eventos de segurança">{dados.eventos.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum evento registrado. Quando alguém exceder os limites, aparecerá aqui.</p> :
      <div className="max-h-96 overflow-auto"><table className="w-full min-w-[640px] text-sm"><thead className="sticky top-0 bg-card text-left text-xs uppercase text-muted-foreground"><tr><th className="py-2">Quando</th><th>Tipo</th><th>Endereço</th><th>Página</th><th className="text-right">Qtd.</th></tr></thead><tbody>{dados.eventos.map((e, i) => <tr key={i} className="border-t border-border/50"><td className="py-1.5 text-xs">{new Date(e.criado_em).toLocaleString("pt-BR")}</td><td><span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${sevCls[(e.severidade as keyof typeof sevCls) ?? "info"] ?? sevCls.info}`}>{TIPOS[e.tipo] ?? e.tipo}</span></td><td className="font-mono text-xs">{e.ip ?? "—"}</td><td className="max-w-[200px] truncate text-xs text-muted-foreground">{e.caminho ?? "—"}</td><td className="text-right tabular-nums">{e.quantidade}</td></tr>)}</tbody></table></div>}
    </Panel>
  </div>;
}

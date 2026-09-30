import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowLeft, BarChart3, Database, HardDrive, Search, ShieldCheck, ShieldX, Trash2, Users, Zap } from "lucide-react";
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
  const [tab, setTab] = useState<"contas" | "metricas" | "desempenho">("contas");
  const [busca, setBusca] = useState("");
  const [latencia, setLatencia] = useState<number | null>(null);
  const [detalheId, setDetalheId] = useState<string | null>(null);

  const isAdmin = useQuery({ queryKey: ["sou-admin"], queryFn: async () => { const r = await rpc("sou_admin"); if (r.error) throw r.error; return r.data === true; } });
  const sistema = useQuery({
    queryKey: ["admin-sistema"], enabled: isAdmin.data === true, refetchInterval: 30000,
    queryFn: async () => { const t = performance.now(); const r = await rpc("admin_sistema"); setLatencia(Math.round(performance.now() - t)); if (r.error) throw r.error; return r.data as Sistema; },
  });
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
  if (!isAdmin.data) return <Shell><div className="rounded-lg border border-border bg-card p-8 text-center"><ShieldCheck className="mx-auto size-10 text-destructive" /><h2 className="mt-3 text-lg font-semibold">Acesso restrito</h2><p className="mt-1 text-sm text-muted-foreground">Somente administradores do sistema podem ver esta área.</p></div></Shell>;

  const s = sistema.data;
  return (
    <Shell>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card icon={Users} label="Contas" value={s?.usuarios ?? "…"} sub={`${s?.novos_7d ?? 0} novas / ${s?.ativos_7d ?? 0} ativas em 7 dias`} />
        <Card icon={Database} label="Banco de dados" value={s ? bytes(s.banco_bytes) : "…"} sub={`${s?.propriedades ?? 0} propriedades`} />
        <Card icon={HardDrive} label="Arquivos" value={s ? bytes(s.armazenamento_bytes) : "…"} sub={`${s?.arquivos ?? 0} arquivos`} />
        <Card icon={Zap} label="Velocidade" value={latencia != null ? `${latencia} ms` : "…"} sub={`Consulta no banco: ${s?.ping_ms ?? "…"} ms`} />
      </div>

      <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
        {([["contas", "Contas"], ["metricas", "Métricas"], ["desempenho", "Desempenho"]] as const).map(([k, label]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`h-9 flex-1 rounded-md px-4 text-sm font-medium transition-colors sm:flex-none ${tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{label}</button>
        ))}
      </div>

      {tab === "contas" && <ContasTab filtradas={filtradas} contas={contas} busca={busca} setBusca={setBusca} acao={acao} onDetalhe={setDetalheId} />}
      {tab === "metricas" && <MetricasTab />}
      {tab === "desempenho" && <DesempenhoTab sistema={s} latencia={latencia} />}

      {detalheId && <ContaDialog id={detalheId} onClose={() => { setDetalheId(null); qc.invalidateQueries({ queryKey: ["admin-contas"] }); qc.invalidateQueries({ queryKey: ["admin-sistema"] }); }} />}
    </Shell>
  );
}

function ContasTab({ filtradas, contas, busca, setBusca, acao, onDetalhe }: {
  filtradas: Conta[]; contas: { isError: boolean; isPending: boolean }; busca: string; setBusca: (v: string) => void;
  acao: { isPending: boolean; mutate: (a: { user_id: string; bloqueado?: boolean; admin?: boolean }) => void }; onDetalhe: (id: string) => void;
}) {
  return (
    <Panel title={`Contas (${filtradas.length})`}>
      <div className="relative mb-3 max-w-sm"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar por nome ou e-mail" value={busca} onChange={(e) => setBusca(e.target.value)} /></div>
      {contas.isError && <p className="text-sm text-destructive">Não foi possível carregar as contas.</p>}
      {contas.isPending ? <p className="text-sm text-muted-foreground">Carregando contas…</p> : <div className="overflow-x-auto"><table className="w-full min-w-[920px] text-sm"><thead className="text-left text-xs text-muted-foreground"><tr><th className="py-2">Conta</th><th>Cadastro</th><th>Último acesso</th><th>Propriedades</th><th>Registros</th><th>Espaço</th><th>Situação</th><th /></tr></thead>
        <tbody>{filtradas.map((c) => <tr key={c.user_id} className="border-t border-border/50">
          <td className="py-2"><div className="font-medium">{c.nome || "—"}</div><div className="text-xs text-muted-foreground">{c.email}</div></td>
          <td className="text-xs">{data(c.criado_em)}</td><td className="text-xs">{data(c.ultimo_acesso)}</td>
          <td>{c.propriedades}</td><td>{Number(c.registros).toLocaleString("pt-BR")}</td><td>{bytes(Number(c.bytes_estimados))}</td>
          <td>{c.bloqueado ? <span className="rounded bg-destructive/15 px-2 py-0.5 text-xs text-destructive">Bloqueada</span> : <span className="rounded bg-primary/15 px-2 py-0.5 text-xs text-primary">Ativa</span>}{c.admin && <span className="ml-1 rounded bg-accent px-2 py-0.5 text-xs">Admin</span>}</td>
          <td className="space-x-1 whitespace-nowrap text-right">
            <Button size="sm" variant="outline" onClick={() => onDetalhe(c.user_id)}>Detalhes</Button>
            <Button size="sm" variant="ghost" disabled={acao.isPending} onClick={() => acao.mutate({ user_id: c.user_id, bloqueado: !c.bloqueado })}>{c.bloqueado ? "Desbloquear" : "Bloquear"}</Button>
            <Button size="sm" variant="ghost" disabled={acao.isPending} onClick={() => acao.mutate({ user_id: c.user_id, admin: !c.admin })}>{c.admin ? "Remover admin" : "Tornar admin"}</Button>
          </td></tr>)}</tbody></table></div>}
    </Panel>
  );
}

function MetricasTab() {
  const q = useQuery({ queryKey: ["admin-metricas"], queryFn: async () => { const r = await rpc("admin_metricas"); if (r.error) throw r.error; return r.data as Metricas; } });
  const m = q.data;
  const cadastros = useMemo(() => (m?.cadastros_90d ?? []).map((d) => ({ ...d, label: diaCurto(d.dia) })), [m]);
  const acessos = useMemo(() => (m?.acessos_30d ?? []).map((d) => ({ ...d, label: diaCurto(d.dia) })), [m]);
  const registros = useMemo(() => {
    type Linha = { label: string } & Record<string, number>;
    const mapa = new Map<string, Linha>();
    for (const r of m?.registros_dia ?? []) {
      const linha: Linha = mapa.get(r.dia) ?? { label: diaCurto(r.dia) };
      linha[r.tabela] = (linha[r.tabela] ?? 0) + Number(r.qtd);
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
          <div className="h-56"><ResponsiveContainer><LineChart data={cadastros}><CartesianGrid strokeOpacity={0.1} /><XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" /><YAxis allowDecimals={false} tick={{ fontSize: 10 }} /><Tooltip /><Line type="monotone" dataKey="qtd" name="Cadastros" stroke="var(--primary)" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></div>
        </Panel>
        <Panel title="Usuários ativos por dia (30 dias)">
          <div className="h-56"><ResponsiveContainer><BarChart data={acessos}><CartesianGrid strokeOpacity={0.1} /><XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" /><YAxis allowDecimals={false} tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="qtd" name="Acessos" fill="var(--primary)" radius={4} /></BarChart></ResponsiveContainer></div>
        </Panel>
        <Panel title="Registros criados por tipo (90 dias)">
          <div className="h-64"><ResponsiveContainer><BarChart data={registros}><CartesianGrid strokeOpacity={0.1} /><XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" /><YAxis allowDecimals={false} tick={{ fontSize: 10 }} /><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} /><Bar dataKey="animais" stackId="a" name="Animais" fill="var(--primary)" /><Bar dataKey="producao_leite" stackId="a" name="Leite" fill="#22d3ee" /><Bar dataKey="movimentacoes" stackId="a" name="Financeiro" fill="#a78bfa" /><Bar dataKey="vacinacoes" stackId="a" name="Vacinas" fill="#f59e0b" /><Bar dataKey="nascimentos" stackId="a" name="Nascimentos" fill="#f472b6" /><Bar dataKey="pesagens" stackId="a" name="Pesagens" fill="#94a3b8" /></BarChart></ResponsiveContainer></div>
        </Panel>
        <Panel title="Leite produzido por mês (12 meses)">
          <div className="h-64"><ResponsiveContainer><AreaChart data={litros}><CartesianGrid strokeOpacity={0.1} /><XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" /><YAxis tick={{ fontSize: 10 }} /><Tooltip formatter={(v: number) => `${Number(v).toLocaleString("pt-BR")} L`} /><Area type="monotone" dataKey="litros" name="Litros" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.2} /></AreaChart></ResponsiveContainer></div>
        </Panel>
        <Panel title="Financeiro por mês (12 meses)" className="lg:col-span-2">
          <div className="h-64"><ResponsiveContainer><BarChart data={financeiro}><CartesianGrid strokeOpacity={0.1} /><XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" /><YAxis tick={{ fontSize: 10 }} /><Tooltip formatter={(v: number) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} /><Legend wrapperStyle={{ fontSize: 11 }} /><Bar dataKey="receita" name="Receitas" fill="var(--primary)" radius={3} /><Bar dataKey="despesa" name="Despesas" fill="#ef4444" radius={3} /><Bar dataKey="investimento" name="Investimentos" fill="#f59e0b" radius={3} /></BarChart></ResponsiveContainer></div>
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

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="dark min-h-screen bg-background p-4 text-foreground sm:p-8"><div className="mx-auto max-w-7xl space-y-5"><div className="flex items-center gap-3"><Button asChild variant="ghost" size="icon"><Link to="/app/$section" params={{ section: "inicio" }} aria-label="Voltar"><ArrowLeft /></Link></Button><div><h1 className="text-2xl font-bold">Área Admin</h1><p className="text-sm text-muted-foreground">Contas, métricas e desempenho do sistema.</p></div></div>{children}</div></main>;
}
function Card({ icon: Icon, label, value, sub }: { icon: typeof Users; label: string; value: React.ReactNode; sub: string }) {
  return <div className="rounded-lg border border-border bg-card p-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="size-4 text-primary" />{label}</div><div className="mt-2 text-2xl font-bold">{value}</div><div className="mt-1 text-xs text-muted-foreground">{sub}</div></div>;
}
function Panel({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return <section className={`rounded-lg border border-border bg-card p-4 ${className ?? ""}`}><h2 className="mb-3 font-semibold">{title}</h2>{children}</section>;
}

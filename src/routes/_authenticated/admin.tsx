import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Activity, ArrowLeft, Database, HardDrive, Search, ShieldCheck, Users, Zap } from "lucide-react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Área Admin | Apecuária Digital" },
      { name: "description", content: "Painel administrativo: contas, espaço usado e desempenho do sistema." },
      { property: "og:title", content: "Área Admin | Apecuária Digital" },
      { property: "og:description", content: "Contas, armazenamento e desempenho do sistema." },
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

const rpc = supabase.rpc.bind(supabase) as unknown as (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;

const bytes = (n: number) => {
  if (!n) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"]; const i = Math.min(4, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${u[i]}`;
};
const data = (s: string | null) => (s ? new Date(s).toLocaleString("pt-BR") : "—");

function AdminPage() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [latencia, setLatencia] = useState<number | null>(null);

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
        <Card icon={Activity} label="Conexões ativas" value={s?.conexoes_ativas ?? "…"} sub={`${s?.conexoes_total ?? 0} abertas`} />
        <Card icon={Activity} label="Acerto de cache" value={s?.cache_hit != null ? `${s.cache_hit}%` : "—"} sub="Quanto maior, mais rápido" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Novos cadastros (30 dias)">
          <div className="h-56"><ResponsiveContainer><BarChart data={s?.cadastros_30d ?? []}><CartesianGrid strokeOpacity={0.1} /><XAxis dataKey="dia" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="qtd" fill="var(--primary)" radius={4} /></BarChart></ResponsiveContainer></div>
        </Panel>
        <Panel title="Espaço por tabela">
          <div className="max-h-56 overflow-auto text-sm">{(s?.tabelas ?? []).map((t) => <div key={t.tabela} className="flex justify-between border-b border-border/50 py-1.5"><span>{t.tabela}</span><span className="text-muted-foreground">{t.linhas.toLocaleString("pt-BR")} linhas · {bytes(t.bytes)}</span></div>)}</div>
        </Panel>
      </div>

      <Panel title="Consultas mais lentas">
        {(s?.consultas_lentas ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Sem dados de consultas no momento.</p> :
          <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="text-left text-muted-foreground"><tr><th className="py-2">Consulta</th><th>Chamadas</th><th>Média</th></tr></thead><tbody>{s!.consultas_lentas.map((c, i) => <tr key={i} className="border-t border-border/50"><td className="max-w-[520px] truncate py-1.5 font-mono">{c.consulta}</td><td>{c.chamadas}</td><td>{c.media_ms} ms</td></tr>)}</tbody></table></div>}
      </Panel>

      <Panel title={`Contas (${filtradas.length})`}>
        <div className="relative mb-3 max-w-sm"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar por nome ou e-mail" value={busca} onChange={(e) => setBusca(e.target.value)} /></div>
        {contas.isError && <p className="text-sm text-destructive">Não foi possível carregar as contas.</p>}
        <div className="overflow-x-auto"><table className="w-full min-w-[860px] text-sm"><thead className="text-left text-xs text-muted-foreground"><tr><th className="py-2">Conta</th><th>Cadastro</th><th>Último acesso</th><th>Propriedades</th><th>Registros</th><th>Espaço</th><th>Situação</th><th /></tr></thead>
          <tbody>{filtradas.map((c) => <tr key={c.user_id} className="border-t border-border/50">
            <td className="py-2"><div className="font-medium">{c.nome || "—"}</div><div className="text-xs text-muted-foreground">{c.email}</div></td>
            <td className="text-xs">{data(c.criado_em)}</td><td className="text-xs">{data(c.ultimo_acesso)}</td>
            <td>{c.propriedades}</td><td>{Number(c.registros).toLocaleString("pt-BR")}</td><td>{bytes(Number(c.bytes_estimados))}</td>
            <td>{c.bloqueado ? <span className="rounded bg-destructive/15 px-2 py-0.5 text-xs text-destructive">Bloqueada</span> : <span className="rounded bg-primary/15 px-2 py-0.5 text-xs text-primary">Ativa</span>}{c.admin && <span className="ml-1 rounded bg-accent px-2 py-0.5 text-xs">Admin</span>}</td>
            <td className="space-x-1 whitespace-nowrap text-right">
              <Button size="sm" variant="outline" disabled={acao.isPending} onClick={() => acao.mutate({ user_id: c.user_id, bloqueado: !c.bloqueado })}>{c.bloqueado ? "Desbloquear" : "Bloquear"}</Button>
              <Button size="sm" variant="ghost" disabled={acao.isPending} onClick={() => acao.mutate({ user_id: c.user_id, admin: !c.admin })}>{c.admin ? "Remover admin" : "Tornar admin"}</Button>
            </td></tr>)}</tbody></table></div>
      </Panel>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="dark min-h-screen bg-background p-4 text-foreground sm:p-8"><div className="mx-auto max-w-7xl space-y-5"><div className="flex items-center gap-3"><Button asChild variant="ghost" size="icon"><Link to="/app/$section" params={{ section: "inicio" }} aria-label="Voltar"><ArrowLeft /></Link></Button><div><h1 className="text-2xl font-bold">Área Admin</h1><p className="text-sm text-muted-foreground">Contas, espaço usado e desempenho do sistema.</p></div></div>{children}</div></main>;
}
function Card({ icon: Icon, label, value, sub }: { icon: typeof Users; label: string; value: React.ReactNode; sub: string }) {
  return <div className="rounded-lg border border-border bg-card p-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="size-4 text-primary" />{label}</div><div className="mt-2 text-2xl font-bold">{value}</div><div className="mt-1 text-xs text-muted-foreground">{sub}</div></div>;
}
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-lg border border-border bg-card p-4"><h2 className="mb-3 font-semibold">{title}</h2>{children}</section>;
}

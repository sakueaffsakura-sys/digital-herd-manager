import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Eye, Fingerprint, Globe, Hammer, History, Power, ShieldAlert, ShieldCheck, Unlock, UserX } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { dispositivoLocal, MODULOS_MANUTENCAO } from "./Manutencao";

type Status = "ativo" | "manutencao" | "bloqueado";
type Config = { status: Status; titulo: string; mensagem: string; modulos: string[]; duracao_bloqueio_min: number; atualizado_em: string };
type Incidente = { id: string; criado_em: string; tipo: string; severidade: string; ip: string | null; dispositivo: string | null; user_id: string | null; email: string | null; caminho: string | null; metodo: string | null; agente: string | null; motivo: string; detalhes: Record<string, unknown>; bloqueou: boolean };
type Bloqueio = { id: string; tipo: "ip" | "dispositivo" | "usuario"; valor: string; email: string | null; motivo: string; criado_em: string; expira_em: string | null; situacao: "ativo" | "removido" | "expirado"; tentativas: number; ultima_tentativa: string | null; incidente_id: string | null; removido_em: string | null };
type Historico = { id: string; criado_em: string; email: string | null; status_anterior: string | null; status_novo: string; detalhes: { titulo?: string; modulos?: string[] }; ip: string | null };
type Painel = { config: Config; totais: { suspeitas: number; negados: number; ips: number; dispositivos: number; contas: number }; tipos: string[]; incidentes: Incidente[]; bloqueios: Bloqueio[]; historico: Historico[] };
type Filtros = { desde: string; ate: string; ip: string; dispositivo: string; tipo: string; status: string };

const rpc = supabase.rpc.bind(supabase) as unknown as (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const dt = (s: string | null) => (s ? new Date(s).toLocaleString("pt-BR") : "—");
const STATUS: Record<Status, { label: string; cls: string }> = {
  ativo: { label: "Ativo", cls: "bg-primary/15 text-primary border-primary/30" },
  manutencao: { label: "Em manutenção", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  bloqueado: { label: "Bloqueado", cls: "bg-destructive/15 text-destructive border-destructive/30" },
};
const TIPOS_LABEL: Record<string, string> = {
  alterar_manutencao: "Alterar manutenção sem permissão", acesso_negado_manutencao: "Acesso negado na manutenção",
  manipulacao_requisicao: "Manipulação de requisição", burlar_manutencao_repeticao: "Insistência após bloqueio",
  burlar_manutencao_manipulacao: "Forjar requisições repetidamente",
};
const tipoLabel = (t: string) => TIPOS_LABEL[t] ?? t.replaceAll("_", " ");

function usePainel(f: Filtros) {
  return useQuery({
    queryKey: ["admin-seguranca-painel", f], refetchInterval: 10_000,
    queryFn: async () => {
      const r = await rpc("admin_seguranca_painel", {
        _desde: f.desde ? new Date(f.desde + "T00:00:00").toISOString() : null,
        _ate: f.ate ? new Date(f.ate + "T23:59:59").toISOString() : null,
        _ip: f.ip.trim() || null, _dispositivo: f.dispositivo.trim() || null, _tipo: f.tipo || null, _status: f.status || null,
      });
      if (r.error) throw new Error("Não foi possível carregar os dados de segurança.");
      return r.data as Painel;
    },
  });
}

const VAZIO: Filtros = { desde: "", ate: "", ip: "", dispositivo: "", tipo: "", status: "" };

export function ManutencaoAdmin() {
  const qc = useQueryClient();
  const q = usePainel(VAZIO);
  const cfg = q.data?.config;
  const [form, setForm] = useState<Omit<Config, "atualizado_em" | "status"> | null>(null);
  const [confirmar, setConfirmar] = useState<Status | null>(null);
  useEffect(() => { if (cfg && !form) setForm({ titulo: cfg.titulo, mensagem: cfg.mensagem, modulos: cfg.modulos, duracao_bloqueio_min: cfg.duracao_bloqueio_min }); }, [cfg, form]);

  const salvar = useMutation({
    mutationFn: async (status: Status) => {
      if (!form) return;
      const r = await rpc("admin_manutencao_definir", { _status: status, _titulo: form.titulo, _mensagem: form.mensagem, _modulos: form.modulos, _duracao_bloqueio_min: form.duracao_bloqueio_min, _dispositivo: dispositivoLocal() });
      if (r.error) throw new Error("Não foi possível salvar. Tente novamente.");
      const d = r.data as { ok: boolean; erro?: string };
      if (!d.ok) throw new Error(d.erro ?? "Não foi possível salvar.");
    },
    onSuccess: () => { toast.success("Configuração aplicada imediatamente."); qc.invalidateQueries({ queryKey: ["admin-seguranca-painel"] }); qc.invalidateQueries({ queryKey: ["estado-manutencao"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading || !form || !cfg) return <p className="text-sm text-muted-foreground">Carregando configuração…</p>;
  if (q.error) return <p className="text-sm text-destructive">{(q.error as Error).message}</p>;
  const st = STATUS[cfg.status];
  const toggleMod = (k: string, on: boolean) => {
    let m = on ? [...form.modulos, k] : form.modulos.filter((x) => x !== k);
    if (k === "todos" && on) m = ["todos"];
    else if (on) m = m.filter((x) => x !== "todos");
    setForm({ ...form, modulos: Array.from(new Set(m)) });
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-xl bg-primary/10 text-primary"><Power className="size-6" /></span>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Status atual do sistema</p>
              <span className={`mt-1 inline-flex rounded-full border px-3 py-0.5 text-sm font-semibold ${st.cls}`}>{st.label}</span>
              <p className="mt-1 text-xs text-muted-foreground">Atualizado em {dt(cfg.atualizado_em)}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {cfg.status !== "ativo" && <Button onClick={() => setConfirmar("ativo")} disabled={salvar.isPending}><ShieldCheck /> Desativar manutenção</Button>}
            {cfg.status !== "manutencao" && <Button variant="outline" onClick={() => setConfirmar("manutencao")} disabled={salvar.isPending}><Hammer /> Ativar manutenção</Button>}
            {cfg.status !== "bloqueado" && <Button variant="destructive" onClick={() => setConfirmar("bloqueado")} disabled={salvar.isPending}><Ban /> Bloquear sistema</Button>}
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-6">
          <h3 className="font-semibold">Tela de manutenção</h3>
          <div className="space-y-1.5"><Label htmlFor="m-titulo">Título</Label><Input id="m-titulo" maxLength={120} value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="m-msg">Mensagem</Label><Textarea id="m-msg" rows={5} maxLength={1000} value={form.mensagem} onChange={(e) => setForm({ ...form, mensagem: e.target.value })} /></div>
          <div className="space-y-1.5">
            <Label htmlFor="m-dur">Duração do bloqueio automático (minutos, 0 = até remover manualmente)</Label>
            <Input id="m-dur" type="number" min={0} max={525600} value={form.duracao_bloqueio_min} onChange={(e) => setForm({ ...form, duracao_bloqueio_min: Math.max(0, Math.min(525600, Number(e.target.value) || 0)) })} />
          </div>
          <div className="rounded-xl border border-dashed border-border p-4 text-center">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Prévia</p>
            <p className="mt-2 font-bold">{form.titulo || "—"}</p>
            <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{form.mensagem || "—"}</p>
          </div>
        </div>
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-6">
          <h3 className="font-semibold">Páginas e funções bloqueadas</h3>
          <p className="text-xs text-muted-foreground">Vale enquanto a manutenção estiver ativa. "Bloquear sistema" barra tudo, sempre. Administradores continuam com acesso.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {MODULOS_MANUTENCAO.map((m) => (
              <label key={m.k} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted/40">
                <Checkbox checked={form.modulos.includes(m.k)} onCheckedChange={(v) => toggleMod(m.k, v === true)} />{m.label}
              </label>
            ))}
          </div>
          <Button onClick={() => salvar.mutate(cfg.status)} disabled={salvar.isPending} className="w-full">Salvar textos e áreas</Button>
        </div>
      </section>

      <AlertDialog open={!!confirmar} onOpenChange={(o) => !o && setConfirmar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmar === "ativo" ? "Desativar a manutenção?" : confirmar === "bloqueado" ? "Bloquear todo o sistema?" : "Ativar a manutenção?"}</AlertDialogTitle>
            <AlertDialogDescription>{confirmar === "ativo" ? "Todos voltarão a acessar o sistema imediatamente." : "Usuários comuns verão a tela de manutenção imediatamente. Você continua com acesso ao painel."}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirmar) salvar.mutate(confirmar); setConfirmar(null); }}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function MonitoramentoSeguranca() {
  const qc = useQueryClient();
  const [f, setF] = useState<Filtros>(VAZIO);
  const [aplicado, setAplicado] = useState<Filtros>(VAZIO);
  const q = usePainel(aplicado);
  const [detalhe, setDetalhe] = useState<Incidente | null>(null);
  const [remover, setRemover] = useState<Bloqueio | null>(null);
  const [aba, setAba] = useState<"incidentes" | "bloqueios" | "historico">("incidentes");
  const d = q.data;

  const desbloquear = useMutation({
    mutationFn: async (id: string) => { const r = await rpc("admin_desbloquear", { _id: id }); if (r.error) throw new Error("Não foi possível desbloquear."); },
    onSuccess: () => { toast.success("Bloqueio removido. Pode levar alguns segundos para valer em todos os servidores."); qc.invalidateQueries({ queryKey: ["admin-seguranca-painel"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const bloqueiosFiltrados = useMemo(() => d?.bloqueios ?? [], [d]);
  const cards = [
    { icon: ShieldAlert, label: "Tentativas suspeitas", v: d?.totais.suspeitas },
    { icon: Ban, label: "Acessos negados", v: d?.totais.negados },
    { icon: Globe, label: "IPs bloqueados", v: d?.totais.ips },
    { icon: Fingerprint, label: "Dispositivos bloqueados", v: d?.totais.dispositivos },
    { icon: UserX, label: "Contas bloqueadas", v: d?.totais.contas },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {cards.map(({ icon: I, label, v }) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">{label}<I className="size-4 text-primary" /></div>
            <p className="mt-2 font-display text-2xl font-bold">{v ?? "…"}</p>
          </div>
        ))}
      </div>

      <form className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-3 lg:grid-cols-7" onSubmit={(e) => { e.preventDefault(); setAplicado(f); }}>
        <div className="space-y-1"><Label className="text-xs">De</Label><Input type="date" value={f.desde} onChange={(e) => setF({ ...f, desde: e.target.value })} /></div>
        <div className="space-y-1"><Label className="text-xs">Até</Label><Input type="date" value={f.ate} onChange={(e) => setF({ ...f, ate: e.target.value })} /></div>
        <div className="space-y-1"><Label className="text-xs">IP</Label><Input placeholder="Ex.: 189.4" value={f.ip} maxLength={80} onChange={(e) => setF({ ...f, ip: e.target.value })} /></div>
        <div className="space-y-1"><Label className="text-xs">Dispositivo</Label><Input placeholder="Identificador" value={f.dispositivo} maxLength={80} onChange={(e) => setF({ ...f, dispositivo: e.target.value })} /></div>
        <div className="space-y-1"><Label className="text-xs">Tipo</Label>
          <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
            <option value="">Todos</option>{(d?.tipos ?? []).map((t) => <option key={t} value={t}>{tipoLabel(t)}</option>)}
          </select></div>
        <div className="space-y-1"><Label className="text-xs">Status</Label>
          <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
            <option value="">Todos</option><option value="bloqueou">Gerou bloqueio</option><option value="registrado">Só registrado</option>
            <option value="ativo">Bloqueio ativo</option><option value="expirado">Bloqueio expirado</option><option value="removido">Bloqueio removido</option>
          </select></div>
        <div className="flex items-end gap-2"><Button type="submit" className="flex-1">Filtrar</Button><Button type="button" variant="ghost" onClick={() => { setF(VAZIO); setAplicado(VAZIO); }}>Limpar</Button></div>
      </form>

      <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
        {([["incidentes", "Ocorrências", ShieldAlert], ["bloqueios", "IPs, dispositivos e contas", Ban], ["historico", "Histórico da manutenção", History]] as const).map(([k, l, I]) => (
          <button key={k} type="button" onClick={() => setAba(k)} className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${aba === k ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}><I className="size-4" /><span className="hidden sm:inline">{l}</span></button>
        ))}
      </div>

      {q.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {q.error && <p className="text-sm text-destructive">{(q.error as Error).message}</p>}

      {d && aba === "incidentes" && (
        <Tabela vazio="Nenhuma ocorrência no período." cab={["Data e hora", "Tipo", "Motivo", "IP", "Dispositivo", "Status", ""]}
          linhas={d.incidentes.map((i) => [dt(i.criado_em), tipoLabel(i.tipo), <span className="line-clamp-2 max-w-xs">{i.motivo}</span>, i.ip ?? "—", <code className="text-xs">{i.dispositivo?.slice(0, 13) || "—"}</code>,
            i.bloqueou ? <Pill c="destructive">Bloqueou</Pill> : <Pill>Registrado</Pill>,
            <Button size="sm" variant="ghost" onClick={() => setDetalhe(i)}><Eye /> Detalhes</Button>])} />
      )}
      {d && aba === "bloqueios" && (
        <Tabela vazio="Nenhum bloqueio registrado." cab={["Tipo", "Valor", "Motivo", "Bloqueado em", "Expira", "Tentativas", "Status", ""]}
          linhas={bloqueiosFiltrados.map((b) => [b.tipo === "ip" ? "IP" : b.tipo === "dispositivo" ? "Dispositivo" : "Conta", <code className="text-xs">{b.email ?? b.valor}</code>, <span className="line-clamp-2 max-w-xs">{b.motivo}</span>, dt(b.criado_em), b.expira_em ? dt(b.expira_em) : "Até remover", b.tentativas,
            b.situacao === "ativo" ? <Pill c="destructive">Ativo</Pill> : <Pill>{b.situacao === "expirado" ? "Expirado" : `Removido ${dt(b.removido_em)}`}</Pill>,
            b.situacao === "ativo" ? <Button size="sm" variant="outline" onClick={() => setRemover(b)}><Unlock /> Desbloquear</Button> : null])} />
      )}
      {d && aba === "historico" && (
        <Tabela vazio="Nenhuma alteração registrada." cab={["Data e hora", "Administrador", "De", "Para", "Áreas", "IP"]}
          linhas={d.historico.map((h) => [dt(h.criado_em), h.email ?? "—", h.status_anterior ? STATUS[h.status_anterior as Status]?.label ?? h.status_anterior : "—", STATUS[h.status_novo as Status]?.label ?? h.status_novo,
            (h.detalhes.modulos ?? []).map((m) => MODULOS_MANUTENCAO.find((x) => x.k === m)?.label ?? m).join(", ") || "—", h.ip ?? "—"])} />
      )}

      <Dialog open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{detalhe && tipoLabel(detalhe.tipo)}</DialogTitle><DialogDescription>{detalhe && dt(detalhe.criado_em)}</DialogDescription></DialogHeader>
          {detalhe && (
            <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-2 text-sm">
              {([["Motivo", detalhe.motivo], ["Gravidade", detalhe.severidade], ["IP", detalhe.ip], ["Dispositivo", detalhe.dispositivo], ["Conta", detalhe.email ?? detalhe.user_id], ["Endereço", detalhe.caminho], ["Método", detalhe.metodo], ["Navegador", detalhe.agente], ["Bloqueio", detalhe.bloqueou ? "Sim" : "Não"]] as const).map(([k, v]) => (
                <><dt key={k} className="text-muted-foreground">{k}</dt><dd className="break-all">{v || "—"}</dd></>
              ))}
              <dt className="text-muted-foreground">Detalhes</dt><dd><pre className="max-h-40 overflow-auto rounded bg-muted p-2 text-xs">{JSON.stringify(detalhe.detalhes, null, 2)}</pre></dd>
            </dl>
          )}
          <p className="text-xs text-muted-foreground">Um IP pode ser compartilhado por várias pessoas. Revise antes de manter um bloqueio.</p>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!remover} onOpenChange={(o) => !o && setRemover(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Remover este bloqueio?</AlertDialogTitle><AlertDialogDescription>{remover?.email ?? remover?.valor} voltará a ter acesso.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => { if (remover) desbloquear.mutate(remover.id); setRemover(null); }}>Desbloquear</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Pill({ children, c }: { children: React.ReactNode; c?: "destructive" }) {
  return <span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-xs ${c ? "border-destructive/30 bg-destructive/15 text-destructive" : "border-border bg-muted text-muted-foreground"}`}>{children}</span>;
}

function Tabela({ cab, linhas, vazio }: { cab: string[]; linhas: React.ReactNode[][]; vazio: string }) {
  if (!linhas.length) return <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{vazio}</p>;
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground"><tr>{cab.map((c, i) => <th key={i} className="whitespace-nowrap px-3 py-2.5">{c}</th>)}</tr></thead>
        <tbody>{linhas.map((l, i) => <tr key={i} className="border-t border-border hover:bg-muted/20">{l.map((c, j) => <td key={j} className="px-3 py-2 align-top">{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

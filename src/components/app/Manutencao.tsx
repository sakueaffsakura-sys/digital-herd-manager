import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Hammer, LogOut, RefreshCw, ShieldCheck, ShieldX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export type EstadoManutencao = {
  status: "ativo" | "manutencao" | "bloqueado";
  titulo: string; mensagem: string; modulos: string[]; atualizado_em: string;
  sou_admin: boolean; conta_bloqueada: boolean;
};

export const MODULOS_MANUTENCAO: { k: string; label: string }[] = [
  { k: "todos", label: "Sistema inteiro" }, { k: "inicio", label: "Início" }, { k: "rebanho", label: "Meu Rebanho" },
  { k: "bezerros", label: "Evolução dos Bezerros" }, { k: "vacinacao", label: "Vacinação" }, { k: "inseminacao", label: "Inseminação" },
  { k: "nascimentos", label: "Nascimentos" }, { k: "lotes", label: "Lotes" }, { k: "producao", label: "Produção de Leite" },
  { k: "relatorios", label: "Relatórios" }, { k: "financeiro", label: "Lucros e Investimentos" }, { k: "comercial", label: "Compra e Venda" },
  { k: "diagnostico", label: "Diagnóstico" }, { k: "perfil", label: "Perfil" }, { k: "importacao", label: "Importações" },
  { k: "yui", label: "Assistente Yui" }, { k: "api", label: "Aplicativo / API externa" },
];

export async function lerEstadoManutencao(): Promise<EstadoManutencao | null> {
  const r = await (supabase.rpc as unknown as (f: string) => Promise<{ data: unknown; error: unknown }>)("estado_manutencao");
  if (r.error) return null;
  return r.data as EstadoManutencao;
}

export function useEstadoManutencao(inicial?: EstadoManutencao | null) {
  return useQuery({ queryKey: ["estado-manutencao"], queryFn: lerEstadoManutencao, initialData: inicial ?? undefined, refetchInterval: 15_000, refetchOnWindowFocus: true });
}

/** Decide se a seção atual fica bloqueada para este usuário (o banco aplica a mesma regra nos dados). */
export function secaoBloqueada(e: EstadoManutencao | null | undefined, secao: string | null): boolean {
  if (!e || e.sou_admin) return false;
  if (e.conta_bloqueada) return true;
  if (e.status === "ativo") return false;
  if (e.status === "bloqueado" || e.modulos.includes("todos")) return true;
  return !!secao && e.modulos.includes(secao);
}

export function dispositivoLocal(): string {
  try {
    let id = localStorage.getItem("pd_dispositivo");
    if (!id) { id = crypto.randomUUID(); localStorage.setItem("pd_dispositivo", id); }
    return id;
  } catch { return ""; }
}

export function TelaManutencao({ estado, onTentar }: { estado: EstadoManutencao; onTentar: () => void }) {
  const bloqueio = estado.conta_bloqueada || estado.status === "bloqueado";
  const titulo = estado.conta_bloqueada ? "Acesso bloqueado" : estado.titulo;
  const mensagem = estado.conta_bloqueada ? "O acesso desta conta foi bloqueado por segurança. Se acredita que é um engano, fale com o administrador." : estado.mensagem;
  const Icon = bloqueio ? ShieldX : Hammer;
  const sair = async () => { await supabase.auth.signOut(); window.location.href = "/"; };
  return (
    <main className="dark relative grid min-h-screen place-items-center overflow-hidden bg-background px-4 py-10 text-foreground">
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 size-[640px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
      <section className="relative w-full max-w-xl rounded-3xl border border-border bg-card/80 p-8 text-center shadow-2xl backdrop-blur sm:p-12">
        <span className={`mx-auto grid size-16 place-items-center rounded-2xl ${bloqueio ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"}`}>
          <Icon className="size-8" />
        </span>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {bloqueio ? "Sistema bloqueado" : "Manutenção programada"}
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{titulo}</h1>
        <p className="mx-auto mt-3 max-w-md whitespace-pre-line text-muted-foreground">{mensagem}</p>
        {!bloqueio && (
          <div className="mx-auto mt-6 h-1.5 w-40 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
          </div>
        )}
        <div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row">
          <Button onClick={onTentar}><RefreshCw /> Verificar novamente</Button>
          <Button variant="outline" asChild><Link to="/admin"><ShieldCheck /> Sou administrador</Link></Button>
          <Button variant="ghost" onClick={sair}><LogOut /> Sair</Button>
        </div>
        <p className="mt-6 text-xs text-muted-foreground">A página atualiza sozinha quando o sistema voltar.</p>
      </section>
    </main>
  );
}

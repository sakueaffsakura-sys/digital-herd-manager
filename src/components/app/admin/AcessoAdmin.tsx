import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ShieldCheck, TriangleAlert, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { plural } from "@/lib/texto";

type Estado = { nivel: string; tenho: boolean; exigir: boolean; admins: { email: string; tem_2fa: boolean; eu: boolean }[] };

/**
 * Exigir verificação em duas etapas dos administradores. Ligada, quem é administrador e entrou só com
 * a senha perde os poderes de administrador (o banco confere a cada pedido) até entrar com o código.
 */
export function AcessoAdmin() {
  const qc = useQueryClient();
  const [confirmar, setConfirmar] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const estado = useQuery({
    queryKey: ["admin-2fa"],
    queryFn: async (): Promise<Estado> => {
      const [fatores, nivel, conf, admins] = await Promise.all([
        supabase.auth.mfa.listFactors(),
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        supabase.from("configuracoes_sistema").select("valor").eq("chave", "exigir_2fa_admin").maybeSingle(),
        supabase.rpc("admin_2fa_resumo"),
      ]);
      if (admins.error) throw admins.error;
      return {
        nivel: nivel.data?.currentLevel ?? "aal1",
        tenho: (fatores.data?.all ?? []).some((f) => f.factor_type === "totp" && f.status === "verified"),
        exigir: conf.data?.valor === "sim",
        admins: admins.data ?? [],
      };
    },
  });
  const e = estado.data;
  const semCodigo = (e?.admins ?? []).filter((a) => !a.tem_2fa);
  const possoLigar = e?.nivel === "aal2";

  const mudar = async (ligar: boolean) => {
    setSalvando(true);
    const { error } = await supabase.rpc("admin_exigir_2fa", { _ligar: ligar });
    setSalvando(false);
    setConfirmar(false);
    if (error) { toast.error(error.message || "Não foi possível mudar a regra."); return; }
    toast.success(ligar ? "Pronto: administradores agora precisam do código." : "Regra desligada.");
    void qc.invalidateQueries({ queryKey: ["admin-2fa"] });
  };

  if (estado.isLoading) return <p className="text-muted-foreground">Conferindo…</p>;
  if (estado.isError || !e) return <p className="text-alerta">Não foi possível ler a situação agora.</p>;

  return (
    <div className="space-y-6">
      {!e.tenho && (
        <div role="alert" className="aviso-barra relative flex flex-wrap items-center gap-3 overflow-hidden rounded-2xl bg-aviso-fundo p-4 pl-5 text-aviso">
          <TriangleAlert className="size-6 shrink-0" />
          <p className="min-w-0 flex-1 font-bold text-foreground">Sua conta de administrador ainda entra só com a senha. Ative o código no celular.</p>
          <Button asChild className="h-11"><Link to="/app/$section" params={{ section: "seguranca" }}>Ativar duas etapas</Link></Button>
        </div>
      )}
      <section className="painel p-4 sm:p-6">
        <div className="flex flex-wrap items-start gap-4">
          <ShieldCheck className="mt-1 size-8 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <h3 className="titulo-secao">Exigir duas etapas dos administradores</h3>
            <p className="mt-1 max-w-prose text-muted-foreground">
              Ligada, o painel e os poderes de administrador só funcionam depois de digitar o código do aplicativo autenticador. Quem ainda não ativou continua usando o sistema como cliente comum até ativar.
            </p>
          </div>
          <label className="flex items-center gap-2 font-bold">
            <Switch
              checked={e.exigir}
              disabled={salvando || (!e.exigir && !possoLigar)}
              onCheckedChange={(v) => (v ? setConfirmar(true) : void mudar(false))}
            />
            {e.exigir ? "Ligada" : "Desligada"}
          </label>
        </div>
        {!e.exigir && !possoLigar && (
          <p className="mt-3 text-sm text-muted-foreground">Para ligar, ative as duas etapas na sua conta e entre de novo usando o código.</p>
        )}
      </section>
      <section className="painel p-4 sm:p-6">
        <h3 className="titulo-secao">Administradores</h3>
        <ul className="mt-3 divide-y divide-border">
          {e.admins.map((a) => (
            <li key={a.email} className="flex flex-wrap items-center gap-3 py-2.5">
              {a.tem_2fa ? <CheckCircle2 className="size-5 text-primary" aria-hidden /> : <XCircle className="size-5 text-alerta" aria-hidden />}
              <span className="min-w-0 flex-1 truncate">{a.email}{a.eu ? " (você)" : ""}</span>
              <span className={`text-sm font-bold ${a.tem_2fa ? "text-primary" : "text-alerta"}`}>{a.tem_2fa ? "Usa o código" : "Só senha"}</span>
            </li>
          ))}
        </ul>
      </section>
      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Exigir o código de todos os administradores?</AlertDialogTitle>
            <AlertDialogDescription>
              {semCodigo.length
                ? `${plural(semCodigo.length, "administrador", "administradores")} ${semCodigo.length === 1 ? "ainda entra" : "ainda entram"} só com senha (${semCodigo.map((a) => a.email).join(", ")}). ${semCodigo.length === 1 ? "Ele perde" : "Eles perdem"} o acesso ao painel até ativar as duas etapas em Senha e segurança.`
                : "Todos os administradores já usam o código. Quem entrar só com a senha não verá o painel."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-12">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="h-12" disabled={salvando} onClick={() => void mudar(true)}>Exigir o código</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

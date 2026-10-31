import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { LoaderCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lerEstadoManutencao, secaoBloqueada, TelaManutencao, useEstadoManutencao } from "@/components/app/Manutencao";

function VerificandoSessao() {
  return (
    <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
      <span className="inline-flex items-center gap-2">
        <LoaderCircle className="size-4 animate-spin" />
        Verificando sessão…
      </span>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  pendingComponent: VerificandoSessao,
  beforeLoad: async ({ location }) => {
    const cached = await supabase.auth.getSession();
    let user = cached.data.session?.user ?? null;
    if (!user) {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        const volta = encodeURIComponent(location.href);
        throw redirect({ to: "/", search: { motivo: "sessao-expirada", redirect: volta } });
      }
      user = data.user;
    }
    // Conta com verificação em duas etapas: sem o código, volta para a tela de entrar pedir o código.
    const nivel = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (nivel.data && nivel.data.nextLevel === "aal2" && nivel.data.currentLevel !== "aal2") {
      throw redirect({ to: "/", search: { motivo: "duas-etapas" } });
    }
    const { data: perfil } = await supabase.from("profiles").select("bloqueado").eq("id", user.id).maybeSingle();
    if ((perfil as { bloqueado?: boolean } | null)?.bloqueado) {
      await supabase.auth.signOut();
      throw redirect({ to: "/", search: { motivo: "conta-bloqueada" } });
    }
    const manutencao = location.pathname === "/admin" ? null : await lerEstadoManutencao();
    return { user, manutencao };
  },
  component: AreaLogada,
});

function AreaLogada() {
  const { user, manutencao } = Route.useRouteContext();
  const pagina = useRouterState({ select: (s) => s.location.pathname });
  const estado = useEstadoManutencao(manutencao);
  const paginaRef = useRef(pagina);
  paginaRef.current = pagina;
  useEffect(() => {
    const ping = () => {
      if (document.visibilityState !== "visible") return;
      void supabase.from("presenca_usuarios").upsert({ user_id: user.id, visto_em: new Date().toISOString(), pagina: paginaRef.current }).then(({ error }) => {
        if (error) console.warn("Não foi possível atualizar a presença do usuário.");
      });
    };
    ping();
    const id = setInterval(ping, 60000);
    document.addEventListener("visibilitychange", ping);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", ping); };
  }, [user.id]);
  const secao = pagina.startsWith("/app/") ? pagina.split("/")[2] ?? null : null;
  const ehAdmin = pagina === "/admin" || pagina.startsWith("/admin/");
  if (!ehAdmin && estado.isError && !estado.data) throw estado.error;
  if (!ehAdmin && estado.data && secaoBloqueada(estado.data, secao)) {
    return <TelaManutencao estado={estado.data} onTentar={() => void estado.refetch()} />;
  }
  return <Outlet />;
}

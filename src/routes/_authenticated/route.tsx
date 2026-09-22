import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { LoaderCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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
    if (cached.data.session?.user) return { user: cached.data.session.user };
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      const volta = encodeURIComponent(`${location.pathname}${location.search}`);
      throw redirect({ to: "/", search: { motivo: "sessao-expirada", redirect: volta } });
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});

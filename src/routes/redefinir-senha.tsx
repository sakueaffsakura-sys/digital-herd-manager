import { useEffect, useState, type FormEvent } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PaginaPublica } from "@/components/publico/PaginaPublica";
import { CampoSenha, RegrasSenha } from "@/components/app/conta/CampoSenha";
import { supabase } from "@/integrations/supabase/client";
import { avaliarSenha, motivoSenhaFraca } from "@/lib/senha";

export const Route = createFileRoute("/redefinir-senha")({
  ssr: false,
  head: () => ({ meta: [{ title: "Criar senha nova | Pecuária Digital" }, { name: "robots", content: "noindex" }] }),
  component: RedefinirSenha,
});

type Estado = "conferindo" | "pronto" | "invalido";

function RedefinirSenha() {
  const navigate = useNavigate();
  const [estado, setEstado] = useState<Estado>("conferindo");
  const [email, setEmail] = useState("");
  const [nova, setNova] = useState("");
  const [confirma, setConfirma] = useState("");
  const [codigo, setCodigo] = useState("");
  const [precisaCodigo, setPrecisaCodigo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    // Link vencido ou já usado: o Auth volta com o erro no endereço.
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const busca = new URLSearchParams(window.location.search);
    if (hash.get("error_code") || hash.get("error") || busca.get("error_code")) { setEstado("invalido"); return; }
    let feito = false;
    const pronto = (mail?: string | null) => { if (feito) return; feito = true; setEmail(mail ?? ""); setEstado("pronto"); };
    const { data: sub } = supabase.auth.onAuthStateChange((evento, sessao) => {
      if ((evento === "PASSWORD_RECOVERY" || evento === "SIGNED_IN") && sessao) pronto(sessao.user.email);
    });
    // Links com "?code=" (fluxo PKCE) trocam o código pela sessão aqui.
    const code = busca.get("code");
    const trocar = code ? supabase.auth.exchangeCodeForSession(code).then(({ data, error }) => { if (!error && data.session) pronto(data.session.user.email); }) : Promise.resolve();
    void trocar.then(() =>
      supabase.auth.getSession().then(({ data }) => {
        if (data.session && /type=recovery|access_token/.test(window.location.hash + window.location.search + (code ? "code" : ""))) pronto(data.session.user.email);
      }),
    );
    const limite = setTimeout(() => { if (!feito) setEstado("invalido"); }, 6000);
    return () => { sub.subscription.unsubscribe(); clearTimeout(limite); };
  }, []);

  const salvar = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    const fraca = motivoSenhaFraca(nova, email);
    if (fraca) { setErro(fraca); return; }
    if (nova !== confirma) { setErro("A confirmação não é igual à senha nova."); return; }
    setSalvando(true);
    try {
      if (precisaCodigo) {
        const { data } = await supabase.auth.mfa.listFactors();
        const fator = data?.totp?.find((f) => f.status === "verified");
        if (fator) {
          const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: fator.id, code: codigo.replace(/\D/g, "") });
          if (error) { setErro("Código errado ou vencido. Digite o código que aparece agora no aplicativo."); return; }
        }
      }
      const { error } = await supabase.auth.updateUser({ password: nova });
      if (error) {
        if (/aal2|insufficient_aal|mfa/i.test(error.message)) { setPrecisaCodigo(true); setErro("Esta conta usa verificação em duas etapas: digite o código do aplicativo."); return; }
        if (/same|different/i.test(error.message)) { setErro("A senha nova precisa ser diferente da anterior."); return; }
        if (/pwned|breach|leaked|weak/i.test(error.message)) { setErro("Essa senha apareceu em vazamentos de dados. Escolha outra."); return; }
        if (/session|expired|jwt/i.test(error.message)) { setEstado("invalido"); return; }
        setErro("Não foi possível salvar a senha agora. Tente de novo.");
        return;
      }
      await supabase.auth.signOut({ scope: "others" }).catch(() => {});
      await supabase.auth.signOut().catch(() => {});
      navigate({ to: "/", search: { motivo: "senha-alterada" }, replace: true });
    } finally {
      setSalvando(false);
    }
  };

  if (estado === "conferindo") {
    return (
      <PaginaPublica titulo="Criar senha nova" largura="formulario">
        <p className="flex items-center gap-2 text-muted-foreground"><LoaderCircle className="size-5 animate-spin" />Conferindo o link…</p>
      </PaginaPublica>
    );
  }
  if (estado === "invalido") {
    return (
      <PaginaPublica titulo="Este link não vale mais" subtitulo="O link de senha nova vence em pouco tempo e só pode ser usado uma vez." largura="formulario">
        <div className="flex flex-wrap gap-2">
          <Button asChild className="h-12"><Link to="/recuperar-senha">Pedir outro link</Link></Button>
          <Button asChild variant="outline" className="h-12"><Link to="/">Voltar para entrar</Link></Button>
        </div>
      </PaginaPublica>
    );
  }
  return (
    <PaginaPublica titulo="Criar senha nova" subtitulo={email ? `Para a conta ${email}.` : undefined} largura="formulario">
      <form onSubmit={salvar} noValidate className="space-y-4">
        <input type="email" autoComplete="username" value={email} readOnly hidden />
        <div>
          <CampoSenha rotulo="Senha nova" valor={nova} aoMudar={setNova} autoComplete="new-password" autoFocus />
          <RegrasSenha senha={nova} email={email} />
        </div>
        <CampoSenha rotulo="Repita a senha nova" valor={confirma} aoMudar={setConfirma} autoComplete="new-password" />
        {precisaCodigo && (
          <div>
            <Label htmlFor="codigo">Código do aplicativo autenticador</Label>
            <Input id="codigo" inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={codigo} onChange={(e) => setCodigo(e.target.value)} className="max-w-48 text-center font-display text-2xl tracking-[0.3em]" />
          </div>
        )}
        {erro && <p role="alert" className="font-bold text-alerta">{erro}</p>}
        <Button type="submit" className="h-12 w-full text-base" disabled={salvando || !avaliarSenha(nova, email).ok || !confirma}>{salvando ? <LoaderCircle className="animate-spin" /> : "Salvar a senha nova"}</Button>
        <p className="text-sm text-muted-foreground">Depois de salvar, todos os aparelhos saem da conta e você entra de novo com a senha nova.</p>
      </form>
    </PaginaPublica>
  );
}

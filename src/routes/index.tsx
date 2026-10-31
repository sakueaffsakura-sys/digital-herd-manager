import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { avaliarSenha, motivoSenhaFraca } from "@/lib/senha";
import { CampoSenha, RegrasSenha } from "@/components/app/conta/CampoSenha";
import { BrincoIlustrado } from "@/components/app/conta/BrincoIlustrado";
import marcaBranca from "@/assets/marca/marca-branca.webp";

export const Route = createFileRoute("/")({
  validateSearch: z.object({
    motivo: z.string().optional(),
    redirect: z.string().optional(),
  }),
  head: () => ({
    meta: [
      { title: "Pecuária Digital | Sua fazenda, anotada" },
      { name: "description", content: "Rebanho, vacinas, reprodução, leite e dinheiro da fazenda num lugar só. No computador e no celular, com aplicativo que funciona sem internet." },
      { property: "og:title", content: "Pecuária Digital" },
      { property: "og:description", content: "Sua fazenda, anotada: rebanho, vacinas, leite e dinheiro num lugar só." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Entrar,
});

const MENSAGENS: Record<string, { tipo: "info" | "erro" | "ok"; texto: string }> = {
  "sessao-expirada": { tipo: "info", texto: "Sua sessão terminou. Entre de novo." },
  "conta-bloqueada": { tipo: "erro", texto: "Esta conta foi bloqueada pelo administrador." },
  "senha-alterada": { tipo: "ok", texto: "Senha alterada. Entre com a senha nova." },
  "saiu-de-todos": { tipo: "ok", texto: "Você saiu de todos os aparelhos." },
  "duas-etapas": { tipo: "info", texto: "Falta o código do aplicativo autenticador para entrar." },
};

/** Só aceita voltar para páginas deste site (nada de redirecionar para fora). */
function destinoSeguro(redirect?: string) {
  if (!redirect) return null;
  try {
    const u = new URL(decodeURIComponent(redirect), window.location.origin);
    if (u.origin !== window.location.origin || !u.pathname.startsWith("/")) return null;
    return u.pathname + u.search + u.hash;
  } catch {
    return null;
  }
}

function traduzir(m: string) {
  if (/invalid login|invalid credentials/i.test(m)) return "E-mail ou senha errados.";
  if (/email not confirmed/i.test(m)) return "Confirme o seu e-mail antes de entrar. Procure a mensagem na caixa de entrada e no spam.";
  if (/rate limit|too many/i.test(m)) return "Muitas tentativas. Aguarde alguns minutos.";
  if (/banned|bloquead/i.test(m)) return "Esta conta está bloqueada.";
  return "Não foi possível entrar agora. Tente de novo.";
}

function Entrar() {
  const navigate = useNavigate();
  const { motivo, redirect } = Route.useSearch();
  const [aba, setAba] = useState<"entrar" | "criar">("entrar");
  const [etapa, setEtapa] = useState<"senha" | "codigo">("senha");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [codigo, setCodigo] = useState("");
  const [site, setSite] = useState(""); // campo anti-robô (fica escondido)
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [confirmarEmail, setConfirmarEmail] = useState(false);
  const inicio = useRef(Date.now());

  const irParaApp = () => {
    const destino = destinoSeguro(redirect);
    if (destino) window.location.assign(destino);
    else navigate({ to: "/app/$section", params: { section: "inicio" } });
  };
  /** Depois da senha: se a conta usa duas etapas, pede o código; senão, entra. */
  const continuar = async () => {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (data && data.nextLevel === "aal2" && data.currentLevel !== "aal2") { setEtapa("codigo"); setErro(null); return; }
    irParaApp();
  };

  useEffect(() => {
    const m = motivo ? MENSAGENS[motivo] : undefined;
    if (m) (m.tipo === "erro" ? toast.error : m.tipo === "ok" ? toast.success : toast.info)(m.texto);
  }, [motivo]);
  useEffect(() => {
    if (motivo === "conta-bloqueada") return;
    void supabase.auth.getSession().then(({ data }) => { if (data.session) void continuar(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enviarSenha = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      if (aba === "criar") {
        const fraca = motivoSenhaFraca(senha, email);
        if (fraca) { setErro(fraca); return; }
        const r = await fetch("/api/public/conta/cadastro", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ nome, email, senha, site, inicio: inicio.current }),
        });
        const corpo = (await r.json().catch(() => ({}))) as { erro?: string; confirmar?: boolean; sessao?: { access_token: string; refresh_token: string } };
        if (!r.ok) { setErro(corpo.erro ?? "Não foi possível criar a conta agora."); return; }
        if (corpo.confirmar) { setConfirmarEmail(true); return; }
        if (corpo.sessao) {
          const { error } = await supabase.auth.setSession(corpo.sessao);
          if (error) { setErro("Conta criada. Entre com o e-mail e a senha."); setAba("entrar"); return; }
          toast.success("Conta criada. Bem-vindo(a)!");
          irParaApp();
        }
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
      if (error) { setErro(traduzir(error.message)); return; }
      await continuar();
    } finally {
      setCarregando(false);
    }
  };

  const enviarCodigo = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      const { data } = await supabase.auth.mfa.listFactors();
      const fator = data?.totp?.find((f) => f.status === "verified");
      if (!fator) { irParaApp(); return; }
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: fator.id, code: codigo.replace(/\D/g, "") });
      if (error) { setErro("Código errado ou vencido. Digite o código que aparece agora no aplicativo."); return; }
      irParaApp();
    } finally {
      setCarregando(false);
    }
  };

  const google = async () => {
    setErro(null);
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r && "error" in r && r.error) setErro("Entrar com Google não está disponível agora. Use o e-mail e a senha.");
  };
  const sairDaConta = async () => { await supabase.auth.signOut(); setEtapa("senha"); setCodigo(""); };

  return (
    <main className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="relative overflow-hidden bg-curral px-6 pb-8 pt-6 text-white lg:flex lg:min-h-screen lg:flex-col lg:px-14 lg:py-12">
        <div className="flex items-center gap-2.5">
          <img src={marcaBranca} alt="" width={44} height={44} className="size-11 object-contain" />
          <span className="font-display text-[1.7rem] font-extrabold leading-none">Pecuária Digital</span>
        </div>
        <div className="mt-6 flex items-end gap-5 lg:mt-auto lg:block">
          <BrincoIlustrado className="h-28 w-auto shrink-0 -rotate-6 lg:h-[min(44vh,380px)] lg:-rotate-3" />
          <div className="lg:mt-10">
            <h1 className="font-display text-[2.6rem] font-extrabold leading-[0.95] lg:text-[clamp(3.5rem,6vw,5.5rem)]">Sua fazenda, anotada.</h1>
            <p className="mt-3 hidden max-w-md text-lg text-white/85 sm:block">Rebanho, vacinas, reprodução, leite e dinheiro num lugar só. No computador e no celular, com aplicativo que funciona sem internet.</p>
          </div>
        </div>
      </section>

      <section className="flex items-center justify-center px-5 py-8 sm:px-8 lg:min-h-screen lg:py-12">
        <div className="w-full max-w-md">
          {confirmarEmail ? (
            <div>
              <h2 className="titulo-pagina">Confirme o seu e-mail</h2>
              <p className="mt-3 text-muted-foreground">Enviamos um link para <strong className="text-foreground">{email}</strong>. Abra o e-mail e toque no link para ativar a conta. Confira também o spam.</p>
              <Button variant="outline" className="mt-6 h-12" onClick={() => { setConfirmarEmail(false); setAba("entrar"); }}>Voltar para entrar</Button>
            </div>
          ) : etapa === "codigo" ? (
            <form onSubmit={enviarCodigo} noValidate>
              <h2 className="titulo-pagina">Código de verificação</h2>
              <p className="mt-2 text-muted-foreground">Abra o aplicativo autenticador no celular e digite o código de 6 números.</p>
              <div className="mt-6">
                <Label htmlFor="codigo">Código</Label>
                <Input id="codigo" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={7} value={codigo} onChange={(e) => setCodigo(e.target.value)} className="text-center font-display text-3xl tracking-[0.35em]" aria-invalid={erro ? true : undefined} aria-describedby={erro ? "erro-login" : undefined} />
              </div>
              {erro && <p id="erro-login" role="alert" className="mt-3 font-bold text-alerta">{erro}</p>}
              <Button type="submit" className="mt-6 h-12 w-full text-base" disabled={carregando || codigo.replace(/\D/g, "").length !== 6}>{carregando ? <LoaderCircle className="animate-spin" /> : "Confirmar e entrar"}</Button>
              <Button type="button" variant="ghost" className="mt-2 h-12 w-full" onClick={() => void sairDaConta()}>Entrar com outra conta</Button>
            </form>
          ) : (
            <>
              <div role="tablist" aria-label="Entrar ou criar conta" className="grid grid-cols-2 rounded-[10px] border border-input bg-card p-1">
                {(["entrar", "criar"] as const).map((a) => (
                  <button key={a} type="button" role="tab" aria-selected={aba === a} onClick={() => { setAba(a); setErro(null); }}
                    className={`h-11 rounded-lg font-bold ${aba === a ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                    {a === "entrar" ? "Entrar" : "Criar conta"}
                  </button>
                ))}
              </div>
              <h2 className="titulo-pagina mt-8">{aba === "entrar" ? "Entre na sua conta" : "Crie sua conta grátis"}</h2>
              <p className="mt-2 text-muted-foreground">{aba === "entrar" ? "Use o e-mail e a senha do cadastro." : "Leva um minuto. Depois é só cadastrar a fazenda."}</p>
              <form onSubmit={enviarSenha} className="mt-6 space-y-4" noValidate>
                {aba === "criar" && (
                  <div>
                    <Label htmlFor="nome">Seu nome</Label>
                    <Input id="nome" autoComplete="name" required maxLength={120} value={nome} onChange={(e) => setNome(e.target.value)} />
                  </div>
                )}
                <div>
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" type="email" inputMode="email" autoComplete="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@exemplo.com" />
                </div>
                <div>
                  <CampoSenha rotulo="Senha" valor={senha} aoMudar={setSenha} autoComplete={aba === "entrar" ? "current-password" : "new-password"} />
                  {aba === "criar" && <RegrasSenha senha={senha} email={email} />}
                </div>
                {/* Campo para robôs: pessoas não veem nem alcançam pelo teclado. */}
                <div aria-hidden="true" className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden">
                  <label htmlFor="site">Seu site</label>
                  <input id="site" name="site" tabIndex={-1} autoComplete="off" value={site} onChange={(e) => setSite(e.target.value)} />
                </div>
                {erro && <p role="alert" className="font-bold text-alerta">{erro}</p>}
                <Button type="submit" className="h-12 w-full text-base" disabled={carregando || !email || !senha || (aba === "criar" && (!nome.trim() || !avaliarSenha(senha, email).ok))}>
                  {carregando ? <LoaderCircle className="animate-spin" /> : aba === "entrar" ? "Entrar" : "Criar conta"}
                </Button>
              </form>
              {aba === "entrar" && (
                <p className="mt-4 text-center">
                  <Link to="/recuperar-senha" className="font-bold text-primary underline underline-offset-4">Esqueci minha senha</Link>
                </p>
              )}
              <div className="my-6 flex items-center gap-3 text-sm text-muted-foreground"><span className="h-px flex-1 bg-border" />ou<span className="h-px flex-1 bg-border" /></div>
              <Button type="button" variant="outline" className="h-12 w-full text-base" onClick={() => void google()}>
                <svg aria-hidden viewBox="0 0 24 24" className="size-5"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7Z" /><path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z" /><path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1Z" /><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9Z" /></svg>
                Entrar com Google
              </Button>
            </>
          )}
          <nav aria-label="Informações" className="mt-10 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
            <Link to="/privacidade" className="text-muted-foreground underline underline-offset-4 hover:text-foreground">Privacidade</Link>
            <Link to="/termos" className="text-muted-foreground underline underline-offset-4 hover:text-foreground">Termos de uso</Link>
          </nav>
        </div>
      </section>
    </main>
  );
}

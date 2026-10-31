import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Download, KeyRound, LogOut, MonitorSmartphone, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { avaliarSenha, motivoSenhaFraca } from "@/lib/senha";
import { formatarDataBR } from "@/lib/datas";
import { PageTitle, Status } from "../shared";
import { CampoSenha, RegrasSenha } from "./CampoSenha";

async function token() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/** "Chrome no Android", "Safari no iPhone", "Aplicativo Pecuária Digital"… a partir do navegador. */
export function descreverAparelho(ua: string) {
  if (!ua) return "Aparelho desconhecido";
  if (/okhttp|Dart|ApecuariaDigital|wv\)/i.test(ua) && /Android/i.test(ua)) return "Aplicativo no Android";
  const sistema = /iPhone/i.test(ua) ? "iPhone" : /iPad/i.test(ua) ? "iPad" : /Android/i.test(ua) ? "Android" : /Windows/i.test(ua) ? "Windows" : /Mac OS X|Macintosh/i.test(ua) ? "Mac" : /Linux/i.test(ua) ? "Linux" : "outro sistema";
  const nav = /Edg\//i.test(ua) ? "Edge" : /OPR\//i.test(ua) ? "Opera" : /SamsungBrowser/i.test(ua) ? "Samsung Internet" : /Firefox\//i.test(ua) ? "Firefox" : /Chrome\//i.test(ua) ? "Chrome" : /Safari\//i.test(ua) ? "Safari" : "navegador";
  return `${nav} no ${sistema}`;
}

function TrocarSenha({ email }: { email: string }) {
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirma, setConfirma] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    const fraca = motivoSenhaFraca(nova, email);
    if (fraca) { setErro(fraca); return; }
    if (nova !== confirma) { setErro("A confirmação não é igual à senha nova."); return; }
    if (nova === atual) { setErro("A senha nova precisa ser diferente da atual."); return; }
    setSalvando(true);
    try {
      const t = await token();
      const r = await fetch("/api/conta/conferir-senha", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${t}` }, body: JSON.stringify({ senha: atual }) });
      if (!r.ok) { setErro(((await r.json().catch(() => ({}))) as { erro?: string }).erro ?? "A senha atual não confere."); return; }
      const { error } = await supabase.auth.updateUser({ password: nova });
      if (error) {
        setErro(/pwned|breach|leaked|weak/i.test(error.message) ? "Essa senha apareceu em vazamentos de dados. Escolha outra." : /aal2|reauth/i.test(error.message) ? "Confirme o código das duas etapas e tente de novo." : "Não foi possível trocar a senha agora.");
        return;
      }
      await supabase.auth.signOut({ scope: "others" }).catch(() => {});
      setAtual(""); setNova(""); setConfirma("");
      toast.success("Senha trocada. Os outros aparelhos vão precisar entrar de novo.");
    } finally {
      setSalvando(false);
    }
  };
  return (
    <section className="painel p-4 sm:p-6" aria-labelledby="trocar-senha">
      <h2 id="trocar-senha" className="titulo-secao flex items-center gap-2"><KeyRound className="size-6 text-primary" />Trocar a senha</h2>
      <p className="mt-1 text-muted-foreground">Primeiro confirmamos a senha atual. Depois da troca, os outros aparelhos saem da conta.</p>
      <form onSubmit={enviar} className="mt-5 grid max-w-md gap-4">
        <input type="email" autoComplete="username" value={email} readOnly hidden />
        <CampoSenha rotulo="Senha atual" valor={atual} aoMudar={setAtual} autoComplete="current-password" />
        <div>
          <CampoSenha rotulo="Senha nova" valor={nova} aoMudar={setNova} autoComplete="new-password" />
          <RegrasSenha senha={nova} email={email} />
        </div>
        <CampoSenha rotulo="Repita a senha nova" valor={confirma} aoMudar={setConfirma} autoComplete="new-password" erro={erro} />
        <Button type="submit" className="h-12 w-full sm:w-auto" disabled={salvando || !atual || !avaliarSenha(nova, email).ok || !confirma}>{salvando ? "Trocando…" : "Trocar a senha"}</Button>
      </form>
    </section>
  );
}

type Fator = { id: string; friendly_name?: string; factor_type: string; status: string; created_at: string };

function DuasEtapas() {
  const qc = useQueryClient();
  const fatores = useQuery({
    queryKey: ["mfa-fatores"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      const nivel = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      return { totp: (data?.all ?? []).filter((f) => f.factor_type === "totp") as Fator[], nivel: nivel.data?.currentLevel ?? "aal1" };
    },
  });
  const [cadastro, setCadastro] = useState<{ id: string; qr: string; segredo: string } | null>(null);
  const [codigo, setCodigo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [desligar, setDesligar] = useState(false);
  const verificado = fatores.data?.totp.find((f) => f.status === "verified");

  const comecar = async () => {
    setOcupado(true);
    try {
      // Cadastros começados e não confirmados atrapalham um novo: apaga antes.
      for (const f of fatores.data?.totp ?? []) if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Autenticador ${new Date().toLocaleDateString("pt-BR")}` });
      if (error || !data) throw error ?? new Error("sem dados");
      setCadastro({ id: data.id, qr: data.totp.qr_code, segredo: data.totp.secret });
      setCodigo("");
    } catch {
      toast.error("Não foi possível começar agora. Tente de novo.");
    } finally {
      setOcupado(false);
    }
  };
  const confirmar = async (e: FormEvent) => {
    e.preventDefault();
    if (!cadastro) return;
    setOcupado(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: cadastro.id, code: codigo.replace(/\D/g, "") });
    setOcupado(false);
    if (error) { toast.error("Código errado ou vencido. Confira a hora do celular e digite o código novo."); return; }
    setCadastro(null);
    toast.success("Verificação em duas etapas ligada.");
    void qc.invalidateQueries({ queryKey: ["mfa-fatores"] });
  };
  const remover = async () => {
    if (!verificado) return;
    setOcupado(true);
    try {
      if (fatores.data?.nivel !== "aal2") {
        const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: verificado.id, code: codigo.replace(/\D/g, "") });
        if (error) { toast.error("Código errado. Digite o código que aparece agora no aplicativo."); return; }
      }
      const { error } = await supabase.auth.mfa.unenroll({ factorId: verificado.id });
      if (error) { toast.error("Não foi possível desligar agora."); return; }
      setDesligar(false);
      setCodigo("");
      toast.success("Verificação em duas etapas desligada.");
      void qc.invalidateQueries({ queryKey: ["mfa-fatores"] });
    } finally {
      setOcupado(false);
    }
  };

  return (
    <section className="painel p-4 sm:p-6" aria-labelledby="duas-etapas">
      <h2 id="duas-etapas" className="titulo-secao flex items-center gap-2"><ShieldCheck className="size-6 text-primary" />Verificação em duas etapas</h2>
      <p className="mt-1 max-w-2xl text-muted-foreground">Além da senha, o site pede um código de 6 números do aplicativo autenticador do celular (Google Authenticator, Microsoft Authenticator ou outro). Mesmo que alguém descubra sua senha, não entra sem o celular.</p>
      {fatores.isLoading ? (
        <p className="mt-4 text-muted-foreground">Conferindo…</p>
      ) : verificado ? (
        <div className="mt-4 space-y-3">
          <p className="flex items-center gap-2 font-bold"><Status value="ativo" />Ligada desde {formatarDataBR(verificado.created_at)}</p>
          <p className="text-sm text-muted-foreground">O aplicativo Android ainda não pede o código: com as duas etapas ligadas, use o site.</p>
          <Button variant="outline" className="h-12" onClick={() => setDesligar(true)}>Desligar a verificação em duas etapas</Button>
        </div>
      ) : cadastro ? (
        <form onSubmit={confirmar} className="mt-5 grid gap-5 sm:grid-cols-[auto_1fr]">
          <div className="rounded-xl border border-border bg-white p-3">
            <img src={cadastro.qr} alt="Código QR para o aplicativo autenticador" width={176} height={176} className="size-44" />
          </div>
          <div className="max-w-md space-y-3">
            <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
              <li>Abra o aplicativo autenticador no celular.</li>
              <li>Toque em adicionar conta e aponte a câmera para o código ao lado.</li>
              <li>Digite o código de 6 números que aparecer.</li>
            </ol>
            <p className="text-sm text-muted-foreground">Sem câmera? Digite esta chave no aplicativo: <code className="break-all rounded bg-muted px-1.5 py-0.5 font-bold text-foreground">{cadastro.segredo}</code></p>
            <div>
              <Label htmlFor="codigo-2fa">Código de 6 números</Label>
              <Input id="codigo-2fa" inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={codigo} onChange={(e) => setCodigo(e.target.value)} className="max-w-48 text-center font-display text-2xl tracking-[0.3em]" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" className="h-12" disabled={ocupado || codigo.replace(/\D/g, "").length !== 6}>Confirmar e ligar</Button>
              <Button type="button" variant="ghost" className="h-12" onClick={() => setCadastro(null)}>Cancelar</Button>
            </div>
          </div>
        </form>
      ) : (
        <Button className="mt-4 h-12" onClick={() => void comecar()} disabled={ocupado}>Ligar a verificação em duas etapas</Button>
      )}
      <AlertDialog open={desligar} onOpenChange={setDesligar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desligar as duas etapas?</AlertDialogTitle>
            <AlertDialogDescription>A conta volta a pedir só a senha. {fatores.data?.nivel !== "aal2" ? "Para confirmar, digite o código que aparece agora no aplicativo." : ""}</AlertDialogDescription>
          </AlertDialogHeader>
          {fatores.data?.nivel !== "aal2" && (
            <div>
              <Label htmlFor="codigo-desligar">Código de 6 números</Label>
              <Input id="codigo-desligar" inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={codigo} onChange={(e) => setCodigo(e.target.value)} className="max-w-48 text-center font-display text-2xl tracking-[0.3em]" />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel className="h-12">Manter ligada</AlertDialogCancel>
            <AlertDialogAction className="h-12" disabled={ocupado} onClick={(e) => { e.preventDefault(); void remover(); }}>Desligar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function Aparelhos() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [sairTodos, setSairTodos] = useState(false);
  const sessoes = useQuery({
    queryKey: ["minhas-sessoes"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("minhas_sessoes");
      if (error) throw error;
      return data ?? [];
    },
  });
  const encerrar = async (id: string) => {
    const { error } = await supabase.rpc("encerrar_sessao", { _id: id });
    if (error) toast.error("Não foi possível encerrar este aparelho.");
    else { toast.success("Aparelho desconectado. Ele perde o acesso em até 1 hora."); void qc.invalidateQueries({ queryKey: ["minhas-sessoes"] }); }
  };
  const sairDeTodos = async () => {
    await supabase.auth.signOut({ scope: "global" });
    qc.clear();
    navigate({ to: "/", search: { motivo: "saiu-de-todos" }, replace: true });
  };
  return (
    <section className="painel p-4 sm:p-6" aria-labelledby="aparelhos">
      <h2 id="aparelhos" className="titulo-secao flex items-center gap-2"><MonitorSmartphone className="size-6 text-primary" />Aparelhos conectados</h2>
      <p className="mt-1 text-muted-foreground">Onde sua conta está aberta. Não reconhece algum? Desconecte e troque a senha.</p>
      {sessoes.isLoading ? <p className="mt-4 text-muted-foreground">Carregando…</p> : sessoes.error ? <p className="mt-4 text-alerta">Não foi possível listar os aparelhos.</p> : (
        <ul className="mt-4 divide-y divide-border">
          {sessoes.data?.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-bold">{descreverAparelho(s.navegador)}{s.atual && <span className="ml-2 rounded-full bg-sucesso-fundo px-2 py-0.5 text-sm text-primary">Este aparelho</span>}</p>
                <p className="text-sm text-muted-foreground">Último uso em {new Date(s.ultimo_uso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}{s.ip ? ` · rede ${s.ip}` : ""}{s.aal === "aal2" ? " · com código" : ""}</p>
              </div>
              {!s.atual && <Button variant="outline" className="h-11" onClick={() => void encerrar(s.id)}>Desconectar</Button>}
            </li>
          ))}
        </ul>
      )}
      <Button variant="outline" className="mt-4 h-12" onClick={() => setSairTodos(true)}><LogOut />Sair de todos os aparelhos</Button>
      <AlertDialog open={sairTodos} onOpenChange={setSairTodos}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair de todos os aparelhos?</AlertDialogTitle>
            <AlertDialogDescription>A conta fecha em todos os lugares, inclusive aqui. Para voltar, entre de novo com a senha.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-12">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="h-12" onClick={() => void sairDeTodos()}>Sair de todos</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function Privacidade({ email }: { email: string }) {
  const qc = useQueryClient();
  const [baixando, setBaixando] = useState(false);
  const [pedir, setPedir] = useState(false);
  const [motivo, setMotivo] = useState("");
  const pedido = useQuery({
    queryKey: ["pedido-exclusao"],
    queryFn: async () => {
      const { data, error } = await supabase.from("solicitacoes_exclusao").select("id,status,criado_em,prazo").eq("status", "pendente").maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const baixar = async () => {
    setBaixando(true);
    try {
      const t = await token();
      const r = await fetch("/api/conta/meus-dados", { headers: { authorization: `Bearer ${t}` } });
      if (!r.ok) { toast.error(((await r.json().catch(() => ({}))) as { erro?: string }).erro ?? "Não foi possível gerar o arquivo."); return; }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = /filename="([^"]+)"/.exec(r.headers.get("content-disposition") ?? "")?.[1] ?? "meus-dados.zip";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast.success("Arquivo baixado.");
    } finally {
      setBaixando(false);
    }
  };
  const pedirExclusao = async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const { error } = await supabase.from("solicitacoes_exclusao").insert({ user_id: data.user.id, email, motivo: motivo.trim() || null });
    if (error) { toast.error(error.code === "23505" ? "Você já tem um pedido em andamento." : "Não foi possível registrar o pedido."); return; }
    setPedir(false);
    setMotivo("");
    toast.success("Pedido registrado. Vamos atender em até 15 dias.");
    void qc.invalidateQueries({ queryKey: ["pedido-exclusao"] });
  };
  const cancelarPedido = async () => {
    if (!pedido.data) return;
    const { error } = await supabase.from("solicitacoes_exclusao").delete().eq("id", pedido.data.id);
    if (error) toast.error("Não foi possível cancelar o pedido.");
    else { toast.success("Pedido cancelado."); void qc.invalidateQueries({ queryKey: ["pedido-exclusao"] }); }
  };
  return (
    <section className="painel p-4 sm:p-6" aria-labelledby="privacidade">
      <h2 id="privacidade" className="titulo-secao">Seus dados</h2>
      <p className="mt-1 max-w-2xl text-muted-foreground">
        Você pode baixar uma cópia de tudo que está guardado e pedir a exclusão da conta, como garante a LGPD. Leia a{" "}
        <a href="/privacidade" className="font-bold text-primary underline underline-offset-2">política de privacidade</a> e os{" "}
        <a href="/termos" className="font-bold text-primary underline underline-offset-2">termos de uso</a>.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" className="h-12" onClick={() => void baixar()} disabled={baixando}><Download />{baixando ? "Gerando o arquivo…" : "Baixar meus dados"}</Button>
        {pedido.data ? (
          <Button variant="outline" className="h-12" onClick={() => void cancelarPedido()}>Cancelar o pedido de exclusão</Button>
        ) : (
          <Button variant="outline" className="h-12 text-alerta hover:text-alerta" onClick={() => setPedir(true)}><Trash2 />Pedir exclusão da conta</Button>
        )}
      </div>
      {pedido.data && (
        <p className="aviso-barra mt-4 rounded-xl bg-aviso-fundo py-3 pr-3 text-aviso">
          <span className="text-foreground">Pedido de exclusão feito em {formatarDataBR(pedido.data.criado_em)}. Prazo para atender: {formatarDataBR(pedido.data.prazo)}.</span>
        </p>
      )}
      <AlertDialog open={pedir} onOpenChange={setPedir}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pedir a exclusão da conta?</AlertDialogTitle>
            <AlertDialogDescription>A conta, as propriedades em que você é dono(a) e todos os registros delas serão apagados em até 15 dias. Antes, baixe seus dados se quiser guardar uma cópia. Você pode cancelar o pedido enquanto ele não for atendido.</AlertDialogDescription>
          </AlertDialogHeader>
          <div>
            <Label htmlFor="motivo-exclusao">Motivo (opcional)</Label>
            <Textarea id="motivo-exclusao" maxLength={1000} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-12">Voltar</AlertDialogCancel>
            <AlertDialogAction className="h-12 bg-alerta text-white hover:bg-alerta/90 dark:text-[#0e1712]" onClick={() => void pedirExclusao()}>Pedir exclusão</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

export function SegurancaPage({ email }: { email: string }) {
  return (
    <div>
      <PageTitle title="Senha e segurança" description="Proteja a conta: troque a senha, ligue o código do celular e veja onde a conta está aberta." />
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <TrocarSenha email={email} />
        <DuasEtapas />
        <Aparelhos />
        <Privacidade email={email} />
      </div>
    </div>
  );
}

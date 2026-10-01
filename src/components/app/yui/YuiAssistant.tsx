import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Compass, Copy, MessageCircle, NotebookPen, PlusCircle as HerdPlus, RefreshCw, RotateCcw, Syringe, TrendingUp, Volume2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { useYuiAvatar } from "./useYuiAvatar";
import { useYuiWallpaper } from "./useYuiWallpaper";
import { YuiTour } from "./YuiTour";
import { TOPICOS_TOUR, TOUR } from "./tourSteps";
import { falar, prepararVoz } from "./voz";

const SUGESTOES = ["Como cadastro um animal?", "Como registro uma vacina?", "Como vejo o lucro do mês?", "Como faço uma anotação?"];
const BOAS_VINDAS = "yui-boas-vindas-v1";

type Etapa = "chat" | "pergunta1" | "pergunta2";

export function YuiAssistant({ section, go, abrirMenu, isAdmin }: { section: string; go: (s: string) => void; abrirMenu: (aberto: boolean) => void; isAdmin: boolean }) {
  const yuiAvatar = useYuiAvatar(isAdmin);
  const { data: wallpaperData } = useYuiWallpaper(isAdmin);
  const wallpaper = isAdmin ? wallpaperData : null;
  const [aberto, setAberto] = useState(false);
  const [etapa, setEtapa] = useState<Etapa>("chat");
  const [tour, setTour] = useState(false);
  const [modo, setModo] = useState<"completo" | "funcao">("completo");
  const [escolhendoFuncao, setEscolhendoFuncao] = useState(false);
  const [topicoId, setTopicoId] = useState(() => TOPICOS_TOUR.some((t) => t.id === section) ? section : "rebanho");
  const [convite, setConvite] = useState(false);
  const secaoRef = useRef(section);
  secaoRef.current = section;

  const transport = useMemo(() => new DefaultChatTransport({
    api: "/api/yui",
    headers: async () => {
      const { data } = await supabase.auth.getSession();
      const t = data.session?.access_token;
      return t ? { Authorization: `Bearer ${t}` } : ({} as Record<string, string>);
    },
    body: () => ({ pagina: secaoRef.current }),
  }), []);

  const { messages, sendMessage, status, stop, setMessages, error, regenerate } = useChat({
    id: "yui",
    transport,
    onError: (e) => toast.error(e.message.startsWith("{") ? (JSON.parse(e.message).error ?? "A Yui não conseguiu responder.") : e.message || "A Yui não conseguiu responder."),
  });

  const historico = useQuery({
    queryKey: ["yui-historico"],
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.from("suporte_mensagens" as never).select("mensagem_id,papel,partes,created_at").order("created_at", { ascending: false }).limit(80);
      if (error) throw error;
      return ((data ?? []) as { mensagem_id: string; papel: "user" | "assistant"; partes: UIMessage["parts"] }[]).reverse().map((r) => ({ id: r.mensagem_id, role: r.papel, parts: r.partes }) as UIMessage);
    },
  });
  const carregado = useRef(false);
  useEffect(() => {
    if (carregado.current || !historico.data) return;
    carregado.current = true;
    if (historico.data.length) setMessages(historico.data);
  }, [historico.data, setMessages]);

  // Convite automático na primeira visita (1ª pergunta do tour).
  useEffect(() => {
    if (localStorage.getItem(BOAS_VINDAS)) return;
    const t = setTimeout(() => setConvite(true), 2500);
    return () => clearTimeout(t);
  }, []);
  const fecharConvite = () => { setConvite(false); localStorage.setItem(BOAS_VINDAS, "1"); };

  const topico = TOPICOS_TOUR.find((t) => t.id === topicoId) ?? TOPICOS_TOUR[0];
  const passosTour = modo === "funcao" ? topico.passos : TOUR;

  // Enquanto a pessoa confirma o tour, já prepara a voz das primeiras falas (sem espera no início).
  useEffect(() => {
    if (etapa === "chat") return;
    passosTour.slice(0, 2).forEach((p) => prepararVoz(p.fala));
  }, [etapa, passosTour]);

  const ocupado = status === "submitted" || status === "streaming";
  const enviar = (texto: string) => {
    const t = texto.trim();
    if (!t || ocupado) return;
    if (/\b(tour|passeio|me mostra|demonstra)/i.test(t) && !/\b(s[oó]|apenas|uma|um|espec[ií]fic)/i.test(t)) { setModo("completo"); setEtapa("pergunta1"); }
    void sendMessage({ text: t });
  };

  const limpar = async () => {
    if (!confirm("Apagar toda a conversa com a Yui?")) return;
    stop();
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user.id;
    if (uid) {
      const r = await supabase.from("suporte_mensagens" as never).delete().eq("user_id", uid);
      if (r.error) { toast.error("Não foi possível apagar a conversa."); return; }
    }
    setMessages([]);
    toast.success("Conversa apagada.");
  };

  const iniciarTour = () => { setEtapa("chat"); setAberto(false); setConvite(false); setEscolhendoFuncao(false); localStorage.setItem(BOAS_VINDAS, "1"); setTour(true); };
  const demonstrarAnotacao = () => { setTopicoId("producao"); setModo("funcao"); setEtapa("pergunta1"); setEscolhendoFuncao(false); };

  return <>
    {tour && <YuiTour passos={passosTour} go={go} abrirMenu={abrirMenu} isAdmin={isAdmin} onSair={() => { setTour(false); setAberto(true); }} />}

    {convite && !aberto && !tour && (
      <div className="fixed bottom-24 right-4 z-40 w-[min(320px,calc(100vw-32px))] animate-in fade-in slide-in-from-bottom-4 rounded-2xl border border-primary/40 bg-popover p-4 shadow-2xl sm:right-6">
        <Button type="button" size="icon-sm" variant="ghost" onClick={fecharConvite} className="absolute right-2 top-2" aria-label="Fechar"><X className="size-4" /></Button>
        <div className="flex gap-3"><img src={yuiAvatar} alt="" width={40} height={40} className="size-10 rounded-full bg-primary/10 object-cover" /><div><p className="text-sm font-semibold">Oi! Eu sou a Yui 👋</p><p className="mt-1 text-sm text-muted-foreground">Quer que eu entre no modo automático e te mostre o site funcionando, passo a passo e com voz?</p></div></div>
        <div className="mt-3 flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={fecharConvite}>Agora não</Button><Button size="sm" onClick={() => { setConvite(false); localStorage.setItem(BOAS_VINDAS, "1"); setEtapa("pergunta2"); setAberto(true); }}>Quero sim</Button></div>
      </div>
    )}

    {!tour && (
      <Button type="button" data-tour="yui" onClick={() => { setAberto((a) => !a); setConvite(false); }} aria-label={aberto ? "Fechar suporte da Yui" : "Abrir suporte da Yui"}
        className="group fixed bottom-4 right-4 z-40 grid size-16 place-items-center rounded-full border-2 border-primary bg-card shadow-[0_8px_30px_-6px_color-mix(in_oklab,var(--primary)_55%,transparent)] transition-transform hover:scale-105 sm:bottom-6 sm:right-6">
        <img src={yuiAvatar} alt="" width={64} height={64} className="size-full rounded-full object-cover" />
        <span className="absolute -top-1 right-0 rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">Ajuda</span>
      </Button>
    )}
    {tour && <span data-tour="yui" className="fixed bottom-6 right-6 z-40 grid size-16 place-items-center rounded-full border-2 border-primary bg-card"><img src={yuiAvatar} alt="" width={64} height={64} className="size-full rounded-full object-cover" /></span>}

    {aberto && !tour && (
      <section aria-label="Suporte da Yui" className="fixed inset-0 z-50 flex flex-col overflow-hidden border-border bg-background shadow-2xl animate-in fade-in slide-in-from-bottom-6 sm:inset-auto sm:bottom-24 sm:right-6 sm:h-[min(680px,calc(100vh-120px))] sm:w-[430px] sm:rounded-lg sm:border">
        {wallpaper && <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          {wallpaper.video ? <video src={wallpaper.url} autoPlay muted loop playsInline className="size-full object-cover" /> : <img src={wallpaper.url} alt="" className="size-full object-cover" />}
          <div className="absolute inset-0 bg-background/55" />
        </div>}
        <header className="relative z-10 flex items-center gap-3 border-b border-primary/30 bg-gradient-to-r from-primary/20 via-card/80 to-card/80 px-4 py-3 backdrop-blur">
          <div className="relative"><img src={yuiAvatar} alt="Yui" width={44} height={44} className="size-11 rounded-full border-2 border-primary/70 bg-primary/10 object-cover" /><span className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-card bg-primary" /></div>
          <div className="min-w-0 flex-1"><p className="font-semibold leading-tight">Yui</p><p className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="size-1.5 animate-pulse rounded-full bg-primary" />{status === "streaming" || status === "submitted" ? "Digitando…" : "Online · assistente do sistema"}</p></div>
          <Button size="icon" variant="ghost" onClick={limpar} aria-label="Apagar conversa" title="Apagar conversa"><RotateCcw /></Button>
          <Button size="icon" variant="ghost" onClick={() => setAberto(false)} aria-label="Fechar"><X /></Button>
        </header>
        <div className="relative z-10 border-b border-border bg-card/60 px-3 py-2.5 backdrop-blur">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => { setModo("funcao"); setEtapa("chat"); setEscolhendoFuncao((v) => !v); }} aria-expanded={escolhendoFuncao}
              className={`flex items-center gap-2 rounded-xl border p-2 text-left transition ${escolhendoFuncao ? "border-primary bg-primary/15" : "border-border bg-background/60 hover:border-primary/60"}`}>
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary"><BookOpen className="size-4" /></span>
              <span className="min-w-0"><span className="block text-xs font-semibold">Uma função</span><span className="block truncate text-[11px] text-muted-foreground">Aprender só uma área</span></span>
            </button>
            <button type="button" onClick={() => { setModo("completo"); setEscolhendoFuncao(false); setEtapa("pergunta1"); }}
              className="flex items-center gap-2 rounded-xl border border-border bg-background/60 p-2 text-left transition hover:border-primary/60">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary"><Compass className="size-4" /></span>
              <span className="min-w-0"><span className="block text-xs font-semibold">Tour completo</span><span className="block truncate text-[11px] text-muted-foreground">Ver o sistema todo</span></span>
            </button>
          </div>
          {!escolhendoFuncao && <Button type="button" size="sm" variant="ghost" className="mt-2 h-8 w-full justify-start gap-2 border border-border bg-background/40 px-3 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground" onClick={demonstrarAnotacao}><NotebookPen className="size-4 text-primary" />Simular uma anotação<span className="ml-auto text-[10px]">Sem salvar dados</span></Button>}
          {escolhendoFuncao && <div className="mt-2.5 animate-in fade-in slide-in-from-top-1">
            <p className="mb-1.5 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">O que você quer aprender?</p>
            <div className="grid max-h-48 grid-cols-3 gap-1.5 overflow-y-auto pr-0.5">
              {TOPICOS_TOUR.map((t) => {
                const ativo = t.id === topicoId;
                return <button key={t.id} type="button" onClick={() => setTopicoId(t.id)} aria-pressed={ativo}
                  className={`flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-center text-[11px] leading-tight transition ${ativo ? "border-primary bg-primary/15 text-foreground" : "border-border bg-background/60 text-muted-foreground hover:border-primary/50 hover:text-foreground"}`}>
                  <span className="font-medium">{t.nome}</span>
                  <span className="text-[10px] opacity-70">{t.passos.length} passo{t.passos.length === 1 ? "" : "s"}</span>
                </button>;
              })}
            </div>
            <Button size="sm" className="mt-2 w-full" onClick={() => { setModo("funcao"); setEtapa("pergunta1"); setEscolhendoFuncao(false); }}><BookOpen />Aprender {topico.nome}</Button>
          </div>}
        </div>

        <div className="relative z-10 flex min-h-0 flex-1 overflow-hidden">
        <Conversation className="relative z-10 flex-1">
          <ConversationContent className="gap-5 px-4 py-4">
            {messages.length === 0 && etapa === "chat" && (
              <div className="py-6 text-center">
                <div className="relative mx-auto size-24">
                  <span className="absolute inset-0 animate-ping rounded-full bg-primary/20 [animation-duration:2.5s]" />
                  <span className="absolute -inset-2 rounded-full border border-primary/30" />
                  <img src={yuiAvatar} alt="" width={96} height={96} className="relative size-24 rounded-full border-2 border-primary/60 bg-primary/10 object-cover shadow-[0_0_30px_-6px_var(--primary)]" />
                </div>
                <p className="mt-4 bg-gradient-to-r from-primary to-chart-2 bg-clip-text text-lg font-bold text-transparent">Oi! Como posso te ajudar?</p>
                <p className="mx-auto mt-1 max-w-[280px] text-sm text-muted-foreground">Pergunte qualquer coisa sobre o sistema. Eu explico passo a passo.</p>
                <div className="mt-5 grid grid-cols-2 gap-2 text-left">
                  {SUGESTOES.map((s, i) => {
                    const Icone = [HerdPlus, Syringe, TrendingUp, NotebookPen][i] ?? MessageCircle;
                    return <button key={s} type="button" onClick={() => enviar(s)} className="group flex flex-col gap-2 rounded-xl border border-border bg-card/80 p-3 text-xs leading-snug backdrop-blur transition hover:-translate-y-0.5 hover:border-primary/60 hover:bg-primary/10">
                      <span className="grid size-7 place-items-center rounded-lg bg-primary/15 text-primary"><Icone className="size-4" /></span>
                      <span className="text-foreground">{s}</span>
                    </button>;
                  })}
                </div>
              </div>
            )}
            {messages.map((m, idx) => {
              const texto = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
              const ultima = idx === messages.length - 1;
              const anterior = messages[idx - 1];
              const novoGrupo = !anterior || anterior.role !== m.role;
              return (
                <div key={m.id} className={`flex gap-2 ${m.role === "user" ? "justify-end" : ""} ${novoGrupo ? "" : "-mt-3"}`}>
                  {m.role === "assistant" && (novoGrupo
                    ? <img src={yuiAvatar} alt="" width={28} height={28} className="mt-1 size-7 shrink-0 rounded-full border border-primary/40 object-cover" />
                    : <span className="size-7 shrink-0" />)}
                  <div className="group min-w-0 max-w-[85%]">
                    {novoGrupo && <p className={`mb-1 px-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground ${m.role === "user" ? "text-right" : ""}`}>{m.role === "user" ? "Você" : "Yui"}</p>}
                    <Message from={m.role} className="max-w-full">
                      <MessageContent className={m.role === "user" ? "rounded-2xl rounded-br-sm bg-primary text-primary-foreground shadow-md" : "px-1 py-1 text-foreground"}>
                        {m.parts.map((p, i) => p.type === "text" ? (m.role === "assistant" ? <MessageResponse key={i}>{p.text}</MessageResponse> : <span key={i} className="whitespace-pre-wrap">{p.text}</span>) : null)}
                      </MessageContent>
                    </Message>
                    {m.role === "assistant" && texto && !(ultima && status === "streaming") && (
                      <div className="mt-1 flex gap-1 opacity-70 transition group-hover:opacity-100">
                        <Button size="icon-sm" variant="ghost" className="size-7" aria-label="Copiar resposta" title="Copiar" onClick={() => { void navigator.clipboard.writeText(texto); toast.success("Resposta copiada"); }}><Copy className="size-3.5" /></Button>
                        <Button size="icon-sm" variant="ghost" className="size-7" aria-label="Ouvir resposta" title="Ouvir" onClick={() => void falar(texto.replace(/[*#`_>]/g, ""), true)}><Volume2 className="size-3.5" /></Button>
                        {ultima && <Button size="icon-sm" variant="ghost" className="size-7" aria-label="Gerar de novo" title="Gerar de novo" onClick={() => void regenerate()}><RefreshCw className="size-3.5" /></Button>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {status === "submitted" && <div className="flex gap-2"><img src={yuiAvatar} alt="" width={28} height={28} className="mt-1 size-7 rounded-full border border-primary/40 object-cover" /><div className="flex items-center gap-1 rounded-2xl rounded-tl-sm border border-border bg-card/85 px-4 py-3"><span className="size-1.5 animate-bounce rounded-full bg-primary" /><span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:150ms]" /><span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:300ms]" /><Shimmer className="ml-2 text-xs">Yui está digitando…</Shimmer></div></div>}
            {error && status !== "streaming" && <div className="flex items-center justify-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">Não consegui responder.<Button size="sm" variant="ghost" className="h-7 text-destructive" onClick={() => void regenerate()}><RefreshCw className="size-3.5" />Tentar de novo</Button></div>}

            {etapa !== "chat" && (
              <div className="rounded-2xl border border-primary/40 bg-card p-4">
                <div className="flex gap-3"><img src={yuiAvatar} alt="" width={36} height={36} className="size-9 shrink-0 rounded-full bg-primary/10 object-cover" />
                  <div className="text-sm">
                     {etapa === "pergunta1" ? <><p className="font-semibold">Quer que eu entre no modo automático?</p><p className="mt-1 text-muted-foreground">{modo === "funcao" ? `Vou mostrar apenas ${topico.nome}, passo a passo e com voz.` : "Eu vou passear por todas as páginas, mostrando e explicando cada função com voz."}</p></>
                       : <><p className="font-semibold">Tem certeza? Posso começar?</p><p className="mt-1 text-muted-foreground">{modo === "funcao" ? `Vamos ver só ${topico.nome}. ` : ""}Durante a demonstração eu controlo a tela e falo em voz alta. Você pode pausar ou sair quando quiser.</p></>}
                  </div>
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setEtapa("chat")}>Agora não</Button>
                   {etapa === "pergunta1" ? <Button size="sm" onClick={() => setEtapa("pergunta2")}>Sim, quero</Button> : <Button size="sm" onClick={iniciarTour}>{modo === "funcao" ? "Começar esta função" : "Sim, começar o tour"}</Button>}
                </div>
              </div>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
        </div>

        <div className="relative z-10 border-t border-primary/20 bg-gradient-to-t from-card to-card/70 p-3 backdrop-blur">
          <PromptInput onSubmit={(msg) => enviar(msg.text ?? "")} className="rounded-lg border-border bg-card shadow-lg focus-within:border-primary/60 focus-within:shadow-[0_0_20px_-8px_var(--primary)]">
              <PromptInputTextarea placeholder="Pergunte à Yui…" autoFocus maxLength={4000} />
            <PromptInputFooter className="justify-between">
              <span className="px-2 text-[11px] text-muted-foreground">Respostas geradas por IA</span>
              <PromptInputSubmit status={status} onStop={stop} className="size-8 shrink-0 rounded-md" />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </section>
    )}
  </>;
}

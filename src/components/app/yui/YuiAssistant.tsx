import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useQuery } from "@tanstack/react-query";
import { Compass, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputBody, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { useYuiAvatar } from "./useYuiAvatar";
import { YuiTour } from "./YuiTour";
import { TOUR } from "./tourSteps";
import { prepararVoz } from "./voz";

const SUGESTOES = ["Como cadastro um animal?", "Como registro uma vacina?", "Como vejo o lucro do mês?", "Como registrar um nascimento?"];
const BOAS_VINDAS = "yui-boas-vindas-v1";

type Etapa = "chat" | "pergunta1" | "pergunta2";

export function YuiAssistant({ section, go, abrirMenu }: { section: string; go: (s: string) => void; abrirMenu: (aberto: boolean) => void }) {
  const yuiAvatar = useYuiAvatar();
  const [aberto, setAberto] = useState(false);
  const [etapa, setEtapa] = useState<Etapa>("chat");
  const [tour, setTour] = useState(false);
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

  const { messages, sendMessage, status, stop, setMessages, error } = useChat({
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

  // Enquanto a pessoa confirma o tour, já prepara a voz das primeiras falas (sem espera no início).
  useEffect(() => {
    if (etapa === "chat") return;
    TOUR.slice(0, 2).forEach((p) => prepararVoz(p.fala));
  }, [etapa]);

  const ocupado = status === "submitted" || status === "streaming";
  const enviar = (texto: string) => {
    const t = texto.trim();
    if (!t || ocupado) return;
    if (/\b(tour|passeio|me mostra|demonstra)/i.test(t)) setEtapa("pergunta1");
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

  const iniciarTour = () => { setEtapa("chat"); setAberto(false); setConvite(false); localStorage.setItem(BOAS_VINDAS, "1"); setTour(true); };

  return <>
    {tour && <YuiTour go={go} abrirMenu={abrirMenu} onSair={() => { setTour(false); setAberto(true); }} />}

    {convite && !aberto && !tour && (
      <div className="fixed bottom-24 right-4 z-40 w-[min(320px,calc(100vw-32px))] animate-in fade-in slide-in-from-bottom-4 rounded-2xl border border-primary/40 bg-popover p-4 shadow-2xl sm:right-6">
        <button type="button" onClick={fecharConvite} className="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:text-foreground" aria-label="Fechar"><X className="size-4" /></button>
        <div className="flex gap-3"><img src={yuiAvatar} alt="" width={40} height={40} className="size-10 rounded-full bg-primary/10 object-cover" /><div><p className="text-sm font-semibold">Oi! Eu sou a Yui 👋</p><p className="mt-1 text-sm text-muted-foreground">Quer que eu entre no modo automático e te mostre o site funcionando, passo a passo e com voz?</p></div></div>
        <div className="mt-3 flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={fecharConvite}>Agora não</Button><Button size="sm" onClick={() => { setConvite(false); localStorage.setItem(BOAS_VINDAS, "1"); setEtapa("pergunta2"); setAberto(true); }}>Quero sim</Button></div>
      </div>
    )}

    {!tour && (
      <button type="button" data-tour="yui" onClick={() => { setAberto((a) => !a); setConvite(false); }} aria-label={aberto ? "Fechar suporte da Yui" : "Abrir suporte da Yui"}
        className="group fixed bottom-4 right-4 z-40 grid size-16 place-items-center rounded-full border-2 border-primary bg-card shadow-[0_8px_30px_-6px_color-mix(in_oklab,var(--primary)_55%,transparent)] transition-transform hover:scale-105 sm:bottom-6 sm:right-6">
        <img src={yuiAvatar} alt="" width={64} height={64} className="size-full rounded-full object-cover" />
        <span className="absolute -top-1 right-0 rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">Ajuda</span>
      </button>
    )}
    {tour && <span data-tour="yui" className="fixed bottom-6 right-6 z-40 grid size-16 place-items-center rounded-full border-2 border-primary bg-card"><img src={yuiAvatar} alt="" width={64} height={64} className="size-full rounded-full object-cover" /></span>}

    {aberto && !tour && (
      <section aria-label="Suporte da Yui" className="fixed inset-0 z-50 flex flex-col overflow-hidden border-border bg-background shadow-2xl animate-in fade-in slide-in-from-bottom-6 sm:inset-auto sm:bottom-24 sm:right-6 sm:h-[min(640px,calc(100vh-120px))] sm:w-[400px] sm:rounded-2xl sm:border">
        <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
          <div className="relative"><img src={yuiAvatar} alt="Yui" width={40} height={40} className="size-10 rounded-full bg-primary/10 object-cover" /><span className="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-card bg-primary" /></div>
          <div className="min-w-0 flex-1"><p className="font-semibold leading-tight">Yui</p><p className="text-xs text-muted-foreground">Suporte · tira suas dúvidas</p></div>
          <Button size="icon" variant="ghost" onClick={limpar} aria-label="Apagar conversa" title="Apagar conversa"><RotateCcw /></Button>
          <Button size="icon" variant="ghost" onClick={() => setAberto(false)} aria-label="Fechar"><X /></Button>
        </header>
        <div className="border-b border-border bg-card/50 px-4 py-2">
          <Button size="sm" variant="outline" className="w-full border-primary/40 text-primary" onClick={() => setEtapa("pergunta1")}><Compass />Tour pelo site</Button>
        </div>

        <Conversation className="flex-1">
          <ConversationContent className="gap-5 px-4 py-4">
            {messages.length === 0 && etapa === "chat" && (
              <div className="py-6 text-center">
                <img src={yuiAvatar} alt="" width={80} height={80} className="mx-auto size-20 rounded-full bg-primary/10 object-cover" />
                <p className="mt-3 font-semibold">Oi! Como posso te ajudar?</p>
                <p className="mt-1 text-sm text-muted-foreground">Pergunte qualquer coisa sobre o sistema. Eu explico passo a passo.</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">{SUGESTOES.map((s) => <Button key={s} size="sm" variant="outline" className="h-auto whitespace-normal py-1.5 text-xs" onClick={() => enviar(s)}>{s}</Button>)}</div>
              </div>
            )}
            {messages.map((m) => (
              <Message key={m.id} from={m.role}>
                <MessageContent className={m.role === "user" ? "bg-primary text-primary-foreground" : ""}>
                  {m.parts.map((p, i) => p.type === "text" ? (m.role === "assistant" ? <MessageResponse key={i}>{p.text}</MessageResponse> : <span key={i} className="whitespace-pre-wrap">{p.text}</span>) : null)}
                </MessageContent>
              </Message>
            ))}
            {status === "submitted" && <Message from="assistant"><MessageContent><Shimmer>Yui está pensando…</Shimmer></MessageContent></Message>}
            {error && status !== "streaming" && <p className="text-center text-xs text-destructive">Não consegui responder. Tente enviar de novo.</p>}

            {etapa !== "chat" && (
              <div className="rounded-2xl border border-primary/40 bg-card p-4">
                <div className="flex gap-3"><img src={yuiAvatar} alt="" width={36} height={36} className="size-9 shrink-0 rounded-full bg-primary/10 object-cover" />
                  <div className="text-sm">
                    {etapa === "pergunta1" ? <><p className="font-semibold">Quer que eu entre no modo automático?</p><p className="mt-1 text-muted-foreground">Eu vou passear por todas as páginas, mostrando e explicando cada função com voz.</p></>
                      : <><p className="font-semibold">Tem certeza? Posso começar?</p><p className="mt-1 text-muted-foreground">Durante o tour eu controlo a tela e falo em voz alta (aumente o volume). Você pode pausar ou sair quando quiser.</p></>}
                  </div>
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setEtapa("chat")}>Agora não</Button>
                  {etapa === "pergunta1" ? <Button size="sm" onClick={() => setEtapa("pergunta2")}>Sim, quero</Button> : <Button size="sm" onClick={iniciarTour}>Sim, começar o tour</Button>}
                </div>
              </div>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <div className="border-t border-border p-3">
          <PromptInput onSubmit={(msg) => enviar(msg.text ?? "")}>
            <PromptInputBody>
              <PromptInputTextarea placeholder="Escreva sua dúvida…" autoFocus maxLength={4000} />
            </PromptInputBody>
            <PromptInputFooter className="justify-between">
              <span className="px-2 text-[11px] text-muted-foreground">Respostas geradas por IA</span>
              <PromptInputSubmit status={status} onStop={stop} />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </section>
    )}
  </>;
}

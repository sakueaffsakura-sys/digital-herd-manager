import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, LifeBuoy, LoaderCircle, MessageCircleQuestion, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { diaBR } from "@/lib/datas";
import { PageTitle, Status } from "../shared";

type Mensagem = { id: string; assunto: string; mensagem: string; status: string; resposta: string | null; criado_em: string; respondido_em: string | null };

const PERGUNTAS: { p: string; r: string }[] = [
  {
    p: "Esqueci minha senha. E agora?",
    r: "Na tela de entrada, toque em “Esqueci minha senha”, escreva o seu e-mail e confira a caixa de entrada (olhe também o lixo eletrônico). O link vale por 1 hora e só pode ser usado uma vez.",
  },
  {
    p: "Como eu cadastro um animal?",
    r: "Vá em Meu rebanho e toque em “Novo animal”. O número do brinco é o único campo obrigatório; nome, raça, sexo, data de nascimento e lote você preenche se quiser. Pelo celular, o botão “Lançar” da barra de baixo é um atalho.",
  },
  {
    p: "Posso usar em mais de uma propriedade?",
    r: "Pode. Cadastre quantas quiser no menu da propriedade, lá em cima, em “Cadastrar outra propriedade”. Cada uma tem rebanho, lançamentos e relatórios separados.",
  },
  {
    p: "Alguém mais da fazenda pode usar a minha conta?",
    r: "Não precisa: cada pessoa tem o próprio login. Em Dados da propriedade você convida quem trabalha com você, e escolhe se a pessoa pode só olhar ou também lançar.",
  },
  {
    p: "O que o Premium libera?",
    r: "A biblioteca de eBooks, a importação de planilhas, a exportação dos relatórios, a logo e o banner da propriedade. O pagamento é pelo Mercado Pago (Pix, cartão ou boleto) e não renova sozinho.",
  },
  {
    p: "Perdi o sinal no pasto. Os lançamentos somem?",
    r: "No aplicativo do celular, não: ele guarda tudo no aparelho e envia quando a internet volta. Pelo site, é preciso estar conectado na hora de salvar.",
  },
  {
    p: "Como eu protejo melhor a minha conta?",
    r: "Em Senha e segurança você liga a verificação em duas etapas (um código que aparece num aplicativo do celular), vê os aparelhos conectados e desconecta o que não reconhecer.",
  },
  {
    p: "Quero apagar a minha conta e os meus dados.",
    r: "Em Senha e segurança, na parte de privacidade, você pode baixar tudo o que é seu num arquivo e pedir a exclusão da conta. Atendemos em até 15 dias e você pode cancelar o pedido enquanto não for atendido.",
  },
];

function Pergunta({ p, r }: { p: string; r: string }) {
  return (
    <details className="painel group px-4 py-3 sm:px-5">
      <summary className="flex cursor-pointer list-none items-center gap-3 font-bold [&::-webkit-details-marker]:hidden">
        <MessageCircleQuestion className="size-5 shrink-0 text-primary" />
        <span className="min-w-0 flex-1">{p}</span>
        <ChevronDown className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <p className="mt-2 pl-8 text-muted-foreground">{r}</p>
    </details>
  );
}

export default function Ajuda({ propriedadeId }: { propriedadeId: string | null }) {
  const qc = useQueryClient();
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);

  const minhas = useQuery({
    queryKey: ["minhas-mensagens-suporte"],
    queryFn: async (): Promise<Mensagem[]> => {
      const { data, error } = await supabase.from("suporte_contatos").select("id,assunto,mensagem,status,resposta,criado_em,respondido_em").order("criado_em", { ascending: false }).limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const a = assunto.trim(), m = mensagem.trim();
    if (a.length < 2) { toast.error("Escreva o assunto."); return; }
    if (m.length < 10) { toast.error("Conte com um pouco mais de detalhe o que aconteceu."); return; }
    setEnviando(true);
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from("suporte_contatos").insert({
      assunto: a, mensagem: m, email: auth.user?.email ?? null, propriedade_id: propriedadeId,
    });
    setEnviando(false);
    if (error) { toast.error("Não foi possível enviar agora. Tente de novo daqui a pouco."); return; }
    toast.success("Mensagem enviada. Respondemos por aqui e no seu e-mail.");
    setAssunto(""); setMensagem("");
    void qc.invalidateQueries({ queryKey: ["minhas-mensagens-suporte"] });
  };

  return (
    <div>
      <PageTitle title="Ajuda" description="As dúvidas mais comuns e um canal direto com a gente." />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <div className="min-w-0">
          <h2 className="titulo-secao">Perguntas frequentes</h2>
          <div className="mt-3 space-y-2">
            {PERGUNTAS.map((q) => <Pergunta key={q.p} {...q} />)}
          </div>

          {(minhas.data ?? []).length > 0 && (
            <>
              <h2 className="titulo-secao mt-8">Suas mensagens</h2>
              <ul className="mt-3 space-y-3">
                {minhas.data!.map((m) => (
                  <li key={m.id} className="painel p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="min-w-0 flex-1 font-bold">{m.assunto}</p>
                      <Status value={m.status} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">Enviada em {diaBR(m.criado_em)}</p>
                    <p className="mt-2 whitespace-pre-line">{m.mensagem}</p>
                    {m.resposta && (
                      <div className="aviso-barra mt-3 rounded-xl bg-sucesso-fundo py-2.5 pr-3 text-primary">
                        <p className="font-bold text-foreground">Resposta do suporte{m.respondido_em ? ` · ${diaBR(m.respondido_em)}` : ""}</p>
                        <p className="whitespace-pre-line text-foreground/90">{m.resposta}</p>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <section className="painel p-4 sm:p-6">
          <h2 className="titulo-secao flex items-center gap-2"><LifeBuoy className="size-6 text-primary" />Falar com a gente</h2>
          <p className="mt-1 text-sm text-muted-foreground">Conte o que aconteceu e em qual tela. Respondemos aqui mesmo e também por e-mail.</p>
          <form onSubmit={enviar} className="mt-4 space-y-3">
            <div>
              <Label htmlFor="sup-assunto">Assunto</Label>
              <Input id="sup-assunto" required minLength={2} maxLength={120} value={assunto} onChange={(e) => setAssunto(e.target.value)} placeholder="Ex.: não consigo lançar o leite" />
            </div>
            <div>
              <Label htmlFor="sup-msg">Mensagem</Label>
              <Textarea id="sup-msg" required minLength={10} maxLength={4000} rows={6} value={mensagem} onChange={(e) => setMensagem(e.target.value)} placeholder="Escreva com suas palavras o que você tentou fazer e o que apareceu na tela." />
            </div>
            <Button type="submit" className="h-12 w-full" disabled={enviando}>
              {enviando ? <LoaderCircle className="animate-spin" /> : <Send />}Enviar mensagem
            </Button>
          </form>
          <p className="mt-3 text-sm text-muted-foreground">
            Com pressa? A Yui, a assistente do site, responde na hora: toque no balão no alto da tela.
          </p>
        </section>
      </div>
    </div>
  );
}

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, LoaderCircle, Send, Smartphone, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { diaBR } from "@/lib/datas";
import { CampoArquivo, Status } from "../shared";
import { CHAVE_APP, useAppAndroid, type AppAndroid } from "../aplicativo/Aplicativo";

type Linha = { id: string; criado_em: string; email: string | null; assunto: string; mensagem: string; propriedade: string | null; status: string; resposta: string | null; respondido_em: string | null };

const MAX_APK = 300 * 1024 * 1024;

/** Publicar o aplicativo Android: o arquivo fica em área restrita e a página "Use no celular" o oferece. */
function AppAdmin() {
  const qc = useQueryClient();
  const atual = useAppAndroid();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [versao, setVersao] = useState("");
  const [novidades, setNovidades] = useState("");
  const [etapa, setEtapa] = useState<string | null>(null);

  const publicar = async () => {
    const v = versao.trim();
    if (!/^\d+(\.\d+){0,3}$/.test(v)) { toast.error("Escreva a versão em números, como 7.4 ou 7.4.1."); return; }
    if (!arquivo) { toast.error("Escolha o arquivo .apk."); return; }
    if (!/\.apk$/i.test(arquivo.name)) { toast.error("O arquivo precisa terminar em .apk."); return; }
    if (arquivo.size > MAX_APK) { toast.error("O arquivo passa de 300 MB."); return; }
    setEtapa("Conferindo o arquivo…");
    try {
      // Todo APK é um ZIP: começa com "PK".
      const inicio = new Uint8Array(await arquivo.slice(0, 2).arrayBuffer());
      if (inicio[0] !== 0x50 || inicio[1] !== 0x4b) throw new Error("Este arquivo não parece um APK.");
      setEtapa("Enviando…");
      const caminho = `apecuaria-digital-${v}.apk`;
      const up = await supabase.storage.from("aplicativo").upload(caminho, arquivo, { contentType: "application/vnd.android.package-archive", upsert: true, cacheControl: "0" });
      if (up.error) throw new Error("Não foi possível enviar o arquivo.");
      setEtapa("Salvando…");
      const dados: AppAndroid = { versao: v, arquivo: caminho, tamanho: arquivo.size, publicado_em: new Date().toISOString(), novidades: novidades.trim().slice(0, 2000) };
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("configuracoes_sistema").upsert({
        chave: CHAVE_APP, valor: JSON.stringify(dados), atualizado_em: new Date().toISOString(), atualizado_por: auth.user?.id ?? null,
      });
      if (error) throw new Error("O arquivo subiu, mas não deu para salvar os dados da versão.");
      toast.success(`Versão ${v} publicada. Já aparece em "Use no celular".`);
      setArquivo(null); setVersao(""); setNovidades("");
      void qc.invalidateQueries({ queryKey: ["app-android"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setEtapa(null);
    }
  };

  return (
    <section className="painel p-4 sm:p-6">
      <h3 className="titulo-secao flex items-center gap-2"><Smartphone className="size-6 text-primary" />Aplicativo Android</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {atual.data
          ? `No ar: versão ${atual.data.versao} (${(atual.data.tamanho / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB), publicada em ${diaBR(atual.data.publicado_em)}.`
          : "Nenhuma versão publicada ainda. Quem entrar em “Use no celular” vê a orientação de usar pelo navegador."}
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div><Label htmlFor="app-versao">Versão</Label><Input id="app-versao" value={versao} onChange={(e) => setVersao(e.target.value)} placeholder="7.4" inputMode="decimal" /></div>
        <CampoArquivo id="app-apk" rotulo="Arquivo .apk" ajuda="Até 300 MB." accept=".apk,application/vnd.android.package-archive" aoEscolher={setArquivo} />
        <div className="sm:col-span-2">
          <Label htmlFor="app-novidades">O que mudou (aparece para quem for baixar)</Label>
          <Textarea id="app-novidades" rows={3} maxLength={2000} value={novidades} onChange={(e) => setNovidades(e.target.value)} placeholder="Ex.: agora dá para lançar peso sem internet." />
        </div>
      </div>
      <Button className="mt-4 h-12" disabled={!!etapa} onClick={() => void publicar()}>
        {etapa ? <><LoaderCircle className="animate-spin" />{etapa}</> : <><Upload />Publicar versão</>}
      </Button>
    </section>
  );
}

function Responder({ linha, aoFechar }: { linha: Linha; aoFechar: () => void }) {
  const qc = useQueryClient();
  const [texto, setTexto] = useState(linha.resposta ?? "");
  const [enviando, setEnviando] = useState(false);
  const responder = async (fechar: boolean) => {
    if (texto.trim().length < 2) { toast.error("Escreva a resposta."); return; }
    setEnviando(true);
    const { error } = await supabase.rpc("admin_responder_suporte", { _id: linha.id, _resposta: texto.trim(), _fechar: fechar });
    setEnviando(false);
    if (error) { toast.error(error.message || "Não foi possível responder."); return; }
    toast.success(fechar ? "Respondido e encerrado." : "Resposta enviada.");
    void qc.invalidateQueries({ queryKey: ["admin-suporte"] });
    aoFechar();
  };
  return (
    <div className="mt-3 rounded-xl border border-border p-3">
      <Label htmlFor={`resp-${linha.id}`}>Resposta</Label>
      <Textarea id={`resp-${linha.id}`} rows={4} maxLength={4000} value={texto} onChange={(e) => setTexto(e.target.value)} />
      <div className="mt-2 flex flex-wrap gap-2">
        <Button className="h-11" disabled={enviando} onClick={() => void responder(false)}><Send />Enviar resposta</Button>
        <Button variant="outline" className="h-11" disabled={enviando} onClick={() => void responder(true)}><Check />Responder e encerrar</Button>
        <Button variant="ghost" className="h-11" onClick={aoFechar}>Cancelar</Button>
      </div>
    </div>
  );
}

export function SuporteAdmin() {
  const [status, setStatus] = useState("aberto");
  const [respondendo, setRespondendo] = useState<string | null>(null);
  const lista = useQuery({
    queryKey: ["admin-suporte", status],
    refetchInterval: 60_000,
    queryFn: async (): Promise<Linha[]> => {
      const { data, error } = await supabase.rpc("admin_suporte", status === "todas" ? { _limite: 200 } : { _status: status, _limite: 200 });
      if (error) throw error;
      return (data ?? []) as Linha[];
    },
  });
  return (
    <div className="space-y-6">
      <AppAdmin />
      <section className="painel p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="titulo-secao">Mensagens do suporte</h3>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-56" aria-label="Situação das mensagens"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[["aberto", "Aguardando resposta"], ["respondido", "Respondidas"], ["fechado", "Encerradas"], ["todas", "Todas"]].map(([v, r]) => <SelectItem key={v} value={v}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {lista.isLoading ? <p className="mt-3 text-muted-foreground">Carregando…</p> : (lista.data ?? []).length === 0 ? (
          <p className="mt-3 text-muted-foreground">Nenhuma mensagem nesta lista.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {lista.data!.map((l) => (
              <li key={l.id} className="rounded-2xl border border-border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="min-w-0 flex-1 font-bold">{l.assunto}</p>
                  <Status value={l.status} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{[l.email, l.propriedade, diaBR(l.criado_em)].filter(Boolean).join(" · ")}</p>
                <p className="mt-2 whitespace-pre-line">{l.mensagem}</p>
                {l.resposta && respondendo !== l.id && (
                  <p className="mt-2 whitespace-pre-line rounded-xl bg-muted p-3 text-sm"><strong>Já respondido:</strong> {l.resposta}</p>
                )}
                {respondendo === l.id ? <Responder linha={l} aoFechar={() => setRespondendo(null)} /> : (
                  <Button variant="outline" className="mt-3 h-11" onClick={() => setRespondendo(l.id)}><Send />{l.resposta ? "Responder de novo" : "Responder"}</Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

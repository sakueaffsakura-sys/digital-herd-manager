import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Download, LoaderCircle, Smartphone, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { diaBR } from "@/lib/datas";
import { qrParaSvg } from "@/lib/qr";
import { PageTitle } from "../shared";

export type AppAndroid = { versao: string; arquivo: string; tamanho: number; publicado_em: string; novidades: string };

export const CHAVE_APP = "app_android";

/** Lê os dados do aplicativo guardados nas configurações do sistema. */
export function useAppAndroid() {
  return useQuery({
    queryKey: ["app-android"],
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<AppAndroid | null> => {
      const { data, error } = await supabase.from("configuracoes_sistema").select("valor").eq("chave", CHAVE_APP).maybeSingle();
      if (error) throw error;
      if (!data?.valor) return null;
      try {
        const v = JSON.parse(data.valor) as AppAndroid;
        return v?.arquivo ? v : null;
      } catch {
        return null;
      }
    },
  });
}

const mb = (n: number) => `${(n / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;

/** Quadradinho do QR Code, desenhado aqui mesmo (sem imagem de fora). */
function Qr({ texto, titulo }: { texto: string; titulo: string }) {
  const svg = useMemo(() => {
    try { return qrParaSvg(texto); } catch { return null; }
  }, [texto]);
  if (!svg) return null;
  return (
    <figure className="w-full max-w-[13rem]">
      <div className="rounded-xl border border-border bg-white p-2" dangerouslySetInnerHTML={{ __html: svg }} role="img" aria-label={titulo} />
      <figcaption className="mt-2 text-sm text-muted-foreground">{titulo}</figcaption>
    </figure>
  );
}

const PASSOS = [
  "Toque em Baixar o aplicativo. O celular avisa que está baixando um arquivo .apk.",
  "Quando terminar, toque no arquivo baixado (fica na barra de avisos ou na pasta Downloads).",
  "O Android vai perguntar se pode instalar aplicativos dessa origem. Toque em Configurações, ligue a permissão e volte.",
  "Toque em Instalar e espere. Depois é só abrir o Apecuária Digital e entrar com o mesmo e-mail e senha do site.",
];

export default function Aplicativo() {
  const app = useAppAndroid();
  const [baixando, setBaixando] = useState(false);
  const endereco = typeof window === "undefined" ? "https://boooh.sbs" : window.location.origin;

  const baixar = async () => {
    if (!app.data) return;
    setBaixando(true);
    try {
      const { data, error } = await supabase.storage.from("aplicativo").createSignedUrl(app.data.arquivo, 300, { download: `apecuaria-digital-${app.data.versao}.apk` });
      if (error || !data?.signedUrl) throw new Error("O arquivo não está disponível agora. Avise o suporte.");
      window.location.href = data.signedUrl;
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBaixando(false);
    }
  };

  return (
    <div>
      <PageTitle title="Use no celular" description="O Apecuária Digital é o aplicativo para o celular: funciona no meio do pasto, sem internet, e sincroniza quando o sinal volta." />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <section className="painel p-4 sm:p-6">
            <h2 className="titulo-secao flex items-center gap-2"><Smartphone className="size-6 text-primary" />Aplicativo para Android</h2>
            {app.isLoading ? (
              <p className="mt-3 text-muted-foreground">Carregando…</p>
            ) : !app.data ? (
              <p className="mt-3 text-muted-foreground">
                O aplicativo ainda não foi publicado aqui. Enquanto isso, você pode usar o site pelo navegador do celular — ele foi feito para telas pequenas e também dá para colocar na tela de início.
              </p>
            ) : (
              <>
                <p className="mt-2 text-muted-foreground">
                  Versão {app.data.versao} · {mb(app.data.tamanho)} · publicada em {diaBR(app.data.publicado_em)}
                </p>
                {app.data.novidades && (
                  <div className="mt-3 rounded-xl bg-muted p-3">
                    <p className="font-bold">O que mudou</p>
                    <p className="whitespace-pre-line text-sm text-muted-foreground">{app.data.novidades}</p>
                  </div>
                )}
                <Button className="mt-4 h-12" disabled={baixando} onClick={() => void baixar()}>
                  {baixando ? <LoaderCircle className="animate-spin" /> : <Download />}Baixar o aplicativo
                </Button>
                <ol className="mt-5 space-y-2">
                  {PASSOS.map((passo, i) => (
                    <li key={passo} className="flex gap-3">
                      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-sucesso-fundo font-bold text-primary">{i + 1}</span>
                      <span className="min-w-0">{passo}</span>
                    </li>
                  ))}
                </ol>
                <p className="mt-4 text-sm text-muted-foreground">
                  O aviso do Android sobre “origem desconhecida” aparece porque o aplicativo vem direto daqui, e não da loja. É o nosso arquivo, assinado por nós.
                </p>
              </>
            )}
          </section>

          <section className="painel p-4 sm:p-6">
            <h2 className="titulo-secao flex items-center gap-2"><WifiOff className="size-6 text-primary" />Sem internet, continua funcionando</h2>
            <ul className="mt-3 space-y-2">
              {[
                "Lança peso, leite, vacina e anotação no curral, mesmo sem sinal.",
                "Quando o celular pega internet de novo, tudo sobe sozinho para o site.",
                "O que você lança no site aparece no celular, e o contrário também.",
                "A tela foi feita para o sol: letra grande, botão grande e contraste alto.",
              ].map((t) => (
                <li key={t} className="flex gap-2.5"><Check className="mt-0.5 size-5 shrink-0 text-primary" /><span className="min-w-0">{t}</span></li>
              ))}
            </ul>
          </section>

          <section className="painel p-4 sm:p-6">
            <h2 className="titulo-secao">Prefere usar pelo navegador?</h2>
            <p className="mt-2 text-muted-foreground">
              Abra <strong>{endereco.replace(/^https?:\/\//, "")}</strong> no celular, toque no menu do navegador e escolha <strong>Adicionar à tela de início</strong>. O site vira um ícone, abre em tela cheia e guarda a sua sessão.
            </p>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="painel flex flex-col items-center p-4 text-center sm:p-6">
            <h2 className="titulo-secao">Abrir no celular</h2>
            <p className="mb-3 mt-1 text-sm text-muted-foreground">Aponte a câmera do celular para o quadradinho.</p>
            <Qr texto={endereco} titulo={`Abre ${endereco.replace(/^https?:\/\//, "")} no celular`} />
          </section>
        </aside>
      </div>
    </div>
  );
}

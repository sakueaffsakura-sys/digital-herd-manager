import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSun, LoaderCircle, MapPin, Search, Snowflake, Sun } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

type Lugar = { nome: string; estado: string | null; lat: number; lon: number };
type Dia = { dia: string; codigo: number | null; max: number | null; min: number | null; chuva_mm: number | null; chance_chuva: number | null };
type Previsao = { agora: { temperatura: number | null; umidade: number | null; chuva: number | null; vento: number | null; codigo: number | null } | null; dias: Dia[] };

const CHAVE = "pd-lugar-clima";

/** Códigos do Open-Meteo em palavras e ícone. */
function tempo(codigo: number | null) {
  const c = codigo ?? -1;
  if (c === 0) return { texto: "Céu limpo", Icone: Sun };
  if (c <= 2) return { texto: "Sol entre nuvens", Icone: CloudSun };
  if (c === 3) return { texto: "Nublado", Icone: CloudSun };
  if (c <= 48) return { texto: "Névoa", Icone: CloudFog };
  if (c <= 57) return { texto: "Garoa", Icone: CloudDrizzle };
  if (c <= 67) return { texto: "Chuva", Icone: CloudRain };
  if (c <= 77) return { texto: "Neve", Icone: Snowflake };
  if (c <= 82) return { texto: "Pancadas de chuva", Icone: CloudRain };
  if (c <= 86) return { texto: "Neve", Icone: Snowflake };
  if (c <= 99) return { texto: "Temporal com raios", Icone: CloudLightning };
  return { texto: "Sem informação", Icone: CloudSun };
}

const grau = (v: number | null) => (v == null ? "—" : `${Math.round(v)}°`);
const diaDaSemana = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`);
  const hoje = new Date();
  const mesmoDia = d.toDateString() === hoje.toDateString();
  return mesmoDia ? "Hoje" : d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
};

async function pedir<T>(caminho: string): Promise<T> {
  const token = (await supabase.auth.getSession()).data.session?.access_token;
  const r = await fetch(caminho, { headers: { authorization: `Bearer ${token ?? ""}` } });
  const corpo = (await r.json().catch(() => ({}))) as { ok?: boolean; erro?: string };
  if (!r.ok || corpo.ok !== true) throw new Error(corpo.erro ?? "Não foi possível ver o tempo agora.");
  return corpo as T;
}

export function Clima({ cidade, estado }: { cidade: string | null; estado: string | null }) {
  const [lugar, setLugar] = useState<Lugar | null>(null);
  const [busca, setBusca] = useState("");
  const [procurando, setProcurando] = useState(false);
  const [opcoes, setOpcoes] = useState<Lugar[] | null>(null);

  // Lugar guardado neste aparelho; se não houver, usa a cidade da propriedade.
  useEffect(() => {
    try {
      const salvo = localStorage.getItem(CHAVE);
      if (salvo) { setLugar(JSON.parse(salvo) as Lugar); return; }
    } catch { /* sem armazenamento */ }
    if (cidade) setBusca(`${cidade}${estado ? `, ${estado}` : ""}`);
  }, [cidade, estado]);

  const escolher = (l: Lugar) => {
    setLugar(l);
    setOpcoes(null);
    setBusca("");
    try { localStorage.setItem(CHAVE, JSON.stringify(l)); } catch { /* sem armazenamento */ }
  };

  const procurar = async (texto: string) => {
    const nome = texto.trim();
    if (nome.length < 3) { toast.error("Escreva pelo menos 3 letras do nome da cidade."); return; }
    setProcurando(true);
    try {
      const r = await pedir<{ lugares: Lugar[] }>(`/api/clima/lugares?nome=${encodeURIComponent(nome)}`);
      if (!r.lugares.length) { toast.error("Não achamos essa cidade. Tente escrever de outro jeito."); setOpcoes(null); return; }
      if (r.lugares.length === 1) escolher(r.lugares[0]);
      else setOpcoes(r.lugares);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setProcurando(false);
    }
  };

  const previsao = useQuery({
    queryKey: ["clima", lugar?.lat, lugar?.lon],
    enabled: !!lugar,
    staleTime: 30 * 60_000,
    queryFn: () => pedir<Previsao>(`/api/clima/agora?lat=${lugar!.lat}&lon=${lugar!.lon}`),
  });

  const agora = previsao.data?.agora;
  const t = tempo(agora?.codigo ?? null);

  return (
    <div className="painel mt-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1 basis-64">
          <span className="mb-1.5 block text-[15px] font-bold">{lugar ? "Trocar de cidade" : "Qual é a sua cidade?"}</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-10" value={busca} placeholder="Ex.: Patos de Minas"
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void procurar(busca); } }}
            />
          </div>
        </label>
        <Button className="h-12" disabled={procurando} onClick={() => void procurar(busca)}>
          {procurando ? <LoaderCircle className="animate-spin" /> : <MapPin />}Ver o tempo
        </Button>
      </div>

      {opcoes && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {opcoes.map((l) => (
            <li key={`${l.lat},${l.lon}`}>
              <Button variant="outline" className="h-11" onClick={() => escolher(l)}>{l.nome}{l.estado ? ` · ${l.estado}` : ""}</Button>
            </li>
          ))}
        </ul>
      )}

      {!lugar ? (
        <p className="mt-4 text-muted-foreground">Escolha a cidade para ver o tempo de hoje e dos próximos dias.</p>
      ) : previsao.isLoading ? (
        <p className="mt-4 flex items-center gap-2 text-muted-foreground"><LoaderCircle className="size-5 animate-spin" />Vendo o tempo em {lugar.nome}…</p>
      ) : previsao.isError ? (
        <p role="alert" className="mt-4 text-alerta">{(previsao.error as Error).message}</p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <t.Icone className="size-14 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0">
              <p className="font-display text-[2.6rem] font-extrabold leading-none tabular-nums">{grau(agora?.temperatura ?? null)}</p>
              <p className="font-bold">{t.texto} em {lugar.nome}{lugar.estado ? `, ${lugar.estado}` : ""}</p>
              <p className="text-sm text-muted-foreground">
                Umidade {agora?.umidade == null ? "—" : `${Math.round(agora.umidade)}%`} · Vento {agora?.vento == null ? "—" : `${Math.round(agora.vento)} km/h`} · Chuva agora {agora?.chuva == null ? "—" : `${agora.chuva.toLocaleString("pt-BR")} mm`}
              </p>
            </div>
          </div>
          <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {(previsao.data?.dias ?? []).map((d) => {
              const td = tempo(d.codigo);
              return (
                <li key={d.dia} className="rounded-xl border border-border p-3 text-center">
                  <p className="font-bold capitalize">{diaDaSemana(d.dia)}</p>
                  <td.Icone className="mx-auto my-1.5 size-7 text-primary" aria-label={td.texto} />
                  <p className="tabular-nums"><strong>{grau(d.max)}</strong> <span className="text-muted-foreground">{grau(d.min)}</span></p>
                  <p className="text-sm text-muted-foreground">
                    {d.chance_chuva == null ? "—" : `${d.chance_chuva}% chuva`}
                    {d.chuva_mm ? ` · ${d.chuva_mm.toLocaleString("pt-BR")} mm` : ""}
                  </p>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-sm text-muted-foreground">Dados do Open-Meteo, atualizados a cada hora. Serve para se programar, não é garantia.</p>
        </>
      )}
    </div>
  );
}

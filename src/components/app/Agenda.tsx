import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarPlus, ChevronLeft, ChevronRight, HeartPulse, RefreshCw, Scale, Syringe } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { dataLocalISO, formatarDataBR, somarDias } from "@/lib/datas";
import { Brinco } from "./Brinco";
import { Empty, PageTitle } from "./shared";

type Tipo = "vacina" | "parto" | "cio";
type Evento = { data: string; tipo: Tipo; registro_id: string; animal_id: string | null; titulo: string; detalhe: string | null; brinco: string | null; situacao: string | null };
type Atrasada = { data: string; registro_id: string; animal_id: string | null; titulo: string; detalhe: string | null; brinco: string | null };
type SemPesagem = { animal_id: string; nome: string | null; brinco: string; data_nascimento: string | null; ultima_pesagem: string | null };
type Resposta = { eventos: Evento[]; truncado: boolean; atrasadas: Atrasada[]; sem_pesagem: SemPesagem[]; hoje: string };

const TIPOS: { tipo: Tipo; rotulo: string; icone: typeof Syringe; secao: string }[] = [
  { tipo: "vacina", rotulo: "Vacinas", icone: Syringe, secao: "vacinacao" },
  { tipo: "parto", rotulo: "Partos", icone: HeartPulse, secao: "inseminacao" },
  { tipo: "cio", rotulo: "Retorno de cio", icone: RefreshCw, secao: "inseminacao" },
];
const SECAO: Record<Tipo, string> = { vacina: "vacinacao", parto: "inseminacao", cio: "inseminacao" };
const NOME_TIPO: Record<Tipo, string> = { vacina: "Vacina", parto: "Parto", cio: "Cio" };

/** Início da semana (segunda-feira) de uma data AAAA-MM-DD. */
function inicioDaSemana(iso: string) {
  const [a, m, d] = iso.split("-").map(Number);
  const dia = new Date(Date.UTC(a, m - 1, d)).getUTCDay(); // 0 = domingo
  return somarDias(iso, -((dia + 6) % 7));
}
function periodo(modo: "semana" | "mes", ref: string): [string, string] {
  if (modo === "semana") {
    const ini = inicioDaSemana(ref);
    return [ini, somarDias(ini, 6)];
  }
  const [a, m] = ref.split("-").map(Number);
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return [`${ref.slice(0, 7)}-01`, `${ref.slice(0, 7)}-${String(ultimo).padStart(2, "0")}`];
}
function nomeDoDia(iso: string) {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d)).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}
function rotuloPeriodo(modo: "semana" | "mes", de: string, ate: string) {
  if (modo === "mes") {
    const [a, m] = de.split("-").map(Number);
    return new Date(Date.UTC(a, m - 1, 1)).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
  }
  return `${formatarDataBR(de).slice(0, 5)} a ${formatarDataBR(ate).slice(0, 5)}`;
}

/** Arquivo .ics (calendário do celular) com os eventos mostrados, como compromissos de dia inteiro. */
function baixarCalendario(eventos: Evento[], nomePropriedade: string) {
  const escapar = (t: string) => t.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
  const agora = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const linhas = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Pecuaria Digital//Agenda//PT-BR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  for (const e of eventos) {
    const dia = e.data.replace(/-/g, "");
    const fim = somarDias(e.data, 1).replace(/-/g, "");
    linhas.push(
      "BEGIN:VEVENT",
      `UID:${e.tipo}-${e.registro_id}-${dia}@pecuaria-digital`,
      `DTSTAMP:${agora}`,
      `DTSTART;VALUE=DATE:${dia}`,
      `DTEND;VALUE=DATE:${fim}`,
      `SUMMARY:${escapar(`${NOME_TIPO[e.tipo]}: ${e.titulo}${e.detalhe ? ` — ${e.detalhe}` : ""}`)}`,
      `DESCRIPTION:${escapar(`${nomePropriedade}. Lembrete do Pecuária Digital.`)}`,
      "END:VEVENT",
    );
  }
  linhas.push("END:VCALENDAR");
  const blob = new Blob([linhas.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "agenda-pecuaria-digital.ics";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export default function Agenda({
  propertyId, propertyName, go, abrirRegistro,
}: {
  propertyId: string;
  propertyName: string;
  go: (s: string) => void;
  abrirRegistro: (secao: string, id: string) => void;
}) {
  const [modo, setModo] = useState<"semana" | "mes">("semana");
  const [ref, setRef] = useState(() => dataLocalISO());
  const [ocultos, setOcultos] = useState<Set<Tipo>>(new Set());
  const [de, ate] = periodo(modo, ref);

  const q = useQuery({
    queryKey: ["agenda", propertyId, de, ate],
    staleTime: 60_000,
    queryFn: async (): Promise<Resposta> => {
      const { data, error } = await supabase.rpc("agenda_periodo", { _propriedade_id: propertyId, _de: de, _ate: ate });
      if (error) throw error;
      return (data ?? { eventos: [], truncado: false, atrasadas: [], sem_pesagem: [], hoje: dataLocalISO() }) as unknown as Resposta;
    },
  });

  const eventos = useMemo(() => (q.data?.eventos ?? []).filter((e) => !ocultos.has(e.tipo)), [q.data, ocultos]);
  const porDia = useMemo(() => {
    const m = new Map<string, Evento[]>();
    for (const e of eventos) m.set(e.data, [...(m.get(e.data) ?? []), e]);
    return [...m.entries()];
  }, [eventos]);

  const mover = (passo: number) => {
    if (modo === "semana") setRef(somarDias(inicioDaSemana(ref), passo * 7));
    else {
      const [a, m] = ref.split("-").map(Number);
      const d = new Date(Date.UTC(a, m - 1 + passo, 1));
      setRef(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`);
    }
  };
  const alternar = (t: Tipo) => setOcultos((s) => { const n = new Set(s); if (n.has(t)) n.delete(t); else n.add(t); return n; });
  const hoje = q.data?.hoje ?? dataLocalISO();

  return (
    <div>
      <PageTitle
        title="Agenda"
        description="Vacinas a vencer, partos previstos e retorno de cio. Toque num item para abrir o registro."
        action={
          <Button
            variant="outline"
            className="h-12"
            disabled={!eventos.length}
            onClick={() => { baixarCalendario(eventos, propertyName); toast.success("Arquivo do calendário baixado. Abra-o no celular para adicionar."); }}
          >
            <CalendarPlus />Adicionar ao calendário do celular
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Período" className="inline-flex rounded-[10px] border border-input bg-card p-1">
          {(["semana", "mes"] as const).map((m) => (
            <button key={m} type="button" aria-pressed={modo === m} onClick={() => setModo(m)}
              className={`h-10 rounded-lg px-4 font-bold ${modo === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {m === "semana" ? "Semana" : "Mês"}
            </button>
          ))}
        </div>
        <div className="inline-flex items-center gap-1">
          <Button variant="outline" size="icon" className="size-12" onClick={() => mover(-1)} aria-label={modo === "semana" ? "Semana anterior" : "Mês anterior"}><ChevronLeft /></Button>
          <span className="min-w-36 text-center font-bold first-letter:uppercase" aria-live="polite">{rotuloPeriodo(modo, de, ate)}</span>
          <Button variant="outline" size="icon" className="size-12" onClick={() => mover(1)} aria-label={modo === "semana" ? "Próxima semana" : "Próximo mês"}><ChevronRight /></Button>
        </div>
        <Button variant="ghost" className="h-12" onClick={() => setRef(dataLocalISO())}>Hoje</Button>
        <div role="group" aria-label="Mostrar" className="flex flex-wrap gap-2 sm:ml-auto">
          {TIPOS.map(({ tipo, rotulo, icone: Icone }) => {
            const ativo = !ocultos.has(tipo);
            return (
              <button key={tipo} type="button" aria-pressed={ativo} onClick={() => alternar(tipo)}
                className={`inline-flex h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm font-bold ${ativo ? "border-primary bg-sucesso-fundo text-primary" : "border-input text-muted-foreground"}`}>
                <Icone className="size-4" />{rotulo}
              </button>
            );
          })}
        </div>
      </div>

      {q.error && (
        <div role="alert" className="aviso-barra mb-5 rounded-xl bg-alerta-fundo px-4 py-3 text-alerta">
          <p className="font-bold text-foreground">A agenda não abriu.</p>
          <Button variant="outline" className="mt-2 h-10" onClick={() => void q.refetch()}>Tentar de novo</Button>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="painel min-w-0 p-4 sm:p-5" aria-label="Compromissos do período">
          {q.isLoading ? (
            <p className="text-muted-foreground">Carregando…</p>
          ) : porDia.length === 0 ? (
            <Empty message={ocultos.size ? "Nada neste período com os filtros escolhidos." : "Nada marcado neste período."} />
          ) : (
            <ol className="space-y-5">
              {porDia.map(([dia, lista]) => (
                <li key={dia}>
                  <h2 className={`mb-2 font-bold first-letter:uppercase ${dia === hoje ? "text-primary" : ""}`}>
                    {dia === hoje ? "Hoje, " : ""}{nomeDoDia(dia)}
                  </h2>
                  <ul className="divide-y divide-border rounded-xl border border-border">
                    {lista.map((e) => (
                      <li key={`${e.tipo}-${e.registro_id}`}>
                        <button type="button" onClick={() => abrirRegistro(SECAO[e.tipo], e.registro_id)}
                          className="flex min-h-16 w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent">
                          {e.brinco ? <Brinco tamanho="pequeno" valor={e.brinco} /> : <span className="w-10 shrink-0" />}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-bold">{e.titulo}</span>
                            <span className="block truncate text-sm text-muted-foreground">{NOME_TIPO[e.tipo]} · {e.detalhe ?? "—"}</span>
                          </span>
                          <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
          {q.data?.truncado && <p className="mt-4 text-sm text-muted-foreground">Mostrando os primeiros 500 compromissos. Use a visão de semana para ver o resto.</p>}
        </section>

        <aside className="min-w-0 space-y-6">
          <section className="painel p-4 sm:p-5">
            <h2 className="titulo-secao">Vacinas atrasadas</h2>
            {(q.data?.atrasadas ?? []).length === 0 ? (
              <p className="mt-3 text-muted-foreground">{q.isLoading ? "Carregando…" : "Nenhuma vacina atrasada."}</p>
            ) : (
              <ul className="mt-3 divide-y divide-border">
                {q.data!.atrasadas.map((a) => (
                  <li key={a.registro_id}>
                    <button type="button" onClick={() => abrirRegistro("vacinacao", a.registro_id)} className="flex min-h-14 w-full items-center gap-3 py-2 text-left hover:bg-accent">
                      {a.brinco ? <Brinco tamanho="pequeno" valor={a.brinco} /> : <span className="w-10 shrink-0" />}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-bold">{a.titulo}</span>
                        <span className="block truncate text-sm text-alerta">Venceu em {formatarDataBR(a.data)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="painel p-4 sm:p-5">
            <h2 className="titulo-secao">Sem pesagem há 60 dias</h2>
            <p className="mt-1 text-sm text-muted-foreground">Animais com até 2 anos.</p>
            {(q.data?.sem_pesagem ?? []).length === 0 ? (
              <p className="mt-3 text-muted-foreground">{q.isLoading ? "Carregando…" : "Todos os animais jovens foram pesados."}</p>
            ) : (
              <>
                <ul className="mt-3 divide-y divide-border">
                  {q.data!.sem_pesagem.slice(0, 12).map((a) => (
                    <li key={a.animal_id} className="flex min-h-14 items-center gap-3 py-2">
                      <Brinco tamanho="pequeno" valor={a.brinco} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-bold">{a.nome || `Brinco ${a.brinco}`}</span>
                        <span className="block truncate text-sm text-muted-foreground">
                          {a.ultima_pesagem ? `Última pesagem em ${formatarDataBR(a.ultima_pesagem)}` : "Nunca pesado"}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
                <Button className="mt-3 h-12 w-full" onClick={() => go("bezerros")}><Scale />Registrar pesagens</Button>
              </>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

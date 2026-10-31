import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarClock, CheckCircle2, Info, Milk, NotebookPen, Plus, Scale, Syringe } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Brinco } from "./Brinco";
import { useAvisos, type Aviso } from "./casca/Avisos";
import { Empty, money, type Row } from "./shared";
import { dataLocalISO, formatarDataBR, mesLocalISO, primeiroDiaDoMes, somarDias } from "@/lib/datas";
import { BUCKETS, StorageImage, usePropertyProfile } from "./account";

const compacto = (v: number) => Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(v);
const inteiro = (v: number) => Math.round(v).toLocaleString("pt-BR");

type EventoAgenda = { data: string; tipo: "vacina" | "parto" | "cio"; titulo: string; detalhe: string | null; brinco: string | null };
const ROTULO_TIPO: Record<EventoAgenda["tipo"], string> = { vacina: "Vacina", parto: "Parto", cio: "Cio" };
const COR_AVISO: Record<Aviso["nivel"], string> = { alerta: "text-alerta", aviso: "text-aviso", info: "text-primary" };
const ICONE_AVISO = { alerta: AlertTriangle, aviso: CalendarClock, info: Info } as const;

export default function Dashboard({
  propertyId, propertyName, go, lancar,
}: {
  propertyId: string;
  propertyName: string;
  go: (s: string) => void;
  lancar?: (secao: string, novo: string) => void;
}) {
  const perfil = usePropertyProfile(propertyId);
  const avisos = useAvisos(propertyId);
  const query = useQuery({
    queryKey: ["dashboard", propertyId],
    staleTime: 30_000,
    queryFn: async () => {
      const hoje = dataLocalISO();
      const desde = primeiroDiaDoMes(-11);
      const [resumo, financas, leite, agenda, partos] = await Promise.all([
        supabase.rpc("dashboard_resumo", { _propriedade_id: propertyId }),
        supabase.from("v_financeiro_mensal").select("mes,receitas,despesas").eq("propriedade_id", propertyId).gte("mes", desde).order("mes"),
        supabase.from("v_producao_mensal").select("mes,total_litros").eq("propriedade_id", propertyId).gte("mes", desde).order("mes"),
        supabase.rpc("agenda_periodo", { _propriedade_id: propertyId, _de: hoje, _ate: somarDias(hoje, 7) }),
        supabase.from("inseminacoes").select("id,previsao_parto,situacao,animais(nome,numero_brinco)").eq("propriedade_id", propertyId)
          .in("situacao", ["em_andamento", "confirmada"]).gte("previsao_parto", hoje).order("previsao_parto").limit(5),
      ]);
      const erro = [resumo, financas, leite].map((x) => x.error).find(Boolean);
      if (erro) throw erro;
      const ag = (agenda.data ?? null) as { eventos?: EventoAgenda[] } | null;
      return {
        resumo: (resumo.data ?? {}) as Row,
        financas: financas.data ?? [],
        leite: leite.data ?? [],
        semana: agenda.error ? null : (ag?.eventos ?? []).slice(0, 6),
        partos: partos.data ?? [],
      };
    },
  });

  const dados = query.data;
  const meses = useMemo(() => {
    const lista = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(new Date().getFullYear(), new Date().getMonth() - 11 + i, 1);
      return { chave: mesLocalISO(d), mes: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""), atual: i === 11, receitas: 0, despesas: 0, resultado: 0, leite: 0 };
    });
    const fin = new Map((dados?.financas ?? []).map((r) => [String(r.mes).slice(0, 7), r]));
    const lt = new Map((dados?.leite ?? []).map((r) => [String(r.mes).slice(0, 7), r]));
    for (const m of lista) {
      const f = fin.get(m.chave);
      m.receitas = Number(f?.receitas ?? 0);
      m.despesas = Number(f?.despesas ?? 0);
      m.resultado = m.receitas - m.despesas;
      m.leite = Number(lt.get(m.chave)?.total_litros ?? 0);
    }
    return lista;
  }, [dados]);

  const s = dados?.resumo ?? {};
  const n = (k: string) => Number(s[k] ?? 0);
  const carregando = query.isLoading;
  const v = (x: number, fmt = inteiro) => (carregando ? "…" : fmt(x));
  const hoje = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const temLeite = meses.some((m) => m.leite);
  const temDinheiro = meses.some((m) => m.receitas || m.despesas);
  const listaAvisos = avisos.data?.avisos ?? [];
  const abrir = (secao: string, novo: string) => (lancar ? lancar(secao, novo) : go(secao));

  const brincos = [
    { valor: n("animais_ativos"), legenda: "animais ativos", secao: "rebanho" },
    { valor: n("leite_hoje"), legenda: "litros de leite hoje", secao: "producao" },
    { valor: n("vacinas_vencidas"), legenda: "vacinas atrasadas", secao: "vacinacao" },
    { valor: n("partos_30d"), legenda: "partos em 30 dias", secao: "agenda" },
  ];

  return (
    <div className="space-y-6">
      {perfil.data?.banner_url && (
        <StorageImage bucket={BUCKETS.banners} path={perfil.data.banner_url} alt={`Banner da ${propertyName}`} className="h-28 w-full rounded-2xl object-cover sm:h-36" fallback={null} />
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="titulo-pagina break-words">{propertyName}</h1>
          <p className="mt-2 text-muted-foreground"><span className="first-letter:uppercase inline-block">{hoje}</span>. O resumo da fazenda hoje.</p>
        </div>
        <Button className="hidden h-12 px-5 text-base sm:inline-flex" onClick={() => abrir("producao", "1")}><Milk />Registrar leite</Button>
      </div>

      {query.error && (
        <div role="alert" className="aviso-barra rounded-xl bg-alerta-fundo px-4 py-3 text-alerta">
          <p className="font-bold text-foreground">Não foi possível carregar o resumo.</p>
          <Button variant="outline" className="mt-2 h-10" onClick={() => void query.refetch()}>Tentar de novo</Button>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <section aria-label="Números principais" className="painel grid grid-cols-2 gap-y-6 px-2 py-6 sm:grid-cols-4">
            {brincos.map((b, i) => (
              <button
                key={b.legenda}
                type="button"
                onClick={() => go(b.secao)}
                className="group flex flex-col items-center rounded-xl px-1 py-1 hover:bg-accent"
                aria-label={`${carregando ? "Carregando" : b.valor.toLocaleString("pt-BR")} ${b.legenda}. Abrir.`}
              >
                <Brinco valor={v(b.valor, b.secao === "producao" ? (x) => compacto(x) : inteiro)} legenda={b.legenda} balancar={!carregando} atrasoMs={i * 80} />
              </button>
            ))}
          </section>

          <section className="painel p-4 sm:p-5" aria-labelledby="atencao">
            <h2 id="atencao" className="titulo-secao">Precisa de atenção</h2>
            {avisos.isLoading ? (
              <p className="mt-3 text-muted-foreground">Conferindo…</p>
            ) : listaAvisos.length === 0 ? (
              <p className="mt-3 flex items-center gap-2 text-muted-foreground"><CheckCircle2 className="size-5 text-primary" />Nada atrasado. Bom trabalho.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {listaAvisos.map((a) => {
                  const Icone = ICONE_AVISO[a.nivel];
                  return (
                    <li key={a.chave} className={`aviso-barra flex flex-col gap-3 rounded-xl bg-muted/50 py-3 pr-3 sm:flex-row sm:items-center ${COR_AVISO[a.nivel]}`}>
                      <div className="flex min-w-0 flex-1 gap-2 text-foreground">
                        <Icone className={`mt-0.5 size-5 shrink-0 ${COR_AVISO[a.nivel]}`} />
                        <div className="min-w-0">
                          <p className="font-bold leading-snug">{a.titulo}</p>
                          <p className="text-sm text-muted-foreground">{a.texto}</p>
                        </div>
                      </div>
                      <Button variant="outline" className="h-11 shrink-0 self-start sm:self-center" onClick={() => go(a.secao)}>Resolver</Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <GraficoMeses
              titulo="Leite por mês"
              resumo={`Este mês: ${inteiro(meses[11]?.leite ?? 0)} litros`}
              vazio="Nenhum leite registrado nos últimos 12 meses."
              carregando={carregando}
              tem={temLeite}
              dados={meses}
              campo="leite"
              formato={(x) => `${inteiro(x)} L`}
              aoVazio={{ label: "Registrar o leite de hoje", onClick: () => abrir("producao", "1") }}
            />
            <GraficoMeses
              titulo="Resultado por mês"
              resumo={`Este mês: ${money(meses[11]?.resultado ?? 0)}`}
              explicacao="Receitas menos despesas e investimentos. Barra para baixo é mês no prejuízo."
              vazio="Nenhum lançamento de dinheiro nos últimos 12 meses."
              carregando={carregando}
              tem={temDinheiro}
              dados={meses}
              campo="resultado"
              formato={(x) => money(x)}
              aoVazio={{ label: "Lançar uma receita ou despesa", onClick: () => abrir("financeiro", "1") }}
            />
          </div>
        </div>

        <aside className="min-w-0 space-y-6" aria-label="Agenda e atalhos">
          <section className="painel p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="titulo-secao">Esta semana</h2>
              <Button variant="ghost" className="h-10" onClick={() => go("agenda")}>Ver agenda</Button>
            </div>
            {dados?.semana == null ? (
              <p className="mt-3 text-muted-foreground">{carregando ? "Carregando…" : "A agenda não abriu agora."}</p>
            ) : dados.semana.length === 0 ? (
              <p className="mt-3 text-muted-foreground">Nada marcado para os próximos 7 dias.</p>
            ) : (
              <ul className="mt-3 divide-y divide-border">
                {dados.semana.map((e, i) => (
                  <li key={`${e.tipo}-${e.data}-${i}`} className="flex min-h-14 items-center gap-3 py-2">
                    <span className="w-14 shrink-0 text-center">
                      <span className="block font-display text-2xl font-extrabold leading-none">{formatarDataBR(e.data).slice(0, 5)}</span>
                      <span className="block text-xs text-muted-foreground">{ROTULO_TIPO[e.tipo]}</span>
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-bold">{e.titulo}</span>
                      <span className="block truncate text-sm text-muted-foreground">{e.detalhe ?? "—"}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="painel p-4 sm:p-5">
            <h2 className="titulo-secao">Partos previstos</h2>
            {(dados?.partos ?? []).length === 0 ? (
              <p className="mt-3 text-muted-foreground">{carregando ? "Carregando…" : "Nenhuma vaca com parto previsto."}</p>
            ) : (
              <ul className="mt-3 divide-y divide-border">
                {(dados?.partos ?? []).map((p) => {
                  const a = (p.animais ?? null) as unknown as { nome: string | null; numero_brinco: string } | null;
                  return (
                    <li key={p.id} className="flex min-h-14 items-center gap-3 py-2">
                      {a?.numero_brinco ? <Brinco tamanho="pequeno" valor={a.numero_brinco} /> : null}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-bold">{a?.nome || (a ? `Brinco ${a.numero_brinco}` : "Vaca")}</span>
                        <span className="block text-sm text-muted-foreground">Previsto para {formatarDataBR(p.previsao_parto)}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="painel p-4 sm:p-5">
            <h2 className="titulo-secao">Atalhos</h2>
            <div className="mt-3 grid gap-2">
              <Button variant="outline" className="h-12 justify-start text-base" onClick={() => abrir("rebanho", "1")}><Plus />Cadastrar animal</Button>
              <Button variant="outline" className="h-12 justify-start text-base" onClick={() => abrir("producao", "1")}><Milk />Registrar leite</Button>
              <Button variant="outline" className="h-12 justify-start text-base" onClick={() => abrir("vacinacao", "1")}><Syringe />Registrar vacina</Button>
              <Button variant="outline" className="h-12 justify-start text-base" onClick={() => abrir("bezerros", "1")}><Scale />Registrar pesagem</Button>
              <Button variant="outline" className="h-12 justify-start text-base" onClick={() => abrir("producao", "anotacao")}><NotebookPen />Fazer uma anotação</Button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

type Mes = { chave: string; mes: string; atual: boolean; leite: number; resultado: number; receitas: number; despesas: number };

/**
 * Colunas dos últimos 12 meses com o mês atual em destaque (os outros num tom mais claro).
 * Uma série só: o título diz o que é, sem legenda. No resultado, barra para baixo = prejuízo.
 */
function GraficoMeses({
  titulo, resumo, explicacao, vazio, carregando, tem, dados, campo, formato, aoVazio,
}: {
  titulo: string; resumo: string; explicacao?: string; vazio: string; carregando: boolean; tem: boolean;
  dados: Mes[]; campo: "leite" | "resultado"; formato: (x: number) => string; aoVazio: { label: string; onClick: () => void };
}) {
  const cor = (m: Mes) => {
    const negativo = m[campo] < 0;
    if (m.atual) return negativo ? "var(--grafico-negativo)" : "var(--grafico-positivo)";
    return negativo ? "var(--grafico-negativo-fraco)" : "var(--grafico-positivo-fraco)";
  };
  return (
    <section className="painel min-w-0 p-4 sm:p-5">
      <h2 className="titulo-secao">{titulo}</h2>
      <p className="mt-1 font-bold tabular-nums">{carregando ? "…" : resumo}</p>
      {explicacao && <p className="text-sm text-muted-foreground">{explicacao}</p>}
      {carregando ? (
        <div className="mt-4 h-56 animate-pulse rounded-xl bg-muted" />
      ) : !tem ? (
        <Empty message={vazio} action={aoVazio} />
      ) : (
        <div className="mt-4 h-56" role="img" aria-label={`${titulo}: ${dados.map((m) => `${m.mes} ${formato(m[campo])}`).join("; ")}`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dados} margin={{ left: 0, right: 4, top: 4, bottom: 0 }} barCategoryGap="22%">
              <CartesianGrid stroke="var(--linha)" vertical={false} />
              <XAxis dataKey="mes" ticks={[dados[0]?.mes, dados[4]?.mes, dados[8]?.mes, dados[11]?.mes].filter(Boolean) as string[]} tick={{ fill: "var(--muted-foreground)", fontSize: 13 }} axisLine={false} tickLine={false} tickMargin={6} />
              <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 13 }} axisLine={false} tickLine={false} tickFormatter={(x: number) => compacto(x)} width={60} />
              {campo === "resultado" && <ReferenceLine y={0} stroke="var(--linha-forte)" />}
              <Tooltip
                cursor={{ fill: "var(--muted)", opacity: 0.6 }}
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 14, color: "var(--foreground)" }}
                labelStyle={{ fontWeight: 700 }}
                formatter={(x, _n, item) => {
                  const m = (item as { payload?: Mes } | undefined)?.payload;
                  return campo === "resultado" && m
                    ? [`${money(x)} (receitas ${money(m.receitas)}, despesas ${money(m.despesas)})`, "Resultado"]
                    : [formato(Number(x)), "Leite"];
                }}
              />
              <Bar dataKey={campo} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                {dados.map((m) => <Cell key={m.chave} fill={cor(m)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

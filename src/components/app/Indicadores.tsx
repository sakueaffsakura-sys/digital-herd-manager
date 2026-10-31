import { useQuery } from "@tanstack/react-query";
import { Baby, Droplets, Scale, Wallet } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { formatarDataBR } from "@/lib/datas";
import { palavraPlural, plural } from "@/lib/texto";
import { Empty, PageTitle, money } from "./shared";

type Indicadores = {
  hoje: string;
  reproducao: {
    inseminacoes_ano: number; confirmadas: number; falhou: number; em_andamento: number;
    taxa_prenhez: number | null; intervalo_partos_dias: number | null; idade_primeiro_parto_meses: number | null;
    nascidos_ano: number; taxa_natalidade: number | null;
  };
  peso: { ganho_kg_dia: number | null; animais_pesados: number; peso_medio_kg: number | null };
  leite: {
    litros_30d: number; litros_dia: number | null; vacas_ordenhadas: number; litros_por_vaca_dia: number | null;
    preco_medio_litro: number | null; litros_mes: number; custo_por_litro: number | null;
  };
  dinheiro: { receitas_mes: number; despesas_mes: number; investimentos_mes: number; resultado_mes: number };
  rebanho: { ativos: number; femeas: number; machos: number; matrizes: number; crias_ano: number; perdas_ano: number; taxa_mortalidade: number | null };
};

const num = (v: number | null | undefined, casas = 1) => (v == null ? "—" : Number(v).toLocaleString("pt-BR", { maximumFractionDigits: casas, minimumFractionDigits: 0 }));
const pct = (v: number | null | undefined) => (v == null ? "—" : `${num(v, 1)}%`);

/** Um número com explicação em palavras simples e, quando dá, uma leitura do que ele significa. */
function Indicador({ titulo, valor, unidade, explica, leitura, bom }: {
  titulo: string; valor: string; unidade?: string; explica: string; leitura?: string; bom?: boolean | null;
}) {
  return (
    <li className="painel p-4">
      <p className="text-sm font-bold text-muted-foreground">{titulo}</p>
      <p className="mt-1.5 font-display text-[2.1rem] font-extrabold leading-none tabular-nums">
        {valor}
        {unidade && valor !== "—" && <span className="ml-1 font-sans text-base font-bold text-muted-foreground">{unidade}</span>}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">{explica}</p>
      {leitura && (
        <p className={`mt-2 text-sm font-bold ${bom == null ? "text-muted-foreground" : bom ? "text-primary" : "text-aviso"}`}>{leitura}</p>
      )}
    </li>
  );
}

function Secao({ titulo, icone: Icone, children }: { titulo: string; icone: typeof Scale; children: React.ReactNode }) {
  return (
    <section className="mt-8 first:mt-0">
      <h2 className="titulo-secao flex items-center gap-2"><Icone className="size-6 text-primary" />{titulo}</h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{children}</ul>
    </section>
  );
}

/**
 * Indicadores: as contas que mostram se a fazenda está indo bem. Tudo sai de uma leitura só
 * no banco (indicadores_propriedade), com as regras de acesso de quem está olhando.
 */
export default function Indicadores({ propertyId }: { propertyId: string | null }) {
  const q = useQuery({
    queryKey: ["indicadores", propertyId],
    enabled: !!propertyId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Indicadores | null> => {
      const { data, error } = await supabase.rpc("indicadores_propriedade", { _propriedade_id: propertyId! });
      if (error) throw error;
      return (data ?? null) as unknown as Indicadores | null;
    },
  });
  const d = q.data;
  const r = d?.reproducao, p = d?.peso, l = d?.leite, m = d?.dinheiro, reb = d?.rebanho;
  const semDados = !!d && (reb?.ativos ?? 0) === 0;

  const dinheiro = m ? [
    { nome: "Receitas", valor: Number(m.receitas_mes), cor: "var(--grafico-positivo)" },
    { nome: "Despesas", valor: -Number(m.despesas_mes), cor: "var(--grafico-negativo)" },
    { nome: "Resultado", valor: Number(m.resultado_mes), cor: Number(m.resultado_mes) >= 0 ? "var(--grafico-positivo)" : "var(--grafico-negativo)" },
  ] : [];

  return (
    <div>
      <PageTitle title="Indicadores" description="As contas que mostram se a fazenda está indo bem. Os números vêm do que você já lançou." />
      {q.isLoading ? <p className="text-muted-foreground">Carregando…</p> : q.isError ? (
        <p role="alert" className="text-alerta">Não foi possível calcular os indicadores agora. Tente de novo daqui a pouco.</p>
      ) : semDados ? (
        <Empty message="Ainda não há animais cadastrados nesta propriedade. Cadastre o rebanho e lance pesagens, leite e vacinas para os indicadores aparecerem." />
      ) : !d ? (
        <Empty message="Sem acesso aos dados desta propriedade." />
      ) : (
        <>
          <Secao titulo="Reprodução" icone={Baby}>
            <Indicador
              titulo="Taxa de prenhez (12 meses)" valor={pct(r!.taxa_prenhez)}
              explica={`De ${plural(r!.inseminacoes_ano, "inseminação", "inseminações")} no ano, ${r!.confirmadas} ${palavraPlural(r!.confirmadas, "deu", "deram")} prenhez e ${r!.falhou} ${palavraPlural(r!.falhou, "falhou", "falharam")}. ${r!.em_andamento} ainda ${palavraPlural(r!.em_andamento, "aguarda", "aguardam")} resultado.`}
              leitura={r!.taxa_prenhez == null ? undefined : r!.taxa_prenhez >= 50 ? "Bom: metade ou mais das coberturas pegou." : "Abaixo de 50%: vale rever a hora do cio, o sêmen e a nutrição."}
              bom={r!.taxa_prenhez == null ? null : r!.taxa_prenhez >= 50}
            />
            <Indicador
              titulo="Intervalo entre partos" valor={num(r!.intervalo_partos_dias, 0)} unidade="dias"
              explica="Tempo médio entre uma cria e a seguinte, na mesma vaca."
              leitura={r!.intervalo_partos_dias == null ? "Precisa de pelo menos duas crias da mesma vaca registradas." : r!.intervalo_partos_dias <= 420 ? "Bom: até 420 dias é um intervalo saudável." : "Acima de 420 dias: a vaca está demorando a emprenhar de novo."}
              bom={r!.intervalo_partos_dias == null ? null : r!.intervalo_partos_dias <= 420}
            />
            <Indicador
              titulo="Idade ao primeiro parto" valor={num(r!.idade_primeiro_parto_meses, 1)} unidade="meses"
              explica="Com quantos meses, em média, a novilha teve a primeira cria."
              leitura={r!.idade_primeiro_parto_meses == null ? "Precisa da data de nascimento da vaca e do registro da primeira cria." : r!.idade_primeiro_parto_meses <= 30 ? "Bom: até 30 meses a novilha começa a se pagar cedo." : "Acima de 30 meses: a novilha fica muito tempo sem produzir."}
              bom={r!.idade_primeiro_parto_meses == null ? null : r!.idade_primeiro_parto_meses <= 30}
            />
            <Indicador
              titulo="Crias no ano" valor={num(r!.nascidos_ano, 0)} unidade={palavraPlural(r!.nascidos_ano, "cria")}
              explica={`Nascimentos registrados nos últimos 12 meses, com ${plural(reb!.matrizes, "matriz", "matrizes")} no rebanho.`}
              leitura={r!.taxa_natalidade == null ? undefined : `${pct(r!.taxa_natalidade)} em relação às matrizes.`}
              bom={r!.taxa_natalidade == null ? null : r!.taxa_natalidade >= 70}
            />
          </Secao>

          <Secao titulo="Peso" icone={Scale}>
            <Indicador
              titulo="Ganho de peso por dia" valor={num(p!.ganho_kg_dia, 3)} unidade="kg/dia"
              explica={`Média entre a primeira e a última pesagem de ${plural(p!.animais_pesados, "animal", "animais")} no último ano.`}
              leitura={p!.ganho_kg_dia == null ? "Pese cada animal pelo menos duas vezes, com 20 dias ou mais de diferença." : p!.ganho_kg_dia >= 0.5 ? "Bom: meio quilo por dia ou mais é um ganho firme." : "Abaixo de 0,5 kg/dia: vale olhar pasto, ração e vermifugação."}
              bom={p!.ganho_kg_dia == null ? null : p!.ganho_kg_dia >= 0.5}
            />
            <Indicador titulo="Peso médio atual" valor={num(p!.peso_medio_kg, 1)} unidade="kg" explica="Média da última pesagem de cada animal pesado no ano." />
            <Indicador
              titulo="Mortes e perdas no ano" valor={num(reb!.perdas_ano, 0)} unidade={palavraPlural(reb!.perdas_ano, "animal", "animais")}
              explica="Animais marcados como mortos ou perdidos nos últimos 12 meses."
              leitura={reb!.taxa_mortalidade == null ? undefined : `${pct(reb!.taxa_mortalidade)} do rebanho.`}
              bom={reb!.taxa_mortalidade == null ? null : reb!.taxa_mortalidade <= 3}
            />
          </Secao>

          <Secao titulo="Leite" icone={Droplets}>
            <Indicador
              titulo="Litros por vaca por dia" valor={num(l!.litros_por_vaca_dia, 1)} unidade="L"
              explica={`${plural(l!.vacas_ordenhadas, "vaca")} ${palavraPlural(l!.vacas_ordenhadas, "ordenhada")} nos últimos 30 dias.`}
              leitura={l!.litros_por_vaca_dia == null ? "Lance o leite por animal para ver a média por vaca." : l!.litros_por_vaca_dia >= 12 ? "Bom para rebanho leiteiro mestiço." : "Abaixo de 12 L: olhe alimentação, água e intervalo entre ordenhas."}
              bom={l!.litros_por_vaca_dia == null ? null : l!.litros_por_vaca_dia >= 12}
            />
            <Indicador titulo="Leite nos últimos 30 dias" valor={num(l!.litros_30d, 0)} unidade="L" explica={l!.litros_dia == null ? "Nada lançado nos últimos 30 dias." : `Média de ${num(l!.litros_dia, 1)} L por dia de entrega.`} />
            <Indicador
              titulo="Custo por litro (mês)" valor={l!.custo_por_litro == null ? "—" : money(l!.custo_por_litro)}
              explica="Todas as despesas do mês divididas pelos litros do mês."
              leitura={l!.custo_por_litro == null || l!.preco_medio_litro == null ? "Lance as despesas e o valor do litro para comparar." : l!.preco_medio_litro > l!.custo_por_litro ? `Você recebe ${money(l!.preco_medio_litro)} por litro: sobra ${money(l!.preco_medio_litro - l!.custo_por_litro)}.` : `Você recebe ${money(l!.preco_medio_litro)} por litro: está saindo mais caro do que o leite paga.`}
              bom={l!.custo_por_litro == null || l!.preco_medio_litro == null ? null : l!.preco_medio_litro > l!.custo_por_litro}
            />
          </Secao>

          <Secao titulo="Dinheiro do mês" icone={Wallet}>
            <Indicador titulo="Receitas" valor={money(m!.receitas_mes)} explica="Tudo que entrou neste mês." />
            <Indicador titulo="Despesas" valor={money(m!.despesas_mes)} explica="Tudo que saiu neste mês, sem contar investimentos." />
            <Indicador
              titulo="Resultado" valor={money(m!.resultado_mes)}
              explica={`Receitas menos despesas. Investimentos no mês: ${money(m!.investimentos_mes)}.`}
              leitura={Number(m!.resultado_mes) >= 0 ? "No azul neste mês." : "No vermelho neste mês."}
              bom={Number(m!.resultado_mes) >= 0}
            />
          </Secao>

          {dinheiro.some((x) => x.valor !== 0) && (
            <section className="painel mt-6 p-4 sm:p-5">
              <h3 className="text-[1.35rem] leading-tight">Entradas e saídas do mês</h3>
              <div className="mt-3 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dinheiro} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="nome" tick={{ fontSize: 13, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                    <YAxis width={70} tick={{ fontSize: 13, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => Number(v).toLocaleString("pt-BR", { notation: "compact" })} />
                    <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.4 }} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 14, color: "var(--foreground)" }} formatter={(v: number) => money(Math.abs(Number(v)))} />
                    <Bar dataKey="valor" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                      {dinheiro.map((x) => <Cell key={x.nome} fill={x.cor} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          <p className="mt-6 text-sm text-muted-foreground">
            Contas feitas com os registros até {formatarDataBR(d.hoje)}. Quanto mais você lançar (pesagens, leite, vacinas, nascimentos e dinheiro), mais certos ficam os números.
          </p>
        </>
      )}
    </div>
  );
}

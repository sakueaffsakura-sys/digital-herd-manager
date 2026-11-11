/**
 * Os indicadores da propriedade: reprodução, peso, leite, dinheiro e rebanho.
 *
 * É a tela que mais exige do banco, então a janela é curta de propósito: 12 meses para
 * quase tudo e 24 só para o intervalo entre partos, que precisa de dois ciclos.
 *
 * Duas regras valem para todos os números:
 *
 *   Número sem base é `null`, nunca zero. "Nenhuma pesagem" e "ganho de zero quilo por
 *   dia" são coisas diferentes, e a tela mostra um travessão no primeiro caso. Converter
 *   para zero aqui faria o produtor ler um resultado ruim onde não há resultado nenhum.
 *
 *   Valor fora do possível é descartado, não corrigido. Um intervalo de 3.000 dias entre
 *   partos ou um bezerro que nasceu antes da mãe é erro de digitação; entrar na média
 *   estragaria o número de toda a fazenda. Os limites são os mesmos do banco antigo.
 */
import { consultarUm, consultar, instanteUtc } from "./banco.server";
import { exigirPropriedade, type Quem } from "./acesso";
import { dataNoFuso, mesesAntes, primeiroDiaDe, inicioDoDiaNoFuso } from "@/lib/datas";

/**
 * Arredonda como o PostgreSQL: o meio vai para longe do zero (2,5 -> 3), e não para o
 * par mais próximo. Devolve `null` para o que não existe, para não inventar zero.
 */
const arred = (valor: unknown, casas = 0): number | null => {
  if (valor == null) return null;
  const n = Number(valor);
  if (!Number.isFinite(n)) return null;
  const f = 10 ** casas;
  return (n < 0 ? -1 : 1) * Math.round(Math.abs(n) * f + Number.EPSILON) / f;
};
const inteiro = (valor: unknown) => Number(valor ?? 0);
/** Divisão que admite não ter resposta: sem base, devolve `null` em vez de erro ou zero. */
const divisao = (de: number, por: number, casas: number) => (por > 0 ? arred(de / por, casas) : null);

export type Indicadores = {
  hoje: string;
  reproducao: Record<string, number | null>;
  peso: Record<string, number | null>;
  leite: Record<string, number | null>;
  dinheiro: Record<string, number | null>;
  rebanho: Record<string, number | null>;
};

export async function indicadoresPropriedade(quem: Quem, propriedadeId: string): Promise<Indicadores> {
  exigirPropriedade(quem, propriedadeId);
  const p = propriedadeId;
  const hoje = dataNoFuso();
  const ano = mesesAntes(hoje, 12);
  const doisAnos = mesesAntes(hoje, 24);
  const mesIni = primeiroDiaDe(hoje);

  const [ins, intervalos, idade, ganho, ultimoPeso, leite, leiteMes, dinheiro, rebanho, perdas, nascidos] = await Promise.all([
    // Inseminações do último ano, por situação.
    consultar<{ situacao: string; q: number }>(
      "SELECT situacao, COUNT(*) AS q FROM inseminacoes WHERE propriedade_id = ? AND data_inseminacao >= ? GROUP BY situacao",
      [p, ano],
    ),
    // Intervalo entre partos: a distância entre uma cria e a anterior, da mesma vaca.
    consultarUm<{ dias: number | null }>(
      `SELECT AVG(DATEDIFF(x.data_nascimento, x.anterior)) AS dias FROM (
         SELECT n.data_nascimento,
                LAG(n.data_nascimento) OVER (PARTITION BY n.vaca_id ORDER BY n.data_nascimento) AS anterior
         FROM nascimentos n
         WHERE n.propriedade_id = ? AND n.vaca_id IS NOT NULL AND n.data_nascimento >= ?
       ) x
       WHERE x.anterior IS NOT NULL AND DATEDIFF(x.data_nascimento, x.anterior) BETWEEN 250 AND 900`,
      [p, doisAnos],
    ),
    // Idade ao primeiro parto: a primeira cria de cada vaca que tem data de nascimento.
    consultarUm<{ meses: number | null }>(
      `SELECT AVG(DATEDIFF(x.parto, x.nasceu) / 30.4375) AS meses FROM (
         SELECT MIN(c.data_nascimento) AS parto, a.data_nascimento AS nasceu
         FROM nascimentos c JOIN animais a ON a.id = c.vaca_id
         WHERE c.propriedade_id = ? AND a.data_nascimento IS NOT NULL
         GROUP BY a.id, a.data_nascimento
       ) x
       WHERE x.parto > x.nasceu AND DATEDIFF(x.parto, x.nasceu) BETWEEN 400 AND 2200`,
      [p],
    ),
    // Ganho de peso: da primeira à última pesagem de cada animal, com 20 dias de intervalo
    // no mínimo — dois dias de diferença dariam um "ganho por dia" sem sentido.
    consultarUm<{ kg_dia: number | null; animais: number }>(
      `SELECT AVG((g.p2 - g.p1) / DATEDIFF(g.d2, g.d1)) AS kg_dia, COUNT(*) AS animais FROM (
         SELECT x.animal_id,
                MAX(CASE WHEN x.primeira = 1 THEN x.data END) AS d1,
                MAX(CASE WHEN x.primeira = 1 THEN x.peso_kg END) AS p1,
                MAX(CASE WHEN x.ultima = 1 THEN x.data END) AS d2,
                MAX(CASE WHEN x.ultima = 1 THEN x.peso_kg END) AS p2
         FROM (
           SELECT animal_id, data, peso_kg,
                  ROW_NUMBER() OVER (PARTITION BY animal_id ORDER BY data, created_at) AS primeira,
                  ROW_NUMBER() OVER (PARTITION BY animal_id ORDER BY data DESC, created_at DESC) AS ultima
           FROM pesagens
           WHERE propriedade_id = ? AND data >= ? AND peso_kg > 0
         ) x
         GROUP BY x.animal_id
         HAVING COUNT(*) >= 2 AND d2 > d1 AND DATEDIFF(d2, d1) >= 20
       ) g`,
      [p, ano],
    ),
    // Peso médio: a pesagem mais recente de cada animal, não a média de todas.
    consultarUm<{ media: number | null }>(
      `SELECT AVG(x.peso_kg) AS media FROM (
         SELECT peso_kg, ROW_NUMBER() OVER (PARTITION BY animal_id ORDER BY data DESC, created_at DESC) AS pos
         FROM pesagens WHERE propriedade_id = ? AND data >= ?
       ) x WHERE x.pos = 1`,
      [p, ano],
    ),
    consultarUm<{ litros_30d: number; vacas: number; dias: number; valor_30d: number }>(
      `SELECT COALESCE(SUM(litros), 0) AS litros_30d,
              COUNT(DISTINCT animal_id) AS vacas,
              COUNT(DISTINCT data) AS dias,
              COALESCE(SUM(valor_total), 0) AS valor_30d
       FROM producao_leite
       WHERE propriedade_id = ? AND data > DATE_SUB(?, INTERVAL 30 DAY) AND data <= ?`,
      [p, hoje, hoje],
    ),
    consultarUm<{ litros: number }>(
      "SELECT COALESCE(SUM(litros), 0) AS litros FROM producao_leite WHERE propriedade_id = ? AND data >= ? AND data <= ?",
      [p, mesIni, hoje],
    ),
    consultarUm<{ receitas: number; despesas: number; investimentos: number }>(
      `SELECT COALESCE(SUM(CASE WHEN tipo = 'receita' THEN valor END), 0) AS receitas,
              COALESCE(SUM(CASE WHEN tipo = 'despesa' THEN valor END), 0) AS despesas,
              COALESCE(SUM(CASE WHEN tipo = 'investimento' THEN valor END), 0) AS investimentos
       FROM movimentacoes_financeiras WHERE propriedade_id = ? AND data >= ? AND data <= ?`,
      [p, mesIni, hoje],
    ),
    consultarUm<{ ativos: number; femeas: number; machos: number; crias_ano: number; matrizes: number }>(
      `SELECT COUNT(*) AS ativos,
              SUM(sexo = 'F') AS femeas,
              SUM(sexo = 'M') AS machos,
              SUM(data_nascimento >= ?) AS crias_ano,
              SUM(data_nascimento IS NOT NULL AND data_nascimento < ? AND sexo = 'F') AS matrizes
       FROM animais WHERE propriedade_id = ? AND situacao = 'ativo'`,
      [ano, doisAnos, p],
    ),
    consultarUm<{ q: number }>(
      `SELECT COUNT(*) AS q FROM animais
       WHERE propriedade_id = ? AND situacao IN ('perdido', 'falecido') AND updated_at >= ?`,
      [p, instanteUtc(inicioDoDiaNoFuso(ano))],
    ),
    consultarUm<{ q: number }>(
      "SELECT COUNT(*) AS q FROM nascimentos WHERE propriedade_id = ? AND data_nascimento >= ?",
      [p, ano],
    ),
  ]);

  const quantas = (situacoes: string[]) =>
    ins.filter((i) => situacoes.includes(i.situacao)).reduce((s, i) => s + Number(i.q), 0);
  const inseminacoesAno = ins.reduce((s, i) => s + Number(i.q), 0);
  const pegaram = quantas(["confirmada", "parto_realizado"]);
  // A taxa de prenhez só olha o que já teve desfecho: o que está em andamento ainda não
  // acertou nem errou, e entrar na conta faria a taxa parecer pior do que é.
  const comDesfecho = inseminacoesAno - quantas(["em_andamento"]);

  const litros30 = Number(leite?.litros_30d ?? 0);
  const dias = Number(leite?.dias ?? 0);
  const vacas = Number(leite?.vacas ?? 0);
  const valor30 = Number(leite?.valor_30d ?? 0);
  const litrosMes = Number(leiteMes?.litros ?? 0);
  const receitas = Number(dinheiro?.receitas ?? 0);
  const despesas = Number(dinheiro?.despesas ?? 0);
  const ativos = Number(rebanho?.ativos ?? 0);
  const matrizes = Number(rebanho?.matrizes ?? 0);
  const perdidos = Number(perdas?.q ?? 0);
  const nasceram = Number(nascidos?.q ?? 0);

  return {
    hoje,
    reproducao: {
      inseminacoes_ano: inseminacoesAno,
      confirmadas: pegaram,
      falhou: quantas(["falhou"]),
      em_andamento: quantas(["em_andamento"]),
      taxa_prenhez: divisao(100 * pegaram, comDesfecho, 1),
      intervalo_partos_dias: arred(intervalos?.dias, 0),
      idade_primeiro_parto_meses: arred(idade?.meses, 1),
      nascidos_ano: nasceram,
      taxa_natalidade: divisao(100 * nasceram, matrizes, 1),
    },
    peso: {
      ganho_kg_dia: arred(ganho?.kg_dia, 3),
      animais_pesados: inteiro(ganho?.animais),
      peso_medio_kg: arred(ultimoPeso?.media, 1),
    },
    leite: {
      litros_30d: arred(litros30, 1),
      litros_dia: divisao(litros30, dias, 1),
      vacas_ordenhadas: vacas,
      litros_por_vaca_dia: vacas > 0 && dias > 0 ? arred(litros30 / vacas / dias, 1) : null,
      preco_medio_litro: litros30 > 0 && valor30 > 0 ? arred(valor30 / litros30, 2) : null,
      litros_mes: arred(litrosMes, 1),
      custo_por_litro: divisao(despesas, litrosMes, 2),
    },
    dinheiro: {
      receitas_mes: receitas,
      despesas_mes: despesas,
      investimentos_mes: Number(dinheiro?.investimentos ?? 0),
      resultado_mes: receitas - despesas,
    },
    rebanho: {
      ativos,
      femeas: inteiro(rebanho?.femeas),
      machos: inteiro(rebanho?.machos),
      matrizes,
      crias_ano: inteiro(rebanho?.crias_ano),
      perdas_ano: perdidos,
      taxa_mortalidade: divisao(100 * perdidos, ativos + perdidos, 2),
    },
  };
}

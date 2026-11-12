/**
 * Os números do Início (`dashboard_resumo`): o retrato da fazenda hoje e no mês.
 *
 * As chaves são exatamente as do banco antigo. Não é capricho: além da tela do Início,
 * leem daqui a Yui (o atendimento) e a rota do aplicativo Android
 * (`/api/public/app/resumo`). Uma chave com outro nome aqui é um número em branco lá.
 *
 * Mês é mês de Brasília, não do servidor. Para coluna de DATA basta comparar com texto;
 * para coluna de DATA E HORA, que o banco guarda em UTC, a comparação usa o instante em
 * que o mês começa no Brasil — às 00:00 de Brasília, que em UTC são 03:00. Sem isso, as
 * três primeiras horas do mês cairiam no mês anterior.
 */
import { consultarUm, instanteUtc } from "./banco.server";
import { exigirPropriedade, type Quem } from "./acesso";
import { ULTIMAS_DOSES, valoresDasDoses } from "./vacinas.server";
import { dataNoFuso, somarDias, primeiroDiaDe, primeiroDiaDoMesSeguinte, inicioDoDiaNoFuso } from "@/lib/datas";

const n = (v: unknown) => Number(v ?? 0);

export async function dashboardResumo(quem: Quem, propriedadeId: string): Promise<Record<string, number>> {
  exigirPropriedade(quem, propriedadeId);
  const p = propriedadeId;
  const hoje = dataNoFuso();
  const ini = primeiroDiaDe(hoje);
  const fim = primeiroDiaDoMesSeguinte(hoje);
  const iniTs = instanteUtc(inicioDoDiaNoFuso(ini));
  const fimTs = instanteUtc(inicioDoDiaNoFuso(fim));

  const um = <T extends Record<string, unknown>>(sql: string, valores: unknown[]) => consultarUm<T>(sql, valores);

  const [animais, bezerros, doses, insem, nasc, perdas, vendas, compras, dinheiro, leite, lotes, partos] = await Promise.all([
    um<{ total: number }>("SELECT COUNT(*) AS total FROM animais WHERE propriedade_id = ? AND situacao = 'ativo'", [p]),
    um<{ total: number }>(
      `SELECT COUNT(*) AS total FROM animais
       WHERE propriedade_id = ? AND situacao = 'ativo' AND data_nascimento >= DATE_SUB(?, INTERVAL 12 MONTH)`,
      [p, hoje],
    ),
    um<{ em_dia: number; vencidas: number }>(
      `SELECT SUM(d.status_atual = 'em_dia') AS em_dia,
              SUM(d.ultima_dose AND d.status_atual = 'vencida') AS vencidas
       FROM (${ULTIMAS_DOSES}) d`,
      valoresDasDoses(p, hoje),
    ),
    um<{ total: number }>(
      "SELECT COUNT(*) AS total FROM inseminacoes WHERE propriedade_id = ? AND situacao IN ('em_andamento', 'confirmada')",
      [p],
    ),
    um<{ total: number }>(
      "SELECT COUNT(*) AS total FROM nascimentos WHERE propriedade_id = ? AND data_nascimento >= ? AND data_nascimento < ?",
      [p, ini, fim],
    ),
    um<{ total: number }>(
      `SELECT COUNT(*) AS total FROM animais
       WHERE propriedade_id = ? AND situacao IN ('perdido', 'falecido') AND updated_at >= ? AND updated_at < ?`,
      [p, iniTs, fimTs],
    ),
    um<{ total: number }>("SELECT COUNT(*) AS total FROM vendas WHERE propriedade_id = ? AND data >= ? AND data < ?", [p, ini, fim]),
    um<{ total: number }>("SELECT COUNT(*) AS total FROM compras WHERE propriedade_id = ? AND data >= ? AND data < ?", [p, ini, fim]),
    um<{ receitas: number; despesas: number; investimentos: number }>(
      `SELECT COALESCE(SUM(CASE WHEN tipo = 'receita' THEN valor END), 0) AS receitas,
              COALESCE(SUM(CASE WHEN tipo IN ('despesa', 'investimento') THEN valor END), 0) AS despesas,
              COALESCE(SUM(CASE WHEN tipo = 'investimento' THEN valor END), 0) AS investimentos
       FROM movimentacoes_financeiras WHERE propriedade_id = ? AND data >= ? AND data < ?`,
      [p, ini, fim],
    ),
    um<{ mes: number; hoje: number; ontem: number }>(
      `SELECT COALESCE(SUM(CASE WHEN data >= ? AND data < ? THEN litros END), 0) AS mes,
              COALESCE(SUM(CASE WHEN data = ? THEN litros END), 0) AS hoje,
              COALESCE(SUM(CASE WHEN data = ? THEN litros END), 0) AS ontem
       FROM producao_leite WHERE propriedade_id = ?`,
      [ini, fim, hoje, somarDias(hoje, -1), p],
    ),
    um<{ total: number }>("SELECT COUNT(*) AS total FROM lotes WHERE propriedade_id = ?", [p]),
    um<{ total: number }>(
      `SELECT COUNT(*) AS total FROM inseminacoes
       WHERE propriedade_id = ? AND situacao IN ('em_andamento', 'confirmada') AND previsao_parto BETWEEN ? AND ?`,
      [p, hoje, somarDias(hoje, 30)],
    ),
  ]);

  return {
    total_animais: n(animais?.total),
    animais_ativos: n(animais?.total),
    bezerros: n(bezerros?.total),
    vacinacoes_em_dia: n(doses?.em_dia),
    inseminacoes: n(insem?.total),
    nascidos_mes: n(nasc?.total),
    perdas_mes: n(perdas?.total),
    vendas_mes: n(vendas?.total),
    compras_mes: n(compras?.total),
    receitas_mes: n(dinheiro?.receitas),
    despesas_mes: n(dinheiro?.despesas),
    investimentos_mes: n(dinheiro?.investimentos),
    leite_mes: n(leite?.mes),
    total_lotes: n(lotes?.total),
    leite_hoje: n(leite?.hoje),
    leite_ontem: n(leite?.ontem),
    vacinas_vencidas: n(doses?.vencidas),
    partos_30d: n(partos?.total),
  };
}

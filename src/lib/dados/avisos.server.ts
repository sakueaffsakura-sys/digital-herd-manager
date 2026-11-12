/**
 * A central de avisos do Início: o que precisa de atenção na fazenda hoje.
 *
 * No banco antigo era uma função SQL comprida (`central_avisos`). Aqui são dez consultas
 * pequenas montadas em JavaScript, de propósito: cada aviso fica junto da regra que o
 * gerou, dá para testar peça por peça, e o texto que o produtor lê não se perde no meio
 * de um `union all` de dez braços.
 *
 * Duas coisas precisam ficar iguais ao banco antigo, e não só parecidas:
 *
 *   A ordem. O aviso mais urgente aparece primeiro, e a lista vai de 1 a 10 na mesma
 *   sequência de antes (vacina atrasada em cima, assinatura embaixo).
 *
 *   A chave. É o que guarda o "já vi isso": quando a pessoa dispensa um aviso, a chave
 *   vai para `notificacoes`. A chave muda sozinha quando a situação muda (a quantidade ou
 *   a data entram nela), então dispensar "3 vacinas atrasadas" não esconde a quarta. Se a
 *   chave mudasse de formato aqui, tudo que foi dispensado voltaria a aparecer.
 *
 * Datas: o banco guarda data e hora em UTC, mas o dia que vale para o produtor é o de
 * Brasília. Por isso o "hoje" vem de `dataNoFuso()` e viaja como texto na consulta, em vez
 * do CURDATE() do servidor, que é UTC e viraria o dia seguinte depois das 21h.
 */
import { consultar, consultarUm, instanteUtc } from "./banco.server";
import { exigirPropriedade, type Quem } from "./acesso";
import { ULTIMAS_DOSES, valoresDasDoses } from "./vacinas.server";
import { dataNoFuso, somarDias, semanaISO, FUSO_PADRAO } from "@/lib/datas";

export type Aviso = { chave: string; nivel: "alerta" | "aviso" | "info"; secao: string; titulo: string; texto: string };

/** "2026-11-24" -> "24/11", sem passar por Date (sem erro de fuso). */
const diaMes = (iso: unknown) => {
  const t = String(iso ?? "");
  return t.length >= 10 ? `${t.slice(8, 10)}/${t.slice(5, 7)}` : "";
};
/** O que entra na chave: data em AAAA-MM-DD, ou texto vazio quando não existe. */
const soData = (valor: unknown) => (valor == null ? "" : String(valor).slice(0, 10));
const contagem = (titulo: (n: number) => string, n: number) => (n === 1 ? titulo(1) : titulo(n));
const reais = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

type Resumo = { qtd: number; a: string | null; total: number | null };
const zero: Resumo = { qtd: 0, a: null, total: null };

export async function centralAvisos(quem: Quem, propriedadeId: string): Promise<Aviso[]> {
  exigirPropriedade(quem, propriedadeId);
  const hoje = dataNoFuso();
  const p = propriedadeId;
  const agora = new Date();

  const resumo = async (sql: string, valores: unknown[]): Promise<Resumo> => {
    const linha = await consultarUm<{ qtd: number; a: string | null; total: number | null }>(sql, valores);
    return {
      qtd: Number(linha?.qtd ?? 0),
      a: linha?.a == null ? null : String(linha.a),
      total: linha?.total == null ? null : Number(linha.total),
    };
  };

  const [vacina, carencia, parto, retorno, tarefa, conta, leite, documento, pesagem, assinatura] = await Promise.all([
    // 1. Vacina cuja próxima dose já passou — só a última dose de cada vacina conta.
    resumo(
      `SELECT COUNT(*) AS qtd, MAX(d.proxima_aplicacao) AS a, NULL AS total
       FROM (${ULTIMAS_DOSES}) d
       WHERE d.ultima_dose AND d.status_atual = 'vencida'`,
      valoresDasDoses(p, hoje),
    ),
    // 2. Carência do leite: enquanto não passa, o leite daquele animal não pode ser vendido.
    resumo(
      `SELECT COUNT(*) AS qtd, MAX(DATE_ADD(data, INTERVAL carencia_leite DAY)) AS a, NULL AS total
       FROM tratamentos
       WHERE propriedade_id = ? AND COALESCE(carencia_leite, 0) > 0
         AND DATE_ADD(data, INTERVAL carencia_leite DAY) >= ?`,
      [p, hoje],
    ),
    // 3. Parto previsto nos próximos 15 dias.
    resumo(
      `SELECT COUNT(*) AS qtd, MIN(previsao_parto) AS a, NULL AS total FROM inseminacoes
       WHERE propriedade_id = ? AND situacao IN ('em_andamento', 'confirmada')
         AND previsao_parto BETWEEN ? AND ?`,
      [p, hoje, somarDias(hoje, 15)],
    ),
    // 4. Tratamento para reaplicar ou reavaliar nos próximos 3 dias.
    resumo(
      `SELECT COUNT(*) AS qtd, MIN(retorno) AS a, NULL AS total FROM tratamentos
       WHERE propriedade_id = ? AND status <> 'Resolvido' AND retorno BETWEEN ? AND ?`,
      [p, hoje, somarDias(hoje, 3)],
    ),
    // 5. Tarefa cuja data já passou.
    resumo(
      `SELECT COUNT(*) AS qtd, MIN(data) AS a, NULL AS total FROM tarefas
       WHERE propriedade_id = ? AND status <> 'Concluída' AND data < ?`,
      [p, hoje],
    ),
    // 6. Conta a pagar vencendo nesta semana (inclui a que já venceu).
    resumo(
      `SELECT COUNT(*) AS qtd, MIN(vencimento) AS a, SUM(valor) AS total FROM contas
       WHERE propriedade_id = ? AND status = 'Aberta' AND tipo = 'A pagar' AND vencimento <= ?`,
      [p, somarDias(hoje, 7)],
    ),
    // 7. Queda do leite: últimos 7 dias contra os 7 anteriores.
    consultarUm<{ atual: number; anterior: number }>(
      `SELECT COALESCE(SUM(CASE WHEN data BETWEEN ? AND ? THEN litros END), 0) AS atual,
              COALESCE(SUM(CASE WHEN data BETWEEN ? AND ? THEN litros END), 0) AS anterior
       FROM producao_leite WHERE propriedade_id = ? AND data BETWEEN ? AND ?`,
      [somarDias(hoje, -7), somarDias(hoje, -1), somarDias(hoje, -14), somarDias(hoje, -8),
       p, somarDias(hoje, -14), somarDias(hoje, -1)],
    ),
    // 8. Documento vencendo em 30 dias.
    resumo(
      `SELECT COUNT(*) AS qtd, MIN(vencimento) AS a, NULL AS total FROM documentos
       WHERE propriedade_id = ? AND vencimento BETWEEN ? AND ?`,
      [p, hoje, somarDias(hoje, 30)],
    ),
    // 9. Animal jovem (até 24 meses) sem pesagem há mais de 60 dias.
    resumo(
      `SELECT COUNT(*) AS qtd, NULL AS a, NULL AS total FROM animais a
       WHERE a.propriedade_id = ? AND a.situacao = 'ativo'
         AND a.data_nascimento >= DATE_SUB(?, INTERVAL 24 MONTH)
         AND NOT EXISTS (
           SELECT 1 FROM pesagens g
           WHERE g.animal_id = a.id AND g.data >= DATE_SUB(?, INTERVAL 60 DAY)
         )`,
      [p, hoje, hoje],
    ),
    // 10. Assinatura Premium vencendo em 7 dias.
    consultarUm<{ venc: Date | string | null }>(
      `SELECT MIN(data_expiracao) AS venc FROM assinaturas
       WHERE propriedade_id = ? AND plano = 'premium' AND status IN ('ativo', 'trial')
         AND data_expiracao BETWEEN ? AND ?`,
      [p, instanteUtc(agora), instanteUtc(new Date(agora.getTime() + 7 * 86_400_000))],
    ),
  ]);

  const avisos: Aviso[] = [];
  const por = (aviso: Aviso) => avisos.push(aviso);

  if (vacina.qtd > 0) {
    por({
      chave: `vacinas_atrasadas:${vacina.qtd}:${soData(vacina.a)}`,
      nivel: "alerta",
      secao: "vacinacao",
      titulo: contagem((n) => (n === 1 ? "1 vacina atrasada" : `${n} vacinas atrasadas`), vacina.qtd),
      texto: "A data da próxima dose já passou. Aplique e registre para sair da lista.",
    });
  }
  if (carencia.qtd > 0) {
    por({
      chave: `carencia_leite:${carencia.qtd}:${soData(carencia.a)}`,
      nivel: "alerta",
      secao: "tratamentos",
      titulo: contagem((n) => (n === 1 ? "Leite em carência de remédio" : `${n} tratamentos com o leite em carência`), carencia.qtd),
      texto: `O leite não pode ser vendido até ${diaMes(carencia.a)}. Ordenhe por último e descarte.`,
    });
  }
  if (parto.qtd > 0) {
    por({
      chave: `partos_15d:${parto.qtd}:${soData(parto.a)}`,
      nivel: "aviso",
      secao: "agenda",
      titulo: contagem((n) => (n === 1 ? "1 parto nos próximos 15 dias" : `${n} partos nos próximos 15 dias`), parto.qtd),
      texto: `O primeiro está previsto para ${diaMes(parto.a)}. Prepare a maternidade.`,
    });
  }
  if (retorno.qtd > 0) {
    por({
      chave: `retorno_tratamento:${retorno.qtd}:${soData(retorno.a)}`,
      nivel: "aviso",
      secao: "tratamentos",
      titulo: contagem((n) => (n === 1 ? "1 tratamento para reavaliar" : `${n} tratamentos para reavaliar`), retorno.qtd),
      texto: `O primeiro é em ${diaMes(retorno.a)}. Reaplicar ou reavaliar conforme a orientação.`,
    });
  }
  if (tarefa.qtd > 0) {
    por({
      chave: `tarefa_atrasada:${tarefa.qtd}:${soData(tarefa.a)}`,
      nivel: "aviso",
      secao: "tarefas",
      titulo: contagem((n) => (n === 1 ? "1 tarefa atrasada" : `${n} tarefas atrasadas`), tarefa.qtd),
      texto: `A mais antiga era para ${diaMes(tarefa.a)}. Conclua ou mude a data.`,
    });
  }
  if (conta.qtd > 0) {
    por({
      chave: `conta_vencendo:${conta.qtd}:${soData(conta.a)}`,
      nivel: "aviso",
      secao: "contas",
      titulo: contagem((n) => (n === 1 ? "1 conta a pagar nesta semana" : `${n} contas a pagar nesta semana`), conta.qtd),
      texto: `Somam ${reais(conta.total ?? 0)}. A primeira vence em ${diaMes(conta.a)}.`,
    });
  }
  const atual = Number(leite?.atual ?? 0);
  const anterior = Number(leite?.anterior ?? 0);
  if (anterior > 0 && atual < anterior * 0.8) {
    por({
      chave: `queda_leite:${somarDias(hoje, -1)}`,
      nivel: "aviso",
      secao: "producao",
      titulo: `O leite caiu ${Math.round(100 - (atual * 100) / anterior)}% nesta semana`,
      texto: `Foram ${Math.round(atual)} litros nos últimos 7 dias, contra ${Math.round(anterior)} na semana anterior.`,
    });
  }
  if (documento.qtd > 0) {
    por({
      chave: `documento_vencendo:${documento.qtd}:${soData(documento.a)}`,
      nivel: "info",
      secao: "documentos",
      titulo: contagem((n) => (n === 1 ? "1 documento vence neste mês" : `${n} documentos vencem neste mês`), documento.qtd),
      texto: `O primeiro vence em ${diaMes(documento.a)}.`,
    });
  }
  if (pesagem.qtd > 0) {
    por({
      chave: `sem_pesagem:${pesagem.qtd}:${semanaISO(hoje)}`,
      nivel: "info",
      secao: "bezerros",
      titulo: contagem(
        (n) => (n === 1 ? "1 animal jovem sem pesagem há mais de 60 dias" : `${n} animais jovens sem pesagem há mais de 60 dias`),
        pesagem.qtd,
      ),
      texto: "Pesar a cada 30 a 60 dias mostra se estão ganhando peso como deveriam.",
    });
  }
  if (assinatura?.venc) {
    // A data de vencimento é um instante; o dia que a pessoa lê é o de Brasília.
    const diaBR = dataNoFuso(new Date(assinatura.venc as string | Date), FUSO_PADRAO);
    por({
      chave: `assinatura_vence:${diaBR}`,
      nivel: "aviso",
      secao: "assinatura",
      titulo: `Sua assinatura vence em ${diaMes(diaBR)}`,
      texto: "Renove para não perder os recursos Premium e a biblioteca.",
    });
  }

  // O que a pessoa já dispensou não volta.
  const dispensados = await consultar<{ chave: string }>(
    "SELECT chave FROM notificacoes WHERE user_id = ? AND chave IS NOT NULL",
    [quem.userId],
  );
  const jaVistos = new Set(dispensados.map((d) => d.chave));
  return avisos.filter((a) => !jaVistos.has(a.chave));
}

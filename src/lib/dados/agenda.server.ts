/**
 * A Agenda (`agenda_periodo`): o que tem data marcada num intervalo, mais duas listas de
 * apoio — as vacinas que já passaram da data e os animais jovens sem pesagem.
 *
 * Sete tipos de compromisso entram no mesmo calendário: vacina a vencer, parto previsto,
 * retorno de cio, tarefa, reavaliação de tratamento, conta e revisão de máquina. A tela
 * agrupa por dia e deixa esconder tipo por tipo, então cada evento sai com a mesma forma:
 * data, tipo, qual registro abrir, de qual animal é, título, detalhe, brinco e situação.
 *
 * O limite de 500 eventos é o do banco antigo, e `truncado` avisa a tela que sobrou coisa
 * de fora — um ano inteiro de uma fazenda grande não cabe numa lista rolável.
 */
import { consultar } from "./banco.server";
import { exigirPropriedade, AcessoNegado, type Quem } from "./acesso";
import { ULTIMAS_DOSES, valoresDasDoses } from "./vacinas.server";
import { dataNoFuso, somarDias, isoValido } from "@/lib/datas";

export type Evento = {
  data: string; tipo: "vacina" | "parto" | "cio" | "tarefa" | "retorno" | "conta" | "manutencao";
  registro_id: string; animal_id: string | null; titulo: string;
  detalhe: string | null; brinco: string | null; situacao: string | null;
};
type Atrasada = { data: string; registro_id: string; animal_id: string | null; titulo: string; detalhe: string | null; brinco: string | null };
type SemPesagem = { animal_id: string; nome: string | null; brinco: string; data_nascimento: string | null; ultima_pesagem: string | null };
export type Agenda = { eventos: Evento[]; truncado: boolean; atrasadas: Atrasada[]; sem_pesagem: SemPesagem[]; hoje: string };

const TETO = 500;
/** Mesma ordem do banco antigo: por dia e, dentro do dia, por tipo. */
const porDiaETipo = (a: Evento, b: Evento) => (a.data < b.data ? -1 : a.data > b.data ? 1 : a.tipo < b.tipo ? -1 : a.tipo > b.tipo ? 1 : 0);
const dia = (v: unknown) => String(v ?? "").slice(0, 10);

export async function agendaPeriodo(quem: Quem, propriedadeId: string, de: string, ate: string): Promise<Agenda> {
  exigirPropriedade(quem, propriedadeId);
  if (!isoValido(de) || !isoValido(ate)) throw new AcessoNegado("Diga o período com datas de verdade.");
  if (ate < de) throw new AcessoNegado("A data final não pode ser antes da inicial.");
  // Um período muito longo viraria uma leitura pesada para devolver algo que a tela corta.
  if (new Date(ate).getTime() - new Date(de).getTime() > 400 * 86_400_000) {
    throw new AcessoNegado("O período não pode passar de 400 dias.");
  }
  const p = propriedadeId;
  const hoje = dataNoFuso();
  const janela = [p, de, ate];

  const [vacinas, partos, cios, tarefas, retornos, contas, revisoes, atrasadas, semPesagem] = await Promise.all([
    // Vacina a vencer: só a última dose de cada vacina, que é a que ainda cobra reforço.
    consultar<Evento>(
      `SELECT d.proxima_aplicacao AS data, 'vacina' AS tipo, d.id AS registro_id, d.animal_id,
              tv.nome AS titulo,
              COALESCE(a.nome, a.numero_brinco, CONCAT('Lote ', l.nome)) AS detalhe,
              a.numero_brinco AS brinco, d.status_atual AS situacao
       FROM (${ULTIMAS_DOSES}) d
       JOIN tipos_vacinas tv ON tv.id = d.tipo_vacina_id
       LEFT JOIN animais a ON a.id = d.animal_id
       LEFT JOIN lotes l ON l.id = d.lote_id
       WHERE d.ultima_dose AND d.proxima_aplicacao BETWEEN ? AND ?`,
      [...valoresDasDoses(p, hoje), de, ate],
    ),
    consultar<Evento>(
      `SELECT i.previsao_parto AS data, 'parto' AS tipo, i.id AS registro_id, i.animal_id,
              'Parto previsto' AS titulo, COALESCE(a.nome, a.numero_brinco) AS detalhe,
              a.numero_brinco AS brinco, i.situacao
       FROM inseminacoes i JOIN animais a ON a.id = i.animal_id
       WHERE i.propriedade_id = ? AND i.situacao IN ('em_andamento', 'confirmada')
         AND i.previsao_parto BETWEEN ? AND ?`,
      janela,
    ),
    // Retorno de cio: 21 dias depois da inseminação, enquanto não se sabe se pegou.
    consultar<Evento>(
      `SELECT DATE_ADD(i.data_inseminacao, INTERVAL 21 DAY) AS data, 'cio' AS tipo, i.id AS registro_id, i.animal_id,
              'Observar retorno de cio' AS titulo, COALESCE(a.nome, a.numero_brinco) AS detalhe,
              a.numero_brinco AS brinco, i.situacao
       FROM inseminacoes i JOIN animais a ON a.id = i.animal_id
       WHERE i.propriedade_id = ? AND i.situacao = 'em_andamento'
         AND DATE_ADD(i.data_inseminacao, INTERVAL 21 DAY) BETWEEN ? AND ?`,
      janela,
    ),
    consultar<Evento>(
      `SELECT t.data, 'tarefa' AS tipo, t.id AS registro_id, t.animal_id, t.titulo,
              COALESCE(f.nome, t.setor, CONCAT('Lote ', l.nome)) AS detalhe,
              a.numero_brinco AS brinco, t.status AS situacao
       FROM tarefas t
       LEFT JOIN funcionarios f ON f.id = t.responsavel_id
       LEFT JOIN animais a ON a.id = t.animal_id
       LEFT JOIN lotes l ON l.id = t.lote_id
       WHERE t.propriedade_id = ? AND t.status <> 'Concluída' AND t.data BETWEEN ? AND ?`,
      janela,
    ),
    consultar<Evento>(
      `SELECT t.retorno AS data, 'retorno' AS tipo, t.id AS registro_id, t.animal_id,
              CONCAT('Reavaliar: ', t.descricao) AS titulo, t.medicamento AS detalhe,
              a.numero_brinco AS brinco, t.status AS situacao
       FROM tratamentos t LEFT JOIN animais a ON a.id = t.animal_id
       WHERE t.propriedade_id = ? AND t.status <> 'Resolvido' AND t.retorno BETWEEN ? AND ?`,
      janela,
    ),
    consultar<Evento>(
      `SELECT c.vencimento AS data, 'conta' AS tipo, c.id AS registro_id, NULL AS animal_id,
              c.descricao AS titulo, COALESCE(c.parte, c.tipo) AS detalhe,
              NULL AS brinco, c.status AS situacao
       FROM contas c
       WHERE c.propriedade_id = ? AND c.status = 'Aberta' AND c.vencimento BETWEEN ? AND ?`,
      janela,
    ),
    consultar<Evento>(
      `SELECT m.proxima_data AS data, 'manutencao' AS tipo, m.id AS registro_id, NULL AS animal_id,
              CONCAT('Revisão: ', q.nome) AS titulo, m.tipo AS detalhe,
              NULL AS brinco, NULL AS situacao
       FROM manutencoes m JOIN maquinas q ON q.id = m.maquina_id
       WHERE m.propriedade_id = ? AND m.proxima_data BETWEEN ? AND ?`,
      janela,
    ),
    // As que já passaram da data aparecem sempre, fora do período escolhido.
    consultar<Atrasada>(
      `SELECT d.proxima_aplicacao AS data, d.id AS registro_id, d.animal_id, tv.nome AS titulo,
              COALESCE(a.nome, a.numero_brinco, CONCAT('Lote ', l.nome)) AS detalhe, a.numero_brinco AS brinco
       FROM (${ULTIMAS_DOSES}) d
       JOIN tipos_vacinas tv ON tv.id = d.tipo_vacina_id
       LEFT JOIN animais a ON a.id = d.animal_id
       LEFT JOIN lotes l ON l.id = d.lote_id
       WHERE d.ultima_dose AND d.status_atual = 'vencida'
       ORDER BY d.proxima_aplicacao LIMIT 100`,
      valoresDasDoses(p, hoje),
    ),
    consultar<SemPesagem>(
      `SELECT a.id AS animal_id, a.nome, a.numero_brinco AS brinco, a.data_nascimento,
              (SELECT MAX(g.data) FROM pesagens g WHERE g.animal_id = a.id) AS ultima_pesagem
       FROM animais a
       WHERE a.propriedade_id = ? AND a.situacao = 'ativo'
         AND a.data_nascimento >= DATE_SUB(?, INTERVAL 24 MONTH)
         AND NOT EXISTS (
           SELECT 1 FROM pesagens g WHERE g.animal_id = a.id AND g.data >= DATE_SUB(?, INTERVAL 60 DAY)
         )
       ORDER BY a.data_nascimento LIMIT 100`,
      [p, hoje, hoje],
    ),
  ]);

  const todos = [...vacinas, ...partos, ...cios, ...tarefas, ...retornos, ...contas, ...revisoes]
    .map((e) => ({ ...e, data: dia(e.data) }))
    .sort(porDiaETipo);

  return {
    eventos: todos.slice(0, TETO),
    truncado: todos.length > TETO,
    atrasadas: atrasadas.map((a) => ({ ...a, data: dia(a.data) })),
    sem_pesagem: semPesagem.map((s) => ({
      ...s,
      data_nascimento: s.data_nascimento ? dia(s.data_nascimento) : null,
      ultima_pesagem: s.ultima_pesagem ? dia(s.ultima_pesagem) : null,
    })),
    hoje,
  };
}

/** O intervalo padrão de quem não disse nada: a semana que começa hoje. */
export const semanaDeHoje = (): [string, string] => {
  const hoje = dataNoFuso();
  return [hoje, somarDias(hoje, 7)];
};

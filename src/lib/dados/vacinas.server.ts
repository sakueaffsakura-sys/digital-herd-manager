/**
 * A situação de cada vacinação, que no banco antigo era a visão `v_vacinacoes_status`.
 *
 * A regra é a mesma: de todas as doses da mesma vacina para o mesmo animal (ou para o
 * mesmo lote, quando não é animal), só a última conta. Se depois dela veio um reforço, a
 * anterior virou "substituída" e não cobra mais nada de ninguém.
 *
 * O desempate é `data_aplicacao`, depois `created_at`, depois `id` — igual ao banco
 * antigo, para duas doses no mesmo dia darem o mesmo resultado nos dois lugares.
 */

/**
 * As vacinações de uma fazenda com a situação já calculada. Recebe a data de hoje (em
 * Brasília) como parâmetro, nunca o CURDATE() do servidor, que é UTC.
 *
 * Quem usa precisa passar os valores na ordem: propriedade_id, hoje, hoje.
 */
export const ULTIMAS_DOSES = `
  SELECT v.id, v.propriedade_id, v.animal_id, v.lote_id, v.tipo_vacina_id,
         v.data_aplicacao, v.proxima_aplicacao,
         CASE
           WHEN v.pos > 1 THEN 'substituida'
           WHEN v.proxima_aplicacao IS NULL THEN 'em_dia'
           WHEN v.proxima_aplicacao < ? THEN 'vencida'
           WHEN v.proxima_aplicacao <= DATE_ADD(?, INTERVAL 15 DAY) THEN 'proxima'
           ELSE 'em_dia'
         END AS status_atual,
         (v.pos = 1) AS ultima_dose
  FROM (
    SELECT w.*,
           ROW_NUMBER() OVER (
             PARTITION BY w.propriedade_id, w.tipo_vacina_id,
                          COALESCE(w.animal_id, CONCAT('lote:', w.lote_id), CONCAT('solta:', w.id))
             ORDER BY w.data_aplicacao DESC, w.created_at DESC, w.id DESC
           ) AS pos
    FROM vacinacoes w
    WHERE w.propriedade_id = ?
  ) v`;

/** Os valores de `ULTIMAS_DOSES`, na ordem em que a consulta os espera. */
export const valoresDasDoses = (propriedadeId: string, hoje: string) => [hoje, hoje, propriedadeId];

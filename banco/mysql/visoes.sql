-- As visões do banco antigo, refeitas em MySQL.
--
-- São resumos por mês e por lote que as telas leem direto. Escrito à mão, e não gerado:
-- visão é regra, não estrutura.
--
-- Duas coisas mudaram na tradução, e nenhuma delas muda o resultado:
--
--   `date_trunc('month', data)` virou `CAST(DATE_FORMAT(data, '%Y-%m-01') AS DATE)`. O
--   CAST importa: sem ele o "mês" volta como texto, e a tela compara mês com data.
--
--   `sum(valor) filter (where tipo = 'receita')` virou `SUM(CASE WHEN ... THEN valor END)`,
--   que é o mesmo cálculo com a escrita que o MySQL entende.
--
-- A visão de vacinação NÃO está aqui de propósito: ela depende de "hoje em Brasília", e
-- uma visão não recebe parâmetro. Quem faz esse cálculo é `src/lib/dados/vacinas.server.ts`,
-- que recebe a data de quem pergunta. Duas versões da mesma regra divergiriam.

DROP VIEW IF EXISTS `v_financeiro_mensal`;
CREATE VIEW `v_financeiro_mensal` AS
SELECT propriedade_id,
       CAST(DATE_FORMAT(data, '%Y-%m-01') AS DATE) AS mes,
       COALESCE(SUM(CASE WHEN tipo = 'receita' THEN valor END), 0) AS receitas,
       COALESCE(SUM(CASE WHEN tipo = 'despesa' THEN valor END), 0) AS despesas,
       COALESCE(SUM(CASE WHEN tipo = 'investimento' THEN valor END), 0) AS investimentos,
       COALESCE(SUM(CASE WHEN tipo = 'receita' THEN valor END), 0)
         - COALESCE(SUM(CASE WHEN tipo IN ('despesa', 'investimento') THEN valor END), 0) AS lucro
FROM movimentacoes_financeiras
GROUP BY propriedade_id, CAST(DATE_FORMAT(data, '%Y-%m-01') AS DATE);

DROP VIEW IF EXISTS `v_financeiro_por_categoria`;
CREATE VIEW `v_financeiro_por_categoria` AS
SELECT propriedade_id,
       CAST(DATE_FORMAT(data, '%Y-%m-01') AS DATE) AS mes,
       tipo,
       categoria,
       SUM(valor) AS total
FROM movimentacoes_financeiras
GROUP BY propriedade_id, CAST(DATE_FORMAT(data, '%Y-%m-01') AS DATE), tipo, categoria;

DROP VIEW IF EXISTS `v_producao_mensal`;
CREATE VIEW `v_producao_mensal` AS
SELECT propriedade_id,
       CAST(DATE_FORMAT(data, '%Y-%m-01') AS DATE) AS mes,
       SUM(litros) AS total_litros,
       AVG(litros) AS media_registro,
       SUM(valor_total) AS valor_total
FROM producao_leite
GROUP BY propriedade_id, CAST(DATE_FORMAT(data, '%Y-%m-01') AS DATE);

DROP VIEW IF EXISTS `v_producao_por_lote`;
CREATE VIEW `v_producao_por_lote` AS
SELECT p.propriedade_id,
       l.id AS lote_id,
       l.nome AS lote_nome,
       CAST(DATE_FORMAT(p.data, '%Y-%m-01') AS DATE) AS mes,
       SUM(p.litros) AS total_litros,
       SUM(p.valor_total) AS valor_total,
       COUNT(DISTINCT p.animal_id) AS vacas
FROM producao_leite p LEFT JOIN lotes l ON l.id = p.lote_id
GROUP BY p.propriedade_id, l.id, l.nome, CAST(DATE_FORMAT(p.data, '%Y-%m-01') AS DATE);

DROP VIEW IF EXISTS `v_animais_por_lote`;
CREATE VIEW `v_animais_por_lote` AS
SELECT l.propriedade_id,
       l.id AS lote_id,
       l.nome,
       CAST(COALESCE(SUM(a.situacao = 'ativo'), 0) AS SIGNED) AS quantidade
FROM lotes l LEFT JOIN animais a ON a.lote_id = l.id
GROUP BY l.propriedade_id, l.id, l.nome;

-- Escala Apecuária Digital (parte 4)
--  Agregações no banco: dashboard com contagens reais (sem limite 1.000),
--  relatório por período e tela de diagnóstico. Nada é somado no frontend.

-- ---------------------------------------------------------------------------
-- 1) dashboard_resumo estendida (mantém as chaves antigas e adiciona totais).
--    SECURITY INVOKER => RLS aplica. COUNT(*) exato, sem limite.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dashboard_resumo(_propriedade_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, private
AS $function$
SELECT jsonb_build_object(
 'total_animais',(SELECT COUNT(*) FROM public.animais WHERE propriedade_id=_propriedade_id),
 'animais_ativos',(SELECT COUNT(*) FROM public.animais WHERE propriedade_id=_propriedade_id AND situacao='ativo'),
 'bezerros',(SELECT COUNT(*) FROM public.animais WHERE propriedade_id=_propriedade_id AND situacao='ativo' AND data_nascimento >= current_date - interval '12 months'),
 'vacinacoes_em_dia',(SELECT COUNT(*) FROM public.v_vacinacoes_status WHERE propriedade_id=_propriedade_id AND status_calculado='em_dia'),
 'inseminacoes',(SELECT COUNT(*) FROM public.inseminacoes WHERE propriedade_id=_propriedade_id AND situacao IN ('em_andamento','confirmada')),
 'nascidos_mes',(SELECT COUNT(*) FROM public.nascimentos WHERE propriedade_id=_propriedade_id AND date_trunc('month',data_nascimento)=date_trunc('month',current_date)),
 'perdas_mes',(SELECT COUNT(*) FROM public.animais WHERE propriedade_id=_propriedade_id AND situacao IN ('perdido','falecido') AND date_trunc('month',updated_at)=date_trunc('month',current_date)),
 'vendas_mes',(SELECT COUNT(*) FROM public.vendas WHERE propriedade_id=_propriedade_id AND date_trunc('month',data)=date_trunc('month',current_date)),
 'compras_mes',(SELECT COUNT(*) FROM public.compras WHERE propriedade_id=_propriedade_id AND date_trunc('month',data)=date_trunc('month',current_date)),
 'receitas_mes',(SELECT COALESCE(SUM(valor),0) FROM public.movimentacoes_financeiras WHERE propriedade_id=_propriedade_id AND tipo='receita' AND date_trunc('month',data)=date_trunc('month',current_date)),
 'despesas_mes',(SELECT COALESCE(SUM(valor),0) FROM public.movimentacoes_financeiras WHERE propriedade_id=_propriedade_id AND tipo='despesa' AND date_trunc('month',data)=date_trunc('month',current_date)),
 'investimentos_mes',(SELECT COALESCE(SUM(valor),0) FROM public.movimentacoes_financeiras WHERE propriedade_id=_propriedade_id AND tipo='investimento' AND date_trunc('month',data)=date_trunc('month',current_date)),
 'leite_mes',(SELECT COALESCE(SUM(litros),0) FROM public.producao_leite WHERE propriedade_id=_propriedade_id AND date_trunc('month',data)=date_trunc('month',current_date)),
 'total_lotes',(SELECT COUNT(*) FROM public.lotes WHERE propriedade_id=_propriedade_id)
) WHERE public.tem_acesso_propriedade(_propriedade_id)
$function$;
REVOKE ALL ON FUNCTION public.dashboard_resumo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_resumo(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2) relatorio_indicadores: totais exatos de um período (relatórios).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.relatorio_indicadores(_propriedade_id uuid, _de date DEFAULT '-infinity'::date, _ate date DEFAULT 'infinity'::date)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, private
AS $function$
SELECT jsonb_build_object(
 'animais_cadastrados',(SELECT COUNT(*) FROM public.animais WHERE propriedade_id=_propriedade_id AND created_at >= _de AND created_at < _ate + 1),
 'animais_ativos',(SELECT COUNT(*) FROM public.animais WHERE propriedade_id=_propriedade_id AND situacao='ativo'),
 'nascidos',(SELECT COUNT(*) FROM public.nascimentos WHERE propriedade_id=_propriedade_id AND data_nascimento BETWEEN _de AND _ate),
 'perdas',(SELECT COUNT(*) FROM public.animais WHERE propriedade_id=_propriedade_id AND situacao IN ('perdido','falecido') AND updated_at BETWEEN _de AND _ate),
 'vendas_qtd',(SELECT COUNT(*) FROM public.vendas WHERE propriedade_id=_propriedade_id AND data BETWEEN _de AND _ate),
 'vendas_valor',(SELECT COALESCE(SUM(valor),0) FROM public.vendas WHERE propriedade_id=_propriedade_id AND data BETWEEN _de AND _ate),
 'compras_qtd',(SELECT COUNT(*) FROM public.compras WHERE propriedade_id=_propriedade_id AND data BETWEEN _de AND _ate),
 'compras_valor',(SELECT COALESCE(SUM(valor),0) FROM public.compras WHERE propriedade_id=_propriedade_id AND data BETWEEN _de AND _ate),
 'litros',(SELECT COALESCE(SUM(litros),0) FROM public.producao_leite WHERE propriedade_id=_propriedade_id AND data BETWEEN _de AND _ate),
 'valor_leite',(SELECT COALESCE(SUM(valor_total),0) FROM public.producao_leite WHERE propriedade_id=_propriedade_id AND data BETWEEN _de AND _ate),
 'receitas',(SELECT COALESCE(SUM(valor),0) FROM public.movimentacoes_financeiras WHERE propriedade_id=_propriedade_id AND tipo='receita' AND data BETWEEN _de AND _ate),
 'despesas',(SELECT COALESCE(SUM(valor),0) FROM public.movimentacoes_financeiras WHERE propriedade_id=_propriedade_id AND tipo='despesa' AND data BETWEEN _de AND _ate),
 'investimentos',(SELECT COALESCE(SUM(valor),0) FROM public.movimentacoes_financeiras WHERE propriedade_id=_propriedade_id AND tipo='investimento' AND data BETWEEN _de AND _ate)
) WHERE public.tem_acesso_propriedade(_propriedade_id)
$function$;
REVOKE ALL ON FUNCTION public.relatorio_indicadores(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.relatorio_indicadores(uuid, date, date) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3) diagnostico_propriedade: contagens reais por módulo, tempo de consulta e
--    última atualização. Lista fixa de tabelas (sem injeção de nomes).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.diagnostico_propriedade(_propriedade_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, private
AS $$
DECLARE
  t text;
  inicio timestamptz;
  contagem bigint;
  ultima timestamptz;
  tempo_ms double precision;
  linhas jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.tem_acesso_propriedade(_propriedade_id) THEN
    RETURN '[]'::jsonb;
  END IF;

  FOREACH t IN ARRAY ARRAY[
    'animais','lotes','pesagens','vacinacoes','inseminacoes','nascimentos',
    'producao_leite','anotacoes_producao','movimentacoes_financeiras',
    'investimentos','compras','vendas','tipos_vacinas'
  ] LOOP
    inicio := clock_timestamp();
    EXECUTE format(
      'SELECT COUNT(*), MAX(updated_at) FROM public.%I WHERE propriedade_id = $1',
      t
    ) INTO contagem, ultima USING _propriedade_id;
    tempo_ms := extract(epoch FROM (clock_timestamp() - inicio)) * 1000;
    linhas := linhas || jsonb_build_object(
      'tabela', t,
      'contagem', contagem,
      'ultima_atualizacao', ultima,
      'tempo_ms', round(tempo_ms::numeric, 2)
    );
  END LOOP;

  RETURN linhas;
END;
$$;
REVOKE ALL ON FUNCTION public.diagnostico_propriedade(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.diagnostico_propriedade(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4) Views agregadas para relatórios (por categoria e por lote).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_financeiro_por_categoria WITH (security_invoker=true) AS
SELECT
  propriedade_id,
  date_trunc('month', data)::date AS mes,
  tipo,
  categoria,
  SUM(valor) AS total
FROM public.movimentacoes_financeiras
GROUP BY propriedade_id, date_trunc('month', data), tipo, categoria;

CREATE OR REPLACE VIEW public.v_producao_por_lote WITH (security_invoker=true) AS
SELECT
  p.propriedade_id,
  l.id AS lote_id,
  l.nome AS lote_nome,
  date_trunc('month', p.data)::date AS mes,
  SUM(p.litros) AS total_litros,
  SUM(p.valor_total) AS valor_total
FROM public.producao_leite p
LEFT JOIN public.lotes l ON l.id = p.lote_id
GROUP BY p.propriedade_id, l.id, l.nome, date_trunc('month', p.data);

GRANT SELECT ON public.v_financeiro_por_categoria TO authenticated;
GRANT ALL ON public.v_financeiro_por_categoria TO service_role;
GRANT SELECT ON public.v_producao_por_lote TO authenticated;
GRANT ALL ON public.v_producao_por_lote TO service_role;

-- ---------------------------------------------------------------------------
-- 5) Log de importações em massa (histórico retomável, aceitas/rejeitadas).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.importacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  propriedade_id uuid NOT NULL REFERENCES public.propriedades(id) ON DELETE CASCADE,
  tabela text NOT NULL,
  arquivo text NOT NULL,
  total_linhas integer NOT NULL DEFAULT 0,
  processadas integer NOT NULL DEFAULT 0,
  aceitas integer NOT NULL DEFAULT 0,
  rejeitadas integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'em_andamento' CHECK (status IN ('em_andamento','concluida','erro','cancelada')),
  rejeitadas_detalhe jsonb NOT NULL DEFAULT '[]'::jsonb,
  erro text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE(propriedade_id, tabela, arquivo)
);
CREATE INDEX IF NOT EXISTS importacoes_propriedade_created_idx ON public.importacoes(propriedade_id, criado_em DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.importacoes TO authenticated;
GRANT ALL ON public.importacoes TO service_role;
ALTER TABLE public.importacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY importacoes_all ON public.importacoes
  FOR ALL TO authenticated
  USING (public.tem_acesso_propriedade(propriedade_id))
  WITH CHECK (public.tem_acesso_propriedade(propriedade_id));

CREATE TRIGGER set_importacoes_updated_at BEFORE UPDATE ON public.importacoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
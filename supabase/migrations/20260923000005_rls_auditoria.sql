-- Escala Apecuária Digital (parte 5)
--  Auditoria e reforço de segurança (RLS).
--
--  PROBLEMA CORRIGIDO: a migração 20260917002510 moveu as funções de acesso
--  (tem_acesso_propriedade / pode_administrar_propriedade) para o schema
--  `private`, mas as policies criadas no schema base continuam apontando para
--  `public.tem_acesso_propriedade(...)`, que não existe mais. Isso tornaria
--  bloqueadas (ou quebradas) todas as consultas por RLS.
--
--  Aqui as políticas são recriadas referenciando `private.*`, o RLS é
--  reafirmado em todas as tabelas de dados, o acesso anônimo é revogado e uma
--  view de auditoria permite inspecionar a situação de cada tabela.

-- ---------------------------------------------------------------------------
-- 1) Garantir que as funções de acesso existam em private (idempotente).
--    Corpos idênticos aos originais (SECURITY DEFINER, search_path public).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.tem_acesso_propriedade(_propriedade_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.propriedades p WHERE p.id = _propriedade_id AND p.proprietario_id = auth.uid()
    UNION ALL
    SELECT 1 FROM public.propriedade_membros m WHERE m.propriedade_id = _propriedade_id AND m.user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION private.pode_administrar_propriedade(_propriedade_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.propriedades p WHERE p.id = _propriedade_id AND p.proprietario_id = auth.uid()
    UNION ALL
    SELECT 1 FROM public.propriedade_membros m WHERE m.propriedade_id = _propriedade_id AND m.user_id = auth.uid() AND m.role IN ('proprietario','administrador')
  )
$$;

REVOKE ALL ON FUNCTION private.tem_acesso_propriedade(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.pode_administrar_propriedade(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.tem_acesso_propriedade(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.pode_administrar_propriedade(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2) Recriação das políticas de dados com referência a private.* (idempotente).
--    Isolamento rígido por propriedade via private.tem_acesso_propriedade.
-- ---------------------------------------------------------------------------
ALTER TABLE public.lotes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lotes_all ON public.lotes;
CREATE POLICY lotes_all ON public.lotes FOR ALL TO authenticated
  USING (private.tem_acesso_propriedade(propriedade_id))
  WITH CHECK (private.tem_acesso_propriedade(propriedade_id));

ALTER TABLE public.animais ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS animais_all ON public.animais;
CREATE POLICY animais_all ON public.animais FOR ALL TO authenticated
  USING (private.tem_acesso_propriedade(propriedade_id))
  WITH CHECK (private.tem_acesso_propriedade(propriedade_id));

ALTER TABLE public.pesagens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pesagens_all ON public.pesagens;
CREATE POLICY pesagens_all ON public.pesagens FOR ALL TO authenticated
  USING (private.tem_acesso_propriedade(propriedade_id))
  WITH CHECK (private.tem_acesso_propriedade(propriedade_id));

ALTER TABLE public.nascimentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nascimentos_all ON public.nascimentos;
CREATE POLICY nascimentos_all ON public.nascimentos FOR ALL TO authenticated
  USING (private.tem_acesso_propriedade(propriedade_id))
  WITH CHECK (private.tem_acesso_propriedade(propriedade_id));

ALTER TABLE public.tipos_vacinas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tipos_vacinas_all ON public.tipos_vacinas;
CREATE POLICY tipos_vacinas_all ON public.tipos_vacinas FOR ALL TO authenticated
  USING (private.tem_acesso_propriedade(propriedade_id))
  WITH CHECK (private.tem_acesso_propriedade(propriedade_id));

ALTER TABLE public.vacinacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vacinacoes_all ON public.vacinacoes;
CREATE POLICY vacinacoes_all ON public.vacinacoes FOR ALL TO authenticated
  USING (private.tem_acesso_propriedade(propriedade_id))
  WITH CHECK (private.tem_acesso_propriedade(propriedade_id));

ALTER TABLE public.inseminacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS inseminacoes_all ON public.inseminacoes;
CREATE POLICY inseminacoes_all ON public.inseminacoes FOR ALL TO authenticated
  USING (private.tem_acesso_propriedade(propriedade_id))
  WITH CHECK (private.tem_acesso_propriedade(propriedade_id));

ALTER TABLE public.producao_leite ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS producao_leite_all ON public.producao_leite;
CREATE POLICY producao_leite_all ON public.producao_leite FOR ALL TO authenticated
  USING (private.tem_acesso_propriedade(propriedade_id))
  WITH CHECK (private.tem_acesso_propriedade(propriedade_id));

ALTER TABLE public.anotacoes_producao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anotacoes_all ON public.anotacoes_producao;
CREATE POLICY anotacoes_all ON public.anotacoes_producao FOR ALL TO authenticated
  USING (private.tem_acesso_propriedade(propriedade_id))
  WITH CHECK (private.tem_acesso_propriedade(propriedade_id));

ALTER TABLE public.movimentacoes_financeiras ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS financeiro_all ON public.movimentacoes_financeiras;
CREATE POLICY financeiro_all ON public.movimentacoes_financeiras FOR ALL TO authenticated
  USING (private.tem_acesso_propriedade(propriedade_id))
  WITH CHECK (private.tem_acesso_propriedade(propriedade_id));

ALTER TABLE public.investimentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS investimentos_all ON public.investimentos;
CREATE POLICY investimentos_all ON public.investimentos FOR ALL TO authenticated
  USING (private.tem_acesso_propriedade(propriedade_id))
  WITH CHECK (private.tem_acesso_propriedade(propriedade_id));

ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS compras_all ON public.compras;
CREATE POLICY compras_all ON public.compras FOR ALL TO authenticated
  USING (private.tem_acesso_propriedade(propriedade_id))
  WITH CHECK (private.tem_acesso_propriedade(propriedade_id));

ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vendas_all ON public.vendas;
CREATE POLICY vendas_all ON public.vendas FOR ALL TO authenticated
  USING (private.tem_acesso_propriedade(propriedade_id))
  WITH CHECK (private.tem_acesso_propriedade(propriedade_id));

ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS configuracoes_all ON public.configuracoes;
CREATE POLICY configuracoes_all ON public.configuracoes FOR ALL TO authenticated
  USING (private.pode_administrar_propriedade(propriedade_id))
  WITH CHECK (private.pode_administrar_propriedade(propriedade_id));

ALTER TABLE public.importacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS importacoes_all ON public.importacoes;
CREATE POLICY importacoes_all ON public.importacoes FOR ALL TO authenticated
  USING (private.tem_acesso_propriedade(propriedade_id))
  WITH CHECK (private.tem_acesso_propriedade(propriedade_id));

-- ---------------------------------------------------------------------------
-- 3) Recriação das políticas de propriedade e membros com private.*.
-- ---------------------------------------------------------------------------
ALTER TABLE public.propriedades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS propriedades_select ON public.propriedades;
DROP POLICY IF EXISTS propriedades_insert ON public.propriedades;
DROP POLICY IF EXISTS propriedades_update ON public.propriedades;
DROP POLICY IF EXISTS propriedades_delete ON public.propriedades;
CREATE POLICY propriedades_select ON public.propriedades FOR SELECT TO authenticated
  USING (private.tem_acesso_propriedade(id));
CREATE POLICY propriedades_insert ON public.propriedades FOR INSERT TO authenticated
  WITH CHECK (proprietario_id = auth.uid());
CREATE POLICY propriedades_update ON public.propriedades FOR UPDATE TO authenticated
  USING (private.pode_administrar_propriedade(id))
  WITH CHECK (private.pode_administrar_propriedade(id));
CREATE POLICY propriedades_delete ON public.propriedades FOR DELETE TO authenticated
  USING (proprietario_id = auth.uid());

ALTER TABLE public.propriedade_membros ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS membros_select ON public.propriedade_membros;
DROP POLICY IF EXISTS membros_insert ON public.propriedade_membros;
DROP POLICY IF EXISTS membros_update ON public.propriedade_membros;
DROP POLICY IF EXISTS membros_delete ON public.propriedade_membros;
CREATE POLICY membros_select ON public.propriedade_membros FOR SELECT TO authenticated
  USING (private.tem_acesso_propriedade(propriedade_id));
CREATE POLICY membros_insert ON public.propriedade_membros FOR INSERT TO authenticated
  WITH CHECK (private.pode_administrar_propriedade(propriedade_id));
CREATE POLICY membros_update ON public.propriedade_membros FOR UPDATE TO authenticated
  USING (private.pode_administrar_propriedade(propriedade_id))
  WITH CHECK (private.pode_administrar_propriedade(propriedade_id));
CREATE POLICY membros_delete ON public.propriedade_membros FOR DELETE TO authenticated
  USING (private.pode_administrar_propriedade(propriedade_id));

-- ---------------------------------------------------------------------------
-- 4) Reforço: nenhuma permissão para anônimos em tabelas de dados.
-- ---------------------------------------------------------------------------
REVOKE ALL ON TABLE public.animais, public.lotes, public.pesagens, public.vacinacoes,
  public.inseminacoes, public.nascimentos, public.producao_leite, public.anotacoes_producao,
  public.movimentacoes_financeiras, public.investimentos, public.compras, public.vendas,
  public.tipos_vacinas, public.configuracoes, public.notificacoes, public.importacoes,
  public.propriedades, public.propriedade_membros FROM anon;

-- ---------------------------------------------------------------------------
-- 5) Auditoria: view com políticas por tabela, RLS e possíveis exposições a anon.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_rls_auditoria WITH (security_invoker=false) AS
SELECT
  p.tablename AS tabela,
  p.policyname AS politica,
  array_to_string(p.roles, ', ') AS roles,
  p.cmd AS comando,
  c.relrowsecurity AS rls_ativa,
  c.relforcerowsecurity AS rls_forcada
FROM pg_policies p
JOIN pg_class c ON c.relname = p.tablename AND c.relnamespace = 'public'::regnamespace
WHERE p.schemaname = 'public' AND c.relkind = 'r'
ORDER BY p.tablename, p.policyname;

GRANT SELECT ON public.v_rls_auditoria TO authenticated;
GRANT ALL ON public.v_rls_auditoria TO service_role;

-- ---------------------------------------------------------------------------
-- 6) Verificação: nenhuma política deve conceder acesso a `anon` nem a `public`
--    em tabelas de dados. Se alguma for encontrada, emite aviso (não apaga nada).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v integer;
BEGIN
  SELECT COUNT(*) INTO v
  FROM pg_policies p
  JOIN pg_class c ON c.relname = p.tablename AND c.relnamespace = 'public'::regnamespace
  WHERE p.schemaname = 'public'
    AND c.relkind = 'r'
    AND p.tablename <> 'profiles'
    AND EXISTS (SELECT 1 FROM unnest(p.roles) AS r WHERE r IN ('anon', 'public'));
  IF v > 0 THEN
    RAISE NOTICE 'ATENÇÃO: % política(s) expõe(m) dados a anon/public. Revise com SELECT * FROM public.v_rls_auditoria;', v;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 7) Correção das referências a private dentro das funções de relatório,
--    diagnóstico e revisão (as mesmas apontavam para public.tem_acesso_* que
--    foi movido ao schema private). Recriadas idênticas, apenas com private.*.
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
) WHERE private.tem_acesso_propriedade(_propriedade_id)
$function$;
REVOKE ALL ON FUNCTION public.dashboard_resumo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_resumo(uuid) TO authenticated, service_role;

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
) WHERE private.tem_acesso_propriedade(_propriedade_id)
$function$;
REVOKE ALL ON FUNCTION public.relatorio_indicadores(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.relatorio_indicadores(uuid, date, date) TO authenticated, service_role;

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
  IF NOT private.tem_acesso_propriedade(_propriedade_id) THEN
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

CREATE OR REPLACE FUNCTION public.registros_inconsistentes(_propriedade_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, private
AS $$
DECLARE
  resultado jsonb := '[]'::jsonb;
  exemplos jsonb;
  qtd bigint;
BEGIN
  IF NOT private.tem_acesso_propriedade(_propriedade_id) THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COUNT(*), COALESCE(jsonb_agg(jsonb_build_object('id', id, 'vaca_id', vaca_id, 'bezerro_id', bezerro_id)), '[]'::jsonb)
    INTO qtd, exemplos
    FROM (SELECT id, vaca_id, bezerro_id FROM public.nascimentos WHERE propriedade_id=_propriedade_id AND vaca_id=bezerro_id LIMIT 10) s;
  IF qtd > 0 THEN
    resultado := resultado || jsonb_build_object('tabela','nascimentos','checagem','vaca igual ao bezerro','qtd',qtd,'exemplos',exemplos);
  END IF;

  SELECT COUNT(*), COALESCE(jsonb_agg(jsonb_build_object('id', id)), '[]'::jsonb)
    INTO qtd, exemplos
    FROM (SELECT id FROM public.vacinacoes WHERE propriedade_id=_propriedade_id AND (animal_id IS NULL OR lote_id IS NULL) LIMIT 10) s;
  IF qtd > 0 THEN
    resultado := resultado || jsonb_build_object('tabela','vacinacoes','checagem','vacinação sem animal ou lote','qtd',qtd,'exemplos',exemplos);
  END IF;

  SELECT COUNT(*) INTO qtd FROM public.vacinacoes WHERE propriedade_id=_propriedade_id AND animal_id IS NOT NULL AND lote_id IS NOT NULL;
  IF qtd > 0 THEN
    resultado := resultado || jsonb_build_object('tabela','vacinacoes','checagem','vacinação simultânea animal+lote','qtd',qtd,'exemplos','[]'::jsonb);
  END IF;

  SELECT (SELECT COUNT(*) FROM public.pesagens WHERE propriedade_id=_propriedade_id AND data > current_date + interval '1 day')
       + (SELECT COUNT(*) FROM public.nascimentos WHERE propriedade_id=_propriedade_id AND data_nascimento > current_date + interval '1 day')
       + (SELECT COUNT(*) FROM public.vacinacoes WHERE propriedade_id=_propriedade_id AND data_aplicacao > current_date + interval '1 day')
       + (SELECT COUNT(*) FROM public.inseminacoes WHERE propriedade_id=_propriedade_id AND data_inseminacao > current_date + interval '1 day')
       + (SELECT COUNT(*) FROM public.producao_leite WHERE propriedade_id=_propriedade_id AND data > current_date + interval '1 day')
       + (SELECT COUNT(*) FROM public.anotacoes_producao WHERE propriedade_id=_propriedade_id AND data > current_date + interval '1 day')
       + (SELECT COUNT(*) FROM public.movimentacoes_financeiras WHERE propriedade_id=_propriedade_id AND data > current_date + interval '1 day')
       + (SELECT COUNT(*) FROM public.compras WHERE propriedade_id=_propriedade_id AND data > current_date + interval '1 day')
       + (SELECT COUNT(*) FROM public.vendas WHERE propriedade_id=_propriedade_id AND data > current_date + interval '1 day')
    INTO qtd;
  IF qtd > 0 THEN
    resultado := resultado || jsonb_build_object('tabela','datas','checagem','registros com data no futuro','qtd',qtd,'exemplos','[]'::jsonb);
  END IF;

  SELECT COUNT(*) INTO qtd
    FROM (SELECT numero_brinco FROM public.animais WHERE propriedade_id=_propriedade_id GROUP BY numero_brinco HAVING COUNT(*) > 1) s;
  IF qtd > 0 THEN
    resultado := resultado || jsonb_build_object('tabela','animais','checagem','números de brinco duplicados','qtd',qtd,'exemplos','[]'::jsonb);
  END IF;

  RETURN resultado;
END;
$$;
REVOKE ALL ON FUNCTION public.registros_inconsistentes(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registros_inconsistentes(uuid) TO authenticated, service_role;
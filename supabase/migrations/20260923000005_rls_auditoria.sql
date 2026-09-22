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
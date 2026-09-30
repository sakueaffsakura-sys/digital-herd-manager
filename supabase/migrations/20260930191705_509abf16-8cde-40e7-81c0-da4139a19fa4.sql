CREATE OR REPLACE FUNCTION private.minhas_propriedades()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.propriedades WHERE proprietario_id = auth.uid()
  UNION SELECT propriedade_id FROM public.propriedade_membros WHERE user_id = auth.uid()
$$;
REVOKE ALL ON FUNCTION private.minhas_propriedades() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.minhas_propriedades() TO authenticated, service_role;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('lotes','lotes_all'),('animais','animais_all'),('pesagens','pesagens_all'),('nascimentos','nascimentos_all'),
    ('tipos_vacinas','tipos_vacinas_all'),('vacinacoes','vacinacoes_all'),('inseminacoes','inseminacoes_all'),
    ('producao_leite','producao_leite_all'),('anotacoes_producao','anotacoes_all'),('movimentacoes_financeiras','financeiro_all'),
    ('investimentos','investimentos_all'),('compras','compras_all'),('vendas','vendas_all'),('importacoes','importacoes_all')) v(t,p)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.p, r.t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (propriedade_id IN (SELECT private.minhas_propriedades())) WITH CHECK (propriedade_id IN (SELECT private.minhas_propriedades()))', r.p, r.t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS configuracoes_all ON public.configuracoes;
CREATE POLICY configuracoes_all ON public.configuracoes FOR ALL TO authenticated
  USING (propriedade_id IN (SELECT private.minhas_propriedades()))
  WITH CHECK (private.pode_administrar_propriedade(propriedade_id));
DROP POLICY IF EXISTS pp_select ON public.propriedade_perfil;
CREATE POLICY pp_select ON public.propriedade_perfil FOR SELECT TO authenticated USING (propriedade_id IN (SELECT private.minhas_propriedades()));

CREATE INDEX IF NOT EXISTS leite_propriedade_data_idx ON public.producao_leite(propriedade_id, data);
CREATE INDEX IF NOT EXISTS nascimentos_propriedade_data_idx ON public.nascimentos(propriedade_id, data_nascimento);
CREATE INDEX IF NOT EXISTS vendas_propriedade_data_idx ON public.vendas(propriedade_id, data);
CREATE INDEX IF NOT EXISTS compras_propriedade_data_idx ON public.compras(propriedade_id, data);
CREATE INDEX IF NOT EXISTS animais_propriedade_situacao_idx ON public.animais(propriedade_id, situacao);
ANALYZE public.producao_leite; ANALYZE public.animais;
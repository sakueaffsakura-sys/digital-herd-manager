CREATE INDEX IF NOT EXISTS animais_sync_idx ON public.animais (propriedade_id, updated_at, id);
CREATE INDEX IF NOT EXISTS lotes_sync_idx ON public.lotes (propriedade_id, updated_at, id);
CREATE INDEX IF NOT EXISTS tipos_vacinas_sync_idx ON public.tipos_vacinas (propriedade_id, updated_at, id);
CREATE INDEX IF NOT EXISTS vacinacoes_sync_idx ON public.vacinacoes (propriedade_id, updated_at, id);
CREATE INDEX IF NOT EXISTS inseminacoes_sync_idx ON public.inseminacoes (propriedade_id, updated_at, id);
CREATE INDEX IF NOT EXISTS nascimentos_sync_idx ON public.nascimentos (propriedade_id, updated_at, id);
CREATE INDEX IF NOT EXISTS pesagens_sync_idx ON public.pesagens (propriedade_id, updated_at, id);
CREATE INDEX IF NOT EXISTS producao_leite_sync_idx ON public.producao_leite (propriedade_id, updated_at, id);
CREATE INDEX IF NOT EXISTS anotacoes_producao_sync_idx ON public.anotacoes_producao (propriedade_id, updated_at, id);
CREATE INDEX IF NOT EXISTS movimentacoes_financeiras_sync_idx ON public.movimentacoes_financeiras (propriedade_id, updated_at, id);
CREATE INDEX IF NOT EXISTS investimentos_sync_idx ON public.investimentos (propriedade_id, updated_at, id);
CREATE INDEX IF NOT EXISTS compras_sync_idx ON public.compras (propriedade_id, updated_at, id);
CREATE INDEX IF NOT EXISTS vendas_sync_idx ON public.vendas (propriedade_id, updated_at, id);

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
CREATE INDEX IF NOT EXISTS anotacoes_trgm_observacao ON public.anotacoes_producao USING gin (observacao extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS anotacoes_trgm_comportamento ON public.anotacoes_producao USING gin (comportamento extensions.gin_trgm_ops) WHERE comportamento IS NOT NULL;
CREATE INDEX IF NOT EXISTS anotacoes_trgm_alimentacao ON public.anotacoes_producao USING gin (alimentacao extensions.gin_trgm_ops) WHERE alimentacao IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.registros_excluidos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  propriedade_id uuid NOT NULL,
  tabela text NOT NULL,
  registro_id uuid NOT NULL,
  excluido_em timestamptz NOT NULL DEFAULT clock_timestamp()
);
REVOKE ALL ON public.registros_excluidos FROM anon, authenticated;
GRANT SELECT ON public.registros_excluidos TO authenticated;
GRANT ALL ON public.registros_excluidos TO service_role;
CREATE INDEX IF NOT EXISTS registros_excluidos_sync_idx ON public.registros_excluidos (propriedade_id, excluido_em, id);
ALTER TABLE public.registros_excluidos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS registros_excluidos_select ON public.registros_excluidos;
CREATE POLICY registros_excluidos_select ON public.registros_excluidos
  FOR SELECT TO authenticated
  USING (propriedade_id IN (SELECT private.minhas_propriedades()));

CREATE OR REPLACE FUNCTION private.registrar_exclusoes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.registros_excluidos (propriedade_id, tabela, registro_id)
  SELECT o.propriedade_id, TG_TABLE_NAME, o.id
  FROM linhas_antigas o
  WHERE EXISTS (SELECT 1 FROM public.propriedades p WHERE p.id = o.propriedade_id);
  RETURN NULL;
END
$$;
REVOKE ALL ON FUNCTION private.registrar_exclusoes() FROM PUBLIC;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['animais','lotes','tipos_vacinas','vacinacoes','inseminacoes','nascimentos','pesagens','producao_leite','anotacoes_producao','movimentacoes_financeiras','investimentos','compras','vendas'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS registrar_exclusoes ON public.%I', t);
    EXECUTE format('CREATE TRIGGER registrar_exclusoes AFTER DELETE ON public.%I REFERENCING OLD TABLE AS linhas_antigas FOR EACH STATEMENT EXECUTE FUNCTION private.registrar_exclusoes()', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION private.limpar_registros_excluidos(p_dias integer DEFAULT 90)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE n bigint;
BEGIN
  DELETE FROM public.registros_excluidos WHERE excluido_em < now() - make_interval(days => GREATEST(p_dias, 7));
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END
$$;
REVOKE ALL ON FUNCTION private.limpar_registros_excluidos(integer) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.app_sincronizar(
  p_tabela text, p_propriedade_id uuid, p_apos_updated_at timestamptz DEFAULT NULL,
  p_apos_id uuid DEFAULT NULL, p_limite integer DEFAULT 1000
) RETURNS SETOF jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public, pg_temp
AS $$
DECLARE
  permitidas constant text[] := ARRAY['animais','lotes','tipos_vacinas','vacinacoes','inseminacoes','nascimentos','pesagens','producao_leite','anotacoes_producao','movimentacoes_financeiras','investimentos','compras','vendas'];
BEGIN
  IF p_tabela IS NULL OR NOT (p_tabela = ANY (permitidas)) THEN
    RAISE EXCEPTION 'Tabela não sincronizável: %', coalesce(p_tabela, '(nula)') USING ERRCODE = '22023';
  END IF;
  IF p_propriedade_id IS NULL THEN
    RAISE EXCEPTION 'Propriedade obrigatória.' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY EXECUTE format(
    'SELECT to_jsonb(t) FROM public.%I t WHERE t.propriedade_id = $1 AND (t.updated_at, t.id) > ($2, $3) ORDER BY t.updated_at, t.id LIMIT $4', p_tabela)
    USING p_propriedade_id,
          coalesce(p_apos_updated_at, '-infinity'::timestamptz),
          coalesce(p_apos_id, '00000000-0000-0000-0000-000000000000'::uuid),
          LEAST(GREATEST(coalesce(p_limite, 1000), 1), 1000);
END
$$;
REVOKE ALL ON FUNCTION public.app_sincronizar(text, uuid, timestamptz, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_sincronizar(text, uuid, timestamptz, uuid, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.app_diagnostico(p_propriedade_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public, pg_temp
AS $$
DECLARE
  t text;
  r jsonb := '{}'::jsonb;
  linha jsonb;
BEGIN
  IF p_propriedade_id IS NULL THEN
    RAISE EXCEPTION 'Propriedade obrigatória.' USING ERRCODE = '22023';
  END IF;
  FOREACH t IN ARRAY ARRAY['animais','lotes','tipos_vacinas','vacinacoes','inseminacoes','nascimentos','pesagens','producao_leite','anotacoes_producao','movimentacoes_financeiras','investimentos','compras','vendas'] LOOP
    EXECUTE format('SELECT jsonb_build_object(''total'', count(*), ''ultimo_updated_at'', max(updated_at), ''ultima_criacao'', max(created_at)) FROM public.%I WHERE propriedade_id = $1', t)
      INTO linha USING p_propriedade_id;
    r := r || jsonb_build_object(t, linha);
  END LOOP;
  RETURN jsonb_build_object(
    'servidor_agora', now(),
    'propriedade_id', p_propriedade_id,
    'propriedade_visivel', EXISTS (SELECT 1 FROM public.propriedades WHERE id = p_propriedade_id),
    'exclusoes_registradas', (SELECT count(*) FROM public.registros_excluidos WHERE propriedade_id = p_propriedade_id),
    'tabelas', r
  );
END
$$;
REVOKE ALL ON FUNCTION public.app_diagnostico(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_diagnostico(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.admin_conta_detalhe(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $function$
DECLARE
  email text; criado timestamptz; acesso timestamptz; perfil jsonb; props jsonb; store jsonb; store_total bigint;
BEGIN
  IF NOT private.has_role(auth.uid(),'administrador') THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  SELECT u.email::text, u.created_at, u.last_sign_in_at INTO email, criado, acesso FROM auth.users u WHERE u.id=_user_id;
  IF email IS NULL THEN RAISE EXCEPTION 'Conta não encontrada.'; END IF;
  SELECT COALESCE(to_jsonb(pr), '{}'::jsonb) INTO perfil FROM public.profiles pr WHERE pr.id=_user_id;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', p.id, 'nome', p.nome, 'cidade', p.cidade, 'estado', p.estado, 'criado_em', p.created_at,
      'animais', (SELECT COUNT(*) FROM public.animais a WHERE a.propriedade_id=p.id),
      'producao', (SELECT COUNT(*) FROM public.producao_leite pl WHERE pl.propriedade_id=p.id),
      'financeiro', (SELECT COUNT(*) FROM public.movimentacoes_financeiras m WHERE m.propriedade_id=p.id),
      'plano', (SELECT COALESCE(jsonb_build_object('plano',s.plano,'status',s.status,'data_expiracao',s.data_expiracao,'origem',s.origem),'null'::jsonb)
                FROM public.assinaturas s WHERE s.propriedade_id=p.id AND s.status IN ('ativo','trial') ORDER BY s.created_at DESC LIMIT 1)
    ) ORDER BY p.created_at) FILTER (WHERE p.id IS NOT NULL), '[]'::jsonb)
    INTO props
    FROM public.propriedades p WHERE p.proprietario_id=_user_id;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('bucket',bucket_id,'bytes',total) ORDER BY total DESC), '[]'::jsonb),
         COALESCE(SUM(total), 0)
    INTO store, store_total
    FROM (SELECT bucket_id, SUM(COALESCE((metadata->>'size')::bigint,0)) AS total FROM storage.objects WHERE owner = _user_id GROUP BY bucket_id) sb;
  RETURN jsonb_build_object(
    'id', _user_id, 'email', email, 'perfil', perfil, 'admin', private.has_role(_user_id,'administrador'),
    'criado_em', criado, 'ultimo_acesso', acesso,
    'armazenamento', store, 'armazenamento_total', store_total, 'propriedades', props
  );
END $function$;

CREATE OR REPLACE FUNCTION public.admin_definir_perfil(_user_id uuid, _payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $function$
BEGIN
  IF NOT private.has_role(auth.uid(),'administrador') THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  UPDATE public.profiles SET
    nome_completo = COALESCE(NULLIF(_payload->>'nome_completo',''), nome_completo),
    nome_exibicao = COALESCE(NULLIF(_payload->>'nome_exibicao',''), nome_exibicao),
    cargo = COALESCE(_payload->>'cargo', cargo),
    biografia = COALESCE(_payload->>'biografia', biografia),
    telefone = COALESCE(_payload->>'telefone', telefone)
  WHERE id=_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil não encontrado.'; END IF;
END $function$;

CREATE OR REPLACE FUNCTION public.admin_excluir_conta(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $function$
DECLARE ids uuid[];
BEGIN
  IF NOT private.has_role(auth.uid(),'administrador') THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF _user_id = auth.uid() THEN RAISE EXCEPTION 'Você não pode excluir a própria conta.'; END IF;
  SELECT COALESCE(array_agg(id),'{}'::uuid[]) INTO ids FROM public.propriedades WHERE proprietario_id=_user_id;
  DELETE FROM public.nascimentos WHERE propriedade_id=ANY(ids);
  DELETE FROM public.pesagens WHERE propriedade_id=ANY(ids);
  DELETE FROM public.producao_leite WHERE propriedade_id=ANY(ids);
  DELETE FROM public.vacinacoes WHERE propriedade_id=ANY(ids);
  DELETE FROM public.inseminacoes WHERE propriedade_id=ANY(ids);
  DELETE FROM public.anotacoes_producao WHERE propriedade_id=ANY(ids);
  UPDATE public.animais SET mae_id=NULL WHERE mae_id IN (SELECT id FROM public.animais WHERE propriedade_id=ANY(ids));
  UPDATE public.animais SET pai_id=NULL WHERE pai_id IN (SELECT id FROM public.animais WHERE propriedade_id=ANY(ids));
  DELETE FROM public.animais WHERE propriedade_id=ANY(ids);
  UPDATE public.animais SET lote_id=NULL WHERE lote_id IN (SELECT id FROM public.lotes WHERE propriedade_id=ANY(ids));
  DELETE FROM public.lotes WHERE propriedade_id=ANY(ids);
  DELETE FROM public.tipos_vacinas WHERE propriedade_id=ANY(ids);
  DELETE FROM public.compras WHERE propriedade_id=ANY(ids);
  DELETE FROM public.vendas WHERE propriedade_id=ANY(ids);
  DELETE FROM public.investimentos WHERE propriedade_id=ANY(ids);
  DELETE FROM public.movimentacoes_financeiras WHERE propriedade_id=ANY(ids);
  DELETE FROM public.importacoes WHERE propriedade_id=ANY(ids);
  DELETE FROM public.configuracoes WHERE propriedade_id=ANY(ids);
  DELETE FROM public.notificacoes WHERE user_id=_user_id OR propriedade_id=ANY(ids);
  DELETE FROM public.plano_auditoria WHERE propriedade_id=ANY(ids) OR user_id=_user_id;
  DELETE FROM public.assinaturas WHERE propriedade_id=ANY(ids);
  DELETE FROM public.propriedade_perfil WHERE propriedade_id=ANY(ids);
  DELETE FROM public.propriedade_membros WHERE propriedade_id=ANY(ids) OR user_id=_user_id;
  DELETE FROM public.propriedades WHERE id=ANY(ids);
  DELETE FROM public.user_roles WHERE user_id=_user_id;
  DELETE FROM public.profiles WHERE id=_user_id;
  DELETE FROM auth.users WHERE id=_user_id;
  RETURN jsonb_build_object('ok',true,'propriedades_excluidas',COALESCE(array_length(ids,1),0));
END $function$;

CREATE OR REPLACE FUNCTION public.admin_metricas()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $function$
DECLARE r jsonb;
BEGIN
  IF NOT private.has_role(auth.uid(),'administrador') THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  r := jsonb_build_object(
    'cadastros_90d', (SELECT COALESCE(jsonb_agg(jsonb_build_object('dia',dia,'qtd',qtd) ORDER BY dia),'[]'::jsonb) FROM (
      SELECT d::date dia, (SELECT COUNT(*) FROM auth.users u WHERE u.created_at::date = d::date) qtd
      FROM generate_series(now()-interval '89 days', now(), interval '1 day') g(d)) s),
    'acessos_30d', (SELECT COALESCE(jsonb_agg(jsonb_build_object('dia',dia,'qtd',qtd) ORDER BY dia),'[]'::jsonb) FROM (
      SELECT d::date dia, (SELECT COUNT(*) FROM auth.users u WHERE u.last_sign_in_at::date = d::date) qtd
      FROM generate_series(now()-interval '29 days', now(), interval '1 day') g(d)) s),
    'registros_dia', (SELECT COALESCE(jsonb_agg(jsonb_build_object('dia',dia,'tabela',tabela,'qtd',qtd) ORDER BY dia, tabela),'[]'::jsonb) FROM (
      SELECT created_at::date dia, 'animais' tabela, COUNT(*) qtd FROM public.animais WHERE created_at > now()-interval '90 days' GROUP BY 1
      UNION ALL SELECT created_at::date, 'producao_leite', COUNT(*) FROM public.producao_leite WHERE created_at > now()-interval '90 days' GROUP BY 1
      UNION ALL SELECT created_at::date, 'movimentacoes', COUNT(*) FROM public.movimentacoes_financeiras WHERE created_at > now()-interval '90 days' GROUP BY 1
      UNION ALL SELECT created_at::date, 'vacinacoes', COUNT(*) FROM public.vacinacoes WHERE created_at > now()-interval '90 days' GROUP BY 1
      UNION ALL SELECT created_at::date, 'nascimentos', COUNT(*) FROM public.nascimentos WHERE created_at > now()-interval '90 days' GROUP BY 1
      UNION ALL SELECT created_at::date, 'pesagens', COUNT(*) FROM public.pesagens WHERE created_at > now()-interval '90 days' GROUP BY 1) z),
    'litros_mes', (SELECT COALESCE(jsonb_agg(jsonb_build_object('mes',mes,'litros',litros) ORDER BY mes),'[]'::jsonb) FROM (
      SELECT date_trunc('month',data) mes, SUM(litros) litros FROM public.producao_leite
      WHERE data > now()-interval '12 months' GROUP BY 1) s),
    'financeiro_mes', (SELECT COALESCE(jsonb_agg(jsonb_build_object('mes',mes,'receita',receita,'despesa',despesa,'investimento',investimento) ORDER BY mes),'[]'::jsonb) FROM (
      SELECT date_trunc('month',data) mes,
        COALESCE(SUM(valor) FILTER (WHERE tipo='receita'),0) receita,
        COALESCE(SUM(valor) FILTER (WHERE tipo='despesa'),0) despesa,
        COALESCE(SUM(valor) FILTER (WHERE tipo='investimento'),0) investimento
      FROM public.movimentacoes_financeiras WHERE data > now()-interval '12 months' GROUP BY 1) s),
    'totais', (SELECT jsonb_build_object(
      'usuarios',(SELECT COUNT(*) FROM auth.users),
      'propriedades',(SELECT COUNT(*) FROM public.propriedades),
      'animais',(SELECT COUNT(*) FROM public.animais),
      'litros',(SELECT COALESCE(SUM(litros),0) FROM public.producao_leite),
      'movimentacoes',(SELECT COUNT(*) FROM public.movimentacoes_financeiras),
      'vendas',(SELECT COUNT(*) FROM public.vendas),
      'compras',(SELECT COUNT(*) FROM public.compras),
      'premium_ativos',(SELECT COUNT(*) FROM public.assinaturas WHERE plano='premium' AND status IN ('ativo','trial') AND (data_expiracao IS NULL OR data_expiracao > now())),
      'contas_bloqueadas',(SELECT COUNT(*) FROM public.profiles WHERE bloqueado)
    ))
  );
  RETURN r;
END $function$;

CREATE OR REPLACE FUNCTION public.admin_saude()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $function$
DECLARE r jsonb;
BEGIN
  IF NOT private.has_role(auth.uid(),'administrador') THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  r := jsonb_build_object(
    'consultas_lentas', (SELECT COALESCE(jsonb_agg(jsonb_build_object('consulta',left(query,160),'chamadas',calls,'media_ms',round(mean_exec_time::numeric,2),'total_ms',round((total_exec_time)::numeric,0)) ORDER BY mean_exec_time DESC),'[]'::jsonb) FROM (
      SELECT query, calls, mean_exec_time, total_exec_time FROM pg_stat_statements
      WHERE query ILIKE '%public.%' ORDER BY mean_exec_time DESC LIMIT 10) x),
    'rate_limits', (SELECT COALESCE(jsonb_agg(jsonb_build_object('chave',chave,'janela',janela,'contador',contador) ORDER BY contador DESC),'[]'::jsonb) FROM (
      SELECT chave, janela, contador FROM public.rate_limits WHERE janela > now()-interval '2 hours' ORDER BY contador DESC LIMIT 15) y),
    'rate_limit_total', (SELECT COALESCE(SUM(contador),0) FROM public.rate_limits WHERE janela > now()-interval '24 hours'),
    'seq_scans', (SELECT COALESCE(jsonb_agg(jsonb_build_object('tabela',relname,'scans',seq_scan,'linhas_lidas',seq_tup_read) ORDER BY seq_tup_read DESC),'[]'::jsonb) FROM (
      SELECT relname, seq_scan, seq_tup_read FROM pg_stat_user_tables WHERE schemaname='public' AND seq_tup_read > 0 ORDER BY seq_tup_read DESC LIMIT 10) z),
    'manutencao', (SELECT COALESCE(jsonb_agg(jsonb_build_object('tabela',relname,'mortas',n_dead_tup) ORDER BY n_dead_tup DESC),'[]'::jsonb) FROM (
      SELECT relname, n_dead_tup FROM pg_stat_user_tables WHERE schemaname='public' AND n_dead_tup > 100 ORDER BY n_dead_tup DESC LIMIT 10) w),
    'bloqueios', (SELECT COUNT(*) FROM pg_stat_activity WHERE wait_event_type='Lock')
  );
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r := jsonb_build_object('consultas_lentas','[]'::jsonb,'rate_limits','[]'::jsonb,'rate_limit_total',0,'seq_scans','[]'::jsonb,'manutencao','[]'::jsonb,'bloqueios',0);
  RETURN r;
END $function$;

REVOKE EXECUTE ON FUNCTION public.admin_conta_detalhe(uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_definir_perfil(uuid, jsonb) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_excluir_conta(uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_metricas() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_saude() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_conta_detalhe(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_definir_perfil(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_excluir_conta(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_metricas() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_saude() TO authenticated, service_role;
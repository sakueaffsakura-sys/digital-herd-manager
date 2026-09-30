CREATE OR REPLACE FUNCTION public.admin_tempo_real()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public','private'
AS $$
DECLARE r jsonb; t0 timestamptz;
BEGIN
  IF NOT private.has_role(auth.uid(),'administrador') THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  t0 := clock_timestamp();
  SELECT jsonb_build_object(
    'ts', extract(epoch FROM now()),
    'commits', d.xact_commit, 'rollbacks', d.xact_rollback,
    'lidas', d.tup_fetched + d.tup_returned, 'inseridas', d.tup_inserted, 'atualizadas', d.tup_updated, 'removidas', d.tup_deleted,
    'blks_hit', d.blks_hit, 'blks_read', d.blks_read, 'deadlocks', d.deadlocks,
    'conexoes_ativas', (SELECT COUNT(*) FROM pg_stat_activity WHERE state='active'),
    'conexoes_ociosas', (SELECT COUNT(*) FROM pg_stat_activity WHERE state='idle'),
    'conexoes_total', (SELECT COUNT(*) FROM pg_stat_activity),
    'conexoes_max', current_setting('max_connections')::int,
    'bloqueios', (SELECT COUNT(*) FROM pg_locks WHERE NOT granted),
    'consulta_mais_longa_s', (SELECT COALESCE(max(extract(epoch FROM now()-query_start)),0) FROM pg_stat_activity WHERE state='active' AND pid<>pg_backend_pid()),
    'banco_bytes', pg_database_size(current_database()),
    'usuarios_online', (SELECT COUNT(*) FROM auth.users WHERE last_sign_in_at > now()-interval '15 minutes')
  ) INTO r FROM pg_stat_database d WHERE d.datname=current_database();
  RETURN r || jsonb_build_object('ping_ms', round((extract(epoch FROM clock_timestamp()-t0)*1000)::numeric,2));
END $$;
REVOKE ALL ON FUNCTION public.admin_tempo_real() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_tempo_real() TO authenticated, service_role;
CREATE TABLE public.presenca_usuarios (
  user_id uuid PRIMARY KEY,
  visto_em timestamptz NOT NULL DEFAULT now(),
  pagina text
);
GRANT SELECT, INSERT, UPDATE ON public.presenca_usuarios TO authenticated;
GRANT ALL ON public.presenca_usuarios TO service_role;
ALTER TABLE public.presenca_usuarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY presenca_own_select ON public.presenca_usuarios FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY presenca_own_insert ON public.presenca_usuarios FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY presenca_own_update ON public.presenca_usuarios FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX idx_presenca_visto ON public.presenca_usuarios (visto_em DESC);

CREATE OR REPLACE FUNCTION public.admin_tempo_real()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public','private'
AS $$
DECLARE r jsonb; t0 timestamptz;
BEGIN
  IF NOT private.has_role(auth.uid(),'administrador') THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  t0 := clock_timestamp();
  SELECT jsonb_build_object(
    'ts', extract(epoch FROM clock_timestamp()),
    'commits', d.xact_commit, 'rollbacks', d.xact_rollback,
    'lidas', d.tup_fetched, 'inseridas', d.tup_inserted, 'atualizadas', d.tup_updated, 'removidas', d.tup_deleted,
    'blks_hit', d.blks_hit, 'blks_read', d.blks_read, 'deadlocks', d.deadlocks,
    'conexoes_ativas', (SELECT COUNT(*) FROM pg_stat_activity WHERE state='active' AND pid<>pg_backend_pid()),
    'conexoes_ociosas', (SELECT COUNT(*) FROM pg_stat_activity WHERE state='idle'),
    'conexoes_total', (SELECT COUNT(*) FROM pg_stat_activity),
    'conexoes_max', current_setting('max_connections')::int,
    'bloqueios', (SELECT COUNT(*) FROM pg_locks WHERE NOT granted),
    'consulta_mais_longa_s', (SELECT COALESCE(max(extract(epoch FROM now()-query_start)),0) FROM pg_stat_activity WHERE state='active' AND pid<>pg_backend_pid() AND backend_type='client backend'),
    'banco_bytes', pg_database_size(current_database()),
    'usuarios_online', (SELECT COUNT(*) FROM public.presenca_usuarios WHERE visto_em > now()-interval '2 minutes'),
    'usuarios_hora', (SELECT COUNT(*) FROM public.presenca_usuarios WHERE visto_em > now()-interval '1 hour'),
    'sessoes_abertas', (SELECT COUNT(*) FROM auth.sessions WHERE not_after IS NULL OR not_after > now()),
    'online_lista', (SELECT COALESCE(jsonb_agg(jsonb_build_object('email',u.email,'pagina',p.pagina,'visto_em',p.visto_em) ORDER BY p.visto_em DESC),'[]'::jsonb)
                     FROM public.presenca_usuarios p JOIN auth.users u ON u.id=p.user_id WHERE p.visto_em > now()-interval '2 minutes')
  ) INTO r FROM pg_stat_database d WHERE d.datname=current_database();
  RETURN r || jsonb_build_object('ping_ms', round((extract(epoch FROM clock_timestamp()-t0)*1000)::numeric,2));
END $$;
REVOKE ALL ON FUNCTION public.admin_tempo_real() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_tempo_real() TO authenticated, service_role;
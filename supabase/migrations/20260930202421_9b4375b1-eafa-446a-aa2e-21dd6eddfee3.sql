CREATE TABLE public.eventos_seguranca (
  id bigserial PRIMARY KEY,
  criado_em timestamptz NOT NULL DEFAULT now(),
  tipo text NOT NULL,
  severidade text NOT NULL DEFAULT 'aviso' CHECK (severidade IN ('info','aviso','critico')),
  ip text,
  caminho text,
  quantidade integer NOT NULL DEFAULT 1,
  detalhe text
);
GRANT ALL ON public.eventos_seguranca TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.eventos_seguranca_id_seq TO service_role;
ALTER TABLE public.eventos_seguranca ENABLE ROW LEVEL SECURITY;
CREATE INDEX eventos_seguranca_criado_idx ON public.eventos_seguranca (criado_em DESC);

CREATE OR REPLACE FUNCTION public.admin_alertas()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public','private'
AS $$
DECLARE
  alertas jsonb := '[]'::jsonb;
  ev10 int; ev60 int; crit60 int; ips60 int;
  conn_total int; conn_max int; travadas int; demoradas int; cache numeric;
BEGIN
  IF NOT private.has_role(auth.uid(),'administrador') THEN RAISE EXCEPTION 'Acesso negado'; END IF;

  SELECT COALESCE(SUM(quantidade) FILTER (WHERE criado_em > now()-interval '10 minutes'),0),
         COALESCE(SUM(quantidade),0),
         COUNT(*) FILTER (WHERE severidade='critico'),
         COUNT(DISTINCT ip)
    INTO ev10, ev60, crit60, ips60
    FROM eventos_seguranca WHERE criado_em > now()-interval '60 minutes';

  IF crit60 > 0 OR ev10 >= 500 THEN
    alertas := alertas || jsonb_build_object('categoria','seguranca','severidade','critico','titulo','Possível ataque DDoS em andamento',
      'detalhe', format('%s requisições bloqueadas em 10 min vindas de %s endereços diferentes. A proteção está bloqueando automaticamente.', ev10, ips60));
  ELSIF ev10 >= 50 THEN
    alertas := alertas || jsonb_build_object('categoria','seguranca','severidade','aviso','titulo','Tráfego suspeito (possível DoS)',
      'detalhe', format('%s requisições bloqueadas nos últimos 10 minutos.', ev10));
  ELSIF ev60 > 0 THEN
    alertas := alertas || jsonb_build_object('categoria','seguranca','severidade','info','titulo','Bloqueios por excesso de acesso',
      'detalhe', format('%s requisições bloqueadas na última hora.', ev60));
  END IF;

  SELECT COUNT(*) INTO conn_total FROM pg_stat_activity;
  SELECT setting::int INTO conn_max FROM pg_settings WHERE name='max_connections';
  SELECT COUNT(*) INTO travadas FROM pg_stat_activity WHERE wait_event_type='Lock';
  SELECT COUNT(*) INTO demoradas FROM pg_stat_activity WHERE state='active' AND pid<>pg_backend_pid() AND now()-query_start > interval '30 seconds';
  SELECT CASE WHEN SUM(blks_hit+blks_read)>0 THEN round(100*SUM(blks_hit)::numeric/SUM(blks_hit+blks_read),1) ELSE 100 END INTO cache FROM pg_stat_database WHERE datname=current_database();

  IF conn_max > 0 AND conn_total*100/conn_max >= 90 THEN
    alertas := alertas || jsonb_build_object('categoria','desempenho','severidade','critico','titulo','Conexões quase esgotadas','detalhe',format('%s de %s conexões em uso.',conn_total,conn_max));
  ELSIF conn_max > 0 AND conn_total*100/conn_max >= 70 THEN
    alertas := alertas || jsonb_build_object('categoria','desempenho','severidade','aviso','titulo','Muitas conexões abertas','detalhe',format('%s de %s conexões em uso.',conn_total,conn_max));
  END IF;
  IF travadas > 0 THEN
    alertas := alertas || jsonb_build_object('categoria','desempenho','severidade', CASE WHEN travadas>=5 THEN 'critico' ELSE 'aviso' END,'titulo','Consultas esperando bloqueio','detalhe',format('%s consulta(s) travada(s) aguardando outra terminar.',travadas));
  END IF;
  IF demoradas > 0 THEN
    alertas := alertas || jsonb_build_object('categoria','desempenho','severidade','aviso','titulo','Consultas demoradas','detalhe',format('%s consulta(s) rodando há mais de 30 segundos.',demoradas));
  END IF;
  IF cache < 90 THEN
    alertas := alertas || jsonb_build_object('categoria','desempenho','severidade','aviso','titulo','Cache do banco baixo','detalhe',format('Só %s%% das leituras vêm da memória; o banco pode ficar lento.',cache));
  END IF;

  RETURN jsonb_build_object(
    'alertas', alertas,
    'bloqueios_10min', ev10, 'bloqueios_60min', ev60, 'ips_60min', ips60,
    'conexoes', conn_total, 'conexoes_max', conn_max, 'cache', cache,
    'eventos', COALESCE((SELECT jsonb_agg(e ORDER BY e.criado_em DESC) FROM (SELECT criado_em,tipo,severidade,ip,caminho,quantidade,detalhe FROM eventos_seguranca ORDER BY criado_em DESC LIMIT 100) e),'[]'::jsonb),
    'por_hora', COALESCE((SELECT jsonb_agg(x ORDER BY x.hora) FROM (SELECT date_trunc('hour',criado_em) hora, SUM(quantidade) total FROM eventos_seguranca WHERE criado_em > now()-interval '24 hours' GROUP BY 1) x),'[]'::jsonb),
    'top_ips', COALESCE((SELECT jsonb_agg(x) FROM (SELECT ip, SUM(quantidade) total, MAX(criado_em) ultimo FROM eventos_seguranca WHERE criado_em > now()-interval '24 hours' GROUP BY ip ORDER BY 2 DESC LIMIT 10) x),'[]'::jsonb)
  );
END $$;
REVOKE ALL ON FUNCTION public.admin_alertas() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_alertas() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.limpar_eventos_seguranca() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF random() < 0.01 THEN DELETE FROM public.eventos_seguranca WHERE criado_em < now()-interval '30 days'; END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION private.limpar_eventos_seguranca() FROM public, anon, authenticated;
CREATE TRIGGER limpar_eventos_seguranca AFTER INSERT ON public.eventos_seguranca FOR EACH STATEMENT EXECUTE FUNCTION private.limpar_eventos_seguranca();
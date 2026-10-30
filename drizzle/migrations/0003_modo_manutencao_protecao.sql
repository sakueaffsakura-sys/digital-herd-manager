CREATE TABLE public.manutencao_config (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','manutencao','bloqueado')),
  titulo text NOT NULL DEFAULT 'Estamos em manutenção',
  mensagem text NOT NULL DEFAULT 'O sistema está passando por melhorias para atender você ainda melhor. Voltamos em breve.',
  modulos text[] NOT NULL DEFAULT '{todos}',
  duracao_bloqueio_min integer NOT NULL DEFAULT 1440 CHECK (duracao_bloqueio_min BETWEEN 0 AND 525600),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid
);
INSERT INTO public.manutencao_config (id) VALUES (1) ON CONFLICT DO NOTHING;
GRANT ALL ON public.manutencao_config TO service_role;
ALTER TABLE public.manutencao_config ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.manutencao_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  criado_em timestamptz NOT NULL DEFAULT now(),
  user_id uuid, email text,
  status_anterior text, status_novo text NOT NULL,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip text
);
GRANT ALL ON public.manutencao_historico TO service_role;
ALTER TABLE public.manutencao_historico ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.incidentes_seguranca (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  criado_em timestamptz NOT NULL DEFAULT now(),
  tipo text NOT NULL,
  severidade text NOT NULL DEFAULT 'aviso',
  ip text, dispositivo text, user_id uuid,
  caminho text, metodo text, agente text,
  motivo text NOT NULL,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  bloqueou boolean NOT NULL DEFAULT false,
  repeticoes integer NOT NULL DEFAULT 1
);
CREATE INDEX incidentes_seg_data_idx ON public.incidentes_seguranca (criado_em DESC);
CREATE INDEX incidentes_seg_ip_idx ON public.incidentes_seguranca (ip, criado_em DESC);
GRANT ALL ON public.incidentes_seguranca TO service_role;
ALTER TABLE public.incidentes_seguranca ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.bloqueios_acesso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('ip','dispositivo','usuario')),
  valor text NOT NULL,
  motivo text NOT NULL,
  incidente_id uuid REFERENCES public.incidentes_seguranca(id) ON DELETE SET NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  expira_em timestamptz,
  ativo boolean NOT NULL DEFAULT true,
  tentativas integer NOT NULL DEFAULT 0,
  ultima_tentativa timestamptz,
  removido_em timestamptz, removido_por uuid
);
CREATE UNIQUE INDEX bloqueios_acesso_ativo_uniq ON public.bloqueios_acesso (tipo, valor) WHERE ativo;
GRANT ALL ON public.bloqueios_acesso TO service_role;
ALTER TABLE public.bloqueios_acesso ENABLE ROW LEVEL SECURITY;

-- IP de origem informado pela borda (lido do pedido ao banco)
CREATE OR REPLACE FUNCTION private.ip_requisicao() RETURNS text LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT nullif(left(coalesce(
    current_setting('request.headers', true)::json->>'cf-connecting-ip',
    split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1),
    ''), 80), '')
$$;

-- Decide se o usuário atual deve ser barrado em um módulo (manutenção ou bloqueio de conta)
CREATE OR REPLACE FUNCTION private.acesso_negado(_modulo text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT CASE WHEN auth.uid() IS NULL THEN false
    WHEN private.has_role(auth.uid(), 'administrador') THEN false
    ELSE EXISTS (SELECT 1 FROM public.manutencao_config c WHERE c.status <> 'ativo'
                 AND (c.status = 'bloqueado' OR 'todos' = ANY(c.modulos) OR _modulo = ANY(c.modulos)))
      OR EXISTS (SELECT 1 FROM public.bloqueios_acesso b WHERE b.ativo AND b.tipo = 'usuario'
                 AND b.valor = auth.uid()::text AND (b.expira_em IS NULL OR b.expira_em > now()))
  END
$$;
REVOKE ALL ON FUNCTION private.acesso_negado(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.acesso_negado(text) TO authenticated, service_role;

-- Camada no banco: barra leitura e escrita nos módulos bloqueados mesmo por chamadas diretas
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('animais','rebanho'),('pesagens','bezerros'),('vacinacoes','vacinacao'),('tipos_vacinas','vacinacao'),
    ('inseminacoes','inseminacao'),('nascimentos','nascimentos'),('lotes','lotes'),('producao_leite','producao'),
    ('anotacoes_producao','producao'),('movimentacoes_financeiras','financeiro'),('investimentos','financeiro'),
    ('compras','comercial'),('vendas','comercial'),('importacoes','importacao'),('suporte_mensagens','yui'),
    ('notificacoes','inicio'),('propriedade_perfil','perfil')) v(t, m)
  LOOP
    EXECUTE format('CREATE POLICY "Manutencao barra %1$s" ON public.%1$I AS RESTRICTIVE FOR ALL TO authenticated USING (NOT (SELECT private.acesso_negado(%2$L))) WITH CHECK (NOT (SELECT private.acesso_negado(%2$L)))', r.t, r.m);
  END LOOP;
END $$;

-- Registro de incidente com bloqueio automático e sem duplicar bloqueios ativos (uso do servidor)
CREATE OR REPLACE FUNCTION private.seg_incidente(_tipo text, _severidade text, _ip text, _disp text, _user uuid, _caminho text, _metodo text, _agente text, _motivo text, _detalhes jsonb, _bloquear boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE _id uuid; _dur int; _exp timestamptz; _admin boolean;
BEGIN
  _admin := _user IS NOT NULL AND private.has_role(_user, 'administrador');
  IF _admin THEN _bloquear := false; END IF;
  SELECT duracao_bloqueio_min INTO _dur FROM manutencao_config WHERE id = 1;
  _exp := CASE WHEN coalesce(_dur,0) = 0 THEN NULL ELSE now() + make_interval(mins => _dur) END;
  INSERT INTO incidentes_seguranca (tipo, severidade, ip, dispositivo, user_id, caminho, metodo, agente, motivo, detalhes, bloqueou)
  VALUES (left(_tipo,60), left(coalesce(_severidade,'aviso'),20), left(_ip,80), left(_disp,80), _user, left(_caminho,200), left(_metodo,10), left(_agente,300), left(_motivo,300), coalesce(_detalhes,'{}'), coalesce(_bloquear,false))
  RETURNING id INTO _id;
  IF coalesce(_bloquear,false) THEN
    IF _ip IS NOT NULL AND _ip <> 'desconhecido' THEN
      INSERT INTO bloqueios_acesso (tipo, valor, motivo, incidente_id, expira_em) VALUES ('ip', left(_ip,80), left(_motivo,300), _id, _exp)
      ON CONFLICT (tipo, valor) WHERE ativo DO UPDATE SET tentativas = bloqueios_acesso.tentativas + 1, ultima_tentativa = now();
    END IF;
    IF _disp IS NOT NULL AND _disp <> '' THEN
      INSERT INTO bloqueios_acesso (tipo, valor, motivo, incidente_id, expira_em) VALUES ('dispositivo', left(_disp,80), left(_motivo,300), _id, _exp)
      ON CONFLICT (tipo, valor) WHERE ativo DO UPDATE SET tentativas = bloqueios_acesso.tentativas + 1, ultima_tentativa = now();
    END IF;
    IF _user IS NOT NULL THEN
      INSERT INTO bloqueios_acesso (tipo, valor, motivo, incidente_id, expira_em) VALUES ('usuario', _user::text, left(_motivo,300), _id, _exp)
      ON CONFLICT (tipo, valor) WHERE ativo DO UPDATE SET tentativas = bloqueios_acesso.tentativas + 1, ultima_tentativa = now();
    END IF;
  END IF;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION private.seg_incidente(text,text,text,text,uuid,text,text,text,text,jsonb,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.seg_incidente(text,text,text,text,uuid,text,text,text,text,jsonb,boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.seg_registrar_incidente(_tipo text, _severidade text, _ip text, _disp text, _user uuid, _caminho text, _metodo text, _agente text, _motivo text, _detalhes jsonb, _bloquear boolean)
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = public, private AS $$
  SELECT private.seg_incidente(_tipo,_severidade,_ip,_disp,_user,_caminho,_metodo,_agente,_motivo,_detalhes,_bloquear)
$$;
REVOKE ALL ON FUNCTION public.seg_registrar_incidente(text,text,text,text,uuid,text,text,text,text,jsonb,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seg_registrar_incidente(text,text,text,text,uuid,text,text,text,text,jsonb,boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.seg_tentativa_bloqueado(_tipo text, _valor text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE bloqueios_acesso SET tentativas = tentativas + 1, ultima_tentativa = now() WHERE ativo AND tipo = _tipo AND valor = _valor
$$;
REVOKE ALL ON FUNCTION public.seg_tentativa_bloqueado(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seg_tentativa_bloqueado(text,text) TO service_role;

-- Estado público da manutenção (o que a tela precisa) + situação do próprio usuário
CREATE OR REPLACE FUNCTION public.estado_manutencao() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT jsonb_build_object(
    'status', c.status, 'titulo', c.titulo, 'mensagem', c.mensagem, 'modulos', to_jsonb(c.modulos),
    'atualizado_em', c.atualizado_em,
    'sou_admin', auth.uid() IS NOT NULL AND private.has_role(auth.uid(), 'administrador'),
    'conta_bloqueada', auth.uid() IS NOT NULL AND NOT private.has_role(auth.uid(), 'administrador') AND EXISTS (
      SELECT 1 FROM bloqueios_acesso b WHERE b.ativo AND b.tipo = 'usuario' AND b.valor = auth.uid()::text AND (b.expira_em IS NULL OR b.expira_em > now())))
  FROM manutencao_config c WHERE c.id = 1
$$;
REVOKE ALL ON FUNCTION public.estado_manutencao() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.estado_manutencao() TO anon, authenticated, service_role;

-- Alteração da manutenção: só administradores; tentativa sem permissão é registrada e bloqueada
CREATE OR REPLACE FUNCTION public.admin_manutencao_definir(_status text, _titulo text, _mensagem text, _modulos text[], _duracao_bloqueio_min integer, _dispositivo text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE _uid uuid := auth.uid(); _ant text; _validos text[] := ARRAY['todos','inicio','rebanho','bezerros','vacinacao','inseminacao','nascimentos','lotes','producao','relatorios','financeiro','comercial','diagnostico','perfil','importacao','yui','api'];
  _ip text := private.ip_requisicao(); _disp text := nullif(left(regexp_replace(coalesce(_dispositivo,''), '[^a-zA-Z0-9-]', '', 'g'), 80), '');
BEGIN
  IF _uid IS NULL OR NOT private.has_role(_uid, 'administrador') THEN
    PERFORM private.seg_incidente('alterar_manutencao', 'critico', _ip, _disp, _uid, 'admin_manutencao_definir', 'RPC', NULL,
      'Tentativa de alterar o modo de manutenção sem permissão de administrador.', jsonb_build_object('status_pedido', left(_status, 20)), _uid IS NOT NULL);
    RETURN jsonb_build_object('ok', false, 'erro', 'Acesso negado.');
  END IF;
  IF _status NOT IN ('ativo','manutencao','bloqueado') THEN RETURN jsonb_build_object('ok', false, 'erro', 'Status inválido.'); END IF;
  IF length(btrim(coalesce(_titulo,''))) NOT BETWEEN 3 AND 120 THEN RETURN jsonb_build_object('ok', false, 'erro', 'O título deve ter entre 3 e 120 caracteres.'); END IF;
  IF length(btrim(coalesce(_mensagem,''))) NOT BETWEEN 3 AND 1000 THEN RETURN jsonb_build_object('ok', false, 'erro', 'A mensagem deve ter entre 3 e 1000 caracteres.'); END IF;
  IF _modulos IS NULL OR cardinality(_modulos) = 0 OR NOT (_modulos <@ _validos) THEN RETURN jsonb_build_object('ok', false, 'erro', 'Escolha ao menos uma área válida para bloquear.'); END IF;
  IF _duracao_bloqueio_min IS NULL OR _duracao_bloqueio_min NOT BETWEEN 0 AND 525600 THEN RETURN jsonb_build_object('ok', false, 'erro', 'Duração de bloqueio inválida.'); END IF;
  SELECT status INTO _ant FROM manutencao_config WHERE id = 1 FOR UPDATE;
  UPDATE manutencao_config SET status = _status, titulo = btrim(_titulo), mensagem = btrim(_mensagem), modulos = _modulos,
    duracao_bloqueio_min = _duracao_bloqueio_min, atualizado_em = now(), atualizado_por = _uid WHERE id = 1;
  INSERT INTO manutencao_historico (user_id, email, status_anterior, status_novo, detalhes, ip)
  VALUES (_uid, (SELECT email FROM auth.users WHERE id = _uid), _ant, _status,
    jsonb_build_object('titulo', btrim(_titulo), 'modulos', to_jsonb(_modulos), 'duracao_bloqueio_min', _duracao_bloqueio_min), _ip);
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE ALL ON FUNCTION public.admin_manutencao_definir(text,text,text,text[],integer,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_manutencao_definir(text,text,text,text[],integer,text) TO authenticated;

-- Painel de segurança com filtros
CREATE OR REPLACE FUNCTION public.admin_seguranca_painel(_desde timestamptz DEFAULT NULL, _ate timestamptz DEFAULT NULL, _ip text DEFAULT NULL, _dispositivo text DEFAULT NULL, _tipo text DEFAULT NULL, _status text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
DECLARE _d timestamptz := coalesce(_desde, now() - interval '30 days'); _a timestamptz := coalesce(_ate, now());
BEGIN
  IF NOT private.has_role(auth.uid(), 'administrador') THEN RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = '42501'; END IF;
  RETURN jsonb_build_object(
    'config', (SELECT to_jsonb(c) FROM manutencao_config c WHERE id = 1),
    'totais', jsonb_build_object(
      'suspeitas', (SELECT count(*) FROM incidentes_seguranca WHERE criado_em BETWEEN _d AND _a),
      'negados', (SELECT coalesce(sum(repeticoes),0) FROM incidentes_seguranca WHERE criado_em BETWEEN _d AND _a),
      'ips', (SELECT count(*) FROM bloqueios_acesso WHERE ativo AND tipo = 'ip' AND (expira_em IS NULL OR expira_em > now())),
      'dispositivos', (SELECT count(*) FROM bloqueios_acesso WHERE ativo AND tipo = 'dispositivo' AND (expira_em IS NULL OR expira_em > now())),
      'contas', (SELECT count(*) FROM bloqueios_acesso WHERE ativo AND tipo = 'usuario' AND (expira_em IS NULL OR expira_em > now()))),
    'tipos', (SELECT coalesce(jsonb_agg(DISTINCT tipo), '[]') FROM incidentes_seguranca),
    'incidentes', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.criado_em DESC), '[]') FROM (
      SELECT i.*, (SELECT email FROM auth.users u WHERE u.id = i.user_id) AS email FROM incidentes_seguranca i
      WHERE i.criado_em BETWEEN _d AND _a
        AND (_ip IS NULL OR i.ip ILIKE '%' || _ip || '%')
        AND (_dispositivo IS NULL OR i.dispositivo ILIKE '%' || _dispositivo || '%')
        AND (_tipo IS NULL OR i.tipo = _tipo)
        AND (_status IS NULL OR (_status = 'bloqueou' AND i.bloqueou) OR (_status = 'registrado' AND NOT i.bloqueou))
      ORDER BY i.criado_em DESC LIMIT 300) x),
    'bloqueios', (SELECT coalesce(jsonb_agg(to_jsonb(y) ORDER BY y.criado_em DESC), '[]') FROM (
      SELECT b.*, CASE WHEN NOT b.ativo THEN 'removido' WHEN b.expira_em IS NOT NULL AND b.expira_em <= now() THEN 'expirado' ELSE 'ativo' END AS situacao,
        CASE WHEN b.tipo = 'usuario' THEN (SELECT email FROM auth.users u WHERE u.id::text = b.valor) END AS email
      FROM bloqueios_acesso b
      WHERE (_ip IS NULL OR b.tipo <> 'ip' OR b.valor ILIKE '%' || _ip || '%')
        AND (_dispositivo IS NULL OR b.tipo <> 'dispositivo' OR b.valor ILIKE '%' || _dispositivo || '%')
        AND (_status IS NULL OR _status NOT IN ('ativo','removido','expirado') OR
             (CASE WHEN NOT b.ativo THEN 'removido' WHEN b.expira_em IS NOT NULL AND b.expira_em <= now() THEN 'expirado' ELSE 'ativo' END) = _status)
      ORDER BY b.criado_em DESC LIMIT 300) y),
    'historico', (SELECT coalesce(jsonb_agg(to_jsonb(h) ORDER BY h.criado_em DESC), '[]') FROM (SELECT * FROM manutencao_historico ORDER BY criado_em DESC LIMIT 100) h)
  );
END $$;
REVOKE ALL ON FUNCTION public.admin_seguranca_painel(timestamptz,timestamptz,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_seguranca_painel(timestamptz,timestamptz,text,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_desbloquear(_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'administrador') THEN RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = '42501'; END IF;
  UPDATE bloqueios_acesso SET ativo = false, removido_em = now(), removido_por = auth.uid() WHERE id = _id AND ativo;
  RETURN jsonb_build_object('ok', FOUND);
END $$;
REVOKE ALL ON FUNCTION public.admin_desbloquear(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_desbloquear(uuid) TO authenticated;
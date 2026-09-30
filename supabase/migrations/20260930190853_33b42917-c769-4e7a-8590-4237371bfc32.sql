-- ===== Perfil =====
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nome_exibicao text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cargo text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS biografia text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bloqueado boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ALTER COLUMN nome_completo SET DEFAULT '';
ALTER TABLE public.profiles ALTER COLUMN preferencias SET DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION private.criar_perfil_usuario()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, nome_completo)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome_completo', NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.criar_perfil_usuario() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION private.criar_perfil_usuario();

INSERT INTO public.profiles (id, nome_completo)
SELECT u.id, COALESCE(u.raw_user_meta_data->>'nome_completo', u.raw_user_meta_data->>'full_name', '') FROM auth.users u
ON CONFLICT (id) DO NOTHING;

-- ===== Relatórios / diagnóstico =====
CREATE OR REPLACE FUNCTION public.dashboard_resumo(_propriedade_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, private AS $function$
SELECT jsonb_build_object(
 'total_animais',(SELECT COUNT(*) FROM public.animais WHERE propriedade_id=_propriedade_id AND situacao='ativo'),
 'animais_ativos',(SELECT COUNT(*) FROM public.animais WHERE propriedade_id=_propriedade_id AND situacao='ativo'),
 'bezerros',(SELECT COUNT(*) FROM public.animais WHERE propriedade_id=_propriedade_id AND situacao='ativo' AND data_nascimento >= current_date - interval '12 months'),
 'vacinacoes_em_dia',(SELECT COUNT(*) FROM public.v_vacinacoes_status WHERE propriedade_id=_propriedade_id AND status_calculado='em_dia'),
 'inseminacoes',(SELECT COUNT(*) FROM public.inseminacoes WHERE propriedade_id=_propriedade_id AND situacao IN ('em_andamento','confirmada')),
 'nascidos_mes',(SELECT COUNT(*) FROM public.nascimentos WHERE propriedade_id=_propriedade_id AND date_trunc('month',data_nascimento)=date_trunc('month',current_date)),
 'perdas_mes',(SELECT COUNT(*) FROM public.animais WHERE propriedade_id=_propriedade_id AND situacao IN ('perdido','falecido') AND date_trunc('month',updated_at)=date_trunc('month',current_date)),
 'vendas_mes',(SELECT COUNT(*) FROM public.vendas WHERE propriedade_id=_propriedade_id AND date_trunc('month',data)=date_trunc('month',current_date)),
 'compras_mes',(SELECT COUNT(*) FROM public.compras WHERE propriedade_id=_propriedade_id AND date_trunc('month',data)=date_trunc('month',current_date)),
 'receitas_mes',(SELECT COALESCE(SUM(valor),0) FROM public.movimentacoes_financeiras WHERE propriedade_id=_propriedade_id AND tipo='receita' AND date_trunc('month',data)=date_trunc('month',current_date)),
 'despesas_mes',(SELECT COALESCE(SUM(valor),0) FROM public.movimentacoes_financeiras WHERE propriedade_id=_propriedade_id AND tipo IN ('despesa','investimento') AND date_trunc('month',data)=date_trunc('month',current_date)),
 'investimentos_mes',(SELECT COALESCE(SUM(valor),0) FROM public.movimentacoes_financeiras WHERE propriedade_id=_propriedade_id AND tipo='investimento' AND date_trunc('month',data)=date_trunc('month',current_date)),
 'leite_mes',(SELECT COALESCE(SUM(litros),0) FROM public.producao_leite WHERE propriedade_id=_propriedade_id AND date_trunc('month',data)=date_trunc('month',current_date)),
 'total_lotes',(SELECT COUNT(*) FROM public.lotes WHERE propriedade_id=_propriedade_id)
) WHERE private.tem_acesso_propriedade(_propriedade_id)
$function$;
REVOKE ALL ON FUNCTION public.dashboard_resumo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_resumo(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.relatorio_indicadores(_propriedade_id uuid, _de date DEFAULT '-infinity'::date, _ate date DEFAULT 'infinity'::date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, private AS $function$
SELECT jsonb_build_object(
 'animais_ativos',(SELECT COUNT(*) FROM public.animais WHERE propriedade_id=_propriedade_id AND situacao='ativo'),
 'nascidos',(SELECT COUNT(*) FROM public.nascimentos WHERE propriedade_id=_propriedade_id AND data_nascimento BETWEEN _de AND _ate),
 'perdas',(SELECT COUNT(*) FROM public.animais WHERE propriedade_id=_propriedade_id AND situacao IN ('perdido','falecido') AND updated_at::date BETWEEN _de AND _ate),
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
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public, private AS $$
DECLARE t text; inicio timestamptz; contagem bigint; ultima timestamptz; linhas jsonb := '[]'::jsonb;
BEGIN
  IF NOT private.tem_acesso_propriedade(_propriedade_id) THEN RETURN '[]'::jsonb; END IF;
  FOREACH t IN ARRAY ARRAY['animais','lotes','pesagens','vacinacoes','inseminacoes','nascimentos','producao_leite','anotacoes_producao','movimentacoes_financeiras','investimentos','compras','vendas','tipos_vacinas'] LOOP
    inicio := clock_timestamp();
    EXECUTE format('SELECT COUNT(*), MAX(updated_at) FROM public.%I WHERE propriedade_id = $1', t) INTO contagem, ultima USING _propriedade_id;
    linhas := linhas || jsonb_build_object('tabela', t, 'contagem', contagem, 'ultima_atualizacao', ultima,
      'tempo_ms', round((extract(epoch FROM (clock_timestamp() - inicio)) * 1000)::numeric, 2));
  END LOOP;
  RETURN linhas;
END $$;
REVOKE ALL ON FUNCTION public.diagnostico_propriedade(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.diagnostico_propriedade(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.registros_inconsistentes(_propriedade_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public, private AS $$
DECLARE r jsonb := '[]'::jsonb; q bigint;
BEGIN
  IF NOT private.tem_acesso_propriedade(_propriedade_id) THEN RETURN r; END IF;
  SELECT COUNT(*) INTO q FROM public.nascimentos WHERE propriedade_id=_propriedade_id AND vaca_id=bezerro_id;
  IF q>0 THEN r := r || jsonb_build_object('tabela','nascimentos','checagem','vaca igual ao bezerro','qtd',q,'exemplos','[]'::jsonb); END IF;
  SELECT (SELECT COUNT(*) FROM public.pesagens WHERE propriedade_id=_propriedade_id AND data > current_date + 1)
       + (SELECT COUNT(*) FROM public.producao_leite WHERE propriedade_id=_propriedade_id AND data > current_date + 1)
       + (SELECT COUNT(*) FROM public.movimentacoes_financeiras WHERE propriedade_id=_propriedade_id AND data > current_date + 1) INTO q;
  IF q>0 THEN r := r || jsonb_build_object('tabela','datas','checagem','registros com data no futuro','qtd',q,'exemplos','[]'::jsonb); END IF;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.registros_inconsistentes(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registros_inconsistentes(uuid) TO authenticated, service_role;

CREATE OR REPLACE VIEW public.v_financeiro_por_categoria WITH (security_invoker=true) AS
SELECT propriedade_id, date_trunc('month', data)::date AS mes, tipo, categoria, SUM(valor) AS total
FROM public.movimentacoes_financeiras GROUP BY propriedade_id, date_trunc('month', data), tipo, categoria;
CREATE OR REPLACE VIEW public.v_producao_por_lote WITH (security_invoker=true) AS
SELECT p.propriedade_id, l.id AS lote_id, l.nome AS lote_nome, date_trunc('month', p.data)::date AS mes,
  SUM(p.litros) AS total_litros, SUM(p.valor_total) AS valor_total, COUNT(DISTINCT p.animal_id) AS vacas
FROM public.producao_leite p LEFT JOIN public.lotes l ON l.id = p.lote_id
GROUP BY p.propriedade_id, l.id, l.nome, date_trunc('month', p.data);
GRANT SELECT ON public.v_financeiro_por_categoria, public.v_producao_por_lote TO authenticated;
GRANT ALL ON public.v_financeiro_por_categoria, public.v_producao_por_lote TO service_role;

-- ===== Importações =====
CREATE TABLE IF NOT EXISTS public.importacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  propriedade_id uuid NOT NULL REFERENCES public.propriedades(id) ON DELETE CASCADE,
  tabela text NOT NULL, arquivo text NOT NULL,
  total_linhas integer NOT NULL DEFAULT 0, processadas integer NOT NULL DEFAULT 0,
  aceitas integer NOT NULL DEFAULT 0, rejeitadas integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'em_andamento' CHECK (status IN ('em_andamento','concluida','erro','cancelada')),
  rejeitadas_detalhe jsonb NOT NULL DEFAULT '[]'::jsonb, erro text,
  criado_em timestamptz NOT NULL DEFAULT now(), atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE(propriedade_id, tabela, arquivo)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.importacoes TO authenticated;
GRANT ALL ON public.importacoes TO service_role;
ALTER TABLE public.importacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS importacoes_all ON public.importacoes;
CREATE POLICY importacoes_all ON public.importacoes FOR ALL TO authenticated
  USING (private.tem_acesso_propriedade(propriedade_id)) WITH CHECK (private.tem_acesso_propriedade(propriedade_id));

-- ===== Perfil da propriedade / planos =====
DO $$ BEGIN CREATE TYPE public.tipo_plano AS ENUM ('gratuito','premium'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.status_assinatura AS ENUM ('ativo','trial','cancelado','expirado','pendente'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.propriedade_perfil (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  propriedade_id uuid NOT NULL UNIQUE REFERENCES public.propriedades(id) ON DELETE CASCADE,
  descricao text, telefone text, email text, endereco text, website text,
  logo_url text, banner_url text, imagem_url text, texto_apresentacao text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS set_propriedade_perfil_updated_at ON public.propriedade_perfil;
CREATE TRIGGER set_propriedade_perfil_updated_at BEFORE UPDATE ON public.propriedade_perfil FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.assinaturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
  propriedade_id uuid NOT NULL REFERENCES public.propriedades(id) ON DELETE CASCADE,
  plano public.tipo_plano NOT NULL DEFAULT 'gratuito', status public.status_assinatura NOT NULL DEFAULT 'pendente',
  origem text NOT NULL DEFAULT 'demonstracao', data_inicio timestamptz, data_expiracao timestamptz,
  stripe_customer_id text, stripe_subscription_id text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS assinaturas_ativa_unique_idx ON public.assinaturas(user_id, propriedade_id) WHERE status IN ('ativo','trial');

CREATE TABLE IF NOT EXISTS public.plano_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assinatura_id uuid REFERENCES public.assinaturas(id) ON DELETE SET NULL,
  user_id uuid NOT NULL, propriedade_id uuid, alterado_por uuid NOT NULL,
  plano_anterior public.tipo_plano, plano_novo public.tipo_plano,
  status_anterior public.status_assinatura, status_novo public.status_assinatura,
  motivo text, origem text NOT NULL DEFAULT 'demonstracao', created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.propriedade_perfil TO authenticated;
GRANT SELECT ON public.assinaturas, public.plano_auditoria TO authenticated;
GRANT ALL ON public.propriedade_perfil, public.assinaturas, public.plano_auditoria TO service_role;
ALTER TABLE public.propriedade_perfil ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assinaturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plano_auditoria ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pp_select ON public.propriedade_perfil;
CREATE POLICY pp_select ON public.propriedade_perfil FOR SELECT TO authenticated USING (private.tem_acesso_propriedade(propriedade_id));
DROP POLICY IF EXISTS pp_insert ON public.propriedade_perfil;
CREATE POLICY pp_insert ON public.propriedade_perfil FOR INSERT TO authenticated WITH CHECK (private.pode_administrar_propriedade(propriedade_id));
DROP POLICY IF EXISTS pp_update ON public.propriedade_perfil;
CREATE POLICY pp_update ON public.propriedade_perfil FOR UPDATE TO authenticated USING (private.pode_administrar_propriedade(propriedade_id)) WITH CHECK (private.pode_administrar_propriedade(propriedade_id));
DROP POLICY IF EXISTS pp_delete ON public.propriedade_perfil;
CREATE POLICY pp_delete ON public.propriedade_perfil FOR DELETE TO authenticated USING (private.pode_administrar_propriedade(propriedade_id));
DROP POLICY IF EXISTS assinaturas_select ON public.assinaturas;
CREATE POLICY assinaturas_select ON public.assinaturas FOR SELECT TO authenticated USING (user_id = auth.uid() OR private.pode_administrar_propriedade(propriedade_id));
DROP POLICY IF EXISTS plano_auditoria_select ON public.plano_auditoria;
CREATE POLICY plano_auditoria_select ON public.plano_auditoria FOR SELECT TO authenticated USING (user_id = auth.uid() OR (propriedade_id IS NOT NULL AND private.pode_administrar_propriedade(propriedade_id)));

CREATE OR REPLACE FUNCTION public.minha_assinatura(_propriedade_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, private AS $function$
SELECT COALESCE((SELECT jsonb_build_object('id',a.id,'plano',a.plano,'status',a.status,'origem',a.origem,'data_inicio',a.data_inicio,'data_expiracao',a.data_expiracao,
  'premium_ativo',(a.plano='premium' AND a.status IN ('ativo','trial') AND (a.data_expiracao IS NULL OR a.data_expiracao > now())),'demonstracao',(a.origem='demonstracao'))
  FROM public.assinaturas a WHERE a.propriedade_id=_propriedade_id ORDER BY a.created_at DESC LIMIT 1),
  jsonb_build_object('id',null,'plano','gratuito','status',null,'origem',null,'data_inicio',null,'data_expiracao',null,'premium_ativo',false,'demonstracao',false))
$function$;
REVOKE ALL ON FUNCTION public.minha_assinatura(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.minha_assinatura(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.pode_gerenciar_planos()
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, private AS $function$
SELECT private.has_role(auth.uid(), 'administrador')
$function$;
REVOKE ALL ON FUNCTION public.pode_gerenciar_planos() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pode_gerenciar_planos() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.setar_plano_demonstracao(_propriedade_id uuid, _plano public.tipo_plano DEFAULT 'premium', _status public.status_assinatura DEFAULT 'ativo', _data_expiracao timestamptz DEFAULT NULL, _motivo text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE _uid uuid := auth.uid(); _owner uuid; _sub uuid; _ant public.tipo_plano; _sant public.status_assinatura;
BEGIN
  IF _uid IS NULL OR NOT private.has_role(_uid,'administrador') THEN RAISE EXCEPTION 'Sem permissão para gerenciar planos.'; END IF;
  SELECT proprietario_id INTO _owner FROM public.propriedades WHERE id=_propriedade_id;
  IF _owner IS NULL THEN RAISE EXCEPTION 'Propriedade não encontrada.'; END IF;
  SELECT id, plano, status INTO _sub, _ant, _sant FROM public.assinaturas WHERE propriedade_id=_propriedade_id AND status IN ('ativo','trial') ORDER BY created_at DESC LIMIT 1;
  IF _sub IS NULL THEN
    INSERT INTO public.assinaturas(user_id,propriedade_id,plano,status,origem,data_inicio,data_expiracao) VALUES (_owner,_propriedade_id,_plano,_status,'demonstracao',now(),_data_expiracao) RETURNING id INTO _sub;
  ELSE
    UPDATE public.assinaturas SET plano=_plano,status=_status,data_expiracao=_data_expiracao WHERE id=_sub;
  END IF;
  INSERT INTO public.plano_auditoria(assinatura_id,user_id,propriedade_id,alterado_por,plano_anterior,plano_novo,status_anterior,status_novo,motivo) VALUES (_sub,_owner,_propriedade_id,_uid,_ant,_plano,_sant,_status,_motivo);
  RETURN jsonb_build_object('ok',true,'plano',_plano,'status',_status,'demonstracao',true,'premium_ativo',(_plano='premium' AND _status IN ('ativo','trial')));
END $$;
REVOKE ALL ON FUNCTION public.setar_plano_demonstracao(uuid, public.tipo_plano, public.status_assinatura, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.setar_plano_demonstracao(uuid, public.tipo_plano, public.status_assinatura, timestamptz, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.cancelar_plano_demonstracao(_propriedade_id uuid, _motivo text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE _uid uuid := auth.uid(); _sub uuid; _owner uuid; _ant public.tipo_plano; _sant public.status_assinatura;
BEGIN
  IF _uid IS NULL OR NOT private.has_role(_uid,'administrador') THEN RAISE EXCEPTION 'Sem permissão para gerenciar planos.'; END IF;
  SELECT id, user_id, plano, status INTO _sub, _owner, _ant, _sant FROM public.assinaturas WHERE propriedade_id=_propriedade_id AND status IN ('ativo','trial') ORDER BY created_at DESC LIMIT 1;
  IF _sub IS NULL THEN RETURN jsonb_build_object('ok',true,'ja_cancelado',true); END IF;
  UPDATE public.assinaturas SET status='cancelado', data_expiracao=COALESCE(data_expiracao,now()) WHERE id=_sub;
  INSERT INTO public.plano_auditoria(assinatura_id,user_id,propriedade_id,alterado_por,plano_anterior,plano_novo,status_anterior,status_novo,motivo) VALUES (_sub,_owner,_propriedade_id,_uid,_ant,_ant,_sant,'cancelado',_motivo);
  RETURN jsonb_build_object('ok',true,'status','cancelado');
END $$;
REVOKE ALL ON FUNCTION public.cancelar_plano_demonstracao(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancelar_plano_demonstracao(uuid, text) TO authenticated, service_role;

-- ===== Storage policies (buckets criados à parte) =====
DROP POLICY IF EXISTS media_avatar_select ON storage.objects;
CREATE POLICY media_avatar_select ON storage.objects FOR SELECT TO authenticated USING (bucket_id='profile-avatars' AND (storage.foldername(name))[1]=auth.uid()::text);
DROP POLICY IF EXISTS media_avatar_insert ON storage.objects;
CREATE POLICY media_avatar_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='profile-avatars' AND (storage.foldername(name))[1]=auth.uid()::text);
DROP POLICY IF EXISTS media_avatar_update ON storage.objects;
CREATE POLICY media_avatar_update ON storage.objects FOR UPDATE TO authenticated USING (bucket_id='profile-avatars' AND (storage.foldername(name))[1]=auth.uid()::text);
DROP POLICY IF EXISTS media_avatar_delete ON storage.objects;
CREATE POLICY media_avatar_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id='profile-avatars' AND (storage.foldername(name))[1]=auth.uid()::text);
DROP POLICY IF EXISTS media_property_select ON storage.objects;
CREATE POLICY media_property_select ON storage.objects FOR SELECT TO authenticated USING (bucket_id IN ('property-logos','property-banners','property-images') AND (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$' AND private.tem_acesso_propriedade(((storage.foldername(name))[1])::uuid));
DROP POLICY IF EXISTS media_property_insert ON storage.objects;
CREATE POLICY media_property_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id IN ('property-logos','property-banners','property-images') AND (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$' AND private.pode_administrar_propriedade(((storage.foldername(name))[1])::uuid));
DROP POLICY IF EXISTS media_property_update ON storage.objects;
CREATE POLICY media_property_update ON storage.objects FOR UPDATE TO authenticated USING (bucket_id IN ('property-logos','property-banners','property-images') AND (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$' AND private.pode_administrar_propriedade(((storage.foldername(name))[1])::uuid));
DROP POLICY IF EXISTS media_property_delete ON storage.objects;
CREATE POLICY media_property_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id IN ('property-logos','property-banners','property-images') AND (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$' AND private.pode_administrar_propriedade(((storage.foldername(name))[1])::uuid));

-- ===== Admin =====
CREATE OR REPLACE FUNCTION public.sou_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, private AS $$ SELECT private.has_role(auth.uid(),'administrador') $$;
REVOKE ALL ON FUNCTION public.sou_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sou_admin() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_contas()
RETURNS TABLE(user_id uuid, email text, nome text, criado_em timestamptz, ultimo_acesso timestamptz, bloqueado boolean, admin boolean, propriedades bigint, registros bigint, bytes_estimados bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF NOT private.has_role(auth.uid(),'administrador') THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  RETURN QUERY
  WITH props AS (SELECT id, proprietario_id FROM public.propriedades),
  cnt AS (
    SELECT p.proprietario_id uid, SUM(c)::bigint total FROM props p CROSS JOIN LATERAL (
      SELECT (SELECT COUNT(*) FROM public.animais WHERE propriedade_id=p.id)+(SELECT COUNT(*) FROM public.lotes WHERE propriedade_id=p.id)
      +(SELECT COUNT(*) FROM public.pesagens WHERE propriedade_id=p.id)+(SELECT COUNT(*) FROM public.vacinacoes WHERE propriedade_id=p.id)
      +(SELECT COUNT(*) FROM public.inseminacoes WHERE propriedade_id=p.id)+(SELECT COUNT(*) FROM public.nascimentos WHERE propriedade_id=p.id)
      +(SELECT COUNT(*) FROM public.producao_leite WHERE propriedade_id=p.id)+(SELECT COUNT(*) FROM public.anotacoes_producao WHERE propriedade_id=p.id)
      +(SELECT COUNT(*) FROM public.movimentacoes_financeiras WHERE propriedade_id=p.id)+(SELECT COUNT(*) FROM public.compras WHERE propriedade_id=p.id)
      +(SELECT COUNT(*) FROM public.vendas WHERE propriedade_id=p.id) AS c) x GROUP BY 1),
  st AS (SELECT (o.owner)::uuid uid, SUM(COALESCE((o.metadata->>'size')::bigint,0))::bigint b FROM storage.objects o WHERE o.owner IS NOT NULL GROUP BY 1)
  SELECT u.id, u.email::text, pr.nome_completo, u.created_at, u.last_sign_in_at, COALESCE(pr.bloqueado,false),
    private.has_role(u.id,'administrador'), (SELECT COUNT(*) FROM props WHERE proprietario_id=u.id),
    COALESCE(cnt.total,0), COALESCE(cnt.total,0)*400 + COALESCE(st.b,0)
  FROM auth.users u LEFT JOIN public.profiles pr ON pr.id=u.id LEFT JOIN cnt ON cnt.uid=u.id LEFT JOIN st ON st.uid=u.id
  ORDER BY u.created_at DESC;
END $$;
REVOKE ALL ON FUNCTION public.admin_contas() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_contas() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_sistema()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private, extensions AS $$
DECLARE r jsonb; t0 timestamptz;
BEGIN
  IF NOT private.has_role(auth.uid(),'administrador') THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  t0 := clock_timestamp();
  PERFORM COUNT(*) FROM public.animais;
  r := jsonb_build_object(
    'banco_bytes', pg_database_size(current_database()),
    'armazenamento_bytes', (SELECT COALESCE(SUM((metadata->>'size')::bigint),0) FROM storage.objects),
    'arquivos', (SELECT COUNT(*) FROM storage.objects),
    'usuarios', (SELECT COUNT(*) FROM auth.users),
    'propriedades', (SELECT COUNT(*) FROM public.propriedades),
    'conexoes_ativas', (SELECT COUNT(*) FROM pg_stat_activity WHERE state='active'),
    'conexoes_total', (SELECT COUNT(*) FROM pg_stat_activity),
    'cache_hit', (SELECT round(100.0*sum(blks_hit)/NULLIF(sum(blks_hit)+sum(blks_read),0),2) FROM pg_stat_database WHERE datname=current_database()),
    'ping_ms', round((extract(epoch FROM clock_timestamp()-t0)*1000)::numeric,2),
    'novos_7d', (SELECT COUNT(*) FROM auth.users WHERE created_at > now()-interval '7 days'),
    'ativos_7d', (SELECT COUNT(*) FROM auth.users WHERE last_sign_in_at > now()-interval '7 days'),
    'tabelas', (SELECT COALESCE(jsonb_agg(jsonb_build_object('tabela',relname,'linhas',n_live_tup,'bytes',pg_total_relation_size(relid)) ORDER BY pg_total_relation_size(relid) DESC),'[]'::jsonb) FROM pg_stat_user_tables WHERE schemaname='public'),
    'cadastros_30d', (SELECT COALESCE(jsonb_agg(jsonb_build_object('dia',d,'qtd',q) ORDER BY d),'[]'::jsonb) FROM (SELECT created_at::date d, COUNT(*) q FROM auth.users WHERE created_at > now()-interval '30 days' GROUP BY 1) s)
  );
  BEGIN
    r := r || jsonb_build_object('consultas_lentas', (SELECT COALESCE(jsonb_agg(x),'[]'::jsonb) FROM (
      SELECT left(query,160) consulta, calls chamadas, round(mean_exec_time::numeric,2) media_ms FROM pg_stat_statements
      WHERE query ILIKE '%public.%' ORDER BY mean_exec_time DESC LIMIT 10) x));
  EXCEPTION WHEN OTHERS THEN r := r || jsonb_build_object('consultas_lentas','[]'::jsonb); END;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.admin_sistema() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_sistema() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_definir_conta(_user_id uuid, _bloqueado boolean DEFAULT NULL, _admin boolean DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF NOT private.has_role(auth.uid(),'administrador') THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF _user_id = auth.uid() AND (_bloqueado IS TRUE OR _admin IS FALSE) THEN RAISE EXCEPTION 'Você não pode bloquear ou rebaixar a própria conta.'; END IF;
  IF _bloqueado IS NOT NULL THEN UPDATE public.profiles SET bloqueado=_bloqueado WHERE id=_user_id; END IF;
  IF _admin IS TRUE THEN INSERT INTO public.user_roles(user_id, role) VALUES (_user_id,'administrador') ON CONFLICT DO NOTHING; END IF;
  IF _admin IS FALSE THEN DELETE FROM public.user_roles WHERE user_id=_user_id AND role='administrador'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.admin_definir_conta(uuid, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_definir_conta(uuid, boolean, boolean) TO authenticated;

-- Usuário não pode alterar o próprio bloqueio
CREATE OR REPLACE FUNCTION private.proteger_bloqueio() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF NEW.bloqueado IS DISTINCT FROM OLD.bloqueado AND auth.uid() IS NOT NULL AND NOT private.has_role(auth.uid(),'administrador') THEN
    NEW.bloqueado := OLD.bloqueado;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.proteger_bloqueio() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS proteger_bloqueio ON public.profiles;
CREATE TRIGGER proteger_bloqueio BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION private.proteger_bloqueio();

-- ===== Limite de requisições =====
CREATE TABLE IF NOT EXISTS public.rate_limits (
  chave text NOT NULL, janela timestamptz NOT NULL, contador integer NOT NULL DEFAULT 0,
  PRIMARY KEY (chave, janela)
);
GRANT ALL ON public.rate_limits TO service_role;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.checar_limite(_chave text, _max integer, _segundos integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w timestamptz := to_timestamp(floor(extract(epoch FROM now())/_segundos)*_segundos); c integer;
BEGIN
  INSERT INTO public.rate_limits(chave,janela,contador) VALUES (left(_chave,200),w,1)
  ON CONFLICT (chave,janela) DO UPDATE SET contador=rate_limits.contador+1 RETURNING contador INTO c;
  IF random() < 0.01 THEN DELETE FROM public.rate_limits WHERE janela < now()-interval '1 hour'; END IF;
  RETURN c <= _max;
END $$;
REVOKE ALL ON FUNCTION public.checar_limite(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.checar_limite(text, integer, integer) TO service_role;
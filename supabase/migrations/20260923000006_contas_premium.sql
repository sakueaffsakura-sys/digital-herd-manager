-- Escala Apecuária Digital (parte 6)
--  Perfil de usuário, perfil visual da propriedade, plano Premium e
--  modo de demonstração (sem cobrança / sem gateway ainda).
--
--  Segurança:
--   * RLS em todas as tabelas novas;
--   * as imagens ficam em buckets privados, com políticas por objeto
--     (avatar = pasta do próprio usuário; logo/banner = pasta da própria
--     propriedade via private.tem_acesso_propriedade);
--   * nenhuma alteração de plano é feita pelo frontend: apenas por função
--     restrita a administradores (ou service_role), com auditoria.
--  Idempotente: pode ser re-executado sem quebrar (DROP/CREATE + IF NOT EXISTS).

-- ---------------------------------------------------------------------------
-- 1) Perfil do usuário: novas colunas (as demais já existem no schema base).
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nome_exibicao text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cargo text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS biografia text;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_nome_completo_len;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_nome_completo_len CHECK (char_length(nome_completo) <= 120);
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_nome_exibicao_len;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_nome_exibicao_len CHECK (char_length(coalesce(nome_exibicao, '')) <= 60);
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_telefone_len;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_telefone_len CHECK (char_length(coalesce(telefone, '')) <= 30);
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_cargo_len;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_cargo_len CHECK (char_length(coalesce(cargo, '')) <= 60);
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_biografia_len;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_biografia_len CHECK (char_length(coalesce(biografia, '')) <= 2000);

-- ---------------------------------------------------------------------------
-- 2) Enums de plano.
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.tipo_plano AS ENUM ('gratuito', 'premium');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.status_assinatura AS ENUM ('ativo', 'trial', 'cancelado', 'expirado', 'pendente');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 3) Perfil visual da propriedade.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.propriedade_perfil (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  propriedade_id uuid NOT NULL UNIQUE REFERENCES public.propriedades(id) ON DELETE CASCADE,
  descricao text,
  telefone text,
  email text,
  endereco text,
  website text,
  logo_url text,
  banner_url text,
  imagem_url text,
  texto_apresentacao text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pp_descricao_len CHECK (char_length(coalesce(descricao, '')) <= 500),
  CONSTRAINT pp_telefone_len CHECK (char_length(coalesce(telefone, '')) <= 30),
  CONSTRAINT pp_email_len CHECK (char_length(coalesce(email, '')) <= 120),
  CONSTRAINT pp_endereco_len CHECK (char_length(coalesce(endereco, '')) <= 200),
  CONSTRAINT pp_website_len CHECK (char_length(coalesce(website, '')) <= 200),
  CONSTRAINT pp_texto_len CHECK (char_length(coalesce(texto_apresentacao, '')) <= 2000)
);

DROP TRIGGER IF EXISTS set_propriedade_perfil_updated_at ON public.propriedade_perfil;
CREATE TRIGGER set_propriedade_perfil_updated_at
  BEFORE UPDATE ON public.propriedade_perfil
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4) Assinaturas e auditoria.
--    Assinatura = contrato atual de um usuário com uma propriedade.
--    O SELECT é liberado aos envolvidos; escrita apenas via função admin.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assinaturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  propriedade_id uuid NOT NULL REFERENCES public.propriedades(id) ON DELETE CASCADE,
  plano public.tipo_plano NOT NULL DEFAULT 'gratuito',
  status public.status_assinatura NOT NULL DEFAULT 'pendente',
  origem text NOT NULL DEFAULT 'demonstracao',
  data_inicio timestamptz,
  data_expiracao timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_assinaturas_updated_at ON public.assinaturas;
CREATE TRIGGER set_assinaturas_updated_at
  BEFORE UPDATE ON public.assinaturas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP INDEX IF EXISTS assinaturas_ativa_unique_idx;
CREATE UNIQUE INDEX assinaturas_ativa_unique_idx
  ON public.assinaturas(user_id, propriedade_id)
  WHERE status IN ('ativo', 'trial');

CREATE TABLE IF NOT EXISTS public.plano_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assinatura_id uuid REFERENCES public.assinaturas(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  propriedade_id uuid,
  alterado_por uuid NOT NULL,
  plano_anterior public.tipo_plano,
  plano_novo public.tipo_plano,
  status_anterior public.status_assinatura,
  status_novo public.status_assinatura,
  motivo text,
  origem text NOT NULL DEFAULT 'demonstracao',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS plano_auditoria_propriedade_created_idx
  ON public.plano_auditoria(propriedade_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 5) RLS das tabelas novas.
-- ---------------------------------------------------------------------------
ALTER TABLE public.propriedade_perfil ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pp_select ON public.propriedade_perfil;
CREATE POLICY pp_select ON public.propriedade_perfil FOR SELECT TO authenticated
  USING (private.tem_acesso_propriedade(propriedade_id));
DROP POLICY IF EXISTS pp_insert ON public.propriedade_perfil;
CREATE POLICY pp_insert ON public.propriedade_perfil FOR INSERT TO authenticated
  WITH CHECK (private.pode_administrar_propriedade(propriedade_id));
DROP POLICY IF EXISTS pp_update ON public.propriedade_perfil;
CREATE POLICY pp_update ON public.propriedade_perfil FOR UPDATE TO authenticated
  USING (private.pode_administrar_propriedade(propriedade_id))
  WITH CHECK (private.pode_administrar_propriedade(propriedade_id));
DROP POLICY IF EXISTS pp_delete ON public.propriedade_perfil;
CREATE POLICY pp_delete ON public.propriedade_perfil FOR DELETE TO authenticated
  USING (private.pode_administrar_propriedade(propriedade_id));

ALTER TABLE public.assinaturas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS assinaturas_select ON public.assinaturas;
CREATE POLICY assinaturas_select ON public.assinaturas FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.pode_administrar_propriedade(propriedade_id));

ALTER TABLE public.plano_auditoria ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS plano_auditoria_select ON public.plano_auditoria;
CREATE POLICY plano_auditoria_select ON public.plano_auditoria FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR propriedade_id IS NOT NULL AND private.pode_administrar_propriedade(propriedade_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.propriedade_perfil TO authenticated;
GRANT SELECT ON public.assinaturas TO authenticated;
GRANT SELECT ON public.plano_auditoria TO authenticated;
GRANT ALL ON public.propriedade_perfil, public.assinaturas, public.plano_auditoria TO service_role;

-- ---------------------------------------------------------------------------
-- 6) Storage: buckets privados + políticas por objeto.
--    Caminhos: profile-avatars/{user_id}/..., property-logos/{propriedade_id}/...,
--              property-banners/{propriedade_id}/...
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('profile-avatars', 'profile-avatars', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('property-logos',  'property-logos',  false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('property-banners', 'property-banners', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Avatar: o usuário só acessa a própria pasta.
DROP POLICY IF EXISTS media_avatar_select ON storage.objects;
CREATE POLICY media_avatar_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'profile-avatars'
         AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS media_avatar_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'profile-avatars'
              AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS media_avatar_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'profile-avatars'
         AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'profile-avatars'
              AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS media_avatar_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'profile-avatars'
         AND (storage.foldername(name))[1] = auth.uid()::text);

-- Logo/banner de propriedade: somente quem tem acesso à propriedade.
DROP POLICY IF EXISTS media_property_select ON storage.objects;
CREATE POLICY media_property_select ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id IN ('property-logos', 'property-banners')
    AND CASE
      WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN private.tem_acesso_propriedade((storage.foldername(name))[1]::uuid)
      ELSE false
    END
  );
DROP POLICY IF EXISTS media_property_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('property-logos', 'property-banners')
    AND CASE
      WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN private.tem_acesso_propriedade((storage.foldername(name))[1]::uuid)
      ELSE false
    END
  );
DROP POLICY IF EXISTS media_property_update ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('property-logos', 'property-banners')
    AND CASE
      WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN private.tem_acesso_propriedade((storage.foldername(name))[1]::uuid)
      ELSE false
    END
  )
  WITH CHECK (
    bucket_id IN ('property-logos', 'property-banners')
    AND CASE
      WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN private.tem_acesso_propriedade((storage.foldername(name))[1]::uuid)
      ELSE false
    END
  );
DROP POLICY IF EXISTS media_property_delete ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id IN ('property-logos', 'property-banners')
    AND CASE
      WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN private.tem_acesso_propriedade((storage.foldername(name))[1]::uuid)
      ELSE false
    END
  );

-- ---------------------------------------------------------------------------
-- 7) Funções: consulta do plano (fonte da verdade) e gestão admin/demo.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.minha_assinatura(_propriedade_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, private
AS $function$
SELECT COALESCE(
  (SELECT jsonb_build_object(
      'id', a.id,
      'plano', a.plano,
      'status', a.status,
      'origem', a.origem,
      'data_inicio', a.data_inicio,
      'data_expiracao', a.data_expiracao,
      'premium_ativo',
        (a.plano = 'premium'
         AND a.status IN ('ativo', 'trial')
         AND (a.data_expiracao IS NULL OR a.data_expiracao > now())),
      'demonstracao', (a.origem = 'demonstracao')
    )
   FROM public.assinaturas a
   WHERE a.propriedade_id = _propriedade_id
     AND a.user_id = auth.uid()
   ORDER BY a.created_at DESC, a.id DESC
   LIMIT 1),
  jsonb_build_object(
    'id', null, 'plano', 'gratuito', 'status', null, 'origem', null,
    'data_inicio', null, 'data_expiracao', null,
    'premium_ativo', false, 'demonstracao', false
  )
)::jsonb
$function$;
REVOKE ALL ON FUNCTION public.minha_assinatura(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.minha_assinatura(uuid) TO authenticated, service_role;

-- Administradores globais ou gestores da propriedade podem gerenciar planos.
CREATE OR REPLACE FUNCTION public.pode_gerenciar_planos()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, private
AS $function$
SELECT EXISTS (
  SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'administrador'
) OR EXISTS (
  SELECT 1 FROM public.propriedade_membros m
  WHERE m.user_id = auth.uid() AND m.role IN ('proprietario', 'administrador')
)
$function$;
REVOKE ALL ON FUNCTION public.pode_gerenciar_planos() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pode_gerenciar_planos() TO authenticated, service_role;

-- Ativa/atualiza o Premium em MODO DEMONSTRAÇÃO (nunca gera cobrança).
CREATE OR REPLACE FUNCTION public.setar_plano_demonstracao(
  _propriedade_id uuid,
  _plano public.tipo_plano DEFAULT 'premium',
  _status public.status_assinatura DEFAULT 'ativo',
  _data_expiracao timestamptz DEFAULT NULL,
  _motivo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  _uid uuid := auth.uid();
  _owner uuid;
  _sub_id uuid;
  _anterior public.tipo_plano;
  _status_anterior public.status_assinatura;
  _premium boolean;
BEGIN
  IF COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'role', '') = 'service_role' THEN
    _uid := COALESCE(NULLIF(current_setting('request.jwt.claims', true)::jsonb->>'sub', '')::uuid, _uid);
  ELSIF NOT (_uid IS NOT NULL AND public.pode_gerenciar_planos()) THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar planos.';
  END IF;

  IF _propriedade_id IS NULL THEN
    RAISE EXCEPTION 'Propriedade obrigatória.';
  END IF;

  SELECT proprietario_id INTO _owner FROM public.propriedades WHERE id = _propriedade_id;
  IF _owner IS NULL THEN
    RAISE EXCEPTION 'Propriedade não encontrada.';
  END IF;

  SELECT a.id, a.plano, a.status INTO _sub_id, _anterior, _status_anterior
  FROM public.assinaturas a
  WHERE a.propriedade_id = _propriedade_id AND a.status IN ('ativo', 'trial')
  ORDER BY a.created_at DESC, a.id DESC
  LIMIT 1;

  IF _sub_id IS NULL THEN
    INSERT INTO public.assinaturas
      (user_id, propriedade_id, plano, status, origem, data_inicio, data_expiracao)
    VALUES
      (_owner, _propriedade_id, _plano, _status, 'demonstracao',
       CASE WHEN _status IN ('ativo', 'trial') THEN now() ELSE NULL END,
       _data_expiracao)
    RETURNING id INTO _sub_id;
  ELSE
    UPDATE public.assinaturas
    SET plano = _plano,
        status = _status,
        origem = 'demonstracao',
        data_inicio = CASE WHEN _status IN ('ativo', 'trial') THEN now() ELSE data_inicio END,
        data_expiracao = _data_expiracao
    WHERE id = _sub_id;
  END IF;

  INSERT INTO public.plano_auditoria
    (assinatura_id, user_id, propriedade_id, alterado_por,
     plano_anterior, plano_novo, status_anterior, status_novo, motivo, origem)
  VALUES
    (_sub_id, _owner, _propriedade_id, _uid,
     _anterior, _plano, _status_anterior, _status, _motivo, 'demonstracao');

  _premium := (_plano = 'premium' AND _status IN ('ativo', 'trial')
               AND (_data_expiracao IS NULL OR _data_expiracao > now()));

  RETURN jsonb_build_object(
    'ok', true,
    'premium_ativo', _premium,
    'plano', _plano,
    'status', _status,
    'demonstracao', true
  );
END;
$$;
REVOKE ALL ON FUNCTION public.setar_plano_demonstracao(uuid, public.tipo_plano, public.status_assinatura, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.setar_plano_demonstracao(uuid, public.tipo_plano, public.status_assinatura, timestamptz, text) TO authenticated, service_role;

-- Encerra a demonstração (não apaga dados das tabelas de negócio).
CREATE OR REPLACE FUNCTION public.cancelar_plano_demonstracao(
  _propriedade_id uuid,
  _motivo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  _uid uuid := auth.uid();
  _owner uuid;
  _sub_id uuid;
  _anterior public.tipo_plano;
  _status_anterior public.status_assinatura;
BEGIN
  IF COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'role', '') = 'service_role' THEN
    _uid := COALESCE(NULLIF(current_setting('request.jwt.claims', true)::jsonb->>'sub', '')::uuid, _uid);
  ELSIF NOT (_uid IS NOT NULL AND public.pode_gerenciar_planos()) THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar planos.';
  END IF;

  SELECT proprietario_id INTO _owner FROM public.propriedades WHERE id = _propriedade_id;
  IF _owner IS NULL THEN
    RAISE EXCEPTION 'Propriedade não encontrada.';
  END IF;

  SELECT a.id, a.plano, a.status INTO _sub_id, _anterior, _status_anterior
  FROM public.assinaturas a
  WHERE a.propriedade_id = _propriedade_id AND a.status IN ('ativo', 'trial')
  ORDER BY a.created_at DESC, a.id DESC
  LIMIT 1;

  IF _sub_id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'ja_cancelado', true);
  END IF;

  UPDATE public.assinaturas
  SET status = 'cancelado',
      data_expiracao = COALESCE(data_expiracao, now())
  WHERE id = _sub_id;

  INSERT INTO public.plano_auditoria
    (assinatura_id, user_id, propriedade_id, alterado_por,
     plano_anterior, plano_novo, status_anterior, status_novo, motivo, origem)
  VALUES
    (_sub_id, _owner, _propriedade_id, _uid,
     _anterior, _anterior, _status_anterior, 'cancelado', _motivo, 'demonstracao');

  RETURN jsonb_build_object('ok', true, 'plano', _anterior, 'status', 'cancelado');
END;
$$;
REVOKE ALL ON FUNCTION public.cancelar_plano_demonstracao(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancelar_plano_demonstracao(uuid, text) TO authenticated, service_role;
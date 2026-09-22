-- Escala Apecuária Digital (parte 7)
-- Entrega da rota /app/perfil:
--   * bucket property-images (foto de perfil da propriedade);
--   * validação Premium no backend (storage): upload/atualização de mídia da
--     propriedade exige assinatura Premium ativa, além do acesso à propriedade;
--   * limites de perfil alinhados ao front-end
--     (nome 150, cargo 100, biografia 1000);
--   * created_at em propriedade_perfil (padronização).
-- Idempotente: pode ser re-executado sem quebrar.

-- ---------------------------------------------------------------------------
-- 1) created_at em propriedade_perfil.
-- ---------------------------------------------------------------------------
ALTER TABLE public.propriedade_perfil
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- ---------------------------------------------------------------------------
-- 2) Bucket property-images (foto de perfil da propriedade).
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('property-images', 'property-images', false, 5242880,
   ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3) Função: mídia Premium liberada para a propriedade.
--    Verdadeira se existir assinatura Premium ativa/trial não expirada.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.midia_propriedade_premium(_propriedade_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $function$
SELECT COALESCE(
  EXISTS (
    SELECT 1 FROM public.assinaturas a
    WHERE a.propriedade_id = _propriedade_id
      AND a.plano = 'premium'
      AND a.status IN ('ativo', 'trial')
      AND (a.data_expiracao IS NULL OR a.data_expiracao > now())
  ),
  false
)
$function$;
REVOKE ALL ON FUNCTION public.midia_propriedade_premium(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.midia_propriedade_premium(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4) Políticas de storage para mídia da propriedade.
--    SELECT/DELETE: acesso à propriedade (imagens continuam visíveis no
--                   plano gratuito, mas não podem ser alteradas).
--    INSERT/UPDATE: acesso + assinatura Premium ativa (validação no backend).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS media_property_select ON storage.objects;
CREATE POLICY media_property_select ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id IN ('property-logos', 'property-banners', 'property-images')
    AND CASE
      WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN private.tem_acesso_propriedade((storage.foldername(name))[1]::uuid)
      ELSE false
    END
  );

DROP POLICY IF EXISTS media_property_insert ON storage.objects;
CREATE POLICY media_property_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('property-logos', 'property-banners', 'property-images')
    AND CASE
      WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN private.tem_acesso_propriedade((storage.foldername(name))[1]::uuid)
             AND public.midia_propriedade_premium((storage.foldername(name))[1]::uuid)
      ELSE false
    END
  );

DROP POLICY IF EXISTS media_property_update ON storage.objects;
CREATE POLICY media_property_update ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('property-logos', 'property-banners', 'property-images')
    AND CASE
      WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN private.tem_acesso_propriedade((storage.foldername(name))[1]::uuid)
      ELSE false
    END
  )
  WITH CHECK (
    bucket_id IN ('property-logos', 'property-banners', 'property-images')
    AND CASE
      WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN private.tem_acesso_propriedade((storage.foldername(name))[1]::uuid)
             AND public.midia_propriedade_premium((storage.foldername(name))[1]::uuid)
      ELSE false
    END
  );

DROP POLICY IF EXISTS media_property_delete ON storage.objects;
CREATE POLICY media_property_delete ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id IN ('property-logos', 'property-banners', 'property-images')
    AND CASE
      WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN private.tem_acesso_propriedade((storage.foldername(name))[1]::uuid)
      ELSE false
    END
  );

-- ---------------------------------------------------------------------------
-- 5) Limites de perfil alinhados à interface.
--    NOT VALID: linhas existentes em desacordo não quebram a migração;
--    novas escritas seguem validando os limites.
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_nome_completo_len;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_nome_completo_len
  CHECK (char_length(btrim(nome_completo)) <= 150) NOT VALID;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_cargo_len;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_cargo_len
  CHECK (char_length(coalesce(btrim(cargo), '')) <= 100) NOT VALID;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_biografia_len;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_biografia_len
  CHECK (char_length(coalesce(biografia, '')) <= 1000) NOT VALID;
CREATE OR REPLACE FUNCTION private.apk_publicado() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (valor::jsonb ->> 'arquivo') FROM public.configuracoes_sistema WHERE chave = 'app_android'
$$;
REVOKE ALL ON FUNCTION private.apk_publicado() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.apk_publicado() TO authenticated;

DROP POLICY IF EXISTS "Usuarios logados veem imagens do site" ON public.imagens_site;
CREATE POLICY "Usuarios ativos veem imagens do site" ON public.imagens_site FOR SELECT TO authenticated
USING (
  chave IN ('fundo_login','banner_inicio','fundo_menu')
  AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.bloqueado)
);

DROP POLICY IF EXISTS "capas: logados leem" ON storage.objects;
CREATE POLICY "capas: leem capas publicadas" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'ebook-capas' AND (
    private.has_role(auth.uid(), 'administrador'::app_role)
    OR EXISTS (SELECT 1 FROM public.ebooks e WHERE e.capa_path = storage.objects.name AND e.publicado)
  )
);

DROP POLICY IF EXISTS aplicativo_ler ON storage.objects;
CREATE POLICY aplicativo_ler ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'aplicativo' AND (
    private.has_role(auth.uid(), 'administrador'::app_role)
    OR name = private.apk_publicado()
  )
);
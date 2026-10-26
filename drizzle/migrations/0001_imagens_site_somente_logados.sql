DROP POLICY IF EXISTS "Todos veem imagens do site" ON public.imagens_site;
REVOKE SELECT ON public.imagens_site FROM anon;
CREATE POLICY "Usuarios logados veem imagens do site" ON public.imagens_site
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
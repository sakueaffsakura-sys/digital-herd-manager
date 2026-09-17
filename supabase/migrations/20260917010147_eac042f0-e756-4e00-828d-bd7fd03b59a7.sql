DROP POLICY IF EXISTS propriedades_insert_debug ON public.propriedades;
DROP FUNCTION IF EXISTS public.whoami();
DROP TABLE IF EXISTS public._t;

DROP POLICY IF EXISTS propriedades_select ON public.propriedades;
CREATE POLICY propriedades_select ON public.propriedades FOR SELECT TO authenticated
USING (
  proprietario_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.propriedade_membros m WHERE m.propriedade_id = propriedades.id AND m.user_id = auth.uid())
);

DROP POLICY IF EXISTS propriedades_update ON public.propriedades;
CREATE POLICY propriedades_update ON public.propriedades FOR UPDATE TO authenticated
USING (
  proprietario_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.propriedade_membros m WHERE m.propriedade_id = propriedades.id AND m.user_id = auth.uid() AND m.role IN ('proprietario','administrador'))
)
WITH CHECK (
  proprietario_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.propriedade_membros m WHERE m.propriedade_id = propriedades.id AND m.user_id = auth.uid() AND m.role IN ('proprietario','administrador'))
);

DELETE FROM public.propriedades WHERE nome IN ('Fazenda Teste','Fazenda Teste CLI','Fazenda Teste Minimal','__teste__');
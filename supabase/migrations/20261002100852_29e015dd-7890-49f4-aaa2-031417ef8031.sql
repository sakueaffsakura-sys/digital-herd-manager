CREATE TABLE public.imagens_site (
  chave text PRIMARY KEY CHECK (chave IN ('fundo_login','banner_inicio','fundo_menu')),
  valor text NOT NULL CHECK (length(valor) <= 1500000),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid
);
GRANT SELECT ON public.imagens_site TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imagens_site TO authenticated;
GRANT ALL ON public.imagens_site TO service_role;
ALTER TABLE public.imagens_site ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Todos veem imagens do site" ON public.imagens_site FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins inserem imagens" ON public.imagens_site FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'administrador'));
CREATE POLICY "Admins alteram imagens" ON public.imagens_site FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'administrador')) WITH CHECK (private.has_role(auth.uid(), 'administrador'));
CREATE POLICY "Admins apagam imagens" ON public.imagens_site FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'administrador'));
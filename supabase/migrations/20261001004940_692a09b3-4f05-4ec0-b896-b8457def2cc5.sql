CREATE TABLE public.configuracoes_sistema (
  chave text PRIMARY KEY,
  valor text,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.configuracoes_sistema TO authenticated;
GRANT ALL ON public.configuracoes_sistema TO service_role;
ALTER TABLE public.configuracoes_sistema ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Logados leem configuracoes" ON public.configuracoes_sistema FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins inserem configuracoes" ON public.configuracoes_sistema FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'administrador'));
CREATE POLICY "Admins alteram configuracoes" ON public.configuracoes_sistema FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'administrador')) WITH CHECK (private.has_role(auth.uid(), 'administrador'));
CREATE POLICY "Admins apagam configuracoes" ON public.configuracoes_sistema FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'administrador'));
ALTER TABLE public.configuracoes_sistema ADD CONSTRAINT valor_tamanho CHECK (valor IS NULL OR length(valor) <= 800000);
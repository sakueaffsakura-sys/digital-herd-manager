CREATE TABLE public.suporte_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  mensagem_id text NOT NULL,
  papel text NOT NULL CHECK (papel IN ('user','assistant')),
  partes jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, mensagem_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suporte_mensagens TO authenticated;
GRANT ALL ON public.suporte_mensagens TO service_role;
ALTER TABLE public.suporte_mensagens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ver minhas mensagens" ON public.suporte_mensagens FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Criar minhas mensagens" ON public.suporte_mensagens FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Atualizar minhas mensagens" ON public.suporte_mensagens FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Apagar minhas mensagens" ON public.suporte_mensagens FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX suporte_mensagens_user_idx ON public.suporte_mensagens (user_id, created_at);
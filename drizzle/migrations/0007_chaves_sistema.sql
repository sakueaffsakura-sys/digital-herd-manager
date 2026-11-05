CREATE TABLE public.chaves_sistema (
  nome text PRIMARY KEY CHECK (nome IN ('MERCADOPAGO_ACCESS_TOKEN','MERCADOPAGO_WEBHOOK_SECRET','CHAVE_RESGATE')),
  valor_cifrado text NOT NULL,
  final text NOT NULL,
  alterado_por uuid,
  alterado_em timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.chaves_sistema TO service_role;
ALTER TABLE public.chaves_sistema ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.chaves_sistema IS 'Chaves cifradas no servidor; sem acesso pelo navegador.';
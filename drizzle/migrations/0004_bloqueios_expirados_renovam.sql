CREATE OR REPLACE FUNCTION private.bloqueio_limpa_expirado() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.bloqueios_acesso SET ativo = false, removido_em = now()
  WHERE ativo AND tipo = NEW.tipo AND valor = NEW.valor AND expira_em IS NOT NULL AND expira_em <= now();
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.bloqueio_limpa_expirado() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER bloqueios_acesso_limpa_expirado BEFORE INSERT ON public.bloqueios_acesso FOR EACH ROW EXECUTE FUNCTION private.bloqueio_limpa_expirado();
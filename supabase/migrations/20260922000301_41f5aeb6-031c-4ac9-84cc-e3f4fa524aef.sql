CREATE OR REPLACE FUNCTION private.sincronizar_nascimento_animal()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, private
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.animais
    SET
      mae_id = CASE WHEN mae_id = OLD.vaca_id THEN NULL ELSE mae_id END,
      lote_id = CASE WHEN OLD.lote_id IS NOT NULL AND lote_id = OLD.lote_id THEN NULL ELSE lote_id END
    WHERE id = OLD.bezerro_id
      AND propriedade_id = OLD.propriedade_id;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.bezerro_id IS DISTINCT FROM NEW.bezerro_id THEN
    UPDATE public.animais
    SET
      mae_id = CASE WHEN mae_id = OLD.vaca_id THEN NULL ELSE mae_id END,
      lote_id = CASE WHEN OLD.lote_id IS NOT NULL AND lote_id = OLD.lote_id THEN NULL ELSE lote_id END
    WHERE id = OLD.bezerro_id
      AND propriedade_id = OLD.propriedade_id;
  END IF;

  UPDATE public.animais
  SET
    mae_id = NEW.vaca_id,
    lote_id = COALESCE(NEW.lote_id, lote_id)
  WHERE id = NEW.bezerro_id
    AND propriedade_id = NEW.propriedade_id;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.sincronizar_nascimento_animal() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.sincronizar_nascimento_animal() TO authenticated, service_role;

DROP TRIGGER IF EXISTS sync_nascimento_animal ON public.nascimentos;
CREATE TRIGGER sync_nascimento_animal
AFTER INSERT OR UPDATE OR DELETE ON public.nascimentos
FOR EACH ROW EXECUTE FUNCTION private.sincronizar_nascimento_animal();

CREATE OR REPLACE FUNCTION private.sincronizar_venda_animal()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, private
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.animal_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.vendas
         WHERE animal_id = OLD.animal_id
           AND id <> OLD.id
       ) THEN
      UPDATE public.animais
      SET situacao = 'ativo'
      WHERE id = OLD.animal_id
        AND propriedade_id = OLD.propriedade_id
        AND situacao = 'vendido';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.animal_id IS DISTINCT FROM NEW.animal_id AND OLD.animal_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.vendas
      WHERE animal_id = OLD.animal_id
        AND id <> OLD.id
    ) THEN
      UPDATE public.animais
      SET situacao = 'ativo'
      WHERE id = OLD.animal_id
        AND propriedade_id = OLD.propriedade_id
        AND situacao = 'vendido';
    END IF;
  END IF;

  IF NEW.animal_id IS NOT NULL THEN
    UPDATE public.animais
    SET situacao = 'vendido', lote_id = NULL
    WHERE id = NEW.animal_id
      AND propriedade_id = NEW.propriedade_id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.sincronizar_venda_animal() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.sincronizar_venda_animal() TO authenticated, service_role;

DROP TRIGGER IF EXISTS sync_venda_animal ON public.vendas;
CREATE TRIGGER sync_venda_animal
AFTER INSERT OR UPDATE OR DELETE ON public.vendas
FOR EACH ROW EXECUTE FUNCTION private.sincronizar_venda_animal();
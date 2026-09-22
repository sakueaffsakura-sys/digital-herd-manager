-- Escala Apecuária Digital (parte 3)
--  Triggers financeiros de compras/vendas corrigidos e idempotentes.
--  - Seleciona a coluna correta por tabela (item para vendas,
--    produto_animal para compras) via to_jsonb(NEW) — imune a erros de campo.
--  - Cria/atualiza SEMPRE por chave de origem (origem_tipo, origem_id):
--    retry/duplicação não geram segunda movimentação financeira.
--  - Atualização de linhas legadas sem movimentacao_id passa a criar o
--    lançamento (antes atualizava em branco e nunca criava).

CREATE OR REPLACE FUNCTION private.sincronizar_operacao_financeira()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  mov_id uuid;
  mov_tipo public.tipo_movimento;
  fonte text;
  desc_text text;
  origem public.tipo_operacao;
  linha jsonb;
BEGIN
  IF TG_TABLE_NAME = 'vendas' THEN
    linha := to_jsonb(NEW);
    mov_tipo := 'receita'::public.tipo_movimento;
    origem   := 'venda'::public.tipo_operacao;
    fonte    := COALESCE(NULLIF(linha->>'item',''), NULLIF(linha->>'produto_animal',''), 'Venda sem item');
  ELSIF TG_TABLE_NAME = 'compras' THEN
    linha := to_jsonb(NEW);
    mov_tipo := 'despesa'::public.tipo_movimento;
    origem   := 'compra'::public.tipo_operacao;
    fonte    := COALESCE(NULLIF(linha->>'produto_animal',''), NULLIF(linha->>'item',''), 'Compra sem produto');
  ELSE
    RETURN NEW;
  END IF;

  desc_text := CASE WHEN TG_TABLE_NAME = 'vendas' THEN 'Venda: ' ELSE 'Compra: ' END || fonte;

  INSERT INTO public.movimentacoes_financeiras
    (propriedade_id, tipo, categoria, descricao, valor, data, origem_tipo, origem_id, observacao)
  VALUES
    (NEW.propriedade_id, mov_tipo, NEW.categoria, desc_text, NEW.valor, NEW.data, origem, NEW.id, NEW.observacao)
  ON CONFLICT (origem_tipo, origem_id) WHERE origem_id IS NOT NULL
  DO UPDATE SET
    propriedade_id = EXCLUDED.propriedade_id,
    tipo           = EXCLUDED.tipo,
    categoria      = EXCLUDED.categoria,
    descricao      = EXCLUDED.descricao,
    valor          = EXCLUDED.valor,
    data           = EXCLUDED.data,
    observacao     = EXCLUDED.observacao
  RETURNING id INTO mov_id;

  NEW.movimentacao_id := mov_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.excluir_operacao_financeira()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF OLD.movimentacao_id IS NULL THEN
    RETURN OLD;
  END IF;
  DELETE FROM public.movimentacoes_financeiras WHERE id = OLD.movimentacao_id;
  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION private.sincronizar_operacao_financeira() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.excluir_operacao_financeira() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.sincronizar_operacao_financeira() TO service_role;
GRANT EXECUTE ON FUNCTION private.excluir_operacao_financeira() TO service_role;

-- Garante que os disparos continuem apontando para as funções (idempotente).
DROP TRIGGER IF EXISTS sync_compra_financeiro ON public.compras;
CREATE TRIGGER sync_compra_financeiro BEFORE INSERT OR UPDATE ON public.compras
  FOR EACH ROW EXECUTE FUNCTION private.sincronizar_operacao_financeira();
DROP TRIGGER IF EXISTS sync_venda_financeiro ON public.vendas;
CREATE TRIGGER sync_venda_financeiro BEFORE INSERT OR UPDATE ON public.vendas
  FOR EACH ROW EXECUTE FUNCTION private.sincronizar_operacao_financeira();
DROP TRIGGER IF EXISTS delete_compra_financeiro ON public.compras;
CREATE TRIGGER delete_compra_financeiro AFTER DELETE ON public.compras
  FOR EACH ROW EXECUTE FUNCTION private.excluir_operacao_financeira();
DROP TRIGGER IF EXISTS delete_venda_financeiro ON public.vendas;
CREATE TRIGGER delete_venda_financeiro AFTER DELETE ON public.vendas
  FOR EACH ROW EXECUTE FUNCTION private.excluir_operacao_financeira();
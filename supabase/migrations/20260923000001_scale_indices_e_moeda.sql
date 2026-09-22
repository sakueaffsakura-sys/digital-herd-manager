-- Escala Apecuária Digital (parte 1)
--  Índices compostos para milhões de registros + alargamento de valores monetários
--  + deduplicação financeira idempotente (origem compra/venda).
-- Idempotente: pode ser re-executado com segurança.

-- ---------------------------------------------------------------------------
-- 1) Alargar colunas monetárias para suportar operações muito grandes (até
--    nove dígitos inteiros / 18,2), sem perda de precisão (numeric é exato).
-- ---------------------------------------------------------------------------
ALTER TABLE public.movimentacoes_financeiras ALTER COLUMN valor TYPE numeric(18,2);
ALTER TABLE public.investimentos ALTER COLUMN valor TYPE numeric(18,2);
ALTER TABLE public.compras ALTER COLUMN valor TYPE numeric(18,2);
ALTER TABLE public.vendas ALTER COLUMN valor TYPE numeric(18,2);
ALTER TABLE public.producao_leite ALTER COLUMN valor_litro TYPE numeric(14,2);
ALTER TABLE public.producao_leite ALTER COLUMN valor_total TYPE numeric(16,2);

-- ---------------------------------------------------------------------------
-- 2) Índices compostos por propriedade para filtros, ordenação e chaveset.
--    Ordem DESC casada com ORDER BY created_at DESC / data DESC do app.
-- ---------------------------------------------------------------------------

-- lotes
CREATE INDEX IF NOT EXISTS lotes_propriedade_created_idx ON public.lotes(propriedade_id, created_at DESC, id DESC);

-- animais
CREATE INDEX IF NOT EXISTS animais_propriedade_created_idx ON public.animais(propriedade_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS animais_propriedade_lote_idx ON public.animais(propriedade_id, lote_id);
CREATE INDEX IF NOT EXISTS animais_mae_idx ON public.animais(mae_id);
CREATE INDEX IF NOT EXISTS animais_pai_idx ON public.animais(pai_id);

-- pesagens
CREATE INDEX IF NOT EXISTS pesagens_propriedade_animal_data_idx ON public.pesagens(propriedade_id, animal_id, data DESC);
CREATE INDEX IF NOT EXISTS pesagens_propriedade_created_idx ON public.pesagens(propriedade_id, created_at DESC, id DESC);

-- nascimentos
CREATE INDEX IF NOT EXISTS nascimentos_propriedade_created_idx ON public.nascimentos(propriedade_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS nascimentos_vaca_idx ON public.nascimentos(vaca_id);
CREATE INDEX IF NOT EXISTS nascimentos_bezerro_idx ON public.nascimentos(bezerro_id);

-- tipos_vacinas (FK usada por vacinacoes)
CREATE INDEX IF NOT EXISTS tipos_vacinas_propriedade_created_idx ON public.tipos_vacinas(propriedade_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS vacinacoes_tipo_vacina_idx ON public.vacinacoes(tipo_vacina_id);

-- vacinacoes
CREATE INDEX IF NOT EXISTS vacinacoes_propriedade_animal_data_idx ON public.vacinacoes(propriedade_id, animal_id, data_aplicacao DESC);
CREATE INDEX IF NOT EXISTS vacinacoes_propriedade_lote_idx ON public.vacinacoes(propriedade_id, lote_id);
CREATE INDEX IF NOT EXISTS vacinacoes_propriedade_created_idx ON public.vacinacoes(propriedade_id, created_at DESC, id DESC);

-- inseminacoes
CREATE INDEX IF NOT EXISTS inseminacoes_propriedade_animal_data_idx ON public.inseminacoes(propriedade_id, animal_id, data_inseminacao DESC);
CREATE INDEX IF NOT EXISTS inseminacoes_animal_idx ON public.inseminacoes(animal_id);
CREATE INDEX IF NOT EXISTS inseminacoes_propriedade_created_idx ON public.inseminacoes(propriedade_id, created_at DESC, id DESC);

-- producao_leite
CREATE INDEX IF NOT EXISTS leite_propriedade_animal_data_idx ON public.producao_leite(propriedade_id, animal_id, data DESC);
CREATE INDEX IF NOT EXISTS leite_propriedade_created_idx ON public.producao_leite(propriedade_id, created_at DESC, id DESC);

-- anotacoes_producao (não tinha índice algum)
CREATE INDEX IF NOT EXISTS anotacoes_propriedade_data_idx ON public.anotacoes_producao(propriedade_id, data DESC);
CREATE INDEX IF NOT EXISTS anotacoes_propriedade_animal_idx ON public.anotacoes_producao(propriedade_id, animal_id);
CREATE INDEX IF NOT EXISTS anotacoes_propriedade_lote_idx ON public.anotacoes_producao(propriedade_id, lote_id);
CREATE INDEX IF NOT EXISTS anotacoes_propriedade_created_idx ON public.anotacoes_producao(propriedade_id, created_at DESC, id DESC);

-- movimentacoes_financeiras
CREATE INDEX IF NOT EXISTS financeiro_propriedade_created_idx ON public.movimentacoes_financeiras(propriedade_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS financeiro_origem_idx ON public.movimentacoes_financeiras(origem_tipo, origem_id);

-- investimentos
CREATE INDEX IF NOT EXISTS investimentos_propriedade_data_idx ON public.investimentos(propriedade_id, data DESC, id DESC);
CREATE INDEX IF NOT EXISTS investimentos_propriedade_created_idx ON public.investimentos(propriedade_id, created_at DESC, id DESC);

-- compras / vendas
CREATE INDEX IF NOT EXISTS compras_propriedade_created_idx ON public.compras(propriedade_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS compras_propriedade_fornecedor_idx ON public.compras(propriedade_id, fornecedor);
CREATE INDEX IF NOT EXISTS vendas_propriedade_created_idx ON public.vendas(propriedade_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS vendas_propriedade_comprador_idx ON public.vendas(propriedade_id, comprador);
CREATE INDEX IF NOT EXISTS vendas_propriedade_animal_idx ON public.vendas(propriedade_id, animal_id);

-- usuários / membros / notificações
CREATE INDEX IF NOT EXISTS membros_propriedade_idx ON public.propriedade_membros(propriedade_id);
CREATE INDEX IF NOT EXISTS notificacoes_user_created_idx ON public.notificacoes(user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 3) Idempotência financeira: no máximo UMA movimentação por origem.
--    Primeiro repara eventuais duplicatas antigas (sem apagar dados que
--    compras/vendas ainda referenciam), depois cria o constraint único.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private._reparar_duplicatas_origem()
RETURNS void
LANGUAGE plpgsql
SET search_path = public, private
AS $$
DECLARE
  d record;
  grupos integer;
BEGIN
  -- repoint compras que apontam para movimentação duplicada para a "mantida"
  FOR d IN
    SELECT origem_id, MIN(id) AS keep_id
    FROM public.movimentacoes_financeiras
    WHERE origem_id IS NOT NULL
    GROUP BY origem_tipo, origem_id
    HAVING COUNT(*) > 1
  LOOP
    UPDATE public.compras
    SET movimentacao_id = d.keep_id
    WHERE id = d.origem_id
      AND movimentacao_id IS NOT NULL
      AND movimentacao_id <> d.keep_id;

    UPDATE public.vendas
    SET movimentacao_id = d.keep_id
    WHERE id = d.origem_id
      AND movimentacao_id IS NOT NULL
      AND movimentacao_id <> d.keep_id;
  END LOOP;

  DELETE FROM public.movimentacoes_financeiras del
  USING (
    SELECT propriedade_id, origem_tipo, origem_id, MIN(id) AS keep_id
    FROM public.movimentacoes_financeiras
    WHERE origem_id IS NOT NULL
    GROUP BY propriedade_id, origem_tipo, origem_id
    HAVING COUNT(*) > 1
  ) dups
  WHERE del.propriedade_id = dups.propriedade_id
    AND del.origem_tipo = dups.origem_tipo
    AND del.origem_id = dups.origem_id
    AND del.id <> dups.keep_id;

  GET DIAGNOSTICS grupos = ROW_COUNT;
  RAISE NOTICE 'Movimentações duplicadas removidas: %', grupos;
END;
$$;

SELECT private._reparar_duplicatas_origem();

CREATE UNIQUE INDEX IF NOT EXISTS uq_movimentacoes_origem
  ON public.movimentacoes_financeiras(origem_tipo, origem_id)
  WHERE origem_id IS NOT NULL;
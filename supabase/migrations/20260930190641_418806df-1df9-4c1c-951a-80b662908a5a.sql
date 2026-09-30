CREATE INDEX IF NOT EXISTS lotes_propriedade_created_idx ON public.lotes(propriedade_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS animais_propriedade_created_idx ON public.animais(propriedade_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS animais_propriedade_lote_idx ON public.animais(propriedade_id, lote_id);
CREATE INDEX IF NOT EXISTS animais_mae_idx ON public.animais(mae_id);
CREATE INDEX IF NOT EXISTS animais_pai_idx ON public.animais(pai_id);
CREATE INDEX IF NOT EXISTS pesagens_propriedade_animal_data_idx ON public.pesagens(propriedade_id, animal_id, data DESC);
CREATE INDEX IF NOT EXISTS pesagens_propriedade_created_idx ON public.pesagens(propriedade_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS nascimentos_propriedade_created_idx ON public.nascimentos(propriedade_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS nascimentos_vaca_idx ON public.nascimentos(vaca_id);
CREATE INDEX IF NOT EXISTS nascimentos_bezerro_idx ON public.nascimentos(bezerro_id);
CREATE INDEX IF NOT EXISTS tipos_vacinas_propriedade_created_idx ON public.tipos_vacinas(propriedade_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS vacinacoes_tipo_vacina_idx ON public.vacinacoes(tipo_vacina_id);
CREATE INDEX IF NOT EXISTS vacinacoes_propriedade_animal_data_idx ON public.vacinacoes(propriedade_id, animal_id, data_aplicacao DESC);
CREATE INDEX IF NOT EXISTS vacinacoes_propriedade_lote_idx ON public.vacinacoes(propriedade_id, lote_id);
CREATE INDEX IF NOT EXISTS vacinacoes_propriedade_created_idx ON public.vacinacoes(propriedade_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS inseminacoes_propriedade_animal_data_idx ON public.inseminacoes(propriedade_id, animal_id, data_inseminacao DESC);
CREATE INDEX IF NOT EXISTS inseminacoes_animal_idx ON public.inseminacoes(animal_id);
CREATE INDEX IF NOT EXISTS inseminacoes_propriedade_created_idx ON public.inseminacoes(propriedade_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS leite_propriedade_animal_data_idx ON public.producao_leite(propriedade_id, animal_id, data DESC);
CREATE INDEX IF NOT EXISTS leite_propriedade_created_idx ON public.producao_leite(propriedade_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS anotacoes_propriedade_data_idx ON public.anotacoes_producao(propriedade_id, data DESC);
CREATE INDEX IF NOT EXISTS anotacoes_propriedade_animal_idx ON public.anotacoes_producao(propriedade_id, animal_id);
CREATE INDEX IF NOT EXISTS anotacoes_propriedade_lote_idx ON public.anotacoes_producao(propriedade_id, lote_id);
CREATE INDEX IF NOT EXISTS anotacoes_propriedade_created_idx ON public.anotacoes_producao(propriedade_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS financeiro_propriedade_created_idx ON public.movimentacoes_financeiras(propriedade_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS financeiro_propriedade_data_idx ON public.movimentacoes_financeiras(propriedade_id, data DESC);
CREATE INDEX IF NOT EXISTS investimentos_propriedade_created_idx ON public.investimentos(propriedade_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS compras_propriedade_created_idx ON public.compras(propriedade_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS vendas_propriedade_created_idx ON public.vendas(propriedade_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS vendas_propriedade_animal_idx ON public.vendas(propriedade_id, animal_id);
CREATE INDEX IF NOT EXISTS membros_propriedade_idx ON public.propriedade_membros(propriedade_id);
CREATE INDEX IF NOT EXISTS membros_user_idx ON public.propriedade_membros(user_id);
CREATE INDEX IF NOT EXISTS notificacoes_user_created_idx ON public.notificacoes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS propriedades_dono_idx ON public.propriedades(proprietario_id);

DELETE FROM public.movimentacoes_financeiras del USING (
  SELECT origem_tipo, origem_id, MIN(id::text)::uuid AS keep_id FROM public.movimentacoes_financeiras
  WHERE origem_id IS NOT NULL GROUP BY origem_tipo, origem_id HAVING COUNT(*) > 1) d
WHERE del.origem_tipo=d.origem_tipo AND del.origem_id=d.origem_id AND del.id<>d.keep_id
  AND NOT EXISTS (SELECT 1 FROM public.compras c WHERE c.movimentacao_id=del.id)
  AND NOT EXISTS (SELECT 1 FROM public.vendas v WHERE v.movimentacao_id=del.id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_movimentacoes_origem
  ON public.movimentacoes_financeiras(origem_tipo, origem_id) WHERE origem_id IS NOT NULL;

ALTER TABLE public.nascimentos DROP CONSTRAINT IF EXISTS nascimentos_vaca_dif_bezerro;
ALTER TABLE public.nascimentos ADD CONSTRAINT nascimentos_vaca_dif_bezerro CHECK (vaca_id <> bezerro_id) NOT VALID;
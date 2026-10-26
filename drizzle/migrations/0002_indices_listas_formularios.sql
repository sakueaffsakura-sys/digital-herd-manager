CREATE INDEX IF NOT EXISTS lotes_prop_ativo_id_idx ON public.lotes (propriedade_id, ativo, id) INCLUDE (nome);
CREATE INDEX IF NOT EXISTS tipos_vacinas_prop_ativo_id_idx ON public.tipos_vacinas (propriedade_id, ativo, id) INCLUDE (nome);
CREATE INDEX IF NOT EXISTS producao_leite_prop_data_idx ON public.producao_leite (propriedade_id, data);
ANALYZE public.lotes; ANALYZE public.tipos_vacinas; ANALYZE public.animais; ANALYZE public.producao_leite;
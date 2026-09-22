-- Escala Apecuária Digital (parte 2)
--  Constraints de integridade + função para revisão manual de inconsistências.
--  Constraints novas são adicionadas como NOT VALID: passam a valer para novos
--  INSERT/UPDATE sem bloquear a tabela; registros antigos inválidos são
--  listados pela função private.registros_inconsistentes para revisão manual
--  (nada é apagado automaticamente).

-- ---------------------------------------------------------------------------
-- 1) Datas futuras inválidas (folga de 1 dia por fuso do cliente).
-- ---------------------------------------------------------------------------
ALTER TABLE public.animais                  ADD CONSTRAINT IF NOT EXISTS animais_data_nasc_valid       CHECK (data_nascimento IS NULL OR data_nascimento <= current_date + interval '1 day') NOT VALID;
ALTER TABLE public.pesagens                 ADD CONSTRAINT IF NOT EXISTS pesagens_data_valid           CHECK (data <= current_date + interval '1 day') NOT VALID;
ALTER TABLE public.nascimentos               ADD CONSTRAINT IF NOT EXISTS nascimentos_data_valid       CHECK (data_nascimento <= current_date + interval '1 day') NOT VALID;
ALTER TABLE public.vacinacoes               ADD CONSTRAINT IF NOT EXISTS vacinacoes_data_valid        CHECK (data_aplicacao <= current_date + interval '1 day') NOT VALID;
ALTER TABLE public.inseminacoes             ADD CONSTRAINT IF NOT EXISTS inseminacoes_data_valid      CHECK (data_inseminacao <= current_date + interval '1 day') NOT VALID;
ALTER TABLE public.producao_leite           ADD CONSTRAINT IF NOT EXISTS producao_data_valid          CHECK (data <= current_date + interval '1 day') NOT VALID;
ALTER TABLE public.anotacoes_producao       ADD CONSTRAINT IF NOT EXISTS anotacoes_data_valid         CHECK (data <= current_date + interval '1 day') NOT VALID;
ALTER TABLE public.movimentacoes_financeiras ADD CONSTRAINT IF NOT EXISTS financeiro_data_valid        CHECK (data <= current_date + interval '1 day') NOT VALID;
ALTER TABLE public.investimentos            ADD CONSTRAINT IF NOT EXISTS investimentos_data_valid     CHECK (data <= current_date + interval '1 day') NOT VALID;
ALTER TABLE public.compras                  ADD CONSTRAINT IF NOT EXISTS compras_data_valid           CHECK (data <= current_date + interval '1 day') NOT VALID;
ALTER TABLE public.vendas                   ADD CONSTRAINT IF NOT EXISTS vendas_data_valid            CHECK (data <= current_date + interval '1 day') NOT VALID;

-- ---------------------------------------------------------------------------
-- 2) Nascimento com a mesma vaca e bezerro é proibido.
-- ---------------------------------------------------------------------------
ALTER TABLE public.nascimentos ADD CONSTRAINT IF NOT EXISTS nascimentos_vaca_dif_bezerro
  CHECK (vaca_id <> bezerro_id) NOT VALID;

-- ---------------------------------------------------------------------------
-- 3) Reforço de liberações (already existentes no schema base):
--    - UNIQUE(propriedade_id, numero_brinco)          => brinco único por propriedade
--    - vacinacoes CHECK (animal XOR lote = 1)          => sem vacinação sem alvo
--    - vacinacoes proxi/des/iniciadas, checks de valor >= 0.
--    Mantidos como estão; aqui apenas deixamos garantias equivalentes e
--    explícitas em outras tabelas de valores.
-- ---------------------------------------------------------------------------
ALTER TABLE public.compras ADD CONSTRAINT IF NOT EXISTS compras_categoria_valid CHECK (btrim(categoria) <> '') NOT VALID;
ALTER TABLE public.vendas  ADD CONSTRAINT IF NOT EXISTS vendas_categoria_valid  CHECK (btrim(categoria) <> '') NOT VALID;
ALTER TABLE public.movimentacoes_financeiras ADD CONSTRAINT IF NOT EXISTS financeiro_categoria_valid  CHECK (btrim(categoria) <> '') NOT VALID;
ALTER TABLE public.movimentacoes_financeiras ADD CONSTRAINT IF NOT EXISTS financeiro_descricao_valid  CHECK (btrim(descricao) <> '') NOT VALID;

-- ---------------------------------------------------------------------------
-- 4) Revisão manual de inconsistências (não apaga nada; só reporta).
--    SECURITY INVOKER + filtro por propriedade => respeita RLS/isolamento.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registros_inconsistentes(_propriedade_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, private
AS $$
DECLARE
  resultado jsonb := '[]'::jsonb;
  exemplos jsonb;
  qtd bigint;
BEGIN
  IF NOT public.tem_acesso_propriedade(_propriedade_id) THEN
    RETURN '[]'::jsonb;
  END IF;

  -- (a) Nascimentos com vaca = bezerro
  SELECT COUNT(*), COALESCE(jsonb_agg(jsonb_build_object('id', id, 'vaca_id', vaca_id, 'bezerro_id', bezerro_id)), '[]'::jsonb)
    INTO qtd, exemplos
    FROM (SELECT id, vaca_id, bezerro_id FROM public.nascimentos WHERE propriedade_id=_propriedade_id AND vaca_id=bezerro_id LIMIT 10) s;
  IF qtd > 0 THEN
    resultado := resultado || jsonb_build_object('tabela','nascimentos','checagem','vaca igual ao bezerro','qtd',qtd,'exemplos',exemplos);
  END IF;

  -- (b) Vacinações sem destino (animal XOR lote violado)
  SELECT COUNT(*), COALESCE(jsonb_agg(jsonb_build_object('id', id)), '[]'::jsonb)
    INTO qtd, exemplos
    FROM (SELECT id FROM public.vacinacoes WHERE propriedade_id=_propriedade_id AND (animal_id IS NULL OR lote_id IS NULL) LIMIT 10) s;
  IF qtd > 0 THEN
    resultado := resultado || jsonb_build_object('tabela','vacinacoes','checagem','vacinação sem animal ou lote','qtd',qtd,'exemplos',exemplos);
  END IF;

  -- (c) Vacinações com animal E lote simultâneos
  SELECT COUNT(*) INTO qtd FROM public.vacinacoes WHERE propriedade_id=_propriedade_id AND animal_id IS NOT NULL AND lote_id IS NOT NULL;
  IF qtd > 0 THEN
    resultado := resultado || jsonb_build_object('tabela','vacinacoes','checagem','vacinação simultânea animal+lote','qtd',qtd,'exemplos','[]'::jsonb);
  END IF;

  -- (d) Datas futuras (várias tabelas)
  SELECT (SELECT COUNT(*) FROM public.pesagens WHERE propriedade_id=_propriedade_id AND data > current_date + interval '1 day')
       + (SELECT COUNT(*) FROM public.nascimentos WHERE propriedade_id=_propriedade_id AND data_nascimento > current_date + interval '1 day')
       + (SELECT COUNT(*) FROM public.vacinacoes WHERE propriedade_id=_propriedade_id AND data_aplicacao > current_date + interval '1 day')
       + (SELECT COUNT(*) FROM public.inseminacoes WHERE propriedade_id=_propriedade_id AND data_inseminacao > current_date + interval '1 day')
       + (SELECT COUNT(*) FROM public.producao_leite WHERE propriedade_id=_propriedade_id AND data > current_date + interval '1 day')
       + (SELECT COUNT(*) FROM public.anotacoes_producao WHERE propriedade_id=_propriedade_id AND data > current_date + interval '1 day')
       + (SELECT COUNT(*) FROM public.movimentacoes_financeiras WHERE propriedade_id=_propriedade_id AND data > current_date + interval '1 day')
       + (SELECT COUNT(*) FROM public.compras WHERE propriedade_id=_propriedade_id AND data > current_date + interval '1 day')
       + (SELECT COUNT(*) FROM public.vendas WHERE propriedade_id=_propriedade_id AND data > current_date + interval '1 day')
    INTO qtd;
  IF qtd > 0 THEN
    resultado := resultado || jsonb_build_object('tabela','datas','checagem','registros com data no futuro','qtd',qtd,'exemplos','[]'::jsonb);
  END IF;

  -- (e) Animais com número de brinco duplicado na propriedade (protegido por unique)
  SELECT COUNT(*) INTO qtd
    FROM (SELECT numero_brinco FROM public.animais WHERE propriedade_id=_propriedade_id GROUP BY numero_brinco HAVING COUNT(*) > 1) s;
  IF qtd > 0 THEN
    resultado := resultado || jsonb_build_object('tabela','animais','checagem','números de brinco duplicados','qtd',qtd,'exemplos','[]'::jsonb);
  END IF;

  RETURN resultado;
END;
$$;

REVOKE ALL ON FUNCTION public.registros_inconsistentes(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registros_inconsistentes(uuid) TO authenticated, service_role;
-- Teste de fumaça do banco do Apecuária Digital (roda num PostgreSQL de teste, NUNCA no banco de produção).
-- Uso: psql -v ON_ERROR_STOP=1 -f testes/banco/smoke.sql <banco-de-teste>
-- Pressupõe que todas as migrações já foram aplicadas e que existem os papéis do Supabase
-- (anon, authenticated, service_role) e auth.uid(). Tudo roda numa transação que é desfeita no fim.
BEGIN;

CREATE FUNCTION pg_temp.como(uid uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', uid::text, true);
  SET LOCAL ROLE authenticated;
END $$;

DO $teste$
DECLARE
  a uuid := '00000000-0000-0000-0000-0000000000a1';
  b uuid := '00000000-0000-0000-0000-0000000000b2';
  adm uuid := '00000000-0000-0000-0000-0000000000ad';
  prop uuid; lote uuid; vaca uuid; bez uuid; nota1 uuid; nota2 uuid;
  n int; j jsonb; falhou boolean;
BEGIN
  RESET ROLE;
  INSERT INTO auth.users(id, email, raw_user_meta_data) VALUES
    (a, 'a@teste.local', '{"nome_completo":"Ana"}'), (b, 'b@teste.local', '{}'), (adm, 'adm@teste.local', '{}');
  ASSERT (SELECT count(*) FROM public.profiles WHERE id IN (a,b,adm)) = 3, 'o gatilho de perfil deve criar um perfil por usuário';
  INSERT INTO public.user_roles(user_id, role) VALUES (adm, 'administrador');

  -- ===== Usuária A cria a fazenda e cadastra dados =====
  PERFORM pg_temp.como(a);
  INSERT INTO public.propriedades(proprietario_id, nome) VALUES (a, 'Fazenda da Ana') RETURNING id INTO prop;
  INSERT INTO public.lotes(propriedade_id, nome) VALUES (prop, 'Lote 1') RETURNING id INTO lote;
  INSERT INTO public.animais(propriedade_id, numero_brinco, nome, sexo, lote_id, data_nascimento) VALUES (prop, '001', 'Mimosa', 'F', lote, current_date - 900) RETURNING id INTO vaca;
  INSERT INTO public.animais(propriedade_id, numero_brinco, sexo, data_nascimento) VALUES (prop, '002', 'F', current_date - 10) RETURNING id INTO bez;

  -- Anotações: com animal, só com lote, sem nada (animal_id é opcional no site)
  INSERT INTO public.anotacoes_producao(propriedade_id, animal_id, data, producao, observacao, comportamento)
    VALUES (prop, vaca, current_date, 18.5, 'Vaca calma', 'tranquila') RETURNING id INTO nota1;
  INSERT INTO public.anotacoes_producao(propriedade_id, lote_id, observacao) VALUES (prop, lote, 'Troca de ração') RETURNING id INTO nota2;
  INSERT INTO public.anotacoes_producao(propriedade_id, observacao) VALUES (prop, 'Chuva forte hoje');
  SELECT count(*) INTO n FROM public.anotacoes_producao WHERE propriedade_id = prop;
  ASSERT n = 3, 'A deve ver as 3 anotações dela, viu ' || n;

  -- updated_at avança ao editar (o app depende disso para baixar só o que mudou).
  -- Dentro de uma transação now() é fixo, então "envelhecemos" a linha sem disparar o gatilho.
  RESET ROLE;
  SET LOCAL session_replication_role = replica;
  UPDATE public.anotacoes_producao SET updated_at = now() - interval '1 hour' WHERE id = nota1;
  SET LOCAL session_replication_role = origin;
  PERFORM pg_temp.como(a);
  UPDATE public.anotacoes_producao SET observacao = 'Vaca calma e comendo bem' WHERE id = nota1;
  ASSERT (SELECT updated_at > now() - interval '1 minute' FROM public.anotacoes_producao WHERE id = nota1), 'updated_at deve avançar ao editar';

  -- Data no futuro (mais de 1 dia) é recusada
  falhou := false;
  BEGIN INSERT INTO public.anotacoes_producao(propriedade_id, observacao, data) VALUES (prop, 'futuro', current_date + 10);
  EXCEPTION WHEN check_violation THEN falhou := true; END;
  ASSERT falhou, 'anotação com data no futuro deve ser recusada';

  -- Brinco repetido é recusado
  falhou := false;
  BEGIN INSERT INTO public.animais(propriedade_id, numero_brinco, sexo) VALUES (prop, '001', 'M');
  EXCEPTION WHEN unique_violation THEN falhou := true; END;
  ASSERT falhou, 'brinco repetido deve ser recusado';

  -- Compra e venda geram lançamento financeiro sozinhos (e sem duplicar)
  INSERT INTO public.compras(propriedade_id, data, produto_animal, quantidade, valor, categoria) VALUES (prop, current_date, 'Ração', 10, 500, 'Insumos');
  INSERT INTO public.vendas(propriedade_id, data, item, quantidade, valor, categoria) VALUES (prop, current_date, 'Leite', 1, 800, 'Leite');
  SELECT count(*) INTO n FROM public.movimentacoes_financeiras WHERE propriedade_id = prop AND origem_tipo IS NOT NULL;
  ASSERT n = 2, 'compra e venda devem gerar 2 lançamentos, geraram ' || n;
  UPDATE public.compras SET valor = 550 WHERE propriedade_id = prop;
  ASSERT (SELECT count(*) FROM public.movimentacoes_financeiras WHERE propriedade_id = prop AND origem_tipo = 'compra') = 1, 'editar a compra não pode duplicar o lançamento';
  ASSERT (SELECT valor FROM public.movimentacoes_financeiras WHERE propriedade_id = prop AND origem_tipo = 'compra') = 550, 'o lançamento deve acompanhar o valor da compra';

  -- Inseminação calcula o parto previsto; nascimento liga o bezerro à mãe
  INSERT INTO public.inseminacoes(propriedade_id, animal_id, data_inseminacao, reprodutor_semen, previsao_parto) VALUES (prop, vaca, current_date - 30, 'Touro X', current_date + 253);
  INSERT INTO public.nascimentos(propriedade_id, vaca_id, bezerro_id, data_nascimento, sexo) VALUES (prop, vaca, bez, current_date - 10, 'F');
  ASSERT (SELECT mae_id FROM public.animais WHERE id = bez) = vaca, 'o nascimento deve ligar o bezerro à mãe';

  -- Vacinação de um animal (lote nulo) NÃO é inconsistência
  INSERT INTO public.tipos_vacinas(propriedade_id, nome, intervalo_dias) VALUES (prop, 'Aftosa', 180);
  INSERT INTO public.vacinacoes(propriedade_id, animal_id, tipo_vacina_id, data_aplicacao)
    SELECT prop, vaca, id, current_date FROM public.tipos_vacinas WHERE propriedade_id = prop;

  -- ===== RPCs usadas pelo site =====
  j := public.dashboard_resumo(prop);
  ASSERT (j->>'total_animais')::int = 2, 'dashboard: total_animais';
  ASSERT (j->>'leite_mes') IS NOT NULL, 'dashboard: leite_mes';
  j := public.relatorio_indicadores(prop, current_date - 30, current_date);
  ASSERT j ? 'litros' AND j ? 'receitas', 'relatorio_indicadores deve trazer litros e receitas';
  j := public.relatorio_indicadores(prop);
  ASSERT j ? 'litros', 'relatorio_indicadores sem datas (período inteiro)';
  j := public.diagnostico_propriedade(prop);
  ASSERT jsonb_array_length(j) = 13, 'diagnostico_propriedade deve listar 13 tabelas';
  ASSERT (SELECT (e->>'contagem')::int FROM jsonb_array_elements(j) e WHERE e->>'tabela' = 'anotacoes_producao') = 3, 'diagnostico: contagem de anotações';
  j := public.registros_inconsistentes(prop);
  ASSERT jsonb_typeof(j) = 'array', 'registros_inconsistentes devolve lista';
  ASSERT NOT EXISTS (SELECT 1 FROM jsonb_array_elements(j) e WHERE e->>'tabela' = 'vacinacoes'), 'vacinação de animal não é inconsistência';
  j := public.minha_assinatura(prop);
  ASSERT (j->>'plano') = 'gratuito', 'sem assinatura = plano gratuito';

  -- ===== Isolamento: B não enxerga nem escreve nos dados de A =====
  PERFORM pg_temp.como(b);
  ASSERT (SELECT count(*) FROM public.anotacoes_producao) = 0, 'B não pode ver anotações de A';
  ASSERT (SELECT count(*) FROM public.animais) = 0, 'B não pode ver animais de A';
  ASSERT (SELECT count(*) FROM public.propriedades) = 0, 'B não pode ver a propriedade de A';
  falhou := false;
  BEGIN INSERT INTO public.anotacoes_producao(propriedade_id, observacao) VALUES (prop, 'invasão');
  EXCEPTION WHEN insufficient_privilege THEN falhou := true; END;
  ASSERT falhou, 'B não pode gravar anotação na propriedade de A';
  ASSERT public.dashboard_resumo(prop) IS NULL, 'dashboard de propriedade alheia vem vazio';
  UPDATE public.anotacoes_producao SET observacao = 'hack' WHERE id = nota1;
  GET DIAGNOSTICS n = ROW_COUNT;
  ASSERT n = 0, 'B não pode editar anotação de A';
  falhou := false;
  BEGIN PERFORM public.admin_contas(); EXCEPTION WHEN OTHERS THEN falhou := true; END;
  ASSERT falhou, 'conta comum não pode chamar admin_contas';
  falhou := false;
  BEGIN PERFORM public.setar_plano_demonstracao(prop); EXCEPTION WHEN OTHERS THEN falhou := true; END;
  ASSERT falhou, 'conta comum não pode ativar plano premium';
  -- B não consegue se desbloquear nem trocar o próprio papel
  falhou := false;
  BEGIN INSERT INTO public.user_roles(user_id, role) VALUES (b, 'administrador'); EXCEPTION WHEN OTHERS THEN falhou := true; END;
  ASSERT falhou, 'conta comum não pode se promover a administrador';

  -- ===== Sincronização do app: cursor (updated_at, id), exclusões e diagnóstico =====
  -- Tudo dentro de um sub-bloco que é desfeito no fim, para não afetar as contagens abaixo.
  DECLARE
    cu_upd timestamptz; cu_id uuid; vistos uuid[] := '{}'; k jsonb; paginas int := 0; total_antes int;
  BEGIN
    PERFORM pg_temp.como(a);
    -- cinco anotações criadas "de uma vez" (mesmo updated_at, como numa importação em massa)
    INSERT INTO public.anotacoes_producao(propriedade_id, observacao) SELECT prop, 'em massa ' || g FROM generate_series(1, 5) g;
    SELECT count(*) INTO total_antes FROM public.anotacoes_producao WHERE propriedade_id = prop;
    ASSERT total_antes = 8, 'esperava 8 anotações, vi ' || total_antes;

    -- baixa de 2 em 2 sem perder nem repetir nenhuma (empate de updated_at resolvido pelo id)
    LOOP
      SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO j FROM public.app_sincronizar('anotacoes_producao', prop, cu_upd, cu_id, 2) x;
      EXIT WHEN jsonb_array_length(j) = 0;
      FOR k IN SELECT * FROM jsonb_array_elements(j) LOOP
        vistos := vistos || (k->>'id')::uuid;
        IF cu_upd IS NULL OR ((k->>'updated_at')::timestamptz, (k->>'id')::uuid) > (cu_upd, cu_id) THEN
          cu_upd := (k->>'updated_at')::timestamptz; cu_id := (k->>'id')::uuid;
        END IF;
      END LOOP;
      paginas := paginas + 1;
      EXIT WHEN paginas > 50;
    END LOOP;
    ASSERT cardinality(vistos) = total_antes, 'a paginação deve entregar todas as ' || total_antes || ' linhas, entregou ' || cardinality(vistos);
    ASSERT (SELECT count(DISTINCT v) FROM unnest(vistos) v) = cardinality(vistos), 'a paginação não pode repetir linhas';
    ASSERT paginas = 4, 'esperava 4 páginas de até 2 linhas, foram ' || paginas;

    -- incremental: só vem o que mudou depois do cursor
    RESET ROLE;
    SET LOCAL session_replication_role = replica;
    UPDATE public.anotacoes_producao SET updated_at = now() - interval '1 hour' WHERE propriedade_id = prop;
    SET LOCAL session_replication_role = origin;
    PERFORM pg_temp.como(a);
    SELECT (x->>'updated_at')::timestamptz, (x->>'id')::uuid INTO cu_upd, cu_id
      FROM public.app_sincronizar('anotacoes_producao', prop, NULL, NULL, 1000) x ORDER BY 1 DESC, 2 DESC LIMIT 1;
    ASSERT (SELECT count(*) FROM public.app_sincronizar('anotacoes_producao', prop, cu_upd, cu_id, 1000)) = 0, 'sem mudanças, nada para baixar';
    UPDATE public.anotacoes_producao SET observacao = 'editada no site' WHERE id = nota1;
    SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO j FROM public.app_sincronizar('anotacoes_producao', prop, cu_upd, cu_id, 1000) x;
    ASSERT jsonb_array_length(j) = 1 AND (j->0->>'id')::uuid = nota1, 'só a anotação editada deve vir no incremental';
    ASSERT j->0->>'observacao' = 'editada no site', 'a linha deve trazer as colunas atuais';

    -- tabela fora da lista e propriedade de outra pessoa
    falhou := false;
    BEGIN PERFORM * FROM public.app_sincronizar('user_roles', prop); EXCEPTION WHEN invalid_parameter_value THEN falhou := true; END;
    ASSERT falhou, 'app_sincronizar não pode servir tabelas fora da lista';
    PERFORM pg_temp.como(b);
    ASSERT (SELECT count(*) FROM public.app_sincronizar('anotacoes_producao', prop)) = 0, 'quem não é da propriedade não baixa nada';
    ASSERT (public.app_diagnostico(prop)->>'propriedade_visivel')::boolean = false, 'o diagnóstico não enxerga a propriedade alheia';
    PERFORM pg_temp.como(a);

    -- diagnóstico
    j := public.app_diagnostico(prop);
    ASSERT (j->'tabelas'->'anotacoes_producao'->>'total')::int = total_antes, 'o diagnóstico deve contar as anotações';
    ASSERT (j->>'propriedade_visivel')::boolean, 'o diagnóstico enxerga a própria propriedade';

    -- exclusões: apagar uma anotação registra uma exclusão; apagar a propriedade inteira, não
    DELETE FROM public.anotacoes_producao WHERE id = nota2;
    ASSERT (SELECT count(*) FROM public.registros_excluidos WHERE propriedade_id = prop AND tabela = 'anotacoes_producao' AND registro_id = nota2) = 1, 'a exclusão deve ser registrada';
    PERFORM pg_temp.como(b);
    ASSERT (SELECT count(*) FROM public.registros_excluidos WHERE propriedade_id = prop) = 0, 'a exclusão só aparece para quem é da propriedade';
    falhou := false;
    BEGIN INSERT INTO public.registros_excluidos(propriedade_id, tabela, registro_id) VALUES (prop, 'animais', gen_random_uuid());
    EXCEPTION WHEN insufficient_privilege THEN falhou := true; END;
    ASSERT falhou, 'ninguém escreve no registro de exclusões a não ser os gatilhos';
    RESET ROLE;
    DELETE FROM public.propriedades WHERE id = prop;
    ASSERT (SELECT count(*) FROM public.registros_excluidos WHERE propriedade_id = prop) = 1, 'apagar a propriedade inteira não deve gerar uma exclusão por linha';

    RAISE EXCEPTION 'desfazer bloco' USING ERRCODE = 'P0099';
  EXCEPTION WHEN SQLSTATE 'P0099' THEN
    NULL; -- tudo o que o bloco fez é desfeito
  END;
  RESET ROLE;

  -- ===== Membro convidado enxerga a propriedade =====
  RESET ROLE;
  INSERT INTO public.propriedade_membros(propriedade_id, user_id, role) VALUES (prop, b, 'colaborador');
  PERFORM pg_temp.como(b);
  ASSERT (SELECT count(*) FROM public.anotacoes_producao WHERE propriedade_id = prop) = 3, 'membro vê as anotações da propriedade';

  -- ===== Administrador do sistema =====
  PERFORM pg_temp.como(adm);
  PERFORM public.admin_contas();
  j := public.admin_metricas();
  ASSERT j ? 'totais', 'admin_metricas deve trazer totais';

  RESET ROLE;
  RAISE NOTICE 'SMOKE OK';
END
$teste$;

ROLLBACK;

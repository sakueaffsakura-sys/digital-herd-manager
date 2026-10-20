-- Prova (num PostgreSQL de teste) que reenviar um lote de importação com os mesmos ids não duplica linhas,
-- que violações de unicidade continuam sendo erro e que outra conta não insere na propriedade alheia.
-- Uso: psql -X -v ON_ERROR_STOP=1 -d <banco-de-teste> -f testes/banco/importacao-idempotente.sql
BEGIN;
CREATE FUNCTION pg_temp.como(uid uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN RESET ROLE; PERFORM set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', uid::text, true); SET LOCAL ROLE authenticated; END $$;
DO $t$
DECLARE a uuid := '00000000-0000-0000-0000-0000000000a1'; b uuid := '00000000-0000-0000-0000-0000000000b2'; prop uuid; i1 uuid := gen_random_uuid(); n int; falhou boolean := false;
BEGIN
  RESET ROLE;
  INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES (a,'a@t.l','{}'),(b,'b@t.l','{}');
  PERFORM pg_temp.como(a);
  INSERT INTO public.propriedades(proprietario_id,nome) VALUES (a,'Fazenda Teste') RETURNING id INTO prop;
  INSERT INTO public.animais(id,propriedade_id,numero_brinco,sexo) VALUES (i1,prop,'X1','F') ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.animais(id,propriedade_id,numero_brinco,sexo) VALUES (i1,prop,'X1','F') ON CONFLICT (id) DO NOTHING;  -- reenvio do mesmo lote
  SELECT count(*) INTO n FROM public.animais WHERE propriedade_id=prop; ASSERT n=1, 'reenvio com o mesmo id não pode duplicar: '||n;
  BEGIN INSERT INTO public.animais(id,propriedade_id,numero_brinco,sexo) VALUES (gen_random_uuid(),prop,'X1','F') ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN unique_violation THEN falhou := true; END;
  ASSERT falhou, 'brinco repetido com id novo continua sendo erro 23505';
  -- outra conta não consegue "sequestrar" o id nem inserir na propriedade alheia
  PERFORM pg_temp.como(b);
  falhou := false;
  BEGIN INSERT INTO public.animais(id,propriedade_id,numero_brinco,sexo) VALUES (i1,prop,'Y9','M') ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN insufficient_privilege THEN falhou := true; END;
  ASSERT falhou, 'conta alheia não pode inserir na propriedade de outra';
  RAISE NOTICE 'UPSERT OK';
END $t$;
ROLLBACK;

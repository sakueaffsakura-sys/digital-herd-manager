-- Exporta as contas do login antigo para o banco novo.
--
-- POR QUE ESTE PASSO É SEU, E NÃO MEU
-- As senhas não saem pela API do site: só por consulta direta ao banco. Rodando você
-- mesmo, as senhas vão do seu banco antigo para o seu banco novo sem passar por mais
-- ninguém no caminho.
--
-- COMO USAR
-- 1. Abra o painel do Supabase > SQL Editor.
-- 2. Cole tudo isto e rode.
-- 3. O resultado é uma coluna de comandos. Copie a coluna inteira.
-- 4. Cole no phpMyAdmin do cPanel, dentro do banco novo, e mande executar.
--
-- IMPORTANTE: rode isto ANTES de importar o resto dos dados. As outras tabelas apontam
-- para as contas, e o banco recusa um perfil de uma conta que ainda não existe.
--
-- As senhas continuam embaralhadas do mesmo jeito que estão hoje (bcrypt): ninguém
-- precisa trocar de senha. Quem entra pelo Google continua entrando pelo Google.

select comando from (

  -- 1. As contas.
  select 1 as ordem, 0 as linha, '-- contas' as comando
  union all
  select 1, row_number() over (order by u.created_at),
    'INSERT INTO `usuarios` (`id`,`email`,`senha_hash`,`email_confirmado_em`,`bloqueado`,`criado_em`,`ultimo_acesso`) VALUES ('
    || quote_literal(u.id::text) || ','
    || quote_literal(lower(u.email)) || ','
    || coalesce(quote_literal(u.encrypted_password), 'NULL') || ','
    || coalesce(quote_literal(to_char(u.email_confirmed_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS.MS')), 'NULL') || ','
    || case when coalesce(p.bloqueado, false) then '1' else '0' end || ','
    || quote_literal(to_char(u.created_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS.MS')) || ','
    || coalesce(quote_literal(to_char(u.last_sign_in_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS.MS')), 'NULL')
    || ');'
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.email is not null and u.deleted_at is null

  union all

  -- 2. Quem entra pelo Google.
  select 2, 0, '-- entrada pelo Google'
  union all
  select 2, row_number() over (order by i.created_at),
    'INSERT INTO `identidades` (`id`,`user_id`,`provedor`,`provedor_id`,`email`,`criado_em`) VALUES ('
    || quote_literal(gen_random_uuid()::text) || ','
    || quote_literal(i.user_id::text) || ','
    || quote_literal(i.provider) || ','
    || quote_literal(i.provider_id) || ','
    || coalesce(quote_literal(lower(i.identity_data->>'email')), 'NULL') || ','
    || quote_literal(to_char(i.created_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS.MS'))
    || ');'
  from auth.identities i
  join auth.users u on u.id = i.user_id and u.deleted_at is null
  where i.provider <> 'email'

  union all

  -- 3. Quem é administrador do sistema.
  select 3, 0, '-- administradores'
  union all
  select 3, row_number() over (order by r.created_at),
    'INSERT INTO `user_roles` (`id`,`user_id`,`role`,`created_at`) VALUES ('
    || quote_literal(r.id::text) || ','
    || quote_literal(r.user_id::text) || ','
    || quote_literal(r.role::text) || ','
    || quote_literal(to_char(r.created_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS.MS'))
    || ');'
  from public.user_roles r

  union all

  -- 4. Conferência: quantas contas saíram e quantas têm senha.
  select 9, 0, '-- conferência (compare com o que entrar no banco novo)'
  union all
  select 9, 1,
    '-- contas: ' || (select count(*) from auth.users where email is not null and deleted_at is null)
    || ' | com senha: ' || (select count(*) from auth.users where encrypted_password is not null and encrypted_password <> '' and deleted_at is null)
    || ' | pelo Google: ' || (select count(*) from auth.identities where provider <> 'email')
    || ' | administradores: ' || (select count(*) from public.user_roles where role = 'administrador')

) tudo
order by ordem, linha;

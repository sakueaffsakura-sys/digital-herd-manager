-- Fase C: assinatura paga (Mercado Pago), área do assinante e biblioteca de eBooks.
-- Proteção no banco: o navegador nunca decide quem é assinante, nunca define preço e nunca lê o PDF direto.
-- Só adições: o site publicado e o app Android continuam funcionando. Pode rodar de novo sem erro.

-- 1) Planos e preços (o administrador define; começam desligados e com preço 0).
create table if not exists public.planos (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 2 and 60),
  descricao text check (descricao is null or char_length(descricao) <= 500),
  meses int not null check (meses between 1 and 36),
  preco_centavos int not null default 0 check (preco_centavos between 0 and 10000000),
  ativo boolean not null default false,
  ordem int not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
alter table public.planos enable row level security;
drop policy if exists planos_ver on public.planos;
create policy planos_ver on public.planos for select to anon, authenticated
  using ((ativo and preco_centavos > 0) or private.has_role(auth.uid(), 'administrador'));
drop policy if exists planos_admin on public.planos;
create policy planos_admin on public.planos for all to authenticated
  using (private.has_role(auth.uid(), 'administrador')) with check (private.has_role(auth.uid(), 'administrador'));
grant select on public.planos to anon, authenticated;
grant insert, update, delete on public.planos to authenticated;
insert into public.planos (nome, descricao, meses, preco_centavos, ativo, ordem)
select * from (values
  ('Mensal', 'Premium por 1 mês: biblioteca de eBooks, importação de planilhas e relatórios completos.', 1, 0, false, 1),
  ('Anual', 'Premium por 12 meses, pagando uma vez só.', 12, 0, false, 2)
) v(nome, descricao, meses, preco_centavos, ativo, ordem)
where not exists (select 1 from public.planos);

-- 2) Pagamentos: criados e atualizados só pelo servidor (chave de serviço). A pessoa só lê os próprios.
create table if not exists public.pagamentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  plano_id uuid references public.planos(id) on delete set null,
  plano_nome text not null,
  meses int not null check (meses between 1 and 36),
  valor_centavos int not null check (valor_centavos > 0),
  moeda text not null default 'BRL',
  status text not null default 'pendente' check (status in ('pendente', 'em_analise', 'aprovado', 'recusado', 'cancelado', 'estornado')),
  metodo text,
  mp_preference_id text,
  mp_payment_id text unique,
  detalhes jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  aprovado_em timestamptz,
  estornado_em timestamptz,
  atualizado_em timestamptz not null default now()
);
create index if not exists pagamentos_usuario_idx on public.pagamentos (user_id, criado_em desc);
create index if not exists pagamentos_status_idx on public.pagamentos (status, criado_em desc);
create index if not exists pagamentos_propriedade_idx on public.pagamentos (propriedade_id);
alter table public.pagamentos enable row level security;
drop policy if exists pagamentos_ver on public.pagamentos;
create policy pagamentos_ver on public.pagamentos for select to authenticated
  using (user_id = auth.uid() or private.has_role(auth.uid(), 'administrador'));
revoke all on public.pagamentos from anon;
revoke insert, update, delete on public.pagamentos from authenticated;
grant select on public.pagamentos to authenticated;

-- 3) Quem é assinante (fonte única da verdade): a assinatura mais recente de uma propriedade da pessoa
--    (dona, ou quem pagou) está no Premium, ativa e dentro da validade.
create or replace function private.assinante_ativo(_user uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'private'
as $function$
  select _user is not null and exists (
    select 1
    from public.propriedades p
    cross join lateral (
      select a.* from public.assinaturas a where a.propriedade_id = p.id order by a.created_at desc limit 1
    ) a
    where (p.proprietario_id = _user or a.user_id = _user)
      and a.plano = 'premium' and a.status in ('ativo', 'trial')
      and (a.data_expiracao is null or a.data_expiracao > now())
  )
$function$;
revoke all on function private.assinante_ativo(uuid) from public, anon;
grant execute on function private.assinante_ativo(uuid) to authenticated, service_role;

create or replace function public.sou_assinante()
returns boolean
language sql
stable
security definer
set search_path to 'public', 'private'
as $function$ select private.assinante_ativo(auth.uid()) $function$;
revoke all on function public.sou_assinante() from public, anon;
grant execute on function public.sou_assinante() to authenticated;

-- Resumo para a área do assinante: situação, validade e a propriedade da assinatura.
create or replace function public.minha_area_assinante()
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'private'
as $function$
  select jsonb_build_object(
    'assinante', private.assinante_ativo(auth.uid()),
    'assinaturas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'propriedade_id', p.id, 'propriedade', p.nome, 'plano', a.plano, 'status', a.status, 'origem', a.origem,
        'data_expiracao', a.data_expiracao,
        'ativa', a.plano = 'premium' and a.status in ('ativo', 'trial') and (a.data_expiracao is null or a.data_expiracao > now()),
        'dias_restantes', case when a.data_expiracao is null then null else greatest(0, ceil(extract(epoch from (a.data_expiracao - now())) / 86400))::int end
      ) order by p.created_at)
      from public.propriedades p
      cross join lateral (select a.* from public.assinaturas a where a.propriedade_id = p.id order by a.created_at desc limit 1) a
      where p.proprietario_id = auth.uid() or a.user_id = auth.uid()
    ), '[]'::jsonb)
  )
$function$;
revoke all on function public.minha_area_assinante() from public, anon;
grant execute on function public.minha_area_assinante() to authenticated;

-- 4) Liberar e retirar o Premium por pagamento (só o servidor, com a chave de serviço).
--    Idempotente: o mesmo pagamento não soma meses duas vezes.
create or replace function public.mp_ativar_assinatura(_pagamento uuid, _mp_payment_id text, _metodo text, _detalhes jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'private'
as $function$
declare pg public.pagamentos; atual public.assinaturas; base timestamptz; nova timestamptz; sub uuid;
begin
  select * into pg from public.pagamentos where id = _pagamento for update;
  if not found then raise exception 'Pagamento não encontrado.'; end if;
  if pg.status = 'aprovado' then return jsonb_build_object('ok', true, 'repetido', true); end if;
  if pg.status = 'estornado' then return jsonb_build_object('ok', false, 'motivo', 'estornado'); end if;
  select * into atual from public.assinaturas where propriedade_id = pg.propriedade_id order by created_at desc limit 1 for update;
  base := now();
  if found and atual.plano = 'premium' and atual.status in ('ativo', 'trial') and atual.data_expiracao is not null and atual.data_expiracao > now() then
    base := atual.data_expiracao; -- renovação antes de vencer: soma a partir da validade atual
  end if;
  nova := base + make_interval(months => pg.meses);
  update public.pagamentos
     set status = 'aprovado', mp_payment_id = _mp_payment_id, metodo = left(_metodo, 40), detalhes = coalesce(_detalhes, '{}'::jsonb),
         aprovado_em = now(), atualizado_em = now()
   where id = pg.id;
  if atual.id is not null and atual.origem = 'mercadopago' and atual.plano = 'premium' then
    update public.assinaturas set status = 'ativo', data_expiracao = nova, updated_at = now() where id = atual.id;
    sub := atual.id;
  else
    insert into public.assinaturas (user_id, propriedade_id, plano, status, origem, data_inicio, data_expiracao)
    values (pg.user_id, pg.propriedade_id, 'premium', 'ativo', 'mercadopago', now(), nova)
    returning id into sub;
  end if;
  insert into public.plano_auditoria (assinatura_id, user_id, propriedade_id, alterado_por, origem, plano_anterior, plano_novo, status_novo, motivo)
  values (sub, pg.user_id, pg.propriedade_id, pg.user_id, 'mercadopago', atual.plano, 'premium', 'ativo',
          format('Pagamento %s aprovado: +%s mês(es), válido até %s', _mp_payment_id, pg.meses, to_char(nova at time zone 'America/Sao_Paulo', 'DD/MM/YYYY')));
  return jsonb_build_object('ok', true, 'validade', nova);
end $function$;

create or replace function public.mp_estornar(_mp_payment_id text, _motivo text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'private'
as $function$
declare pg public.pagamentos; atual public.assinaturas; nova timestamptz;
begin
  select * into pg from public.pagamentos where mp_payment_id = _mp_payment_id for update;
  if not found then return jsonb_build_object('ok', false, 'motivo', 'desconhecido'); end if;
  if pg.status <> 'aprovado' then return jsonb_build_object('ok', true, 'repetido', true); end if;
  update public.pagamentos set status = 'estornado', estornado_em = now(), atualizado_em = now() where id = pg.id;
  select * into atual from public.assinaturas
   where propriedade_id = pg.propriedade_id and origem = 'mercadopago' order by created_at desc limit 1 for update;
  if found and atual.data_expiracao is not null then
    nova := atual.data_expiracao - make_interval(months => pg.meses);
    update public.assinaturas
       set data_expiracao = nova, status = case when nova <= now() then 'cancelado'::status_assinatura else status end, updated_at = now()
     where id = atual.id;
    insert into public.plano_auditoria (assinatura_id, user_id, propriedade_id, alterado_por, origem, plano_anterior, plano_novo, status_novo, motivo)
    values (atual.id, pg.user_id, pg.propriedade_id, pg.user_id, 'mercadopago', 'premium', 'premium',
            case when nova <= now() then 'cancelado'::status_assinatura else atual.status end,
            format('Pagamento %s %s: -%s mês(es)', _mp_payment_id, coalesce(_motivo, 'estornado'), pg.meses));
  end if;
  return jsonb_build_object('ok', true);
end $function$;

-- Situações intermediárias (Pix aguardando, boleto em análise, recusado) — nunca mexem num pagamento aprovado.
create or replace function public.mp_registrar_status(_pagamento uuid, _status text, _mp_payment_id text, _metodo text, _detalhes jsonb)
returns void
language sql
security definer
set search_path to 'public'
as $function$
  update public.pagamentos
     set status = _status,
         mp_payment_id = coalesce(mp_payment_id, _mp_payment_id),
         metodo = coalesce(left(_metodo, 40), metodo),
         detalhes = coalesce(_detalhes, detalhes),
         atualizado_em = now()
   where id = _pagamento and status not in ('aprovado', 'estornado')
     and _status in ('pendente', 'em_analise', 'recusado', 'cancelado')
$function$;

revoke all on function public.mp_ativar_assinatura(uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.mp_estornar(text, text) from public, anon, authenticated;
revoke all on function public.mp_registrar_status(uuid, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.mp_ativar_assinatura(uuid, text, text, jsonb) to service_role;
grant execute on function public.mp_estornar(text, text) to service_role;
grant execute on function public.mp_registrar_status(uuid, text, text, text, jsonb) to service_role;

-- 5) Biblioteca de eBooks.
create table if not exists public.ebooks (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(titulo) between 2 and 160),
  autor text check (autor is null or char_length(autor) <= 120),
  descricao text check (descricao is null or char_length(descricao) <= 2000),
  categoria text check (categoria is null or char_length(categoria) <= 60),
  paginas int check (paginas is null or paginas between 1 and 5000),
  capa_path text,
  arquivo_path text,
  tamanho_bytes bigint,
  sha256 text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  publicado boolean not null default false,
  publicado_em timestamptz,
  criado_por uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ebooks_publicados_idx on public.ebooks (publicado, publicado_em desc);
alter table public.ebooks enable row level security;
drop policy if exists ebooks_ver on public.ebooks;
create policy ebooks_ver on public.ebooks for select to authenticated
  using (publicado or private.has_role(auth.uid(), 'administrador'));
drop policy if exists ebooks_admin on public.ebooks;
create policy ebooks_admin on public.ebooks for all to authenticated
  using (private.has_role(auth.uid(), 'administrador')) with check (private.has_role(auth.uid(), 'administrador'));
revoke all on public.ebooks from anon;
grant select, insert, update, delete on public.ebooks to authenticated;

-- Cada abertura de eBook (quem, qual, quando, rede aproximada). Só o servidor grava.
create table if not exists public.ebook_acessos (
  id bigint generated always as identity primary key,
  ebook_id uuid not null references public.ebooks(id) on delete cascade,
  user_id uuid not null,
  criado_em timestamptz not null default now(),
  ip_mascarado text
);
create index if not exists ebook_acessos_usuario_idx on public.ebook_acessos (user_id, criado_em desc);
create index if not exists ebook_acessos_ebook_idx on public.ebook_acessos (ebook_id, criado_em desc);
alter table public.ebook_acessos enable row level security;
drop policy if exists ebook_acessos_ver on public.ebook_acessos;
create policy ebook_acessos_ver on public.ebook_acessos for select to authenticated
  using (user_id = auth.uid() or private.has_role(auth.uid(), 'administrador'));
revoke all on public.ebook_acessos from anon;
revoke insert, update, delete on public.ebook_acessos from authenticated;
grant select on public.ebook_acessos to authenticated;

-- Abertura: até 40 por dia por pessoa. Pedidos do mesmo livro em 30 minutos contam como uma abertura
-- (o leitor busca o PDF em pedaços).
create or replace function public.ebook_registrar_acesso(_ebook uuid, _user uuid, _ip text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'private'
as $function$
declare recente boolean; hoje int;
begin
  select exists (select 1 from public.ebook_acessos where ebook_id = _ebook and user_id = _user and criado_em > now() - interval '30 minutes') into recente;
  if recente then return jsonb_build_object('permitido', true, 'nova', false); end if;
  select count(*) into hoje from public.ebook_acessos
   where user_id = _user and criado_em >= (private.hoje_br()::timestamp at time zone 'America/Sao_Paulo');
  if hoje >= 40 then return jsonb_build_object('permitido', false, 'aberturas_hoje', hoje); end if;
  insert into public.ebook_acessos (ebook_id, user_id, ip_mascarado) values (_ebook, _user, left(_ip, 60));
  return jsonb_build_object('permitido', true, 'nova', true, 'aberturas_hoje', hoje + 1);
end $function$;
revoke all on function public.ebook_registrar_acesso(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.ebook_registrar_acesso(uuid, uuid, text) to service_role;

-- Números para o painel do administrador.
create or replace function public.admin_ebooks_resumo()
returns table (ebook_id uuid, aberturas bigint, leitores bigint, ultima timestamptz)
language sql
stable
security definer
set search_path to 'public', 'private'
as $function$
  select e.id, count(a.id), count(distinct a.user_id), max(a.criado_em)
  from public.ebooks e left join public.ebook_acessos a on a.ebook_id = e.id
  where private.has_role(auth.uid(), 'administrador')
  group by e.id
$function$;
revoke all on function public.admin_ebooks_resumo() from public, anon;
grant execute on function public.admin_ebooks_resumo() to authenticated;

create or replace function public.admin_pagamentos(_status text default null, _limite int default 200)
returns table (id uuid, criado_em timestamptz, email text, propriedade text, plano_nome text, meses int, valor_centavos int,
               status text, metodo text, mp_payment_id text, aprovado_em timestamptz)
language sql
stable
security definer
set search_path to 'public', 'private'
as $function$
  select g.id, g.criado_em, u.email::text, p.nome, g.plano_nome, g.meses, g.valor_centavos, g.status, g.metodo, g.mp_payment_id, g.aprovado_em
  from public.pagamentos g
  left join auth.users u on u.id = g.user_id
  left join public.propriedades p on p.id = g.propriedade_id
  where private.has_role(auth.uid(), 'administrador') and (_status is null or g.status = _status)
  order by g.criado_em desc
  limit least(greatest(coalesce(_limite, 200), 1), 1000)
$function$;
revoke all on function public.admin_pagamentos(text, int) from public, anon;
grant execute on function public.admin_pagamentos(text, int) to authenticated;

-- 6) Arquivos: PDFs só para administradores (leitura de assinantes passa pelo servidor);
--    capas: leitura para quem está logado, escrita só administradores.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ebooks', 'ebooks', false, 104857600, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ebook-capas', 'ebook-capas', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "ebooks: admin le" on storage.objects;
create policy "ebooks: admin le" on storage.objects for select to authenticated
  using (bucket_id = 'ebooks' and private.has_role(auth.uid(), 'administrador'));
drop policy if exists "ebooks: admin envia" on storage.objects;
create policy "ebooks: admin envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'ebooks' and private.has_role(auth.uid(), 'administrador'));
drop policy if exists "ebooks: admin troca" on storage.objects;
create policy "ebooks: admin troca" on storage.objects for update to authenticated
  using (bucket_id = 'ebooks' and private.has_role(auth.uid(), 'administrador'))
  with check (bucket_id = 'ebooks' and private.has_role(auth.uid(), 'administrador'));
drop policy if exists "ebooks: admin apaga" on storage.objects;
create policy "ebooks: admin apaga" on storage.objects for delete to authenticated
  using (bucket_id = 'ebooks' and private.has_role(auth.uid(), 'administrador'));

drop policy if exists "capas: logados leem" on storage.objects;
create policy "capas: logados leem" on storage.objects for select to authenticated
  using (bucket_id = 'ebook-capas');
drop policy if exists "capas: admin envia" on storage.objects;
create policy "capas: admin envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'ebook-capas' and private.has_role(auth.uid(), 'administrador'));
drop policy if exists "capas: admin troca" on storage.objects;
create policy "capas: admin troca" on storage.objects for update to authenticated
  using (bucket_id = 'ebook-capas' and private.has_role(auth.uid(), 'administrador'))
  with check (bucket_id = 'ebook-capas' and private.has_role(auth.uid(), 'administrador'));
drop policy if exists "capas: admin apaga" on storage.objects;
create policy "capas: admin apaga" on storage.objects for delete to authenticated
  using (bucket_id = 'ebook-capas' and private.has_role(auth.uid(), 'administrador'));

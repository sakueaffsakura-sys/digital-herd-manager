-- Fase E: indicadores da propriedade e mensagens de suporte do formulário de ajuda.
-- SECURITY INVOKER: valem as regras de acesso (RLS) de cada tabela. Só adições; pode rodar de novo.

-- 1) Indicadores: reprodução, peso, leite e dinheiro, em uma única leitura.
--    Janela de 12 meses (e 24 para o intervalo entre partos), para não pesar em rebanhos grandes.
create or replace function public.indicadores_propriedade(_propriedade_id uuid)
returns jsonb
language sql
stable
set search_path to 'public', 'private'
as $function$
  with d as (
    select private.hoje_br() as hoje,
           (private.hoje_br() - interval '12 months')::date as ano,
           (private.hoje_br() - interval '24 months')::date as dois_anos,
           date_trunc('month', private.hoje_br())::date as mes_ini
  ),
  -- Inseminações do último ano, para prenhez e perda de gestação.
  ins as (
    select i.situacao, count(*) as q
    from public.inseminacoes i, d
    where i.propriedade_id = _propriedade_id and i.data_inseminacao >= d.ano
    group by 1
  ),
  -- Partos (nascimentos) por vaca, para o intervalo entre partos.
  partos as (
    select n.vaca_id, n.data_nascimento,
           lag(n.data_nascimento) over (partition by n.vaca_id order by n.data_nascimento) as anterior
    from public.nascimentos n, d
    where n.propriedade_id = _propriedade_id and n.vaca_id is not null and n.data_nascimento >= d.dois_anos
  ),
  intervalos as (
    select avg(data_nascimento - anterior)::numeric as dias
    from partos where anterior is not null and data_nascimento - anterior between 250 and 900
  ),
  -- Idade ao primeiro parto: primeira cria de cada vaca que tem data de nascimento.
  primeiro_parto as (
    select min(p.data_nascimento) as parto, a.data_nascimento as nasceu
    from public.nascimentos p
    join public.animais a on a.id = p.vaca_id
    where p.propriedade_id = _propriedade_id and a.data_nascimento is not null
    group by a.id, a.data_nascimento
  ),
  idade_primeiro as (
    select avg((parto - nasceu) / 30.4375)::numeric as meses
    from primeiro_parto where parto > nasceu and parto - nasceu between 400 and 2200
  ),
  -- Ganho de peso: entre a primeira e a última pesagem de cada animal no último ano.
  peso as (
    select animal_id,
           min(data) as d1, max(data) as d2,
           min(peso_kg order by data, created_at) as p1,
           max(peso_kg order by data desc, created_at desc) as p2
    from public.pesagens, d
    where propriedade_id = _propriedade_id and data >= d.ano and peso_kg > 0
    group by animal_id
    having count(*) >= 2 and max(data) > min(data)
  ),
  ganho as (
    select avg((p2 - p1) / (d2 - d1))::numeric as kg_dia, count(*) as animais
    from peso where d2 - d1 >= 20
  ),
  ultimo_peso as (
    select avg(peso_kg)::numeric as media
    from (
      select distinct on (animal_id) peso_kg
      from public.pesagens, d
      where propriedade_id = _propriedade_id and data >= d.ano
      order by animal_id, data desc, created_at desc
    ) x
  ),
  -- Leite: litros por dia e vacas que entregaram leite nos últimos 30 dias.
  leite as (
    select coalesce(sum(litros), 0)::numeric as litros_30d,
           count(distinct animal_id) filter (where animal_id is not null) as vacas,
           count(distinct data) as dias,
           coalesce(sum(valor_total), 0)::numeric as valor_30d
    from public.producao_leite, d
    where propriedade_id = _propriedade_id and data > d.hoje - 30 and data <= d.hoje
  ),
  leite_mes as (
    select coalesce(sum(litros), 0)::numeric as litros
    from public.producao_leite, d
    where propriedade_id = _propriedade_id and data >= d.mes_ini and data <= d.hoje
  ),
  dinheiro_mes as (
    select coalesce(sum(valor) filter (where tipo = 'receita'), 0)::numeric as receitas,
           coalesce(sum(valor) filter (where tipo = 'despesa'), 0)::numeric as despesas,
           coalesce(sum(valor) filter (where tipo = 'investimento'), 0)::numeric as investimentos
    from public.movimentacoes_financeiras, d
    where propriedade_id = _propriedade_id and data >= d.mes_ini and data <= d.hoje
  ),
  rebanho as (
    select count(*) as ativos,
           count(*) filter (where sexo = 'F') as femeas,
           count(*) filter (where sexo = 'M') as machos,
           count(*) filter (where data_nascimento >= (select hoje - interval '12 months' from d)::date) as crias_ano,
           count(*) filter (where data_nascimento is not null and data_nascimento < (select hoje - interval '24 months' from d)::date and sexo = 'F') as matrizes
    from public.animais
    where propriedade_id = _propriedade_id and situacao = 'ativo'
  ),
  perdas as (
    select count(*) as q
    from public.animais, d
    where propriedade_id = _propriedade_id and situacao in ('perdido','falecido') and updated_at >= d.ano
  ),
  nascidos as (
    select count(*) as q from public.nascimentos, d
    where propriedade_id = _propriedade_id and data_nascimento >= d.ano
  )
  select jsonb_build_object(
    'hoje', d.hoje,
    'reproducao', jsonb_build_object(
      'inseminacoes_ano', (select coalesce(sum(q), 0) from ins),
      'confirmadas', (select coalesce(sum(q) filter (where situacao in ('confirmada','parto_realizado')), 0) from ins),
      'falhou', (select coalesce(sum(q) filter (where situacao = 'falhou'), 0) from ins),
      'em_andamento', (select coalesce(sum(q) filter (where situacao = 'em_andamento'), 0) from ins),
      'taxa_prenhez', (select case when sum(q) filter (where situacao <> 'em_andamento') > 0
                         then round(100.0 * coalesce(sum(q) filter (where situacao in ('confirmada','parto_realizado')), 0)
                                    / sum(q) filter (where situacao <> 'em_andamento'), 1) end from ins),
      'intervalo_partos_dias', (select round(dias) from intervalos),
      'idade_primeiro_parto_meses', (select round(meses, 1) from idade_primeiro),
      'nascidos_ano', (select q from nascidos),
      'taxa_natalidade', (select case when r.matrizes > 0 then round(100.0 * n.q / r.matrizes, 1) end from rebanho r, nascidos n)
    ),
    'peso', jsonb_build_object(
      'ganho_kg_dia', (select round(kg_dia, 3) from ganho),
      'animais_pesados', (select animais from ganho),
      'peso_medio_kg', (select round(media, 1) from ultimo_peso)
    ),
    'leite', jsonb_build_object(
      'litros_30d', (select round(litros_30d, 1) from leite),
      'litros_dia', (select case when dias > 0 then round(litros_30d / dias, 1) end from leite),
      'vacas_ordenhadas', (select vacas from leite),
      'litros_por_vaca_dia', (select case when vacas > 0 and dias > 0 then round(litros_30d / vacas / dias, 1) end from leite),
      'preco_medio_litro', (select case when litros_30d > 0 and valor_30d > 0 then round(valor_30d / litros_30d, 2) end from leite),
      'litros_mes', (select round(litros, 1) from leite_mes),
      'custo_por_litro', (select case when l.litros > 0 then round(m.despesas / l.litros, 2) end from leite_mes l, dinheiro_mes m)
    ),
    'dinheiro', jsonb_build_object(
      'receitas_mes', (select receitas from dinheiro_mes),
      'despesas_mes', (select despesas from dinheiro_mes),
      'investimentos_mes', (select investimentos from dinheiro_mes),
      'resultado_mes', (select receitas - despesas from dinheiro_mes)
    ),
    'rebanho', jsonb_build_object(
      'ativos', (select ativos from rebanho),
      'femeas', (select femeas from rebanho),
      'machos', (select machos from rebanho),
      'matrizes', (select matrizes from rebanho),
      'crias_ano', (select crias_ano from rebanho),
      'perdas_ano', (select q from perdas),
      'taxa_mortalidade', (select case when r.ativos + p.q > 0 then round(100.0 * p.q / (r.ativos + p.q), 2) end from rebanho r, perdas p)
    )
  )
  from d
  where private.tem_acesso_propriedade(_propriedade_id)
$function$;
revoke all on function public.indicadores_propriedade(uuid) from public, anon;
grant execute on function public.indicadores_propriedade(uuid) to authenticated;

-- 2) Mensagens de suporte do formulário de ajuda (separado das conversas com a Yui).
create table if not exists public.suporte_contatos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  email text,
  assunto text not null check (char_length(assunto) between 2 and 120),
  mensagem text not null check (char_length(mensagem) between 10 and 4000),
  propriedade_id uuid references public.propriedades(id) on delete set null,
  status text not null default 'aberto' check (status in ('aberto','respondido','fechado')),
  resposta text,
  respondido_por uuid,
  respondido_em timestamptz,
  criado_em timestamptz not null default now()
);
create index if not exists suporte_contatos_usuario_idx on public.suporte_contatos (user_id, criado_em desc);
create index if not exists suporte_contatos_status_idx on public.suporte_contatos (status, criado_em desc);
alter table public.suporte_contatos enable row level security;

drop policy if exists suporte_contatos_bloqueio on public.suporte_contatos;
create policy suporte_contatos_bloqueio on public.suporte_contatos as restrictive to authenticated
  using (not private.acesso_negado('ajuda')) with check (not private.acesso_negado('ajuda'));
drop policy if exists suporte_contatos_ver on public.suporte_contatos;
create policy suporte_contatos_ver on public.suporte_contatos for select to authenticated
  using (user_id = auth.uid() or private.has_role(auth.uid(), 'administrador'));
drop policy if exists suporte_contatos_criar on public.suporte_contatos;
create policy suporte_contatos_criar on public.suporte_contatos for insert to authenticated
  with check (user_id = auth.uid() and status = 'aberto' and resposta is null and respondido_por is null);
revoke all on public.suporte_contatos from anon;
grant select, insert on public.suporte_contatos to authenticated;

-- Caixa de mensagens para o administrador (com e-mail de quem escreveu).
create or replace function public.admin_suporte(_status text default null, _limite integer default 200)
returns table (id uuid, criado_em timestamptz, email text, assunto text, mensagem text, propriedade text, status text, resposta text, respondido_em timestamptz)
language plpgsql
stable
security definer
set search_path to 'public', 'private', 'auth'
as $function$
begin
  if not private.has_role(auth.uid(), 'administrador') then raise exception 'Acesso negado' using errcode = '42501'; end if;
  return query
    select s.id, s.criado_em, coalesce(s.email, u.email::text), s.assunto, s.mensagem, p.nome, s.status, s.resposta, s.respondido_em
    from public.suporte_contatos s
    left join auth.users u on u.id = s.user_id
    left join public.propriedades p on p.id = s.propriedade_id
    where _status is null or s.status = _status
    order by s.criado_em desc
    limit greatest(1, least(coalesce(_limite, 200), 500));
end $function$;
revoke all on function public.admin_suporte(text, integer) from public, anon;
grant execute on function public.admin_suporte(text, integer) to authenticated;

-- O administrador responde (a resposta aparece na página Ajuda de quem escreveu).
create or replace function public.admin_responder_suporte(_id uuid, _resposta text, _fechar boolean default false)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'private'
as $function$
begin
  if not private.has_role(auth.uid(), 'administrador') then raise exception 'Acesso negado' using errcode = '42501'; end if;
  if _resposta is null or char_length(btrim(_resposta)) < 2 then raise exception 'Escreva a resposta.'; end if;
  update public.suporte_contatos
     set resposta = left(btrim(_resposta), 4000),
         status = case when _fechar then 'fechado' else 'respondido' end,
         respondido_por = auth.uid(), respondido_em = now()
   where id = _id;
  return found;
end $function$;
revoke all on function public.admin_responder_suporte(uuid, text, boolean) from public, anon;
grant execute on function public.admin_responder_suporte(uuid, text, boolean) to authenticated;

-- A exclusão de conta também leva as mensagens de suporte.
create or replace function public.admin_concluir_exclusao(_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'private'
as $function$
declare _uid uuid; _r jsonb;
begin
  if not private.has_role(auth.uid(), 'administrador') then raise exception 'Acesso negado' using errcode = '42501'; end if;
  select user_id into _uid from public.solicitacoes_exclusao where id = _id and status = 'pendente' for update;
  if _uid is null then raise exception 'Pedido não encontrado ou já atendido.'; end if;
  delete from public.suporte_contatos where user_id = _uid;
  _r := public.admin_excluir_conta(_uid);
  update public.solicitacoes_exclusao set status = 'concluida', concluida_em = now(), atendida_por = auth.uid() where id = _id;
  return _r;
end $function$;

-- Fase A (parte 2) — segurança e banco. Aplicado direto no banco em 31/10/2026.
-- Idempotente e compatível com o site publicado e com o app Android (só acrescenta; nada é renomeado ou apagado,
-- exceto índices repetidos). Registrado aqui para o histórico: o Lovable deve incorporar ao seu controle de migrações.

-- 1. "Hoje" no fuso de Brasília (o banco roda em UTC: sem isto, "hoje" e "este mês" viram às 21h).
create or replace function private.hoje_br() returns date
language sql stable set search_path = pg_catalog
as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;
revoke all on function private.hoje_br() from public, anon;
grant execute on function private.hoje_br() to authenticated, service_role;

-- 2. Manutenção com hora para acabar.
alter table public.manutencao_config add column if not exists termina_em timestamptz;

create or replace function public.estado_manutencao() returns jsonb
language sql stable security definer set search_path = public, private
as $$
  select jsonb_build_object(
    'status', case when c.status <> 'ativo' and c.termina_em is not null and c.termina_em <= now() then 'ativo' else c.status end,
    'titulo', c.titulo,
    'mensagem', c.mensagem,
    'modulos', to_jsonb(c.modulos),
    'atualizado_em', c.atualizado_em,
    'termina_em', case when c.status <> 'ativo' and c.termina_em > now() then c.termina_em end,
    'sou_admin', auth.uid() is not null and private.has_role(auth.uid(), 'administrador'),
    'conta_bloqueada', auth.uid() is not null and (
      exists (select 1 from public.profiles p where p.id = auth.uid() and p.bloqueado)
      or exists (select 1 from public.bloqueios_acesso b
                 where b.ativo and b.tipo = 'usuario' and b.valor = auth.uid()::text and (b.expira_em is null or b.expira_em > now()))))
  from public.manutencao_config c where c.id = 1
$$;

create or replace function private.acesso_negado(_modulo text) returns boolean
language sql stable security definer set search_path = public, private
as $$
  select case when auth.uid() is null then false else
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.bloqueado)
    or exists (select 1 from public.bloqueios_acesso b
               where b.ativo and b.tipo = 'usuario' and b.valor = auth.uid()::text and (b.expira_em is null or b.expira_em > now()))
    or (not private.has_role(auth.uid(), 'administrador') and exists (
          select 1 from public.manutencao_config c
          where c.status <> 'ativo' and (c.termina_em is null or c.termina_em > now())
            and (c.status = 'bloqueado' or 'todos' = any (c.modulos) or _modulo = any (c.modulos))))
  end
$$;

-- Novo parâmetro opcional (_termina_em): recria a função para não existirem duas versões no PostgREST.
drop function if exists public.admin_manutencao_definir(text, text, text, text[], integer, text);
create or replace function public.admin_manutencao_definir(
  _status text, _titulo text, _mensagem text, _modulos text[], _duracao_bloqueio_min integer,
  _dispositivo text default null, _termina_em timestamptz default null)
returns jsonb language plpgsql security definer set search_path = public, private
as $$
declare
  _uid uuid := auth.uid();
  _ant text;
  _fim timestamptz;
  _validos text[] := array['todos','inicio','rebanho','bezerros','vacinacao','inseminacao','nascimentos','lotes','producao','relatorios','financeiro','comercial','diagnostico','perfil','importacao','yui','api'];
  _ip text := private.ip_requisicao();
  _disp text := nullif(left(regexp_replace(coalesce(_dispositivo, ''), '[^a-zA-Z0-9-]', '', 'g'), 80), '');
begin
  if _uid is null or not private.has_role(_uid, 'administrador') then
    perform private.seg_incidente('alterar_manutencao', 'critico', _ip, _disp, _uid, 'admin_manutencao_definir', 'RPC', null,
      'Tentativa de alterar o modo de manutenção sem permissão de administrador.', jsonb_build_object('status_pedido', left(_status, 20)), _uid is not null);
    return jsonb_build_object('ok', false, 'erro', 'Acesso negado.');
  end if;
  if _status not in ('ativo','manutencao','bloqueado') then return jsonb_build_object('ok', false, 'erro', 'Status inválido.'); end if;
  if length(btrim(coalesce(_titulo,''))) not between 3 and 120 then return jsonb_build_object('ok', false, 'erro', 'O título deve ter entre 3 e 120 caracteres.'); end if;
  if length(btrim(coalesce(_mensagem,''))) not between 3 and 1000 then return jsonb_build_object('ok', false, 'erro', 'A mensagem deve ter entre 3 e 1000 caracteres.'); end if;
  if _modulos is null or cardinality(_modulos) = 0 or not (_modulos <@ _validos) then return jsonb_build_object('ok', false, 'erro', 'Escolha ao menos uma área válida para bloquear.'); end if;
  if _duracao_bloqueio_min is null or _duracao_bloqueio_min not between 0 and 1440 then
    return jsonb_build_object('ok', false, 'erro', 'O bloqueio automático vai de 0 a 1440 minutos (24 horas).');
  end if;
  if _status = 'ativo' then
    _fim := null;
  else
    _fim := coalesce(_termina_em, now() + interval '2 hours');
    if _fim < now() + interval '5 minutes' or _fim > now() + interval '72 hours' then
      return jsonb_build_object('ok', false, 'erro', 'A manutenção precisa terminar entre 5 minutos e 72 horas a partir de agora.');
    end if;
  end if;
  select status into _ant from public.manutencao_config where id = 1 for update;
  update public.manutencao_config
     set status = _status, titulo = btrim(_titulo), mensagem = btrim(_mensagem), modulos = _modulos,
         duracao_bloqueio_min = _duracao_bloqueio_min, termina_em = _fim, atualizado_em = now(), atualizado_por = _uid
   where id = 1;
  insert into public.manutencao_historico (user_id, email, status_anterior, status_novo, detalhes, ip)
  values (_uid, (select email from auth.users where id = _uid), _ant, _status,
          jsonb_build_object('titulo', btrim(_titulo), 'modulos', to_jsonb(_modulos), 'duracao_bloqueio_min', _duracao_bloqueio_min, 'termina_em', _fim), _ip);
  return jsonb_build_object('ok', true, 'termina_em', _fim);
end
$$;
revoke all on function public.admin_manutencao_definir(text, text, text, text[], integer, text, timestamptz) from public, anon;
grant execute on function public.admin_manutencao_definir(text, text, text, text[], integer, text, timestamptz) to authenticated, service_role;

-- 3. Bloqueio automático nunca atinge IP (no Brasil muitos produtores dividem o mesmo IP na internet do celular).
create or replace function private.seg_incidente(_tipo text, _severidade text, _ip text, _disp text, _user uuid, _caminho text,
  _metodo text, _agente text, _motivo text, _detalhes jsonb, _bloquear boolean) returns uuid
language plpgsql security definer set search_path = public, private
as $$
declare _id uuid; _dur int; _exp timestamptz; _admin boolean;
begin
  _admin := _user is not null and private.has_role(_user, 'administrador');
  if _admin then _bloquear := false; end if;
  select duracao_bloqueio_min into _dur from public.manutencao_config where id = 1;
  _dur := least(coalesce(_dur, 60), 1440);
  _exp := case when _dur = 0 then null else now() + make_interval(mins => _dur) end;
  insert into public.incidentes_seguranca (tipo, severidade, ip, dispositivo, user_id, caminho, metodo, agente, motivo, detalhes, bloqueou)
  values (left(_tipo,60), left(coalesce(_severidade,'aviso'),20), left(_ip,80), left(_disp,80), _user, left(_caminho,200), left(_metodo,10),
          left(_agente,300), left(_motivo,300), coalesce(_detalhes,'{}'), coalesce(_bloquear,false))
  returning id into _id;
  if coalesce(_bloquear,false) then
    if _disp is not null and _disp <> '' then
      insert into public.bloqueios_acesso (tipo, valor, motivo, incidente_id, expira_em) values ('dispositivo', left(_disp,80), left(_motivo,300), _id, _exp)
      on conflict (tipo, valor) where ativo do update set tentativas = bloqueios_acesso.tentativas + 1, ultima_tentativa = now();
    end if;
    if _user is not null then
      insert into public.bloqueios_acesso (tipo, valor, motivo, incidente_id, expira_em) values ('usuario', _user::text, left(_motivo,300), _id, _exp)
      on conflict (tipo, valor) where ativo do update set tentativas = bloqueios_acesso.tentativas + 1, ultima_tentativa = now();
    end if;
  end if;
  return _id;
end
$$;

-- Bloqueio manual pelo administrador (único jeito de bloquear um IP).
create or replace function public.admin_bloquear(_tipo text, _valor text, _motivo text default null, _minutos integer default null)
returns jsonb language plpgsql security definer set search_path = public, private
as $$
declare _exp timestamptz; _v text := btrim(coalesce(_valor, ''));
begin
  if auth.uid() is null or not private.has_role(auth.uid(), 'administrador') then raise exception 'Acesso negado.' using errcode = '42501'; end if;
  if _tipo not in ('ip','dispositivo','usuario') then return jsonb_build_object('ok', false, 'erro', 'Tipo inválido.'); end if;
  if length(_v) not between 3 and 80 then return jsonb_build_object('ok', false, 'erro', 'Valor inválido.'); end if;
  if _tipo = 'usuario' and _v = auth.uid()::text then return jsonb_build_object('ok', false, 'erro', 'Você não pode bloquear a própria conta.'); end if;
  if _minutos is not null and _minutos not between 1 and 525600 then return jsonb_build_object('ok', false, 'erro', 'Duração inválida.'); end if;
  _exp := case when _minutos is null then null else now() + make_interval(mins => _minutos) end;
  insert into public.bloqueios_acesso (tipo, valor, motivo, expira_em)
  values (_tipo, _v, coalesce(nullif(btrim(coalesce(_motivo, '')), ''), 'Bloqueio manual do administrador'), _exp)
  on conflict (tipo, valor) where ativo do update set motivo = excluded.motivo, expira_em = excluded.expira_em;
  return jsonb_build_object('ok', true);
end
$$;
revoke all on function public.admin_bloquear(text, text, text, integer) from public, anon;
grant execute on function public.admin_bloquear(text, text, text, integer) to authenticated;

-- 4. Cota diária da Yui (dia de Brasília). Só o servidor (service_role) consome; a pessoa só lê a própria.
create table if not exists public.yui_uso (
  user_id uuid not null references auth.users (id) on delete cascade,
  dia date not null,
  mensagens integer not null default 0,
  falas integer not null default 0,
  primary key (user_id, dia)
);
alter table public.yui_uso enable row level security;
drop policy if exists yui_uso_select_own on public.yui_uso;
create policy yui_uso_select_own on public.yui_uso for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.yui_uso from anon, authenticated;

create or replace function public.yui_consumir(_user uuid, _tipo text, _limite integer) returns boolean
language plpgsql security definer set search_path = public, private
as $$
declare _dia date := private.hoje_br(); _n integer;
begin
  if _user is null or _tipo not in ('mensagem','fala') or coalesce(_limite, 0) < 1 then return false; end if;
  insert into public.yui_uso as u (user_id, dia, mensagens, falas)
  values (_user, _dia, (_tipo = 'mensagem')::int, (_tipo = 'fala')::int)
  on conflict (user_id, dia) do update
    set mensagens = u.mensagens + (_tipo = 'mensagem')::int,
        falas = u.falas + (_tipo = 'fala')::int
  returning case when _tipo = 'mensagem' then mensagens else falas end into _n;
  return _n <= _limite;
end
$$;
revoke all on function public.yui_consumir(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.yui_consumir(uuid, text, integer) to service_role;

-- 5. Vacinas: dose "vencida" só se for a última daquela vacina para o mesmo animal (ou lote).
--    status_calculado continua com a regra antiga (só com o dia de Brasília) para o site publicado;
--    as telas novas usam status_atual ('substituida' = já teve reforço) e ultima_dose.
create index if not exists vacinacoes_alvo_animal_dose_idx on public.vacinacoes (propriedade_id, tipo_vacina_id, animal_id, data_aplicacao) where animal_id is not null;
create index if not exists vacinacoes_alvo_lote_dose_idx on public.vacinacoes (propriedade_id, tipo_vacina_id, lote_id, data_aplicacao) where animal_id is null;

create or replace view public.v_vacinacoes_status with (security_invoker = true) as
select v.id, v.propriedade_id, v.animal_id, v.lote_id, v.tipo_vacina_id, v.data_aplicacao, v.proxima_aplicacao,
       v.responsavel, v.observacao, v.created_at, v.updated_at,
       case when v.proxima_aplicacao is null then 'em_dia'
            when v.proxima_aplicacao < private.hoje_br() then 'vencida'
            when v.proxima_aplicacao <= private.hoje_br() + 15 then 'proxima'
            else 'em_dia' end as status_calculado,
       v.proxima_aplicacao - private.hoje_br() as dias_restantes,
       not r.tem_reforco as ultima_dose,
       case when r.tem_reforco then 'substituida'
            when v.proxima_aplicacao is null then 'em_dia'
            when v.proxima_aplicacao < private.hoje_br() then 'vencida'
            when v.proxima_aplicacao <= private.hoje_br() + 15 then 'proxima'
            else 'em_dia' end as status_atual
from public.vacinacoes v
cross join lateral (
  select exists (
    select 1 from public.vacinacoes w
    where w.propriedade_id = v.propriedade_id and w.tipo_vacina_id = v.tipo_vacina_id and w.id <> v.id
      and ((v.animal_id is not null and w.animal_id = v.animal_id)
           or (v.animal_id is null and w.animal_id is null and w.lote_id = v.lote_id))
      and (w.data_aplicacao > v.data_aplicacao
           or (w.data_aplicacao = v.data_aplicacao and (w.created_at, w.id) > (v.created_at, v.id)))
  ) as tem_reforco
) r;

-- 6. Resumo do Início: dia/mês de Brasília e intervalos que usam os índices. Mesmas chaves de antes.
create or replace function public.dashboard_resumo(_propriedade_id uuid) returns jsonb
language sql stable set search_path = public, private
as $$
  with d as (
    select private.hoje_br() as hoje,
           date_trunc('month', private.hoje_br())::date as ini,
           (date_trunc('month', private.hoje_br()) + interval '1 month')::date as fim
  ), t as (
    select (d.ini::timestamp at time zone 'America/Sao_Paulo') as ini_ts,
           (d.fim::timestamp at time zone 'America/Sao_Paulo') as fim_ts
    from d
  )
  select jsonb_build_object(
    'total_animais', (select count(*) from public.animais where propriedade_id = _propriedade_id and situacao = 'ativo'),
    'animais_ativos', (select count(*) from public.animais where propriedade_id = _propriedade_id and situacao = 'ativo'),
    'bezerros', (select count(*) from public.animais where propriedade_id = _propriedade_id and situacao = 'ativo'
                   and data_nascimento >= (d.hoje - interval '12 months')::date),
    'vacinacoes_em_dia', (select count(*) from public.v_vacinacoes_status where propriedade_id = _propriedade_id and status_atual = 'em_dia'),
    'inseminacoes', (select count(*) from public.inseminacoes where propriedade_id = _propriedade_id and situacao in ('em_andamento','confirmada')),
    'nascidos_mes', (select count(*) from public.nascimentos where propriedade_id = _propriedade_id and data_nascimento >= d.ini and data_nascimento < d.fim),
    'perdas_mes', (select count(*) from public.animais where propriedade_id = _propriedade_id and situacao in ('perdido','falecido')
                     and updated_at >= t.ini_ts and updated_at < t.fim_ts),
    'vendas_mes', (select count(*) from public.vendas where propriedade_id = _propriedade_id and data >= d.ini and data < d.fim),
    'compras_mes', (select count(*) from public.compras where propriedade_id = _propriedade_id and data >= d.ini and data < d.fim),
    'receitas_mes', (select coalesce(sum(valor), 0) from public.movimentacoes_financeiras where propriedade_id = _propriedade_id and tipo = 'receita' and data >= d.ini and data < d.fim),
    'despesas_mes', (select coalesce(sum(valor), 0) from public.movimentacoes_financeiras where propriedade_id = _propriedade_id and tipo in ('despesa','investimento') and data >= d.ini and data < d.fim),
    'investimentos_mes', (select coalesce(sum(valor), 0) from public.movimentacoes_financeiras where propriedade_id = _propriedade_id and tipo = 'investimento' and data >= d.ini and data < d.fim),
    'leite_mes', (select coalesce(sum(litros), 0) from public.producao_leite where propriedade_id = _propriedade_id and data >= d.ini and data < d.fim),
    'total_lotes', (select count(*) from public.lotes where propriedade_id = _propriedade_id)
  )
  from d, t
  where private.tem_acesso_propriedade(_propriedade_id)
$$;

create or replace function public.registros_inconsistentes(_propriedade_id uuid) returns jsonb
language plpgsql stable set search_path = public, private
as $$
declare r jsonb := '[]'::jsonb; q bigint; _lim date := private.hoje_br() + 1;
begin
  if not private.tem_acesso_propriedade(_propriedade_id) then return r; end if;
  select count(*) into q from public.nascimentos where propriedade_id = _propriedade_id and vaca_id = bezerro_id;
  if q > 0 then r := r || jsonb_build_object('tabela','nascimentos','checagem','vaca igual ao bezerro','qtd',q,'exemplos','[]'::jsonb); end if;
  select (select count(*) from public.pesagens where propriedade_id = _propriedade_id and data > _lim)
       + (select count(*) from public.producao_leite where propriedade_id = _propriedade_id and data > _lim)
       + (select count(*) from public.movimentacoes_financeiras where propriedade_id = _propriedade_id and data > _lim) into q;
  if q > 0 then r := r || jsonb_build_object('tabela','datas','checagem','registros com data no futuro','qtd',q,'exemplos','[]'::jsonb); end if;
  return r;
end
$$;

-- 7. Índices repetidos (os que ficam fazem o mesmo trabalho; os UNIQUE ficam).
drop index if exists public.compras_data_idx;
drop index if exists public.nascimentos_data_idx;
drop index if exists public.nascimentos_bezerro_idx;
drop index if exists public.pesagens_animal_data_idx;
drop index if exists public.leite_data_idx;
drop index if exists public.leite_propriedade_data_idx;
drop index if exists public.vendas_data_idx;

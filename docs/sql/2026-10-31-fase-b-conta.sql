-- Fase B: segurança da conta (duas etapas valendo no banco, aparelhos conectados) e pedidos de exclusão (LGPD).
-- Só adições e trocas de função com o mesmo resultado para quem não usa duas etapas: o site publicado
-- e o app Android continuam funcionando. Pode rodar de novo sem erro.

-- 1) Duas etapas valendo no banco: quem ativou o código do aplicativo autenticador só vê os dados
--    com uma sessão confirmada pelo código (aal2). Sem duas etapas, nada muda.
create or replace function private.mfa_pendente()
returns boolean
language sql
stable
security definer
set search_path to 'public', 'auth'
as $function$
  select auth.uid() is not null
     and coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2'
     and exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified')
$function$;
revoke all on function private.mfa_pendente() from public, anon;
grant execute on function private.mfa_pendente() to authenticated, service_role;

create or replace function private.acesso_negado(_modulo text)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'private'
as $function$
  select case when auth.uid() is null then false else
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.bloqueado)
    or exists (select 1 from public.bloqueios_acesso b
               where b.ativo and b.tipo = 'usuario' and b.valor = auth.uid()::text and (b.expira_em is null or b.expira_em > now()))
    or private.mfa_pendente()
    or (not private.has_role(auth.uid(), 'administrador') and exists (
          select 1 from public.manutencao_config c
          where c.status <> 'ativo' and (c.termina_em is null or c.termina_em > now())
            and (c.status = 'bloqueado' or 'todos' = any (c.modulos) or _modulo = any (c.modulos))))
  end
$function$;

-- 2) Opção do painel: "Exigir duas etapas para administradores" (começa DESLIGADA).
--    Ligada, um administrador sem a sessão confirmada pelo código perde os poderes de administrador.
insert into public.configuracoes_sistema (chave, valor) values ('exigir_2fa_admin', 'nao')
on conflict (chave) do nothing;

create or replace function private.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
     and not (
       _role = 'administrador'
       and _user_id = auth.uid()
       and coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2'
       and exists (select 1 from public.configuracoes_sistema c where c.chave = 'exigir_2fa_admin' and c.valor = 'sim')
     )
$function$;

-- Ligar/desligar a opção (só administrador; para ligar, quem liga precisa estar com a sessão confirmada pelo código).
create or replace function public.admin_exigir_2fa(_ligar boolean)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'private'
as $function$
begin
  if not private.has_role(auth.uid(), 'administrador') then raise exception 'Acesso negado' using errcode = '42501'; end if;
  if _ligar and coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'Ative e use a verificação em duas etapas na sua conta antes de exigir dos administradores.' using errcode = '42501';
  end if;
  insert into public.configuracoes_sistema (chave, valor, atualizado_por, atualizado_em)
  values ('exigir_2fa_admin', case when _ligar then 'sim' else 'nao' end, auth.uid(), now())
  on conflict (chave) do update set valor = excluded.valor, atualizado_por = excluded.atualizado_por, atualizado_em = now();
  return _ligar;
end $function$;
revoke all on function public.admin_exigir_2fa(boolean) from public, anon;
grant execute on function public.admin_exigir_2fa(boolean) to authenticated;

-- 3) Estado da conta para o site: avisa quando falta o código das duas etapas (chave nova, opcional).
create or replace function public.estado_manutencao()
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'private'
as $function$
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
      or exists (select 1 from public.bloqueios_acesso b where b.ativo and b.tipo = 'usuario' and b.valor = auth.uid()::text and (b.expira_em is null or b.expira_em > now()))),
    'mfa_pendente', private.mfa_pendente())
  from public.manutencao_config c where c.id = 1
$function$;

-- 4) Aparelhos conectados: as sessões abertas da própria conta (navegador, endereço aproximado, último uso).
create or replace function public.minhas_sessoes()
returns table (id uuid, criada_em timestamptz, ultimo_uso timestamptz, navegador text, ip text, aal text, atual boolean)
language sql
stable
security definer
set search_path to 'public', 'auth'
as $function$
  select s.id,
         s.created_at,
         greatest(s.created_at, s.updated_at, (s.refreshed_at at time zone 'UTC')),
         left(coalesce(s.user_agent, ''), 300),
         case when s.ip is null then null
              when family(s.ip) = 4 then regexp_replace(host(s.ip), '\.\d+$', '.x')
              else regexp_replace(host(s.ip), ':[0-9a-f]*$', ':x') end,
         s.aal::text,
         s.id::text = coalesce(auth.jwt() ->> 'session_id', '')
  from auth.sessions s
  where s.user_id = auth.uid() and (s.not_after is null or s.not_after > now())
  order by 3 desc
  limit 50
$function$;
revoke all on function public.minhas_sessoes() from public, anon;
grant execute on function public.minhas_sessoes() to authenticated;

-- Encerrar um aparelho: apaga a sessão (o aparelho perde o acesso quando o token atual vencer, em até 1 hora).
create or replace function public.encerrar_sessao(_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
begin
  if auth.uid() is null then raise exception 'Entre na sua conta.' using errcode = '42501'; end if;
  delete from auth.sessions where id = _id and user_id = auth.uid();
  return found;
end $function$;
revoke all on function public.encerrar_sessao(uuid) from public, anon;
grant execute on function public.encerrar_sessao(uuid) to authenticated;

-- 5) Pedidos de exclusão de conta (LGPD). A pessoa cria e cancela o próprio pedido; o administrador atende.
create table if not exists public.solicitacoes_exclusao (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  email text,
  motivo text check (motivo is null or char_length(motivo) <= 1000),
  status text not null default 'pendente' check (status in ('pendente', 'concluida', 'cancelada')),
  criado_em timestamptz not null default now(),
  prazo date not null default (private.hoje_br() + 15),
  concluida_em timestamptz,
  atendida_por uuid
);
create unique index if not exists solicitacoes_exclusao_pendente_uidx on public.solicitacoes_exclusao (user_id) where status = 'pendente';
create index if not exists solicitacoes_exclusao_status_idx on public.solicitacoes_exclusao (status, criado_em desc);
alter table public.solicitacoes_exclusao enable row level security;

drop policy if exists exclusao_ver on public.solicitacoes_exclusao;
create policy exclusao_ver on public.solicitacoes_exclusao for select to authenticated
  using (user_id = auth.uid() or private.has_role(auth.uid(), 'administrador'));
drop policy if exists exclusao_criar on public.solicitacoes_exclusao;
create policy exclusao_criar on public.solicitacoes_exclusao for insert to authenticated
  with check (user_id = auth.uid() and status = 'pendente' and concluida_em is null and atendida_por is null);
drop policy if exists exclusao_cancelar on public.solicitacoes_exclusao;
create policy exclusao_cancelar on public.solicitacoes_exclusao for delete to authenticated
  using (user_id = auth.uid() and status = 'pendente');
revoke all on public.solicitacoes_exclusao from anon;
grant select, insert, delete on public.solicitacoes_exclusao to authenticated;

-- O administrador conclui: apaga a conta e tudo dela (inclusive conversas com a Yui) e registra a conclusão.
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
  delete from public.suporte_mensagens where user_id = _uid;
  delete from public.yui_uso where user_id = _uid;
  delete from public.presenca_usuarios where user_id = _uid;
  _r := public.admin_excluir_conta(_uid);
  update public.solicitacoes_exclusao set status = 'concluida', concluida_em = now(), atendida_por = auth.uid() where id = _id;
  return _r;
end $function$;
revoke all on function public.admin_concluir_exclusao(uuid) from public, anon;
grant execute on function public.admin_concluir_exclusao(uuid) to authenticated;

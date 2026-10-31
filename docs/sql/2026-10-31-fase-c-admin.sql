-- Fase C (painel do administrador). Idempotente; só acrescenta.
-- Aplicado em 31/10/2026.

-- 1) Quem dos administradores já usa a verificação em duas etapas (para decidir antes de exigir).
create or replace function public.admin_2fa_resumo()
returns table (email text, tem_2fa boolean, eu boolean)
language plpgsql
stable
security definer
set search_path to 'public', 'private', 'auth'
as $function$
begin
  if not private.has_role(auth.uid(), 'administrador') then raise exception 'Acesso negado' using errcode = '42501'; end if;
  return query
    select u.email::text,
           exists (select 1 from auth.mfa_factors f where f.user_id = r.user_id and f.status = 'verified'),
           r.user_id = auth.uid()
    from public.user_roles r
    join auth.users u on u.id = r.user_id
    where r.role = 'administrador'
    order by 3 desc, 1;
end $function$;
revoke all on function public.admin_2fa_resumo() from public, anon;
grant execute on function public.admin_2fa_resumo() to authenticated;

-- 2) Excluir conta: apaga também leituras de eBook, conversas de suporte, presença e uso da Yui,
--    fecha o pedido de exclusão (LGPD) que estiver aberto e não apaga administrador sem antes tirar o papel.
create or replace function public.admin_excluir_conta(_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'private'
as $function$
declare ids uuid[];
begin
  if not private.has_role(auth.uid(),'administrador') then raise exception 'Acesso negado'; end if;
  if _user_id = auth.uid() then raise exception 'Você não pode excluir a própria conta.'; end if;
  if exists (select 1 from public.user_roles where user_id = _user_id and role = 'administrador') then
    raise exception 'Remova o papel de administrador antes de excluir a conta.';
  end if;
  select coalesce(array_agg(id),'{}'::uuid[]) into ids from public.propriedades where proprietario_id=_user_id;
  delete from public.nascimentos where propriedade_id=any(ids);
  delete from public.pesagens where propriedade_id=any(ids);
  delete from public.producao_leite where propriedade_id=any(ids);
  delete from public.vacinacoes where propriedade_id=any(ids);
  delete from public.inseminacoes where propriedade_id=any(ids);
  delete from public.anotacoes_producao where propriedade_id=any(ids);
  update public.animais set mae_id=null where mae_id in (select id from public.animais where propriedade_id=any(ids));
  update public.animais set pai_id=null where pai_id in (select id from public.animais where propriedade_id=any(ids));
  delete from public.animais where propriedade_id=any(ids);
  update public.animais set lote_id=null where lote_id in (select id from public.lotes where propriedade_id=any(ids));
  delete from public.lotes where propriedade_id=any(ids);
  delete from public.tipos_vacinas where propriedade_id=any(ids);
  delete from public.compras where propriedade_id=any(ids);
  delete from public.vendas where propriedade_id=any(ids);
  delete from public.investimentos where propriedade_id=any(ids);
  delete from public.movimentacoes_financeiras where propriedade_id=any(ids);
  delete from public.importacoes where propriedade_id=any(ids);
  delete from public.configuracoes where propriedade_id=any(ids);
  delete from public.notificacoes where user_id=_user_id or propriedade_id=any(ids);
  delete from public.plano_auditoria where propriedade_id=any(ids) or user_id=_user_id;
  delete from public.assinaturas where propriedade_id=any(ids);
  delete from public.propriedade_perfil where propriedade_id=any(ids);
  delete from public.propriedade_membros where propriedade_id=any(ids) or user_id=_user_id;
  delete from public.propriedades where id=any(ids);
  delete from public.ebook_acessos where user_id=_user_id;
  delete from public.suporte_mensagens where user_id=_user_id;
  delete from public.presenca_usuarios where user_id=_user_id;
  delete from public.yui_uso where user_id=_user_id;
  update public.solicitacoes_exclusao set status='concluida', concluida_em=now(), atendida_por=auth.uid()
   where user_id=_user_id and status='pendente';
  delete from public.user_roles where user_id=_user_id;
  delete from public.profiles where id=_user_id;
  delete from auth.users where id=_user_id;
  return jsonb_build_object('ok',true,'propriedades_excluidas',coalesce(array_length(ids,1),0));
end $function$;

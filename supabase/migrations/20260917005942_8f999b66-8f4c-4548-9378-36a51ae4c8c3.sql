create or replace function public.whoami() returns jsonb language sql stable as $$
  select jsonb_build_object('uid', auth.uid(), 'role', auth.role(), 'cur', current_user, 'claims', current_setting('request.jwt.claims', true))
$$;
grant execute on function public.whoami() to authenticated, anon;
CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

ALTER FUNCTION public.excluir_operacao_financeira() SET SCHEMA private;
ALTER FUNCTION public.sincronizar_operacao_financeira() SET SCHEMA private;
ALTER FUNCTION public.has_role(uuid, public.app_role) SET SCHEMA private;
ALTER FUNCTION public.tem_acesso_propriedade(uuid) SET SCHEMA private;
ALTER FUNCTION public.pode_administrar_propriedade(uuid) SET SCHEMA private;

REVOKE ALL ON FUNCTION private.excluir_operacao_financeira() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.sincronizar_operacao_financeira() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.tem_acesso_propriedade(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.pode_administrar_propriedade(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.tem_acesso_propriedade(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.pode_administrar_propriedade(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.excluir_operacao_financeira() TO service_role;
GRANT EXECUTE ON FUNCTION private.sincronizar_operacao_financeira() TO service_role;

DROP POLICY IF EXISTS user_roles_admin_insert ON public.user_roles;
CREATE POLICY user_roles_admin_insert
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (private.has_role(auth.uid(), 'administrador'::public.app_role));

DROP POLICY IF EXISTS user_roles_admin_update ON public.user_roles;
CREATE POLICY user_roles_admin_update
ON public.user_roles
FOR UPDATE
TO authenticated
USING (private.has_role(auth.uid(), 'administrador'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'administrador'::public.app_role));

DROP POLICY IF EXISTS user_roles_admin_delete ON public.user_roles;
CREATE POLICY user_roles_admin_delete
ON public.user_roles
FOR DELETE
TO authenticated
USING (private.has_role(auth.uid(), 'administrador'::public.app_role));
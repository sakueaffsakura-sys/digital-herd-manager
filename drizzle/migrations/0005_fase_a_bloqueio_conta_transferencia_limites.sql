DROP POLICY IF EXISTS profiles_own_delete ON public.profiles;
CREATE OR REPLACE FUNCTION public.admin_definir_conta(_user_id uuid, _bloqueado boolean DEFAULT NULL, _admin boolean DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private AS $$
BEGIN
 IF NOT private.has_role(auth.uid(),'administrador') THEN RAISE EXCEPTION 'Acesso negado'; END IF;
 IF _user_id=auth.uid() AND (_bloqueado IS TRUE OR _admin IS FALSE) THEN RAISE EXCEPTION 'Você não pode bloquear ou rebaixar a própria conta.'; END IF;
 IF _bloqueado IS NOT NULL THEN
 UPDATE public.profiles SET bloqueado=_bloqueado WHERE id=_user_id;
 IF _bloqueado THEN
 INSERT INTO public.bloqueios_acesso(tipo,valor,motivo,ativo,expira_em) VALUES ('usuario',_user_id::text,'Conta bloqueada pelo administrador',true,NULL)
 ON CONFLICT(tipo,valor) WHERE ativo DO UPDATE SET motivo=EXCLUDED.motivo,expira_em=NULL,removido_em=NULL,removido_por=NULL;
 ELSE
 UPDATE public.bloqueios_acesso SET ativo=false,removido_em=now(),removido_por=auth.uid() WHERE tipo='usuario' AND valor=_user_id::text AND ativo;
 END IF;
 END IF;
 IF _admin IS TRUE THEN INSERT INTO public.user_roles(user_id,role) VALUES(_user_id,'administrador') ON CONFLICT DO NOTHING; END IF;
 IF _admin IS FALSE THEN DELETE FROM public.user_roles WHERE user_id=_user_id AND role='administrador'; END IF;
END $$;
CREATE OR REPLACE FUNCTION private.acesso_negado(_modulo text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,private AS $$
SELECT CASE WHEN auth.uid() IS NULL THEN false ELSE
 EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.bloqueado)
 OR EXISTS(SELECT 1 FROM public.bloqueios_acesso b WHERE b.ativo AND b.tipo='usuario' AND b.valor=auth.uid()::text AND (b.expira_em IS NULL OR b.expira_em>now()))
 OR (NOT private.has_role(auth.uid(),'administrador') AND EXISTS(SELECT 1 FROM public.manutencao_config c WHERE c.status<>'ativo' AND (c.status='bloqueado' OR 'todos'=ANY(c.modulos) OR _modulo=ANY(c.modulos)))) END $$;
CREATE OR REPLACE FUNCTION private.proteger_transferencia_propriedade() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private AS $$
BEGIN
 IF NEW.proprietario_id IS DISTINCT FROM OLD.proprietario_id AND NOT (coalesce(auth.role(),'')='service_role' OR auth.uid()=OLD.proprietario_id OR private.has_role(auth.uid(),'administrador')) THEN
 RAISE EXCEPTION 'Só o dono pode transferir a propriedade.' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.proteger_transferencia_propriedade() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER proteger_transferencia_propriedade BEFORE UPDATE ON public.propriedades FOR EACH ROW EXECUTE FUNCTION private.proteger_transferencia_propriedade();
ALTER TABLE public.rate_limits ADD COLUMN IF NOT EXISTS termina_em timestamptz DEFAULT (now()+interval '24 hours');
UPDATE public.rate_limits SET termina_em=greatest(termina_em,janela+interval '24 hours');
CREATE OR REPLACE FUNCTION public.checar_limite(_chave text,_max integer,_segundos integer) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE w timestamptz; c integer;
BEGIN
 IF _segundos<1 OR _max<1 OR length(coalesce(_chave,''))=0 THEN RETURN false; END IF;
 w:=to_timestamp(floor(extract(epoch FROM now())/_segundos)*_segundos);
 INSERT INTO public.rate_limits(chave,janela,contador,termina_em) VALUES(left(_chave,200),w,1,w+make_interval(secs=>_segundos))
 ON CONFLICT(chave,janela) DO UPDATE SET contador=rate_limits.contador+1,termina_em=greatest(rate_limits.termina_em,EXCLUDED.termina_em) RETURNING contador INTO c;
 IF random()<0.01 THEN DELETE FROM public.rate_limits WHERE termina_em<=now(); END IF;
 RETURN c<=_max;
END $$;
REVOKE ALL ON FUNCTION public.checar_limite(text,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.checar_limite(text,integer,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.app_diagnostico(uuid) TO authenticated;
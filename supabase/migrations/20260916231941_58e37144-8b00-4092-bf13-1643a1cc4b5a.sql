CREATE TYPE public.app_role AS ENUM ('proprietario','administrador','colaborador','visualizador');
CREATE TYPE public.sexo_animal AS ENUM ('M','F');
CREATE TYPE public.situacao_animal AS ENUM ('ativo','vendido','perdido','falecido','transferido');
CREATE TYPE public.status_inseminacao AS ENUM ('em_andamento','confirmada','falhou','parto_realizado','cancelada');
CREATE TYPE public.tipo_movimento AS ENUM ('receita','despesa','investimento');
CREATE TYPE public.tipo_operacao AS ENUM ('compra','venda');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  nome_completo text NOT NULL DEFAULT '',
  telefone text,
  avatar_url text,
  preferencias jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_own_select ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY profiles_own_insert ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY profiles_own_update ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY profiles_own_delete ON public.profiles FOR DELETE TO authenticated USING (id = auth.uid());

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_roles_own_select ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

CREATE TABLE public.propriedades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proprietario_id uuid NOT NULL,
  nome text NOT NULL CHECK (char_length(nome) BETWEEN 2 AND 120),
  cidade text,
  estado text,
  periodo_gestacao_dias integer NOT NULL DEFAULT 283 CHECK (periodo_gestacao_dias BETWEEN 260 AND 300),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.propriedades TO authenticated;
GRANT ALL ON public.propriedades TO service_role;
ALTER TABLE public.propriedades ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.propriedade_membros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  propriedade_id uuid NOT NULL REFERENCES public.propriedades(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.app_role NOT NULL DEFAULT 'colaborador',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(propriedade_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.propriedade_membros TO authenticated;
GRANT ALL ON public.propriedade_membros TO service_role;
ALTER TABLE public.propriedade_membros ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.tem_acesso_propriedade(_propriedade_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.propriedades p WHERE p.id = _propriedade_id AND p.proprietario_id = auth.uid()
    UNION ALL
    SELECT 1 FROM public.propriedade_membros m WHERE m.propriedade_id = _propriedade_id AND m.user_id = auth.uid()
  )
$$;
CREATE OR REPLACE FUNCTION public.pode_administrar_propriedade(_propriedade_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.propriedades p WHERE p.id = _propriedade_id AND p.proprietario_id = auth.uid()
    UNION ALL
    SELECT 1 FROM public.propriedade_membros m WHERE m.propriedade_id = _propriedade_id AND m.user_id = auth.uid() AND m.role IN ('proprietario','administrador')
  )
$$;
GRANT EXECUTE ON FUNCTION public.tem_acesso_propriedade(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pode_administrar_propriedade(uuid) TO authenticated;
CREATE POLICY propriedades_select ON public.propriedades FOR SELECT TO authenticated USING (public.tem_acesso_propriedade(id));
CREATE POLICY propriedades_insert ON public.propriedades FOR INSERT TO authenticated WITH CHECK (proprietario_id = auth.uid());
CREATE POLICY propriedades_update ON public.propriedades FOR UPDATE TO authenticated USING (public.pode_administrar_propriedade(id)) WITH CHECK (public.pode_administrar_propriedade(id));
CREATE POLICY propriedades_delete ON public.propriedades FOR DELETE TO authenticated USING (proprietario_id = auth.uid());
CREATE POLICY membros_select ON public.propriedade_membros FOR SELECT TO authenticated USING (public.tem_acesso_propriedade(propriedade_id));
CREATE POLICY membros_insert ON public.propriedade_membros FOR INSERT TO authenticated WITH CHECK (public.pode_administrar_propriedade(propriedade_id));
CREATE POLICY membros_update ON public.propriedade_membros FOR UPDATE TO authenticated USING (public.pode_administrar_propriedade(propriedade_id)) WITH CHECK (public.pode_administrar_propriedade(propriedade_id));
CREATE POLICY membros_delete ON public.propriedade_membros FOR DELETE TO authenticated USING (public.pode_administrar_propriedade(propriedade_id));

CREATE TABLE public.lotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), propriedade_id uuid NOT NULL REFERENCES public.propriedades(id) ON DELETE CASCADE,
  nome text NOT NULL, descricao text, finalidade text, ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(propriedade_id,nome)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lotes TO authenticated; GRANT ALL ON public.lotes TO service_role; ALTER TABLE public.lotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY lotes_all ON public.lotes FOR ALL TO authenticated USING (public.tem_acesso_propriedade(propriedade_id)) WITH CHECK (public.tem_acesso_propriedade(propriedade_id));

CREATE TABLE public.animais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), propriedade_id uuid NOT NULL REFERENCES public.propriedades(id) ON DELETE CASCADE,
  lote_id uuid REFERENCES public.lotes(id) ON DELETE SET NULL, numero_brinco text NOT NULL, nome text, sexo public.sexo_animal NOT NULL,
  raca text, data_nascimento date, mae_id uuid REFERENCES public.animais(id) ON DELETE SET NULL, pai_id uuid REFERENCES public.animais(id) ON DELETE SET NULL,
  situacao public.situacao_animal NOT NULL DEFAULT 'ativo', observacoes text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(propriedade_id,numero_brinco), CHECK (mae_id IS NULL OR mae_id <> id), CHECK (pai_id IS NULL OR pai_id <> id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.animais TO authenticated; GRANT ALL ON public.animais TO service_role; ALTER TABLE public.animais ENABLE ROW LEVEL SECURITY;
CREATE POLICY animais_all ON public.animais FOR ALL TO authenticated USING (public.tem_acesso_propriedade(propriedade_id)) WITH CHECK (public.tem_acesso_propriedade(propriedade_id));

CREATE TABLE public.pesagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), propriedade_id uuid NOT NULL REFERENCES public.propriedades(id) ON DELETE CASCADE,
  animal_id uuid NOT NULL REFERENCES public.animais(id) ON DELETE CASCADE, data date NOT NULL, peso_kg numeric(10,2) NOT NULL CHECK (peso_kg > 0), observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(animal_id,data)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pesagens TO authenticated; GRANT ALL ON public.pesagens TO service_role; ALTER TABLE public.pesagens ENABLE ROW LEVEL SECURITY;
CREATE POLICY pesagens_all ON public.pesagens FOR ALL TO authenticated USING (public.tem_acesso_propriedade(propriedade_id)) WITH CHECK (public.tem_acesso_propriedade(propriedade_id));

CREATE TABLE public.nascimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), propriedade_id uuid NOT NULL REFERENCES public.propriedades(id) ON DELETE CASCADE,
  vaca_id uuid NOT NULL REFERENCES public.animais(id) ON DELETE RESTRICT, bezerro_id uuid NOT NULL REFERENCES public.animais(id) ON DELETE RESTRICT,
  data_nascimento date NOT NULL, sexo public.sexo_animal NOT NULL, lote_id uuid REFERENCES public.lotes(id) ON DELETE SET NULL, observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(bezerro_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nascimentos TO authenticated; GRANT ALL ON public.nascimentos TO service_role; ALTER TABLE public.nascimentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY nascimentos_all ON public.nascimentos FOR ALL TO authenticated USING (public.tem_acesso_propriedade(propriedade_id)) WITH CHECK (public.tem_acesso_propriedade(propriedade_id));

CREATE TABLE public.tipos_vacinas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), propriedade_id uuid NOT NULL REFERENCES public.propriedades(id) ON DELETE CASCADE,
  nome text NOT NULL, intervalo_dias integer CHECK (intervalo_dias > 0), descricao text, ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(propriedade_id,nome)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tipos_vacinas TO authenticated; GRANT ALL ON public.tipos_vacinas TO service_role; ALTER TABLE public.tipos_vacinas ENABLE ROW LEVEL SECURITY;
CREATE POLICY tipos_vacinas_all ON public.tipos_vacinas FOR ALL TO authenticated USING (public.tem_acesso_propriedade(propriedade_id)) WITH CHECK (public.tem_acesso_propriedade(propriedade_id));

CREATE TABLE public.vacinacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), propriedade_id uuid NOT NULL REFERENCES public.propriedades(id) ON DELETE CASCADE,
  animal_id uuid REFERENCES public.animais(id) ON DELETE CASCADE, lote_id uuid REFERENCES public.lotes(id) ON DELETE CASCADE,
  tipo_vacina_id uuid NOT NULL REFERENCES public.tipos_vacinas(id) ON DELETE RESTRICT, data_aplicacao date NOT NULL, proxima_aplicacao date,
  responsavel text, observacao text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((animal_id IS NOT NULL)::int + (lote_id IS NOT NULL)::int = 1), CHECK (proxima_aplicacao IS NULL OR proxima_aplicacao >= data_aplicacao)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vacinacoes TO authenticated; GRANT ALL ON public.vacinacoes TO service_role; ALTER TABLE public.vacinacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY vacinacoes_all ON public.vacinacoes FOR ALL TO authenticated USING (public.tem_acesso_propriedade(propriedade_id)) WITH CHECK (public.tem_acesso_propriedade(propriedade_id));

CREATE TABLE public.inseminacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), propriedade_id uuid NOT NULL REFERENCES public.propriedades(id) ON DELETE CASCADE,
  animal_id uuid NOT NULL REFERENCES public.animais(id) ON DELETE CASCADE, data_inseminacao date NOT NULL, reprodutor_semen text NOT NULL,
  previsao_parto date NOT NULL, situacao public.status_inseminacao NOT NULL DEFAULT 'em_andamento', observacao text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), CHECK (previsao_parto > data_inseminacao)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inseminacoes TO authenticated; GRANT ALL ON public.inseminacoes TO service_role; ALTER TABLE public.inseminacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY inseminacoes_all ON public.inseminacoes FOR ALL TO authenticated USING (public.tem_acesso_propriedade(propriedade_id)) WITH CHECK (public.tem_acesso_propriedade(propriedade_id));

CREATE TABLE public.producao_leite (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), propriedade_id uuid NOT NULL REFERENCES public.propriedades(id) ON DELETE CASCADE,
  animal_id uuid NOT NULL REFERENCES public.animais(id) ON DELETE CASCADE, lote_id uuid REFERENCES public.lotes(id) ON DELETE SET NULL,
  data date NOT NULL, litros numeric(10,2) NOT NULL CHECK (litros >= 0), valor_litro numeric(10,2) NOT NULL DEFAULT 0 CHECK (valor_litro >= 0),
  valor_total numeric(12,2) GENERATED ALWAYS AS (litros * valor_litro) STORED, observacao text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.producao_leite TO authenticated; GRANT ALL ON public.producao_leite TO service_role; ALTER TABLE public.producao_leite ENABLE ROW LEVEL SECURITY;
CREATE POLICY producao_leite_all ON public.producao_leite FOR ALL TO authenticated USING (public.tem_acesso_propriedade(propriedade_id)) WITH CHECK (public.tem_acesso_propriedade(propriedade_id));

CREATE TABLE public.anotacoes_producao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), propriedade_id uuid NOT NULL REFERENCES public.propriedades(id) ON DELETE CASCADE,
  animal_id uuid REFERENCES public.animais(id) ON DELETE SET NULL, lote_id uuid REFERENCES public.lotes(id) ON DELETE SET NULL,
  data date NOT NULL DEFAULT current_date, producao numeric(10,2) CHECK (producao >= 0), observacao text NOT NULL, comportamento text, alimentacao text, informacoes_adicionais text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.anotacoes_producao TO authenticated; GRANT ALL ON public.anotacoes_producao TO service_role; ALTER TABLE public.anotacoes_producao ENABLE ROW LEVEL SECURITY;
CREATE POLICY anotacoes_all ON public.anotacoes_producao FOR ALL TO authenticated USING (public.tem_acesso_propriedade(propriedade_id)) WITH CHECK (public.tem_acesso_propriedade(propriedade_id));

CREATE TABLE public.movimentacoes_financeiras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), propriedade_id uuid NOT NULL REFERENCES public.propriedades(id) ON DELETE CASCADE,
  tipo public.tipo_movimento NOT NULL, categoria text NOT NULL, descricao text NOT NULL, valor numeric(14,2) NOT NULL CHECK (valor >= 0), data date NOT NULL,
  origem_tipo public.tipo_operacao, origem_id uuid, observacao text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.movimentacoes_financeiras TO authenticated; GRANT ALL ON public.movimentacoes_financeiras TO service_role; ALTER TABLE public.movimentacoes_financeiras ENABLE ROW LEVEL SECURITY;
CREATE POLICY financeiro_all ON public.movimentacoes_financeiras FOR ALL TO authenticated USING (public.tem_acesso_propriedade(propriedade_id)) WITH CHECK (public.tem_acesso_propriedade(propriedade_id));

CREATE TABLE public.investimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), propriedade_id uuid NOT NULL REFERENCES public.propriedades(id) ON DELETE CASCADE,
  movimentacao_id uuid UNIQUE REFERENCES public.movimentacoes_financeiras(id) ON DELETE CASCADE, descricao text NOT NULL, categoria text NOT NULL,
  valor numeric(14,2) NOT NULL CHECK (valor >= 0), data date NOT NULL, observacao text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.investimentos TO authenticated; GRANT ALL ON public.investimentos TO service_role; ALTER TABLE public.investimentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY investimentos_all ON public.investimentos FOR ALL TO authenticated USING (public.tem_acesso_propriedade(propriedade_id)) WITH CHECK (public.tem_acesso_propriedade(propriedade_id));

CREATE TABLE public.compras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), propriedade_id uuid NOT NULL REFERENCES public.propriedades(id) ON DELETE CASCADE,
  data date NOT NULL, produto_animal text NOT NULL, quantidade numeric(12,2) NOT NULL CHECK (quantidade > 0), valor numeric(14,2) NOT NULL CHECK (valor >= 0),
  fornecedor text, categoria text NOT NULL, observacao text, movimentacao_id uuid UNIQUE REFERENCES public.movimentacoes_financeiras(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compras TO authenticated; GRANT ALL ON public.compras TO service_role; ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;
CREATE POLICY compras_all ON public.compras FOR ALL TO authenticated USING (public.tem_acesso_propriedade(propriedade_id)) WITH CHECK (public.tem_acesso_propriedade(propriedade_id));

CREATE TABLE public.vendas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), propriedade_id uuid NOT NULL REFERENCES public.propriedades(id) ON DELETE CASCADE,
  data date NOT NULL, animal_id uuid REFERENCES public.animais(id) ON DELETE SET NULL, item text NOT NULL, quantidade numeric(12,2) NOT NULL CHECK (quantidade > 0),
  valor numeric(14,2) NOT NULL CHECK (valor >= 0), comprador text, categoria text NOT NULL, observacao text,
  movimentacao_id uuid UNIQUE REFERENCES public.movimentacoes_financeiras(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendas TO authenticated; GRANT ALL ON public.vendas TO service_role; ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;
CREATE POLICY vendas_all ON public.vendas FOR ALL TO authenticated USING (public.tem_acesso_propriedade(propriedade_id)) WITH CHECK (public.tem_acesso_propriedade(propriedade_id));

CREATE TABLE public.configuracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), propriedade_id uuid NOT NULL REFERENCES public.propriedades(id) ON DELETE CASCADE,
  chave text NOT NULL, valor jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(propriedade_id,chave)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.configuracoes TO authenticated; GRANT ALL ON public.configuracoes TO service_role; ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY configuracoes_all ON public.configuracoes FOR ALL TO authenticated USING (public.tem_acesso_propriedade(propriedade_id)) WITH CHECK (public.pode_administrar_propriedade(propriedade_id));

CREATE TABLE public.notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, propriedade_id uuid REFERENCES public.propriedades(id) ON DELETE CASCADE,
  titulo text NOT NULL, mensagem text NOT NULL, lida boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notificacoes TO authenticated; GRANT ALL ON public.notificacoes TO service_role; ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY notificacoes_own ON public.notificacoes FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['profiles','propriedades','lotes','animais','pesagens','nascimentos','tipos_vacinas','vacinacoes','inseminacoes','producao_leite','anotacoes_producao','movimentacoes_financeiras','investimentos','compras','vendas','configuracoes'] LOOP EXECUTE format('CREATE TRIGGER set_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t, t); END LOOP; END $$;

CREATE OR REPLACE FUNCTION public.preencher_previsao_parto() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE dias integer; BEGIN IF NEW.previsao_parto IS NULL THEN SELECT periodo_gestacao_dias INTO dias FROM public.propriedades WHERE id = NEW.propriedade_id; NEW.previsao_parto := NEW.data_inseminacao + COALESCE(dias,283); END IF; RETURN NEW; END $$;
CREATE TRIGGER calcular_previsao_parto BEFORE INSERT OR UPDATE OF data_inseminacao, propriedade_id ON public.inseminacoes FOR EACH ROW EXECUTE FUNCTION public.preencher_previsao_parto();

CREATE OR REPLACE FUNCTION public.sincronizar_operacao_financeira() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE mov_id uuid; mov_tipo public.tipo_movimento; desc_text text; BEGIN
  mov_tipo := CASE WHEN TG_TABLE_NAME = 'vendas' THEN 'receita'::public.tipo_movimento ELSE 'despesa'::public.tipo_movimento END;
  desc_text := CASE WHEN TG_TABLE_NAME = 'vendas' THEN 'Venda: ' || NEW.item ELSE 'Compra: ' || NEW.produto_animal END;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.movimentacoes_financeiras(propriedade_id,tipo,categoria,descricao,valor,data,origem_tipo,origem_id,observacao)
    VALUES(NEW.propriedade_id,mov_tipo,NEW.categoria,desc_text,NEW.valor,NEW.data,CASE WHEN TG_TABLE_NAME='vendas' THEN 'venda'::public.tipo_operacao ELSE 'compra'::public.tipo_operacao END,NEW.id,NEW.observacao) RETURNING id INTO mov_id;
    NEW.movimentacao_id := mov_id;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.movimentacoes_financeiras SET categoria=NEW.categoria,descricao=desc_text,valor=NEW.valor,data=NEW.data,observacao=NEW.observacao WHERE id=OLD.movimentacao_id;
    NEW.movimentacao_id := OLD.movimentacao_id;
  END IF; RETURN NEW;
END $$;
CREATE TRIGGER sync_compra_financeiro BEFORE INSERT OR UPDATE ON public.compras FOR EACH ROW EXECUTE FUNCTION public.sincronizar_operacao_financeira();
CREATE TRIGGER sync_venda_financeiro BEFORE INSERT OR UPDATE ON public.vendas FOR EACH ROW EXECUTE FUNCTION public.sincronizar_operacao_financeira();
CREATE OR REPLACE FUNCTION public.excluir_operacao_financeira() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN DELETE FROM public.movimentacoes_financeiras WHERE id=OLD.movimentacao_id; RETURN OLD; END $$;
CREATE TRIGGER delete_compra_financeiro AFTER DELETE ON public.compras FOR EACH ROW EXECUTE FUNCTION public.excluir_operacao_financeira();
CREATE TRIGGER delete_venda_financeiro AFTER DELETE ON public.vendas FOR EACH ROW EXECUTE FUNCTION public.excluir_operacao_financeira();

CREATE INDEX lotes_propriedade_idx ON public.lotes(propriedade_id);
CREATE INDEX animais_propriedade_situacao_idx ON public.animais(propriedade_id,situacao);
CREATE INDEX animais_lote_idx ON public.animais(lote_id);
CREATE INDEX animais_busca_idx ON public.animais(propriedade_id,numero_brinco,nome);
CREATE INDEX pesagens_animal_data_idx ON public.pesagens(animal_id,data DESC);
CREATE INDEX nascimentos_data_idx ON public.nascimentos(propriedade_id,data_nascimento DESC);
CREATE INDEX vacinacoes_proxima_idx ON public.vacinacoes(propriedade_id,proxima_aplicacao);
CREATE INDEX inseminacoes_previsao_idx ON public.inseminacoes(propriedade_id,previsao_parto);
CREATE INDEX leite_data_idx ON public.producao_leite(propriedade_id,data DESC);
CREATE INDEX leite_animal_idx ON public.producao_leite(animal_id,data DESC);
CREATE INDEX financeiro_data_tipo_idx ON public.movimentacoes_financeiras(propriedade_id,data DESC,tipo);
CREATE INDEX compras_data_idx ON public.compras(propriedade_id,data DESC);
CREATE INDEX vendas_data_idx ON public.vendas(propriedade_id,data DESC);

CREATE VIEW public.v_animais_por_lote WITH (security_invoker=true) AS
SELECT l.propriedade_id,l.id AS lote_id,l.nome,COUNT(a.id) FILTER (WHERE a.situacao='ativo')::integer AS quantidade
FROM public.lotes l LEFT JOIN public.animais a ON a.lote_id=l.id GROUP BY l.propriedade_id,l.id,l.nome;
GRANT SELECT ON public.v_animais_por_lote TO authenticated; GRANT ALL ON public.v_animais_por_lote TO service_role;

CREATE VIEW public.v_financeiro_mensal WITH (security_invoker=true) AS
SELECT propriedade_id,date_trunc('month',data)::date AS mes,
COALESCE(SUM(valor) FILTER (WHERE tipo='receita'),0) AS receitas,
COALESCE(SUM(valor) FILTER (WHERE tipo='despesa'),0) AS despesas,
COALESCE(SUM(valor) FILTER (WHERE tipo='investimento'),0) AS investimentos,
COALESCE(SUM(valor) FILTER (WHERE tipo='receita'),0)-COALESCE(SUM(valor) FILTER (WHERE tipo IN ('despesa','investimento')),0) AS lucro
FROM public.movimentacoes_financeiras GROUP BY propriedade_id,date_trunc('month',data);
GRANT SELECT ON public.v_financeiro_mensal TO authenticated; GRANT ALL ON public.v_financeiro_mensal TO service_role;

CREATE VIEW public.v_producao_mensal WITH (security_invoker=true) AS
SELECT propriedade_id,date_trunc('month',data)::date AS mes,SUM(litros) AS total_litros,AVG(litros) AS media_registro,SUM(valor_total) AS valor_total
FROM public.producao_leite GROUP BY propriedade_id,date_trunc('month',data);
GRANT SELECT ON public.v_producao_mensal TO authenticated; GRANT ALL ON public.v_producao_mensal TO service_role;

CREATE VIEW public.v_vacinacoes_status WITH (security_invoker=true) AS
SELECT v.*,CASE WHEN v.proxima_aplicacao IS NULL THEN 'em_dia' WHEN v.proxima_aplicacao < current_date THEN 'vencida' WHEN v.proxima_aplicacao <= current_date + 15 THEN 'proxima' ELSE 'em_dia' END AS status_calculado,
(v.proxima_aplicacao-current_date) AS dias_restantes FROM public.vacinacoes v;
GRANT SELECT ON public.v_vacinacoes_status TO authenticated; GRANT ALL ON public.v_vacinacoes_status TO service_role;

CREATE OR REPLACE FUNCTION public.dashboard_resumo(_propriedade_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
SELECT jsonb_build_object(
 'total_animais',(SELECT COUNT(*) FROM public.animais WHERE propriedade_id=_propriedade_id AND situacao='ativo'),
 'bezerros',(SELECT COUNT(*) FROM public.animais WHERE propriedade_id=_propriedade_id AND situacao='ativo' AND data_nascimento >= current_date - interval '12 months'),
 'vacinacoes_em_dia',(SELECT COUNT(*) FROM public.v_vacinacoes_status WHERE propriedade_id=_propriedade_id AND status_calculado='em_dia'),
 'inseminacoes',(SELECT COUNT(*) FROM public.inseminacoes WHERE propriedade_id=_propriedade_id AND situacao IN ('em_andamento','confirmada')),
 'nascidos_mes',(SELECT COUNT(*) FROM public.nascimentos WHERE propriedade_id=_propriedade_id AND date_trunc('month',data_nascimento)=date_trunc('month',current_date)),
 'perdas_mes',(SELECT COUNT(*) FROM public.animais WHERE propriedade_id=_propriedade_id AND situacao IN ('perdido','falecido') AND date_trunc('month',updated_at)=date_trunc('month',current_date)),
 'vendas_mes',(SELECT COUNT(*) FROM public.vendas WHERE propriedade_id=_propriedade_id AND date_trunc('month',data)=date_trunc('month',current_date)),
 'compras_mes',(SELECT COUNT(*) FROM public.compras WHERE propriedade_id=_propriedade_id AND date_trunc('month',data)=date_trunc('month',current_date)),
 'receitas_mes',(SELECT COALESCE(SUM(valor),0) FROM public.movimentacoes_financeiras WHERE propriedade_id=_propriedade_id AND tipo='receita' AND date_trunc('month',data)=date_trunc('month',current_date)),
 'despesas_mes',(SELECT COALESCE(SUM(valor),0) FROM public.movimentacoes_financeiras WHERE propriedade_id=_propriedade_id AND tipo IN ('despesa','investimento') AND date_trunc('month',data)=date_trunc('month',current_date)),
 'leite_mes',(SELECT COALESCE(SUM(litros),0) FROM public.producao_leite WHERE propriedade_id=_propriedade_id AND date_trunc('month',data)=date_trunc('month',current_date))
) WHERE public.tem_acesso_propriedade(_propriedade_id)
$$;
GRANT EXECUTE ON FUNCTION public.dashboard_resumo(uuid) TO authenticated;
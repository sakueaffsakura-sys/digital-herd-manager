CREATE OR REPLACE FUNCTION public.dashboard_resumo(_propriedade_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
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
) WHERE private.tem_acesso_propriedade(_propriedade_id)
$function$;
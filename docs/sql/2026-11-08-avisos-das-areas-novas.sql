-- Central de avisos: acrescenta o que as áreas novas têm de urgente.
-- Mantém tudo que já existia e junta cinco fontes:
--   carência do leite, retorno de tratamento, tarefa atrasada, conta vencendo e documento vencendo.
create or replace function public.central_avisos(_propriedade_id uuid)
returns jsonb
language sql
stable
set search_path to 'public', 'private'
as $function$
  with d as (select private.hoje_br() as hoje),
  vac as (
    select count(*) as qtd, max(proxima_aplicacao) as ult
    from public.v_vacinacoes_status
    where propriedade_id = _propriedade_id and ultima_dose and status_atual = 'vencida'
  ),
  partos as (
    select count(*) as qtd, min(i.previsao_parto) as prox
    from public.inseminacoes i, d
    where i.propriedade_id = _propriedade_id and i.situacao in ('em_andamento','confirmada')
      and i.previsao_parto between d.hoje and d.hoje + 15
  ),
  leite as (
    select coalesce(sum(p.litros) filter (where p.data between d.hoje - 7 and d.hoje - 1), 0) as atual,
           coalesce(sum(p.litros) filter (where p.data between d.hoje - 14 and d.hoje - 8), 0) as anterior
    from public.producao_leite p, d
    where p.propriedade_id = _propriedade_id and p.data between d.hoje - 14 and d.hoje - 1
  ),
  pesagem as (
    select count(*) as qtd
    from public.animais a, d
    where a.propriedade_id = _propriedade_id and a.situacao = 'ativo'
      and a.data_nascimento >= (d.hoje - interval '24 months')::date
      and not exists (select 1 from public.pesagens p where p.animal_id = a.id and p.data >= d.hoje - 60)
  ),
  assin as (
    select min(data_expiracao) as venc
    from public.assinaturas
    where propriedade_id = _propriedade_id and plano = 'premium' and status in ('ativo','trial')
      and data_expiracao between now() and now() + interval '7 days'
  ),
  -- Carência do leite: enquanto não passa, o leite daquele animal não pode ser vendido.
  carencia as (
    select count(*) as qtd, max(t.data + t.carencia_leite) as fim
    from public.tratamentos t, d
    where t.propriedade_id = _propriedade_id
      and coalesce(t.carencia_leite, 0) > 0
      and t.data + t.carencia_leite >= d.hoje
  ),
  retorno as (
    select count(*) as qtd, min(t.retorno) as prox
    from public.tratamentos t, d
    where t.propriedade_id = _propriedade_id and t.status <> 'Resolvido'
      and t.retorno between d.hoje and d.hoje + 3
  ),
  tarefa as (
    select count(*) as qtd, min(t.data) as antiga
    from public.tarefas t, d
    where t.propriedade_id = _propriedade_id and t.status <> 'Concluída' and t.data < d.hoje
  ),
  conta as (
    select count(*) as qtd, sum(c.valor) as total, min(c.vencimento) as prox
    from public.contas c, d
    where c.propriedade_id = _propriedade_id and c.status = 'Aberta' and c.tipo = 'A pagar'
      and c.vencimento <= d.hoje + 7
  ),
  documento as (
    select count(*) as qtd, min(o.vencimento) as prox
    from public.documentos o, d
    where o.propriedade_id = _propriedade_id and o.vencimento between d.hoje and d.hoje + 30
  ),
  lista as (
    select 'vacinas_atrasadas:' || vac.qtd || ':' || coalesce(vac.ult::text, '') as chave, 'alerta' as nivel, 'vacinacao' as secao,
           case when vac.qtd = 1 then '1 vacina atrasada' else vac.qtd || ' vacinas atrasadas' end as titulo,
           'A data da próxima dose já passou. Aplique e registre para sair da lista.' as texto, 1 as ordem
    from vac where vac.qtd > 0
    union all
    select 'carencia_leite:' || carencia.qtd || ':' || carencia.fim::text, 'alerta', 'tratamentos',
           case when carencia.qtd = 1 then 'Leite em carência de remédio' else carencia.qtd || ' tratamentos com o leite em carência' end,
           'O leite não pode ser vendido até ' || to_char(carencia.fim, 'DD/MM') || '. Ordenhe por último e descarte.', 2
    from carencia where carencia.qtd > 0
    union all
    select 'partos_15d:' || partos.qtd || ':' || coalesce(partos.prox::text, ''), 'aviso', 'agenda',
           case when partos.qtd = 1 then '1 parto nos próximos 15 dias' else partos.qtd || ' partos nos próximos 15 dias' end,
           'O primeiro está previsto para ' || to_char(partos.prox, 'DD/MM') || '. Prepare a maternidade.', 3
    from partos where partos.qtd > 0
    union all
    select 'retorno_tratamento:' || retorno.qtd || ':' || retorno.prox::text, 'aviso', 'tratamentos',
           case when retorno.qtd = 1 then '1 tratamento para reavaliar' else retorno.qtd || ' tratamentos para reavaliar' end,
           'O primeiro é em ' || to_char(retorno.prox, 'DD/MM') || '. Reaplicar ou reavaliar conforme a orientação.', 4
    from retorno where retorno.qtd > 0
    union all
    select 'tarefa_atrasada:' || tarefa.qtd || ':' || tarefa.antiga::text, 'aviso', 'tarefas',
           case when tarefa.qtd = 1 then '1 tarefa atrasada' else tarefa.qtd || ' tarefas atrasadas' end,
           'A mais antiga era para ' || to_char(tarefa.antiga, 'DD/MM') || '. Conclua ou mude a data.', 5
    from tarefa where tarefa.qtd > 0
    union all
    select 'conta_vencendo:' || conta.qtd || ':' || conta.prox::text, 'aviso', 'contas',
           case when conta.qtd = 1 then '1 conta a pagar nesta semana' else conta.qtd || ' contas a pagar nesta semana' end,
           'Somam R$ ' || replace(to_char(conta.total, 'FM999999990.00'), '.', ',') || '. A primeira vence em ' || to_char(conta.prox, 'DD/MM') || '.', 6
    from conta where conta.qtd > 0
    union all
    select 'queda_leite:' || (d.hoje - 1)::text, 'aviso', 'producao',
           'O leite caiu ' || round(100 - leite.atual * 100.0 / leite.anterior) || '% nesta semana',
           'Foram ' || round(leite.atual) || ' litros nos últimos 7 dias, contra ' || round(leite.anterior) || ' na semana anterior.', 7
    from leite, d where leite.anterior > 0 and leite.atual < leite.anterior * 0.8
    union all
    select 'documento_vencendo:' || documento.qtd || ':' || documento.prox::text, 'info', 'documentos',
           case when documento.qtd = 1 then '1 documento vence neste mês' else documento.qtd || ' documentos vencem neste mês' end,
           'O primeiro vence em ' || to_char(documento.prox, 'DD/MM') || '.', 8
    from documento where documento.qtd > 0
    union all
    select 'sem_pesagem:' || pesagem.qtd || ':' || to_char(d.hoje, 'IYYY-IW'), 'info', 'bezerros',
           case when pesagem.qtd = 1 then '1 animal jovem sem pesagem há mais de 60 dias' else pesagem.qtd || ' animais jovens sem pesagem há mais de 60 dias' end,
           'Pesar a cada 30 a 60 dias mostra se estão ganhando peso como deveriam.', 9
    from pesagem, d where pesagem.qtd > 0
    union all
    select 'assinatura_vence:' || assin.venc::date::text, 'aviso', 'assinatura',
           'Sua assinatura vence em ' || to_char(assin.venc at time zone 'America/Sao_Paulo', 'DD/MM'),
           'Renove para não perder os recursos Premium e a biblioteca.', 10
    from assin where assin.venc is not null
  )
  select coalesce(jsonb_agg(jsonb_build_object('chave', l.chave, 'nivel', l.nivel, 'secao', l.secao, 'titulo', l.titulo, 'texto', l.texto) order by l.ordem), '[]'::jsonb)
  from lista l
  where private.tem_acesso_propriedade(_propriedade_id)
    and not exists (select 1 from public.notificacoes n where n.user_id = auth.uid() and n.chave = l.chave)
$function$;

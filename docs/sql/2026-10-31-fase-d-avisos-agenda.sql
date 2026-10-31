-- Fase D/E (parte 1): números do Início, central de avisos e agenda.
-- Só adições (coluna nova opcional, funções novas, chaves novas no resumo): o site publicado
-- e o app Android continuam funcionando. Pode rodar de novo sem erro.

-- 1) Avisos marcados como "visto" ficam em notificacoes, identificados por uma chave.
alter table public.notificacoes add column if not exists chave text;
create unique index if not exists notificacoes_usuario_chave_uidx on public.notificacoes (user_id, chave);

-- 2) Início: litros de hoje, vacinas atrasadas e partos em 30 dias (as chaves antigas continuam).
create or replace function public.dashboard_resumo(_propriedade_id uuid)
returns jsonb
language sql
stable
set search_path to 'public', 'private'
as $function$
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
    'total_lotes', (select count(*) from public.lotes where propriedade_id = _propriedade_id),
    'leite_hoje', (select coalesce(sum(litros), 0) from public.producao_leite where propriedade_id = _propriedade_id and data = d.hoje),
    'leite_ontem', (select coalesce(sum(litros), 0) from public.producao_leite where propriedade_id = _propriedade_id and data = d.hoje - 1),
    'vacinas_vencidas', (select count(*) from public.v_vacinacoes_status where propriedade_id = _propriedade_id and ultima_dose and status_atual = 'vencida'),
    'partos_30d', (select count(*) from public.inseminacoes where propriedade_id = _propriedade_id and situacao in ('em_andamento','confirmada')
                     and previsao_parto between d.hoje and d.hoje + 30)
  )
  from d, t
  where private.tem_acesso_propriedade(_propriedade_id)
$function$;

-- 3) Central de avisos (SECURITY INVOKER: valem as regras de acesso de cada tabela).
--    Cada aviso tem uma chave que muda quando a situação muda; "visto" esconde só aquela situação.
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
  lista as (
    select 'vacinas_atrasadas:' || vac.qtd || ':' || coalesce(vac.ult::text, '') as chave, 'alerta' as nivel, 'vacinacao' as secao,
           case when vac.qtd = 1 then '1 vacina atrasada' else vac.qtd || ' vacinas atrasadas' end as titulo,
           'A data da próxima dose já passou. Aplique e registre para sair da lista.' as texto, 1 as ordem
    from vac where vac.qtd > 0
    union all
    select 'partos_15d:' || partos.qtd || ':' || coalesce(partos.prox::text, ''), 'aviso', 'agenda',
           case when partos.qtd = 1 then '1 parto nos próximos 15 dias' else partos.qtd || ' partos nos próximos 15 dias' end,
           'O primeiro está previsto para ' || to_char(partos.prox, 'DD/MM') || '. Prepare a maternidade.', 2
    from partos where partos.qtd > 0
    union all
    select 'queda_leite:' || (d.hoje - 1)::text, 'aviso', 'producao',
           'O leite caiu ' || round(100 - leite.atual * 100.0 / leite.anterior) || '% nesta semana',
           'Foram ' || round(leite.atual) || ' litros nos últimos 7 dias, contra ' || round(leite.anterior) || ' na semana anterior.', 3
    from leite, d where leite.anterior > 0 and leite.atual < leite.anterior * 0.8
    union all
    select 'sem_pesagem:' || pesagem.qtd || ':' || to_char(d.hoje, 'IYYY-IW'), 'info', 'bezerros',
           case when pesagem.qtd = 1 then '1 animal jovem sem pesagem há mais de 60 dias' else pesagem.qtd || ' animais jovens sem pesagem há mais de 60 dias' end,
           'Pesar a cada 30 a 60 dias mostra se estão ganhando peso como deveriam.', 4
    from pesagem, d where pesagem.qtd > 0
    union all
    select 'assinatura_vence:' || assin.venc::date::text, 'aviso', 'assinatura',
           'Sua assinatura vence em ' || to_char(assin.venc at time zone 'America/Sao_Paulo', 'DD/MM'),
           'Renove para não perder os recursos Premium e a biblioteca.', 5
    from assin where assin.venc is not null
  )
  select coalesce(jsonb_agg(jsonb_build_object('chave', l.chave, 'nivel', l.nivel, 'secao', l.secao, 'titulo', l.titulo, 'texto', l.texto) order by l.ordem), '[]'::jsonb)
  from lista l
  where private.tem_acesso_propriedade(_propriedade_id)
    and not exists (select 1 from public.notificacoes n where n.user_id = auth.uid() and n.chave = l.chave)
$function$;

-- 4) Agenda: vacinas a vencer (só a última dose), partos previstos e retorno de cio (21 dias),
--    mais as vacinas já atrasadas e os animais jovens sem pesagem. No máximo 500 eventos por período.
create or replace function public.agenda_periodo(_propriedade_id uuid, _de date, _ate date)
returns jsonb
language sql
stable
set search_path to 'public', 'private'
as $function$
  with d as (select private.hoje_br() as hoje),
  eventos as (
    select v.proxima_aplicacao as data, 'vacina' as tipo, v.id as registro_id, v.animal_id, tv.nome as titulo,
           coalesce(a.nome, a.numero_brinco, case when l.nome is not null then 'Lote ' || l.nome end) as detalhe,
           a.numero_brinco as brinco, v.status_atual as situacao
    from public.v_vacinacoes_status v
    join public.tipos_vacinas tv on tv.id = v.tipo_vacina_id
    left join public.animais a on a.id = v.animal_id
    left join public.lotes l on l.id = v.lote_id
    where v.propriedade_id = _propriedade_id and v.ultima_dose and v.proxima_aplicacao between _de and _ate
    union all
    select i.previsao_parto, 'parto', i.id, i.animal_id, 'Parto previsto', coalesce(a.nome, a.numero_brinco), a.numero_brinco, i.situacao::text
    from public.inseminacoes i join public.animais a on a.id = i.animal_id
    where i.propriedade_id = _propriedade_id and i.situacao in ('em_andamento','confirmada') and i.previsao_parto between _de and _ate
    union all
    select i.data_inseminacao + 21, 'cio', i.id, i.animal_id, 'Observar retorno de cio', coalesce(a.nome, a.numero_brinco), a.numero_brinco, i.situacao::text
    from public.inseminacoes i join public.animais a on a.id = i.animal_id
    where i.propriedade_id = _propriedade_id and i.situacao = 'em_andamento' and i.data_inseminacao + 21 between _de and _ate
  ),
  limitados as (select * from eventos order by data, tipo limit 501),
  atrasadas as (
    select v.proxima_aplicacao as data, v.id as registro_id, v.animal_id, tv.nome as titulo,
           coalesce(a.nome, a.numero_brinco, case when l.nome is not null then 'Lote ' || l.nome end) as detalhe, a.numero_brinco as brinco
    from public.v_vacinacoes_status v
    join public.tipos_vacinas tv on tv.id = v.tipo_vacina_id
    left join public.animais a on a.id = v.animal_id
    left join public.lotes l on l.id = v.lote_id, d
    where v.propriedade_id = _propriedade_id and v.ultima_dose and v.status_atual = 'vencida'
    order by v.proxima_aplicacao limit 100
  ),
  sem_pesagem as (
    select a.id as animal_id, a.nome, a.numero_brinco as brinco, a.data_nascimento,
           (select max(p.data) from public.pesagens p where p.animal_id = a.id) as ultima_pesagem
    from public.animais a, d
    where a.propriedade_id = _propriedade_id and a.situacao = 'ativo'
      and a.data_nascimento >= (d.hoje - interval '24 months')::date
      and not exists (select 1 from public.pesagens p where p.animal_id = a.id and p.data >= d.hoje - 60)
    order by a.data_nascimento limit 100
  )
  select jsonb_build_object(
    'eventos', coalesce((select jsonb_agg(to_jsonb(e) order by e.data, e.tipo) from (select * from limitados limit 500) e), '[]'::jsonb),
    'truncado', (select count(*) > 500 from limitados),
    'atrasadas', coalesce((select jsonb_agg(to_jsonb(x) order by x.data) from atrasadas x), '[]'::jsonb),
    'sem_pesagem', coalesce((select jsonb_agg(to_jsonb(s) order by s.data_nascimento) from sem_pesagem s), '[]'::jsonb),
    'hoje', (select hoje from d)
  )
  where private.tem_acesso_propriedade(_propriedade_id) and _ate >= _de and _ate - _de <= 400
$function$;

revoke all on function public.central_avisos(uuid) from public, anon;
revoke all on function public.agenda_periodo(uuid, date, date) from public, anon;
grant execute on function public.central_avisos(uuid) to authenticated;
grant execute on function public.agenda_periodo(uuid, date, date) to authenticated;

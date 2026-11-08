-- Anotações: marcar como importante. Fica na conta (vale em qualquer aparelho),
-- diferente do aplicativo, onde a marca ficava só naquele celular.
-- Só adiciona uma coluna com valor padrão: o site publicado e o app continuam funcionando.
alter table public.anotacoes_producao add column if not exists marcada boolean not null default false;
create index if not exists anotacoes_marcadas_idx on public.anotacoes_producao (propriedade_id, data desc) where marcada;

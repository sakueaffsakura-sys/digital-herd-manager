-- As 39 áreas que o aplicativo Android já tinha e o site passou a ter.
-- Aplicado em 08/11/2026. Pode rodar de novo: tudo é "if not exists" / "drop ... if exists".
--
-- Cada tabela segue o mesmo padrão das que já existiam:
--   * propriedade_id obrigatório, apagado junto com a propriedade;
--   * ligação obrigatória cai junto (cascade), ligação opcional só perde a referência (set null);
--   * limites do aplicativo repetidos como restrição no banco (check), para o banco também recusar
--     valor impossível;
--   * RLS com duas políticas: a restritiva da manutenção (private.acesso_negado) e a da propriedade
--     (private.minhas_propriedades);
--   * nada para o papel anônimo; leitura e escrita só para quem entrou;
--   * gatilho de updated_at.
--
-- A ordem é a de dependência: quem é apontado vem antes de quem aponta.

-- Pastos e piquetes — Área, capim, lotação e descanso
create table if not exists public.pastos (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  "nome" text not null,
  "area_ha" numeric not null,
  "forrageira" text,
  "capacidade" integer,
  "situacao" text default 'Disponível' not null,
  "ultima_adubacao" date,
  "ultima_reforma" date,
  "obs" text,
  constraint area_ha_valido check ("area_ha" is null or ("area_ha" >= 0)),
  constraint capacidade_valido check ("capacidade" is null or ("capacidade" >= 0)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pastos_prop_idx on public.pastos (propriedade_id);
alter table public.pastos enable row level security;
drop policy if exists pastos_manutencao on public.pastos;
create policy pastos_manutencao on public.pastos as restrictive to authenticated
  using (not private.acesso_negado('pecuaria')) with check (not private.acesso_negado('pecuaria'));
drop policy if exists pastos_minhas on public.pastos;
create policy pastos_minhas on public.pastos for all to authenticated
  using (propriedade_id in (select private.minhas_propriedades()))
  with check (propriedade_id in (select private.minhas_propriedades()));
revoke all on public.pastos from anon;
grant select, insert, update, delete on public.pastos to authenticated;
drop trigger if exists set_pastos_updated_at on public.pastos;
create trigger set_pastos_updated_at before update on public.pastos for each row execute function public.set_updated_at();

-- Entrada e saída de lotes — Quando um lote entra e sai de cada pasto
create table if not exists public.pasto_mov (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  "pasto_id" uuid references public.pastos(id) on delete cascade not null,
  "lote_id" uuid references public.lotes(id) on delete cascade not null,
  "qtd_animais" integer,
  "entrada" date default private.hoje_br() not null,
  "saida" date,
  "obs" text,
  constraint qtd_animais_valido check ("qtd_animais" is null or ("qtd_animais" >= 0)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pasto_mov_prop_data_idx on public.pasto_mov (propriedade_id, "entrada" desc);
create index if not exists pasto_mov_pasto_id_idx on public.pasto_mov ("pasto_id");
create index if not exists pasto_mov_lote_id_idx on public.pasto_mov ("lote_id");
alter table public.pasto_mov enable row level security;
drop policy if exists pasto_mov_manutencao on public.pasto_mov;
create policy pasto_mov_manutencao on public.pasto_mov as restrictive to authenticated
  using (not private.acesso_negado('pecuaria')) with check (not private.acesso_negado('pecuaria'));
drop policy if exists pasto_mov_minhas on public.pasto_mov;
create policy pasto_mov_minhas on public.pasto_mov for all to authenticated
  using (propriedade_id in (select private.minhas_propriedades()))
  with check (propriedade_id in (select private.minhas_propriedades()));
revoke all on public.pasto_mov from anon;
grant select, insert, update, delete on public.pasto_mov to authenticated;
drop trigger if exists set_pasto_mov_updated_at on public.pasto_mov;
create trigger set_pasto_mov_updated_at before update on public.pasto_mov for each row execute function public.set_updated_at();

-- Campanhas sanitárias — Vacinação e vermifugação em época certa
create table if not exists public.campanhas (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  "nome" text not null,
  "tipo" text default 'Vacinação',
  "inicio" date default private.hoje_br() not null,
  "fim" date,
  "produto" text,
  "lotes" text,
  "status" text default 'Planejada' not null,
  "obs" text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists campanhas_prop_data_idx on public.campanhas (propriedade_id, "inicio" desc);
alter table public.campanhas enable row level security;
drop policy if exists campanhas_manutencao on public.campanhas;
create policy campanhas_manutencao on public.campanhas as restrictive to authenticated
  using (not private.acesso_negado('pecuaria')) with check (not private.acesso_negado('pecuaria'));
drop policy if exists campanhas_minhas on public.campanhas;
create policy campanhas_minhas on public.campanhas for all to authenticated
  using (propriedade_id in (select private.minhas_propriedades()))
  with check (propriedade_id in (select private.minhas_propriedades()));
revoke all on public.campanhas from anon;
grant select, insert, update, delete on public.campanhas to authenticated;
drop trigger if exists set_campanhas_updated_at on public.campanhas;
create trigger set_campanhas_updated_at before update on public.campanhas for each row execute function public.set_updated_at();

-- Cios — Observação de cio e previsão do próximo
create table if not exists public.cios (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  "animal_id" uuid references public.animais(id) on delete cascade not null,
  "data" date default private.hoje_br() not null,
  "sinais" text,
  "acao" text default 'Observar',
  "obs" text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists cios_prop_data_idx on public.cios (propriedade_id, "data" desc);
create index if not exists cios_animal_id_idx on public.cios ("animal_id");
alter table public.cios enable row level security;
drop policy if exists cios_manutencao on public.cios;
create policy cios_manutencao on public.cios as restrictive to authenticated
  using (not private.acesso_negado('pecuaria')) with check (not private.acesso_negado('pecuaria'));
drop policy if exists cios_minhas on public.cios;
create policy cios_minhas on public.cios for all to authenticated
  using (propriedade_id in (select private.minhas_propriedades()))
  with check (propriedade_id in (select private.minhas_propriedades()));
revoke all on public.cios from anon;
grant select, insert, update, delete on public.cios to authenticated;
drop trigger if exists set_cios_updated_at on public.cios;
create trigger set_cios_updated_at before update on public.cios for each row execute function public.set_updated_at();

-- Ocorrências reprodutivas — Aborto, retenção de placenta, parto difícil e outros
create table if not exists public.ocorr_reprod (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  "animal_id" uuid references public.animais(id) on delete cascade not null,
  "tipo" text not null,
  "data" date default private.hoje_br() not null,
  "descricao" text,
  "obs" text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ocorr_reprod_prop_data_idx on public.ocorr_reprod (propriedade_id, "data" desc);
create index if not exists ocorr_reprod_animal_id_idx on public.ocorr_reprod ("animal_id");
alter table public.ocorr_reprod enable row level security;
drop policy if exists ocorr_reprod_manutencao on public.ocorr_reprod;
create policy ocorr_reprod_manutencao on public.ocorr_reprod as restrictive to authenticated
  using (not private.acesso_negado('pecuaria')) with check (not private.acesso_negado('pecuaria'));
drop policy if exists ocorr_reprod_minhas on public.ocorr_reprod;
create policy ocorr_reprod_minhas on public.ocorr_reprod for all to authenticated
  using (propriedade_id in (select private.minhas_propriedades()))
  with check (propriedade_id in (select private.minhas_propriedades()));
revoke all on public.ocorr_reprod from anon;
grant select, insert, update, delete on public.ocorr_reprod to authenticated;
drop trigger if exists set_ocorr_reprod_updated_at on public.ocorr_reprod;
create trigger set_ocorr_reprod_updated_at before update on public.ocorr_reprod for each row execute function public.set_updated_at();

-- Cuidados com bezerros — Colostro, parto, peso ao nascer e desmame
create table if not exists public.bezerros_info (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  "animal_id" uuid references public.animais(id) on delete cascade not null,
  "colostro" text default 'Não sei' not null,
  "parto" text default 'Normal',
  "peso_nascer" numeric,
  "orfao" boolean default false,
  "desmame_previsto" date,
  "desmamado_em" date,
  "obs" text,
  constraint peso_nascer_valido check ("peso_nascer" is null or ("peso_nascer" >= 0)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bezerros_info_prop_idx on public.bezerros_info (propriedade_id);
create index if not exists bezerros_info_animal_id_idx on public.bezerros_info ("animal_id");
alter table public.bezerros_info enable row level security;
drop policy if exists bezerros_info_manutencao on public.bezerros_info;
create policy bezerros_info_manutencao on public.bezerros_info as restrictive to authenticated
  using (not private.acesso_negado('pecuaria')) with check (not private.acesso_negado('pecuaria'));
drop policy if exists bezerros_info_minhas on public.bezerros_info;
create policy bezerros_info_minhas on public.bezerros_info for all to authenticated
  using (propriedade_id in (select private.minhas_propriedades()))
  with check (propriedade_id in (select private.minhas_propriedades()));
revoke all on public.bezerros_info from anon;
grant select, insert, update, delete on public.bezerros_info to authenticated;
drop trigger if exists set_bezerros_info_updated_at on public.bezerros_info;
create trigger set_bezerros_info_updated_at before update on public.bezerros_info for each row execute function public.set_updated_at();

-- Origem e identificação — Pelagem, finalidade, procedência e identificação oficial
create table if not exists public.animal_extra (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  "animal_id" uuid references public.animais(id) on delete cascade not null,
  "pelagem" text,
  "finalidade" text,
  "origem" text,
  "procedencia" text,
  "identificacao" text,
  "pasto_id" uuid references public.pastos(id) on delete set null,
  "obs" text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists animal_extra_prop_idx on public.animal_extra (propriedade_id);
create index if not exists animal_extra_animal_id_idx on public.animal_extra ("animal_id");
create index if not exists animal_extra_pasto_id_idx on public.animal_extra ("pasto_id");
alter table public.animal_extra enable row level security;
drop policy if exists animal_extra_manutencao on public.animal_extra;
create policy animal_extra_manutencao on public.animal_extra as restrictive to authenticated
  using (not private.acesso_negado('pecuaria')) with check (not private.acesso_negado('pecuaria'));
drop policy if exists animal_extra_minhas on public.animal_extra;
create policy animal_extra_minhas on public.animal_extra for all to authenticated
  using (propriedade_id in (select private.minhas_propriedades()))
  with check (propriedade_id in (select private.minhas_propriedades()));
revoke all on public.animal_extra from anon;
grant select, insert, update, delete on public.animal_extra to authenticated;
drop trigger if exists set_animal_extra_updated_at on public.animal_extra;
create trigger set_animal_extra_updated_at before update on public.animal_extra for each row execute function public.set_updated_at();

-- Movimentação de animais — Mudanças de pasto e de propriedade, entradas e saídas
create table if not exists public.mov_animais (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  "tipo" text not null,
  "data" date default private.hoje_br() not null,
  "animal_id" uuid references public.animais(id) on delete set null,
  "lote_id" uuid references public.lotes(id) on delete set null,
  "de" text,
  "para" text,
  "responsavel" text,
  "obs" text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists mov_animais_prop_data_idx on public.mov_animais (propriedade_id, "data" desc);
create index if not exists mov_animais_animal_id_idx on public.mov_animais ("animal_id");
create index if not exists mov_animais_lote_id_idx on public.mov_animais ("lote_id");
alter table public.mov_animais enable row level security;
drop policy if exists mov_animais_manutencao on public.mov_animais;
create policy mov_animais_manutencao on public.mov_animais as restrictive to authenticated
  using (not private.acesso_negado('pecuaria')) with check (not private.acesso_negado('pecuaria'));
drop policy if exists mov_animais_minhas on public.mov_animais;
create policy mov_animais_minhas on public.mov_animais for all to authenticated
  using (propriedade_id in (select private.minhas_propriedades()))
  with check (propriedade_id in (select private.minhas_propriedades()));
revoke all on public.mov_animais from anon;
grant select, insert, update, delete on public.mov_animais to authenticated;
drop trigger if exists set_mov_animais_updated_at on public.mov_animais;
create trigger set_mov_animais_updated_at before update on public.mov_animais for each row execute function public.set_updated_at();

-- Gado de corte e engorda — Peso, ganho diário, custo e resultado por lote
create table if not exists public.engorda (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  "lote_id" uuid references public.lotes(id) on delete cascade not null,
  "data_entrada" date default private.hoje_br() not null,
  "peso_alvo" numeric,
  "saida_prevista" date,
  "custo_aquisicao" numeric(14,2),
  "preco_arroba" numeric(14,2),
  "rendimento" numeric default 52,
  "obs" text,
  constraint peso_alvo_valido check ("peso_alvo" is null or ("peso_alvo" >= 0)),
  constraint custo_aquisicao_valido check ("custo_aquisicao" is null or ("custo_aquisicao" >= 0)),
  constraint preco_arroba_valido check ("preco_arroba" is null or ("preco_arroba" >= 0)),
  constraint rendimento_valido check ("rendimento" is null or ("rendimento" >= 0 and "rendimento" <= 100)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists engorda_prop_data_idx on public.engorda (propriedade_id, "data_entrada" desc);
create index if not exists engorda_lote_id_idx on public.engorda ("lote_id");
alter table public.engorda enable row level security;
drop policy if exists engorda_manutencao on public.engorda;
create policy engorda_manutencao on public.engorda as restrictive to authenticated
  using (not private.acesso_negado('pecuaria')) with check (not private.acesso_negado('pecuaria'));
drop policy if exists engorda_minhas on public.engorda;
create policy engorda_minhas on public.engorda for all to authenticated
  using (propriedade_id in (select private.minhas_propriedades()))
  with check (propriedade_id in (select private.minhas_propriedades()));
revoke all on public.engorda from anon;
grant select, insert, update, delete on public.engorda to authenticated;
drop trigger if exists set_engorda_updated_at on public.engorda;
create trigger set_engorda_updated_at before update on public.engorda for each row execute function public.set_updated_at();

-- Qualidade do leite — CCS, CPP, gordura e proteína
create table if not exists public.qualidade_leite (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  "data" date default private.hoje_br() not null,
  "ccs" integer,
  "cpp" integer,
  "gordura" numeric,
  "proteina" numeric,
  "temperatura" numeric,
  "laboratorio" text,
  "obs" text,
  constraint ccs_valido check ("ccs" is null or ("ccs" >= 0)),
  constraint cpp_valido check ("cpp" is null or ("cpp" >= 0)),
  constraint gordura_valido check ("gordura" is null or ("gordura" >= 0 and "gordura" <= 100)),
  constraint proteina_valido check ("proteina" is null or ("proteina" >= 0 and "proteina" <= 100)),
  constraint temperatura_valido check ("temperatura" is null or ("temperatura" >= -10 and "temperatura" <= 60)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists qualidade_leite_prop_data_idx on public.qualidade_leite (propriedade_id, "data" desc);
alter table public.qualidade_leite enable row level security;
drop policy if exists qualidade_leite_manutencao on public.qualidade_leite;
create policy qualidade_leite_manutencao on public.qualidade_leite as restrictive to authenticated
  using (not private.acesso_negado('pecuaria')) with check (not private.acesso_negado('pecuaria'));
drop policy if exists qualidade_leite_minhas on public.qualidade_leite;
create policy qualidade_leite_minhas on public.qualidade_leite for all to authenticated
  using (propriedade_id in (select private.minhas_propriedades()))
  with check (propriedade_id in (select private.minhas_propriedades()));
revoke all on public.qualidade_leite from anon;
grant select, insert, update, delete on public.qualidade_leite to authenticated;
drop trigger if exists set_qualidade_leite_updated_at on public.qualidade_leite;
create trigger set_qualidade_leite_updated_at before update on public.qualidade_leite for each row execute function public.set_updated_at();

-- Avaliações de campo — Escore corporal, altura e nota do pasto, voltagem da cerca
create table if not exists public.avaliacoes (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  "tipo" text default 'Escore corporal (1 a 5)' not null,
  "data" date default private.hoje_br() not null,
  "valor" numeric not null,
  "animal_id" uuid references public.animais(id) on delete set null,
  "lote_id" uuid references public.lotes(id) on delete set null,
  "pasto_id" uuid references public.pastos(id) on delete set null,
  "responsavel" text,
  "obs" text,
  constraint valor_valido check ("valor" is null or ("valor" >= 0)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists avaliacoes_prop_data_idx on public.avaliacoes (propriedade_id, "data" desc);
create index if not exists avaliacoes_animal_id_idx on public.avaliacoes ("animal_id");
create index if not exists avaliacoes_lote_id_idx on public.avaliacoes ("lote_id");
create index if not exists avaliacoes_pasto_id_idx on public.avaliacoes ("pasto_id");
alter table public.avaliacoes enable row level security;
drop policy if exists avaliacoes_manutencao on public.avaliacoes;
create policy avaliacoes_manutencao on public.avaliacoes as restrictive to authenticated
  using (not private.acesso_negado('pecuaria')) with check (not private.acesso_negado('pecuaria'));
drop policy if exists avaliacoes_minhas on public.avaliacoes;
create policy avaliacoes_minhas on public.avaliacoes for all to authenticated
  using (propriedade_id in (select private.minhas_propriedades()))
  with check (propriedade_id in (select private.minhas_propriedades()));
revoke all on public.avaliacoes from anon;
grant select, insert, update, delete on public.avaliacoes to authenticated;
drop trigger if exists set_avaliacoes_updated_at on public.avaliacoes;
create trigger set_avaliacoes_updated_at before update on public.avaliacoes for each row execute function public.set_updated_at();

-- GTA e trânsito — Guias de trânsito animal: número, validade, origem e destino
create table if not exists public.gta (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  "numero" text not null,
  "emissao" date default private.hoje_br() not null,
  "validade" date not null,
  "finalidade" text not null,
  "qtd" integer not null,
  "especie" text default 'Bovino',
  "lote_id" uuid references public.lotes(id) on delete set null,
  "origem" text,
  "destino" text not null,
  "situacao" text default 'Emitida' not null,
  "obs" text,
  constraint qtd_valido check ("qtd" is null or ("qtd" >= 0)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists gta_prop_data_idx on public.gta (propriedade_id, "emissao" desc);
create index if not exists gta_lote_id_idx on public.gta ("lote_id");
alter table public.gta enable row level security;
drop policy if exists gta_manutencao on public.gta;
create policy gta_manutencao on public.gta as restrictive to authenticated
  using (not private.acesso_negado('pecuaria')) with check (not private.acesso_negado('pecuaria'));
drop policy if exists gta_minhas on public.gta;
create policy gta_minhas on public.gta for all to authenticated
  using (propriedade_id in (select private.minhas_propriedades()))
  with check (propriedade_id in (select private.minhas_propriedades()));
revoke all on public.gta from anon;
grant select, insert, update, delete on public.gta to authenticated;
drop trigger if exists set_gta_updated_at on public.gta;
create trigger set_gta_updated_at before update on public.gta for each row execute function public.set_updated_at();

-- Instalações e setores — Currais, galpões, depósitos e setores
create table if not exists public.instalacoes (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  "nome" text not null,
  "tipo" text not null,
  "capacidade" text,
  "ativo" boolean default true,
  "obs" text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists instalacoes_prop_idx on public.instalacoes (propriedade_id);
alter table public.instalacoes enable row level security;
drop policy if exists instalacoes_manutencao on public.instalacoes;
create policy instalacoes_manutencao on public.instalacoes as restrictive to authenticated
  using (not private.acesso_negado('fazenda')) with check (not private.acesso_negado('fazenda'));
drop policy if exists instalacoes_minhas on public.instalacoes;
create policy instalacoes_minhas on public.instalacoes for all to authenticated
  using (propriedade_id in (select private.minhas_propriedades()))
  with check (propriedade_id in (select private.minhas_propriedades()));
revoke all on public.instalacoes from anon;
grant select, insert, update, delete on public.instalacoes to authenticated;
drop trigger if exists set_instalacoes_updated_at on public.instalacoes;
create trigger set_instalacoes_updated_at before update on public.instalacoes for each row execute function public.set_updated_at();

-- Equipe — Funcionários, funções e setores
create table if not exists public.funcionarios (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  "nome" text not null,
  "funcao" text not null,
  "setor" text,
  "telefone" text,
  "admissao" date,
  "situacao" text default 'Ativo' not null,
  "salario" numeric(14,2),
  "obs" text,
  constraint salario_valido check ("salario" is null or ("salario" >= 0)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists funcionarios_prop_idx on public.funcionarios (propriedade_id);
alter table public.funcionarios enable row level security;
drop policy if exists funcionarios_manutencao on public.funcionarios;
create policy funcionarios_manutencao on public.funcionarios as restrictive to authenticated
  using (not private.acesso_negado('fazenda')) with check (not private.acesso_negado('fazenda'));
drop policy if exists funcionarios_minhas on public.funcionarios;
create policy funcionarios_minhas on public.funcionarios for all to authenticated
  using (propriedade_id in (select private.minhas_propriedades()))
  with check (propriedade_id in (select private.minhas_propriedades()));
revoke all on public.funcionarios from anon;
grant select, insert, update, delete on public.funcionarios to authenticated;
drop trigger if exists set_funcionarios_updated_at on public.funcionarios;
create trigger set_funcionarios_updated_at before update on public.funcionarios for each row execute function public.set_updated_at();

-- Tarefas e agenda — O que fazer, quem faz e até quando
create table if not exists public.tarefas (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  "titulo" text not null,
  "tipo" text default 'Geral' not null,
  "data" date default private.hoje_br() not null,
  "prioridade" text default 'Normal' not null,
  "status" text default 'Pendente' not null,
  "responsavel_id" uuid references public.funcionarios(id) on delete set null,
  "setor" text,
  "repete" text default 'Não repete',
  "animal_id" uuid references public.animais(id) on delete set null,
  "lote_id" uuid references public.lotes(id) on delete set null,
  "obs" text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tarefas_prop_data_idx on public.tarefas (propriedade_id, "data" desc);
create index if not exists tarefas_responsavel_id_idx on public.tarefas ("responsavel_id");
create index if not exists tarefas_animal_id_idx on public.tarefas ("animal_id");
create index if not exists tarefas_lote_id_idx on public.tarefas ("lote_id");
alter table public.tarefas enable row level security;
drop policy if exists tarefas_manutencao on public.tarefas;
create policy tarefas_manutencao on public.tarefas as restrictive to authenticated
  using (not private.acesso_negado('fazenda')) with check (not private.acesso_negado('fazenda'));
drop policy if exists tarefas_minhas on public.tarefas;
create policy tarefas_minhas on public.tarefas for all to authenticated
  using (propriedade_id in (select private.minhas_propriedades()))
  with check (propriedade_id in (select private.minhas_propriedades()));
revoke all on public.tarefas from anon;
grant select, insert, update, delete on public.tarefas to authenticated;
drop trigger if exists set_tarefas_updated_at on public.tarefas;
create trigger set_tarefas_updated_at before update on public.tarefas for each row execute function public.set_updated_at();

-- Ocorrências do dia a dia — Problemas e fatos do trabalho (cerca, falta de água…)
create table if not exists public.ocorrencias (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  "data" date default private.hoje_br() not null,
  "titulo" text not null,
  "gravidade" text default 'Baixa',
  "status" text default 'Aberta' not null,
  "setor" text,
  "responsavel_id" uuid references public.funcionarios(id) on delete set null,
  "descricao" text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ocorrencias_prop_data_idx on public.ocorrencias (propriedade_id, "data" desc);
create index if not exists ocorrencias_responsavel_id_idx on public.ocorrencias ("responsavel_id");
alter table public.ocorrencias enable row level security;
drop policy if exists ocorrencias_manutencao on public.ocorrencias;
create policy ocorrencias_manutencao on public.ocorrencias as restrictive to authenticated
  using (not private.acesso_negado('fazenda')) with check (not private.acesso_negado('fazenda'));
drop policy if exists ocorrencias_minhas on public.ocorrencias;
create policy ocorrencias_minhas on public.ocorrencias for all to authenticated
  using (propriedade_id in (select private.minhas_propriedades()))
  with check (propriedade_id in (select private.minhas_propriedades()));
revoke all on public.ocorrencias from anon;
grant select, insert, update, delete on public.ocorrencias to authenticated;
drop trigger if exists set_ocorrencias_updated_at on public.ocorrencias;
create trigger set_ocorrencias_updated_at before update on public.ocorrencias for each row execute function public.set_updated_at();

-- Máquinas e equipamentos — Tratores, implementos, ordenha, horas e revisões
create table if not exists public.maquinas (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  "nome" text not null,
  "tipo" text not null,
  "marca" text,
  "modelo" text,
  "serie" text,
  "ano" integer,
  "aquisicao_data" date,
  "aquisicao_valor" numeric(14,2),
  "horimetro" numeric,
  "km" numeric,
  "intervalo_revisao" numeric,
  "situacao" text default 'Ativa' not null,
  "operadores" text,
  "obs" text,
  constraint ano_valido check ("ano" is null or ("ano" >= 1900 and "ano" <= 2100)),
  constraint aquisicao_valor_valido check ("aquisicao_valor" is null or ("aquisicao_valor" >= 0)),
  constraint horimetro_valido check ("horimetro" is null or ("horimetro" >= 0)),
  constraint km_valido check ("km" is null or ("km" >= 0)),
  constraint intervalo_revisao_valido check ("intervalo_revisao" is null or ("intervalo_revisao" >= 0)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists maquinas_prop_idx on public.maquinas (propriedade_id);
alter table public.maquinas enable row level security;
drop policy if exists maquinas_manutencao on public.maquinas;
create policy maquinas_manutencao on public.maquinas as restrictive to authenticated
  using (not private.acesso_negado('fazenda')) with check (not private.acesso_negado('fazenda'));
drop policy if exists maquinas_minhas on public.maquinas;
create policy maquinas_minhas on public.maquinas for all to authenticated
  using (propriedade_id in (select private.minhas_propriedades()))
  with check (propriedade_id in (select private.minhas_propriedades()));
revoke all on public.maquinas from anon;
grant select, insert, update, delete on public.maquinas to authenticated;
drop trigger if exists set_maquinas_updated_at on public.maquinas;
create trigger set_maquinas_updated_at before update on public.maquinas for each row execute function public.set_updated_at();

-- Manutenção e abastecimento — Revisões, óleo, filtros, peças e combustível
create table if not exists public.manutencoes (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  "maquina_id" uuid references public.maquinas(id) on delete cascade not null,
  "tipo" text default 'Preventiva' not null,
  "data" date default private.hoje_br() not null,
  "horimetro" numeric,
  "km" numeric,
  "litros" numeric,
  "valor" numeric(14,2),
  "pecas" text,
  "oficina" text,
  "proxima_data" date,
  "proxima_horas" numeric,
  "obs" text,
  constraint horimetro_valido check ("horimetro" is null or ("horimetro" >= 0)),
  constraint km_valido check ("km" is null or ("km" >= 0)),
  constraint litros_valido check ("litros" is null or ("litros" >= 0)),
  constraint valor_valido check ("valor" is null or ("valor" >= 0)),
  constraint proxima_horas_valido check ("proxima_horas" is null or ("proxima_horas" >= 0)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists manutencoes_prop_data_idx on public.manutencoes (propriedade_id, "data" desc);
create index if not exists manutencoes_maquina_id_idx on public.manutencoes ("maquina_id");
alter table public.manutencoes enable row level security;
drop policy if exists manutencoes_manutencao on public.manutencoes;
create policy manutencoes_manutencao on public.manutencoes as restrictive to authenticated
  using (not private.acesso_negado('fazenda')) with check (not private.acesso_negado('fazenda'));
drop policy if exists manutencoes_minhas on public.manutencoes;
create policy manutencoes_minhas on public.manutencoes for all to authenticated
  using (propriedade_id in (select private.minhas_propriedades()))
  with check (propriedade_id in (select private.minhas_propriedades()));
revoke all on public.manutencoes from anon;
grant select, insert, update, delete on public.manutencoes to authenticated;
drop trigger if exists set_manutencoes_updated_at on public.manutencoes;
create trigger set_manutencoes_updated_at before update on public.manutencoes for each row execute function public.set_updated_at();

-- Documentos — Escrituras, notas, GTA, licenças e vencimentos
create table if not exists public.documentos (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  "nome" text not null,
  "categoria" text not null,
  "numero" text,
  "emissao" date,
  "vencimento" date,
  "animal_id" uuid references public.animais(id) on delete set null,
  "vinculo" text,
  "obs" text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists documentos_prop_data_idx on public.documentos (propriedade_id, "vencimento" desc);
create index if not exists documentos_animal_id_idx on public.documentos ("animal_id");
alter table public.documentos enable row level security;
drop policy if exists documentos_manutencao on public.documentos;
create policy documentos_manutencao on public.documentos as restrictive to authenticated
  using (not private.acesso_negado('fazenda')) with check (not private.acesso_negado('fazenda'));
drop policy if exists documentos_minhas on public.documentos;
create policy documentos_minhas on public.documentos for all to authenticated
  using (propriedade_id in (select private.minhas_propriedades()))
  with check (propriedade_id in (select private.minhas_propriedades()));
revoke all on public.documentos from anon;
grant select, insert, update, delete on public.documentos to authenticated;
drop trigger if exists set_documentos_updated_at on public.documentos;
create trigger set_documentos_updated_at before update on public.documentos for each row execute function public.set_updated_at();

-- Fornecedores — Contatos, condições e histórico de compras
create table if not exists public.fornecedores (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  "nome" text not null,
  "categoria" text not null,
  "contato" text,
  "telefone" text,
  "email" text,
  "cidade" text,
  "condicoes" text,
  "ativo" boolean default true,
  "obs" text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists fornecedores_prop_idx on public.fornecedores (propriedade_id);
alter table public.fornecedores enable row level security;
drop policy if exists fornecedores_manutencao on public.fornecedores;
create policy fornecedores_manutencao on public.fornecedores as restrictive to authenticated
  using (not private.acesso_negado('fazenda')) with check (not private.acesso_negado('fazenda'));
drop policy if exists fornecedores_minhas on public.fornecedores;
create policy fornecedores_minhas on public.fornecedores for all to authenticated
  using (propriedade_id in (select private.minhas_propriedades()))
  with check (propriedade_id in (select private.minhas_propriedades()));
revoke all on public.fornecedores from anon;
grant select, insert, update, delete on public.fornecedores to authenticated;
drop trigger if exists set_fornecedores_updated_at on public.fornecedores;
create trigger set_fornecedores_updated_at before update on public.fornecedores for each row execute function public.set_updated_at();

-- Contas a pagar e receber — Vencimentos de contas, com baixa no Financeiro
create table if not exists public.contas (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  "tipo" text default 'A pagar' not null,
  "descricao" text not null,
  "valor" numeric(14,2) not null,
  "vencimento" date default private.hoje_br() not null,
  "status" text default 'Aberta' not null,
  "categoria" text,
  "fornecedor_id" uuid references public.fornecedores(id) on delete set null,
  "parte" text,
  "obs" text,
  constraint valor_valido check ("valor" is null or ("valor" >= 0)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists contas_prop_data_idx on public.contas (propriedade_id, "vencimento" desc);
create index if not exists contas_fornecedor_id_idx on public.contas ("fornecedor_id");
alter table public.contas enable row level security;
drop policy if exists contas_manutencao on public.contas;
create policy contas_manutencao on public.contas as restrictive to authenticated
  using (not private.acesso_negado('fazenda')) with check (not private.acesso_negado('fazenda'));
drop policy if exists contas_minhas on public.contas;
create policy contas_minhas on public.contas for all to authenticated
  using (propriedade_id in (select private.minhas_propriedades()))
  with check (propriedade_id in (select private.minhas_propriedades()));
revoke all on public.contas from anon;
grant select, insert, update, delete on public.contas to authenticated;
drop trigger if exists set_contas_updated_at on public.contas;
create trigger set_contas_updated_at before update on public.contas for each row execute function public.set_updated_at();

-- Ponto e horas — Dias trabalhados, horas extras, diárias, faltas e o que falta pagar
create table if not exists public.horas_trabalho (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  "funcionario_id" uuid references public.funcionarios(id) on delete cascade not null,
  "data" date default private.hoje_br() not null,
  "tipo" text default 'Dia normal' not null,
  "horas" numeric default 8,
  "atividade" text,
  "valor" numeric(14,2),
  "pago" boolean default false,
  "obs" text,
  constraint horas_valido check ("horas" is null or ("horas" >= 0 and "horas" <= 24)),
  constraint valor_valido check ("valor" is null or ("valor" >= 0)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists horas_trabalho_prop_data_idx on public.horas_trabalho (propriedade_id, "data" desc);
create index if not exists horas_trabalho_funcionario_id_idx on public.horas_trabalho ("funcionario_id");
alter table public.horas_trabalho enable row level security;
drop policy if exists horas_trabalho_manutencao on public.horas_trabalho;
create policy horas_trabalho_manutencao on public.horas_trabalho as restrictive to authenticated
  using (not private.acesso_negado('fazenda')) with check (not private.acesso_negado('fazenda'));
drop policy if exists horas_trabalho_minhas on public.horas_trabalho;
create policy horas_trabalho_minhas on public.horas_trabalho for all to authenticated
  using (propriedade_id in (select private.minhas_propriedades()))
  with check (propriedade_id in (select private.minhas_propriedades()));
revoke all on public.horas_trabalho from anon;
grant select, insert, update, delete on public.horas_trabalho to authenticated;
drop trigger if exists set_horas_trabalho_updated_at on public.horas_trabalho;
create trigger set_horas_trabalho_updated_at before update on public.horas_trabalho for each row execute function public.set_updated_at();

-- Cotações do mercado — Preço da arroba, do leite, do milho... com histórico e variação
create table if not exists public.cotacoes (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  "produto" text not null,
  "produto_outro" text,
  "data" date default private.hoje_br() not null,
  "preco" numeric(14,2) not null,
  "praca" text,
  "fonte" text,
  "obs" text,
  constraint preco_valido check ("preco" is null or ("preco" >= 0)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists cotacoes_prop_data_idx on public.cotacoes (propriedade_id, "data" desc);
alter table public.cotacoes enable row level security;
drop policy if exists cotacoes_manutencao on public.cotacoes;
create policy cotacoes_manutencao on public.cotacoes as restrictive to authenticated
  using (not private.acesso_negado('fazenda')) with check (not private.acesso_negado('fazenda'));
drop policy if exists cotacoes_minhas on public.cotacoes;
create policy cotacoes_minhas on public.cotacoes for all to authenticated
  using (propriedade_id in (select private.minhas_propriedades()))
  with check (propriedade_id in (select private.minhas_propriedades()));
revoke all on public.cotacoes from anon;
grant select, insert, update, delete on public.cotacoes to authenticated;
drop trigger if exists set_cotacoes_updated_at on public.cotacoes;
create trigger set_cotacoes_updated_at before update on public.cotacoes for each row execute function public.set_updated_at();

-- Talhões e áreas — Áreas de cultivo da propriedade
create table if not exists public.talhoes (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  "nome" text not null,
  "area_ha" numeric not null,
  "solo" text,
  "situacao" text default 'Livre',
  "obs" text,
  constraint area_ha_valido check ("area_ha" is null or ("area_ha" >= 0)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists talhoes_prop_idx on public.talhoes (propriedade_id);
alter table public.talhoes enable row level security;
drop policy if exists talhoes_manutencao on public.talhoes;
create policy talhoes_manutencao on public.talhoes as restrictive to authenticated
  using (not private.acesso_negado('agricultura')) with check (not private.acesso_negado('agricultura'));
drop policy if exists talhoes_minhas on public.talhoes;
create policy talhoes_minhas on public.talhoes for all to authenticated
  using (propriedade_id in (select private.minhas_propriedades()))
  with check (propriedade_id in (select private.minhas_propriedades()));
revoke all on public.talhoes from anon;
grant select, insert, update, delete on public.talhoes to authenticated;
drop trigger if exists set_talhoes_updated_at on public.talhoes;
create trigger set_talhoes_updated_at before update on public.talhoes for each row execute function public.set_updated_at();

-- Plantios e safras — Cultura, safra, colheita prevista e produtividade
create table if not exists public.plantios (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  "talhao_id" uuid references public.talhoes(id) on delete cascade not null,
  "cultura" text not null,
  "variedade" text,
  "safra" text not null,
  "area_ha" numeric,
  "plantio_data" date,
  "colheita_prevista" date,
  "status" text default 'Planejado' not null,
  "producao_esperada" numeric,
  "obs" text,
  constraint area_ha_valido check ("area_ha" is null or ("area_ha" >= 0)),
  constraint producao_esperada_valido check ("producao_esperada" is null or ("producao_esperada" >= 0)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists plantios_prop_data_idx on public.plantios (propriedade_id, "colheita_prevista" desc);
create index if not exists plantios_talhao_id_idx on public.plantios ("talhao_id");
alter table public.plantios enable row level security;
drop policy if exists plantios_manutencao on public.plantios;
create policy plantios_manutencao on public.plantios as restrictive to authenticated
  using (not private.acesso_negado('agricultura')) with check (not private.acesso_negado('agricultura'));
drop policy if exists plantios_minhas on public.plantios;
create policy plantios_minhas on public.plantios for all to authenticated
  using (propriedade_id in (select private.minhas_propriedades()))
  with check (propriedade_id in (select private.minhas_propriedades()));
revoke all on public.plantios from anon;
grant select, insert, update, delete on public.plantios to authenticated;
drop trigger if exists set_plantios_updated_at on public.plantios;
create trigger set_plantios_updated_at before update on public.plantios for each row execute function public.set_updated_at();

-- Irrigação e água — Sistemas, reservatórios, fontes e manutenção
create table if not exists public.irrig_sistemas (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  "nome" text not null,
  "tipo" text not null,
  "fonte" text,
  "capacidade" numeric,
  "area_ha" numeric,
  "situacao" text default 'Funcionando',
  "obs" text,
  constraint capacidade_valido check ("capacidade" is null or ("capacidade" >= 0)),
  constraint area_ha_valido check ("area_ha" is null or ("area_ha" >= 0)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists irrig_sistemas_prop_idx on public.irrig_sistemas (propriedade_id);
alter table public.irrig_sistemas enable row level security;
drop policy if exists irrig_sistemas_manutencao on public.irrig_sistemas;
create policy irrig_sistemas_manutencao on public.irrig_sistemas as restrictive to authenticated
  using (not private.acesso_negado('agricultura')) with check (not private.acesso_negado('agricultura'));
drop policy if exists irrig_sistemas_minhas on public.irrig_sistemas;
create policy irrig_sistemas_minhas on public.irrig_sistemas for all to authenticated
  using (propriedade_id in (select private.minhas_propriedades()))
  with check (propriedade_id in (select private.minhas_propriedades()));
revoke all on public.irrig_sistemas from anon;
grant select, insert, update, delete on public.irrig_sistemas to authenticated;
drop trigger if exists set_irrig_sistemas_updated_at on public.irrig_sistemas;
create trigger set_irrig_sistemas_updated_at before update on public.irrig_sistemas for each row execute function public.set_updated_at();

-- Registros de irrigação — Quando, onde e quanto de água foi usada
create table if not exists public.irrigacoes (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  "sistema_id" uuid references public.irrig_sistemas(id) on delete cascade not null,
  "data" date default private.hoje_br() not null,
  "talhao_id" uuid references public.talhoes(id) on delete set null,
  "horas" numeric,
  "volume" numeric,
  "obs" text,
  constraint horas_valido check ("horas" is null or ("horas" >= 0)),
  constraint volume_valido check ("volume" is null or ("volume" >= 0)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists irrigacoes_prop_data_idx on public.irrigacoes (propriedade_id, "data" desc);
create index if not exists irrigacoes_sistema_id_idx on public.irrigacoes ("sistema_id");
create index if not exists irrigacoes_talhao_id_idx on public.irrigacoes ("talhao_id");
alter table public.irrigacoes enable row level security;
drop policy if exists irrigacoes_manutencao on public.irrigacoes;
create policy irrigacoes_manutencao on public.irrigacoes as restrictive to authenticated
  using (not private.acesso_negado('agricultura')) with check (not private.acesso_negado('agricultura'));
drop policy if exists irrigacoes_minhas on public.irrigacoes;
create policy irrigacoes_minhas on public.irrigacoes for all to authenticated
  using (propriedade_id in (select private.minhas_propriedades()))
  with check (propriedade_id in (select private.minhas_propriedades()));
revoke all on public.irrigacoes from anon;
grant select, insert, update, delete on public.irrigacoes to authenticated;
drop trigger if exists set_irrigacoes_updated_at on public.irrigacoes;
create trigger set_irrigacoes_updated_at before update on public.irrigacoes for each row execute function public.set_updated_at();

-- Manutenção da irrigação — Reparos e revisões dos sistemas de água
create table if not exists public.irrig_manut (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  "sistema_id" uuid references public.irrig_sistemas(id) on delete cascade not null,
  "tipo" text default 'Preventiva',
  "data" date default private.hoje_br() not null,
  "descricao" text not null,
  "valor" numeric(14,2),
  "proxima_data" date,
  "obs" text,
  constraint valor_valido check ("valor" is null or ("valor" >= 0)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists irrig_manut_prop_data_idx on public.irrig_manut (propriedade_id, "data" desc);
create index if not exists irrig_manut_sistema_id_idx on public.irrig_manut ("sistema_id");
alter table public.irrig_manut enable row level security;
drop policy if exists irrig_manut_manutencao on public.irrig_manut;
create policy irrig_manut_manutencao on public.irrig_manut as restrictive to authenticated
  using (not private.acesso_negado('agricultura')) with check (not private.acesso_negado('agricultura'));
drop policy if exists irrig_manut_minhas on public.irrig_manut;
create policy irrig_manut_minhas on public.irrig_manut for all to authenticated
  using (propriedade_id in (select private.minhas_propriedades()))
  with check (propriedade_id in (select private.minhas_propriedades()));
revoke all on public.irrig_manut from anon;
grant select, insert, update, delete on public.irrig_manut to authenticated;
drop trigger if exists set_irrig_manut_updated_at on public.irrig_manut;
create trigger set_irrig_manut_updated_at before update on public.irrig_manut for each row execute function public.set_updated_at();

-- Clima observado — Chuva, temperatura e eventos (geada, granizo, estiagem)
create table if not exists public.clima_obs (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  "data" date default private.hoje_br() not null,
  "chuva_mm" numeric,
  "temp_min" numeric,
  "temp_max" numeric,
  "evento" text default 'Nenhum',
  "obs" text,
  constraint chuva_mm_valido check ("chuva_mm" is null or ("chuva_mm" >= 0)),
  constraint temp_min_valido check ("temp_min" is null or ("temp_min" >= -20 and "temp_min" <= 60)),
  constraint temp_max_valido check ("temp_max" is null or ("temp_max" >= -20 and "temp_max" <= 60)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists clima_obs_prop_data_idx on public.clima_obs (propriedade_id, "data" desc);
alter table public.clima_obs enable row level security;
drop policy if exists clima_obs_manutencao on public.clima_obs;
create policy clima_obs_manutencao on public.clima_obs as restrictive to authenticated
  using (not private.acesso_negado('agricultura')) with check (not private.acesso_negado('agricultura'));
drop policy if exists clima_obs_minhas on public.clima_obs;
create policy clima_obs_minhas on public.clima_obs for all to authenticated
  using (propriedade_id in (select private.minhas_propriedades()))
  with check (propriedade_id in (select private.minhas_propriedades()));
revoke all on public.clima_obs from anon;
grant select, insert, update, delete on public.clima_obs to authenticated;
drop trigger if exists set_clima_obs_updated_at on public.clima_obs;
create trigger set_clima_obs_updated_at before update on public.clima_obs for each row execute function public.set_updated_at();

-- Clientes — Quem compra a sua produção
create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  "nome" text not null,
  "telefone" text,
  "cidade" text,
  "ativo" boolean default true,
  "obs" text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists clientes_prop_idx on public.clientes (propriedade_id);
alter table public.clientes enable row level security;
drop policy if exists clientes_manutencao on public.clientes;
create policy clientes_manutencao on public.clientes as restrictive to authenticated
  using (not private.acesso_negado('agricultura')) with check (not private.acesso_negado('agricultura'));
drop policy if exists clientes_minhas on public.clientes;
create policy clientes_minhas on public.clientes for all to authenticated
  using (propriedade_id in (select private.minhas_propriedades()))
  with check (propriedade_id in (select private.minhas_propriedades()));
revoke all on public.clientes from anon;
grant select, insert, update, delete on public.clientes to authenticated;
drop trigger if exists set_clientes_updated_at on public.clientes;
create trigger set_clientes_updated_at before update on public.clientes for each row execute function public.set_updated_at();

-- Estoque — Ração, sal, vacinas, remédios, insumos e peças
create table if not exists public.estoque_itens (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  "nome" text not null,
  "categoria" text not null,
  "unidade" text default 'un' not null,
  "minimo" numeric,
  "preco_ref" numeric(14,2),
  "fornecedor_id" uuid references public.fornecedores(id) on delete set null,
  "fabricante" text,
  "conservacao" text,
  "controla_validade" boolean default false,
  "ativo" boolean default true,
  "obs" text,
  constraint minimo_valido check ("minimo" is null or ("minimo" >= 0)),
  constraint preco_ref_valido check ("preco_ref" is null or ("preco_ref" >= 0)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists estoque_itens_prop_idx on public.estoque_itens (propriedade_id);
create index if not exists estoque_itens_fornecedor_id_idx on public.estoque_itens ("fornecedor_id");
alter table public.estoque_itens enable row level security;
drop policy if exists estoque_itens_manutencao on public.estoque_itens;
create policy estoque_itens_manutencao on public.estoque_itens as restrictive to authenticated
  using (not private.acesso_negado('pecuaria')) with check (not private.acesso_negado('pecuaria'));
drop policy if exists estoque_itens_minhas on public.estoque_itens;
create policy estoque_itens_minhas on public.estoque_itens for all to authenticated
  using (propriedade_id in (select private.minhas_propriedades()))
  with check (propriedade_id in (select private.minhas_propriedades()));
revoke all on public.estoque_itens from anon;
grant select, insert, update, delete on public.estoque_itens to authenticated;
drop trigger if exists set_estoque_itens_updated_at on public.estoque_itens;
create trigger set_estoque_itens_updated_at before update on public.estoque_itens for each row execute function public.set_updated_at();

-- Entradas e saídas — Compras, usos, perdas, devoluções e inventário
create table if not exists public.estoque_mov (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  "item_id" uuid references public.estoque_itens(id) on delete cascade not null,
  "tipo" text default 'Entrada (compra)' not null,
  "data" date default private.hoje_br() not null,
  "qtd" numeric not null,
  "valor_total" numeric(14,2),
  "lote_produto" text,
  "fabricacao" date,
  "validade" date,
  "fornecedor_id" uuid references public.fornecedores(id) on delete set null,
  "motivo" text,
  "animal_id" uuid references public.animais(id) on delete set null,
  "lote_id" uuid references public.lotes(id) on delete set null,
  "plantio_id" uuid references public.plantios(id) on delete set null,
  "maquina_id" uuid references public.maquinas(id) on delete set null,
  "responsavel" text,
  "obs" text,
  constraint valor_total_valido check ("valor_total" is null or ("valor_total" >= 0)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists estoque_mov_prop_data_idx on public.estoque_mov (propriedade_id, "data" desc);
create index if not exists estoque_mov_item_id_idx on public.estoque_mov ("item_id");
create index if not exists estoque_mov_fornecedor_id_idx on public.estoque_mov ("fornecedor_id");
create index if not exists estoque_mov_animal_id_idx on public.estoque_mov ("animal_id");
create index if not exists estoque_mov_lote_id_idx on public.estoque_mov ("lote_id");
create index if not exists estoque_mov_plantio_id_idx on public.estoque_mov ("plantio_id");
create index if not exists estoque_mov_maquina_id_idx on public.estoque_mov ("maquina_id");
alter table public.estoque_mov enable row level security;
drop policy if exists estoque_mov_manutencao on public.estoque_mov;
create policy estoque_mov_manutencao on public.estoque_mov as restrictive to authenticated
  using (not private.acesso_negado('pecuaria')) with check (not private.acesso_negado('pecuaria'));
drop policy if exists estoque_mov_minhas on public.estoque_mov;
create policy estoque_mov_minhas on public.estoque_mov for all to authenticated
  using (propriedade_id in (select private.minhas_propriedades()))
  with check (propriedade_id in (select private.minhas_propriedades()));
revoke all on public.estoque_mov from anon;
grant select, insert, update, delete on public.estoque_mov to authenticated;
drop trigger if exists set_estoque_mov_updated_at on public.estoque_mov;
create trigger set_estoque_mov_updated_at before update on public.estoque_mov for each row execute function public.set_updated_at();

-- Alimentação do rebanho — Ração e sal fornecidos por lote ou animal; baixa no estoque
create table if not exists public.alimentacao (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  "data" date default private.hoje_br() not null,
  "lote_id" uuid references public.lotes(id) on delete set null,
  "animal_id" uuid references public.animais(id) on delete set null,
  "item_id" uuid references public.estoque_itens(id) on delete cascade not null,
  "qtd" numeric not null,
  "cocho" text,
  "mudanca" boolean default false,
  "obs" text,
  constraint qtd_valido check ("qtd" is null or ("qtd" >= 0)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists alimentacao_prop_data_idx on public.alimentacao (propriedade_id, "data" desc);
create index if not exists alimentacao_lote_id_idx on public.alimentacao ("lote_id");
create index if not exists alimentacao_animal_id_idx on public.alimentacao ("animal_id");
create index if not exists alimentacao_item_id_idx on public.alimentacao ("item_id");
alter table public.alimentacao enable row level security;
drop policy if exists alimentacao_manutencao on public.alimentacao;
create policy alimentacao_manutencao on public.alimentacao as restrictive to authenticated
  using (not private.acesso_negado('pecuaria')) with check (not private.acesso_negado('pecuaria'));
drop policy if exists alimentacao_minhas on public.alimentacao;
create policy alimentacao_minhas on public.alimentacao for all to authenticated
  using (propriedade_id in (select private.minhas_propriedades()))
  with check (propriedade_id in (select private.minhas_propriedades()));
revoke all on public.alimentacao from anon;
grant select, insert, update, delete on public.alimentacao to authenticated;
drop trigger if exists set_alimentacao_updated_at on public.alimentacao;
create trigger set_alimentacao_updated_at before update on public.alimentacao for each row execute function public.set_updated_at();

-- Planos alimentares — Quanto cada categoria deve receber (você define)
create table if not exists public.planos_alim (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  "nome" text not null,
  "categoria_animal" text,
  "lote_id" uuid references public.lotes(id) on delete set null,
  "item_id" uuid references public.estoque_itens(id) on delete cascade not null,
  "qtd_animal_dia" numeric not null,
  "inicio" date default private.hoje_br(),
  "fim" date,
  "orientacao" text,
  "ativo" boolean default true,
  constraint qtd_animal_dia_valido check ("qtd_animal_dia" is null or ("qtd_animal_dia" >= 0)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists planos_alim_prop_data_idx on public.planos_alim (propriedade_id, "inicio" desc);
create index if not exists planos_alim_lote_id_idx on public.planos_alim ("lote_id");
create index if not exists planos_alim_item_id_idx on public.planos_alim ("item_id");
alter table public.planos_alim enable row level security;
drop policy if exists planos_alim_manutencao on public.planos_alim;
create policy planos_alim_manutencao on public.planos_alim as restrictive to authenticated
  using (not private.acesso_negado('pecuaria')) with check (not private.acesso_negado('pecuaria'));
drop policy if exists planos_alim_minhas on public.planos_alim;
create policy planos_alim_minhas on public.planos_alim for all to authenticated
  using (propriedade_id in (select private.minhas_propriedades()))
  with check (propriedade_id in (select private.minhas_propriedades()));
revoke all on public.planos_alim from anon;
grant select, insert, update, delete on public.planos_alim to authenticated;
drop trigger if exists set_planos_alim_updated_at on public.planos_alim;
create trigger set_planos_alim_updated_at before update on public.planos_alim for each row execute function public.set_updated_at();

-- Sanidade e tratamentos — Vermífugo, doenças, mastite, remédios e orientações do veterinário
create table if not exists public.tratamentos (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  "tipo" text default 'Tratamento' not null,
  "data" date default private.hoje_br() not null,
  "animal_id" uuid references public.animais(id) on delete set null,
  "lote_id" uuid references public.lotes(id) on delete set null,
  "descricao" text not null,
  "medicamento" text,
  "item_id" uuid references public.estoque_itens(id) on delete set null,
  "qtd_usada" numeric,
  "dose" text,
  "via" text,
  "fabricante" text,
  "lote_produto" text,
  "responsavel" text,
  "veterinario" text,
  "carencia_leite" integer,
  "carencia_carne" integer,
  "status" text default 'Em tratamento' not null,
  "retorno" date,
  "custo" numeric(14,2),
  "orientacao" text,
  constraint qtd_usada_valido check ("qtd_usada" is null or ("qtd_usada" >= 0)),
  constraint carencia_leite_valido check ("carencia_leite" is null or ("carencia_leite" >= 0)),
  constraint carencia_carne_valido check ("carencia_carne" is null or ("carencia_carne" >= 0)),
  constraint custo_valido check ("custo" is null or ("custo" >= 0)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tratamentos_prop_data_idx on public.tratamentos (propriedade_id, "data" desc);
create index if not exists tratamentos_animal_id_idx on public.tratamentos ("animal_id");
create index if not exists tratamentos_lote_id_idx on public.tratamentos ("lote_id");
create index if not exists tratamentos_item_id_idx on public.tratamentos ("item_id");
alter table public.tratamentos enable row level security;
drop policy if exists tratamentos_manutencao on public.tratamentos;
create policy tratamentos_manutencao on public.tratamentos as restrictive to authenticated
  using (not private.acesso_negado('pecuaria')) with check (not private.acesso_negado('pecuaria'));
drop policy if exists tratamentos_minhas on public.tratamentos;
create policy tratamentos_minhas on public.tratamentos for all to authenticated
  using (propriedade_id in (select private.minhas_propriedades()))
  with check (propriedade_id in (select private.minhas_propriedades()));
revoke all on public.tratamentos from anon;
grant select, insert, update, delete on public.tratamentos to authenticated;
drop trigger if exists set_tratamentos_updated_at on public.tratamentos;
create trigger set_tratamentos_updated_at before update on public.tratamentos for each row execute function public.set_updated_at();

-- Custos e receitas por atividade — Gastos e ganhos de um animal, lote, pasto, cultura ou máquina
create table if not exists public.lancamentos (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  "tipo" text default 'Despesa' not null,
  "data" date default private.hoje_br() not null,
  "valor" numeric(14,2) not null,
  "categoria" text not null,
  "descricao" text not null,
  "animal_id" uuid references public.animais(id) on delete set null,
  "lote_id" uuid references public.lotes(id) on delete set null,
  "pasto_id" uuid references public.pastos(id) on delete set null,
  "plantio_id" uuid references public.plantios(id) on delete set null,
  "maquina_id" uuid references public.maquinas(id) on delete set null,
  "obs" text,
  constraint valor_valido check ("valor" is null or ("valor" >= 0)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lancamentos_prop_data_idx on public.lancamentos (propriedade_id, "data" desc);
create index if not exists lancamentos_animal_id_idx on public.lancamentos ("animal_id");
create index if not exists lancamentos_lote_id_idx on public.lancamentos ("lote_id");
create index if not exists lancamentos_pasto_id_idx on public.lancamentos ("pasto_id");
create index if not exists lancamentos_plantio_id_idx on public.lancamentos ("plantio_id");
create index if not exists lancamentos_maquina_id_idx on public.lancamentos ("maquina_id");
alter table public.lancamentos enable row level security;
drop policy if exists lancamentos_manutencao on public.lancamentos;
create policy lancamentos_manutencao on public.lancamentos as restrictive to authenticated
  using (not private.acesso_negado('pecuaria')) with check (not private.acesso_negado('pecuaria'));
drop policy if exists lancamentos_minhas on public.lancamentos;
create policy lancamentos_minhas on public.lancamentos for all to authenticated
  using (propriedade_id in (select private.minhas_propriedades()))
  with check (propriedade_id in (select private.minhas_propriedades()));
revoke all on public.lancamentos from anon;
grant select, insert, update, delete on public.lancamentos to authenticated;
drop trigger if exists set_lancamentos_updated_at on public.lancamentos;
create trigger set_lancamentos_updated_at before update on public.lancamentos for each row execute function public.set_updated_at();

-- Pedidos de compra — O que foi pedido, entrega e pagamento
create table if not exists public.pedidos_compra (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  "fornecedor_id" uuid references public.fornecedores(id) on delete cascade not null,
  "data" date default private.hoje_br() not null,
  "descricao" text not null,
  "item_id" uuid references public.estoque_itens(id) on delete set null,
  "qtd" numeric,
  "valor" numeric(14,2),
  "entrega_prevista" date,
  "status" text default 'Pedido' not null,
  "pagamento" text default 'Pendente' not null,
  "vencimento_pgto" date,
  "obs" text,
  constraint qtd_valido check ("qtd" is null or ("qtd" >= 0)),
  constraint valor_valido check ("valor" is null or ("valor" >= 0)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pedidos_compra_prop_data_idx on public.pedidos_compra (propriedade_id, "data" desc);
create index if not exists pedidos_compra_fornecedor_id_idx on public.pedidos_compra ("fornecedor_id");
create index if not exists pedidos_compra_item_id_idx on public.pedidos_compra ("item_id");
alter table public.pedidos_compra enable row level security;
drop policy if exists pedidos_compra_manutencao on public.pedidos_compra;
create policy pedidos_compra_manutencao on public.pedidos_compra as restrictive to authenticated
  using (not private.acesso_negado('fazenda')) with check (not private.acesso_negado('fazenda'));
drop policy if exists pedidos_compra_minhas on public.pedidos_compra;
create policy pedidos_compra_minhas on public.pedidos_compra for all to authenticated
  using (propriedade_id in (select private.minhas_propriedades()))
  with check (propriedade_id in (select private.minhas_propriedades()));
revoke all on public.pedidos_compra from anon;
grant select, insert, update, delete on public.pedidos_compra to authenticated;
drop trigger if exists set_pedidos_compra_updated_at on public.pedidos_compra;
create trigger set_pedidos_compra_updated_at before update on public.pedidos_compra for each row execute function public.set_updated_at();

-- Atividades da lavoura — Preparo, plantio, adubação, aplicações e colheita
create table if not exists public.atividades_agro (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  "plantio_id" uuid references public.plantios(id) on delete cascade not null,
  "tipo" text default 'Adubação' not null,
  "data" date default private.hoje_br() not null,
  "descricao" text,
  "item_id" uuid references public.estoque_itens(id) on delete set null,
  "qtd" numeric,
  "praga" text,
  "colhido_kg" numeric,
  "perda_kg" numeric,
  "entrada_item_id" uuid references public.estoque_itens(id) on delete set null,
  "custo" numeric(14,2),
  "obs" text,
  constraint qtd_valido check ("qtd" is null or ("qtd" >= 0)),
  constraint colhido_kg_valido check ("colhido_kg" is null or ("colhido_kg" >= 0)),
  constraint perda_kg_valido check ("perda_kg" is null or ("perda_kg" >= 0)),
  constraint custo_valido check ("custo" is null or ("custo" >= 0)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists atividades_agro_prop_data_idx on public.atividades_agro (propriedade_id, "data" desc);
create index if not exists atividades_agro_plantio_id_idx on public.atividades_agro ("plantio_id");
create index if not exists atividades_agro_item_id_idx on public.atividades_agro ("item_id");
create index if not exists atividades_agro_entrada_item_id_idx on public.atividades_agro ("entrada_item_id");
alter table public.atividades_agro enable row level security;
drop policy if exists atividades_agro_manutencao on public.atividades_agro;
create policy atividades_agro_manutencao on public.atividades_agro as restrictive to authenticated
  using (not private.acesso_negado('agricultura')) with check (not private.acesso_negado('agricultura'));
drop policy if exists atividades_agro_minhas on public.atividades_agro;
create policy atividades_agro_minhas on public.atividades_agro for all to authenticated
  using (propriedade_id in (select private.minhas_propriedades()))
  with check (propriedade_id in (select private.minhas_propriedades()));
revoke all on public.atividades_agro from anon;
grant select, insert, update, delete on public.atividades_agro to authenticated;
drop trigger if exists set_atividades_agro_updated_at on public.atividades_agro;
create trigger set_atividades_agro_updated_at before update on public.atividades_agro for each row execute function public.set_updated_at();

-- Vendas da produção — Pedidos, reservas, entregas e pagamentos
create table if not exists public.pedidos_venda (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  "cliente_id" uuid references public.clientes(id) on delete cascade not null,
  "data" date default private.hoje_br() not null,
  "produto" text not null,
  "item_id" uuid references public.estoque_itens(id) on delete set null,
  "qtd" numeric not null,
  "unidade" text,
  "preco_unit" numeric(14,2),
  "entrega_prevista" date,
  "status" text default 'Reservado' not null,
  "pagamento" text default 'Pendente' not null,
  "obs" text,
  constraint qtd_valido check ("qtd" is null or ("qtd" >= 0)),
  constraint preco_unit_valido check ("preco_unit" is null or ("preco_unit" >= 0)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pedidos_venda_prop_data_idx on public.pedidos_venda (propriedade_id, "data" desc);
create index if not exists pedidos_venda_cliente_id_idx on public.pedidos_venda ("cliente_id");
create index if not exists pedidos_venda_item_id_idx on public.pedidos_venda ("item_id");
alter table public.pedidos_venda enable row level security;
drop policy if exists pedidos_venda_manutencao on public.pedidos_venda;
create policy pedidos_venda_manutencao on public.pedidos_venda as restrictive to authenticated
  using (not private.acesso_negado('agricultura')) with check (not private.acesso_negado('agricultura'));
drop policy if exists pedidos_venda_minhas on public.pedidos_venda;
create policy pedidos_venda_minhas on public.pedidos_venda for all to authenticated
  using (propriedade_id in (select private.minhas_propriedades()))
  with check (propriedade_id in (select private.minhas_propriedades()));
revoke all on public.pedidos_venda from anon;
grant select, insert, update, delete on public.pedidos_venda to authenticated;
drop trigger if exists set_pedidos_venda_updated_at on public.pedidos_venda;
create trigger set_pedidos_venda_updated_at before update on public.pedidos_venda for each row execute function public.set_updated_at();


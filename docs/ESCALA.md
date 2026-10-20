# Escala: Apecuária Digital — suporte a milhões de registros

Estratégia: **nada é somado, filtrado nem "paginado" no navegador**. O que pode ser feito no banco é feito no banco,
com índice. Este documento diz o que foi feito, o que foi **medido** e o que **não** foi testado.

## Arquitetura

```
React (TanStack Start)  ──►  PostgREST (Supabase)  ──►  PostgreSQL
  usePagedRows                RPC: dashboard_resumo      índices compostos + trigram
  VirtualTable                RPC: relatorio_indicadores constraints NOT VALID
  import em lote retomável    RPC: app_sincronizar       triggers idempotentes
  (sem fetch de tabelas)      RPC: app_diagnostico       RLS por propriedade
```

## O que cada migração faz

| Arquivo | Conteúdo |
| --- | --- |
| `20260923000001_scale_indices_e_moeda.sql` | Índices compostos `(propriedade_id, created_at DESC, id DESC)` e de filtro, FKs extra, índice único parcial `uq_movimentacoes_origem` + reparo de duplicatas financeiras. *(O alargamento de colunas monetárias que existia aqui foi removido: o `ALTER COLUMN … TYPE` falhava por causa das views e da coluna gerada `valor_total`, e `numeric(14,2)` já comporta o necessário.)* |
| `20260923000002_integridade.sql` | Constraints `NOT VALID` (datas futuras, vaca≠bezerro, categorias/descrições vazias) + função `registros_inconsistentes` que **lista, não apaga**. |
| `20260923000003_financeiro_triggers_idempotentes.sql` | `private.sincronizar_operacao_financeira()` reescrita: upsert sempre por `(origem_tipo, origem_id)` — retries não duplicam. |
| `20260923000004_agregacoes_e_diagnostico.sql` | `dashboard_resumo` estendida, `relatorio_indicadores(_de,_ate)`, `diagnostico_propriedade`, views `v_financeiro_por_categoria`/`v_producao_por_lote`, tabela `importacoes` (retomável). |
| `20260923000005_rls_auditoria.sql` | Correção de RLS (abaixo) + auditoria `v_rls_auditoria`, reforço anon/RLS. |
| `20260923000006_contas_premium.sql` | Contas, planos e Premium (ver `docs/PREMIUM.md`). |
| **`20261020000001_escala_e_sincronizacao_app.sql`** | **Novo.** Índices `(propriedade_id, updated_at, id)` nas 13 tabelas sincronizáveis; índices trigram para a busca de anotações; tabela `registros_excluidos` + gatilhos; funções `app_sincronizar` e `app_diagnostico`. Detalhes em `docs/APP.md`. |

## Correções feitas ao revisar a cadeia de migrações

A cadeia original **não conseguia ser aplicada do zero** (seis arquivos falhavam num PostgreSQL 16 real: cinco por defeito
próprio e `20260924000007_entrega_perfil.sql`, que só falhava por depender deles) e deixava a criação de propriedades
quebrada. Cada migração é aplicada numa transação e a cadeia para no primeiro erro, como no Supabase. Corrigido, com o motivo de cada ponto escrito no próprio arquivo:

1. `_001`: `ALTER COLUMN … TYPE` em colunas usadas por views/coluna gerada; `MIN(uuid)` (não existe) → `(array_agg(id ORDER BY created_at, id))[1]`.
2. `_002`: `ADD CONSTRAINT IF NOT EXISTS` **não existe** no PostgreSQL (erro de sintaxe) → `DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT`; chamada a `public.tem_acesso_propriedade` (a função está em `private`); `registros_inconsistentes` marcava como erro **toda** vacinação (`animal_id IS NULL OR lote_id IS NULL`, e uma das duas colunas é sempre nula) — agora só as que não têm nenhum dos dois.
3. `_004`: cinco chamadas a `public.tem_acesso_propriedade`.
4. `_005`: as políticas de `propriedades` chamavam uma função `STABLE`. O site cria a propriedade com `INSERT … RETURNING`; o `RETURNING` avalia a política de SELECT sobre a linha recém-criada, e uma função `STABLE` não enxerga essa linha → *"new row violates row-level security policy"*. É o erro que a migração `20260917010147` já tinha corrigido e que esta reintroduzia. As políticas agora são "inline" (dono **ou** membro), sem função.
5. `_006`: políticas do bucket de storage sem `TO authenticated`/`DROP IF EXISTS`, e `ALTER TABLE storage.objects` exige ser dono da tabela (agora protegido).

## Como aplicar

```bash
supabase db push   # aplica as migrações pendentes, na ordem do nome do arquivo
```

- **Faça backup antes** (Supabase → Database → Backups) e teste primeiro numa cópia/projeto de teste.
- Não sei quais migrações o seu projeto já aplicou (o histórico fica no banco, em `supabase_migrations.schema_migrations`; veja com `supabase migration list`). O `supabase db push` só roda as que faltam. Como as versões antigas de `_001`, `_002`, `_004`, `_005` e `_006` **não rodavam do zero**, é possível que o projeto tenha aplicado só parte delas ou que as tenha corrigido à mão: se alguma já consta como aplicada, **não a reaplique**; aplique só as que faltam (no mínimo a `20261020000001`) e confira se criar propriedade no site funciona.
- `CREATE INDEX` comum **trava escritas** na tabela enquanto roda. Em tabelas ainda pequenas é instantâneo. Em uma fazenda que já tem milhões de linhas, crie os índices antes, fora da migração, com `CREATE INDEX CONCURRENTLY` (mesmos nomes; a migração usa `IF NOT EXISTS` e vai pular).
- Custo permanente: cada índice novo ocupa espaço (com 5,3 mi de anotações: sync ≈ 298 MB; trigram ≈ 435 MB no teste) e soma um pouco a cada gravação.

## Medições (PostgreSQL 16 local, 5,3 milhões de anotações numa fazenda)

Dados em cache, máquina de 2 vCPU. **São números de laboratório**, úteis para comparar antes/depois, não promessas de tempo no Supabase.

| Consulta | Antes | Depois |
| --- | ---: | ---: |
| Lista: página 1 (25 linhas) | 1,6 ms | 2,8 ms |
| Lista: página 100.000 (`OFFSET` de 2,5 mi) | 326 ms | 312 ms |
| Contagem exata da fazenda | 277 ms | 259 ms |
| Busca (3 colunas): 1ª página, termo comum | 2,2 ms | 1,6 ms |
| Busca: 1ª página, termo raro | 3.831 ms | 716 ms |
| Busca: contagem exata, termo comum | 3.023 ms | 2.427 ms |
| Sincronização: "mudou nas últimas 24 h" | 576 ms | 0,8 ms |
| Sincronização: primeira carga (1000 linhas) | 662 ms | 0,4 ms |
| Sincronização: página 3000 por `OFFSET` | 1.590 ms | 264 ms |
| `app_sincronizar` com RLS (1ª / meio / incremental) | — | 7,6 / 4,7 / 4,6 ms |

O que isso diz: a listagem do site já era rápida (índice `(propriedade_id, created_at, id)`); o que estava lento era
**sincronizar** e **buscar texto**, e isso o banco agora resolve. A contagem **exata** cresce linearmente com a tabela
(≈ 0,26 s para 5 milhões); por isso o site mostra a lista primeiro e conta em segundo plano.

**Não medido:** cache frio (disco), Supabase real (rede, PostgREST, pool de conexões), 10 milhões de linhas
(extrapolado, não rodado), o app (o código-fonte dele não estava disponível).

## Frontend servido do banco

- `src/lib/pagination.ts` — intervalo `.range()` e lógica de páginas (puras, testadas).
- `src/lib/busca.ts` — monta o filtro `.or(...)` de busca. O termo vai **entre aspas** para o PostgREST (uma vírgula ou
  parêntese digitado, como em "Silva, João", quebrava o filtro) e os curingas do `ILIKE` são escapados. Testado.
- `src/lib/datas.ts` — datas de calendário sem erro de fuso (`new Date().toISOString().slice(0,10)` devolvia o dia
  **seguinte** depois das 21h no Brasil). Testado.
- `src/lib/fetchAll.ts` — lê em blocos de 1000; avisa quando o teto (20.000) corta a lista. Quem pagina com `range`
  precisa de ordem total (`order(col).order("id")`).
- `src/lib/importParser.ts` — CSV/TSV/JSON defensivo: detecta `;` (Excel em português), ignora linhas em branco no
  fim, normaliza cabeçalhos ("Número do brinco" → `numero_do_brinco`) e os liga aos campos do cadastro
  (`buildAliases`/`remapHeaders`).
- `src/lib/validate.ts` — normaliza/valida linhas: apara espaços, só aceita datas que existem (31/02 é recusado),
  números em formato brasileiro, `select` por valor **ou** rótulo, **chave natural de dedupe por tabela**.
- `src/components/app/usePagedRows.ts` — lista e total são consultas separadas (as linhas aparecem sem esperar o
  `count`); busca `ilike` entre aspas; total em cache por 20 s.
- `src/components/app/ImportDialog.tsx` — importação em lote (100 linhas) retomável: só divide o lote em erro de
  **dados** (`21/22/23`); erro de rede/permissão **pausa** e retoma do ponto exato; progresso gravado a cada lote.
- `src/components/app/Reports.tsx` — leituras com ordem total e **aviso** quando o período passa de 20.000 registros.

## Testes

```bash
npm run test                         # vitest: parser, validação, datas, busca, paginação, fetchAll…
node scripts/verificar-fontes.mjs    # sintaxe, imports/exports, pacotes e tabelas/funções do Supabase (sem rede)
psql -v ON_ERROR_STOP=1 -d <banco-de-teste> -f testes/banco/smoke.sql   # RLS, gatilhos, sync, exclusões
```

`smoke.sql` precisa de um PostgreSQL **de teste** com as migrações aplicadas e os papéis do Supabase
(`anon`, `authenticated`, `service_role`, `auth.uid()`); roda numa transação e desfaz tudo. **Nunca rode contra produção.**

## Comportamento em escala — o que mudou

| Antes | Agora |
| --- | --- |
| Lista esperava o `count(*)` para aparecer | Lista aparece primeiro; total chega depois |
| Busca quebrava com vírgula/parêntese | Termo entre aspas, curingas escapados |
| Busca varria a tabela | Índices trigram (anotações) |
| Sincronização do app ordenava a fazenda inteira | Índice + cursor `(updated_at, id)` |
| Exclusões descobertas listando todos os ids | `registros_excluidos` |
| Importação: um erro derrubava os 50 vizinhos; falha de rede marcava linhas como "rejeitadas" | Só erro de dados divide o lote; rede pausa e retoma |
| Relatórios: páginas sem ordem total, corte silencioso em 20.000 | Ordem total + aviso |
| Retry de financeiro duplicava | upsert por `(origem_tipo, origem_id)` |
| RLS apontando para `public.*` inexistente | policies e RPC com `private.*` |

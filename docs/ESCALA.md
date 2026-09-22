# Escala: Apecuária Digital — suporte a milhões de registros

O sistema foi preparado para operar com **centenas de milhares e milhões de
registros por módulo**. A estratégia é: **nada é somado, filtrado nem
"paginado" no navegador** — tudo que pode ser feito no banco é feito no banco.

## Arquitetura

```
React (TanStack Start)  ──►  PostgREST (Supabase)  ──►  PostgreSQL
  usePagedRows                RPC: dashboard_resumo      índices compostos
  VirtualTable                RPC: relatorio_indicadores constraints NOT VALID
  import em lote retomável    RPC: diagnostico           triggers idempotentes
  (sem fetch de tabelas)      Vistas agregadas           RLS por propriedade
```

## Migração — o que cada arquivo faz

| Arquivo | Conteúdo |
| --- | --- |
| `20260923000001_scale_indices_e_moeda.sql` | Alarga moeda (`numeric(18,2)` etc.), índices compostos `(propriedade_id, created_at DESC, id DESC)`, FKs extra, índice único parcial `uq_movimentacoes_origem` + reparo de duplicatas financeiras. |
| `20260923000002_integridade.sql` | Constraints `NOT VALID` (datas futuras, vaca≠bezerro, categorias/descrições vazias) + função `registros_inconsistentes` que **lista, não apaga**. |
| `20260923000003_financeiro_triggers_idempotentes.sql` | `private.sincronizar_operacao_financeira()` reescrita: upsert sempre por `(origem_tipo, origem_id)` — retries não duplicam. |
| `20260923000004_agregacoes_e_diagnostico.sql` | `dashboard_resumo` estendida, `relatorio_indicadores(_de,_ate)`, `diagnostico_propriedade`, views `v_financeiro_por_categoria`/`v_producao_por_lote`, tabela `importacoes` (retomável). |
| `20260923000005_rls_auditoria.sql` | **Correção crítica de RLS** (abaixo) + auditoria `v_rls_auditoria`, reforço anon/RLS. |

## Correção crítica de RLS (migração 5)

A migração `20260917002510` moveu `tem_acesso_propriedade` e
`pode_administrar_propriedade` para o schema `private`, mas **todas as
políticas** (`*_all`, `propriedades_*`, `membros_*`, `importacoes_all`) e as
**funções de relatório** continuavam chamando `public.tem_acesso_propriedade`
— função que não existe mais. Resultado: consultas por RLS quebrariam (ou
seriam bloqueadas) em produção.

A migração 5 resolve:
1. Recria as funções em `private` (SECURITY DEFINER, `search_path` idêntico).
2. Recria todas as políticas referenciando `private.*`.
3. Recria `dashboard_resumo`, `relatorio_indicadores`,
   `diagnostico_propriedade` e `registros_inconsistentes` com as referências
   certas.
4. Revoga acesso de `anon` a todas as tabelas de dados.
5. Cria `public.v_rls_auditoria` + `DO $$` que avisa se alguma política expõe
   dados a `anon`/`public`.

## Como rodar

Aplicar na ordem do nome do arquivo (Supabase CLI):

```bash
supabase db push       # aplica 20260923000001..20260923000005
```

Depois, conferências rápidas:

```sql
-- Nenhuma linha sem função (todas as policies apontam para private.*)
SELECT tablename, policyname, qual FROM public.v_rls_auditoria
WHERE qual IS NOT NULL AND qual LIKE '%public%';
```

## Frontend servido do banco

- `src/lib/pagination.ts` — intervalo `.range()` e lógica de páginas (puras,
  testadas).
- `src/lib/importParser.ts` — CSV/TSV/JSON defensivo, BOM, chunks, hash FNV-1a.
- `src/lib/validate.ts` — normaliza/valida linhas + **chave natural de
  dedupe por tabela** + escape de ILIKE.
- `src/components/app/usePagedRows.ts` — contagem exata (`head:true`) e busca
  `ilike` com escape, filtros combinados, tudo no banco; keys de cache
  invalidáveis por prefixo `[tabela, propriedade]`.
- `src/components/app/VirtualTable.tsx` — janelamento no cliente (overscan),
  paginação "1–25 de 1.234", tamanho de página 25/50/100/500/1000.
- `src/components/app/ImportDialog.tsx` — importação em lote retomável,
  progresso, sem duplicação (bisect em violação `23505` + chave natural),
  sem apagar nada.
- `src/components/app/Diagnostics.tsx` — contagens reais, tempos de consulta e
  irregularidades.

### Consistência dos $module

Cada módulo declara:
- `searchColumns` — colunas pesquisadas **no banco** (`ilike` escapado).
- `filters` — filtros por coluna (select → `eq`).
- `impliedFilter` — restrição implícita servida no SQL (ex.: financeiro
  mostra somente lançamentos manuais, `origem_tipo IS NULL`).

Regra: **nunca** incluir `importacoes` nem sequências derivadas nos selects;
tudo é agregado via views/RPC.

## Testes

```bash
npm run test          # vitest (parser, validação, paginação)
npm run build         # verifica tipos (privado no Lovable)
```

Os testes ficam em `src/lib/__tests__/` (ambiente `node`, sem servidor).

## Comportamento em escala — o que mudou

| Antes | Agora |
| --- | --- |
| `SELECT *` + paginação em memória | `.range()` + COUNT exato |
| Busca no navegador (JSON.stringify) | `ilike` no PostgreSQL com escape |
| Soma de milhões no client | `SUM`/`COUNT` em views/RPC |
| Inserção 1×1 no import | batch 50 + bisect em duplicados |
| Retry de financeiro duplicava | upsert por `(origem_tipo, origem_id)` |
| RLS apontando para `public.*` inexistente | policies e RPC com `private.*` |
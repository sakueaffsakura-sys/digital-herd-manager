# Pecuária Digital (site)

Sistema web de gestão pecuária: rebanho, vacinação, inseminação, nascimentos, pesagens, produção de leite,
anotações, compras/vendas, financeiro, relatórios, contas e planos (Premium), com a assistente Yui.
O aplicativo **Apecuaria Digital** (`com.apecuaria.digital`) usa o mesmo banco.

- **Front-end:** TanStack Start + React 19, Tailwind 4, shadcn/Radix, TanStack Query
- **Banco e login:** Supabase (PostgreSQL + RLS). Cada pessoa só enxerga as propriedades de que é dona ou membro.
- **Hospedagem/edição:** projeto conectado ao Lovable (veja `AGENTS.md`: não reescreva o histórico do git).

## Rodar

```bash
bun install        # ou npm install
bun run dev        # vite dev
bun run build
bun run test       # vitest
bun run verificar  # confere sintaxe, imports e nomes de tabelas/funções do Supabase (sem rede)
```

As chaves do Supabase vêm das variáveis de ambiente do projeto. O site usa **só a chave publicável**; a
`service_role` nunca vai para o navegador nem para este repositório.

## Banco de dados

As migrações estão em `supabase/migrations/` e são aplicadas em ordem (`supabase db push`).
**Faça backup e teste numa cópia antes.** Leia `docs/ESCALA.md` (o que cada migração faz, como aplicar, custo dos
índices) antes de aplicar `20261020000001_escala_e_sincronizacao_app.sql`.

Teste do banco (num PostgreSQL **de teste**, nunca em produção):

```bash
psql -v ON_ERROR_STOP=1 -d <banco-de-teste> -f testes/banco/smoke.sql
```

## Documentação

| Arquivo | Assunto |
| --- | --- |
| `docs/APP.md` | **Ligação com o aplicativo**: tabelas e colunas, sincronização por cursor, exclusões, roteiro para "as anotações não aparecem no app" |
| `docs/ESCALA.md` | Milhões de registros: índices, medições, o que foi corrigido nas migrações, como aplicar |
| `docs/PREMIUM.md` | Contas, planos e recursos Premium |
| `docs/CHANGELOG.md` | O que mudou nesta versão e como foi verificado |
| `docs/PROMPT-ORIGINAL.md` | O pedido original que gerou o sistema (antes era o `README.md`) |
| `AGENTS.md`, `ROADMAP.md` | Decisões de arquitetura e próximos passos |

## Estrutura

```
src/
  routes/                 páginas (TanStack Router): /, /app, /admin, /api/yui
  components/app/         telas do sistema (ApecuariaApp, NotesMural, Reports, ImportDialog, …)
  components/ui/          componentes shadcn
  lib/                    regras puras e testáveis (datas, busca, importação, validação, paginação, planos)
  integrations/supabase/  cliente e tipos gerados
supabase/migrations/      esquema, RLS, gatilhos, funções
testes/banco/smoke.sql    teste do banco (RLS, gatilhos, sincronização, exclusões)
scripts/verificar-fontes.mjs
```

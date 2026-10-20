# O que mudou nesta versão (site v3)

Base: `pecuaria-digital-codigo-fonte-v2.zip`. Nada do que já funcionava foi removido.

## Banco de dados (`supabase/migrations/`)

- **A cadeia de migrações não podia ser aplicada do zero** (6 arquivos falhavam num PostgreSQL 16 real: 5 por defeito
  próprio e `20260924000007`, que só falhava por depender deles) e deixava a criação de propriedades quebrada.
  Corrigido: `_001`, `_002`, `_004`, `_005`, `_006` (detalhes em `docs/ESCALA.md`).
- **Nova:** `20261020000001_escala_e_sincronizacao_app.sql` — índices de sincronização, busca por texto (trigram),
  `registros_excluidos`, `app_sincronizar()`, `app_diagnostico()`.
- **Novo:** `testes/banco/smoke.sql` — RLS por usuário/membro/administrador, gatilhos financeiros, `updated_at`,
  paginação por cursor com empates, exclusões, diagnóstico.

## Código do site

| Problema | Correção |
| --- | --- |
| Data "de hoje" saía em UTC: depois das 21h (Brasil) o registro ganhava a data de amanhã; gráficos dos 12 meses podiam errar o mês | `src/lib/datas.ts` (data local), usada em Dashboard, formulários, relatórios; servidor da Yui usa `America/Sao_Paulo` |
| Filtro por data de cadastro cortava o dia à meia-noite UTC (3 h de diferença) | Limites do dia calculados no fuso de quem usa |
| Listas esperavam a contagem exata para aparecer (lento com milhões) | Lista e total separados; "contando…" |
| Busca quebrava com vírgula/parêntese ("Silva, João") | `src/lib/busca.ts` (termo entre aspas, curingas escapados) |
| Importar CSV do Excel em português (`;`) não funcionava; TSV era lido como `;` | Detecção de separador |
| Cabeçalhos "Número do brinco" viravam `numerodobrinco` e nenhuma coluna era reconhecida | `normalizeHeader` + `buildAliases` (aceita rótulo da tela e apelidos como "brinco") |
| Importação: espaços não eram aparados, datas impossíveis (31/02) passavam, `select`/`sim-não` aceitavam lixo | `validate.ts` reescrito |
| Importação: um erro derrubava o lote inteiro; falha de rede virava "linha rejeitada" e a retomada recomeçava do zero; duplicatas dentro do mesmo lote não eram vistas; linhas com animal/lote inexistente eram contadas como válidas; reenviar um lote cuja resposta se perdeu duplicava linhas | `ImportDialog.tsx` (cada linha ganha um `id` e o envio é `ON CONFLICT (id) DO NOTHING`) |
| Importação de anotações recusava a 2ª anotação do dia para o mesmo animal como "duplicada" | Chave natural inclui o texto |
| Relatórios: leitura em páginas sem ordem total (linhas repetidas/puladas) e corte silencioso em 20.000 | Ordem total + aviso na tela |
| `pretty()` trocava `_` por espaço em qualquer texto digitado | Só em códigos do banco |
| `extensaoValida("foto")`, `readableSize`, `sniffImageType` (teste errado) | Corrigidos |

## Como foi verificado (e o que não foi)

Feito:
- **94 testes unitários passando** (rodados com um substituto do vitest, porque o ambiente não alcança o registro do npm; os testes e o código são os do projeto).
- `scripts/verificar-fontes.mjs`: 126 arquivos sem erro de sintaxe, import ou nome de tabela/função.
- Verificação de tipos (TypeScript 6, `strict`) dos módulos puros em `src/lib` sem erros. Para o restante do `src`,
  uma checagem com as bibliotecas externas substituídas por `any` não encontrou erro novo em relação à v2 (checagem fraca).
- Cadeia de migrações aplicada **do zero** em PostgreSQL 16, cada arquivo numa transação, parando no primeiro erro: 0 falhas.
  A nova migração também foi reaplicada (idempotente).
- `smoke.sql` passa; uma versão deliberadamente errada do teste falha, como deveria. `importacao-idempotente.sql` confirma, no PostgreSQL, que reenviar o mesmo lote não duplica e que brinco repetido continua sendo erro.
- Medições com 5,3 milhões de anotações (`docs/ESCALA.md`).

**Não** feito:
- `bun install`, `vite build` e `tsc` do projeto completo (sem acesso ao registro de pacotes).
- Teste contra o **Supabase real** e contra o **PostgREST** (as chamadas HTTP de `docs/APP.md` seguem a documentação, não foram executadas).
- Teste no navegador das telas alteradas (importação, relatórios, anotações).
- Qualquer coisa no **aplicativo**: o código-fonte dele não estava disponível nesta sessão. O problema "anotações do site não aparecem no app" **não foi diagnosticado nem corrigido** — veja `docs/APP.md`, seção 6.

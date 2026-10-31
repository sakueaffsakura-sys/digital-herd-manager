# Ligação com o aplicativo (Apecuaria Digital, `com.apecuaria.digital`)

Este documento descreve **o que o banco do site oferece ao app** e como o app deve usá-lo para ficar
rápido mesmo com milhões de registros. Vale para qualquer cliente (o app atual, um novo, um script).

> **Estado dos testes (leia primeiro).** Tudo aqui foi conferido contra um **PostgreSQL 16 real, local**,
> com um "Supabase de mentira" (papéis `anon`/`authenticated`, `auth.uid()`, RLS). O **PostgREST** (a camada
> HTTP do Supabase) e o **Supabase de verdade** não puderam ser usados. Por isso as chamadas HTTP abaixo
> estão escritas pela documentação do PostgREST, mas **não foram executadas**. Faça o roteiro da seção 8
> com uma conta de teste antes de confiar.

## 1. Regras de acesso (iguais às do site)

- O app entra com **a mesma conta** do site (`/auth/v1/token?grant_type=password`) e usa **somente a chave
  publicável** (`anon`/`publishable`). Nunca a `service_role`.
- Todas as tabelas têm RLS: a pessoa só enxerga propriedades de que é **dona** (`propriedades.proprietario_id`)
  ou **membro** (`propriedade_membros`). Uma conta nova não vê nada até criar a propriedade.
- Toda tabela de dados tem `propriedade_id`. **Toda consulta do app deve filtrar por ele** (além do RLS):
  é isso que permite usar os índices.
- O site e o app escrevem nas **mesmas tabelas**. Não existe "tabela do app" para esses dados.

## 2. Tabelas sincronizáveis

`animais`, `lotes`, `tipos_vacinas`, `vacinacoes`, `inseminacoes`, `nascimentos`, `pesagens`, `producao_leite`,
`anotacoes_producao`, `movimentacoes_financeiras`, `investimentos`, `compras`, `vendas`.

Valores de enumerações: `sexo_animal` = M, F · `situacao_animal` = ativo, vendido, perdido, falecido, transferido ·
`status_inseminacao` = em_andamento, confirmada, falhou, parto_realizado, cancelada · `tipo_movimento` = receita,
despesa, investimento.

Regras do banco que fazem o servidor **recusar** uma gravação (o app deve mostrar o motivo, não perder o dado):
brinco repetido na propriedade (`animais`), nome repetido (`lotes`, `tipos_vacinas`), duas pesagens do mesmo
animal no mesmo dia, mais de um nascimento para o mesmo bezerro, vaca igual ao bezerro, vacinação com animal **e**
lote (ou nenhum dos dois), `proxima_aplicacao` antes da aplicação, `previsao_parto` não posterior à inseminação,
datas mais de 1 dia no futuro, números negativos. Lançamentos de `movimentacoes_financeiras` com `origem_tipo`
preenchido são criados **pelo banco** a partir de compras/vendas: o app não deve duplicá-los nem editá-los.

### Colunas

#### `animais`

| Coluna | Tipo | Obrigatória | Padrão / observação |
| --- | --- | --- | --- |
| `id` | uuid | sim | `gen_random_uuid()` |
| `propriedade_id` | uuid | sim |  |
| `lote_id` | uuid | não |  |
| `numero_brinco` | text | sim |  |
| `nome` | text | não |  |
| `sexo` | sexo_animal | sim |  |
| `raca` | text | não |  |
| `data_nascimento` | date | não |  |
| `mae_id` | uuid | não |  |
| `pai_id` | uuid | não |  |
| `situacao` | situacao_animal | sim | `'ativo'::situacao_animal` |
| `observacoes` | text | não |  |
| `created_at` | timestamp with time zone | sim | `now()` |
| `updated_at` | timestamp with time zone | sim | `now()` |

#### `anotacoes_producao`

| Coluna | Tipo | Obrigatória | Padrão / observação |
| --- | --- | --- | --- |
| `id` | uuid | sim | `gen_random_uuid()` |
| `propriedade_id` | uuid | sim |  |
| `animal_id` | uuid | não |  |
| `lote_id` | uuid | não |  |
| `data` | date | sim | `CURRENT_DATE` |
| `producao` | numeric | não |  |
| `observacao` | text | sim |  |
| `comportamento` | text | não |  |
| `alimentacao` | text | não |  |
| `informacoes_adicionais` | text | não |  |
| `created_at` | timestamp with time zone | sim | `now()` |
| `updated_at` | timestamp with time zone | sim | `now()` |

#### `compras`

| Coluna | Tipo | Obrigatória | Padrão / observação |
| --- | --- | --- | --- |
| `id` | uuid | sim | `gen_random_uuid()` |
| `propriedade_id` | uuid | sim |  |
| `data` | date | sim |  |
| `produto_animal` | text | sim |  |
| `quantidade` | numeric | sim |  |
| `valor` | numeric | sim |  |
| `fornecedor` | text | não |  |
| `categoria` | text | sim |  |
| `observacao` | text | não |  |
| `movimentacao_id` | uuid | não |  |
| `created_at` | timestamp with time zone | sim | `now()` |
| `updated_at` | timestamp with time zone | sim | `now()` |

#### `inseminacoes`

| Coluna | Tipo | Obrigatória | Padrão / observação |
| --- | --- | --- | --- |
| `id` | uuid | sim | `gen_random_uuid()` |
| `propriedade_id` | uuid | sim |  |
| `animal_id` | uuid | sim |  |
| `data_inseminacao` | date | sim |  |
| `reprodutor_semen` | text | sim |  |
| `previsao_parto` | date | sim |  |
| `situacao` | status_inseminacao | sim | `'em_andamento'::status_inseminacao` |
| `observacao` | text | não |  |
| `created_at` | timestamp with time zone | sim | `now()` |
| `updated_at` | timestamp with time zone | sim | `now()` |

#### `investimentos`

| Coluna | Tipo | Obrigatória | Padrão / observação |
| --- | --- | --- | --- |
| `id` | uuid | sim | `gen_random_uuid()` |
| `propriedade_id` | uuid | sim |  |
| `movimentacao_id` | uuid | não |  |
| `descricao` | text | sim |  |
| `categoria` | text | sim |  |
| `valor` | numeric | sim |  |
| `data` | date | sim |  |
| `observacao` | text | não |  |
| `created_at` | timestamp with time zone | sim | `now()` |
| `updated_at` | timestamp with time zone | sim | `now()` |

#### `lotes`

| Coluna | Tipo | Obrigatória | Padrão / observação |
| --- | --- | --- | --- |
| `id` | uuid | sim | `gen_random_uuid()` |
| `propriedade_id` | uuid | sim |  |
| `nome` | text | sim |  |
| `descricao` | text | não |  |
| `finalidade` | text | não |  |
| `ativo` | boolean | sim | `true` |
| `created_at` | timestamp with time zone | sim | `now()` |
| `updated_at` | timestamp with time zone | sim | `now()` |

#### `movimentacoes_financeiras`

| Coluna | Tipo | Obrigatória | Padrão / observação |
| --- | --- | --- | --- |
| `id` | uuid | sim | `gen_random_uuid()` |
| `propriedade_id` | uuid | sim |  |
| `tipo` | tipo_movimento | sim |  |
| `categoria` | text | sim |  |
| `descricao` | text | sim |  |
| `valor` | numeric | sim |  |
| `data` | date | sim |  |
| `origem_tipo` | tipo_operacao | não |  |
| `origem_id` | uuid | não |  |
| `observacao` | text | não |  |
| `created_at` | timestamp with time zone | sim | `now()` |
| `updated_at` | timestamp with time zone | sim | `now()` |

#### `nascimentos`

| Coluna | Tipo | Obrigatória | Padrão / observação |
| --- | --- | --- | --- |
| `id` | uuid | sim | `gen_random_uuid()` |
| `propriedade_id` | uuid | sim |  |
| `vaca_id` | uuid | sim |  |
| `bezerro_id` | uuid | sim |  |
| `data_nascimento` | date | sim |  |
| `sexo` | sexo_animal | sim |  |
| `lote_id` | uuid | não |  |
| `observacoes` | text | não |  |
| `created_at` | timestamp with time zone | sim | `now()` |
| `updated_at` | timestamp with time zone | sim | `now()` |

#### `pesagens`

| Coluna | Tipo | Obrigatória | Padrão / observação |
| --- | --- | --- | --- |
| `id` | uuid | sim | `gen_random_uuid()` |
| `propriedade_id` | uuid | sim |  |
| `animal_id` | uuid | sim |  |
| `data` | date | sim |  |
| `peso_kg` | numeric | sim |  |
| `observacoes` | text | não |  |
| `created_at` | timestamp with time zone | sim | `now()` |
| `updated_at` | timestamp with time zone | sim | `now()` |

#### `producao_leite`

| Coluna | Tipo | Obrigatória | Padrão / observação |
| --- | --- | --- | --- |
| `id` | uuid | sim | `gen_random_uuid()` |
| `propriedade_id` | uuid | sim |  |
| `animal_id` | uuid | sim |  |
| `lote_id` | uuid | não |  |
| `data` | date | sim |  |
| `litros` | numeric | sim |  |
| `valor_litro` | numeric | sim | `0` |
| `valor_total` | numeric | não | gerada: `(litros * valor_litro)` |
| `observacao` | text | não |  |
| `created_at` | timestamp with time zone | sim | `now()` |
| `updated_at` | timestamp with time zone | sim | `now()` |

#### `tipos_vacinas`

| Coluna | Tipo | Obrigatória | Padrão / observação |
| --- | --- | --- | --- |
| `id` | uuid | sim | `gen_random_uuid()` |
| `propriedade_id` | uuid | sim |  |
| `nome` | text | sim |  |
| `intervalo_dias` | integer | não |  |
| `descricao` | text | não |  |
| `ativo` | boolean | sim | `true` |
| `created_at` | timestamp with time zone | sim | `now()` |
| `updated_at` | timestamp with time zone | sim | `now()` |

#### `vacinacoes`

| Coluna | Tipo | Obrigatória | Padrão / observação |
| --- | --- | --- | --- |
| `id` | uuid | sim | `gen_random_uuid()` |
| `propriedade_id` | uuid | sim |  |
| `animal_id` | uuid | não |  |
| `lote_id` | uuid | não |  |
| `tipo_vacina_id` | uuid | sim |  |
| `data_aplicacao` | date | sim |  |
| `proxima_aplicacao` | date | não |  |
| `responsavel` | text | não |  |
| `observacao` | text | não |  |
| `created_at` | timestamp with time zone | sim | `now()` |
| `updated_at` | timestamp with time zone | sim | `now()` |

#### `vendas`

| Coluna | Tipo | Obrigatória | Padrão / observação |
| --- | --- | --- | --- |
| `id` | uuid | sim | `gen_random_uuid()` |
| `propriedade_id` | uuid | sim |  |
| `data` | date | sim |  |
| `animal_id` | uuid | não |  |
| `item` | text | sim |  |
| `quantidade` | numeric | sim |  |
| `valor` | numeric | sim |  |
| `comprador` | text | não |  |
| `categoria` | text | sim |  |
| `observacao` | text | não |  |
| `movimentacao_id` | uuid | não |  |
| `created_at` | timestamp with time zone | sim | `now()` |
| `updated_at` | timestamp with time zone | sim | `now()` |

## 3. Baixar dados: o que mudou e por quê

### Como era (e por que fica lento)

Baixar "o que mudou" com `updated_at >= cursor` ordenado por `updated_at`, sem índice, obriga o banco a
percorrer e **ordenar a fazenda inteira** a cada chamada. E paginar com `offset` fica mais lento a cada página.
Medido com 5,3 milhões de anotações numa fazenda (máquina de teste, dados em cache):

| Consulta | Antes | Depois da migração `20261020000001` |
| --- | ---: | ---: |
| 1000 linhas mais antigas por `updated_at` (primeira carga) | 662 ms | **0,4 ms** |
| "mudou nas últimas 24 h" (1000 linhas) | 576 ms | **0,8 ms** |
| Página 3000 da primeira carga (`offset` de 3 milhões) | 1.590 ms | **264 ms** (com cursor, uma página do meio da tabela leva **4,7 ms**) |
| `app_sincronizar` com RLS, 1ª página / página do meio / incremental | — | **7,6 / 4,7 / 4,6 ms** |

### Como fazer agora: `app_sincronizar` (cursor `updated_at` + `id`)

```http
POST /rest/v1/rpc/app_sincronizar
{ "p_tabela": "anotacoes_producao",
  "p_propriedade_id": "<uuid da propriedade>",
  "p_apos_updated_at": "<updated_at da última linha recebida>",   // null na primeira carga
  "p_apos_id": "<id da última linha recebida>",                    // null na primeira carga
  "p_limite": 1000 }                                               // máximo 1000
```

Resposta: lista de objetos JSON com **todas as colunas** da tabela, ordenados por `(updated_at, id)`.

Regras para o app:

1. **O cursor é o `(updated_at, id)` da última linha recebida** do servidor. **Nunca** o relógio do aparelho:
   com o relógio adiantado alguns minutos, tudo o que o site criou nesse intervalo seria pulado para sempre.
2. Continue pedindo páginas até vir **menos** linhas do que `p_limite`. Guarde o cursor **depois** de gravar
   a página no aparelho, não antes.
3. O `id` no cursor resolve o empate de `updated_at` (importações em massa criam muitas linhas com o mesmo
   horário). Paginar só por `updated_at` com `limit` trava ou pula linhas quando há mais empates que a página.
4. Um aparelho que ficou **muito tempo** parado só precisa continuar do cursor; não precisa recomeçar.
5. **Janela de segurança:** uma transação demorada (importação grande) grava `updated_at` = hora em que
   **começou**, mas só fica visível quando **termina**. Se o app já tinha avançado o cursor além dessa hora, as
   linhas ficam para trás. Ao iniciar cada rodada, volte o cursor **2 minutos** (`updated_at - 2 min`, `id` nulo)
   e aplique as linhas **de forma idempotente** (gravar por `id`). O custo é baixo: poucas linhas repetidas.
6. Primeira carga de uma fazenda enorme: mostre a tela já com o que chegou e continue em segundo plano; baixe
   em ordem e grave em lotes (IndexedDB aguenta, mas uma transação por linha não).

Os mesmos filtros pelo caminho "normal" do PostgREST (`GET /rest/v1/anotacoes_producao?propriedade_id=eq.…&updated_at=gte.…`)
continuam funcionando e agora usam o índice, mas **não têm** a comparação em par `(updated_at, id)`; por isso a
função é o caminho recomendado.

## 4. Exclusões feitas no site

Antes, o app descobria exclusões listando **todos os ids** da fazenda e comparando (com 10 milhões de anotações
são ~400 MB de ids). Agora cada `DELETE` nas tabelas da seção 2 grava uma linha em `registros_excluidos`:

```http
GET /rest/v1/registros_excluidos?propriedade_id=eq.<uuid>&excluido_em=gte.<cursor menos 2 min>&order=excluido_em.asc,id.asc&limit=1000
→ [{ "id": 12, "tabela": "anotacoes_producao", "registro_id": "<uuid>", "excluido_em": "…" }]
```

- Para cada linha, apague `registro_id` da tabela `tabela` no aparelho (se não existir, ignore).
- Mesma regra da seção 3: cursor vem do servidor e há janela de 2 minutos.
- Apagar a **propriedade inteira** não gera uma linha por registro (ela deixa de existir para o app).
- O histórico não cresce para sempre se você rodar de vez em quando no SQL Editor:
  `SELECT private.limpar_registros_excluidos(90);` (apaga o que tem mais de 90 dias). Um aparelho que passou mais
  tempo que isso sem sincronizar deve **refazer a carga completa** daquela tabela.
- **Só vale a partir da migração:** exclusões feitas **antes** dela não estão registradas. Para o primeiro
  sincronismo depois de instalar, faça uma conferência completa (a antiga, por ids) **uma vez**.

## 5. Mostrar a lista do app com muitos registros

- Leia sempre do aparelho (IndexedDB), nunca da rede, para desenhar a tela.
- Índices úteis no IndexedDB: `[propriedade_id, created_at]` ou `[propriedade_id, data]` para a ordem da lista e
  `[propriedade_id, animal_id]` para o histórico do animal. Sem índice, ordenar 10 milhões de itens a cada
  abertura de tela é o que deixa o app lento.
- Pagine com cursor (guarde a chave da última linha mostrada, `IDBKeyRange.upperBound(chave, true)`); não use
  `offset`/`slice(inicio, fim)` em lista grande e não carregue tudo para o JavaScript para filtrar.
- Não conte tudo a cada tela. Guarde contadores por tabela e atualize incrementalmente a cada página baixada.
- Lista virtual (renderizar só o que cabe na tela) e busca com atraso (300 ms) — como o site faz.
- Busca por texto em muitas anotações: faça um índice de palavras (ou limite a busca ao período escolhido);
  varrer 10 milhões de textos no JavaScript não é viável em celular.

## 6. Por que as anotações do site podem não aparecer no app — roteiro de diagnóstico

> **Importante:** o código-fonte do app não estava disponível quando esta versão do site foi preparada, então a
> causa **não foi confirmada**. O banco do site está correto para anotações (tabela, colunas, RLS e `updated_at`
> verificados). O roteiro abaixo separa "o dado não está no servidor" de "o dado está e o app não o trouxe".

1. **O dado está no servidor?** Rode no SQL Editor do Supabase (ele roda como administrador do banco e vê tudo):

   ```sql
   SELECT public.app_diagnostico('<id da propriedade>');
   ```

   Compare `tabelas.anotacoes_producao.total` com o total do site e `ultimo_updated_at` com a anotação nova.
   Para ver o que **a conta do app** enxerga, chame a mesma função pelo PostgREST com o token dessa conta
   (`POST /rest/v1/rpc/app_diagnostico` com `{"p_propriedade_id": "<id>"}`): como a função respeita o RLS, se
   `propriedade_visivel` vier `false` a conta **não é dona/membro** dessa propriedade.
2. **O app está olhando a mesma propriedade?** O site mostra a propriedade escolhida no topo; o app pergunta qual
   abrir (Configurações → Nuvem → Trocar de propriedade). Contas com duas fazendas são a causa mais comum.
3. **O app puxou a tabela certa e as colunas certas?** A tabela é `anotacoes_producao`. Colunas do site:
   `data`, `animal_id`, `lote_id`, `producao`, `observacao` (obrigatória), `comportamento`, `alimentacao`,
   `informacoes_adicionais`. Se o app pede uma coluna que não existe, o PostgREST responde **400** para a
   tabela inteira; o app deve mostrar o erro em Configurações → Nuvem.
4. **Anotação sem animal e sem lote** é válida no site (`animal_id` e `lote_id` são opcionais). Se o app só
   mostra anotações ligadas a um animal, as outras "somem". Teste: crie no site uma anotação **sem** animal.
5. **Cursor.** O app está avançando o cursor pelo relógio do aparelho? Ou paginando só por `updated_at`? Veja a
   seção 3 (regras 1, 3 e 5). Teste: apague o cursor da tabela no aparelho e sincronize; se a anotação aparecer,
   o problema era o cursor.
6. **Filtro de exibição no app** (por data, por lote, por situação do animal). Uma anotação de um animal
   `vendido` ou `falecido` pode estar sendo escondida pelo filtro do animal.
7. **Sessão.** Token expirado devolve lista vazia em vez de erro em alguns clientes. Conferir a resposta HTTP.

Quando o código do app estiver à mão, o ponto de partida é o mapeamento da tabela `anotacoes_producao` e o trecho
que calcula o cursor.

## 7. Busca por texto (site) e escala

A tela "Anotações" do site pesquisa com `ILIKE '%termo%'` em `observacao`, `comportamento` e `alimentacao`. A migração
cria índices **trigram** (`pg_trgm`) nessas colunas. Medido com 5,3 milhões de anotações (texto sintético de 50
palavras, o que é **pior** que texto real para o trigram):

| Busca | Sem índice | Com trigram |
| --- | ---: | ---: |
| Primeira página de um termo comum | 2,2 ms | 1,6 ms |
| Primeira página de um termo raro/inexistente | 3.831 ms | 716 ms |
| **Contagem exata** de um termo comum (≈ milhares de acertos) | 3.023 ms | 2.427 ms |

A contagem exata de termos muito comuns continua lenta (é preciso contar cada acerto). Por isso o site agora mostra
as linhas assim que chegam e conta em segundo plano ("contando…").

## 8. Roteiro de primeiro teste com o banco real

Use uma conta de teste.

1. Aplique as migrações (veja `docs/ESCALA.md`, seção "Como aplicar").
2. `SELECT public.app_diagnostico('<id>')` — deve devolver contagens e `propriedade_visivel: true`.
3. Pelo PostgREST, com o token da conta de teste (o SQL Editor ignora o RLS, então não serve para este passo):
   `POST /rest/v1/rpc/app_sincronizar` com `{"p_tabela":"anotacoes_producao","p_propriedade_id":"<id>"}` — deve
   devolver até 1000 linhas, só da propriedade dessa conta.
4. Crie uma anotação no site; repita a chamada passando `p_apos_updated_at` e `p_apos_id` da última linha: deve vir só a nova.
5. Apague a anotação no site; `SELECT * FROM public.registros_excluidos ORDER BY id DESC LIMIT 5` — deve haver a linha.
6. No app: entre com a mesma conta, escolha a mesma propriedade e confira os números do passo 2.

## 9. Manutenção, conta bloqueada e a API do servidor

### Perguntar antes de sincronizar: `estado_manutencao`

```http
POST /rest/v1/rpc/estado_manutencao   {}
→ { "status": "ativo" | "manutencao" | "bloqueado", "modulos": ["todos" | "rebanho" | ...],
    "termina_em": "2026-10-31T14:00:00+00:00" | null, "titulo": "...", "mensagem": "...",
    "sou_admin": false, "conta_bloqueada": false }
```

- `status` já vem **efetivo**: manutenção com `termina_em` no passado volta como `"ativo"` (toda manutenção tem fim:
  padrão 2 h, máximo 72 h).
- Durante a manutenção (ou com a conta bloqueada) o banco **não dá erro** nas tabelas afetadas: o RLS faz a leitura
  voltar **vazia**, o `DELETE` apagar **zero linhas** (resposta 204/200 normal) e o `INSERT`/`upsert` falhar com
  `42501`. Por isso, a cada rodada, o app deve:
  1. chamar `estado_manutencao` antes de tudo;
  2. com `conta_bloqueada` ou `status = "bloqueado"` ou `"todos"` em `modulos`: **pausar** a sincronização inteira
     (não enviar, não baixar, não conferir ids, não apagar nada no aparelho) e avisar a pessoa;
  3. com manutenção parcial: não baixar as tabelas das áreas em manutenção e **segurar todos os envios** (uma linha
     filha não pode chegar antes da mãe, que está pausada);
  4. nunca fazer "conferência de ids" (apagar no aparelho o que não veio do servidor) com qualquer área em manutenção;
  5. no `DELETE`, pedir as linhas de volta (`Prefer: return=representation`, `select=id`): zero linhas + manutenção
     = a exclusão **fica na fila**; zero linhas sem manutenção = já não existia (conta como feita).
- Área de cada tabela (igual às políticas do banco): animais → `rebanho`; lotes → `lotes`; tipos_vacinas e
  vacinacoes → `vacinacao`; inseminacoes → `inseminacao`; nascimentos → `nascimentos`; pesagens → `bezerros`;
  producao_leite e anotacoes_producao → `producao`; movimentacoes_financeiras e investimentos → `financeiro`;
  compras e vendas → `comercial`.
- O app Apecuária Digital faz isso desde a versão 7.4.

### Conta bloqueada

- Bloquear uma conta no painel marca o perfil, cria um bloqueio de usuário (que o RLS respeita) e **bane o login** no
  Auth: a conta não entra nem renova a sessão. Tokens já emitidos param de ver dados na hora (RLS).
- `/api/public/app/*` responde `403 {"erro": "Esta conta está bloqueada."}`.

### `/api/public/app/sincronizar` — exclusões com cursor próprio

- `GET` aceita `apos_excluido_em` e `apos_exclusao_id` (o `exclusao_id` de cada item de `excluidos`) e devolve
  `proximo_cursor_exclusoes`, `tem_mais_registros` e `tem_mais_exclusoes` (até 1000 por página, em ordem de
  `(excluido_em, id)`). Sem esses parâmetros, usa o cursor dos registros, como antes.
- Janela de segurança: ao começar cada rodada, volte os dois cursores 2 minutos e aplique tudo pelo id.
- `POST`: erros em português, sem detalhes internos do banco; `origem_tipo`/`origem_id` de
  `movimentacoes_financeiras` enviados pelo app são ignorados (quem cria esses lançamentos é o banco).

### Datas

"Hoje" e "este mês" no banco usam o dia de Brasília (`private.hoje_br()`), não o UTC do servidor. Em
`v_vacinacoes_status`, use `status_atual` (`em_dia`, `proxima`, `vencida`, `substituida` = já teve reforço) e
`ultima_dose`; `status_calculado` continua existindo para telas antigas.

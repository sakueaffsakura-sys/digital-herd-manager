# Plano — Apecuária Digital

## Objetivo
Construir um sistema de gestão pecuária responsivo, autenticado e orientado pelo banco SQL, reproduzindo com alta fidelidade a linguagem visual da referência: painel escuro denso, verde neon, navegação lateral, banner rural, indicadores, gráficos e tabelas compactas.

## Etapas

### 1. Banco, segurança e contas
- Modelar propriedades, perfis e papéis separados, com isolamento por propriedade e permissões de proprietário, administrador e colaborador.
- Criar as tabelas relacionadas para lotes, animais, pesagens/evoluções, nascimentos, tipos de vacina, vacinações, inseminações, produção de leite, anotações, compras, vendas, movimentações financeiras, investimentos, configurações e histórico dos animais.
- Adicionar chaves, índices, validações, datas de criação/alteração e regras de integridade.
- Aplicar controle de acesso em todas as tabelas para que cada usuário veja e altere somente propriedades autorizadas.
- Criar perfil automaticamente no cadastro e habilitar acesso por e-mail/senha e Google.
- Manter o banco inicialmente vazio; nenhum dado operacional demonstrativo será inventado.

### 2. Camada de dados e regras de negócio
- Criar operações seguras de leitura, criação, edição e exclusão para todos os módulos, com validação no navegador e no servidor.
- Calcular previsão de parto a partir do período configurado; classificar vacinações como em dia, próximas ou vencidas pela data armazenada.
- Sincronizar compras e vendas com o financeiro sem duplicar lançamentos.
- Calcular produção total, média diária, valor produzido, produção individual e por lote.
- Criar consultas agregadas para o painel e relatórios mensais/anuais, sempre derivadas dos registros SQL.
- Implementar pesquisa global por animal, lote, bezerro, vacina e inseminação.

### 3. Estrutura visual e navegação
- Criar identidade visual “Apecuária Digital” com tokens semânticos escuros, verde vivo, alertas vermelhos/amarelos e categorias azul/roxo.
- Reproduzir a composição da referência: sidebar estreita e recolhível, topo com pesquisa e conta, banner de gado, grade densa de indicadores, gráficos e tabelas.
- Implementar navegação real para Início, Rebanho, Bezerros, Vacinação, Inseminação, Nascimentos, Lotes, Produção de Leite, Relatórios, Financeiro, Compra e Venda e Configurações.
- Adaptar para celular com menu lateral deslizante, cartões em coluna, gráficos fluidos e tabelas com rolagem horizontal.

### 4. Telas funcionais
- Painel: indicadores, evolução do rebanho, lembretes, resumos, lotes, inseminações, produção, finanças, compras/vendas e anotações.
- Rebanho: listagem, busca, filtros, formulário completo, edição, exclusão confirmada e página de detalhes com histórico unificado.
- Bezerros: cadastro/evolução, idade, filiação, peso e histórico.
- Vacinação: tipos configuráveis, aplicação por animal ou lote, próximas doses e atrasos.
- Inseminação e nascimentos: registros, previsões, filiação vaca–bezerro e descendentes.
- Lotes: CRUD, inclusão/remoção de animais e totais automáticos.
- Produção: registros, anotações, análises por vaca/lote e relatórios diário, mensal e anual.
- Financeiro e compra/venda: CRUD, categorias, receitas, despesas, investimentos e lucro calculado.
- Relatórios: filtros por período, lote, animal e categoria, gráficos reais mensais e anuais.
- Perfil, notificações e configurações da propriedade.

### 5. Qualidade e validação
- Adicionar carregamento, estados vazios, erros amigáveis, confirmação de exclusão e feedback de salvamento.
- Verificar cada fluxo de CRUD com uma sessão autenticada e confirmar a atualização do painel após mudanças.
- Validar cálculos e isolamento entre usuários diretamente no banco.
- Testar desktop e celular, sem cortes, sobreposições ou controles sem ação.
- Executar verificações de segurança e corrigir alertas relacionados ao sistema.

## Detalhes técnicos
- Frontend e servidor: TanStack Start, React, TanStack Query, Zod, Recharts e componentes existentes.
- Persistência: Lovable Cloud/PostgreSQL com políticas de acesso por propriedade.
- Rotas privadas ficarão sob a proteção de autenticação; operações privadas também serão protegidas individualmente no servidor.
- O painel usará consultas agregadas e séries temporais; nenhum contador ou gráfico terá valores fixos.
- A imagem enviada será usada somente como referência visual, não como conteúdo incorporado.

## Critérios de conclusão
- Todos os módulos descritos possuem telas e operações reais de criar, consultar, editar e excluir quando aplicável.
- Banco vazio produz estados vazios coerentes.
- Dashboard e relatórios refletem imediatamente os dados persistidos.
- Usuários não conseguem acessar dados de propriedades sem permissão.
- Navegação, autenticação, busca, formulários, gráficos e responsividade foram verificados no aplicativo em execução.

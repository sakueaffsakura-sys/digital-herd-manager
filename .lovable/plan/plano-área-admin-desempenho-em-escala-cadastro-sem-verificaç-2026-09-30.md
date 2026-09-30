# Plano: Área Admin, desempenho em escala, cadastro sem verificação, perfil e correções

## 1. Área Admin (nova página /admin)
- Acesso somente para administradores do sistema (papel guardado na tabela de papéis separada, checado no servidor — nunca no navegador).
- Seu usuário atual (ccccmiuy@gmail.com) vira o primeiro administrador.
- Painéis:
  - Contas: lista de todos os usuários (nome, e-mail, data de cadastro, último acesso, nº de propriedades).
  - Espaço usado: total de registros e tamanho estimado em disco por conta e por tabela.
  - Desempenho: tamanho total do banco, consultas mais lentas, tempo médio de resposta medido na hora, conexões ativas.
  - Atividade: novos cadastros por dia, registros criados nos últimos 30 dias.
- Ações: bloquear/desbloquear conta e promover/remover administrador.

## 2. Desempenho com muitos registros (o problema das 99.999 anotações)
- Todas as listagens passam a buscar só a página visível no banco (25/50/100 por vez), com contagem feita no banco — hoje algumas telas ainda carregam tudo e travam.
- Busca, filtros e totais calculados no banco.
- Índices compostos em todas as tabelas grandes (propriedade + data).
- Painel e relatórios usando somas do banco, sem somar milhares de linhas no navegador.
- Listas de seleção (animais, lotes) com busca por digitação em vez de carregar todos.

## 3. Cadastro sem verificação de e-mail
- Contas novas entram direto após criar a conta (confirmação automática ligada).
- Após cadastrar, o usuário já é levado ao painel.

## 4. Perfil funcionando
- Garantir que todo usuário tenha perfil (criação automática + correção dos que faltam).
- Editar nome, telefone, foto e trocar senha salvando de verdade, com mensagens claras.

## 5. Correção geral de erros
- Corrigir o erro de carregamento da tela de entrada (diferença servidor/navegador).
- Revisar cada módulo (rebanho, bezerros, vacinação, inseminação, nascimentos, lotes, leite, financeiro, compra/venda, relatórios, configurações) criando, editando e excluindo registros reais com teste automatizado em computador e celular, corrigindo tudo que falhar.

## 6. Proteção contra abuso / DoS
- Limite de requisições por usuário e por IP nas funções do servidor (ex.: bloqueio temporário após excesso), limite de tentativas de login, tamanho máximo de envio e de importação, cabeçalhos de segurança.
- Observação honesta: ataques DDoS de grande volume são barrados pela rede de hospedagem (já ativa); o app adiciona as camadas acima para abuso dentro da aplicação.

## Detalhes técnicos
- Migração: valor 'super_admin' via tabela `user_roles` + função `private.is_super_admin()`; funções SECURITY DEFINER `admin_*` (contas, uso por conta via contagens + `pg_total_relation_size`, `pg_stat_statements` quando disponível) com checagem de papel e EXECUTE só para authenticated; coluna `bloqueado` em profiles checada no gate.
- Rota `src/routes/_authenticated/admin.tsx` com server functions `requireSupabaseAuth` que verificam o papel antes de usar dados privilegiados.
- `configure_auth` com auto-confirm ligado.
- Tabela `rate_limits` (chave, janela, contador) + middleware de servidor; limite no login via backend de auth.
- Unificar listagens em `usePagedRows` + `VirtualTable`; selects com busca remota.

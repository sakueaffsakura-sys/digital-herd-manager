# Roadmap

## Concluído
- [x] Sistema completo (banco, CRUD, relatórios, filtros, relatórios por período, logo Pecuária Digital)
- [x] Proteções (rate limiting, cabeçalhos de segurança, CSRF, gate de conta bloqueada)
- [x] Painel admin v2: abas Contas / Métricas / Desempenho; detalhe da conta (perfil editável, propriedades com plano, arquivos, ações bloquear/admin/excluir com dupla confirmação); gráficos de cadastros, acessos, registros, leite e financeiro; consultas lentas, limites de uso, tabelas escaneadas, limpeza pendente

## Em andamento
- [x] Melhorar layout da Área Admin (menu lateral)
- [x] Aba "Tempo real" (desempenho ao vivo, só admin)

## Pendente (aguardando decisão do usuário)
- [ ] 5 avisos do verificador de segurança: funções admin SECURITY DEFINER em `public` executáveis por usuários logados (mesma classe dos 5 já existentes: admin_contas, admin_sistema, admin_definir_conta, setar/cancelar_plano_demonstracao + as 5 novas). Podem ser movidas para o schema `private` + chamadas via funções de servidor — perguntar se o usuário quer.
- [ ] 1 aviso INFO: RLS habilitada sem política (tabela rate_limits, só service_role usa) — sem impacto prático.

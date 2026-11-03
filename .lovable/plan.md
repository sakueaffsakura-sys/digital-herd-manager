# Correção profunda (sem mudar o visual)

Objetivo: encontrar e corrigir falhas reais em todo o site, preservando dados, o app Android e as regras da Fase A.

## Etapas
1. **Diagnóstico completo**
   - Rodar verificação de código, lint e todos os testes.
   - Ler logs de erros do navegador e do servidor.
   - Rodar o verificador de segurança e o linter do banco.
   - Conferir que toda função e tabela chamada pelo código existe no banco.
2. **Teste real logado** (navegador automatizado) em cada seção: Início, Rebanho, Lotes, Pesagens, Vacinas, Inseminações, Nascimentos, Leite, Anotações, Financeiro, Relatórios, Perfil, Admin e Manutenção — criar, editar, excluir, filtrar e paginar.
3. **Corrigir** tudo que falhar, pela causa (não caso a caso), com mensagens em português.
4. **Pendências seguras do roadmap**
   - Levar o SQL da Fase A parte 2 para o controle oficial de migrações (só aditivo, sem reaplicar o que já existe).
   - Evitar lote duplicado ao retomar importação após resposta perdida.
5. **Validar de novo** os mesmos fluxos e os testes; adicionar teste para cada regra corrigida.

## Fora do escopo
- Visual novo, pagamentos, eBooks, novas páginas.
- Recursos enterprise de manutenção já excluídos.
- Mudanças que quebrem tabelas/colunas usadas pelo app.

## Detalhes técnicos
- Migrações apenas aditivas (`IF NOT EXISTS`/`CREATE OR REPLACE`).
- Importação: chave idempotente por linha/lote antes do insert.
- Resultado final: lista do que estava quebrado, o que foi corrigido e o que ficou pendente.

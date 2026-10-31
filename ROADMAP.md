# Roadmap

(Este arquivo junta o antigo `roadmap.md`, que conflitava com `ROADMAP.md` no Windows e no macOS.)

## Concluído
- [x] Sistema completo (banco, CRUD, relatórios, filtros, relatórios por período, logo Pecuária Digital)
- [x] Proteções (rate limiting, cabeçalhos de segurança, CSRF, gate de conta bloqueada)
- [x] Painel admin v2: abas Contas / Métricas / Desempenho; detalhe da conta (perfil editável, propriedades com plano, arquivos, ações bloquear/admin/excluir com dupla confirmação); gráficos; consultas lentas, limites de uso, tabelas escaneadas, limpeza pendente
- [x] Layout da Área Admin (menu lateral) e aba "Tempo real"
- [x] Assistente Yui (chat de suporte com IA + tour guiado com voz; ensina só a função escolhida)
- [x] Área Admin: criadores em "Sobre"; fundo opcional do chat da Yui (JPG, PNG, WebP, GIF ou MP4)
- [x] Partes do banco que faltavam (perfil, fotos, relatórios, diagnóstico, importações); perfil criado automaticamente
- [x] Cadastro sem verificação de e-mail
- [x] Listas de seleção acima de 1000 registros + índices; teste logado com 100 mil registros
- [x] Formulários: escrita em vez de listas de seleção; referências existentes reconhecidas; vacinação com animal e lote
- [x] Anotações: CRUD verificado com login; avisos globais de sucesso e erro
- [x] Fase A, parte 1 (Lovable, migração 0005): bloqueio de conta valendo no banco, sem auto-exclusão do perfil, transferência da propriedade só pelo dono, contador de limites corrigido, `app_diagnostico` para logados
- [x] Fase A, parte 2 (31/10/2026, `docs/sql/2026-10-31-fase-a-parte-2.sql` + código):
  - bloqueio de conta também no login (ban no Auth) por rota de servidor só para administradores;
  - API do app recusa conta bloqueada; login do app com limite no banco (IP e e-mail);
  - Yui: só as últimas 20 mensagens de texto do usuário/assistente (24 mil caracteres), cota diária no banco (40 conversas e 60 falas; admin sem cota), números da propriedade selecionada, raciocínio "low", respostas salvas com id (antes ficavam com id vazio e se sobrescreviam);
  - voz da Yui só para respostas salvas da própria conta ou falas fixas do tour (nunca texto livre);
  - limite de requisições confia só em `cf-connecting-ip` e não zera tudo ao encher;
  - manutenção com hora para acabar (padrão 2 h, máx. 72 h), bloqueio automático 0–1440 min só de aparelho e conta (IP só manual), faixa vermelha no admin com "Voltar ao normal";
  - uploads só de imagem (o fundo da Yui aceita também GIF e MP4);
  - sincronização com cursor próprio das exclusões e erros amigáveis;
  - dia e mês de Brasília (`private.hoje_br()`), meses por intervalo, vacina vencida só pela última dose (`status_atual`, `ultima_dose`);
  - índices das chaves estrangeiras e remoção dos índices repetidos;
  - dados de teste DEMO-99999 removidos (banco de 413 MB para 79 MB).

## Pendente
- [ ] Incorporar `docs/sql/2026-10-31-fase-a-parte-2.sql` ao controle de migrações do Lovable (já aplicado no banco).
- [ ] Visual novo "Brinco e pasto" em todas as páginas.
- [ ] Recuperar senha, segurança da conta (duas etapas para admin opcional), privacidade e termos (LGPD).
- [ ] Assinatura paga (Mercado Pago: Pix, cartão, boleto), área do assinante e biblioteca de eBooks protegida.
- [ ] Agenda, central de avisos, ficha completa do animal, indicadores, calculadoras, clima, página do aplicativo, ajuda.
- [ ] Verificar demonstração completa e voz da Yui com créditos de IA disponíveis.
- [ ] Aprofundar retomada de importações: possibilidade de duplicar lote após resposta perdida.
- [ ] Avisos do verificador de segurança sobre funções `admin_*` SECURITY DEFINER em `public`: todas conferem administrador na primeira linha (sem brecha); mover para `private` exige chamar pelo servidor.
- [ ] Aviso INFO: `rate_limits` com RLS e sem política (só o servidor usa) — esperado.

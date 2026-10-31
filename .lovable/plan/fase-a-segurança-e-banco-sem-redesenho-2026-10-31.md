# Fase A — segurança e banco, sem redesenho

## Resultado
Corrigir acesso, manutenção, abuso da Yui e sincronização, preservando todos os dados e a compatibilidade com o site publicado e o aplicativo Android.

## Alterações
1. **Contas e propriedades:** impedir exclusão do próprio perfil; unificar bloqueios no perfil, regras de acesso e Auth; substituir as duas ações administrativas pela chamada segura de servidor; proteger transferência de propriedade.
2. **Yui:** validar as últimas 20 mensagens de texto, sem mensagens de sistema do cliente, até 24.000 caracteres; aplicar cotas diárias de 40 conversas e 60 falas, sem limite para administradores; voz por `mensagem_id` de resposta própria persistida; contexto da propriedade selecionada com os mesmos indicadores do Início; raciocínio `low`.
3. **Limites:** confiar apenas em `cf-connecting-ip`; preservar contadores ativos ao limpar memória; aplicar contador compartilhado no banco aos caminhos de entrada, renovação, cadastro, chat e voz; corrigir expiração de janelas longas.
4. **Manutenção:** término automático padrão de duas horas, máximo de 72 horas; validar bloqueios de 0–1440 minutos; impedir bloqueio automático por IP; acrescentar apenas a faixa vermelha administrativa solicitada, com término e “Voltar ao normal”.
5. **Arquivos:** restringir os cinco buckets solicitados a JPEG, PNG e WebP, sem remover arquivos existentes.
6. **Sincronização:** cursor separado e paginação das exclusões; `tem_mais` considerando os dois fluxos; erros de gravação em português, sem mensagens internas do banco; ignorar origens financeiras fornecidas pelo cliente.
7. **Datas e vacinas:** centralizar “hoje” em Brasília, usar intervalos mensais indexáveis e considerar somente a última dose por vacina/alvo; acrescentar `ultima_dose` ao fim da view.
8. **Índices e documentação:** criar índices faltantes, remover apenas duplicatas confirmadas sem retirar UNIQUE; restaurar execução autenticada de `app_diagnostico`; atualizar `docs/APP.md`; juntar os dois roadmaps em `ROADMAP.md`.

## Compatibilidade e detalhes técnicos
- Conferir definições no banco real antes de aplicar cada migração; preservar nomes, tipos, colunas e formatos de retorno existentes.
- Usar migrações compatíveis, sem excluir dados ou renomear objetos. Para novo parâmetro, substituir a assinatura sem deixar RPCs sobrecarregadas e manter o parâmetro opcional.
- Banimento/desbanimento de Auth somente após validar bearer e `sou_admin`, com importação dinâmica do cliente privilegiado dentro do handler. Tratar falhas parciais explicitamente: não anunciar sucesso quando Auth e banco divergirem.
- Cotas diárias seguem o dia de Brasília. Contadores compartilhados são atômicos e acessíveis somente ao servidor.
- Falas do tour não são respostas de chat persistidas: preservar a demonstração e a narração local, sem reabrir o envio arbitrário de texto ao serviço de voz.
- Não implementar Redis, bypass de webhooks, cronômetro público, resgate por token ou novo visual.

## Verificação
- Adicionar e executar testes para limites, validação de mensagens, cotas, término da manutenção, vacina reforçada, transferência e cursores de exclusão.
- Conferir grants, políticas, assinaturas únicas de RPCs, índices e formatos de views no banco real.
- Verificar respostas HTTP sem token, com token comum e com administrador quando houver sessão autorizada. Testes de manutenção/bloqueio devem ser isolados e restaurados, sem deixar o site compartilhado em manutenção.
- Corrigir erros atuais de compilação relacionados aos caminhos auditados e verificar os sinais automáticos do projeto; executar os testes existentes afetados.
- Entregar lista de migrações, arquivos alterados, testes executados e eventuais verificações pendentes.
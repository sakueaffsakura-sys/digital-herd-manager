# Apecuria Digital

Quero criar o sistema completo chamado “Apecuária Digital”.

IMPORTANTE:

Use a imagem de referência anexada nesta conversa como referência visual principal.

RECRIE A INTERFACE DA IMAGEM COM O MÁXIMO DE FIDELIDADE POSSÍVEL.

Copie a estrutura visual, organização, proporções, espaçamentos, cards, sidebar, cabeçalho, tabelas, gráficos, ícones, botões, cores, tipografia, bordas, arredondamentos, sombras, banners e demais detalhes visuais.

Porém, NÃO quero apenas um mockup.

Quero um SISTEMA REAL, FUNCIONAL E COMPLETO.

==================================================

REGRA PRINCIPAL — BANCO SQL

==================================================

TODO O SISTEMA DEVE FUNCIONAR COM BANCO DE DADOS SQL.

O SQL deve ser a fonte oficial dos dados.

NÃO utilizar dados mockados, arrays estáticos, JSON fixo ou informações hardcoded como solução definitiva.

Todos os dados exibidos na aplicação precisam ser carregados do banco.

Todos os cadastros precisam ser persistidos no banco.

Todas as alterações precisam atualizar o banco.

Todas as exclusões precisam excluir do banco.

Todos os gráficos, contadores, relatórios e indicadores precisam ser calculados a partir dos dados reais existentes no SQL.

Se o dashboard mostrar:

“Total de Animais: 152”

esse 152 deve ser calculado através de uma consulta SQL aos animais cadastrados.

O mesmo vale para:

- bezerros;

- vacinas;

- inseminações;

- nascimentos;

- perdas;

- vendas;

- compras;

- receitas;

- despesas;

- investimentos;

- produção de leite;

- lotes;

- demais informações.

Se o banco estiver vazio, mostrar estado vazio apropriado em vez de inventar dados.

==================================================

ESTRUTURA DO SISTEMA

==================================================

Criar uma aplicação de gestão pecuária chamada:

APECUÁRIA DIGITAL

Interface moderna, premium, profissional e responsiva.

Tema visual semelhante à imagem:

- fundo escuro;

- verde como cor principal;

- verde neon para destaques;

- azul/verde escuro;

- cards escuros;

- textos claros;

- vermelho para perdas e alertas;

- amarelo para avisos;

- azul/roxo para categorias;

- bordas discretas;

- sombras suaves;

- cantos arredondados.

==================================================

SIDEBAR

==================================================

Criar sidebar semelhante à imagem.

Menu:

1. Início

2. Meu Rebanho

3. Evolução dos Bezerros

4. Vacinação

5. Inseminação

6. Lotes

7. Produção de Leite

8. Relatórios

   - Mensal

   - Anual

9. Lucros e Investimentos

10. Compra e Venda

Depois:

11. Configurações

   - Notificações

   - Perfil

   - Sobre

A navegação precisa funcionar de verdade.

==================================================

1 — DASHBOARD / INÍCIO

==================================================

Criar dashboard seguindo fielmente a composição da imagem.

Cards superiores:

- Total de Animais

- Bezerros em evolução

- Vacinações em dia

- Inseminações

- Lucro do mês

- Data/clima/status do rebanho

Todos os valores devem vir do SQL.

Criar:

EVOLUÇÃO DO REBANHO

Gráfico com evolução real da quantidade de animais.

PRÓXIMAS VACINAÇÕES / LEMBRETES

Mostrar automaticamente as próximas vacinações.

RESUMO DO MÊS

- Nascidos

- Perdas

- Vendas

- Compras

RESUMO FINANCEIRO

- Receitas

- Despesas

- Lucro

ANIMAIS POR LOTE

Mostrar todos os lotes cadastrados e quantidade real de animais.

INSEMINAÇÃO

Mostrar animais inseminados, data da inseminação, previsão de parto e situação.

PRODUÇÃO DE LEITE

Mostrar gráfico mensal/anual baseado nos registros reais.

PRODUÇÃO DAS VACAS

Mostrar produção individual e por lote.

LUCROS E INVESTIMENTOS

Mostrar os lançamentos financeiros recentes.

COMPRA E VENDA

Mostrar as movimentações recentes.

ANOTAÇÕES DA PRODUÇÃO

Mostrar últimas anotações.

==================================================

2 — MEU REBANHO

==================================================

Criar gerenciamento completo dos animais.

Permitir:

- cadastrar;

- editar;

- excluir;

- visualizar;

- pesquisar;

- filtrar.

Campos:

- número/brinco;

- nome;

- sexo;

- raça;

- data de nascimento;

- lote;

- mãe;

- pai;

- situação;

- observações.

Criar página de detalhes do animal.

Mostrar histórico do animal:

- nascimento;

- vacinação;

- inseminação;

- produção;

- movimentações;

- observações.

==================================================

3 — EVOLUÇÃO DOS BEZERROS

==================================================

Criar área específica para bezerros.

Mostrar:

- identificação;

- sexo;

- data de nascimento;

- idade;

- mãe;

- pai;

- lote;

- peso, caso cadastrado;

- evolução;

- observações.

Criar histórico de evolução.

==================================================

4 — VACINAÇÃO

==================================================

Criar módulo completo de vacinação.

Tipos iniciais:

- Vacina Geral

- Brucelose

- Vermífugos

Permitir adicionar outros tipos posteriormente.

Cada registro deve possuir:

- animal ou lote;

- tipo de vacina;

- data da aplicação;

- próxima aplicação;

- responsável;

- observação.

Criar status:

- Em dia

- Próxima

- Vencida

==================================================

5 — LEMBRETES

==================================================

Criar sistema automático de lembretes.

Calcular através das datas armazenadas no SQL.

Exemplo:

Vacina Geral

Lote 02 — 15 animais

16/09/2026

Em 2 dias

Mostrar alertas quando estiver próximo da data.

Mostrar também vacina vencida.

==================================================

6 — INSEMINAÇÃO

==================================================

Criar módulo completo.

Registrar:

- animal;

- data da inseminação;

- reprodutor/sêmen;

- observação;

- previsão de parto;

- situação.

A previsão de parto deve ser calculada automaticamente através da data da inseminação e do período configurado.

Mostrar:

- inseminações em andamento;

- próximas previsões;

- histórico;

- animais inseminados.

==================================================

7 — NASCIMENTOS

==================================================

Criar controle de nascimento.

Registrar:

- vaca;

- número da vaca;

- identificação do bezerro;

- data do nascimento;

- sexo;

- lote;

- observações.

Sexo:

M = Macho

F = Fêmea

Criar relacionamento:

VACA → BEZERRO

Permitir visualizar os descendentes de cada vaca.

==================================================

8 — LOTES

==================================================

Criar gerenciamento completo dos lotes.

Permitir:

- criar;

- editar;

- excluir;

- adicionar animais;

- remover animais;

- visualizar animais do lote.

Exemplos:

Lote 01 — Matrizes

Lote 02 — Recria

Lote 03 — Engorda

Lote 04 — Reprodução

Lote 05 — Novilhas

Lote 06 — Bezerros

A quantidade de animais deve ser calculada automaticamente pelo SQL.

==================================================

9 — RELATÓRIOS MENSAIS E ANUAIS

==================================================

Criar relatórios completos.

Mensal:

- quantidade de nascimentos;

- perdas;

- vendas;

- compras;

- quantidade de animais;

- receitas;

- despesas;

- investimentos;

- lucro;

- produção de leite.

Anual:

Mostrar os mesmos dados separados por mês.

Criar gráficos dinâmicos usando dados reais do SQL.

Filtros:

- período;

- lote;

- animal;

- categoria.

==================================================

10 — LUCROS E INVESTIMENTOS

==================================================

Criar módulo financeiro.

RECEITAS:

- venda de animais;

- venda de leite;

- outras receitas.

DESPESAS:

- ração;

- medicamentos;

- vacinas;

- manutenção;

- transporte;

- funcionários;

- outras despesas.

INVESTIMENTOS:

- máquinas;

- instalações;

- equipamentos;

- melhorias;

- outros.

Campos:

- descrição;

- categoria;

- valor;

- data;

- tipo;

- observação.

Calcular automaticamente:

RECEITAS - DESPESAS = LUCRO

==================================================

11 — PRODUÇÃO DE LEITE

==================================================

Criar módulo completo.

Registrar:

- animal;

- lote;

- data;

- litros produzidos;

- valor por litro;

- valor total.

Calcular:

litros × valor por litro = valor total.

Criar relatórios:

- diário;

- mensal;

- anual.

Mostrar:

- total de litros;

- média diária;

- valor total;

- produção individual;

- produção por lote.

==================================================

12 — PRODUÇÃO INDIVIDUAL

==================================================

Criar tabela:

Vaca

Produção (L/dia)

Lote

Data

Observação

Mostrar histórico individual de cada vaca.

==================================================

13 — PRODUÇÃO POR LOTE

==================================================

Mostrar:

- lote;

- quantidade de vacas;

- litros produzidos;

- média por animal;

- valor produzido.

Todos os valores devem ser calculados a partir do SQL.

==================================================

14 — ANOTAÇÕES DA PRODUÇÃO

==================================================

Permitir criar anotações.

Campos:

- animal;

- lote;

- data;

- produção;

- observação;

- comportamento;

- alimentação;

- informações adicionais.

Permitir editar e excluir.

==================================================

15 — COMPRA E VENDA

==================================================

Criar duas áreas:

COMPRAS

- data;

- produto/animal;

- quantidade;

- valor;

- fornecedor;

- categoria;

- observação.

VENDAS

- data;

- animal;

- quantidade;

- valor;

- comprador;

- categoria;

- observação.

As vendas e compras devem alimentar automaticamente os relatórios e o financeiro.

==================================================

16 — BANCO DE DADOS SQL

==================================================

Criar estrutura SQL organizada e normalizada.

Criar tabelas relacionadas, incluindo:

- usuarios

- animais

- lotes

- nascimentos

- bezerros

- tipos_vacinas

- vacinacoes

- inseminacoes

- producao_leite

- anotacoes_producao

- movimentacoes_financeiras

- investimentos

- compras

- vendas

- configuracoes

Criar:

- PRIMARY KEY;

- FOREIGN KEY;

- índices;

- constraints;

- timestamps;

- relacionamentos;

- regras de integridade.

Evitar duplicação desnecessária de informações.

==================================================

17 — CRUD

==================================================

Todos os módulos precisam ter CRUD REAL:

CREATE

READ

UPDATE

DELETE

Não criar botões falsos.

Não criar funcionalidades apenas visuais.

Quando o usuário clicar em:

Salvar → salvar no SQL.

Editar → atualizar SQL.

Excluir → excluir do SQL.

==================================================

18 — SEGURANÇA

==================================================

Implementar corretamente:

- autenticação;

- autorização;

- proteção das rotas;

- validação dos dados;

- controle de acesso;

- proteção das operações do banco;

- políticas de segurança adequadas;

- tratamento de erros;

- mensagens amigáveis.

Cada usuário deve acessar somente os dados aos quais possui permissão.

==================================================

19 — RESPONSIVIDADE

==================================================

O sistema deve funcionar perfeitamente em:

- Desktop;

- Notebook;

- Tablet;

- Celular.

No celular:

- sidebar vira menu;

- cards se reorganizam;

- tabelas possuem rolagem horizontal;

- formulários ficam adaptados;

- gráficos se ajustam à largura;

- nenhum conteúdo pode ficar cortado.

==================================================

20 — PESQUISA

==================================================

Manter a pesquisa no topo como na imagem.

Pesquisar no banco SQL por:

- número do animal;

- nome;

- lote;

- bezerro;

- vacina;

- inseminação.

Os resultados devem vir do banco.

==================================================

21 — EXPERIÊNCIA VISUAL

==================================================

Quero uma interface PREMIUM.

Não quero aparência de sistema administrativo genérico.

Reproduza a sensação visual da imagem:

- dashboard profissional;

- cards bem organizados;

- gráficos modernos;

- tabelas elegantes;

- ícones consistentes;

- microinterações;

- hover;

- transições suaves;

- estados de loading;

- estados vazios;

- estados de erro;

- confirmações antes de exclusões;

- feedback visual após salvar.

==================================================

22 — IMPORTANTE SOBRE A IMAGEM

==================================================

A imagem anexada é a REFERÊNCIA VISUAL.

COPIE CADA DETALHE POSSÍVEL.

Observe especialmente:

- largura da sidebar;

- posição do logo;

- cabeçalho;

- campo de pesquisa;

- cards superiores;

- espaçamento entre cards;

- gráficos;

- tabelas;

- cores;

- ícones;

- bordas;

- sombras;

- banner de gado;

- distribuição dos módulos;

- rodapé;

- hierarquia das informações.

Não simplesmente crie outro dashboard parecido.

Quero que a aplicação tenha a mesma linguagem visual e organização da referência, adaptada para funcionar de verdade.

==================================================

23 — REGRA FINAL

==================================================

NÃO finalize o projeto deixando:

- dados fake;

- botões sem função;

- gráficos estáticos;

- contadores fixos;

- tabelas com informações hardcoded;

- páginas vazias;

- CRUD incompleto;

- funcionalidades simuladas.

Tudo precisa estar conectado ao banco SQL.

O resultado final deve ser um sistema de gestão pecuária real chamado:

“APECUÁRIA DIGITAL”

com interface baseada fielmente na imagem de referência e com todas as funcionalidades descritas acima funcionando de ponta a ponta.

PRIORIDADE:

1. Banco SQL e estrutura de dados

2. Relacionamentos

3. CRUD completo

4. Regras de negócio

5. Dashboard dinâmico

6. Relatórios

7. Interface fiel à imagem

8. Responsividade

9. Segurança

10. Performance

Antes de considerar o projeto concluído, verifique se TODOS os módulos realmente salvam, consultam, editam e excluem dados no SQL e se o dashboard é atualizado com esses dados.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://digital-herd-manager.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f0b112ea-1ea9-47c4-9f49-3900f18a5608).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

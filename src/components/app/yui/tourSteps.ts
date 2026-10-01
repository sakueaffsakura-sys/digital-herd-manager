// Roteiro do "Tour pelo site" da Yui. Cada passo navega até uma seção (opcional),
// destaca um elemento da tela e é narrado em voz alta.
export type TourStep = {
  section?: string;
  /** Seletor CSS ou busca de botão por texto (prefixo "texto:") dentro da área principal. */
  alvo: string;
  titulo: string;
  fala: string;
};

export const TOUR: TourStep[] = [
  { alvo: "[data-tour='yui']", titulo: "Olá, eu sou a Yui!", fala: "Oi! Eu sou a Yui, sua assistente. Vou te mostrar cada parte do Pecuária Digital na prática. Pode relaxar e só acompanhar. Se quiser, use os botões para pausar, voltar, avançar ou sair a qualquer momento." },
  { section: "inicio", alvo: "[data-tour='nav-inicio']", titulo: "Menu lateral", fala: "Aqui do lado fica o menu. Cada item leva a uma área do sistema. Vamos começar pelo Início." },
  { section: "inicio", alvo: "[data-tour='conteudo']", titulo: "Início", fala: "O Início é o resumo da sua fazenda. Você vê o total de animais, as vacinas em dia e vencidas, as inseminações, quanto entrou e saiu de dinheiro no mês, comparado com o mês anterior, e gráficos dos últimos doze meses." },
  { section: "inicio", alvo: "texto:Cadastrar animal", titulo: "Atalhos rápidos", fala: "Esses botões são atalhos. Com um toque você cadastra um animal, registra o leite do dia ou vai direto para a vacinação. Se aparecer um aviso colorido no topo, é algo importante, como vacina vencida ou parto chegando." },
  { section: "rebanho", alvo: "[data-tour='nav-rebanho']", titulo: "Meu Rebanho", fala: "Agora o Meu Rebanho. Aqui fica a lista de todos os seus animais, com brinco, nome, sexo, raça e situação." },
  { section: "rebanho", alvo: "texto:Novo", titulo: "Cadastrar um animal", fala: "Para cadastrar um animal, toque neste botão de novo registro. Preencha o número do brinco, o nome, o sexo e o que mais souber, e toque em salvar. Para editar ou excluir, use os botões na linha do animal. Antes de excluir, o sistema sempre pede confirmação." },
  { section: "rebanho", alvo: "[data-tour='conteudo']", titulo: "Busca e filtros", fala: "Em cada lista você pode pesquisar pelo nome ou brinco, e filtrar por data com os botões Todos, Hoje, Este mês e Este ano. Também dá para escolher quantos registros ver por página." },
  { section: "bezerros", alvo: "[data-tour='nav-bezerros']", titulo: "Evolução dos Bezerros", fala: "Em Evolução dos Bezerros você registra as pesagens: escolhe o bezerro, a data e o peso em quilos. Assim acompanha se ele está crescendo bem." },
  { section: "vacinacao", alvo: "[data-tour='nav-vacinacao']", titulo: "Vacinação", fala: "Na Vacinação você registra cada aplicação, com a vacina, o animal ou o lote, a data e a próxima dose. As vacinas vencidas ficam em vermelho." },
  { section: "vacinacao", alvo: "texto:Tipos de vacina", titulo: "Tipos de vacina", fala: "Primeiro cadastre as vacinas que você usa nesta aba de Tipos de vacina, informando de quantos em quantos dias ela deve ser repetida. Depois é só registrar as aplicações." },
  { section: "inseminacao", alvo: "[data-tour='nav-inseminacao']", titulo: "Inseminação", fala: "Em Inseminação você acompanha a reprodução: a vaca, a data, o sêmen ou reprodutor, a previsão de parto e a situação, como em andamento, confirmada ou parto realizado." },
  { section: "nascimentos", alvo: "[data-tour='nav-nascimentos']", titulo: "Nascimentos", fala: "Em Nascimentos você liga a vaca ao bezerro que nasceu. Dica: cadastre o bezerro no rebanho antes. O sistema já marca quem é a mãe automaticamente." },
  { section: "lotes", alvo: "[data-tour='nav-lotes']", titulo: "Lotes", fala: "Os Lotes servem para organizar os animais em grupos, por pasto ou finalidade. Depois você pode filtrar e vacinar por lote." },
  { section: "producao", alvo: "[data-tour='nav-producao']", titulo: "Produção de Leite", fala: "Na Produção de Leite você registra os litros de cada vaca e o valor por litro. O total em reais é calculado sozinho. Na aba Anotações você guarda observações da ordenha." },
  { section: "relatorios", alvo: "[data-tour='nav-relatorios']", titulo: "Relatórios", fala: "Nos Relatórios você escolhe o tipo, como financeiro, leite, nascimentos ou compra e venda, e o mês que quer ver." },
  { section: "relatorios", alvo: "[data-tour='conteudo']", titulo: "Escolhendo o período", fala: "Use as setinhas para trocar de mês, ou escolha Ano inteiro. Só aparecem os registros do período escolhido, com totais, gráficos e comparação com o mês anterior." },
  { section: "financeiro", alvo: "[data-tour='nav-financeiro']", titulo: "Lucros e Investimentos", fala: "Em Lucros e Investimentos você lança receitas, despesas e investimentos. O lucro é calculado automaticamente." },
  { section: "comercial", alvo: "[data-tour='nav-comercial']", titulo: "Compra e Venda", fala: "Em Compra e Venda você registra o que comprou e vendeu. Quando vende um animal, ele é marcado como vendido e o valor entra no financeiro sozinho." },
  { alvo: "[data-tour='propriedade']", titulo: "Trocar de propriedade", fala: "Aqui em cima você escolhe a propriedade. Se tiver mais de uma fazenda, é só trocar, e todos os dados mudam para ela." },
  { alvo: "[data-tour='busca']", titulo: "Pesquisa", fala: "Esta barra pesquisa na página que está aberta. É o jeito mais rápido de achar um animal ou registro." },
  { alvo: "[data-tour='nav-perfil']", titulo: "Perfil e configurações", fala: "No Perfil você ajusta seus dados, a foto e o banner da propriedade, e vê o seu plano." },
  { section: "inicio", alvo: "[data-tour='yui']", titulo: "Pronto!", fala: "Pronto, terminamos o passeio! Sempre que tiver dúvida, é só tocar em mim aqui no canto e escrever a sua pergunta. Eu estou aqui para ajudar. Bom trabalho na fazenda!" },
];

export function acharAlvo(alvo: string): HTMLElement | null {
  if (alvo.startsWith("texto:")) {
    const t = alvo.slice(6).toLowerCase();
    const raiz = document.querySelector("[data-tour='conteudo']") ?? document.body;
    const botoes = [...raiz.querySelectorAll<HTMLElement>("button, a")];
    return botoes.find((b) => b.offsetParent && b.textContent?.trim().toLowerCase().startsWith(t)) ?? null;
  }
  const els = [...document.querySelectorAll<HTMLElement>(alvo)];
  return els.find((e) => e.getClientRects().length > 0 && e.offsetParent !== null) ?? els.find((e) => e.getClientRects().length > 0) ?? null;
}

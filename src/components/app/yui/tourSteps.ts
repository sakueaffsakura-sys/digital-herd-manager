// Roteiro do "Tour pelo site" da Yui. Cada passo navega até uma seção (opcional),
// destaca um elemento da tela e é narrado em voz alta.
export type TourStep = {
  section?: string;
  /** Seletor CSS ou busca de botão por texto (prefixo "texto:") dentro da área principal. */
  alvo: string;
  titulo: string;
  fala: string;
  /** Passo a passo mostrado na tela. */
  passos?: string[];
  /** Dica curta mostrada na tela. */
  dica?: string;
  /** Exemplo guiado exibido somente no tour; nunca grava uma anotação. */
  demonstracaoAnotacao?: boolean;
};

/** Exemplos que a Yui digita na demonstração de anotação; nada é salvo. */
export const EXEMPLOS_NOTA: { rotulo: string; valores: Record<string, string> }[] = [
  {
    rotulo: "Ordenha da manhã",
    valores: {
      producao: "12.5",
      observacao: "Vaca comeu bem e ficou calma na ordenha da manhã.",
      comportamento: "Tranquila",
      alimentacao: "Silagem e ração no cocho, água à vontade.",
    },
  },
  {
    rotulo: "Ordenha da tarde",
    valores: {
      producao: "9.8",
      observacao: "Ordenha da tarde tranquila, com volume menor que o da manhã.",
      comportamento: "Calma",
      alimentacao: "Capim fresco no piquete antes da ordenha.",
    },
  },
  {
    rotulo: "Animal observado",
    valores: {
      producao: "",
      observacao: "Vaca 08 apresentou apatia e comeu menos na vistoria de hoje.",
      comportamento: "Apática",
      alimentacao: "Comeu pouco; deixar água fresca à vontade.",
      informacoes_adicionais: "Reavaliar amanhã; se piorar, chamar o veterinário.",
    },
  },
  {
    rotulo: "Carrapato",
    valores: {
      producao: "",
      observacao: "Vaca 05 com muitos carrapatos no dorso; aplicado banho carrapaticida.",
      comportamento: "Inquieta",
      alimentacao: "Comeu normalmente.",
      informacoes_adicionais: "Repetir o banho em 21 dias e conferir a dose do produto.",
    },
  },
  {
    rotulo: "Troca de lote",
    valores: {
      producao: "",
      observacao: "Vaca 12 foi levada para o lote de engorda após a pesagem de hoje.",
      comportamento: "Normal",
      alimentacao: "Começando a transição para a ração de engorda.",
      informacoes_adicionais: "Acompanhar o peso nos próximos dias para conferir a adaptação.",
    },
  },
];

export const TOUR: TourStep[] = [
  { alvo: "[data-tour='yui']", titulo: "Olá, seja bem-vindo!", fala: "Oi! Eu sou a assistente virtual do Pecuária Digital, criada para dar suporte aos usuários que tiverem dificuldade ou dúvidas. Vou te mostrar cada parte do sistema na prática. Pode relaxar e só acompanhar. Se quiser, use os botões para pausar, voltar, avançar ou sair a qualquer momento." },
  { section: "inicio", alvo: "[data-tour='nav-inicio']", titulo: "Menu lateral", fala: "Aqui do lado fica o menu. Cada item leva a uma área do sistema. Vamos começar pelo Início.", passos: ["Toque no nome da área no menu", "A página abre à direita", "No celular, toque em ☰ no topo para abrir o menu"] },
  { section: "inicio", alvo: "[data-tour='conteudo']", titulo: "Início", fala: "O Início é o resumo da sua fazenda. Você vê o total de animais, as vacinas em dia e vencidas, as inseminações, quanto entrou e saiu de dinheiro no mês, comparado com o mês anterior, e gráficos dos últimos doze meses.", dica: "Toque em qualquer cartão de número para ir direto para a área dele." },
  { section: "inicio", alvo: "texto:Cadastrar animal", titulo: "Atalhos rápidos", fala: "Esses botões são atalhos. Com um toque você cadastra um animal, registra o leite do dia ou vai direto para a vacinação. Se aparecer um aviso colorido no topo, é algo importante, como vacina vencida ou parto chegando.", passos: ["Toque em \"Cadastrar animal\" para um animal novo", "Toque em \"Registrar leite\" para a ordenha do dia", "Toque em \"Vacinação\" para registrar uma vacina"] },
  { section: "rebanho", alvo: "[data-tour='nav-rebanho']", titulo: "Meu Rebanho", fala: "Agora o Meu Rebanho. Aqui fica a lista de todos os seus animais, com brinco, nome, sexo, raça e situação." },
  { section: "rebanho", alvo: "texto:Novo", titulo: "Cadastrar um animal", fala: "Para cadastrar um animal, toque neste botão de novo registro. Preencha o número do brinco, o nome, o sexo e o que mais souber, e toque em salvar. Para editar ou excluir, use os botões na linha do animal. Antes de excluir, o sistema sempre pede confirmação.", passos: ["Toque em \"Novo\"", "Preencha brinco, nome e sexo (o resto é opcional)", "Toque em \"Salvar\"", "Para mudar, use o lápis na linha; para apagar, a lixeira"], dica: "Tem muitos animais? Use a importação de planilha." },
  { section: "rebanho", alvo: "[data-tour='conteudo']", titulo: "Busca e filtros", fala: "Em cada lista você pode pesquisar pelo nome ou brinco, e filtrar por data com os botões Todos, Hoje, Este mês e Este ano. Também dá para escolher quantos registros ver por página.", passos: ["Digite o nome ou brinco na busca", "Toque em Hoje, Este mês ou Este ano para filtrar", "Toque em Todos para ver tudo de novo"] },
  { section: "bezerros", alvo: "[data-tour='nav-bezerros']", titulo: "Evolução dos Bezerros", fala: "Em Evolução dos Bezerros você registra as pesagens: escolhe o bezerro, a data e o peso em quilos. Assim acompanha se ele está crescendo bem.", passos: ["Toque em \"Novo\"", "Escolha o bezerro e a data", "Digite o peso em kg e salve"], dica: "Pese sempre no mesmo dia da semana para comparar melhor." },
  { section: "vacinacao", alvo: "[data-tour='nav-vacinacao']", titulo: "Vacinação", fala: "Na Vacinação você registra cada aplicação, com a vacina, o animal ou o lote, a data e a próxima dose. As vacinas vencidas ficam em vermelho.", passos: ["Toque em \"Novo\"", "Escolha a vacina e o animal ou lote", "Informe a data e salve — a próxima dose é calculada"] },
  { section: "vacinacao", alvo: "texto:Tipos de vacina", titulo: "Tipos de vacina", fala: "Primeiro cadastre as vacinas que você usa nesta aba de Tipos de vacina, informando de quantos em quantos dias ela deve ser repetida. Depois é só registrar as aplicações.", passos: ["Abra a aba \"Tipos de vacina\"", "Toque em \"Novo\" e escreva o nome", "Informe de quantos em quantos dias repetir"] },
  { section: "inseminacao", alvo: "[data-tour='nav-inseminacao']", titulo: "Inseminação", fala: "Em Inseminação você acompanha a reprodução: a vaca, a data, o sêmen ou reprodutor, a previsão de parto e a situação, como em andamento, confirmada ou parto realizado.", passos: ["Toque em \"Novo\"", "Escolha a vaca e a data", "Informe o sêmen ou reprodutor — a previsão de parto é calculada", "Atualize a situação quando confirmar"] },
  { section: "nascimentos", alvo: "[data-tour='nav-nascimentos']", titulo: "Nascimentos", fala: "Em Nascimentos você liga a vaca ao bezerro que nasceu. Dica: cadastre o bezerro no rebanho antes. O sistema já marca quem é a mãe automaticamente.", passos: ["Cadastre o bezerro em Meu Rebanho", "Volte aqui e toque em \"Novo\"", "Escolha a vaca, o bezerro e a data, e salve"] },
  { section: "lotes", alvo: "[data-tour='nav-lotes']", titulo: "Lotes", fala: "Os Lotes servem para organizar os animais em grupos, por pasto ou finalidade. Depois você pode filtrar e vacinar por lote.", passos: ["Toque em \"Novo\"", "Dê um nome (ex.: Pasto 1)", "No cadastro do animal, escolha o lote"] },
  { section: "producao", alvo: "[data-tour='nav-producao']", titulo: "Produção de Leite", fala: "Na Produção de Leite você registra os litros de cada vaca e o valor por litro. O total em reais é calculado sozinho. Na aba Anotações você guarda observações da ordenha.", passos: ["Toque em \"Novo\"", "Escolha a vaca e a data", "Digite os litros e o valor por litro — o total aparece sozinho"] },
  { section: "producao", alvo: "[data-tour='notas-nova']", titulo: "Vamos simular uma anotação", fala: "Abri a aba Anotações. Aqui fica o botão Nova anotação. Vou te mostrar um exemplo de como preencher: escolha a data, escreva uma observação e, se quiser, vincule um animal. Embaixo do formulário há vários exemplos, como ordenha, animal observado e troca de lote: toque em um para eu preencher outro caso. Este exemplo é só uma demonstração: nada será salvo na sua propriedade.", passos: ["Toque em Nova anotação", "Confirme a data e escreva sua observação", "Toque em um dos exemplos para eu preencher outro caso", "Toque em Salvar somente quando for uma anotação real"], demonstracaoAnotacao: true },
  { section: "relatorios", alvo: "[data-tour='nav-relatorios']", titulo: "Relatórios", fala: "Nos Relatórios você escolhe o tipo, como financeiro, leite, nascimentos ou compra e venda, e o mês que quer ver.", passos: ["Escolha o tipo de relatório", "Escolha o mês e o ano", "Veja totais, gráficos e a lista do período"] },
  { section: "relatorios", alvo: "[data-tour='conteudo']", titulo: "Escolhendo o período", fala: "Use as setinhas para trocar de mês, ou escolha Ano inteiro. Só aparecem os registros do período escolhido, com totais, gráficos e comparação com o mês anterior." },
  { section: "financeiro", alvo: "[data-tour='nav-financeiro']", titulo: "Lucros e Investimentos", fala: "Em Lucros e Investimentos você lança receitas, despesas e investimentos. O lucro é calculado automaticamente.", passos: ["Toque em \"Novo\"", "Escolha receita, despesa ou investimento", "Informe valor, data e descrição, e salve"] },
  { section: "comercial", alvo: "[data-tour='nav-comercial']", titulo: "Compra e Venda", fala: "Em Compra e Venda você registra o que comprou e vendeu. Quando vende um animal, ele é marcado como vendido e o valor entra no financeiro sozinho.", passos: ["Escolha Compras ou Vendas", "Toque em \"Novo\" e preencha", "Ao vender um animal, escolha ele na lista"], dica: "O valor entra no financeiro automaticamente." },
  { alvo: "[data-tour='propriedade']", titulo: "Trocar de propriedade", fala: "Aqui em cima você escolhe a propriedade. Se tiver mais de uma fazenda, é só trocar, e todos os dados mudam para ela.", passos: ["Toque no nome da propriedade", "Escolha outra fazenda ou cadastre uma nova"] },
  { alvo: "[data-tour='busca']", titulo: "Pesquisa", fala: "Esta barra pesquisa na página que está aberta. É o jeito mais rápido de achar um animal ou registro." },
  { alvo: "[data-tour='nav-perfil']", titulo: "Perfil e configurações", fala: "No Perfil você ajusta seus dados, a foto e o banner da propriedade, e vê o seu plano." },
  { section: "inicio", alvo: "[data-tour='yui']", titulo: "Pronto!", fala: "Pronto, terminamos o passeio! Sempre que tiver dúvida, é só tocar em mim aqui no canto e escrever a sua pergunta. Eu estou aqui para ajudar. Bom trabalho na fazenda!" },
];

// Recortes do roteiro existente: a ajuda de uma função não passa pelas outras páginas.
export const TOPICOS_TOUR = [
  { id: "inicio", nome: "Início e atalhos", passos: TOUR.filter((p) => p.section === "inicio" && p.titulo !== "Pronto!" && p.titulo !== "Menu lateral") },
  { id: "rebanho", nome: "Meu Rebanho", passos: TOUR.filter((p) => p.section === "rebanho") },
  { id: "bezerros", nome: "Evolução dos Bezerros", passos: TOUR.filter((p) => p.section === "bezerros") },
  { id: "vacinacao", nome: "Vacinação", passos: TOUR.filter((p) => p.section === "vacinacao") },
  { id: "inseminacao", nome: "Inseminação", passos: TOUR.filter((p) => p.section === "inseminacao") },
  { id: "nascimentos", nome: "Nascimentos", passos: TOUR.filter((p) => p.section === "nascimentos") },
  { id: "lotes", nome: "Lotes", passos: TOUR.filter((p) => p.section === "lotes") },
  { id: "producao", nome: "Produção de Leite", passos: TOUR.filter((p) => p.section === "producao") },
  { id: "relatorios", nome: "Relatórios", passos: TOUR.filter((p) => p.section === "relatorios") },
  { id: "financeiro", nome: "Lucros e Investimentos", passos: TOUR.filter((p) => p.section === "financeiro") },
  { id: "comercial", nome: "Compra e Venda", passos: TOUR.filter((p) => p.section === "comercial") },
  { id: "perfil", nome: "Perfil e configurações", passos: TOUR.filter((p) => p.titulo === "Perfil e configurações" || p.titulo === "Trocar de propriedade") },
] as const;

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

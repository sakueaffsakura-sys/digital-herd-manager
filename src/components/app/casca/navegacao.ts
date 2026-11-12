import {
  BookOpenText, Calculator, CalendarDays, CircleDollarSign, Crown, FlaskConical, Gauge, HeartPulse,
  KeyRound, LayoutDashboard, LifeBuoy, LineChart, Milk, ScrollText, ShoppingCart, Smartphone, Syringe, UserRound, Warehouse,
} from "lucide-react";
import { HerdIcon } from "../HerdIcon";
import { CalfIcon } from "../CalfIcon";
import { MODULOS_APLICATIVO } from "../modulos-aplicativo";
import type { IconType } from "../shared";

export type ItemMenu = { chave: string; rotulo: string; icone: IconType; frase: string };
export type GrupoMenu = { rotulo: string | null; itens: ItemMenu[]; oculto?: boolean };

/** Item de uma área que veio do aplicativo: nome, ícone e frase saem do próprio módulo. */
const doApp = (chave: string): ItemMenu => {
  const m = MODULOS_APLICATIVO[chave];
  return { chave, rotulo: m.title, icone: m.icon, frase: `${m.description}.` };
};

/** Menu do site, agrupado como o produtor pensa a fazenda. */
export const GRUPOS_MENU: GrupoMenu[] = [
  {
    rotulo: null,
    itens: [
      { chave: "inicio", rotulo: "Início", icone: LayoutDashboard, frase: "O resumo da fazenda hoje." },
      { chave: "agenda", rotulo: "Agenda", icone: CalendarDays, frase: "Vacinas, partos e pesagens da semana e do mês." },
    ],
  },
  {
    rotulo: "Rebanho",
    itens: [
      { chave: "rebanho", rotulo: "Meu rebanho", icone: HerdIcon, frase: "Todos os animais, com brinco, lote e situação." },
      { chave: "lotes", rotulo: "Lotes", icone: Warehouse, frase: "Grupos de animais por pasto ou finalidade." },
      { chave: "bezerros", rotulo: "Evolução dos bezerros", icone: CalfIcon, frase: "Pesagens e ganho de peso dos animais jovens." },
      doApp("pastos"),
      doApp("pasto_mov"),
      doApp("mov_animais"),
      doApp("gta"),
      doApp("engorda"),
      doApp("animal_extra"),
      doApp("avaliacoes"),
    ],
  },
  {
    rotulo: "Sanidade",
    itens: [
      { chave: "vacinacao", rotulo: "Vacinação", icone: Syringe, frase: "Aplicações, próximas doses e vacinas atrasadas." },
      doApp("tratamentos"),
      doApp("campanhas"),
    ],
  },
  {
    rotulo: "Reprodução",
    itens: [
      { chave: "inseminacao", rotulo: "Inseminação", icone: FlaskConical, frase: "Inseminações e previsão de parto." },
      { chave: "nascimentos", rotulo: "Nascimentos", icone: HeartPulse, frase: "Quem nasceu, de qual vaca e quando." },
      doApp("cios"),
      doApp("ocorr_reprod"),
      doApp("bezerros_info"),
    ],
  },
  {
    rotulo: "Produção",
    itens: [
      { chave: "producao", rotulo: "Leite e anotações", icone: Milk, frase: "Litros por vaca e observações da ordenha." },
      doApp("qualidade_leite"),
    ],
  },
  {
    rotulo: "Alimentação e estoque",
    itens: [doApp("alimentacao"), doApp("planos_alim"), doApp("estoque_itens"), doApp("estoque_mov")],
  },
  {
    rotulo: "Lavoura e clima",
    itens: [
      doApp("talhoes"), doApp("plantios"), doApp("atividades_agro"),
      doApp("irrig_sistemas"), doApp("irrigacoes"), doApp("irrig_manut"), doApp("clima_obs"),
    ],
  },
  {
    rotulo: "Equipe e tarefas",
    itens: [doApp("tarefas"), doApp("funcionarios"), doApp("horas_trabalho"), doApp("ocorrencias")],
  },
  {
    rotulo: "Estrutura e parceiros",
    itens: [
      doApp("instalacoes"), doApp("maquinas"), doApp("manutencoes"),
      doApp("documentos"), doApp("fornecedores"), doApp("clientes"),
    ],
  },
  {
    rotulo: "Dinheiro",
    itens: [
      { chave: "financeiro", rotulo: "Lucros e investimentos", icone: CircleDollarSign, frase: "Receitas, despesas e investimentos lançados à mão." },
      doApp("lancamentos"),
      { chave: "comercial", rotulo: "Compra e venda", icone: ShoppingCart, frase: "O que entrou e saiu; o valor vai sozinho para o financeiro." },
      doApp("pedidos_compra"),
      doApp("pedidos_venda"),
      doApp("contas"),
      doApp("cotacoes"),
      { chave: "relatorios", rotulo: "Relatórios", icone: ScrollText, frase: "Totais e listas por mês ou ano." },
      { chave: "indicadores", rotulo: "Indicadores", icone: LineChart, frase: "Prenhez, partos, ganho de peso e custo por litro." },
    ],
  },
  {
    rotulo: "Mais",
    itens: [
      { chave: "ferramentas", rotulo: "Calculadoras e clima", icone: Calculator, frase: "Dose pelo peso, ração, calagem, lotação e a previsão do tempo." },
      { chave: "biblioteca", rotulo: "Biblioteca", icone: BookOpenText, frase: "eBooks para assinantes." },
      { chave: "assinatura", rotulo: "Assinatura", icone: Crown, frase: "Seu plano, pagamentos e benefícios." },
      { chave: "aplicativo", rotulo: "Use no celular", icone: Smartphone, frase: "O aplicativo Android, que funciona sem internet." },
      { chave: "ajuda", rotulo: "Ajuda", icone: LifeBuoy, frase: "Perguntas frequentes e falar com o suporte." },
    ],
  },
  {
    // Ficam no menu da conta (avatar) e na busca, não na barra lateral.
    rotulo: "Conta",
    oculto: true,
    itens: [
      { chave: "perfil", rotulo: "Meu perfil", icone: UserRound, frase: "Seus dados e a foto do perfil." },
      { chave: "perfil-propriedade", rotulo: "Dados da propriedade", icone: Warehouse, frase: "Nome, cidade, logo, banner e contato da fazenda." },
      { chave: "seguranca", rotulo: "Senha e segurança", icone: KeyRound, frase: "Senha, duas etapas, aparelhos conectados e seus dados." },
      { chave: "diagnostico", rotulo: "Diagnóstico dos dados", icone: Gauge, frase: "Conferência técnica dos dados da propriedade." },
    ],
  },
];

const PORCHAVE = new Map(GRUPOS_MENU.flatMap((g) => g.itens.map((i) => [i.chave, i] as const)));

export function itemDoMenu(chave: string): ItemMenu | undefined {
  return PORCHAVE.get(chave);
}

/** Seções que existem nesta versão (as outras não aparecem). `lateral` tira os grupos ocultos da barra lateral. */
export function filtrarMenu(existe: (chave: string) => boolean, { lateral = false } = {}): GrupoMenu[] {
  return GRUPOS_MENU.filter((g) => !(lateral && g.oculto))
    .map((g) => ({ ...g, itens: g.itens.filter((i) => existe(i.chave)) }))
    .filter((g) => g.itens.length);
}

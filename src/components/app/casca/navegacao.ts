import {
  BookOpenText, Calculator, CalendarDays, CircleDollarSign, Crown, FlaskConical, Gauge, HeartPulse,
  KeyRound, LayoutDashboard, LifeBuoy, LineChart, Milk, ScrollText, ShoppingCart, Smartphone, Syringe, UserRound, Warehouse,
} from "lucide-react";
import { HerdIcon } from "../HerdIcon";
import { CalfIcon } from "../CalfIcon";
import type { IconType } from "../shared";

export type ItemMenu = { chave: string; rotulo: string; icone: IconType; frase: string };
export type GrupoMenu = { rotulo: string | null; itens: ItemMenu[]; oculto?: boolean };

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
    ],
  },
  { rotulo: "Sanidade", itens: [{ chave: "vacinacao", rotulo: "Vacinação", icone: Syringe, frase: "Aplicações, próximas doses e vacinas atrasadas." }] },
  {
    rotulo: "Reprodução",
    itens: [
      { chave: "inseminacao", rotulo: "Inseminação", icone: FlaskConical, frase: "Inseminações e previsão de parto." },
      { chave: "nascimentos", rotulo: "Nascimentos", icone: HeartPulse, frase: "Quem nasceu, de qual vaca e quando." },
    ],
  },
  { rotulo: "Produção", itens: [{ chave: "producao", rotulo: "Leite e anotações", icone: Milk, frase: "Litros por vaca e observações da ordenha." }] },
  {
    rotulo: "Dinheiro",
    itens: [
      { chave: "financeiro", rotulo: "Lucros e investimentos", icone: CircleDollarSign, frase: "Receitas, despesas e investimentos lançados à mão." },
      { chave: "comercial", rotulo: "Compra e venda", icone: ShoppingCart, frase: "O que entrou e saiu; o valor vai sozinho para o financeiro." },
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

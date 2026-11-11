// Quem pode ver e mexer em cada tabela.
//
// GERADO por banco/mysql/escopos.py. Não edite à mão: rode o programa de novo.
//
// No banco antigo (PostgreSQL) quem separava uma fazenda da outra era o próprio banco.
// O MySQL não faz isso, então a separação passou para o servidor e começa nesta lista.
// Tabela nova sem escopo faz o gerador parar, para nenhuma nascer sem dono.

export type Escopo =
  | "propriedade" // linha de uma fazenda: só quem tem acesso à fazenda
  | "usuario" //     linha de uma pessoa: só ela
  | "proprio" //     a conta da própria pessoa
  | "fazendas" //    a lista de fazendas da pessoa
  | "publico" //     qualquer pessoa que entrou lê; só administrador grava
  | "admin" //       só administrador
  | "servidor"; //   nunca sai pela API

export const ESCOPO_DA_TABELA = {
  alimentacao: "propriedade",
  animais: "propriedade",
  animal_extra: "propriedade",
  anotacoes_producao: "propriedade",
  assinaturas: "propriedade",
  atividades_agro: "propriedade",
  avaliacoes: "propriedade",
  bezerros_info: "propriedade",
  bloqueios_acesso: "admin",
  campanhas: "propriedade",
  chaves_sistema: "servidor",
  cios: "propriedade",
  clientes: "propriedade",
  clima_obs: "propriedade",
  compras: "propriedade",
  configuracoes: "propriedade",
  configuracoes_sistema: "admin",
  contas: "propriedade",
  cotacoes: "propriedade",
  documentos: "propriedade",
  ebook_acessos: "usuario",
  ebooks: "publico",
  engorda: "propriedade",
  estoque_itens: "propriedade",
  estoque_mov: "propriedade",
  eventos_seguranca: "admin",
  fornecedores: "propriedade",
  funcionarios: "propriedade",
  gta: "propriedade",
  horas_trabalho: "propriedade",
  imagens_site: "publico",
  importacoes: "propriedade",
  incidentes_seguranca: "usuario",
  inseminacoes: "propriedade",
  instalacoes: "propriedade",
  investimentos: "propriedade",
  irrig_manut: "propriedade",
  irrig_sistemas: "propriedade",
  irrigacoes: "propriedade",
  lancamentos: "propriedade",
  lotes: "propriedade",
  manutencao_config: "publico",
  manutencao_historico: "usuario",
  manutencoes: "propriedade",
  maquinas: "propriedade",
  mov_animais: "propriedade",
  movimentacoes_financeiras: "propriedade",
  nascimentos: "propriedade",
  notificacoes: "usuario",
  ocorr_reprod: "propriedade",
  ocorrencias: "propriedade",
  pagamentos: "propriedade",
  pasto_mov: "propriedade",
  pastos: "propriedade",
  pedidos_compra: "propriedade",
  pedidos_venda: "propriedade",
  pesagens: "propriedade",
  plano_auditoria: "admin",
  planos: "publico",
  planos_alim: "propriedade",
  plantios: "propriedade",
  presenca_usuarios: "usuario",
  producao_leite: "propriedade",
  profiles: "proprio",
  propriedade_membros: "propriedade",
  propriedade_perfil: "propriedade",
  propriedades: "fazendas",
  qualidade_leite: "propriedade",
  rate_limits: "servidor",
  registros_excluidos: "propriedade",
  solicitacoes_exclusao: "usuario",
  suporte_contatos: "usuario",
  suporte_mensagens: "usuario",
  talhoes: "propriedade",
  tarefas: "propriedade",
  tipos_vacinas: "propriedade",
  tratamentos: "propriedade",
  user_roles: "usuario",
  v_animais_por_lote: "propriedade",
  v_financeiro_mensal: "propriedade",
  v_financeiro_por_categoria: "propriedade",
  v_producao_mensal: "propriedade",
  v_producao_por_lote: "propriedade",
  vacinacoes: "propriedade",
  vendas: "propriedade",
  yui_uso: "usuario",
} as const satisfies Record<string, Escopo>;

export type TabelaDeDados = keyof typeof ESCOPO_DA_TABELA;

/** Tabela desconhecida nunca é tratada como pública: na dúvida, ninguém entra. */
export function escopoDa(tabela: string): Escopo | null {
  return (ESCOPO_DA_TABELA as Record<string, Escopo>)[tabela] ?? null;
}

/**
 * As visões: resumos por mês e por lote. Só leitura — ninguém grava num resumo, e uma
 * tentativa é recusada em vez de virar erro do banco.
 */
export const SOMENTE_LEITURA: ReadonlySet<string> = new Set([
  "v_animais_por_lote",
  "v_financeiro_mensal",
  "v_financeiro_por_categoria",
  "v_producao_mensal",
  "v_producao_por_lote",
]);

/**
 * A ordem de apagar o que é de uma fazenda: primeiro quem aponta, depois quem é apontado.
 *
 * No banco antigo bastava apagar a linha da fazenda. O MySQL confere as referências na
 * hora, e não no fim da operação, então apagar direto esbarra em `nascimentos`, que
 * aponta para `animais`. Por isso o servidor apaga na ordem.
 */
export const ORDEM_DE_EXCLUSAO = [
  "atividades_agro",
  "alimentacao",
  "vendas",
  "vacinacoes",
  "tratamentos",
  "tarefas",
  "producao_leite",
  "planos_alim",
  "pesagens",
  "pedidos_venda",
  "pedidos_compra",
  "pasto_mov",
  "ocorr_reprod",
  "nascimentos",
  "mov_animais",
  "manutencoes",
  "lancamentos",
  "irrig_manut",
  "investimentos",
  "inseminacoes",
  "gta",
  "estoque_mov",
  "estoque_itens",
  "engorda",
  "documentos",
  "contas",
  "compras",
  "cios",
  "bezerros_info",
  "avaliacoes",
  "anotacoes_producao",
  "animal_extra",
  "animais",
  "propriedade_perfil",
  "propriedade_membros",
  "plantios",
  "pastos",
  "pagamentos",
  "ocorrencias",
  "movimentacoes_financeiras",
  "maquinas",
  "lotes",
  "irrigacoes",
  "irrig_sistemas",
  "instalacoes",
  "importacoes",
  "horas_trabalho",
  "funcionarios",
  "fornecedores",
  "cotacoes",
  "configuracoes",
  "clima_obs",
  "clientes",
  "campanhas",
  "assinaturas",
  "tipos_vacinas",
  "talhoes",
  "registros_excluidos",
  "qualidade_leite",
] as const;

/**
 * As consultas prontas que as telas pediam ao banco antigo por nome.
 *
 * No PostgreSQL elas eram funções guardadas dentro do banco. O MySQL também guardaria,
 * mas função dentro do banco não aparece no histórico do código, não tem teste e não dá
 * para ler num pedido de revisão. Então elas vivem aqui, como código normal.
 *
 * Toda consulta recebe quem está pedindo e usa as fazendas dessa pessoa — nunca uma
 * fazenda que o navegador mandou sem conferência.
 */
import { consultar, consultarUm, executar, instanteUtc } from "./banco.server";
import { exigirAdmin, exigirPropriedade, AcessoNegado, type Quem } from "./acesso";
import { resumoDoToken } from "@/lib/conta/sessao";
import { dashboardResumo } from "./resumo.server";
import { centralAvisos } from "./avisos.server";
import { agendaPeriodo, semanaDeHoje } from "./agenda.server";
import { indicadoresPropriedade } from "./indicadores.server";
import { minhaAreaAssinante, souAssinante, registrosInconsistentes } from "./assinante.server";
import { relatorioIndicadores, diagnosticoPropriedade, appSincronizar } from "./relatorios.server";
import { registrarIncidente, tentativaDeBloqueado } from "./seguranca-banco.server";
import {
  adminPagamentos, adminEbooksResumo, adminExigir2fa, adminResponderSuporte,
  setarPlanoDemonstracao, cancelarPlanoDemonstracao,
} from "./admin.server";

export type Consulta = (quem: Quem, argumentos: Record<string, unknown>) => Promise<unknown>;

/**
 * Um texto dos argumentos, aceitando os dois nomes.
 *
 * As telas foram escritas contra as funções do PostgreSQL, que chamavam os parâmetros com
 * sublinhado na frente (`_motivo`). Aceitar as duas formas deixa trocar o import das telas
 * sem reescrever cada chamada.
 */
const texto = (argumentos: Record<string, unknown>, nome: string): string | null => {
  const v = argumentos[nome] ?? argumentos[`_${nome}`];
  return typeof v === "string" && v.trim() ? v : null;
};

const propriedadeDe = (quem: Quem, argumentos: Record<string, unknown>): string => {
  const id = String(argumentos["propriedade_id"] ?? argumentos["_propriedade_id"] ?? "");
  if (!id) throw new AcessoNegado("Diga de qual fazenda.");
  exigirPropriedade(quem, id);
  return id;
};

/** Situação da manutenção do site. Todo mundo pode ler: é o aviso da tela. */
async function estadoManutencao(): Promise<unknown> {
  const linha = await consultarUm<{ status: string; titulo: string; mensagem: string; modulos: string; termina_em: string | null }>(
    "SELECT status, titulo, mensagem, modulos, termina_em FROM manutencao_config WHERE id = 1",
  );
  if (!linha) return { status: "ativo", titulo: "", mensagem: "", modulos: [], termina_em: null };
  return { ...linha, modulos: lerLista(linha.modulos) };
}

function lerLista(valor: unknown): string[] {
  if (Array.isArray(valor)) return valor.map(String);
  if (typeof valor === "string") {
    try {
      const j = JSON.parse(valor);
      return Array.isArray(j) ? j.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** A assinatura da fazenda escolhida, com o plano e até quando vale. */
async function minhaAssinatura(quem: Quem, argumentos: Record<string, unknown>): Promise<unknown> {
  const propriedade = propriedadeDe(quem, argumentos);
  const linha = await consultarUm(
    `SELECT plano, status, origem, data_inicio, data_expiracao
     FROM assinaturas WHERE propriedade_id = ? ORDER BY created_at DESC LIMIT 1`,
    [propriedade],
  );
  return linha ?? { plano: "gratuito", status: "pendente", origem: null, data_inicio: null, data_expiracao: null };
}

/** Se a fazenda tem Premium valendo agora. */
/*
 * `sou_assinante` não recebe propriedade: a pergunta da biblioteca é "esta pessoa é
 * assinante em algum lugar", e quem responde é `assinante.server.ts`.
 */

/** As sessões abertas da pessoa, para ela poder encerrar as que não reconhece. */
async function minhasSessoes(quem: Quem): Promise<unknown> {
  return consultar(
    `SELECT id, criada_em, ultimo_uso, navegador, ip, aal FROM sessoes
     WHERE user_id = ? AND expira_em > ? ORDER BY ultimo_uso DESC LIMIT 50`,
    [quem.userId, instanteUtc()],
  );
}

/** Encerra uma sessão da própria pessoa. Sessão de outra pessoa não é encontrada. */
async function encerrarSessao(quem: Quem, argumentos: Record<string, unknown>): Promise<boolean> {
  const id = String(argumentos["sessao_id"] ?? argumentos["_sessao_id"] ?? "");
  if (!id) throw new AcessoNegado("Diga qual sessão encerrar.");
  const { afetadas } = await executar("DELETE FROM sessoes WHERE id = ? AND user_id = ?", [id, quem.userId]);
  return afetadas > 0;
}

/*
 * Os números do Início e a central de avisos moram em arquivo próprio: são as duas
 * consultas mais compridas, e as que mais aparecem na tela.
 */

/** Quantas mensagens de suporte esperam resposta, para o administrador. */
async function adminSuporte(quem: Quem): Promise<unknown> {
  exigirAdmin(quem);
  return consultar(
    `SELECT id, user_id, email, assunto, mensagem, status, resposta, criado_em
     FROM suporte_contatos ORDER BY criado_em DESC LIMIT 200`,
  );
}

/** Quem é administrador e já tem 2 fatores ligado. */
async function admin2faResumo(quem: Quem): Promise<unknown> {
  exigirAdmin(quem);
  return consultar(
    `SELECT u.id, u.email, u.ultimo_acesso,
            EXISTS (SELECT 1 FROM fatores_2fa f WHERE f.user_id = u.id AND f.confirmado_em IS NOT NULL) AS tem_2fa
     FROM usuarios u
     JOIN user_roles r ON r.user_id = u.id AND r.role = 'administrador'
     ORDER BY u.email`,
  );
}

export const CONSULTAS: Record<string, Consulta> = {
  estado_manutencao: () => estadoManutencao(),
  sou_admin: async (quem) => quem.admin,
  pode_gerenciar_planos: async (quem) => quem.admin,
  minha_assinatura: minhaAssinatura,
  sou_assinante: (quem) => souAssinante(quem),
  minha_area_assinante: (quem) => minhaAreaAssinante(quem),
  registros_inconsistentes: (quem, argumentos) => registrosInconsistentes(quem, propriedadeDe(quem, argumentos)),
  minhas_sessoes: (quem) => minhasSessoes(quem),
  encerrar_sessao: encerrarSessao,
  dashboard_resumo: (quem, argumentos) => dashboardResumo(quem, propriedadeDe(quem, argumentos)),
  central_avisos: (quem, argumentos) => centralAvisos(quem, propriedadeDe(quem, argumentos)),
  indicadores_propriedade: (quem, argumentos) => indicadoresPropriedade(quem, propriedadeDe(quem, argumentos)),
  agenda_periodo: (quem, argumentos) => {
    const [padraoDe, padraoAte] = semanaDeHoje();
    return agendaPeriodo(
      quem,
      propriedadeDe(quem, argumentos),
      String(argumentos["de"] ?? argumentos["_de"] ?? padraoDe),
      String(argumentos["ate"] ?? argumentos["_ate"] ?? padraoAte),
    );
  },
  relatorio_indicadores: (quem, a) =>
    relatorioIndicadores(quem, propriedadeDe(quem, a), a["de"] ?? a["_de"], a["ate"] ?? a["_ate"]),
  diagnostico_propriedade: (quem, a) => diagnosticoPropriedade(quem, propriedadeDe(quem, a)),
  app_sincronizar: (quem, a) =>
    appSincronizar(
      quem,
      String(a["propriedade_id"] ?? a["p_propriedade_id"] ?? propriedadeDe(quem, a)),
      a["tabela"] ?? a["p_tabela"],
      a["apos_updated_at"] ?? a["p_apos_updated_at"],
      a["apos_id"] ?? a["p_apos_id"],
      a["limite"] ?? a["p_limite"],
    ),

  // Segurança: registrar o incidente é do próprio servidor, mas a tela de entrada também
  // avisa quando alguém já bloqueado tenta de novo.
  seg_registrar_incidente: (quem, a) =>
    registrarIncidente({
      tipo: texto(a, "tipo") ?? "desconhecido",
      severidade: texto(a, "severidade"),
      ip: texto(a, "ip"),
      dispositivo: texto(a, "disp"),
      // De quem é o incidente é SEMPRE a pessoa do pedido: aceitar o identificador de fora
      // deixaria qualquer um registrar incidente (e bloqueio) no nome de outra pessoa.
      userId: quem.userId,
      caminho: texto(a, "caminho"),
      metodo: texto(a, "metodo"),
      agente: texto(a, "agente"),
      motivo: texto(a, "motivo"),
      detalhes: a["detalhes"] ?? a["_detalhes"],
      // Bloquear é decisão do servidor, nunca do pedido.
      bloquear: false,
    }),
  seg_tentativa_bloqueado: async (_quem, a) => {
    await tentativaDeBloqueado(a["tipo"] ?? a["_tipo"], a["valor"] ?? a["_valor"]);
    return null;
  },

  admin_suporte: (quem) => adminSuporte(quem),
  admin_2fa_resumo: (quem) => admin2faResumo(quem),
  admin_pagamentos: (quem, a) => adminPagamentos(quem, a["status"] ?? a["_status"], a["limite"] ?? a["_limite"]),
  admin_ebooks_resumo: (quem) => adminEbooksResumo(quem),
  admin_exigir_2fa: (quem, a) => adminExigir2fa(quem, a["ligar"] ?? a["_ligar"]),
  admin_responder_suporte: (quem, a) =>
    adminResponderSuporte(quem, a["id"] ?? a["_id"], a["resposta"] ?? a["_resposta"], a["fechar"] ?? a["_fechar"]),
  setar_plano_demonstracao: (quem, a) =>
    setarPlanoDemonstracao(
      quem,
      String(a["propriedade_id"] ?? a["_propriedade_id"] ?? ""),
      a["plano"] ?? a["_plano"],
      a["status"] ?? a["_status"],
      a["data_expiracao"] ?? a["_data_expiracao"],
      a["motivo"] ?? a["_motivo"],
    ),
  cancelar_plano_demonstracao: (quem, a) =>
    cancelarPlanoDemonstracao(quem, String(a["propriedade_id"] ?? a["_propriedade_id"] ?? ""), a["motivo"] ?? a["_motivo"]),
};

/** Nome que não está na lista é recusado; nunca repassado ao banco. */
export async function rodarConsulta(nome: string, quem: Quem, argumentos: Record<string, unknown>): Promise<unknown> {
  const consulta = CONSULTAS[nome];
  if (!consulta) throw new AcessoNegado(`A consulta "${nome}" não existe.`);
  return consulta(quem, argumentos ?? {});
}

/** Usado pelo login para encerrar a sessão atual a partir do cookie. */
export const resumoDaSessao = resumoDoToken;

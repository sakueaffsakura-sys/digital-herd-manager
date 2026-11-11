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

export type Consulta = (quem: Quem, argumentos: Record<string, unknown>) => Promise<unknown>;

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
async function souAssinante(quem: Quem, argumentos: Record<string, unknown>): Promise<boolean> {
  const propriedade = propriedadeDe(quem, argumentos);
  const linha = await consultarUm<{ quantas: number }>(
    `SELECT COUNT(*) AS quantas FROM assinaturas
     WHERE propriedade_id = ? AND plano = 'premium' AND status IN ('ativo','trial')
       AND (data_expiracao IS NULL OR data_expiracao > ?)`,
    [propriedade, instanteUtc()],
  );
  return Number(linha?.quantas ?? 0) > 0;
}

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

/** Números da tela inicial de uma fazenda. */
async function dashboardResumo(quem: Quem, argumentos: Record<string, unknown>): Promise<unknown> {
  const p = [propriedadeDe(quem, argumentos)];
  const [animais, lotes, leite, pendentes] = await Promise.all([
    consultarUm<{ total: number; femeas: number; machos: number }>(
      `SELECT COUNT(*) AS total,
              SUM(sexo = 'F') AS femeas,
              SUM(sexo = 'M') AS machos
       FROM animais WHERE propriedade_id = ? AND situacao = 'ativo'`, p),
    consultarUm<{ total: number }>("SELECT COUNT(*) AS total FROM lotes WHERE propriedade_id = ? AND ativo = 1", p),
    consultarUm<{ litros: number }>(
      `SELECT COALESCE(SUM(litros), 0) AS litros FROM producao_leite
       WHERE propriedade_id = ? AND data >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`, p),
    consultarUm<{ total: number }>(
      "SELECT COUNT(*) AS total FROM tarefas WHERE propriedade_id = ? AND status <> 'Concluída'", p),
  ]);
  return {
    animais_ativos: Number(animais?.total ?? 0),
    femeas: Number(animais?.femeas ?? 0),
    machos: Number(animais?.machos ?? 0),
    lotes_ativos: Number(lotes?.total ?? 0),
    litros_7dias: Number(leite?.litros ?? 0),
    tarefas_pendentes: Number(pendentes?.total ?? 0),
  };
}

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
  sou_assinante: souAssinante,
  minhas_sessoes: (quem) => minhasSessoes(quem),
  encerrar_sessao: encerrarSessao,
  dashboard_resumo: dashboardResumo,
  admin_suporte: (quem) => adminSuporte(quem),
  admin_2fa_resumo: (quem) => admin2faResumo(quem),
};

/** Nome que não está na lista é recusado; nunca repassado ao banco. */
export async function rodarConsulta(nome: string, quem: Quem, argumentos: Record<string, unknown>): Promise<unknown> {
  const consulta = CONSULTAS[nome];
  if (!consulta) throw new AcessoNegado(`A consulta "${nome}" não existe.`);
  return consulta(quem, argumentos ?? {});
}

/** Usado pelo login para encerrar a sessão atual a partir do cookie. */
export const resumoDaSessao = resumoDoToken;

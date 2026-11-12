/**
 * Relatório por período, diagnóstico das tabelas e a sincronização do aplicativo.
 *
 * As três eram funções SQL que montavam o nome da tabela dentro da própria consulta
 * (`format('... FROM public.%I ...')`). Aqui a lista de tabelas é fixa no código: nome de
 * tabela nunca chega do navegador, porque chegar seria convite a pedir qualquer outra.
 */
import { consultar, consultarUm } from "./banco.server";
import { exigirPropriedade, AcessoNegado, type Quem } from "./acesso";
import { isoValido } from "@/lib/datas";

/** O que o relatório e o diagnóstico olham. Fixa de propósito: não vem do pedido. */
const TABELAS_DO_DIAGNOSTICO = [
  "animais", "lotes", "pesagens", "vacinacoes", "inseminacoes", "nascimentos", "producao_leite",
  "anotacoes_producao", "movimentacoes_financeiras", "investimentos", "compras", "vendas", "tipos_vacinas",
] as const;

/** O que o aplicativo Android pode baixar. Mesma lista de antes, nem mais nem menos. */
const TABELAS_DO_APLICATIVO = [
  "animais", "lotes", "tipos_vacinas", "vacinacoes", "inseminacoes", "nascimentos", "pesagens",
  "producao_leite", "anotacoes_producao", "movimentacoes_financeiras", "investimentos", "compras", "vendas",
] as const;

/** Sem período, o relatório é da fazenda inteira, desde sempre. */
const DESDE_SEMPRE = "1000-01-01";
const ATE_SEMPRE = "9999-12-31";

const periodo = (de?: unknown, ate?: unknown): [string, string] => {
  const d = typeof de === "string" && isoValido(de) ? de : DESDE_SEMPRE;
  const a = typeof ate === "string" && isoValido(ate) ? ate : ATE_SEMPRE;
  if (a < d) throw new AcessoNegado("A data final não pode ser antes da inicial.");
  return [d, a];
};

export async function relatorioIndicadores(
  quem: Quem,
  propriedadeId: string,
  de?: unknown,
  ate?: unknown,
): Promise<Record<string, number>> {
  exigirPropriedade(quem, propriedadeId);
  const [d, a] = periodo(de, ate);
  const p = propriedadeId;

  const [animais, nascidos, perdas, vendas, compras, leite, dinheiro] = await Promise.all([
    consultarUm<{ q: number }>("SELECT COUNT(*) AS q FROM animais WHERE propriedade_id = ? AND situacao = 'ativo'", [p]),
    consultarUm<{ q: number }>("SELECT COUNT(*) AS q FROM nascimentos WHERE propriedade_id = ? AND data_nascimento BETWEEN ? AND ?", [p, d, a]),
    consultarUm<{ q: number }>(
      `SELECT COUNT(*) AS q FROM animais
       WHERE propriedade_id = ? AND situacao IN ('perdido', 'falecido') AND DATE(updated_at) BETWEEN ? AND ?`,
      [p, d, a],
    ),
    consultarUm<{ q: number; valor: number }>(
      "SELECT COUNT(*) AS q, COALESCE(SUM(valor), 0) AS valor FROM vendas WHERE propriedade_id = ? AND data BETWEEN ? AND ?", [p, d, a],
    ),
    consultarUm<{ q: number; valor: number }>(
      "SELECT COUNT(*) AS q, COALESCE(SUM(valor), 0) AS valor FROM compras WHERE propriedade_id = ? AND data BETWEEN ? AND ?", [p, d, a],
    ),
    consultarUm<{ litros: number; valor: number }>(
      `SELECT COALESCE(SUM(litros), 0) AS litros, COALESCE(SUM(valor_total), 0) AS valor
       FROM producao_leite WHERE propriedade_id = ? AND data BETWEEN ? AND ?`, [p, d, a],
    ),
    consultarUm<{ receitas: number; despesas: number; investimentos: number }>(
      `SELECT COALESCE(SUM(CASE WHEN tipo = 'receita' THEN valor END), 0) AS receitas,
              COALESCE(SUM(CASE WHEN tipo = 'despesa' THEN valor END), 0) AS despesas,
              COALESCE(SUM(CASE WHEN tipo = 'investimento' THEN valor END), 0) AS investimentos
       FROM movimentacoes_financeiras WHERE propriedade_id = ? AND data BETWEEN ? AND ?`, [p, d, a],
    ),
  ]);

  const n = (v: unknown) => Number(v ?? 0);
  return {
    animais_ativos: n(animais?.q),
    nascidos: n(nascidos?.q),
    perdas: n(perdas?.q),
    vendas_qtd: n(vendas?.q),
    vendas_valor: n(vendas?.valor),
    compras_qtd: n(compras?.q),
    compras_valor: n(compras?.valor),
    litros: n(leite?.litros),
    valor_leite: n(leite?.valor),
    receitas: n(dinheiro?.receitas),
    despesas: n(dinheiro?.despesas),
    investimentos: n(dinheiro?.investimentos),
  };
}

export type LinhaDiagnostico = { tabela: string; contagem: number; ultima_atualizacao: string | null; tempo_ms: number };

/**
 * Quantas linhas e quando foi a última mudança em cada tabela da fazenda, com o tempo que
 * a leitura levou. Serve para a pessoa ver se a sincronização do celular está em dia e se
 * alguma área ficou lenta.
 */
export async function diagnosticoPropriedade(quem: Quem, propriedadeId: string): Promise<LinhaDiagnostico[]> {
  exigirPropriedade(quem, propriedadeId);
  const linhas: LinhaDiagnostico[] = [];
  for (const tabela of TABELAS_DO_DIAGNOSTICO) {
    const inicio = performance.now();
    const r = await consultarUm<{ contagem: number; ultima: Date | string | null }>(
      `SELECT COUNT(*) AS contagem, MAX(updated_at) AS ultima FROM \`${tabela}\` WHERE propriedade_id = ?`,
      [propriedadeId],
    );
    linhas.push({
      tabela,
      contagem: Number(r?.contagem ?? 0),
      ultima_atualizacao: r?.ultima ? new Date(r.ultima as string | Date).toISOString() : null,
      tempo_ms: Math.round((performance.now() - inicio) * 100) / 100,
    });
  }
  return linhas;
}

/**
 * A página seguinte de uma tabela, para o aplicativo baixar o que mudou desde a última vez.
 *
 * A marca de onde parou é o par (updated_at, id), não só a data: duas linhas salvas no
 * mesmo milésimo de segundo existem, e com só a data o aplicativo pularia uma delas ou
 * baixaria a mesma para sempre.
 */
export async function appSincronizar(
  quem: Quem,
  propriedadeId: string,
  tabela: unknown,
  aposAtualizacao?: unknown,
  aposId?: unknown,
  limite?: unknown,
): Promise<Record<string, unknown>[]> {
  exigirPropriedade(quem, propriedadeId);
  const nome = TABELAS_DO_APLICATIVO.find((t) => t === tabela);
  if (!nome) throw new AcessoNegado("Essa área não é sincronizável pelo aplicativo.");
  const quantas = Math.min(Math.max(Math.trunc(Number(limite ?? 1000)) || 1000, 1), 1000);
  const marca = aposAtualizacao ? new Date(String(aposAtualizacao)) : new Date(0);
  if (Number.isNaN(marca.getTime())) throw new AcessoNegado("Marca de sincronização inválida.");
  const idMarca = typeof aposId === "string" && aposId ? aposId : "00000000-0000-0000-0000-000000000000";

  return consultar<Record<string, unknown>>(
    `SELECT * FROM \`${nome}\`
     WHERE propriedade_id = ? AND (updated_at > ? OR (updated_at = ? AND id > ?))
     ORDER BY updated_at, id LIMIT ${quantas}`,
    [propriedadeId, marca, marca, idMarca],
  );
}

export type Exclusao = { id: string; excluido_em: string; exclusao_id: string };

/**
 * O que foi apagado nesta fazenda depois da marca, para o aplicativo apagar também.
 *
 * Sem isto, o registro apagado no site continuaria no celular para sempre: a lista de
 * mudanças traz o que existe, e o que não existe mais não aparece em lista nenhuma.
 *
 * A marca é o par (excluido_em, id), e não só a data, pelo mesmo motivo da sincronização
 * normal: várias exclusões cabem no mesmo milésimo de segundo. O `id` aqui é um número que
 * só cresce, o que o torna um desempate confiável.
 */
export async function exclusoesDoApp(
  quem: Quem,
  propriedadeId: string,
  tabela: unknown,
  aposExcluidoEm?: unknown,
  aposId?: unknown,
  limite = 1000,
): Promise<Exclusao[]> {
  exigirPropriedade(quem, propriedadeId);
  const nome = TABELAS_DO_APLICATIVO.find((x) => x === tabela);
  if (!nome) throw new AcessoNegado("Essa área não é sincronizável pelo aplicativo.");
  const quantas = Math.min(Math.max(Math.trunc(Number(limite)) || 1000, 1), 1000);

  const marca = aposExcluidoEm ? new Date(String(aposExcluidoEm)) : null;
  if (marca && Number.isNaN(marca.getTime())) throw new AcessoNegado("Marca de exclusão inválida.");
  const idMarca = typeof aposId === "string" && /^\d{1,19}$/.test(aposId) ? aposId : null;

  const onde = marca
    ? idMarca
      ? "AND (excluido_em > ? OR (excluido_em = ? AND id > ?))"
      : "AND excluido_em > ?"
    : "";
  const valores: unknown[] = [propriedadeId, nome];
  if (marca) {
    valores.push(marca);
    if (idMarca) valores.push(marca, idMarca);
  }

  const linhas = await consultar<{ id: number; registro_id: string; excluido_em: Date }>(
    `SELECT id, registro_id, excluido_em FROM registros_excluidos
     WHERE propriedade_id = ? AND tabela = ? ${onde}
     ORDER BY excluido_em, id LIMIT ${quantas}`,
    valores,
  );
  return linhas.map((l) => ({
    id: l.registro_id,
    excluido_em: new Date(l.excluido_em).toISOString(),
    exclusao_id: String(l.id),
  }));
}

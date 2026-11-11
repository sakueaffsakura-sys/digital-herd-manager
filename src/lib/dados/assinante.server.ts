/**
 * A área do assinante e a conferência de registros estranhos.
 *
 * Assinatura: vale sempre a **última** assinatura de cada propriedade, pela ordem de
 * criação. Renovar não apaga a anterior, então contar todas faria uma propriedade
 * renovada três vezes aparecer como três assinaturas — e uma cancelada e depois renovada
 * aparecer como cancelada.
 *
 * `dias_restantes` arredonda para cima: faltando 30 horas, o produtor lê "2 dias", não
 * "1". É o que o banco antigo fazia, e é o lado certo de errar num aviso de vencimento.
 */
import { consultar, consultarUm, instanteUtc } from "./banco.server";
import { exigirPropriedade, type Quem } from "./acesso";
import { dataNoFuso, somarDias } from "@/lib/datas";

type LinhaAssinatura = {
  propriedade_id: string; propriedade: string; plano: string; status: string;
  origem: string | null; data_expiracao: Date | string | null;
};

export type AreaAssinante = {
  assinante: boolean;
  assinaturas: (Omit<LinhaAssinatura, "data_expiracao"> & {
    data_expiracao: string | null; ativa: boolean; dias_restantes: number | null;
  })[];
};

/**
 * A última assinatura de cada propriedade que a pessoa tem — como proprietária, ou como
 * quem pagou. No banco antigo era um `cross join lateral`; aqui a última linha sai por
 * ROW_NUMBER, que é o que o MySQL tem.
 */
const ULTIMA_POR_PROPRIEDADE = `
  SELECT p.id AS propriedade_id, p.nome AS propriedade, a.plano, a.status, a.origem,
         a.data_expiracao, a.user_id, p.proprietario_id, p.created_at
  FROM propriedades p
  JOIN (
    SELECT x.*, ROW_NUMBER() OVER (PARTITION BY x.propriedade_id ORDER BY x.created_at DESC) AS pos
    FROM assinaturas x
  ) a ON a.propriedade_id = p.id AND a.pos = 1
  WHERE p.proprietario_id = ? OR a.user_id = ?`;

export async function minhaAreaAssinante(quem: Quem): Promise<AreaAssinante> {
  const agora = new Date();
  const linhas = await consultar<LinhaAssinatura>(
    `${ULTIMA_POR_PROPRIEDADE} ORDER BY p.created_at`,
    [quem.userId, quem.userId],
  );

  const assinaturas = linhas.map((l) => {
    const vence = l.data_expiracao == null ? null : new Date(l.data_expiracao as string | Date);
    const ativa = l.plano === "premium" && ["ativo", "trial"].includes(l.status) && (vence === null || vence > agora);
    return {
      propriedade_id: l.propriedade_id,
      propriedade: l.propriedade,
      plano: l.plano,
      status: l.status,
      origem: l.origem,
      data_expiracao: vence ? vence.toISOString() : null,
      ativa,
      dias_restantes: vence === null ? null : Math.max(0, Math.ceil((vence.getTime() - agora.getTime()) / 86_400_000)),
    };
  });

  return { assinante: assinaturas.some((a) => a.ativa), assinaturas };
}

/** Só a resposta de sim ou não, para a tela que apenas libera ou bloqueia a biblioteca. */
export async function souAssinante(quem: Quem): Promise<boolean> {
  const linha = await consultarUm<{ tem: number }>(
    `SELECT COUNT(*) AS tem FROM (${ULTIMA_POR_PROPRIEDADE}) q
     WHERE q.plano = 'premium' AND q.status IN ('ativo', 'trial')
       AND (q.data_expiracao IS NULL OR q.data_expiracao > ?)`,
    [quem.userId, quem.userId, instanteUtc(new Date())],
  );
  return Number(linha?.tem ?? 0) > 0;
}

export type Inconsistencia = { tabela: string; checagem: string; qtd: number; exemplos: unknown[] };

/**
 * Registros que não podem estar certos. Não corrige nada: mostra para quem lançou decidir,
 * porque só essa pessoa sabe qual era o número verdadeiro.
 */
export async function registrosInconsistentes(quem: Quem, propriedadeId: string): Promise<Inconsistencia[]> {
  exigirPropriedade(quem, propriedadeId);
  const p = propriedadeId;
  // "Futuro" é a partir de amanhã no Brasil: um lançamento feito hoje à noite não é erro.
  const limite = somarDias(dataNoFuso(), 1);
  const achados: Inconsistencia[] = [];

  const [mesmoAnimal, noFuturo] = await Promise.all([
    consultarUm<{ q: number }>(
      "SELECT COUNT(*) AS q FROM nascimentos WHERE propriedade_id = ? AND vaca_id = bezerro_id",
      [p],
    ),
    consultarUm<{ q: number }>(
      `SELECT (SELECT COUNT(*) FROM pesagens WHERE propriedade_id = ? AND data > ?)
            + (SELECT COUNT(*) FROM producao_leite WHERE propriedade_id = ? AND data > ?)
            + (SELECT COUNT(*) FROM movimentacoes_financeiras WHERE propriedade_id = ? AND data > ?) AS q`,
      [p, limite, p, limite, p, limite],
    ),
  ]);

  if (Number(mesmoAnimal?.q ?? 0) > 0) {
    achados.push({ tabela: "nascimentos", checagem: "vaca igual ao bezerro", qtd: Number(mesmoAnimal!.q), exemplos: [] });
  }
  if (Number(noFuturo?.q ?? 0) > 0) {
    achados.push({ tabela: "datas", checagem: "registros com data no futuro", qtd: Number(noFuturo!.q), exemplos: [] });
  }
  return achados;
}

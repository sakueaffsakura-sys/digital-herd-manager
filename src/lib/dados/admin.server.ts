/**
 * O painel do administrador: pagamentos, eBooks, exigência de 2FA, resposta ao suporte e
 * o plano de demonstração.
 *
 * Toda função aqui começa por `exigirAdmin`. No banco antigo, estas eram funções
 * SECURITY DEFINER — rodavam com poder de dono e conferiam o papel na primeira linha.
 * Aqui o poder é o do servidor, e a conferência continua sendo a primeira linha: é o
 * único lugar onde ela existe.
 */
import { consultar, consultarUm, executar, emTransacao, executarEm, instanteUtc } from "./banco.server";
import { exigirAdmin, usou2fa, AcessoNegado, type Quem } from "./acesso";

const umTexto = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Os pagamentos, do mais novo para o mais velho, com o e-mail de quem pagou. */
export async function adminPagamentos(quem: Quem, status?: unknown, limite?: unknown): Promise<unknown[]> {
  exigirAdmin(quem);
  const quantos = Math.min(Math.max(Math.trunc(Number(limite ?? 200)) || 200, 1), 1000);
  // O filtro entra ou não entra na consulta. "? IS NULL" num comando preparado depende do
  // feitio que o banco adivinha para o valor, e isso varia entre MySQL e MariaDB.
  const filtro = umTexto(status);
  return consultar(
    `SELECT g.id, g.criado_em, u.email, p.nome AS propriedade, g.plano_nome, g.meses, g.valor_centavos,
            g.status, g.metodo, g.mp_payment_id, g.aprovado_em
     FROM pagamentos g
     LEFT JOIN usuarios u ON u.id = g.user_id
     LEFT JOIN propriedades p ON p.id = g.propriedade_id
     ${filtro ? "WHERE g.status = ?" : ""}
     ORDER BY g.criado_em DESC
     LIMIT ${quantos}`,
    filtro ? [filtro] : [],
  );
}

/** Quantas vezes cada eBook foi aberto e por quantas pessoas diferentes. */
export async function adminEbooksResumo(quem: Quem): Promise<unknown[]> {
  exigirAdmin(quem);
  return consultar(
    `SELECT e.id AS ebook_id, COUNT(a.id) AS aberturas, COUNT(DISTINCT a.user_id) AS leitores, MAX(a.criado_em) AS ultima
     FROM ebooks e LEFT JOIN ebook_acessos a ON a.ebook_id = e.id
     GROUP BY e.id`,
  );
}

/**
 * Ligar ou desligar a exigência de 2FA para todos os administradores.
 *
 * Só quem já está usando 2FA pode ligar. Sem essa regra, um administrador sem 2FA ligaria
 * a exigência e se trancaria do lado de fora na próxima entrada — junto com os outros.
 */
export async function adminExigir2fa(quem: Quem, ligar: unknown): Promise<boolean> {
  exigirAdmin(quem);
  const ligado = ligar === true || ligar === "true" || ligar === 1;
  if (ligado && !usou2fa(quem)) {
    throw new AcessoNegado(
      "Ative e use a verificação em duas etapas na sua conta antes de exigir dos administradores.",
    );
  }
  await executar(
    `INSERT INTO configuracoes_sistema (chave, valor, atualizado_por, atualizado_em)
     VALUES ('exigir_2fa_admin', ?, ?, ?)
     ON DUPLICATE KEY UPDATE valor = VALUES(valor), atualizado_por = VALUES(atualizado_por), atualizado_em = VALUES(atualizado_em)`,
    [ligado ? "sim" : "nao", quem.userId, instanteUtc(new Date())],
  );
  return ligado;
}

/** A resposta do administrador a uma mensagem do formulário de ajuda. */
export async function adminResponderSuporte(quem: Quem, id: unknown, resposta: unknown, fechar?: unknown): Promise<boolean> {
  exigirAdmin(quem);
  const texto = umTexto(resposta);
  if (!texto || texto.length < 2) throw new AcessoNegado("Escreva a resposta.");
  const { afetadas } = await executar(
    `UPDATE suporte_contatos
        SET resposta = ?, status = ?, respondido_por = ?, respondido_em = ?
      WHERE id = ?`,
    [texto.slice(0, 4000), fechar ? "fechado" : "respondido", quem.userId, instanteUtc(new Date()), String(id)],
  );
  return afetadas > 0;
}

/**
 * Liberar ou tirar o Premium pelo painel, sem pagamento — para demonstração e para
 * atendimento.
 *
 * Toda mudança vai para `plano_auditoria` na mesma transação, com quem mudou, de que para
 * quê e por quê. Sem isso, um Premium apareceria do nada e ninguém saberia de quem partiu.
 */
export async function setarPlanoDemonstracao(
  quem: Quem,
  propriedadeId: string,
  plano: unknown = "premium",
  status: unknown = "ativo",
  dataExpiracao?: unknown,
  motivo?: unknown,
): Promise<Record<string, unknown>> {
  exigirAdmin(quem);
  const novoPlano = plano === "gratuito" ? "gratuito" : "premium";
  const novoStatus = ["ativo", "trial", "cancelado", "expirado", "pendente"].includes(String(status))
    ? String(status)
    : "ativo";
  const vence = dataExpiracao ? instanteUtc(new Date(String(dataExpiracao))) : null;

  return emTransacao(async (conexao) => {
    const dono = await consultarUm<{ proprietario_id: string }>(
      "SELECT proprietario_id FROM propriedades WHERE id = ?",
      [propriedadeId],
    );
    if (!dono) throw new AcessoNegado("Propriedade não encontrada.");
    const atual = await consultarUm<{ id: string; plano: string; status: string }>(
      `SELECT id, plano, status FROM assinaturas
       WHERE propriedade_id = ? AND status IN ('ativo', 'trial') ORDER BY created_at DESC LIMIT 1`,
      [propriedadeId],
    );

    let assinaturaId = atual?.id;
    if (!assinaturaId) {
      assinaturaId = crypto.randomUUID();
      await executarEm(
        conexao,
        `INSERT INTO assinaturas (id, user_id, propriedade_id, plano, status, origem, data_inicio, data_expiracao)
         VALUES (?, ?, ?, ?, ?, 'demonstracao', ?, ?)`,
        [assinaturaId, dono.proprietario_id, propriedadeId, novoPlano, novoStatus, instanteUtc(new Date()), vence],
      );
    } else {
      await executarEm(
        conexao,
        "UPDATE assinaturas SET plano = ?, status = ?, data_expiracao = ? WHERE id = ?",
        [novoPlano, novoStatus, vence, assinaturaId],
      );
    }
    await anotarNaAuditoria(conexao, {
      assinaturaId, dono: dono.proprietario_id, propriedadeId, porQuem: quem.userId,
      planoAntes: atual?.plano ?? null, planoDepois: novoPlano,
      statusAntes: atual?.status ?? null, statusDepois: novoStatus, motivo: umTexto(motivo),
    });
    return {
      ok: true, plano: novoPlano, status: novoStatus, demonstracao: true,
      premium_ativo: novoPlano === "premium" && ["ativo", "trial"].includes(novoStatus),
    };
  });
}

export async function cancelarPlanoDemonstracao(quem: Quem, propriedadeId: string, motivo?: unknown): Promise<Record<string, unknown>> {
  exigirAdmin(quem);
  return emTransacao(async (conexao) => {
    const atual = await consultarUm<{ id: string; user_id: string; plano: string; status: string }>(
      `SELECT id, user_id, plano, status FROM assinaturas
       WHERE propriedade_id = ? AND status IN ('ativo', 'trial') ORDER BY created_at DESC LIMIT 1`,
      [propriedadeId],
    );
    if (!atual) return { ok: true, ja_cancelado: true };
    // Mantém a validade que já existia: cancelar não encurta o que a pessoa pagou.
    await executarEm(
      conexao,
      "UPDATE assinaturas SET status = 'cancelado', data_expiracao = COALESCE(data_expiracao, ?) WHERE id = ?",
      [instanteUtc(new Date()), atual.id],
    );
    await anotarNaAuditoria(conexao, {
      assinaturaId: atual.id, dono: atual.user_id, propriedadeId, porQuem: quem.userId,
      planoAntes: atual.plano, planoDepois: atual.plano,
      statusAntes: atual.status, statusDepois: "cancelado", motivo: umTexto(motivo),
    });
    return { ok: true, status: "cancelado" };
  });
}

async function anotarNaAuditoria(
  conexao: Parameters<typeof executarEm>[0],
  d: {
    assinaturaId: string; dono: string; propriedadeId: string; porQuem: string;
    planoAntes: string | null; planoDepois: string; statusAntes: string | null; statusDepois: string;
    motivo: string | null;
  },
) {
  await executarEm(
    conexao,
    `INSERT INTO plano_auditoria
       (id, assinatura_id, user_id, propriedade_id, alterado_por, plano_anterior, plano_novo, status_anterior, status_novo, motivo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [crypto.randomUUID(), d.assinaturaId, d.dono, d.propriedadeId, d.porQuem,
     d.planoAntes, d.planoDepois, d.statusAntes, d.statusDepois, d.motivo],
  );
}

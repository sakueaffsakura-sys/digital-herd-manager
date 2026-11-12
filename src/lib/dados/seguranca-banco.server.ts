/**
 * Registro de incidente de segurança e bloqueio de acesso.
 *
 * O PostgreSQL fazia o bloqueio com `on conflict (tipo, valor) where ativo`, um índice
 * único que só vale para as linhas ativas. O MySQL não tem índice com condição, então o
 * mesmo efeito vem de ler e decidir dentro de uma transação: ou soma uma tentativa ao
 * bloqueio que já existe, ou cria um.
 *
 * Administrador nunca é bloqueado. Não é privilégio: é para ninguém se trancar do lado de
 * fora do próprio site e deixar o problema sem quem resolva.
 */
import { emTransacao, executarEm, instanteUtc } from "./banco.server";
import { executar, consultarUm } from "./banco.server";

const corte = (texto: unknown, tamanho: number): string | null => {
  if (texto == null) return null;
  const t = String(texto);
  return t.length > tamanho ? t.slice(0, tamanho) : t;
};

export type Incidente = {
  tipo: string; severidade?: string | null; ip?: string | null; dispositivo?: string | null;
  userId?: string | null; caminho?: string | null; metodo?: string | null; agente?: string | null;
  motivo?: string | null; detalhes?: unknown; bloquear?: boolean;
};

/** Minutos de bloqueio configurados pelo administrador: no máximo um dia, 0 = sem prazo. */
async function duracaoDoBloqueio(): Promise<number> {
  const linha = await consultarUm<{ min: number | null }>(
    "SELECT duracao_bloqueio_min AS min FROM manutencao_config WHERE id = 1",
  );
  return Math.min(Number(linha?.min ?? 60), 1440);
}

export async function registrarIncidente(dados: Incidente): Promise<string> {
  const ehAdmin = dados.userId
    ? Number(
        (await consultarUm<{ q: number }>(
          "SELECT COUNT(*) AS q FROM user_roles WHERE user_id = ? AND role = 'administrador'",
          [dados.userId],
        ))?.q ?? 0,
      ) > 0
    : false;
  const bloquear = Boolean(dados.bloquear) && !ehAdmin;
  const minutos = await duracaoDoBloqueio();
  const expira = minutos === 0 ? null : instanteUtc(new Date(Date.now() + minutos * 60_000));
  const motivo = corte(dados.motivo, 300);
  const dispositivo = corte(dados.dispositivo, 80);

  return emTransacao(async (conexao) => {
    const id = crypto.randomUUID();
    await executarEm(
      conexao,
      `INSERT INTO incidentes_seguranca
         (id, tipo, severidade, ip, dispositivo, user_id, caminho, metodo, agente, motivo, detalhes, bloqueou)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, corte(dados.tipo, 60), corte(dados.severidade ?? "aviso", 20), corte(dados.ip, 80), dispositivo,
        dados.userId ?? null, corte(dados.caminho, 200), corte(dados.metodo, 10), corte(dados.agente, 300),
        motivo, JSON.stringify(dados.detalhes ?? {}), bloquear ? 1 : 0,
      ],
    );
    if (bloquear) {
      if (dispositivo) await bloquear1(conexao, "dispositivo", dispositivo, motivo, id, expira);
      if (dados.userId) await bloquear1(conexao, "usuario", dados.userId, motivo, id, expira);
    }
    return id;
  });
}

/** Um bloqueio por tipo e valor enquanto estiver ativo — o que o índice condicional fazia. */
async function bloquear1(
  conexao: Parameters<typeof executarEm>[0],
  tipo: string,
  valor: string,
  motivo: string | null,
  incidenteId: string,
  expira: string | null,
) {
  const { afetadas } = await executarEm(
    conexao,
    `UPDATE bloqueios_acesso SET tentativas = tentativas + 1, ultima_tentativa = ?
     WHERE ativo = 1 AND tipo = ? AND valor = ?`,
    [instanteUtc(new Date()), tipo, valor],
  );
  if (afetadas === 0) {
    await executarEm(
      conexao,
      "INSERT INTO bloqueios_acesso (id, tipo, valor, motivo, incidente_id, expira_em) VALUES (?, ?, ?, ?, ?, ?)",
      [crypto.randomUUID(), tipo, valor, motivo, incidenteId, expira],
    );
  }
}

/**
 * Alguém já bloqueado tentou de novo. Só conta a tentativa: serve para o administrador ver
 * quem está insistindo, e para o bloqueio não parecer esquecido.
 */
export async function tentativaDeBloqueado(tipo: unknown, valor: unknown): Promise<void> {
  if (!tipo || !valor) return;
  await executar(
    `UPDATE bloqueios_acesso SET tentativas = tentativas + 1, ultima_tentativa = ?
     WHERE ativo = 1 AND tipo = ? AND valor = ?`,
    [instanteUtc(new Date()), String(tipo).slice(0, 40), String(valor).slice(0, 80)],
  );
}

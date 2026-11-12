import { createFileRoute } from "@tanstack/react-router";
import { BANCO_NOVO } from "@/lib/dados";
import { appSincronizar, exclusoesDoApp } from "@/lib/dados/relatorios.server";
import { quemNoApp } from "@/lib/app-api-novo.server";
import { AcessoNegado } from "@/lib/dados/acesso";
import { apagar, atualizar, criar, obter } from "@/lib/dados/repositorio.server";
import { autenticar, ehTabelaApp, ehUuid, erro, json, lerJson, preflight, TABELAS_APP } from "@/lib/app-api.server";

/**
 * GET ?tabela=animais&propriedade_id=...&apos_updated_at=...&apos_id=...&limite=500
 *     &apos_excluido_em=...&apos_exclusao_id=...
 *   → registros alterados depois do cursor (até 1000 por vez) e as exclusões depois do cursor DE EXCLUSÕES
 *     (até 1000 por vez, em ordem de (excluido_em, id)). Os dois cursores andam separados.
 *   Janela de segurança: ao começar cada rodada, volte os dois cursores 2 minutos (uma transação longa grava a
 *   hora do começo e só aparece no fim) e aplique tudo pelo id — repetir é inofensivo.
 * POST { propriedade_id, operacoes: [{ tabela, acao: "salvar"|"excluir", id, dados? }] }
 *   → envia alterações feitas no aplicativo (inclusive offline). Máx. 200 por envio.
 */
type Operacao = { tabela?: unknown; acao?: unknown; id?: unknown; dados?: unknown };
type ErroBanco = { code?: string; message?: string } | null;

const LIMITE_EXCLUSOES = 1000;
const DATA_HORA = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}(:?\d{2})?)?$/;
const ehDataHora = (v: string | null): v is string => !!v && DATA_HORA.test(v);

/** Traduz a recusa do banco para o produtor, sem expor nomes internos de tabela, coluna ou regra. */
function mensagemDoBanco(e: ErroBanco): string {
  const codigo = e?.code ?? "";
  const m = (e?.message ?? "").toLowerCase();
  if (codigo === "23505") {
    if (m.includes("brinco")) return "Já existe um animal com esse número de brinco nesta propriedade.";
    if (m.includes("nome")) return "Já existe um registro com esse nome nesta propriedade.";
    if (m.includes("pesage")) return "Esse animal já tem uma pesagem nesse dia.";
    return "Esse registro já existe.";
  }
  if (codigo === "23503") return "Esse registro depende de outro que não existe mais (animal, lote ou vacina).";
  if (codigo === "23502") return "Falta preencher um campo obrigatório.";
  if (codigo === "23514") {
    if (m.includes("futur") || m.includes("data")) return "Data inválida: no futuro ou fora de ordem.";
    return "Algum valor está fora do permitido (por exemplo, número negativo).";
  }
  if (codigo === "42501") return "Sem permissão para gravar agora (conta bloqueada ou sistema em manutenção).";
  if (codigo === "22P02" || codigo === "22007" || codigo === "22008" || codigo === "22003") return "Algum valor está em formato inválido.";
  return "Não foi possível gravar este registro.";
}

/**
 * O erro do MySQL em palavras de produtor. É o irmão de `mensagemDoBanco`, que fala
 * PostgreSQL: a tradução precisa existir nos dois enquanto os dois bancos existem.
 */
function mensagemDaGravacao(e: unknown): string {
  const erroMysql = e as { errno?: number; sqlMessage?: string } | null;
  const numero = erroMysql?.errno;
  const texto = (erroMysql?.sqlMessage ?? "").toLowerCase();
  if (numero === 1062) {
    if (texto.includes("brinco")) return "Já existe um animal com esse número de brinco nesta propriedade.";
    if (texto.includes("pesage")) return "Esse animal já tem uma pesagem nesse dia.";
    if (texto.includes("nome")) return "Já existe um registro com esse nome nesta propriedade.";
    return "Esse registro já existe.";
  }
  if (numero === 1452 || numero === 1216) return "Esse registro depende de outro que não existe mais (animal, lote ou vacina).";
  if (numero === 1451) return "Outros registros dependem deste; apague-os antes.";
  if (numero === 1048) return "Falta preencher um campo obrigatório.";
  if (numero === 3819 || numero === 4025) return "Algum valor está fora do permitido (por exemplo, número negativo).";
  if (numero === 1292 || numero === 1366) return "Algum valor está em formato inválido.";
  return "Não foi possível gravar este registro.";
}

export const Route = createFileRoute("/api/public/app/sincronizar")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const a = await autenticar(request);
        if (a instanceof Response) return a;
        const q = new URL(request.url).searchParams;
        const tabela = q.get("tabela");
        const prop = q.get("propriedade_id");
        if (!ehTabelaApp(tabela)) return erro(400, `Tabela inválida. Use: ${TABELAS_APP.join(", ")}.`);
        if (!ehUuid(prop)) return erro(400, "propriedade_id inválido.");
        const aposId = q.get("apos_id");
        const aposDataBruta = q.get("apos_updated_at");
        const aposData = ehDataHora(aposDataBruta) ? aposDataBruta : null;
        const limite = Math.min(Math.max(Number(q.get("limite")) || 500, 1), 1000);
        const excDataCru = q.get("apos_excluido_em");
        const excIdCru = q.get("apos_exclusao_id");

        // Banco novo: as duas leituras saem do nosso servidor, com as mesmas regras de
        // acesso das telas. O formato da resposta é o de antes, para o aplicativo não mudar.
        if (BANCO_NOVO) {
          const quem = await quemNoApp(request);
          if (!quem) return erro(401, "Sessão expirada. Entre novamente.");
          try {
            const registros = (await appSincronizar(quem, prop, tabela, aposData, aposId, limite)) as Array<{ id: string; updated_at: string | Date }>;
            const excluidos = await exclusoesDoApp(
              quem, prop, tabela,
              ehDataHora(excDataCru) ? excDataCru : (aposData ?? undefined),
              // O id só desempata quando a marca de exclusão veio junto com ele.
              ehDataHora(excDataCru) ? excIdCru : undefined,
              LIMITE_EXCLUSOES,
            );
            const emIso = registros.map((r) => ({ ...r, updated_at: new Date(r.updated_at).toISOString() }));
            const ultimo = emIso[emIso.length - 1];
            const ultimaExc = excluidos[excluidos.length - 1];
            const maisRegistros = emIso.length === limite;
            const maisExclusoes = excluidos.length === LIMITE_EXCLUSOES;
            return json(200, {
              tabela, registros: emIso, excluidos,
              proximo_cursor: ultimo ? { apos_updated_at: ultimo.updated_at, apos_id: ultimo.id } : null,
              proximo_cursor_exclusoes: ultimaExc ? { apos_excluido_em: ultimaExc.excluido_em, apos_exclusao_id: ultimaExc.exclusao_id } : null,
              tem_mais: maisRegistros || maisExclusoes,
              tem_mais_registros: maisRegistros,
              tem_mais_exclusoes: maisExclusoes,
            });
          } catch (e) {
            if (e instanceof AcessoNegado) return erro(403, e.message);
            console.error("Falha ao sincronizar", e);
            return erro(500, "Não foi possível sincronizar agora.");
          }
        }

        const { data, error } = await a.supabase.rpc("app_sincronizar", {
          p_tabela: tabela, p_propriedade_id: prop,
          p_apos_updated_at: aposData ?? undefined, p_apos_id: ehUuid(aposId) ? aposId : undefined, p_limite: limite,
        } as never);
        if (error) return erro(400, "Não foi possível sincronizar esta tabela.");
        const registros = (data ?? []) as Array<{ id: string; updated_at: string }>;

        // Exclusões com cursor próprio. Sem ele (clientes antigos), usa o cursor dos registros como antes.
        const excData = excDataCru;
        const excId = excIdCru && /^\d{1,19}$/.test(excIdCru) ? excIdCru : null;
        let exc = a.supabase.from("registros_excluidos").select("id, registro_id, excluido_em")
          .eq("propriedade_id", prop).eq("tabela", tabela)
          .order("excluido_em", { ascending: true }).order("id", { ascending: true })
          .limit(LIMITE_EXCLUSOES);
        if (ehDataHora(excData)) {
          exc = excId ? exc.or(`excluido_em.gt."${excData}",and(excluido_em.eq."${excData}",id.gt.${excId})`) : exc.gt("excluido_em", excData);
        } else if (aposData) {
          exc = exc.gt("excluido_em", aposData);
        }
        const excluidos = await exc;
        if (excluidos.error) return erro(400, "Não foi possível ler as exclusões desta tabela.");
        const linhasExc = (excluidos.data ?? []) as Array<{ id: number; registro_id: string; excluido_em: string }>;
        const ultimo = registros[registros.length - 1];
        const ultimaExc = linhasExc[linhasExc.length - 1];
        const maisRegistros = registros.length === limite;
        const maisExclusoes = linhasExc.length === LIMITE_EXCLUSOES;
        return json(200, {
          tabela, registros,
          excluidos: linhasExc.map((e) => ({ id: e.registro_id, excluido_em: e.excluido_em, exclusao_id: e.id })),
          proximo_cursor: ultimo ? { apos_updated_at: ultimo.updated_at, apos_id: ultimo.id } : null,
          proximo_cursor_exclusoes: ultimaExc ? { apos_excluido_em: ultimaExc.excluido_em, apos_exclusao_id: String(ultimaExc.id) } : null,
          tem_mais: maisRegistros || maisExclusoes,
          tem_mais_registros: maisRegistros,
          tem_mais_exclusoes: maisExclusoes,
        });
      },
      POST: async ({ request }) => {
        const body = await lerJson<{ propriedade_id?: unknown; operacoes?: Operacao[] }>(request);
        if (!body || !Array.isArray(body.operacoes)) return erro(400, "Pedido inválido.");
        if (!ehUuid(body.propriedade_id)) return erro(400, "propriedade_id inválido.");
        if (body.operacoes.length > 200) return erro(413, "Envie no máximo 200 alterações por vez.");
        const prop = body.propriedade_id;

        // Banco novo: cada operação passa pelo mesmo repositório das telas, uma a uma.
        //
        // Uma a uma, e não num lote só, de propósito: o aplicativo manda o que foi feito
        // sem internet, e uma linha ruim no meio (um animal apagado por outra pessoa
        // enquanto o celular estava no pasto) não pode derrubar as outras 199. Cada uma
        // tem a sua resposta, e o aplicativo reapresenta só o que falhou.
        if (BANCO_NOVO) {
          const quem = await quemNoApp(request);
          if (!quem) return erro(401, "Sessão expirada. Entre novamente.");
          const feitos: Array<{ indice: number; ok: boolean; id?: string; erro?: string }> = [];
          for (const [indice, op] of body.operacoes.entries()) {
            if (!ehTabelaApp(op.tabela)) { feitos.push({ indice, ok: false, erro: "Tabela inválida." }); continue; }
            try {
              if (op.acao === "excluir") {
                if (!ehUuid(op.id)) { feitos.push({ indice, ok: false, erro: "id inválido." }); continue; }
                // Já não existir é o objetivo cumprido, não um erro.
                await apagar(quem, op.tabela, op.id).catch((e) => {
                  if (e instanceof AcessoNegado) return false;
                  throw e;
                });
                feitos.push({ indice, ok: true, id: op.id });
                continue;
              }
              if (op.acao !== "salvar" || !op.dados || typeof op.dados !== "object" || Array.isArray(op.dados)) {
                feitos.push({ indice, ok: false, erro: "Ação inválida." }); continue;
              }
              const campos: Record<string, unknown> = { ...(op.dados as Record<string, unknown>), propriedade_id: prop };
              delete campos["created_at"]; delete campos["updated_at"];
              // A ligação com compra/venda é feita pelo servidor; o aplicativo não a inventa.
              if (op.tabela === "movimentacoes_financeiras") { delete campos["origem_tipo"]; delete campos["origem_id"]; }
              if (ehUuid(op.id)) {
                campos["id"] = op.id;
                const jaTem = await obter(quem, op.tabela, op.id);
                if (jaTem) {
                  await atualizar(quem, op.tabela, op.id, campos);
                  feitos.push({ indice, ok: true, id: op.id });
                  continue;
                }
              }
              feitos.push({ indice, ok: true, id: await criar(quem, op.tabela, campos) });
            } catch (e) {
              const msg = e instanceof AcessoNegado ? e.message : mensagemDaGravacao(e);
              feitos.push({ indice, ok: false, erro: msg });
            }
          }
          return json(200, { resultados: feitos, aceitas: feitos.filter((r) => r.ok).length, rejeitadas: feitos.filter((r) => !r.ok).length });
        }

        const a = await autenticar(request);
        if (a instanceof Response) return a;
        const resultados: Array<{ indice: number; ok: boolean; id?: string; erro?: string }> = [];
        for (const [indice, op] of body.operacoes.entries()) {
          if (!ehTabelaApp(op.tabela)) { resultados.push({ indice, ok: false, erro: "Tabela inválida." }); continue; }
          if (op.acao === "excluir") {
            if (!ehUuid(op.id)) { resultados.push({ indice, ok: false, erro: "id inválido." }); continue; }
            // Se o registro já não existia, conta como feito (o objetivo — não existir — foi alcançado).
            const { error } = await a.supabase.from(op.tabela).delete().eq("id", op.id).eq("propriedade_id", prop);
            resultados.push(error ? { indice, ok: false, erro: mensagemDoBanco(error) } : { indice, ok: true, id: op.id });
            continue;
          }
          if (op.acao !== "salvar" || !op.dados || typeof op.dados !== "object" || Array.isArray(op.dados)) {
            resultados.push({ indice, ok: false, erro: "Ação inválida." }); continue;
          }
          const dados: Record<string, unknown> = { ...(op.dados as Record<string, unknown>), propriedade_id: prop };
          delete dados.created_at; delete dados.updated_at;
          // Lançamentos ligados a compra/venda são criados pelo banco; o aplicativo não pode criar nem mexer nessa ligação.
          if (op.tabela === "movimentacoes_financeiras") { delete dados.origem_tipo; delete dados.origem_id; }
          if (ehUuid(op.id)) dados.id = op.id;
          const { data, error } = await a.supabase.from(op.tabela).upsert(dados as never).select("id").single();
          resultados.push(error ? { indice, ok: false, erro: mensagemDoBanco(error) } : { indice, ok: true, id: (data as { id: string }).id });
        }
        return json(200, { resultados, aceitas: resultados.filter((r) => r.ok).length, rejeitadas: resultados.filter((r) => !r.ok).length });
      },
    },
  },
});

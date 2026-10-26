import { createFileRoute } from "@tanstack/react-router";
import { autenticar, ehTabelaApp, ehUuid, erro, json, lerJson, preflight, TABELAS_APP } from "@/lib/app-api.server";

/**
 * GET ?tabela=animais&propriedade_id=...&apos_updated_at=...&apos_id=...&limite=500
 *   → baixa registros alterados depois do cursor (até 1000 por vez) e os excluídos.
 * POST { propriedade_id, operacoes: [{ tabela, acao: "salvar"|"excluir", id, dados? }] }
 *   → envia alterações feitas no aplicativo (inclusive offline). Máx. 200 por envio.
 */
type Operacao = { tabela?: unknown; acao?: unknown; id?: unknown; dados?: unknown };

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
        const aposData = q.get("apos_updated_at");
        const limite = Math.min(Math.max(Number(q.get("limite")) || 500, 1), 1000);
        const { data, error } = await a.supabase.rpc("app_sincronizar", {
          p_tabela: tabela, p_propriedade_id: prop,
          p_apos_updated_at: aposData || undefined, p_apos_id: ehUuid(aposId) ? aposId : undefined, p_limite: limite,
        } as never);
        if (error) return erro(400, "Não foi possível sincronizar esta tabela.");
        const registros = (data ?? []) as Array<{ id: string; updated_at: string }>;
        let exc = a.supabase.from("registros_excluidos").select("registro_id, excluido_em")
          .eq("propriedade_id", prop).eq("tabela", tabela).order("excluido_em").limit(1000);
        if (aposData) exc = exc.gt("excluido_em", aposData);
        const excluidos = await exc;
        const ultimo = registros[registros.length - 1];
        return json(200, {
          tabela, registros,
          excluidos: (excluidos.data ?? []).map((e) => ({ id: e.registro_id, excluido_em: e.excluido_em })),
          proximo_cursor: ultimo ? { apos_updated_at: ultimo.updated_at, apos_id: ultimo.id } : null,
          tem_mais: registros.length === limite,
        });
      },
      POST: async ({ request }) => {
        const a = await autenticar(request);
        if (a instanceof Response) return a;
        const body = await lerJson<{ propriedade_id?: unknown; operacoes?: Operacao[] }>(request);
        if (!body || !Array.isArray(body.operacoes)) return erro(400, "Pedido inválido.");
        if (!ehUuid(body.propriedade_id)) return erro(400, "propriedade_id inválido.");
        if (body.operacoes.length > 200) return erro(413, "Envie no máximo 200 alterações por vez.");
        const prop = body.propriedade_id;
        const resultados: Array<{ indice: number; ok: boolean; id?: string; erro?: string }> = [];
        for (const [indice, op] of body.operacoes.entries()) {
          if (!ehTabelaApp(op.tabela)) { resultados.push({ indice, ok: false, erro: "Tabela inválida." }); continue; }
          if (op.acao === "excluir") {
            if (!ehUuid(op.id)) { resultados.push({ indice, ok: false, erro: "id inválido." }); continue; }
            const { error } = await a.supabase.from(op.tabela).delete().eq("id", op.id).eq("propriedade_id", prop);
            resultados.push(error ? { indice, ok: false, erro: "Não foi possível excluir." } : { indice, ok: true, id: op.id });
            continue;
          }
          if (op.acao !== "salvar" || !op.dados || typeof op.dados !== "object" || Array.isArray(op.dados)) {
            resultados.push({ indice, ok: false, erro: "Ação inválida." }); continue;
          }
          const dados: Record<string, unknown> = { ...(op.dados as Record<string, unknown>), propriedade_id: prop };
          delete dados.created_at; delete dados.updated_at;
          if (ehUuid(op.id)) dados.id = op.id;
          const { data, error } = await a.supabase.from(op.tabela).upsert(dados as never).select("id").single();
          resultados.push(error ? { indice, ok: false, erro: error.message } : { indice, ok: true, id: (data as { id: string }).id });
        }
        return json(200, { resultados, aceitas: resultados.filter((r) => r.ok).length, rejeitadas: resultados.filter((r) => !r.ok).length });
      },
    },
  },
});

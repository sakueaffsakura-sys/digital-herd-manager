import { createFileRoute } from "@tanstack/react-router";
import { autenticar, erro, json, preflight } from "@/lib/app-api.server";
import { BANCO_NOVO } from "@/lib/dados";
import { quemNoApp } from "@/lib/app-api-novo.server";
import { listar } from "@/lib/dados/repositorio.server";

// GET → dados do usuário e propriedades a que ele tem acesso.
export const Route = createFileRoute("/api/public/app/eu")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        if (BANCO_NOVO) {
          const quem = await quemNoApp(request);
          if (!quem) return erro(401, "Sessão expirada. Entre novamente.");
          // As fazendas saem de `quem`, que já as leu do banco: pedir de novo seria
          // perguntar duas vezes a mesma coisa.
          const [perfil, props] = await Promise.all([
            listar<Record<string, unknown>>(quem, {
              tabela: "profiles",
              colunas: ["nome_completo", "nome_exibicao", "avatar_url", "bloqueado"],
              filtros: [{ coluna: "id", op: "=", valor: quem.userId }],
              porPagina: 1,
            }),
            listar<Record<string, unknown>>(quem, {
              tabela: "propriedades",
              colunas: ["id", "nome", "cidade", "estado", "periodo_gestacao_dias", "ativo"],
              ordem: [{ coluna: "nome", crescente: true }],
              porPagina: 100,
            }),
          ]);
          const meu = perfil.linhas[0] ?? null;
          if (meu?.["bloqueado"]) return erro(403, "Esta conta está bloqueada.");
          return json(200, { usuario_id: quem.userId, perfil: meu, propriedades: props.linhas });
        }

        const a = await autenticar(request);
        if (a instanceof Response) return a;
        const [perfil, props] = await Promise.all([
          a.supabase.from("profiles").select("nome_completo, nome_exibicao, avatar_url, bloqueado").eq("id", a.userId).maybeSingle(),
          a.supabase.from("propriedades").select("id, nome, cidade, estado, periodo_gestacao_dias, ativo").order("nome"),
        ]);
        if (props.error) return erro(500, "Não foi possível carregar suas propriedades.");
        if (perfil.data?.bloqueado) return erro(403, "Esta conta está bloqueada.");
        return json(200, { usuario_id: a.userId, perfil: perfil.data ?? null, propriedades: props.data ?? [] });
      },
    },
  },
});

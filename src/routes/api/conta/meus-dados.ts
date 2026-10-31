import { createFileRoute } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dentroDoLimite, exigirUsuario, falha } from "@/lib/conta.server";
import { criarZip, paraCsv, type ArquivoZip } from "@/lib/zip";
import { dataNoFuso } from "@/lib/datas";

// Tabelas de cada propriedade da pessoa (só as que ela é dona) e da própria conta.
const DA_PROPRIEDADE = [
  "propriedade_perfil", "animais", "lotes", "tipos_vacinas", "vacinacoes", "inseminacoes", "nascimentos", "pesagens",
  "producao_leite", "anotacoes_producao", "movimentacoes_financeiras", "compras", "vendas", "investimentos", "assinaturas",
] as const;
const MAX_LINHAS = 200_000;

type Solta = { from: (t: string) => { select: (c: string) => { eq: (c: string, v: string) => { order: (c: string) => { range: (a: number, b: number) => Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }> } } } } };

async function todas(sb: SupabaseClient, tabela: string, coluna: string, valor: string) {
  const linhas: Record<string, unknown>[] = [];
  const cli = sb as unknown as Solta;
  for (let de = 0; de < MAX_LINHAS; de += 1000) {
    const { data, error } = await cli.from(tabela).select("*").eq(coluna, valor).order("id").range(de, de + 999);
    if (error) throw new Error(`${tabela}: ${error.message}`);
    linhas.push(...(data ?? []));
    if ((data?.length ?? 0) < 1000) break;
  }
  return linhas;
}

// GET — ZIP com um CSV por tabela (LGPD: cópia dos dados). No máximo 3 por dia por pessoa.
export const Route = createFileRoute("/api/conta/meus-dados")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const u = await exigirUsuario(request);
        if (u instanceof Response) return u;
        if (!(await dentroDoLimite(`export:${u.user.id}`, 3, 86_400))) return falha(429, "Você já baixou seus dados 3 vezes hoje. Tente amanhã.");
        try {
          const enc = new TextEncoder();
          const arquivos: ArquivoZip[] = [];
          const perfil = await u.supabase.from("profiles").select("*").eq("id", u.user.id);
          arquivos.push({ nome: "conta/perfil.csv", dados: enc.encode(paraCsv([{ email: u.user.email, criado_em: u.user.created_at, ...(perfil.data?.[0] ?? {}) }])) });
          const notas = await u.supabase.from("notificacoes").select("*").eq("user_id", u.user.id);
          arquivos.push({ nome: "conta/avisos.csv", dados: enc.encode(paraCsv((notas.data ?? []) as Record<string, unknown>[])) });
          const props = await u.supabase.from("propriedades").select("*").eq("proprietario_id", u.user.id);
          if (props.error) throw new Error(props.error.message);
          arquivos.push({ nome: "propriedades.csv", dados: enc.encode(paraCsv((props.data ?? []) as Record<string, unknown>[])) });
          for (const p of props.data ?? []) {
            const pasta = `${String(p.nome).replace(/[^\p{L}\p{N} _-]/gu, "").trim().slice(0, 60) || "propriedade"}-${String(p.id).slice(0, 8)}`;
            for (const t of DA_PROPRIEDADE) {
              const linhas = await todas(u.supabase, t, "propriedade_id", String(p.id));
              arquivos.push({ nome: `${pasta}/${t}.csv`, dados: enc.encode(paraCsv(linhas)) });
            }
          }
          arquivos.push({
            nome: "LEIA-ME.txt",
            dados: enc.encode(
              `Cópia dos seus dados no Pecuária Digital, gerada em ${dataNoFuso()}.\r\n` +
                `Cada arquivo .csv abre no Excel ou no Google Planilhas (separado por ponto e vírgula).\r\n` +
                `Inclui as propriedades em que você é dono(a). Fotos e arquivos enviados não vão no ZIP.\r\n`,
            ),
          });
          const zip = criarZip(arquivos);
          return new Response(zip, {
            status: 200,
            headers: {
              "content-type": "application/zip",
              "content-disposition": `attachment; filename="meus-dados-pecuaria-digital-${dataNoFuso()}.zip"`,
              "cache-control": "no-store",
            },
          });
        } catch (e) {
          console.error("meus-dados:", e);
          return falha(500, "Não foi possível gerar o arquivo agora. Tente de novo em alguns minutos.");
        }
      },
    },
  },
});

/**
 * A porta única por onde as telas pedem e gravam dados.
 *
 * Tudo o que chega aqui é tratado como palpite de quem está do outro lado: a tabela, as
 * colunas, os filtros e os valores são conferidos de novo contra a lista do banco e
 * contra as fazendas de quem pediu. Nada do que o navegador manda sobre quem ele é tem
 * qualquer efeito — isso vem da sessão.
 */
import { AcessoNegado, TabelaDesconhecida } from "./acesso";
import { apagar, atualizar, criar, gravarOuAtualizar, listar, type Busca, type Filtro } from "./repositorio.server";
import { rodarConsulta } from "./consultas.server";
import { quemEsta } from "@/lib/conta/login.server";
import { allowRequest, clientIp } from "@/lib/rate-limit";

const TAMANHO_MAXIMO = 512 * 1024;

function resposta(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

/** Só aceita o que tem o feitio certo; o resto vira recusa, não "mais ou menos". */
function lerFiltros(bruto: unknown): Filtro[] {
  if (!Array.isArray(bruto)) return [];
  const validos: Filtro[] = [];
  for (const f of bruto.slice(0, 20)) {
    if (!f || typeof f !== "object") continue;
    const { coluna, op, valor, ate } = f as Record<string, unknown>;
    if (typeof coluna !== "string" || typeof op !== "string") continue;
    validos.push({ coluna, op: op as Filtro["op"], valor, ate });
  }
  return validos;
}

function lerOrdem(bruto: unknown): Busca["ordem"] {
  if (!Array.isArray(bruto)) return [];
  return bruto.slice(0, 5).flatMap((o) => {
    if (!o || typeof o !== "object") return [];
    const { coluna, crescente } = o as Record<string, unknown>;
    return typeof coluna === "string" ? [{ coluna, crescente: crescente === true }] : [];
  });
}

export async function handleDados(request: Request): Promise<Response> {
  if (request.method !== "POST") return resposta(405, { erro: "Método não aceito." });

  const ip = clientIp(request);
  if (!allowRequest(`dados:${ip}`, 240, 60_000, 60_000)) {
    return resposta(429, { erro: "Muitos pedidos. Espere um pouco." });
  }
  if (Number(request.headers.get("content-length") ?? 0) > TAMANHO_MAXIMO) {
    return resposta(413, { erro: "Envio muito grande." });
  }

  const quem = await quemEsta(request);
  if (!quem) return resposta(401, { erro: "Faça login para continuar." });

  let corpo: Record<string, unknown>;
  try {
    corpo = (await request.json()) as Record<string, unknown>;
  } catch {
    return resposta(400, { erro: "Pedido mal formado." });
  }

  const acao = String(corpo["acao"] ?? "");
  const tabela = String(corpo["tabela"] ?? "");

  try {
    switch (acao) {
      case "listar": {
        const { linhas, total } = await listar(quem, {
          tabela,
          colunas: Array.isArray(corpo["colunas"]) ? (corpo["colunas"] as string[]).slice(0, 60) : undefined,
          filtros: lerFiltros(corpo["filtros"]),
          ordem: lerOrdem(corpo["ordem"]),
          pagina: Number(corpo["pagina"] ?? 1),
          porPagina: Number(corpo["porPagina"] ?? 25),
          texto: lerTexto(corpo["texto"]),
        });
        return resposta(200, { linhas, total });
      }
      case "criar": {
        const linhas = Array.isArray(corpo["linhas"]) ? corpo["linhas"] : [];
        if (linhas.length === 0 || linhas.length > 500) return resposta(400, { erro: "Nada para gravar, ou demais de uma vez." });
        const ids: { id: string }[] = [];
        for (const linha of linhas) {
          ids.push({ id: await criar(quem, tabela, linha as Record<string, unknown>) });
        }
        return resposta(200, { linhas: ids, total: ids.length });
      }
      case "gravarOuAtualizar": {
        const linhas = Array.isArray(corpo["linhas"]) ? (corpo["linhas"] as Record<string, unknown>[]) : [];
        if (linhas.length === 0) return resposta(400, { erro: "Nada para gravar." });
        const conflito = Array.isArray(corpo["conflito"])
          ? (corpo["conflito"] as unknown[]).map((c) => String(c))
          : String(corpo["conflito"] ?? "").split(",").map((c) => c.trim()).filter(Boolean);
        const { ids } = await gravarOuAtualizar(quem, tabela, linhas, conflito, corpo["soIgnorar"] === true);
        return resposta(200, { linhas: ids.map((id) => ({ id })), total: ids.length });
      }
      case "atualizar": {
        const id = String(corpo["id"] ?? "");
        if (!id) return resposta(400, { erro: "Diga qual registro alterar." });
        await atualizar(quem, tabela, id, (corpo["mudancas"] ?? {}) as Record<string, unknown>);
        return resposta(200, { linhas: null, total: 1 });
      }
      case "apagar": {
        const id = String(corpo["id"] ?? "");
        if (!id) return resposta(400, { erro: "Diga qual registro apagar." });
        await apagar(quem, tabela, id);
        return resposta(200, { linhas: null, total: 1 });
      }
      case "consulta": {
        // As consultas prontas que antes eram funções dentro do banco.
        const nome = String(corpo["nome"] ?? "");
        const argumentos = (corpo["argumentos"] ?? {}) as Record<string, unknown>;
        return resposta(200, { linhas: await rodarConsulta(nome, quem, argumentos), total: null });
      }
      default:
        return resposta(400, { erro: "Pedido desconhecido." });
    }
  } catch (erro) {
    if (erro instanceof AcessoNegado) return resposta(403, { erro: erro.message });
    if (erro instanceof TabelaDesconhecida) {
      // Falha nossa de configuração: registra para o administrador e não conta detalhe a quem pediu.
      console.error(erro);
      return resposta(500, { erro: "Esta área ainda não está liberada." });
    }
    const codigo = codigoDoErro(erro);
    if (codigo) {
      // Erro do dado que chegou, não do servidor: a tela precisa saber disso para isolar a
      // linha ruim de um lote e deixar as boas entrarem.
      return resposta(400, { erro: mensagemDoDado(codigo), codigo });
    }
    console.error(erro);
    return resposta(500, { erro: "Não deu para concluir. Tente de novo." });
  }
}

/**
 * Traduz o erro do MySQL para o código que as telas já conhecem.
 *
 * As telas foram escritas contra o PostgreSQL e olham o código, não a mensagem: a
 * importação de planilha usa a classe (21, 22, 23 = problema no dado) para decidir se
 * isola a linha ou interrompe o lote, e trata 23505 como "já existe", que não é falha.
 * Traduzir aqui é o que mantém esse comportamento sem reescrever as telas.
 */
function codigoDoErro(erro: unknown): string | null {
  const e = erro as { errno?: number; sqlState?: string } | null;
  if (!e || typeof e !== "object") return null;
  // Chave repetida é o caso que as telas tratam por código próprio.
  if (e.errno === 1062) return "23505";
  const estado = typeof e.sqlState === "string" ? e.sqlState : "";
  return /^(21|22|23)/.test(estado) ? estado : null;
}

function mensagemDoDado(codigo: string): string {
  if (codigo === "23505") return "Este registro já existe.";
  if (codigo.startsWith("23")) return "Falta uma informação ligada a este registro, ou ela não existe mais.";
  return "Algum valor não serve para o campo em que foi posto.";
}

function lerTexto(bruto: unknown): Busca["texto"] {
  if (!bruto || typeof bruto !== "object") return undefined;
  const { termo, colunas } = bruto as Record<string, unknown>;
  if (typeof termo !== "string" || !Array.isArray(colunas)) return undefined;
  const limpas = colunas.filter((c): c is string => typeof c === "string").slice(0, 10);
  return limpas.length ? { termo: termo.slice(0, 200), colunas: limpas } : undefined;
}

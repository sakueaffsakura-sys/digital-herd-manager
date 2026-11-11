/**
 * O jeito de mexer em arquivo a partir da tela.
 *
 * Mesma forma de escrever do cliente antigo (`armazem.from("ebooks").upload(...)`), para
 * as telas do painel mudarem só a linha do import. Quem decide, de novo, é o servidor: o
 * que chega daqui é sempre conferido lá.
 *
 * O `upsert` do cliente antigo não existe aqui, e não falta: gravar no mesmo caminho
 * sobrescreve, que era o que `upsert: true` fazia. Para não sobrescrever, a tela usa um
 * caminho novo — é o que ela já faz com os eBooks.
 */
export type RespostaArquivo<T> =
  | { data: T; error: null }
  | { data: null; error: { message: string } };

const CAMINHO = "/api/arquivos";

async function pedir<T>(corpo: unknown): Promise<RespostaArquivo<T>> {
  try {
    const r = await fetch(CAMINHO, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(corpo),
      credentials: "same-origin",
    });
    const json = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    if (!r.ok) return { data: null, error: { message: String(json["erro"] ?? "Não deu para falar com o servidor.") } };
    return { data: json as T, error: null };
  } catch {
    return { data: null, error: { message: "Sem conexão com o servidor." } };
  }
}

class Balde {
  constructor(private readonly nome: string) {}

  /** Envia o arquivo. Grava no caminho dado, sobrescrevendo se já houver algo lá. */
  async upload(
    caminho: string,
    arquivo: Blob | File,
    opcoes?: { contentType?: string; upsert?: boolean; cacheControl?: string },
  ): Promise<RespostaArquivo<{ path: string }>> {
    const formulario = new FormData();
    formulario.set("balde", this.nome);
    formulario.set("caminho", caminho);
    // O tipo vai no próprio arquivo: é dele que o servidor confere se entra neste balde.
    const tipo = opcoes?.contentType ?? (arquivo instanceof File ? arquivo.type : "application/octet-stream");
    formulario.set("arquivo", new File([arquivo], caminho.split("/").pop() ?? "arquivo", { type: tipo }));
    try {
      const r = await fetch(CAMINHO, { method: "POST", body: formulario, credentials: "same-origin" });
      const json = (await r.json().catch(() => ({}))) as { erro?: string; caminho?: string };
      if (!r.ok) return { data: null, error: { message: json.erro ?? "Não deu para enviar o arquivo." } };
      return { data: { path: json.caminho ?? caminho }, error: null };
    } catch {
      return { data: null, error: { message: "Sem conexão com o servidor." } };
    }
  }

  /** Um endereço para abrir o arquivo, válido por alguns segundos. */
  async createSignedUrl(
    caminho: string,
    segundos: number,
    opcoes?: { download?: string | boolean },
  ): Promise<RespostaArquivo<{ signedUrl: string }>> {
    const r = await pedir<{ link: string }>({ acao: "assinar", balde: this.nome, caminho, segundos });
    if (r.error) return { data: null, error: r.error };
    const baixar = typeof opcoes?.download === "string" ? opcoes.download : null;
    const link = baixar ? `${r.data.link}&baixar=${encodeURIComponent(baixar)}` : r.data.link;
    return { data: { signedUrl: link }, error: null };
  }

  /** Apaga um ou vários arquivos. Só o administrador. */
  async remove(caminhos: string[]): Promise<RespostaArquivo<{ ok: true }>> {
    for (const caminho of caminhos) {
      const r = await pedir<{ ok: true }>({ acao: "remover", balde: this.nome, caminho });
      if (r.error) return { data: null, error: r.error };
    }
    return { data: { ok: true }, error: null };
  }
}

export const armazem = { from: (balde: string) => new Balde(balde) };

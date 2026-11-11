/**
 * Onde os arquivos ficam na hospedagem nova: eBooks, o APK e as imagens do site.
 *
 * Hoje eles estão no Supabase Storage, em baldes privados com link assinado de curta
 * duração. Aqui o lugar é uma pasta do servidor, e a regra mais importante é de onde essa
 * pasta NÃO pode estar: dentro de `public_html`. Qualquer coisa ali é servida pelo Apache
 * direto, sem passar pelo nosso código — e os eBooks são pagos, o que quer dizer que um
 * endereço adivinhado valeria uma assinatura.
 *
 * Então a pasta fica fora, e o único caminho até um arquivo é por uma rota nossa, que
 * confere quem está pedindo antes de entregar.
 *
 * Duas coisas aqui são o que separam isto de um buraco:
 *
 *   **O caminho é fechado dentro da pasta.** Um nome como `../../etc/passwd` parece bobo e
 *   é a falha mais antiga do ramo. A conferência não é olhar se o texto tem "..": é
 *   resolver o caminho e exigir que o resultado continue dentro da pasta.
 *
 *   **O link é assinado com prazo.** Quem tem o link entra; quem não tem, não. Passado o
 *   prazo, nem quem tinha. A assinatura cobre balde, caminho e prazo juntos — assinar só o
 *   caminho deixaria trocar o prazo, e assinar só o prazo deixaria trocar o arquivo.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

/** Os baldes de antes, com quem pode gravar e quem pode ler. */
export const BALDES = {
  /** O PDF pago. Ninguém lê direto: a rota dos eBooks confere a assinatura primeiro. */
  ebooks: { gravar: "admin", ler: "rota", tipos: ["application/pdf"], limiteMb: 100 },
  /** A capa do eBook aparece para quem entrou, assinante ou não. */
  "ebook-capas": { gravar: "admin", ler: "entrou", tipos: ["image/webp", "image/jpeg", "image/png"], limiteMb: 5 },
  /** O APK do aplicativo. */
  aplicativo: { gravar: "admin", ler: "entrou", tipos: ["application/vnd.android.package-archive"], limiteMb: 200 },
  /** Imagens que o administrador troca no site. */
  "imagens-site": { gravar: "admin", ler: "entrou", tipos: ["image/webp", "image/jpeg", "image/png", "image/svg+xml"], limiteMb: 10 },
  /** O papel de parede da Yui. */
  "yui-parede": { gravar: "admin", ler: "entrou", tipos: ["image/webp", "image/jpeg", "image/png"], limiteMb: 10 },
} as const;

export type Balde = keyof typeof BALDES;

export class ArquivoRecusado extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ArquivoRecusado";
  }
}

export const baldeValido = (nome: string): Balde | null =>
  Object.prototype.hasOwnProperty.call(BALDES, nome) ? (nome as Balde) : null;

/**
 * A pasta dos arquivos. Na hospedagem, algo como `/home/suaconta/arquivos-pecuaria` — ao
 * lado de `public_html`, nunca dentro.
 */
const pastaBase = () => process.env["ARQUIVOS_DIR"]?.trim() || path.join(process.cwd(), ".arquivos");

const chaveDeAssinatura = () => process.env["CHAVE_MESTRA"] ?? process.env["ARQUIVOS_CHAVE"] ?? "";

/**
 * O caminho de verdade de um arquivo, ou recusa.
 *
 * Resolve e confere se o resultado continua dentro da pasta do balde. É a conferência que
 * importa: `a/../../b` não tem ".." no fim, e `%2e%2e` já veio decodificado pelo servidor.
 */
export function caminhoReal(balde: Balde, caminho: string): string {
  const limpo = String(caminho ?? "").replace(/\\/g, "/").replace(/^\/+/, "");
  if (!limpo || limpo.length > 400) throw new ArquivoRecusado("Caminho de arquivo inválido.");
  // Byte nulo corta o nome no meio em algumas camadas do sistema: um "foto.png\0.php"
  // chegaria como "foto.png" na conferência e como outra coisa no disco.
  if (limpo.includes("\0")) throw new ArquivoRecusado("Caminho de arquivo inválido.");

  const raiz = path.resolve(pastaBase(), balde);
  const cheio = path.resolve(raiz, limpo);
  // `startsWith` só com o separador no fim: senão "/arquivos/ebooks-publico" passaria por
  // estar dentro de "/arquivos/ebooks".
  if (cheio !== raiz && !cheio.startsWith(raiz + path.sep)) {
    throw new ArquivoRecusado("Caminho de arquivo inválido.");
  }
  return cheio;
}

/** Assina balde, caminho e prazo juntos. */
function assinar(balde: Balde, caminho: string, ate: number): string {
  return createHmac("sha256", chaveDeAssinatura()).update(`${balde}:${caminho}:${ate}`).digest("base64url");
}

/**
 * O endereço de um arquivo, válido por alguns segundos.
 *
 * O prazo é curto de propósito: o link acaba em histórico de navegador, em conversa de
 * aplicativo e em registro de servidor alheio. Curto, isso deixa de importar depois.
 */
export function linkAssinado(balde: Balde, caminho: string, segundos = 300): string {
  caminhoReal(balde, caminho); // recusa caminho torto antes de assinar
  const prazo = Math.min(Math.max(Math.trunc(segundos) || 300, 5), 3600);
  const ate = Math.floor(Date.now() / 1000) + prazo;
  const endereco = `${balde}/${String(caminho).replace(/^\/+/, "")}`;
  return `/api/arquivos/${endereco}?ate=${ate}&a=${assinar(balde, caminho, ate)}`;
}

/** A assinatura confere e o prazo não passou? */
export function linkValido(balde: Balde, caminho: string, ate: unknown, assinatura: unknown): boolean {
  const prazo = Number(ate);
  if (!Number.isFinite(prazo) || prazo < Math.floor(Date.now() / 1000)) return false;
  const vinda = Buffer.from(String(assinatura ?? ""), "utf8");
  const nossa = Buffer.from(assinar(balde, caminho, prazo), "utf8");
  return vinda.length === nossa.length && timingSafeEqual(vinda, nossa);
}

export async function gravarArquivo(
  balde: Balde,
  caminho: string,
  conteudo: Uint8Array,
  tipo: string,
): Promise<void> {
  const regras = BALDES[balde];
  if (!(regras.tipos as readonly string[]).includes(tipo)) {
    throw new ArquivoRecusado("Este tipo de arquivo não entra aqui.");
  }
  if (conteudo.byteLength > regras.limiteMb * 1024 * 1024) {
    throw new ArquivoRecusado(`O arquivo passa de ${regras.limiteMb} MB.`);
  }
  const destino = caminhoReal(balde, caminho);
  await mkdir(path.dirname(destino), { recursive: true });
  await writeFile(destino, conteudo);
}

export async function lerArquivo(balde: Balde, caminho: string): Promise<Uint8Array> {
  try {
    return await readFile(caminhoReal(balde, caminho));
  } catch (erro) {
    if (erro instanceof ArquivoRecusado) throw erro;
    throw new ArquivoRecusado("Arquivo não encontrado.");
  }
}

export async function tamanhoDoArquivo(balde: Balde, caminho: string): Promise<number | null> {
  try {
    return (await stat(caminhoReal(balde, caminho))).size;
  } catch {
    return null;
  }
}

export async function apagarArquivo(balde: Balde, caminho: string): Promise<void> {
  await rm(caminhoReal(balde, caminho), { force: true });
}

export const paraTeste = { assinar, pastaBase };

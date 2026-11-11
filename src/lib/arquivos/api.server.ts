/**
 * A porta dos arquivos: `/api/arquivos`.
 *
 * GET entrega um arquivo, para quem tem link assinado dentro do prazo. POST é do painel do
 * administrador: pedir um link, enviar e apagar.
 *
 * O link assinado abre a porta, mas não dispensa a sessão. São duas perguntas diferentes:
 * a assinatura diz "este link saiu do nosso servidor"; a sessão diz "quem está pedindo
 * entrou no site". Um link que vaze de um navegador não deve servir em outro — por isso o
 * balde guarda também quem pode ler.
 *
 * O balde dos eBooks nunca é servido por aqui, nem com link válido: o PDF pago sai só pela
 * rota dos eBooks, que confere a assinatura do produtor e registra o acesso.
 */
import {
  apagarArquivo, ArquivoRecusado, BALDES, baldeValido, donoDoCaminho, gravarArquivo,
  lerArquivo, linkAssinado, linkValido, type Balde,
} from "./armazem.server";
import type { Quem } from "@/lib/dados/acesso";
import { quemEsta } from "@/lib/conta/login.server";
import { dentroDoLimite } from "@/lib/conta.server";

/** Só estes tipos são entregues, e cada um pela extensão do arquivo. */
const TIPO_POR_EXTENSAO: Record<string, string> = {
  pdf: "application/pdf",
  webp: "image/webp",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  svg: "image/svg+xml",
  apk: "application/vnd.android.package-archive",
};

const resposta = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const erro = (status: number, mensagem: string) => resposta(status, { erro: mensagem });

function tipoDe(caminho: string, balde: Balde): string | null {
  const extensao = caminho.split(".").pop()?.toLowerCase() ?? "";
  const tipo = TIPO_POR_EXTENSAO[extensao];
  // Entregar um tipo que o balde não aceita seria servir como imagem algo que entrou de
  // outro jeito. Se não combina, não entrega.
  return tipo && (BALDES[balde].tipos as readonly string[]).includes(tipo) ? tipo : null;
}

/** Nome de arquivo para download: sem caminho, sem aspas, sem quebra de linha. */
const nomeSeguro = (nome: string) =>
  nome.replace(/[\\/]/g, "").replace(/["\r\n]/g, "").trim().slice(0, 120) || "arquivo";

/**
 * Pode gravar ou apagar neste caminho?
 *
 * Nos baldes de pessoa e de fazenda, a primeira pasta é o dono, e é ela que decide. Sem
 * essa conferência, qualquer pessoa que entrou gravaria em `profile-avatars/<outra
 * pessoa>/avatar.webp` e trocaria a foto de quem quisesse.
 */
function podeGravar(balde: Balde, caminho: string, quem: Quem): string | null {
  const regra = BALDES[balde].gravar;
  if (regra === "admin") return quem.admin ? null : "Só o administrador mexe em arquivo aqui.";
  const dono = donoDoCaminho(caminho);
  if (!dono) return "Diga em qual pasta o arquivo entra.";
  if (regra === "proprio") {
    return dono === quem.userId ? null : "Este arquivo é de outra conta.";
  }
  // propriedade: a pasta tem de ser de uma fazenda a que a pessoa tem acesso.
  return quem.propriedades.includes(dono) ? null : "Esta fazenda não é sua.";
}

export async function servirArquivo(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const balde = baldeValido(url.searchParams.get("b") ?? "");
  const caminho = url.searchParams.get("c") ?? "";
  if (!balde || !caminho) return erro(400, "Pedido de arquivo incompleto.");

  if (!linkValido(balde, caminho, url.searchParams.get("ate"), url.searchParams.get("a"))) {
    // A mesma resposta para assinatura errada e prazo vencido: separar as duas contaria a
    // quem tenta se o caminho que ele adivinhou existe.
    return erro(403, "Este link não serve mais. Abra a página de novo.");
  }

  const regras = BALDES[balde];
  if (regras.ler === "rota") return erro(403, "Este arquivo sai por outra porta.");
  if (regras.ler === "entrou" && !(await quemEsta(request))) {
    return erro(401, "Entre no site para abrir este arquivo.");
  }

  const tipo = tipoDe(caminho, balde);
  if (!tipo) return erro(404, "Arquivo não encontrado.");

  try {
    const conteudo = await lerArquivo(balde, caminho);
    const baixar = url.searchParams.get("baixar");
    return new Response(conteudo as unknown as BodyInit, {
      headers: {
        "content-type": tipo,
        "content-length": String(conteudo.byteLength),
        // Privado e sem guardar: o link tem prazo, e um intermediário que guardasse a
        // resposta entregaria o arquivo depois do prazo a quem nem link tinha.
        "cache-control": "private, no-store",
        // O navegador não deve adivinhar o tipo: um .webp com cara de HTML viraria página.
        "x-content-type-options": "nosniff",
        ...(baixar ? { "content-disposition": `attachment; filename="${nomeSeguro(baixar)}"` } : {}),
      },
    });
  } catch (e) {
    if (e instanceof ArquivoRecusado) return erro(404, "Arquivo não encontrado.");
    console.error("Falha ao entregar arquivo", e);
    return erro(500, "Não deu para abrir o arquivo.");
  }
}

/** POST: as ações do painel. Gravar e apagar são só do administrador. */
export async function handleArquivos(request: Request): Promise<Response> {
  const quem = await quemEsta(request);
  if (!quem) return erro(401, "Entre no site.");
  if (!(await dentroDoLimite(`arquivos:${quem.userId}`, 120, 60))) {
    return erro(429, "Muitos pedidos de arquivo. Espere um instante.");
  }

  const tipoDoPedido = request.headers.get("content-type") ?? "";

  // Envio: vem como formulário, porque o arquivo não cabe bem em JSON.
  if (tipoDoPedido.includes("multipart/form-data")) {
    const formulario = await request.formData();
    const balde = baldeValido(String(formulario.get("balde") ?? ""));
    const caminho = String(formulario.get("caminho") ?? "");
    const arquivo = formulario.get("arquivo");
    if (!balde || !caminho || !(arquivo instanceof File)) return erro(400, "Diga o balde, o caminho e o arquivo.");
    const recusa = podeGravar(balde, caminho, quem);
    if (recusa) return erro(403, recusa);
    try {
      await gravarArquivo(balde, caminho, new Uint8Array(await arquivo.arrayBuffer()), arquivo.type);
      return resposta(200, { ok: true, caminho });
    } catch (e) {
      if (e instanceof ArquivoRecusado) return erro(400, e.message);
      console.error("Falha ao gravar arquivo", e);
      return erro(500, "Não deu para guardar o arquivo.");
    }
  }

  const corpo = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const acao = String(corpo?.["acao"] ?? "");
  const balde = baldeValido(String(corpo?.["balde"] ?? ""));
  const caminho = String(corpo?.["caminho"] ?? "");
  if (!balde || !caminho) return erro(400, "Diga o balde e o caminho.");

  try {
    switch (acao) {
      case "assinar": {
        // Quem já entrou pode pedir link dos baldes de leitura liberada. O dos eBooks não
        // tem link: o PDF pago sai só pela rota que confere a assinatura do produtor.
        if (BALDES[balde].ler === "rota") return erro(403, "Este arquivo sai por outra porta.");
        return resposta(200, { link: linkAssinado(balde, caminho, Number(corpo?.["segundos"] ?? 300)) });
      }
      case "remover": {
        const recusa = podeGravar(balde, caminho, quem);
        if (recusa) return erro(403, recusa);
        await apagarArquivo(balde, caminho);
        return resposta(200, { ok: true });
      }
      default:
        return erro(400, "Pedido desconhecido.");
    }
  } catch (e) {
    if (e instanceof ArquivoRecusado) return erro(400, e.message);
    console.error("Falha no pedido de arquivo", e);
    return erro(500, "Não deu para concluir.");
  }
}

/**
 * O conteúdo de um arquivo nosso como resposta HTTP, com suporte a Range.
 *
 * É o que a rota dos eBooks usa depois de conferir a assinatura do produtor: lê o arquivo
 * direto, sem link nenhum. Range importa porque o leitor de PDF pede o arquivo em pedaços
 * — sem isso, um eBook de 40 MB só começa a aparecer quando termina de baixar.
 *
 * Os cabeçalhos ficam a cargo de quem chamou: a rota dos eBooks tem os dela.
 */
export async function pedacoDoArquivo(
  balde: Balde,
  caminho: string,
  range: string | null,
): Promise<{ corpo: Uint8Array; status: 200 | 206; total: number; faixa: string | null } | null> {
  let conteudo: Uint8Array;
  try {
    conteudo = await lerArquivo(balde, caminho);
  } catch {
    return null;
  }
  const total = conteudo.byteLength;
  const pedido = /^bytes=(\d*)-(\d*)$/.exec(range ?? "");
  if (!pedido) return { corpo: conteudo, status: 200, total, faixa: null };

  const [, deTexto, ateTexto] = pedido;
  // "bytes=-500" é "os últimos 500"; "bytes=500-" é "de 500 até o fim".
  let de = deTexto ? Number(deTexto) : Math.max(0, total - Number(ateTexto || 0));
  let ate = ateTexto && deTexto ? Number(ateTexto) : total - 1;
  if (!Number.isFinite(de) || !Number.isFinite(ate) || de > ate || de >= total) {
    // Faixa que não existe: entrega o arquivo inteiro, em vez de erro.
    return { corpo: conteudo, status: 200, total, faixa: null };
  }
  de = Math.max(0, de);
  ate = Math.min(ate, total - 1);
  return {
    corpo: conteudo.subarray(de, ate + 1),
    status: 206,
    total,
    faixa: `bytes ${de}-${ate}/${total}`,
  };
}

/*
 * O balde dos eBooks não ganha link nem por aqui. A rota dos eBooks lê o arquivo direto
 * com `lerArquivo`, depois de conferir a assinatura do produtor e registrar o acesso: um
 * link, mesmo curto, é um endereço que pode ser repassado.
 */

export const paraTeste = { tipoDe, nomeSeguro, podeGravar };

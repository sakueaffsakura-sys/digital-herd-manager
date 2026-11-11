import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  apagarArquivo, ArquivoRecusado, baldeValido, caminhoReal, gravarArquivo,
  lerArquivo, linkAssinado, linkValido, tamanhoDoArquivo,
} from "../arquivos/armazem.server";
import { paraTeste } from "../arquivos/api.server";

const { podeGravar, tipoDe, nomeSeguro } = paraTeste;

let pasta = "";

beforeAll(async () => {
  pasta = await mkdtemp(path.join(tmpdir(), "armazem-"));
  process.env["ARQUIVOS_DIR"] = pasta;
  process.env["CHAVE_MESTRA"] = "chave-de-conferencia";
});

afterAll(async () => {
  await rm(pasta, { recursive: true, force: true });
});

describe("o caminho é fechado dentro da pasta do balde", () => {
  it("um caminho normal resolve para dentro", () => {
    expect(caminhoReal("ebooks", "manejo/livro.pdf")).toBe(path.join(pasta, "ebooks", "manejo", "livro.pdf"));
  });

  it("subir de pasta é recusado, em qualquer forma", () => {
    for (const torto of [
      "../segredo.txt",
      "manejo/../../segredo.txt",
      "/../../etc/passwd",
      "..\\..\\segredo.txt",
      "a/./../../b",
    ]) {
      expect(() => caminhoReal("ebooks", torto), torto).toThrow(ArquivoRecusado);
    }
  });

  it("byte nulo é recusado: ele corta o nome no meio do caminho", () => {
    expect(() => caminhoReal("ebooks", "foto.png\0.php")).toThrow(ArquivoRecusado);
  });

  it("caminho vazio ou gigante é recusado", () => {
    expect(() => caminhoReal("ebooks", "")).toThrow(ArquivoRecusado);
    expect(() => caminhoReal("ebooks", "a".repeat(500))).toThrow(ArquivoRecusado);
  });

  it("uma barra à frente não tira o arquivo do balde", () => {
    expect(caminhoReal("ebooks", "/livro.pdf")).toBe(path.join(pasta, "ebooks", "livro.pdf"));
  });
});

describe("balde", () => {
  it("só os que existem", () => {
    expect(baldeValido("ebooks")).toBe("ebooks");
    expect(baldeValido("inventado")).toBe(null);
    // Nome que vem de objeto do JavaScript não pode passar por balde.
    expect(baldeValido("constructor")).toBe(null);
    expect(baldeValido("__proto__")).toBe(null);
  });
});

describe("link assinado", () => {
  it("o nosso vale", () => {
    const link = linkAssinado("ebooks", "manejo/livro.pdf", 60);
    const url = new URL(link, "https://exemplo.com");
    expect(linkValido("ebooks", "manejo/livro.pdf", url.searchParams.get("ate"), url.searchParams.get("a"))).toBe(true);
  });

  it("a assinatura de um arquivo não serve para outro", () => {
    const url = new URL(linkAssinado("ebooks", "livro-pago.pdf", 60), "https://exemplo.com");
    expect(linkValido("ebooks", "outro-livro.pdf", url.searchParams.get("ate"), url.searchParams.get("a"))).toBe(false);
  });

  it("nem para outro balde", () => {
    const url = new URL(linkAssinado("ebook-capas", "capa.webp", 60), "https://exemplo.com");
    expect(linkValido("ebooks", "capa.webp", url.searchParams.get("ate"), url.searchParams.get("a"))).toBe(false);
  });

  it("esticar o prazo invalida a assinatura", () => {
    const url = new URL(linkAssinado("ebooks", "livro.pdf", 60), "https://exemplo.com");
    const maisTarde = Number(url.searchParams.get("ate")) + 86_400;
    expect(linkValido("ebooks", "livro.pdf", maisTarde, url.searchParams.get("a"))).toBe(false);
  });

  it("prazo vencido não vale, mesmo com a assinatura certa", () => {
    // Um link que a própria função assinaria, mas com a hora no passado.
    const url = new URL(linkAssinado("ebooks", "livro.pdf", 5), "https://exemplo.com");
    expect(linkValido("ebooks", "livro.pdf", Math.floor(Date.now() / 1000) - 10, url.searchParams.get("a"))).toBe(false);
  });

  it("sem assinatura não vale", () => {
    expect(linkValido("ebooks", "livro.pdf", Math.floor(Date.now() / 1000) + 60, "")).toBe(false);
    expect(linkValido("ebooks", "livro.pdf", Math.floor(Date.now() / 1000) + 60, null)).toBe(false);
  });

  it("balde e caminho viajam como valor, não como pedaço do endereço", () => {
    const url = new URL(linkAssinado("ebooks", "manejo/livro.pdf", 60), "https://exemplo.com");
    expect(url.pathname).toBe("/api/arquivos");
    expect(url.searchParams.get("b")).toBe("ebooks");
    expect(url.searchParams.get("c")).toBe("manejo/livro.pdf");
  });

  it("o prazo é limitado: ninguém pede um link de um ano", () => {
    const url = new URL(linkAssinado("ebooks", "livro.pdf", 999_999), "https://exemplo.com");
    const prazo = Number(url.searchParams.get("ate")) - Math.floor(Date.now() / 1000);
    expect(prazo).toBeLessThanOrEqual(3600);
  });
});

describe("gravar, ler e apagar", () => {
  it("o que foi gravado volta igual", async () => {
    const conteudo = new TextEncoder().encode("%PDF-1.4 conteudo de teste");
    await gravarArquivo("ebooks", "pasta/livro.pdf", conteudo, "application/pdf");
    expect(new TextDecoder().decode(await lerArquivo("ebooks", "pasta/livro.pdf"))).toBe("%PDF-1.4 conteudo de teste");
    expect(await tamanhoDoArquivo("ebooks", "pasta/livro.pdf")).toBe(conteudo.byteLength);
    await apagarArquivo("ebooks", "pasta/livro.pdf");
    expect(await tamanhoDoArquivo("ebooks", "pasta/livro.pdf")).toBe(null);
  });

  it("tipo que não é do balde é recusado", async () => {
    await expect(gravarArquivo("ebooks", "x.php", new Uint8Array([1]), "application/x-php")).rejects.toThrow(ArquivoRecusado);
    await expect(gravarArquivo("ebook-capas", "x.pdf", new Uint8Array([1]), "application/pdf")).rejects.toThrow(ArquivoRecusado);
  });

  it("arquivo grande demais é recusado", async () => {
    const grande = new Uint8Array(6 * 1024 * 1024);
    await expect(gravarArquivo("ebook-capas", "capa.webp", grande, "image/webp")).rejects.toThrow(ArquivoRecusado);
  });

  it("ler o que não existe é recusa, não vazamento", async () => {
    await expect(lerArquivo("ebooks", "nunca-existiu.pdf")).rejects.toThrow(ArquivoRecusado);
  });

  it("não lê fora da pasta nem com o arquivo existindo lá", async () => {
    const fora = path.join(pasta, "segredo.txt");
    await writeFile(fora, "nao pode sair", "utf8");
    await expect(lerArquivo("ebooks", "../segredo.txt")).rejects.toThrow(ArquivoRecusado);
    // O arquivo continua lá: a recusa não o apagou nem o moveu.
    expect(await readFile(fora, "utf8")).toBe("nao pode sair");
  });

  it("apagar fora da pasta é recusado", async () => {
    const fora = path.join(pasta, "outro-segredo.txt");
    await writeFile(fora, "fica", "utf8");
    await expect(apagarArquivo("ebooks", "../outro-segredo.txt")).rejects.toThrow(ArquivoRecusado);
    expect(await readFile(fora, "utf8")).toBe("fica");
  });
});

describe("quem pode gravar em cada balde", () => {
  const NAIR = "11111111-1111-4111-8111-111111111111";
  const FAZENDA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const dona = { userId: NAIR, admin: false, propriedades: [FAZENDA] };
  const chefe = { userId: "99", admin: true, propriedades: [] };

  it("no balde do administrador, só o administrador", () => {
    expect(podeGravar("ebooks", "livro.pdf", chefe)).toBe(null);
    expect(podeGravar("ebooks", "livro.pdf", dona)).not.toBe(null);
    expect(podeGravar("aplicativo", "app.apk", dona)).not.toBe(null);
  });

  it("a foto é da própria pessoa: a primeira pasta tem de ser ela", () => {
    expect(podeGravar("profile-avatars", `${NAIR}/avatar.webp`, dona)).toBe(null);
    // O caso que a conferência existe para impedir: gravar na pasta de outra pessoa.
    expect(podeGravar("profile-avatars", "22222222-2222-4222-8222-222222222222/avatar.webp", dona)).not.toBe(null);
  });

  it("a imagem da fazenda é de quem tem acesso à fazenda", () => {
    expect(podeGravar("property-logos", `${FAZENDA}/logo.webp`, dona)).toBe(null);
    expect(podeGravar("property-logos", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/logo.webp", dona)).not.toBe(null);
  });

  it("sem pasta nenhuma, recusa: não há dono para conferir", () => {
    expect(podeGravar("profile-avatars", "avatar.webp", dona)).not.toBe(null);
  });

  it("administrador não herda a pasta dos outros nos baldes de pessoa", () => {
    // O administrador tem telas próprias para isso; aqui ele não é dono da pasta.
    expect(podeGravar("profile-avatars", `${NAIR}/avatar.webp`, chefe)).not.toBe(null);
  });
});

describe("o tipo entregue vem da extensão e tem de combinar com o balde", () => {
  it("o que combina passa", () => {
    expect(tipoDe("livro.pdf", "ebooks")).toBe("application/pdf");
    expect(tipoDe("capa.webp", "ebook-capas")).toBe("image/webp");
  });
  it("o que não combina com o balde não é entregue", () => {
    // Um PDF que de algum jeito tenha entrado no balde das capas não sai como PDF.
    expect(tipoDe("coisa.pdf", "ebook-capas")).toBe(null);
    expect(tipoDe("coisa.webp", "ebooks")).toBe(null);
  });
  it("extensão desconhecida não é entregue", () => {
    expect(tipoDe("script.php", "ebook-capas")).toBe(null);
    expect(tipoDe("semextensao", "ebooks")).toBe(null);
  });
});

describe("nome de arquivo para baixar", () => {
  it("não leva caminho, aspas nem quebra de linha", () => {
    expect(nomeSeguro('../../etc/passwd')).toBe("....etcpasswd");
    expect(nomeSeguro('a"; b')).toBe("a; b");
    expect(nomeSeguro("linha\r\nOutro-Cabecalho: x")).toBe("linhaOutro-Cabecalho: x");
  });
  it("vazio vira um nome qualquer, não vira nada", () => {
    expect(nomeSeguro("   ")).toBe("arquivo");
  });
});

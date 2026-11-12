/**
 * Envio de e-mail pelo SMTP da própria hospedagem.
 *
 * Escrito à mão sobre `node:tls`, sem biblioteca. Dois motivos: o registro de pacotes não
 * está acessível no ambiente de desenvolvimento, e o que o site precisa é uma fração do
 * que uma biblioteca de e-mail faz — uma mensagem de texto, para um destinatário, por uma
 * conta do cPanel. São 150 linhas que se leem de uma vez.
 *
 * Fala SMTPS (TLS desde o primeiro byte, porta 465), que é o que o cPanel oferece em
 * "Connect Devices". Não faz STARTTLS de propósito: começar em claro e pedir para subir
 * para TLS depois é a parte do protocolo onde a senha pode escapar se o servidor não
 * cooperar. Aqui, ou é TLS desde o início, ou não envia.
 *
 * A senha vem só das variáveis do aplicativo, nunca do código.
 */
import tls from "node:tls";

export class EmailNaoConfigurado extends Error {
  constructor() {
    super("O envio de e-mail ainda não está configurado neste servidor.");
    this.name = "EmailNaoConfigurado";
  }
}

export class EmailRecusado extends Error {
  constructor(public readonly resposta: string) {
    super(`O servidor de e-mail recusou: ${resposta}`);
    this.name = "EmailRecusado";
  }
}

type Config = { host: string; porta: number; usuario: string; senha: string; de: string };

function config(): Config | null {
  const host = process.env["SMTP_HOST"]?.trim();
  const usuario = process.env["SMTP_USUARIO"]?.trim();
  const senha = process.env["SMTP_SENHA"];
  if (!host || !usuario || !senha) return null;
  return {
    host,
    porta: Number(process.env["SMTP_PORTA"] ?? 465) || 465,
    usuario,
    senha,
    de: process.env["EMAIL_DE"]?.trim() || usuario,
  };
}

/** O envio de e-mail está configurado neste servidor? */
export const temEmail = () => config() !== null;

/** Uma conversa SMTP: manda uma linha, espera o número de resposta que deveria vir. */
class Conversa {
  private restante = "";
  constructor(private readonly socket: tls.TLSSocket) {}

  /** Lê uma resposta inteira (as de várias linhas terminam em "250 " e não "250-"). */
  async resposta(): Promise<{ codigo: number; texto: string }> {
    for (;;) {
      const linhas = this.restante.split("\r\n");
      // A última posição é o pedaço incompleto que ainda não terminou em CRLF.
      for (let i = 0; i < linhas.length - 1; i++) {
        const linha = linhas[i]!;
        if (/^\d{3} /.test(linha)) {
          this.restante = linhas.slice(i + 1).join("\r\n");
          return { codigo: Number(linha.slice(0, 3)), texto: linha };
        }
      }
      this.restante += await this.maisDados();
    }
  }

  private maisDados(): Promise<string> {
    return new Promise((resolver, recusar) => {
      const aoLer = (pedaco: Buffer) => { limpar(); resolver(pedaco.toString("utf8")); };
      const aoErrar = (erro: Error) => { limpar(); recusar(erro); };
      const aoFechar = () => { limpar(); recusar(new EmailRecusado("a conexão caiu antes da resposta")); };
      const limpar = () => {
        this.socket.off("data", aoLer);
        this.socket.off("error", aoErrar);
        this.socket.off("close", aoFechar);
      };
      this.socket.once("data", aoLer);
      this.socket.once("error", aoErrar);
      this.socket.once("close", aoFechar);
    });
  }

  /** Manda uma linha e confere o código da resposta. `esconder` tira a senha do erro. */
  async dizer(linha: string, esperado: number[], esconder = false): Promise<void> {
    this.socket.write(`${linha}\r\n`);
    const r = await this.resposta();
    if (!esperado.includes(r.codigo)) {
      throw new EmailRecusado(esconder ? `código ${r.codigo} ao autenticar` : r.texto);
    }
  }
}

/** Texto que entra num cabeçalho: sem quebra de linha, que viraria cabeçalho novo. */
const umaLinha = (texto: string) => texto.replace(/[\r\n]+/g, " ").trim().slice(0, 300);

/** Assunto com acento vai em Base64, como manda a RFC 2047. */
const assuntoCodificado = (assunto: string) => {
  const limpo = umaLinha(assunto);
  // eslint-disable-next-line no-control-regex
  return /^[\x20-\x7E]*$/.test(limpo) ? limpo : `=?UTF-8?B?${Buffer.from(limpo, "utf8").toString("base64")}?=`;
};

/**
 * Um ponto sozinho numa linha encerra a mensagem no SMTP. Uma mensagem que tenha essa
 * linha no meio do texto terminaria ali, e o resto viraria comando. Por isso o ponto
 * inicial é dobrado — é a regra do protocolo, não um enfeite.
 */
const protegerPontos = (corpo: string) => corpo.replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..");

export async function enviarEmail(para: string, assunto: string, corpo: string): Promise<void> {
  const c = config();
  if (!c) throw new EmailNaoConfigurado();
  const destino = umaLinha(para);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(destino)) throw new EmailRecusado("endereço inválido");

  const socket = tls.connect({
    host: c.host,
    port: c.porta,
    servername: c.host,
    // O certificado é conferido: sem isso, qualquer um no caminho poderia ler a senha.
    rejectUnauthorized: true,
  });
  socket.setTimeout(20_000, () => socket.destroy(new EmailRecusado("o servidor de e-mail não respondeu")));

  try {
    await new Promise<void>((resolver, recusar) => {
      socket.once("secureConnect", () => resolver());
      socket.once("error", recusar);
    });
    const fala = new Conversa(socket);
    const abertura = await fala.resposta();
    if (abertura.codigo !== 220) throw new EmailRecusado(abertura.texto);

    await fala.dizer(`EHLO ${c.host}`, [250]);
    await fala.dizer("AUTH LOGIN", [334]);
    await fala.dizer(Buffer.from(c.usuario, "utf8").toString("base64"), [334], true);
    await fala.dizer(Buffer.from(c.senha, "utf8").toString("base64"), [235], true);
    await fala.dizer(`MAIL FROM:<${c.usuario}>`, [250]);
    await fala.dizer(`RCPT TO:<${destino}>`, [250, 251]);
    await fala.dizer("DATA", [354]);

    const mensagem = [
      `From: ${umaLinha(c.de)}`,
      `To: ${destino}`,
      `Subject: ${assuntoCodificado(assunto)}`,
      `Date: ${new Date().toUTCString()}`,
      "MIME-Version: 1.0",
      'Content-Type: text/plain; charset="utf-8"',
      "Content-Transfer-Encoding: 8bit",
      "",
      protegerPontos(corpo),
    ].join("\r\n");
    socket.write(`${mensagem}\r\n.\r\n`);
    const fim = await fala.resposta();
    if (fim.codigo !== 250) throw new EmailRecusado(fim.texto);
    socket.write("QUIT\r\n");
  } finally {
    socket.destroy();
  }
}

export const paraTeste = { assuntoCodificado, protegerPontos, umaLinha };

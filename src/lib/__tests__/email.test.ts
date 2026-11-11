import { describe, expect, it } from "vitest";
import { paraTeste } from "../conta/email.server";

const { assuntoCodificado, protegerPontos, umaLinha } = paraTeste;

describe("assunto do e-mail", () => {
  it("deixa o que é ASCII como está", () => {
    expect(assuntoCodificado("Trocar a senha")).toBe("Trocar a senha");
  });
  it("codifica acento, senão o assunto chega embaralhado", () => {
    expect(assuntoCodificado("Pecuária Digital")).toBe("=?UTF-8?B?UGVjdcOhcmlhIERpZ2l0YWw=?=");
  });
});

describe("cabeçalho não aceita quebra de linha", () => {
  it("uma quebra viraria um cabeçalho novo, inventado por quem escreveu o texto", () => {
    expect(umaLinha("Senha\r\nBcc: ladrao@exemplo.com")).toBe("Senha Bcc: ladrao@exemplo.com");
  });
  it("corta o que é comprido demais", () => {
    expect(umaLinha("a".repeat(400)).length).toBe(300);
  });
});

describe("corpo da mensagem", () => {
  it("um ponto sozinho numa linha encerraria a mensagem, então é dobrado", () => {
    expect(protegerPontos("primeira\n.\nterceira")).toBe("primeira\r\n..\r\nterceira");
  });
  it("ponto no meio da frase não é mexido", () => {
    expect(protegerPontos("fim da frase. Outra frase.")).toBe("fim da frase. Outra frase.");
  });
  it("toda quebra de linha vira a do protocolo", () => {
    expect(protegerPontos("uma\ndois")).toBe("uma\r\ndois");
  });
});

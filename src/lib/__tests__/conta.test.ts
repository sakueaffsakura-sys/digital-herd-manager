import { describe, expect, it } from "vitest";
import { conferirForca, conferirSenha, guardarSenha, TAMANHO_MINIMO } from "../conta/senha";
import { COOKIE_SESSAO, cookieDaSessao, cookieDeSaida, novoToken, resumoDoToken, resumosIguais, tokenDoPedido, validadeDaSessao } from "../conta/sessao";

describe("senha", () => {
  it("recusa senha curta, repetida, famosa ou com o e-mail dentro", () => {
    expect(conferirForca("abc")).toMatchObject({ ok: false });
    expect(conferirForca("aaaaaaaaaa")).toMatchObject({ ok: false });
    expect(conferirForca("senha123")).toMatchObject({ ok: false });
    expect(conferirForca("dona.nair2026", "dona.nair@exemplo.com")).toMatchObject({ ok: false });
    expect(conferirForca("a".repeat(TAMANHO_MINIMO - 1))).toMatchObject({ ok: false });
  });

  it("aceita senha comum de fazenda, desde que não seja das famosas", () => {
    expect(conferirForca("boi na pastagem 7", "dona.nair@exemplo.com")).toEqual({ ok: true });
  });

  it("explica o motivo em português, sem termo técnico", () => {
    const r = conferirForca("abc");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toMatch(/pelo menos 8 caracteres/);
  });

  it("guarda a senha embaralhada e confere depois", async () => {
    const guardada = await guardarSenha("boi na pastagem 7");
    expect(guardada).not.toContain("boi");
    expect(guardada.startsWith("$2")).toBe(true);
    expect((await conferirSenha("boi na pastagem 7", guardada)).confere).toBe(true);
    expect((await conferirSenha("boi na pastagem 8", guardada)).confere).toBe(false);
  }, 20_000);

  it("aceita a senha vinda do login antigo e marca para regravar com custo maior", async () => {
    // Registro de custo 10, como o login antigo gravava; a senha é "boi na pastagem 7".
    const antiga = await (await import("bcryptjs")).default.hash("boi na pastagem 7", 10);
    const r = await conferirSenha("boi na pastagem 7", antiga);
    expect(r.confere).toBe(true);
    expect(r.regravar).toBe(true);
  }, 20_000);

  it("registro estragado ou vazio conta como senha errada, nunca como acerto", async () => {
    expect((await conferirSenha("qualquer", null)).confere).toBe(false);
    expect((await conferirSenha("qualquer", "isto não é um registro")).confere).toBe(false);
    expect((await conferirSenha("", "")).confere).toBe(false);
  });
});

describe("sessão", () => {
  it("sorteia token diferente a cada vez e nunca o guarda inteiro", () => {
    const a = novoToken();
    const b = novoToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(42);
    const resumo = resumoDoToken(a);
    expect(resumo).toHaveLength(64);
    expect(resumo).not.toContain(a.slice(0, 8));
    expect(resumoDoToken(a)).toBe(resumo);
    expect(resumoDoToken(b)).not.toBe(resumo);
  });

  it("compara resumos sem estourar com tamanho diferente", () => {
    const r = resumoDoToken("x");
    expect(resumosIguais(r, r)).toBe(true);
    expect(resumosIguais(r, resumoDoToken("y"))).toBe(false);
    expect(resumosIguais(r, "curto")).toBe(false);
    expect(resumosIguais("", "")).toBe(true);
  });

  it("o cookie não é lido por script, só viaja em HTTPS e não vai junto de outro site", () => {
    const c = cookieDaSessao("abc123");
    expect(c).toContain("HttpOnly");
    expect(c).toContain("Secure");
    expect(c).toContain("SameSite=Lax");
    expect(c).toMatch(/Max-Age=\d+/);
    expect(cookieDeSaida()).toContain("Max-Age=0");
  });

  it("acha o token entre outros cookies e não confunde nome parecido", () => {
    const pedido = (cookie: string) => new Request("https://x.test/", { headers: { cookie } });
    expect(tokenDoPedido(pedido(`outro=1; ${COOKIE_SESSAO}=meu-token; mais=2`))).toBe("meu-token");
    expect(tokenDoPedido(pedido(`${COOKIE_SESSAO}_antigo=errado`))).toBeNull();
    expect(tokenDoPedido(pedido(`${COOKIE_SESSAO}=`))).toBeNull();
    expect(tokenDoPedido(new Request("https://x.test/"))).toBeNull();
  });

  it("a sessão vence em 30 dias", () => {
    const agora = new Date("2026-11-11T12:00:00Z");
    expect(validadeDaSessao(agora).toISOString()).toBe("2026-12-11T12:00:00.000Z");
  });
});

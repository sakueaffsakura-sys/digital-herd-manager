/**
 * A sessão vista pela tela.
 *
 * Mesma forma de escrever do cliente antigo (`sessao.getUser()`, `sessao.getSession()`),
 * para as telas trocarem só a linha do import. Por baixo, a diferença é grande: antes o
 * navegador guardava a sessão e sabia quem era a pessoa; agora quem sabe é o servidor, e a
 * tela pergunta.
 *
 * Três coisas que isto resolve e que valem a leitura:
 *
 *   **Pergunta uma vez, não dezessete.** As telas chamam `getUser` e `getSession` por toda
 *   parte, sem combinar entre si. A resposta fica guardada aqui enquanto o token vale, e
 *   duas chamadas ao mesmo tempo esperam a mesma ida ao servidor — senão a abertura do site
 *   viraria uma rajada de pedidos iguais.
 *
 *   **O token é renovado antes de vencer, não depois.** Ele dura cinco minutos; a troca
 *   acontece aos quatro e meio. Esperar o vencimento daria um pedido falhando de vez em
 *   quando, no meio de um clique, sem motivo visível para quem usa.
 *
 *   **Sair esquece na hora.** Antes de o servidor responder. Se a tela continuasse achando
 *   que a pessoa está dentro até a resposta chegar, mostraria dados de uma sessão que já
 *   acabou.
 */
export type Pessoa = { id: string; email: string | null; created_at: string | null };
export type Sessao = { user: Pessoa; access_token: string; expires_at: number };

type Resposta<T> = { data: T; error: { message: string } | null };

type Eu = {
  user: Pessoa; admin: boolean; propriedades: string[];
  aal: "aal1" | "aal2"; access_token: string; expires_at: number;
};

/** Trinta segundos de folga: o token é trocado antes de vencer, não quando falha. */
const FOLGA_S = 30;

let guardada: Eu | null = null;
let indo: Promise<Eu | null> | null = null;
const ouvintes = new Set<(evento: string, sessao: Sessao | null) => void>();

const valendo = (eu: Eu | null): eu is Eu =>
  eu !== null && eu.expires_at - FOLGA_S > Math.floor(Date.now() / 1000);

async function buscar(): Promise<Eu | null> {
  try {
    const r = await fetch("/api/conta/eu", { credentials: "same-origin", headers: { accept: "application/json" } });
    if (!r.ok) return null;
    return (await r.json()) as Eu;
  } catch {
    return null;
  }
}

/** Quem está na sessão. Uma ida ao servidor por vez, e só quando o token já não vale. */
async function quem(forcar = false): Promise<Eu | null> {
  if (!forcar && valendo(guardada)) return guardada;
  // Quem chegar durante uma busca em andamento espera a mesma, em vez de abrir outra.
  indo ??= buscar().finally(() => { indo = null; });
  guardada = await indo;
  return guardada;
}

const comoSessao = (eu: Eu | null): Sessao | null =>
  eu ? { user: eu.user, access_token: eu.access_token, expires_at: eu.expires_at } : null;

function avisar(evento: string, eu: Eu | null) {
  for (const ouvinte of ouvintes) {
    try {
      ouvinte(evento, comoSessao(eu));
    } catch (erro) {
      // Um ouvinte que quebra não pode impedir os outros de saber que a sessão mudou.
      console.error("Ouvinte de sessão falhou", erro);
    }
  }
}

function esquecer() {
  guardada = null;
  indo = null;
}

export const sessao = {
  async getUser(): Promise<Resposta<{ user: Pessoa | null }>> {
    const eu = await quem();
    return eu
      ? { data: { user: eu.user }, error: null }
      : { data: { user: null }, error: { message: "Sessão encerrada." } };
  },

  async getSession(): Promise<Resposta<{ session: Sessao | null }>> {
    return { data: { session: comoSessao(await quem()) }, error: null };
  },

  /** O que o cliente antigo chamava de "claims": o essencial de quem está na sessão. */
  async getClaims(): Promise<Resposta<{ claims: Record<string, unknown> | null }>> {
    const eu = await quem();
    if (!eu) return { data: { claims: null }, error: { message: "Sessão encerrada." } };
    return {
      data: { claims: { sub: eu.user.id, email: eu.user.email, aal: eu.aal, admin: eu.admin } },
      error: null,
    };
  },

  async signInWithPassword(
    credenciais: { email: string; password: string },
  ): Promise<Resposta<{ session: Sessao | null; user: Pessoa | null }>> {
    const r = await fetch("/api/conta/entrar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ email: credenciais.email, senha: credenciais.password }),
    });
    const json = (await r.json().catch(() => ({}))) as { erro?: string };
    if (!r.ok) {
      esquecer();
      return { data: { session: null, user: null }, error: { message: json.erro ?? "Não foi possível entrar." } };
    }
    const eu = await quem(true);
    avisar("SIGNED_IN", eu);
    return { data: { session: comoSessao(eu), user: eu?.user ?? null }, error: null };
  },

  async signOut(): Promise<{ error: { message: string } | null }> {
    // Esquece primeiro: a tela não pode continuar mostrando dados de uma sessão encerrada
    // enquanto espera a resposta.
    esquecer();
    avisar("SIGNED_OUT", null);
    try {
      await fetch("/api/conta/sair", { method: "POST", credentials: "same-origin" });
    } catch {
      // A sessão local já foi embora; o cookie vence por conta própria.
    }
    return { error: null };
  },

  /**
   * Avisa quando a sessão muda. Sem cookie novo chegando sozinho, o que há para avisar é o
   * estado inicial, entrar, sair — e o retorno à aba, que é quando se descobre que a
   * sessão venceu enquanto a pessoa estava em outro lugar.
   */
  onAuthStateChange(ouvinte: (evento: string, sessao: Sessao | null) => void) {
    ouvintes.add(ouvinte);
    void quem().then((eu) => {
      if (ouvintes.has(ouvinte)) ouvinte("INITIAL_SESSION", comoSessao(eu));
    });

    const aoVoltar = () => {
      if (document.visibilityState !== "visible") return;
      void quem(true).then((eu) => {
        if (!ouvintes.has(ouvinte)) return;
        ouvinte(eu ? "TOKEN_REFRESHED" : "SIGNED_OUT", comoSessao(eu));
      });
    };
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", aoVoltar);

    return {
      data: {
        subscription: {
          unsubscribe() {
            ouvintes.delete(ouvinte);
            if (typeof document !== "undefined") document.removeEventListener("visibilitychange", aoVoltar);
          },
        },
      },
    };
  },

  /**
   * Existia para o navegador instalar uma sessão que recebeu por fora (link de e-mail,
   * volta do Google). Agora quem instala é o servidor, pelo cookie: aqui só resta
   * reconferir quem está na sessão.
   */
  async setSession(_sessao?: unknown): Promise<Resposta<{ session: Sessao | null }>> {
    return { data: { session: comoSessao(await quem(true)) }, error: null };
  },

  /** A volta do Google é fechada pelo servidor; a tela só reconfere. */
  async exchangeCodeForSession(_codigo?: unknown): Promise<Resposta<{ session: Sessao | null }>> {
    return { data: { session: comoSessao(await quem(true)) }, error: null };
  },
};

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

/** Um pedido POST em JSON para as rotas da conta. */
async function pedir<T = unknown>(caminho: string, corpo: unknown): Promise<{ data: T | null; error: { message: string } | null }> {
  try {
    const r = await fetch(caminho, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(corpo),
    });
    const json = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    if (!r.ok) return { data: null, error: { message: String(json["erro"] ?? "Não deu para falar com o servidor.") } };
    return { data: json as T, error: null };
  } catch {
    return { data: null, error: { message: "Sem conexão com o servidor." } };
  }
}

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

  async signOut(opcoes?: { scope?: "global" | "local" | "others" }): Promise<{ error: { message: string } | null }> {
    if (opcoes?.scope === "others") {
      // Derrubar os outros aparelhos não encerra este: a pessoa continua onde está.
      const r = await pedir("/api/conta/sair", { escopo: "outras" });
      return { error: r.error };
    }
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

  /**
   * Troca a senha de quem já está dentro.
   *
   * A tela confere a senha atual antes (`conferirSenhaAtual`), e é o servidor que liga as
   * duas coisas: sem a senha atual digitada há pouco nesta sessão, a troca é recusada.
   */
  async updateUser(mudancas: { password?: string }): Promise<Resposta<{ user: Pessoa | null }>> {
    if (!mudancas?.password) {
      return { data: { user: null }, error: { message: "Nada para mudar." } };
    }
    const r = await pedir("/api/conta/senha", { acao: "trocar", nova: mudancas.password });
    if (r.error) return { data: { user: null }, error: r.error };
    // A troca derruba as outras sessões; esta fica, mas o token curto precisa ser refeito.
    const eu = await quem(true);
    return { data: { user: eu?.user ?? null }, error: null };
  },

  /** Confere a senha atual e abre a janela para trocá-la. */
  async conferirSenhaAtual(senha: string): Promise<{ error: { message: string } | null }> {
    return { error: (await pedir("/api/conta/senha", { acao: "conferir", senha })).error };
  },

  /**
   * A verificação em duas etapas, com os mesmos nomes do cliente antigo.
   *
   * `challengeAndVerify` faz as duas coisas que o código serve para fazer — confirmar um
   * cadastro novo ou provar quem é numa sessão já aberta — porque, para quem usa, é uma
   * coisa só: digitar o número que o aplicativo mostra.
   */
  mfa: {
    async listFactors(): Promise<Resposta<{ totp: FatorTotp[]; all: FatorTotp[] }>> {
      const r = await pedir<{ fatores: { id: string; confirmado: boolean; criado_em: string }[] }>(
        "/api/conta/2fa", { acao: "listar" },
      );
      if (r.error) return { data: { totp: [], all: [] }, error: r.error };
      const todos = (r.data?.fatores ?? []).map((f) => ({
        id: f.id,
        status: (f.confirmado ? "verified" : "unverified") as "verified" | "unverified",
        friendly_name: `Autenticador de ${new Date(f.criado_em).toLocaleDateString("pt-BR")}`,
        factor_type: "totp" as const,
      }));
      return { data: { totp: todos, all: todos }, error: null };
    },

    async getAuthenticatorAssuranceLevel(): Promise<Resposta<{ currentLevel: string | null; nextLevel: string | null }>> {
      const eu = await quem();
      if (!eu) return { data: { currentLevel: null, nextLevel: null }, error: null };
      const r = await pedir<{ ligado: boolean }>("/api/conta/2fa", { acao: "listar" });
      const ligado = r.data?.ligado === true;
      return {
        data: {
          currentLevel: eu.aal,
          // "O que ainda falta": com verificação ligada e sessão só com senha, falta aal2.
          nextLevel: ligado ? "aal2" : eu.aal,
        },
        error: null,
      };
    },

    async enroll(_opcoes?: { factorType?: string; friendlyName?: string }): Promise<Resposta<{ id: string; totp: { secret: string; uri: string } } | null>> {
      const r = await pedir<{ id: string; segredo: string; qr: string }>("/api/conta/2fa", { acao: "cadastrar" });
      if (r.error || !r.data) return { data: null, error: r.error ?? { message: "Não deu para cadastrar." } };
      return { data: { id: r.data.id, totp: { secret: r.data.segredo, uri: r.data.qr } }, error: null };
    },

    async challengeAndVerify(opcoes: { factorId?: string; code: string }): Promise<Resposta<{ aal: string } | null>> {
      const r = await pedir<{ aal: string }>("/api/conta/2fa", {
        acao: "verificar", fatorId: opcoes.factorId, codigo: opcoes.code,
      });
      if (r.error) return { data: null, error: r.error };
      // Passar pela segunda etapa muda o nível desta sessão: o que está guardado envelheceu.
      await quem(true);
      return { data: r.data ?? null, error: null };
    },

    async unenroll(opcoes: { factorId: string; code?: string }): Promise<Resposta<{ ok: true } | null>> {
      const r = await pedir<{ ok: true }>("/api/conta/2fa", {
        acao: "tirar", fatorId: opcoes.factorId, codigo: opcoes.code,
      });
      if (r.error) return { data: null, error: r.error };
      await quem(true);
      return { data: { ok: true }, error: null };
    },
  },
};

export type FatorTotp = {
  id: string;
  status: "verified" | "unverified";
  friendly_name: string;
  factor_type: "totp";
};

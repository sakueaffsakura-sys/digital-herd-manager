/**
 * De onde as telas pegam a sessão.
 *
 * Igual ao `src/lib/dados` e ao `src/lib/arquivos`, os dois caminhos existem ao mesmo
 * tempo durante a mudança, e quem escolhe é a mesma variável `VITE_BANCO`. Tem de ser a
 * mesma: o login novo grava sessão no banco novo, e apontar sessão e dados para lados
 * diferentes deixaria a pessoa entrar num lugar e os dados dela estarem no outro.
 *
 * O caminho antigo é montado peça por peça, e não convertido com um `as`: `conferirSenhaAtual`
 * não existe no cliente antigo, e um `as` o deixaria passar na compilação para quebrar na
 * tela, no clique de quem está trocando a senha.
 */
import { supabase } from "@/integrations/supabase/client";
import { sessao as sessaoNova } from "./cliente";
import { BANCO_NOVO } from "@/lib/dados";

type ClienteDeSessao = Pick<
  typeof sessaoNova,
  | "getUser" | "getSession" | "getClaims" | "signInWithPassword" | "signOut"
  | "onAuthStateChange" | "setSession" | "exchangeCodeForSession"
  | "updateUser" | "conferirSenhaAtual" | "mfa"
>;

/**
 * O caminho antigo, com cada método amarrado ao seu dono.
 *
 * Não é um espalhamento do objeto (`{ ...supabase.auth }`): os métodos daquele cliente
 * contam com o próprio dono para funcionar, e espalhados eles o perdem — quebrando no
 * clique, não na compilação. Amarrar um a um mantém o dono certo, preserva os tipos de
 * cada chamada e deixa à vista quais métodos esta parte do site usa.
 */
function antigo(): ClienteDeSessao {
  const a = supabase.auth;
  const m = a.mfa;
  return {
    getUser: a.getUser.bind(a),
    getSession: a.getSession.bind(a),
    getClaims: a.getClaims.bind(a),
    signInWithPassword: a.signInWithPassword.bind(a),
    signOut: a.signOut.bind(a),
    onAuthStateChange: a.onAuthStateChange.bind(a),
    setSession: a.setSession.bind(a),
    exchangeCodeForSession: a.exchangeCodeForSession.bind(a),
    updateUser: a.updateUser.bind(a),
    mfa: {
      listFactors: m.listFactors.bind(m),
      getAuthenticatorAssuranceLevel: m.getAuthenticatorAssuranceLevel.bind(m),
      enroll: m.enroll.bind(m),
      challengeAndVerify: m.challengeAndVerify.bind(m),
      unenroll: m.unenroll.bind(m),
    },
    // No caminho antigo, conferir a senha é uma rota própria, que já existia.
    async conferirSenhaAtual(senha: string) {
      try {
        const { data } = await a.getSession();
        const r = await fetch("/api/conta/conferir-senha", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${data.session?.access_token ?? ""}` },
          body: JSON.stringify({ senha }),
        });
        if (r.ok) return { error: null };
        const json = (await r.json().catch(() => ({}))) as { erro?: string };
        return { error: { message: json.erro ?? "A senha atual não confere." } };
      } catch {
        return { error: { message: "Sem conexão com o servidor." } };
      }
    },
  } as unknown as ClienteDeSessao;
}

export const sessao: ClienteDeSessao = BANCO_NOVO ? sessaoNova : antigo();

export type { Pessoa, Sessao } from "./cliente";

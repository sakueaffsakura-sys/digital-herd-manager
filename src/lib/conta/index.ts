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
 * O caminho antigo, repassado método a método.
 *
 * Não é um espalhamento do objeto (`{ ...supabase.auth }`) de propósito: os métodos do
 * cliente antigo contam com o próprio dono para funcionar, e espalhados eles o perdem —
 * quebrando no clique, não na compilação. Repassar um a um mantém cada chamada no dono
 * certo e deixa claro quais métodos esta parte do site usa.
 */
function antigo(): ClienteDeSessao {
  const a = supabase.auth as unknown as Record<string, (...args: never[]) => unknown>;
  const chamar = <T>(nome: string, ...args: unknown[]) =>
    (a[nome] as unknown as (...x: unknown[]) => T).call(supabase.auth, ...args);
  const mfa = (supabase.auth as unknown as { mfa: Record<string, (...args: never[]) => unknown> }).mfa;
  const chamarMfa = <T>(nome: string, ...args: unknown[]) =>
    (mfa[nome] as unknown as (...x: unknown[]) => T).call(mfa, ...args);

  return {
    getUser: (...x) => chamar("getUser", ...x),
    getSession: (...x) => chamar("getSession", ...x),
    getClaims: (...x) => chamar("getClaims", ...x),
    signInWithPassword: (...x) => chamar("signInWithPassword", ...x),
    signOut: (...x) => chamar("signOut", ...x),
    onAuthStateChange: (...x) => chamar("onAuthStateChange", ...x),
    setSession: (...x) => chamar("setSession", ...x),
    exchangeCodeForSession: (...x) => chamar("exchangeCodeForSession", ...x),
    updateUser: (...x) => chamar("updateUser", ...x),
    mfa: {
      listFactors: (...x) => chamarMfa("listFactors", ...x),
      getAuthenticatorAssuranceLevel: (...x) => chamarMfa("getAuthenticatorAssuranceLevel", ...x),
      enroll: (...x) => chamarMfa("enroll", ...x),
      challengeAndVerify: (...x) => chamarMfa("challengeAndVerify", ...x),
      unenroll: (...x) => chamarMfa("unenroll", ...x),
    },
    // No caminho antigo, conferir a senha é uma rota própria, que já existia.
    async conferirSenhaAtual(senha: string) {
      try {
        const { data } = await chamar<{ data: { session?: { access_token?: string } } }>("getSession");
        const r = await fetch("/api/conta/conferir-senha", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${data?.session?.access_token ?? ""}` },
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

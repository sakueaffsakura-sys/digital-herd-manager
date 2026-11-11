/**
 * De onde as telas pegam a sessão.
 *
 * Igual ao `src/lib/dados` e ao `src/lib/arquivos`, os dois caminhos existem ao mesmo
 * tempo durante a mudança, e quem escolhe é a mesma variável `VITE_BANCO`. Tem de ser a
 * mesma: o login novo grava sessão no banco novo, e apontar sessão e dados para lados
 * diferentes deixaria a pessoa entrar num lugar e os dados dela estarem no outro.
 *
 * O recorte é só o que as telas usam. O cliente antigo tem muito mais (2FA, troca de
 * senha, cadastro), e essas telas continuam no cliente antigo até a peça delas ficar
 * pronta — é o que permite trocar uma a uma, em vez de arriscar o login de todo mundo
 * numa troca só.
 */
import { supabase } from "@/integrations/supabase/client";
import { sessao as sessaoNova } from "./cliente";
import { BANCO_NOVO } from "@/lib/dados";

type ClienteDeSessao = Pick<
  typeof sessaoNova,
  "getUser" | "getSession" | "getClaims" | "signInWithPassword" | "signOut" | "onAuthStateChange" | "setSession" | "exchangeCodeForSession"
>;

export const sessao: ClienteDeSessao = BANCO_NOVO
  ? sessaoNova
  : (supabase.auth as unknown as ClienteDeSessao);

export type { Pessoa, Sessao } from "./cliente";

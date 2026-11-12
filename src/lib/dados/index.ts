/**
 * De onde as telas pegam os dados.
 *
 * Durante a mudança de hospedagem, os dois caminhos existem ao mesmo tempo:
 *
 *   banco antigo (Supabase)  o que está no ar hoje, em boooh.sbs
 *   banco novo (MySQL)       o da hospedagem nova
 *
 * Quem escolhe é a variável VITE_BANCO. Isso permite trocar o import das telas uma a uma
 * sem derrubar o site que está no ar: enquanto a variável não mudar, tudo continua indo
 * para o banco antigo, e no dia da virada muda uma linha só.
 *
 * Em `dados.from("animais")...` a forma de escrever é a mesma nos dois.
 */
import { supabase } from "@/integrations/supabase/client";
import { dados as dadosMysql } from "./cliente";

/** "mysql" usa o banco novo; qualquer outra coisa (ou nada) usa o antigo. */
export const BANCO_NOVO =
  (import.meta.env?.["VITE_BANCO"] ?? (typeof process !== "undefined" ? process.env?.["BANCO"] : "")) === "mysql";

type ClienteDeDados = Pick<typeof dadosMysql, "from" | "rpc">;

/**
 * O cliente antigo tem muito mais coisa (login, arquivos, tempo real). Aqui só interessa
 * ler e gravar tabela, que é o que as telas usam — por isso o recorte.
 */
export const dados: ClienteDeDados = BANCO_NOVO
  ? dadosMysql
  : (supabase as unknown as ClienteDeDados);

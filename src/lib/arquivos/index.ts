/**
 * De onde as telas pegam os arquivos.
 *
 * Igual ao `src/lib/dados`, os dois caminhos existem ao mesmo tempo durante a mudança:
 *
 *   antigo (Supabase Storage)  o que está no ar hoje
 *   novo (pasta do servidor)   a hospedagem nova
 *
 * Quem escolhe é a mesma variável do banco, `VITE_BANCO`: não faz sentido o site ler os
 * dados de um lugar e os arquivos do outro, porque é o banco que guarda o caminho de cada
 * arquivo. Separar as duas variáveis daria a chance de apontar uma para cada lado e o site
 * procurar, na pasta nova, o caminho que só existe no banco antigo.
 */
import { supabase } from "@/integrations/supabase/client";
import { armazem as armazemNovo } from "./cliente";
import { BANCO_NOVO } from "@/lib/dados";

type ClienteDeArquivos = Pick<typeof armazemNovo, "from">;

export const armazem: ClienteDeArquivos = BANCO_NOVO
  ? armazemNovo
  : (supabase.storage as unknown as ClienteDeArquivos);

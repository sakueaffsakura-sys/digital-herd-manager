// O mesmo caminho de dados do site, mas sem os tipos gerados. Use só em listas e
// formulários genéricos, onde a tabela é escolhida em tempo de execução: com a união de
// todas as tabelas, o TypeScript não aceita nenhuma coluna.
//
// O nome ficou de quando o banco era o Supabase. Quem está do outro lado agora é
// `src/lib/dados`, que fala com o banco antigo ou com o novo conforme a configuração.
import type { SupabaseClient } from "@supabase/supabase-js";
import { dados } from "@/lib/dados";

export const supabaseDinamico = dados as unknown as SupabaseClient;

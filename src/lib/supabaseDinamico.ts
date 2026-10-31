// Mesmo cliente do site (mesma sessão e mesmas regras de acesso do banco), mas sem os tipos
// gerados. Use só em listas e formulários genéricos, onde a tabela é escolhida em tempo de
// execução: com a união de todas as tabelas, o TypeScript não aceita nenhuma coluna.
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export const supabaseDinamico = supabase as unknown as SupabaseClient;

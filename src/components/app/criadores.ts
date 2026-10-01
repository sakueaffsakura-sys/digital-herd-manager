import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type RedeCriador = { nome: string; url: string };
export type Criador = { id: string; nome: string; redes: RedeCriador[] };
export const CRIADORES_CHAVE = "criadores_site";
export const CRIADORES_QUERY = ["config", CRIADORES_CHAVE] as const;

export function urlSocial(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && !!parsed.hostname && !parsed.username && !parsed.password;
  } catch { return false; }
}

export function lerCriadores(valor: string | null | undefined): Criador[] {
  if (!valor) return [];
  try {
    const parsed: unknown = JSON.parse(valor);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 20).flatMap((item): Criador[] => {
      if (!item || typeof item !== "object" || typeof item.nome !== "string" || typeof item.id !== "string") return [];
      const redes = Array.isArray(item.redes) ? item.redes.slice(0, 5).filter((rede: unknown): rede is RedeCriador => {
        if (!rede || typeof rede !== "object") return false;
        const r = rede as Record<string, unknown>;
        return typeof r.nome === "string" && typeof r.url === "string" && urlSocial(r.url);
      }) : [];
      return [{ id: item.id, nome: item.nome.slice(0, 100), redes }];
    });
  } catch { return []; }
}

export function useCriadores(enabled = true) {
  return useQuery({
    queryKey: CRIADORES_QUERY,
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from("configuracoes_sistema").select("valor").eq("chave", CRIADORES_CHAVE).maybeSingle();
      if (error) throw error;
      return lerCriadores(data?.valor);
    },
  });
}
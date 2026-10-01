import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import yuiPadrao from "@/assets/yui-avatar.png";

export const YUI_FOTO_CHAVE = "yui_foto";
export const YUI_FOTO_QUERY = ["config", YUI_FOTO_CHAVE] as const;
export const YUI_FOTO_PADRAO = yuiPadrao;

/** Foto da Yui definida pelo admin (link ou upload); cai na foto padrão. */
export function useYuiAvatar(): string {
  const { data } = useQuery({
    queryKey: YUI_FOTO_QUERY,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("configuracoes_sistema").select("valor").eq("chave", YUI_FOTO_CHAVE).maybeSingle();
      if (error) throw error;
      return (data?.valor as string | null) ?? null;
    },
  });
  return data || yuiPadrao;
}

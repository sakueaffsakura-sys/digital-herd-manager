import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const YUI_WALLPAPER_BUCKET = "yui-chat-wallpapers";
export const YUI_WALLPAPER_KEY = "yui_chat_wallpaper";
export const YUI_WALLPAPER_QUERY = ["config", YUI_WALLPAPER_KEY] as const;

export function useYuiWallpaper() {
  return useQuery({
    queryKey: YUI_WALLPAPER_QUERY,
    staleTime: 40 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("configuracoes_sistema").select("valor").eq("chave", YUI_WALLPAPER_KEY).maybeSingle();
      if (error) throw error;
      const path = data?.valor;
      if (!path) return null;
      const { data: signed, error: signError } = await supabase.storage.from(YUI_WALLPAPER_BUCKET).createSignedUrl(path, 3600);
      if (signError) throw signError;
      return { path, url: signed.signedUrl, video: /\.mp4$/i.test(path) };
    },
  });
}
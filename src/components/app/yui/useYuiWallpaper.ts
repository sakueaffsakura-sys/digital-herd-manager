import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import wallpaperPadrao from "@/assets/yui-wallpaper-original.png.asset.json";

export const YUI_WALLPAPER_BUCKET = "yui-chat-wallpapers";
export const YUI_WALLPAPER_KEY = "yui_chat_wallpaper";
export const YUI_WALLPAPER_QUERY = ["config", YUI_WALLPAPER_KEY] as const;

// Fundo original do chat da Yui — usado quando nenhuma personalização está salva.
export const WALLPAPER_ORIGINAL = { url: wallpaperPadrao.url, video: false, padrao: true } as const;

export function useYuiWallpaper(enabled = true) {
  return useQuery({
    queryKey: YUI_WALLPAPER_QUERY,
    enabled,
    staleTime: 40 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("configuracoes_sistema").select("valor").eq("chave", YUI_WALLPAPER_KEY).maybeSingle();
      if (error) throw error;
      const path = data?.valor;
      if (!path) return WALLPAPER_ORIGINAL;
      const { data: signed, error: signError } = await supabase.storage.from(YUI_WALLPAPER_BUCKET).createSignedUrl(path, 3600);
      if (signError) throw signError;
      return { path, url: signed.signedUrl, video: /\.mp4$/i.test(path), padrao: false };
    },
  });
}

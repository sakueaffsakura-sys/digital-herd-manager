import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import fundoLogin from "@/assets/pecuaria-fundo.png.asset.json";
import fundoMenu from "@/assets/menu-fundo-vertical.jpg";

export type ChaveImagem = "fundo_login" | "banner_inicio" | "fundo_menu";

export const IMAGENS_PADRAO: Record<ChaveImagem, string> = {
  fundo_login: fundoLogin.url,
  banner_inicio: fundoLogin.url,
  fundo_menu: fundoMenu,
};

export const IMAGENS_INFO: { chave: ChaveImagem; titulo: string; dica: string; largura: number; altura: number }[] = [
  { chave: "fundo_login", titulo: "Fundo da tela de entrada", dica: "Ideal: horizontal, 1920×1080.", largura: 1920, altura: 1080 },
  { chave: "banner_inicio", titulo: "Banner da tela inicial", dica: "Ideal: horizontal largo, 1920×640.", largura: 1920, altura: 1080 },
  { chave: "fundo_menu", titulo: "Fundo do menu lateral", dica: "Ideal: vertical, 576×1920.", largura: 1080, altura: 1920 },
];

export const IMAGENS_QUERY = ["imagens-site"] as const;

export function useImagensSite() {
  const { data } = useQuery({
    queryKey: IMAGENS_QUERY,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("imagens_site" as never).select("chave,valor");
      if (error) throw error;
      const m: Partial<Record<ChaveImagem, string>> = {};
      for (const r of (data ?? []) as { chave: ChaveImagem; valor: string }[]) m[r.chave] = r.valor;
      return m;
    },
  });
  return (k: ChaveImagem) => data?.[k] ?? IMAGENS_PADRAO[k];
}

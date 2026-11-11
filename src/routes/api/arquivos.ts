import { createFileRoute } from "@tanstack/react-router";
import { handleArquivos, servirArquivo } from "@/lib/arquivos/api.server";

/**
 * A porta dos arquivos: eBooks, APK e imagens do site.
 *
 * GET entrega o arquivo de um link assinado. POST é do painel: pedir link, enviar, apagar.
 *
 * O balde e o caminho chegam como valores do endereço (`?b=...&c=...`), e não como pedaço
 * dele, de propósito: uma barra escrita como %2F no meio do caminho é desfeita de um jeito
 * por um servidor e de outro por outro, e é aí que nasce a diferença entre o caminho que a
 * assinatura cobriu e o arquivo que acaba sendo aberto.
 */
export const Route = createFileRoute("/api/arquivos")({
  server: {
    handlers: {
      GET: ({ request }) => servirArquivo(request),
      POST: ({ request }) => handleArquivos(request),
    },
  },
});

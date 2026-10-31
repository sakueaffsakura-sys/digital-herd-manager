import { createFileRoute } from "@tanstack/react-router";
import { handleEbookArquivo } from "@/lib/assinatura.server";

// GET (com Range) → o PDF do eBook, só para assinantes, sem link do armazenamento e sem cache.
export const Route = createFileRoute("/api/ebooks/$id/arquivo")({
  server: { handlers: { GET: ({ request, params }) => handleEbookArquivo(request, params.id) } },
});

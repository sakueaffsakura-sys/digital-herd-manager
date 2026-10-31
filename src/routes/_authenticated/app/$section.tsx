import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ApecuariaApp } from "@/components/app/ApecuariaApp";
import { itemDoMenu } from "@/components/app/casca/navegacao";

export const Route = createFileRoute("/_authenticated/app/$section")({
  // ?novo=1 abre o formulário de novo registro; ?editar=<id> abre a edição; ?animal=<id> abre a ficha.
  validateSearch: z.object({
    novo: z.string().max(20).optional(),
    editar: z.string().max(40).optional(),
    animal: z.string().max(40).optional(),
  }),
  head: ({ params }) => {
    const item = itemDoMenu(params.section);
    const nome = item?.rotulo ?? "Gestão da propriedade";
    return {
      meta: [
        { title: `${nome} | Pecuária Digital` },
        { name: "description", content: item?.frase ?? "Gestão da propriedade no Pecuária Digital." },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  component: ApecuariaApp,
});

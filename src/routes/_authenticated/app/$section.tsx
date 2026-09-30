import { createFileRoute } from "@tanstack/react-router";
import { ApecuariaApp } from "@/components/app/ApecuariaApp";

export const Route = createFileRoute("/_authenticated/app/$section")({
  head: () => ({ meta: [
    { title: "Gestão da Propriedade | Pecuária Digital" },
    { name: "description", content: "Gestão completa de rebanho, produção, saúde e finanças da propriedade rural." },
    { property: "og:title", content: "Pecuária Digital" },
    { property: "og:description", content: "Gestão pecuária completa e segura." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ]}),
  component: ApecuariaApp,
});

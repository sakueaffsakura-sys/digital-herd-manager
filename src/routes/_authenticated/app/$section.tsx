import { createFileRoute } from "@tanstack/react-router";
import { ApecuariaApp } from "@/components/app/ApecuariaApp";

const nomes: Record<string, string> = {
  inicio: "Início", rebanho: "Meu Rebanho", bezerros: "Evolução dos Bezerros", vacinacao: "Vacinação", inseminacao: "Inseminação", nascimentos: "Nascimentos", lotes: "Lotes", producao: "Produção de Leite", relatorios: "Relatórios", financeiro: "Lucros e Investimentos", comercial: "Compra e Venda", diagnostico: "Diagnóstico", perfil: "Perfil",
};

export const Route = createFileRoute("/_authenticated/app/$section")({
  head: ({ params }) => {
    const nome = nomes[params.section] ?? "Gestão da Propriedade";
    return { meta: [
    { title: `${nome} | Pecuária Digital` },
    { name: "description", content: `Acompanhe ${nome.toLowerCase()} da sua propriedade no Pecuária Digital.` },
    { property: "og:title", content: `${nome} | Pecuária Digital` },
    { property: "og:description", content: `Acompanhe ${nome.toLowerCase()} da sua propriedade no Pecuária Digital.` },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }; },
  component: ApecuariaApp,
});

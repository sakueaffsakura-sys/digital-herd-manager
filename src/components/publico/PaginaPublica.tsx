import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import marcaBranca from "@/assets/marca/marca-branca.webp";

/** Moldura das páginas abertas (sem login): faixa verde com a marca e o conteúdo em coluna de leitura. */
export function PaginaPublica({ titulo, subtitulo, children, largura = "leitura" }: { titulo: string; subtitulo?: string; children: ReactNode; largura?: "leitura" | "formulario" }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="bg-curral text-white">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-2.5 px-5">
          <Link to="/" className="flex items-center gap-2.5 rounded-[10px]" aria-label="Pecuária Digital, voltar ao início">
            <img src={marcaBranca} alt="" width={36} height={36} className="size-9 object-contain" />
            <span className="font-display text-[1.5rem] font-extrabold leading-none">Pecuária Digital</span>
          </Link>
        </div>
      </header>
      <main className={`mx-auto px-5 py-10 ${largura === "leitura" ? "max-w-3xl" : "max-w-md"}`}>
        <h1 className="titulo-pagina">{titulo}</h1>
        {subtitulo && <p className="mt-2 text-muted-foreground">{subtitulo}</p>}
        <div className="mt-8">{children}</div>
      </main>
      <footer className="mx-auto flex max-w-3xl flex-wrap gap-x-6 gap-y-2 border-t border-border px-5 py-6 text-sm">
        <Link to="/" className="text-muted-foreground underline underline-offset-4 hover:text-foreground">Entrar</Link>
        <Link to="/privacidade" className="text-muted-foreground underline underline-offset-4 hover:text-foreground">Privacidade</Link>
        <Link to="/termos" className="text-muted-foreground underline underline-offset-4 hover:text-foreground">Termos de uso</Link>
      </footer>
    </div>
  );
}

/** Texto corrido das páginas de privacidade e termos (títulos de seção e parágrafos legíveis). */
export function Texto({ children }: { children: ReactNode }) {
  return <div className="space-y-4 text-[17px] leading-relaxed [&_h2]:titulo-secao [&_h2]:mt-10 [&_h2]:text-[1.6rem] [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-foreground [&_ul]:space-y-1.5 text-foreground/90">{children}</div>;
}

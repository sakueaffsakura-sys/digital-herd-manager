import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { SCRIPT_TEMA, useTemaEscuro } from "@/lib/tema";

const SCRIPT_RECUPERACAO = `(function(){try{var h=location.hash;if(location.pathname!=='/redefinir-senha'&&/type=recovery|error_code=otp_expired/.test(h)){location.replace('/redefinir-senha'+h)}}catch(e){}})();`;

function TelaSimples({ titulo, texto, children }: { titulo: string; texto: string; children: ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <p aria-hidden className="mb-4 h-1.5 w-16 rounded-full bg-primary" />
        <h1 className="titulo-pagina text-foreground">{titulo}</h1>
        <p className="mt-3 text-muted-foreground">{texto}</p>
        <div className="mt-8 flex flex-wrap gap-3">{children}</div>
      </div>
    </main>
  );
}

function NotFoundComponent() {
  return (
    <TelaSimples titulo="Página não encontrada" texto="O endereço pode estar errado ou a página mudou de lugar.">
      <Link
        to="/"
        className="inline-flex h-12 items-center justify-center rounded-[10px] bg-primary px-5 font-bold text-primary-foreground hover:bg-pasto-escuro"
      >
        Voltar ao início
      </Link>
    </TelaSimples>
  );
}

function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <TelaSimples
      titulo="Esta página não abriu"
      texto="Confira a internet e tente de novo. Se continuar, volte ao início e abra a página pelo menu."
    >
      <Button
        className="h-12 px-5 text-base"
        onClick={() => {
          router.invalidate();
          reset();
        }}
      >
        Tentar de novo
      </Button>
      <a
        href="/"
        className="inline-flex h-12 items-center justify-center rounded-[10px] border border-input bg-card px-5 font-bold text-foreground hover:bg-accent"
      >
        Voltar ao início
      </a>
    </TelaSimples>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#12301f" },
      { title: "Pecuária Digital" },
      { name: "description", content: "Gestão pecuária para a sua propriedade." },
      { name: "author", content: "Pecuária Digital" },
      { property: "og:title", content: "Pecuária Digital" },
      { property: "og:description", content: "Gestão pecuária para a sua propriedade." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      // Títulos e números: Big Shoulders Display. Texto: Atkinson Hyperlegible Next (feita para leitura fácil).
      // Uma folha por família: se uma falhar, a outra continua.
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;800&display=swap" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Next:wght@400;700&display=swap" },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* Aplica o tema claro/escuro antes da primeira pintura (sem piscar). */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
        {/* Link de senha nova que caiu em outra página: leva para /redefinir-senha antes de qualquer coisa. */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_RECUPERACAO }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function ToasterDoTema() {
  const escuro = useTemaEscuro();
  return <Toaster theme={escuro ? "dark" : "light"} position="top-center" closeButton />;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useEffect(() => { void import("@/lib/pwa-register").then((m) => m.registrarPwa()).catch(() => {}); }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <ToasterDoTema />
    </QueryClientProvider>
  );
}

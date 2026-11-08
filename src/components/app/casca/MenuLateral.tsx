import { useState } from "react";
import { ChevronDown, Search, ShieldCheck, X } from "lucide-react";
import marcaBranca from "@/assets/marca/marca-branca.webp";
import type { GrupoMenu } from "./navegacao";

type Props = {
  grupos: GrupoMenu[];
  secao: string;
  aberto: boolean;
  ehAdmin: boolean;
  aoIr: (chave: string) => void;
  aoFechar: () => void;
  aoAdmin: () => void;
  /** No celular a busca fica dentro do menu (a barra do topo é estreita). */
  aoBuscar?: () => void;
};

/**
 * Menu lateral em verde-curral. No computador fica fixo (248px); no celular abre por cima,
 * pelo botão "Mais" da barra de baixo. É o mesmo elemento nos dois casos (o passeio da Yui
 * aponta para os itens pelo atributo data-tour).
 */
export function MenuLateral({ grupos, secao, aberto, ehAdmin, aoIr, aoFechar, aoAdmin, aoBuscar }: Props) {
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});
  return (
    <>
      <aside
        id="menu-principal"
        aria-label="Menu principal"
        className={`menu-curral fixed inset-y-0 left-0 z-50 flex w-[min(320px,86vw)] flex-col bg-sidebar text-sidebar-foreground transition-[transform,visibility] duration-200 ease-out lg:visible lg:z-30 lg:w-[248px] lg:translate-x-0 ${aberto ? "visible translate-x-0" : "invisible -translate-x-full"}`}
      >
        <div className="flex h-16 shrink-0 items-center gap-2.5 px-4 lg:h-[72px] lg:px-5">
          <img src={marcaBranca} alt="" width={40} height={40} className="size-10 shrink-0 object-contain" />
          <span className="font-display text-[1.6rem] font-extrabold leading-none tracking-normal text-white">Pecuária Digital</span>
          <button
            type="button"
            onClick={aoFechar}
            className="ml-auto grid size-12 place-items-center rounded-[10px] text-sidebar-foreground hover:bg-sidebar-accent lg:hidden"
            aria-label="Fechar menu"
          >
            <X className="size-6" />
          </button>
        </div>
        {aoBuscar && (
          <div className="px-3 pb-2 lg:hidden">
            <button type="button" onClick={aoBuscar} className="flex min-h-12 w-full items-center gap-3 rounded-[10px] bg-white/[0.08] px-3 text-left text-[15px] text-sidebar-foreground hover:bg-white/[0.12]">
              <Search className="size-5 shrink-0" />
              Buscar animal ou página
            </button>
          </div>
        )}
        <nav aria-label="Áreas da fazenda" className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 [scrollbar-color:var(--sidebar-border)_transparent] [scrollbar-width:thin]">
          {grupos.map((g, i) => {
            const nome = g.rotulo ?? `g${i}`;
            // Grupo com nome abre e fecha: com muitas áreas, o menu aberto todo viraria
            // uma rolagem sem fim. Abre o grupo da área em que a pessoa está.
            const temAtiva = g.itens.some((it) => it.chave === secao);
            const aberta = !g.rotulo || (abertos[nome] ?? temAtiva);
            const itens = (
              <ul className="space-y-0.5">
                {g.itens.map(({ chave, rotulo, icone: Icone }) => {
                  const ativo = secao === chave;
                  return (
                    <li key={chave}>
                      <button
                        type="button"
                        data-tour={`nav-${chave}`}
                        aria-current={ativo ? "page" : undefined}
                        onClick={() => aoIr(chave)}
                        className={`relative flex min-h-12 w-full items-center gap-3 rounded-[10px] px-3 text-left text-[15px] transition-colors lg:min-h-11 ${
                          ativo ? "marca-ativa bg-sidebar-accent font-bold text-white" : "text-sidebar-foreground/90 hover:bg-white/[0.07] hover:text-white"
                        }`}
                      >
                        <Icone className="size-5 shrink-0" />
                        <span className="min-w-0 truncate">{rotulo}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            );
            return (
              <div key={nome} className={i === 0 ? "mt-1" : "mt-2"}>
                {g.rotulo && (
                  <button
                    type="button"
                    aria-expanded={aberta}
                    onClick={() => setAbertos((a) => ({ ...a, [nome]: !aberta }))}
                    className="flex min-h-11 w-full items-center gap-2 rounded-[10px] px-3 text-left text-sm font-bold text-sidebar-foreground/65 hover:bg-white/[0.07] hover:text-white"
                  >
                    <ChevronDown className={`size-4 shrink-0 transition-transform ${aberta ? "" : "-rotate-90"}`} />
                    <span className="min-w-0 truncate">{g.rotulo}</span>
                    {!aberta && temAtiva && <span className="ml-auto size-2 shrink-0 rounded-full bg-white" aria-hidden />}
                  </button>
                )}
                {aberta && itens}
              </div>
            );
          })}
        </nav>
        {ehAdmin && (
          <div className="shrink-0 border-t border-sidebar-border px-3 py-2.5">
            <button type="button" onClick={aoAdmin} className="flex min-h-11 w-full items-center gap-3 rounded-[10px] px-3 text-[15px] font-bold text-white hover:bg-white/[0.07]">
              <ShieldCheck className="size-5" />
              Área do administrador
            </button>
          </div>
        )}
      </aside>
      {aberto && <div aria-hidden className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={aoFechar} />}
    </>
  );
}

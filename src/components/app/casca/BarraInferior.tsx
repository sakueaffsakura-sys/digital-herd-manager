import { useState } from "react";
import { CalendarDays, LayoutDashboard, Menu, Milk, NotebookPen, Plus, Scale, Syringe } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { HerdIcon } from "../HerdIcon";
import type { IconType } from "../shared";

/** Atalhos do botão "Lançar": seção + o que abrir nela. */
export const LANCAMENTOS = [
  { rotulo: "Leite do dia", frase: "Litros de uma vaca", secao: "producao", novo: "1", icone: Milk },
  { rotulo: "Animal", frase: "Cadastrar no rebanho", secao: "rebanho", novo: "1", icone: HerdIcon },
  { rotulo: "Vacina", frase: "Registrar aplicação", secao: "vacinacao", novo: "1", icone: Syringe },
  { rotulo: "Pesagem", frase: "Peso de um animal", secao: "bezerros", novo: "1", icone: Scale },
  { rotulo: "Anotação", frase: "Observação da ordenha", secao: "producao", novo: "anotacao", icone: NotebookPen },
] as const;

/** Barra de baixo do celular: Início, Rebanho, Lançar (no meio), Agenda e Mais (abre o menu). */
export function BarraInferior({
  secao, aoIr, aoLancar, aoMais,
}: {
  secao: string;
  aoIr: (secao: string) => void;
  aoLancar: (secao: string, novo: string) => void;
  aoMais: () => void;
}) {
  const [lancar, setLancar] = useState(false);
  const item = (chave: string, rotulo: string, Icone: IconType) => {
    const ativo = secao === chave;
    return (
      <button
        type="button"
        onClick={() => aoIr(chave)}
        aria-current={ativo ? "page" : undefined}
        className={`flex h-full min-w-0 flex-col items-center justify-center gap-0.5 text-xs ${ativo ? "font-bold text-primary" : "text-muted-foreground"}`}
      >
        <Icone className="size-6" />
        <span className="truncate">{rotulo}</span>
      </button>
    );
  };
  return (
    <>
      <nav aria-label="Atalhos" className="barra-inferior fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] lg:hidden">
        <div className="grid h-16 grid-cols-5">
          {item("inicio", "Início", LayoutDashboard)}
          {item("rebanho", "Rebanho", HerdIcon)}
          <button type="button" onClick={() => setLancar(true)} className="flex flex-col items-center justify-center gap-0.5 text-xs font-bold text-foreground" aria-haspopup="dialog">
            <span className="-mt-5 grid size-14 place-items-center rounded-full border-4 border-card bg-primary text-primary-foreground">
              <Plus className="size-7" />
            </span>
            Lançar
          </button>
          {item("agenda", "Agenda", CalendarDays)}
          <button type="button" onClick={aoMais} aria-controls="menu-principal" className="flex h-full flex-col items-center justify-center gap-0.5 text-xs text-muted-foreground">
            <Menu className="size-6" />
            Mais
          </button>
        </div>
      </nav>
      <Sheet open={lancar} onOpenChange={setLancar}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <SheetHeader className="text-left">
            <SheetTitle className="titulo-secao">O que você quer lançar?</SheetTitle>
            <SheetDescription>Abre o formulário certo, já na página dele.</SheetDescription>
          </SheetHeader>
          <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {LANCAMENTOS.map((l) => {
              const Icone = l.icone;
              return (
                <li key={l.rotulo}>
                  <button
                    type="button"
                    onClick={() => { setLancar(false); aoLancar(l.secao, l.novo); }}
                    className="flex min-h-[4.5rem] w-full items-center gap-3 rounded-xl border border-border bg-card px-3 text-left hover:border-primary"
                  >
                    <Icone className="size-6 shrink-0 text-primary" />
                    <span className="min-w-0">
                      <span className="block font-bold leading-tight">{l.rotulo}</span>
                      <span className="block text-sm leading-tight text-muted-foreground">{l.frase}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </SheetContent>
      </Sheet>
    </>
  );
}

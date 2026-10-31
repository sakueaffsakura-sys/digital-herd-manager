import { Check, ChevronDown, Crown, KeyRound, LogOut, Monitor, Moon, Plus, Search, Sun, UserRound } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { escolherTema, useTema, type Tema } from "@/lib/tema";
import { AvatarView, useMyProfile } from "../account";
import { useYuiAvatar } from "../yui/useYuiAvatar";
import { Avisos } from "./Avisos";

type Propriedade = { id: string; nome: string };

export function BarraTopo({
  propriedades, propriedadeId, aoTrocarPropriedade, aoNovaPropriedade, aoBuscar, aoIr, aoSair, userId, email, ehAdmin,
}: {
  propriedades: Propriedade[];
  propriedadeId: string | null;
  aoTrocarPropriedade: (id: string) => void;
  aoNovaPropriedade: () => void;
  aoBuscar: () => void;
  aoIr: (secao: string) => void;
  aoSair: () => void;
  userId?: string;
  email?: string;
  ehAdmin: boolean;
}) {
  const atual = propriedades.find((p) => p.id === propriedadeId);
  return (
    <header className="barra-topo sticky top-0 z-30 flex h-16 items-center gap-1.5 border-b border-border bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:bg-background/85 sm:gap-2 sm:px-4 lg:h-[72px] lg:px-6">
      <DropdownMenu>
        <DropdownMenuTrigger
          data-tour="propriedade"
          className="flex h-12 min-w-0 max-w-[60vw] items-center gap-2 rounded-[10px] px-2.5 text-left hover:bg-accent sm:max-w-xs"
          aria-label={atual ? `Propriedade: ${atual.nome}. Trocar de propriedade` : "Escolher propriedade"}
        >
          <span className="min-w-0">
            <span className="block text-xs leading-none text-muted-foreground">Propriedade</span>
            <span className="block truncate font-display text-[1.45rem] font-extrabold leading-tight">{atual?.nome ?? "Escolher"}</span>
          </span>
          <ChevronDown className="size-5 shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72 rounded-xl p-1.5">
          <DropdownMenuLabel className="text-sm">Suas propriedades</DropdownMenuLabel>
          {propriedades.map((p) => (
            <DropdownMenuItem key={p.id} onSelect={() => aoTrocarPropriedade(p.id)} className="min-h-11 gap-2 text-[15px]">
              <Check className={`size-4 ${p.id === propriedadeId ? "opacity-100" : "opacity-0"}`} />
              <span className="truncate">{p.nome}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={aoNovaPropriedade} className="min-h-11 gap-2 text-[15px]">
            <Plus className="size-4" />
            Cadastrar outra propriedade
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <button
        type="button"
        data-tour="busca"
        onClick={aoBuscar}
        className="ml-auto flex h-12 items-center gap-2 rounded-[10px] border border-input bg-card px-3 text-muted-foreground hover:border-primary hover:text-foreground lg:ml-6 lg:w-full lg:max-w-md"
        aria-label="Buscar animal, lote ou página (Ctrl+K)"
      >
        <Search className="size-5 shrink-0" />
        <span className="hidden truncate text-[15px] lg:inline">Buscar animal, lote ou página</span>
        <kbd className="ml-auto hidden rounded-md border border-border bg-muted px-1.5 py-0.5 text-xs font-bold lg:inline">Ctrl K</kbd>
      </button>

      <div className="flex shrink-0 items-center gap-0.5 sm:gap-1 lg:ml-auto">
        <BotaoYui ehAdmin={ehAdmin} />
        <Avisos propriedadeId={propriedadeId} aoIr={aoIr} />
        <ContaMenu userId={userId} email={email} aoIr={aoIr} aoSair={aoSair} />
      </div>
    </header>
  );
}

function BotaoYui({ ehAdmin }: { ehAdmin: boolean }) {
  const foto = useYuiAvatar(ehAdmin);
  return (
    <button
      type="button"
      data-tour="yui"
      onClick={() => window.dispatchEvent(new Event("yui:abrir"))}
      className="flex h-12 items-center gap-2 rounded-[10px] px-1.5 hover:bg-accent sm:px-2"
      aria-label="Falar com a Yui, a assistente de ajuda"
    >
      <img src={foto} alt="" width={36} height={36} className="size-9 rounded-full border-2 border-primary object-cover" />
      <span className="hidden text-[15px] font-bold xl:inline">Ajuda</span>
    </button>
  );
}

const TEMAS: { valor: Tema; rotulo: string; icone: typeof Sun }[] = [
  { valor: "claro", rotulo: "Claro", icone: Sun },
  { valor: "escuro", rotulo: "Escuro", icone: Moon },
  { valor: "automatico", rotulo: "Igual ao aparelho", icone: Monitor },
];

function ContaMenu({ userId, email, aoIr, aoSair }: { userId?: string; email?: string; aoIr: (s: string) => void; aoSair: () => void }) {
  const perfil = useMyProfile(userId);
  const tema = useTema();
  const nome = perfil.data?.nome_exibicao || perfil.data?.nome_completo || "Minha conta";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="grid size-12 place-items-center rounded-[10px] hover:bg-accent" aria-label="Minha conta">
        <AvatarView profile={perfil.data ?? null} size={36} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 rounded-xl p-1.5">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate font-bold">{nome}</span>
          {email && <span className="block truncate text-sm text-muted-foreground">{email}</span>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => aoIr("perfil")} className="min-h-11 gap-2 text-[15px]"><UserRound className="size-4" />Meu perfil</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => aoIr("seguranca")} className="min-h-11 gap-2 text-[15px]"><KeyRound className="size-4" />Senha e segurança</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => aoIr("assinatura")} className="min-h-11 gap-2 text-[15px]"><Crown className="size-4" />Assinatura</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-sm text-muted-foreground">Aparência</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={tema} onValueChange={(v) => escolherTema(v as Tema)}>
          {TEMAS.map(({ valor, rotulo, icone: Icone }) => (
            <DropdownMenuRadioItem key={valor} value={valor} className="min-h-11 gap-2 text-[15px]">
              <Icone className="size-4" />
              {rotulo}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={aoSair} className="min-h-11 gap-2 text-[15px]"><LogOut className="size-4" />Sair</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

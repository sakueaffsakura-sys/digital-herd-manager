import { useRef, useState, type ComponentType, type ReactNode, type RefObject } from "react";
import {
  AlertTriangle, ArrowDownLeft, ArrowRightLeft, ArrowUpRight, Check, ClipboardList, Clock3, Info, Plus, Repeat2, Tag, Tractor, TrendingUp, Upload, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Database } from "@/integrations/supabase/types";
import { dataLocalISO } from "@/lib/datas";

export type TableName = keyof Database["public"]["Tables"];
export type Row = Record<string, unknown>;
export type Field = { key: string; label: string; type?: "text" | "date" | "number" | "textarea" | "select" | "animal" | "lote" | "vacina"; required?: boolean; options?: { value: string; label: string }[]; sex?: "M" | "F"; activeOnly?: boolean; /** Exemplo do que escrever, dentro do campo vazio. */ dica?: string; /** Fica escondido atrás de "Mais detalhes" até alguém abrir. */ avancado?: boolean };
export type FilterDef = { key: string; label: string; options: { value: string; label: string }[] };
export type ImpliedFilter = { key: string; isNull?: boolean; value?: string };
export type IconType = ComponentType<{ className?: string }>;
export type Module = { title: string; singular: string; /** Botão principal ("Novo animal"). */ novo?: string; /** Ação do estado vazio ("Cadastrar o primeiro animal"). */ primeiro?: string; table: TableName; icon: IconType; description: string; fields: Field[]; columns: { key: string; label: string }[]; filter?: (row: Row) => boolean; searchColumns?: string[]; filters?: FilterDef[]; impliedFilter?: ImpliedFilter };
export type FormRefs = {
  animals: { id: string; nome: string | null; numero_brinco: string; data_nascimento: string | null; sexo: string; situacao: string }[];
  lots: { id: string; nome: string }[];
  vaccines: { id: string; nome: string }[];
};

/** Data de hoje no relógio de quem usa (não em UTC). Veja src/lib/datas.ts. */
export const dateNow = () => dataLocalISO();
export const money = (value: unknown) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
/**
 * Texto para a tela. Só códigos do banco em minúsculas ("em_andamento") perdem o "_";
 * nomes e anotações digitados pela pessoa ("Lote_A", "ver cerca_norte") ficam como estão.
 */
export const pretty = (value: unknown) => {
  if (value == null || value === "") return "—";
  const texto = String(value);
  return /^[a-z0-9]+(_[a-z0-9]+)+$/.test(texto) ? texto.replaceAll("_", " ") : texto;
};

export const friendlyError = (error: unknown) => {
  const e = error as { code?: string; message?: string };
  const message = e?.message ?? "Não foi possível concluir a operação.";
  if (e?.code === "23505") {
    if (message.includes("numero_brinco")) return "Já existe um animal com esse número de brinco.";
    if (message.includes("bezerro_id")) return "Esse bezerro já possui um nascimento registrado.";
    if (message.includes("animal_id") && message.includes("data")) return "Já existe um registro desse animal nessa data.";
    if (message.includes("nome")) return "Já existe um registro com esse nome nesta propriedade.";
    return "Esse registro já existe.";
  }
  if (e?.code === "23514") return "Os dados informados não atendem às regras do cadastro. Revise as datas e os vínculos.";
  if (e?.code === "23503") return "Esse registro está vinculado a outros dados e não pode ser removido.";
  return message;
};

export function PageTitle({ title, description, action }: { icon?: IconType; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="titulo-pagina break-words">{title}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">{description}</p>
      </div>
      {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}

export function Panel({ title, subtitle, children, action, className }: { title: string; subtitle?: string; children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <section className={`painel min-w-0 p-4 sm:p-5 ${className ?? ""}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="titulo-secao text-[1.4rem] sm:text-[1.625rem]">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Estado vazio: uma frase do que falta e, se fizer sentido, UM botão de ação. */
export function Empty({ message, action }: { message: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="grid min-h-36 place-items-center px-4 py-8 text-center">
      <div className="max-w-sm">
        <p className="text-muted-foreground">{message}</p>
        {action && (
          <Button className="mt-4 h-12 px-5" onClick={action.onClick}>
            <Plus />
            {action.label}
          </Button>
        )}
      </div>
    </div>
  );
}

export function EmptyProperty({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="max-w-md">
        <Tractor className="mb-4 size-12 text-primary" />
        <h1 className="titulo-pagina">Comece pela sua propriedade</h1>
        <p className="mt-2 text-muted-foreground">Cadastre a fazenda para anotar animais, leite, vacinas e dinheiro.</p>
        <Button className="mt-6 h-12 px-5 text-base" onClick={onCreate}><Plus />Cadastrar a propriedade</Button>
      </div>
    </div>
  );
}

export function EmptySection({ go }: { go: () => void }) {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <div className="max-w-md">
        <ClipboardList className="mb-3 size-10 text-primary" />
        <h1 className="titulo-pagina">Esta área não existe</h1>
        <p className="mt-2 text-muted-foreground">O endereço pode estar errado. Volte ao Início e use o menu.</p>
        <Button className="mt-5 h-12 px-5" onClick={go}>Voltar ao início</Button>
      </div>
    </div>
  );
}

type SeloInfo = { rotulo: string; cor: "alerta" | "aviso" | "pasto" | "cinza"; icone: IconType };
const SELOS: Record<string, SeloInfo> = {
  vencida: { rotulo: "Atrasada", cor: "alerta", icone: AlertTriangle },
  proxima: { rotulo: "Vence logo", cor: "aviso", icone: Clock3 },
  em_dia: { rotulo: "Em dia", cor: "pasto", icone: Check },
  substituida: { rotulo: "Reforço aplicado", cor: "cinza", icone: Repeat2 },
  ativo: { rotulo: "Ativo", cor: "pasto", icone: Check },
  vendido: { rotulo: "Vendido", cor: "cinza", icone: Tag },
  perdido: { rotulo: "Perdido", cor: "alerta", icone: XCircle },
  falecido: { rotulo: "Morto", cor: "alerta", icone: XCircle },
  transferido: { rotulo: "Transferido", cor: "cinza", icone: ArrowRightLeft },
  em_andamento: { rotulo: "Em andamento", cor: "aviso", icone: Clock3 },
  confirmada: { rotulo: "Confirmada", cor: "pasto", icone: Check },
  falhou: { rotulo: "Falhou", cor: "alerta", icone: XCircle },
  parto_realizado: { rotulo: "Parto realizado", cor: "pasto", icone: Check },
  cancelada: { rotulo: "Cancelada", cor: "cinza", icone: XCircle },
  receita: { rotulo: "Receita", cor: "pasto", icone: ArrowDownLeft },
  despesa: { rotulo: "Despesa", cor: "alerta", icone: ArrowUpRight },
  investimento: { rotulo: "Investimento", cor: "cinza", icone: TrendingUp },
  aprovado: { rotulo: "Aprovado", cor: "pasto", icone: Check },
  pendente: { rotulo: "Em análise", cor: "aviso", icone: Clock3 },
  recusado: { rotulo: "Recusado", cor: "alerta", icone: XCircle },
  estornado: { rotulo: "Estornado", cor: "cinza", icone: Repeat2 },
  expirado: { rotulo: "Vencido", cor: "aviso", icone: Clock3 },
  aberto: { rotulo: "Aguardando resposta", cor: "aviso", icone: Clock3 },
  respondido: { rotulo: "Respondido", cor: "pasto", icone: Check },
  fechado: { rotulo: "Encerrado", cor: "cinza", icone: Check },
};
const COR_SELO: Record<SeloInfo["cor"], string> = {
  alerta: "bg-alerta-fundo text-alerta",
  aviso: "bg-aviso-fundo text-aviso",
  pasto: "bg-sucesso-fundo text-primary",
  cinza: "bg-muted text-muted-foreground",
};

/** Selo de situação: sempre ícone + texto (nunca só cor). */
export function Status({ value }: { value: string }) {
  const info = SELOS[value] ?? { rotulo: pretty(value), cor: "cinza" as const, icone: Info };
  const Icone = info.icone;
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-sm font-bold leading-none ${COR_SELO[info.cor]}`}>
      <Icone className="size-3.5 shrink-0" />
      {info.rotulo}
    </span>
  );
}

export type Tone = "primary" | "chart-2" | "chart-3" | "chart-4" | "chart-5" | "destructive";

/** Variação percentual entre dois valores; null quando não há base de comparação. */
export const variacao = (atual: number, anterior: number) => (anterior ? ((atual - anterior) / Math.abs(anterior)) * 100 : null);

export function Delta({ value, invert, label }: { value: number | null; invert?: boolean; label?: string }) {
  if (value == null || !Number.isFinite(value)) return <span className="text-sm text-muted-foreground">{label ? `sem dados ${label}` : "—"}</span>;
  const bom = invert ? value <= 0 : value >= 0;
  return (
    <span className={`text-sm font-bold ${bom ? "text-primary" : "text-alerta"}`}>
      {value >= 0 ? "▲" : "▼"} {Math.abs(value).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
      {label && <span className="font-normal text-muted-foreground"> {label}</span>}
    </span>
  );
}

/** Número de destaque (fora do Início, onde o destaque é o brinco). */
export function Metric({ label, value, icon: Icon, hint, onClick }: { label: string; value: string | number; icon?: IconType; tone?: Tone; hint?: ReactNode; onClick?: () => void }) {
  const content = (
    <>
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0 text-sm text-muted-foreground">{label}</span>
        {Icon && <Icon className="size-5 shrink-0 text-muted-foreground" />}
      </span>
      <strong className="mt-2 block break-words font-display text-[2.1rem] font-extrabold leading-none tabular-nums">{value}</strong>
      {hint && <span className="mt-2 block">{hint}</span>}
    </>
  );
  const classes = "painel block min-w-0 p-4 text-left";
  return onClick ? (
    <button type="button" onClick={onClick} className={`${classes} transition-colors hover:border-primary`}>
      {content}
    </button>
  ) : (
    <div className={classes}>{content}</div>
  );
}

export function MiniList({ rows, empty, render }: { rows: Row[]; empty: string; render: (r: Row) => ReactNode }) {
  return rows.length ? (
    <div className="divide-y divide-border">
      {rows.map((r, i) => (
        <div key={String(r["id"] ?? i)} className="flex min-h-14 items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
          {render(r)}
        </div>
      ))}
    </div>
  ) : (
    <Empty message={empty} />
  );
}
/** Abas simples (Aplicações / Tipos de vacina, Compras / Vendas…). */
export function Abas<T extends string>({ valor, opcoes, aoMudar, rotulo }: { valor: T; opcoes: { valor: T; rotulo: string; tour?: string }[]; aoMudar: (v: T) => void; rotulo: string }) {
  return (
    <div role="tablist" aria-label={rotulo} className="mb-5 inline-flex max-w-full overflow-x-auto rounded-[10px] border border-input bg-card p-1">
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          role="tab"
          aria-selected={valor === o.valor}
          data-tour={o.tour}
          onClick={() => aoMudar(o.valor)}
          className={`h-11 shrink-0 rounded-lg px-4 font-bold whitespace-nowrap ${valor === o.valor ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}

/** Escolher arquivo: botão em português com o nome do arquivo ao lado (o campo nativo fica escondido). */
export function CampoArquivo({
  id, rotulo, ajuda, accept, obrigatorio, aoEscolher, inputRef,
}: {
  id: string; rotulo: string; ajuda?: string; accept: string; obrigatorio?: boolean;
  aoEscolher?: (arquivo: File | null) => void; inputRef?: RefObject<HTMLInputElement | null>;
}) {
  const proprio = useRef<HTMLInputElement>(null);
  const campo = inputRef ?? proprio;
  const [nome, setNome] = useState<string | null>(null);
  return (
    <div>
      <span id={`${id}-rotulo`} className="mb-1.5 block text-[15px] font-bold">{rotulo}</span>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" className="h-12" onClick={() => campo.current?.click()} aria-describedby={`${id}-rotulo`}>
          <Upload />{nome ? "Trocar arquivo" : "Escolher arquivo"}
        </Button>
        <span className="min-w-0 flex-1 truncate text-muted-foreground">{nome ?? "Nenhum arquivo escolhido"}</span>
      </div>
      {ajuda && <p className="mt-1 text-sm text-muted-foreground">{ajuda}</p>}
      <input
        ref={campo} id={id} type="file" accept={accept} required={obrigatorio} className="sr-only"
        aria-labelledby={`${id}-rotulo`}
        onChange={(e) => { const f = e.target.files?.[0] ?? null; setNome(f?.name ?? null); aoEscolher?.(f); }}
      />
    </div>
  );
}

import type { ComponentType, ReactNode } from "react";
import {
  ClipboardList,
  MoreHorizontal,
  PackageOpen,
  Plus,
  Tractor,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Database } from "@/integrations/supabase/types";

export type TableName = keyof Database["public"]["Tables"];
export type Row = Record<string, unknown>;
export type Field = { key: string; label: string; type?: "text" | "date" | "number" | "textarea" | "select" | "animal" | "lote" | "vacina"; required?: boolean; options?: { value: string; label: string }[]; sex?: "M" | "F"; activeOnly?: boolean };
export type FilterDef = { key: string; label: string; options: { value: string; label: string }[] };
export type ImpliedFilter = { key: string; isNull?: boolean; value?: string };
export type IconType = ComponentType<{ className?: string }>;
export type Module = { title: string; singular: string; table: TableName; icon: IconType; description: string; fields: Field[]; columns: { key: string; label: string }[]; filter?: (row: Row) => boolean; searchColumns?: string[]; filters?: FilterDef[]; impliedFilter?: ImpliedFilter };
export type FormRefs = {
  animals: { id: string; nome: string | null; numero_brinco: string; data_nascimento: string | null; sexo: string; situacao: string }[];
  lots: { id: string; nome: string }[];
  vaccines: { id: string; nome: string }[];
};

export const dateNow = () => new Date().toISOString().slice(0, 10);
export const money = (value: unknown) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const pretty = (value: unknown) => (value == null || value === "" ? "—" : String(value).replaceAll("_", " "));

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

export function PageTitle({ icon: Icon, title, description, action }: { icon: IconType; title: string; description: string; action?: ReactNode }) {
  return <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="mb-2 flex items-center gap-2 text-primary"><Icon className="size-5" /><span className="text-xs font-bold uppercase">Pecuária Digital</span></div><h1 className="text-3xl font-bold">{title}</h1><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>{action}</div>;
}

export function Panel({ title, subtitle, children, action, className }: { title: string; subtitle: string; children: ReactNode; action?: ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-border bg-card p-5 ${className ?? ""}`}><div className="mb-5 flex items-start justify-between gap-3"><div><h2 className="font-semibold">{title}</h2><p className="text-xs text-muted-foreground">{subtitle}</p></div>{action}</div>{children}</section>;
}

export function Empty({ message }: { message: string }) {
  return <div className="grid min-h-36 place-items-center p-6 text-center"><div><PackageOpen className="mx-auto mb-2 size-7 text-muted-foreground" /><p className="text-sm text-muted-foreground">{message}</p></div></div>;
}

export function EmptyProperty({ onCreate }: { onCreate: () => void }) {
  return <div className="grid min-h-[70vh] place-items-center"><div className="max-w-md text-center"><Tractor className="mx-auto mb-4 size-12 text-primary" /><h1 className="text-2xl font-bold">Comece pela sua propriedade</h1><p className="mt-2 text-muted-foreground">Cadastre a fazenda para organizar animais, produção e finanças.</p><Button className="mt-6" onClick={onCreate}><Plus />Cadastrar propriedade</Button></div></div>;
}

export function EmptySection({ go }: { go: () => void }) {
  return <div className="grid min-h-[60vh] place-items-center text-center"><div><ClipboardList className="mx-auto mb-3 size-10 text-primary" /><h1 className="text-2xl font-bold">Área não encontrada</h1><Button className="mt-5" onClick={go}>Voltar ao início</Button></div></div>;
}

export function Status({ value }: { value: string }) {
  const risk = value.includes("vencid") || value.includes("falh") || value.includes("perdid") || value.includes("falecid") || value === "despesa";
  const warn = value.includes("proxim") || value.includes("andamento") || value === "investimento";
  return <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold uppercase ${risk ? "bg-destructive/15 text-destructive" : warn ? "bg-chart-4/15 text-chart-4" : "bg-primary/15 text-primary"}`}>{pretty(value)}</span>;
}

export type Tone = "primary" | "chart-2" | "chart-3" | "chart-4" | "chart-5" | "destructive";
const toneCls: Record<Tone, string> = { primary: "bg-primary/12 text-primary", "chart-2": "bg-chart-2/12 text-chart-2", "chart-3": "bg-chart-3/12 text-chart-3", "chart-4": "bg-chart-4/12 text-chart-4", "chart-5": "bg-chart-5/12 text-chart-5", destructive: "bg-destructive/12 text-destructive" };

/** Variação percentual entre dois valores; null quando não há base de comparação. */
export const variacao = (atual: number, anterior: number) => (anterior ? ((atual - anterior) / Math.abs(anterior)) * 100 : null);

export function Delta({ value, invert, label }: { value: number | null; invert?: boolean; label?: string }) {
  if (value == null || !Number.isFinite(value)) return <span className="text-[11px] text-muted-foreground">{label ? `sem dados ${label}` : "—"}</span>;
  const bom = invert ? value <= 0 : value >= 0;
  return <span className={`text-[11px] font-semibold ${bom ? "text-primary" : "text-destructive"}`}>{value >= 0 ? "▲" : "▼"} {Math.abs(value).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%{label && <span className="font-normal text-muted-foreground"> {label}</span>}</span>;
}

export function Metric({ label, value, icon: Icon, tone = "primary", hint, onClick }: { label: string; value: string | number; icon?: IconType; tone?: Tone; hint?: ReactNode; onClick?: () => void }) {
  const Tag = onClick ? "button" : "div";
  return <Tag type={onClick ? "button" : undefined} onClick={onClick} className={`group relative overflow-hidden rounded-xl border border-border bg-card p-4 text-left transition-colors ${onClick ? "cursor-pointer hover:border-primary/40" : ""}`}>
    <div className="flex items-center justify-between gap-2"><span className="text-xs font-medium text-muted-foreground">{label}</span>{Icon && <span className={`grid size-8 place-items-center rounded-lg ${toneCls[tone]}`}><Icon className="size-4" /></span>}</div>
    <strong className="mt-3 block text-2xl font-bold tabular-nums tracking-tight">{value}</strong>
    {hint && <div className="mt-1">{hint}</div>}
  </Tag>;
}

export function MiniList({ rows, empty, render }: { rows: Row[]; empty: string; render: (r: Row) => ReactNode }) {
  return rows.length ? <div className="divide-y divide-border">{rows.map((r, i) => <div key={String(r["id"] ?? i)} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 [&_strong]:block [&_span]:text-xs [&_span]:text-muted-foreground">{render(r)}</div>)}</div> : <Empty message={empty} />;
}
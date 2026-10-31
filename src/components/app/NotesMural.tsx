import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Milk,
  AlertCircle,
  NotebookPen,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { loadFormRefs } from "./formRefs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { maxPage, pageSummary, pageWindow, PAGE_SIZES } from "@/lib/pagination";
import { createPageableTable, useDebouncedValue, usePagedRows } from "./usePagedRows";
import { Empty, PageTitle, friendlyError, pretty, type FormRefs, type Module, type Row } from "./shared";
import { formatarDataBR } from "@/lib/datas";
import { RecordDialog } from "./RecordDialog";
import { EXEMPLOS_NOTA } from "./yui/tourSteps";

export const productionNotes: Module = {
  title: "Anotações da Produção",
  singular: "anotação",
  table: "anotacoes_producao",
  icon: NotebookPen,
  description: "Comportamento, alimentação e observações ligadas à produção.",
  searchColumns: ["observacao", "comportamento", "alimentacao"],
  columns: [
    { key: "data", label: "Data" },
    { key: "animal_id", label: "Animal" },
    { key: "lote_id", label: "Lote" },
    { key: "producao", label: "Produção (L)" },
    { key: "observacao", label: "Observação" },
  ],
  fields: [
    { key: "animal_id", label: "Animal", type: "animal", activeOnly: true },
    { key: "lote_id", label: "Lote", type: "lote" },
    { key: "data", label: "Data", type: "date", required: true },
    { key: "producao", label: "Produção (L)", type: "number" },
    { key: "observacao", label: "Observação", type: "textarea", required: true },
    { key: "comportamento", label: "Comportamento" },
    { key: "alimentacao", label: "Alimentação" },
    { key: "informacoes_adicionais", label: "Informações adicionais", type: "textarea" },
  ],
};

const NOTE_COLS =
  "id,data,animal_id,lote_id,producao,observacao,comportamento,alimentacao,informacoes_adicionais,created_at";

export function NotesMural({ propertyId, globalSearch, abrirNova, aoAbrirNova }: { propertyId: string; globalSearch: string; abrirNova?: boolean; aoAbrirNova?: () => void }) {
  const qc = useQueryClient();
  const [local, setLocal] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [demo, setDemo] = useState<Row | null>(null);
  const [demoIndice, setDemoIndice] = useState(0);
  // Botão "Lançar → Anotação": abre o formulário de anotação nova assim que a aba aparece.
  useEffect(() => {
    if (!abrirNova) return;
    setEditing(null);
    setOpen(true);
    aoAbrirNova?.();
  }, [abrirNova]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const abrir = (e: Event) => { setEditing(null); setDemoIndice(0); setDemo((e as CustomEvent<Row>).detail); setOpen(true); };
    const fechar = () => { setDemo(null); setOpen(false); };
    window.addEventListener("yui:demo-nota", abrir);
    window.addEventListener("yui:demo-fim", fechar);
    return () => { window.removeEventListener("yui:demo-nota", abrir); window.removeEventListener("yui:demo-fim", fechar); };
  }, []);
  const deferredLocal = useDebouncedValue(local, 300);
  const search = (globalSearch || deferredLocal).trim();

  const refs = useQuery<FormRefs>({
    queryKey: ["form-refs", propertyId],
    queryFn: () => loadFormRefs(propertyId),
    staleTime: 5 * 60_000,
  });

  const paged = usePagedRows({
    table: "anotacoes_producao",
    propertyId,
    cols: NOTE_COLS,
    page,
    pageSize,
    search,
    searchColumns: productionNotes.searchColumns,
  });

  useEffect(() => {
    if (!paged.totalReady) return;
    const last = maxPage({ total: paged.total, pageSize });
    if (page > last) setPage(last);
  }, [paged.total, paged.totalReady, pageSize, page]);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize]);

  const invalidate = () => {
    createPageableTable({ table: "anotacoes_producao", propertyId }).invalidate(qc);
    void qc.invalidateQueries({ queryKey: ["animal-history"] });
    void qc.invalidateQueries({ queryKey: ["form-refs", propertyId] });
    void qc.invalidateQueries({ queryKey: ["dashboard", propertyId] });
  };

  const save = useMutation({
    mutationFn: async (payload: Row) => {
      const body: Row = { ...payload, propriedade_id: propertyId };
      const response = editing
        ? await supabase.from("anotacoes_producao").update(body as Database["public"]["Tables"]["anotacoes_producao"]["Update"]).eq("id", String(editing["id"])).eq("propriedade_id", propertyId)
        : await supabase.from("anotacoes_producao").insert(body as Database["public"]["Tables"]["anotacoes_producao"]["Insert"]);
      if (response.error) throw response.error;
    },
    onSuccess: () => {
      toast.success(`Anotação ${editing ? "atualizada" : "criada"} com sucesso.`);
      setOpen(false);
      setEditing(null);
      invalidate();
    },
    onError: (e) => toast.error(friendlyError(e)),
  });

  const remove = async (row: Row) => {
    if (!confirm("Excluir esta anotação?")) return;
    const { error } = await supabase.from("anotacoes_producao").delete().eq("id", String(row["id"]));
    if (error) toast.error(friendlyError(error));
    else {
      toast.success("Anotação excluída.");
      invalidate();
    }
  };

  const animalName = (id: unknown) => {
    const a = refs.data?.animals.find((x) => x.id === id);
    return a ? a.nome || a.numero_brinco : "";
  };
  const loteName = (id: unknown) => refs.data?.lots.find((x) => x.id === id)?.nome ?? "";

  const summary = pageSummary({ page, pageSize, total: paged.total });
  const last = maxPage({ total: paged.total, pageSize });
  const pages = pageWindow(page, paged.total, pageSize);
  const rows = useMemo(() => paged.rows, [paged.rows]);

  return (
    <div className="space-y-6">
      <PageTitle
        icon={NotebookPen}
        title="Anotações da Produção"
        description="Comportamento, alimentação e observações ligadas à produção."
        action={
          <Button data-tour="notas-nova" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus />Nova anotação
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3 border-y border-border py-4">
        <div className="relative min-w-0 basis-full sm:max-w-lg sm:flex-1 sm:basis-auto">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-11 bg-card pl-10"
            aria-label="Buscar anotações"
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            placeholder="Buscar anotações…"
          />
        </div>
        <span className="flex items-center gap-2 text-xs text-muted-foreground sm:ml-auto">
          <NotebookPen className="size-4 text-primary" />
          {paged.totalReady ? <><strong className="text-foreground">{summary.total.toLocaleString("pt-BR")}</strong> anotações</> : "contando…"}
        </span>
      </div>

      {paged.isPending ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-60 animate-pulse rounded-lg border border-border bg-muted/30" />
          ))}
        </div>
      ) : paged.error ? (
        <div role="alert" className="grid place-items-center gap-4 py-16 text-sm text-muted-foreground">
          <span className="grid size-12 place-items-center rounded-full bg-alerta-fundo text-alerta"><AlertCircle className="size-6" /></span>
          <div className="grid place-items-center gap-1 text-center">
            <span className="text-base font-semibold text-foreground">Não foi possível carregar as anotações</span>
            <span className="max-w-xl text-xs text-alerta">{paged.error.message}</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => paged.refetch()}><RefreshCw />Tentar novamente</Button>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="mb-1 grid size-14 place-items-center rounded-lg border border-primary/20 bg-primary/10 text-primary"><NotebookPen className="size-6" /></span>
          <h2 className="text-lg font-semibold">{search ? "Nenhuma anotação encontrada" : "Suas anotações aparecem aqui"}</h2>
          {!search && <Button variant="outline" onClick={() => { setEditing(null); setOpen(true); }}><Plus />Nova anotação</Button>}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => {
            const animal = animalName(row["animal_id"]);
            const lote = loteName(row["lote_id"]);
            const producao = Number(row["producao"]);
            const quem = [animal, lote].filter(Boolean).join(" · ");
            return (
              <article
                key={String(row["id"])}
                className="group flex min-w-0 flex-col gap-4 rounded-lg border border-border border-t-2 border-t-primary/45 bg-card p-5 shadow-sm transition-colors motion-reduce:transition-none hover:border-primary/40"
              >
                <header className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarDays className="size-3.5" />
                    {formatarDataBR(row["data"])}
                  </span>
                  {producao > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                      <Milk className="size-3.5" />{producao.toLocaleString("pt-BR")} L
                    </span>
                  )}
                </header>

                {quem && <p className="break-words text-sm font-semibold text-primary">{quem}</p>}
                <p className="break-words whitespace-pre-wrap text-sm leading-7">{String(row["observacao"] ?? "")}</p>

                {!!(row["comportamento"] || row["alimentacao"]) && (
                  <div className="grid gap-2 border-l-2 border-border pl-3">
                    {!!row["comportamento"] && (
                      <p className="break-words text-xs leading-relaxed"><span className="mb-0.5 block text-xs font-bold text-chart-4">Comportamento</span>{pretty(row["comportamento"])}</p>
                    )}
                    {!!row["alimentacao"] && (
                      <p className="break-words text-xs leading-relaxed"><span className="mb-0.5 block text-xs font-bold text-chart-2">Alimentação</span>{pretty(row["alimentacao"])}</p>
                    )}
                  </div>
                )}

                {!!row["informacoes_adicionais"] && (
                  <p className="break-words whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                    {String(row["informacoes_adicionais"])}
                  </p>
                )}

                <footer className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3">
                  <span className="text-xs font-bold text-muted-foreground">Anotação da produção</span>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9 text-muted-foreground hover:text-primary"
                      title="Editar anotação"
                      aria-label="Editar anotação"
                      onClick={() => { setEditing(row); setOpen(true); }}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9 text-muted-foreground hover:text-alerta"
                      title="Excluir anotação"
                      aria-label="Excluir anotação"
                      onClick={() => remove(row)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </footer>
              </article>
            );
          })}
        </div>
      )}

      {paged.total > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <span className="text-xs text-muted-foreground">
            Exibindo {summary.de.toLocaleString("pt-BR")}–{summary.ate.toLocaleString("pt-BR")} de{" "}
            <strong className="text-foreground">{summary.total.toLocaleString("pt-BR")}</strong> registros
          </span>
          <div className="ml-auto flex items-center gap-1">
            {paged.total > pageSize && (
              <>
                <Button variant="ghost" size="icon" aria-label="Primeira página" disabled={page <= 1} onClick={() => setPage(1)}><ChevronsLeft /></Button>
                <Button variant="ghost" size="icon" aria-label="Página anterior" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft /></Button>
                {pages.map((p) => (
                  <Button key={p} variant={p === page ? "default" : "ghost"} size="sm" className="min-w-9" onClick={() => setPage(p)}>{p}</Button>
                ))}
                <Button variant="ghost" size="icon" aria-label="Próxima página" disabled={page >= last} onClick={() => setPage(page + 1)}><ChevronRight /></Button>
                <Button variant="ghost" size="icon" aria-label="Última página" disabled={page >= last} onClick={() => setPage(last)}><ChevronsRight /></Button>
              </>
            )}
            <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
              <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
              <SelectContent>{PAGE_SIZES.map((s) => <SelectItem value={String(s)} key={s}>{s} por página</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      )}

      <RecordDialog
        open={open}
        onClose={() => { setOpen(false); setEditing(null); setDemo(null); }}
        config={productionNotes}
        row={editing}
        refs={refs.data}
        onSave={(p) => save.mutate(p)}
        saving={save.isPending}
        propertyId={propertyId}
        demo={demo}
        demoExemplos={EXEMPLOS_NOTA}
        demoExemploAtual={demoIndice}
        onDemoExemplo={(i) => { setDemoIndice(i); setDemo({ producao: "", observacao: "", comportamento: "", alimentacao: "", informacoes_adicionais: "", ...EXEMPLOS_NOTA[i].valores }); }}
      />
    </div>
  );
}
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Milk,
  NotebookPen,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAll";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { maxPage, pageSummary, pageWindow, PAGE_SIZES } from "@/lib/pagination";
import { createPageableTable, useDebouncedValue, usePagedRows } from "./usePagedRows";
import { Empty, PageTitle, friendlyError, pretty, type FormRefs, type Module, type Row } from "./shared";
import { RecordDialog } from "./RecordDialog";

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

export function NotesMural({ propertyId, globalSearch }: { propertyId: string; globalSearch: string }) {
  const qc = useQueryClient();
  const [local, setLocal] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [demo, setDemo] = useState<Row | null>(null);
  const [demoIndice, setDemoIndice] = useState(0);
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
    queryFn: async () => {
      const [animals, lots] = await Promise.all([
        fetchAllRows((a, b) => supabase.from("animais").select("id,nome,numero_brinco,data_nascimento,sexo,situacao").eq("propriedade_id", propertyId).order("numero_brinco").range(a, b)).then((data) => ({ data, error: null })),
        supabase.from("lotes").select("id,nome").eq("propriedade_id", propertyId),
      ]);
      const error = animals.error || lots.error;
      if (error) throw error;
      return { animals: animals.data ?? [], lots: lots.data ?? [], vaccines: [] };
    },
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
    const last = maxPage({ total: paged.total, pageSize });
    if (page > last) setPage(last);
  }, [paged.total, pageSize, page]);

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
        ? await supabase.from("anotacoes_producao").update(body as any).eq("id", String(editing["id"]))
        : await supabase.from("anotacoes_producao").insert(body as any);
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
    <div className="space-y-5">
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

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-56 flex-1 items-center gap-2 sm:max-w-md">
          <Search className="size-4 text-muted-foreground" />
          <Input
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            placeholder="Buscar por observação, comportamento ou alimentação…"
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {summary.total.toLocaleString("pt-BR")} anotações
        </span>
      </div>

      {paged.isPending ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-lg border border-border bg-muted/30" />
          ))}
        </div>
      ) : paged.error ? (
        <div className="grid place-items-center gap-3 py-12 text-sm text-muted-foreground">
          <div className="grid place-items-center gap-1 text-center">
            <span>Erro ao carregar as anotações.</span>
            <span className="max-w-xl text-xs text-destructive">{paged.error.message}</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => paged.refetch()}><RefreshCw />Tentar novamente</Button>
        </div>
      ) : rows.length === 0 ? (
        <Empty message="Nenhuma anotação encontrada. Crie a primeira pelo botão 'Nova anotação'." />
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
                className="group flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-sm transition hover:border-primary/40"
              >
                <header className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarDays className="size-3.5" />
                    {pretty(row["data"])}
                  </span>
                  {producao > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                      <Milk className="size-3.5" />{producao.toLocaleString("pt-BR")} L
                    </span>
                  )}
                </header>

                <p className="whitespace-pre-wrap text-sm leading-relaxed">{String(row["observacao"] ?? "")}</p>

                {!!(row["comportamento"] || row["alimentacao"]) && (
                  <div className="flex flex-wrap gap-1.5">
                    {!!row["comportamento"] && (
                      <span className="rounded-full bg-chart-4/15 px-2 py-0.5 text-[10px] font-semibold text-chart-4">
                        Comportamento: {pretty(row["comportamento"])}
                      </span>
                    )}
                    {!!row["alimentacao"] && (
                      <span className="rounded-full bg-chart-3/15 px-2 py-0.5 text-[10px] font-semibold text-chart-3">
                        Alimentação: {pretty(row["alimentacao"])}
                      </span>
                    )}
                  </div>
                )}

                {!!row["informacoes_adicionais"] && (
                  <p className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
                    {String(row["informacoes_adicionais"])}
                  </p>
                )}

                <footer className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3">
                  <span className="truncate text-xs text-muted-foreground">{quem || "—"}</span>
                  <div className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      aria-label="Editar anotação"
                      onClick={() => { setEditing(row); setOpen(true); }}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-destructive"
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
            <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))} disabled={paged.total <= 25}>
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
        demo={demo}
        demoExemplos={EXEMPLOS_NOTA}
        demoExemploAtual={demoIndice}
        onDemoExemplo={(i) => { setDemoIndice(i); setDemo(EXEMPLOS_NOTA[i].valores); }}
      />
    </div>
  );
}
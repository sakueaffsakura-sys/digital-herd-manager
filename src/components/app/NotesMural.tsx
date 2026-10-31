import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Milk,
  AlertCircle,
  MoreHorizontal,
  NotebookPen,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Star,
  Trash2,
  Tractor,
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { dataLocalISO, formatarDataBR, somarDias } from "@/lib/datas";
import { orInUuids } from "@/lib/busca";
import { plural } from "@/lib/texto";
import { Brinco } from "./Brinco";
import { RecordDialog } from "./RecordDialog";
import { EXEMPLOS_NOTA } from "./yui/tourSteps";

export const productionNotes: Module = {
  title: "Anotações da Produção",
  singular: "anotação",
  table: "anotacoes_producao",
  icon: NotebookPen,
  description: "Comportamento, alimentação e observações ligadas à produção.",
  searchColumns: ["observacao", "comportamento", "alimentacao", "informacoes_adicionais"],
  columns: [
    { key: "data", label: "Data" },
    { key: "animal_id", label: "Animal" },
    { key: "lote_id", label: "Lote" },
    { key: "producao", label: "Produção (L)" },
    { key: "observacao", label: "Observação" },
  ],
  fields: [
    { key: "observacao", label: "O que aconteceu", type: "textarea", required: true, dica: "Ex.: Cio observado, produção caiu, vacina aplicada…" },
    { key: "data", label: "Data", type: "date", required: true },
    { key: "animal_id", label: "Animal", type: "animal", activeOnly: true, dica: "Nenhum animal em especial" },
    { key: "lote_id", label: "Lote", type: "lote", dica: "Nenhum lote em especial" },
    { key: "comportamento", label: "Comportamento", avancado: true },
    { key: "alimentacao", label: "Alimentação", avancado: true },
    { key: "producao", label: "Produção do dia (litros)", type: "number", avancado: true },
    { key: "informacoes_adicionais", label: "Informações adicionais", type: "textarea", avancado: true },
  ],
};

const NOTE_COLS =
  "id,data,animal_id,lote_id,producao,observacao,comportamento,alimentacao,informacoes_adicionais,marcada,created_at";

/** Abas da lista, como no aplicativo. */
const ABAS = [
  { chave: "todas", rotulo: "Todas" },
  { chave: "marcadas", rotulo: "Marcadas" },
  { chave: "animais", rotulo: "De animais" },
  { chave: "gerais", rotulo: "Gerais" },
] as const;
type Aba = (typeof ABAS)[number]["chave"];

const FILTRO_DA_ABA: Record<Aba, { key: string; op: "eq" | "is-null" | "not-null"; value: string | null }[]> = {
  todas: [],
  marcadas: [{ key: "marcada", op: "eq", value: "true" }],
  animais: [{ key: "animal_id", op: "not-null", value: null }],
  gerais: [{ key: "animal_id", op: "is-null", value: null }],
};

const semAcento = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

/** "Hoje", "Ontem" ou a data por extenso — o mesmo que o aplicativo mostra. */
function rotuloDoDia(iso: string, hoje: string) {
  if (iso === hoje) return "Hoje";
  if (iso === somarDias(hoje, -1)) return "Ontem";
  const [a, m, d] = iso.split("-").map(Number);
  if (!a || !m || !d) return formatarDataBR(iso);
  return new Date(Date.UTC(a, m - 1, d)).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}

/** Hora em que a anotação foi escrita (fica no rodapé do cartão). */
function horaDe(valor: unknown) {
  const t = Date.parse(String(valor ?? ""));
  return Number.isFinite(t) ? new Date(t).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";
}

export function NotesMural({ propertyId, globalSearch, abrirNova, aoAbrirNova, abrirAnimal, anotacaoId, aoAbrirAnotacao }: {
  propertyId: string;
  globalSearch: string;
  abrirNova?: boolean;
  aoAbrirNova?: () => void;
  /** Abre a ficha do animal da anotação (menu dos três pontinhos). */
  abrirAnimal?: (id: string) => void;
  /** `?editar=<id>` na barra de endereço: abre essa anotação direto. */
  anotacaoId?: string;
  aoAbrirAnotacao?: () => void;
}) {
  const qc = useQueryClient();
  const [local, setLocal] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [open, setOpen] = useState(false);
  const [aba, setAba] = useState<Aba>("todas");
  const [diasFechados, setDiasFechados] = useState<Set<string>>(new Set());
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
  // Link direto para uma anotação (?editar=<id>), inclusive vinda da busca ou de outro aparelho.
  useEffect(() => {
    if (!anotacaoId) return;
    let vivo = true;
    void (async () => {
      const { data, error } = await supabase.from("anotacoes_producao").select(NOTE_COLS).eq("id", anotacaoId).eq("propriedade_id", propertyId).maybeSingle();
      if (!vivo) return;
      aoAbrirAnotacao?.();
      if (error || !data) { toast.error("Não encontramos essa anotação."); return; }
      setEditing(data as unknown as Row);
      setOpen(true);
    })();
    return () => { vivo = false; };
  }, [anotacaoId, propertyId]); // eslint-disable-line react-hooks/exhaustive-deps

  const deferredLocal = useDebouncedValue(local, 300);
  const search = (globalSearch || deferredLocal).trim();

  const refs = useQuery<FormRefs>({
    queryKey: ["form-refs", propertyId],
    queryFn: () => loadFormRefs(propertyId),
    staleTime: 5 * 60_000,
  });

  // Procurar pelo brinco ou pelo nome do animal também: achamos os animais aqui e
  // mandamos os identificadores junto no mesmo "ou" da consulta.
  const animaisDaBusca = useMemo(() => {
    const t = semAcento(search);
    if (t.length < 2) return [];
    return (refs.data?.animals ?? [])
      .filter((a) => semAcento(`${a.numero_brinco} ${a.nome ?? ""}`).includes(t))
      .map((a) => a.id);
  }, [refs.data, search]);
  const searchExtras = useMemo(() => {
    const cond = orInUuids("animal_id", animaisDaBusca);
    return cond ? [cond] : [];
  }, [animaisDaBusca]);

  const paged = usePagedRows({
    table: "anotacoes_producao",
    propertyId,
    cols: NOTE_COLS,
    page,
    pageSize,
    search,
    searchColumns: productionNotes.searchColumns,
    searchExtras,
    filters: FILTRO_DA_ABA[aba],
    ordem: "data",
  });

  useEffect(() => {
    if (!paged.totalReady) return;
    const last = maxPage({ total: paged.total, pageSize });
    if (page > last) setPage(last);
  }, [paged.total, paged.totalReady, pageSize, page]);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize, aba]);

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

  const marcar = async (row: Row) => {
    const nova = !row["marcada"];
    const { error } = await supabase.from("anotacoes_producao").update({ marcada: nova }).eq("id", String(row["id"])).eq("propriedade_id", propertyId);
    if (error) { toast.error(friendlyError(error)); return; }
    toast.success(nova ? "Anotação marcada como importante." : "Marca retirada.");
    invalidate();
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
  const hoje = dataLocalISO();
  // Agrupa por dia, mantendo a ordem que veio do banco (mais novo primeiro).
  const dias = useMemo(() => {
    const mapa = new Map<string, Row[]>();
    for (const r of rows) {
      const dia = String(r["data"] ?? "");
      const lista = mapa.get(dia);
      if (lista) lista.push(r);
      else mapa.set(dia, [r]);
    }
    return [...mapa.entries()];
  }, [rows]);
  const alternarDia = (dia: string) => setDiasFechados((antes) => {
    const novo = new Set(antes);
    if (novo.has(dia)) novo.delete(dia);
    else novo.add(dia);
    return novo;
  });

  return (
    <div className="space-y-6">
      <PageTitle
        title="Anotações"
        description="O caderno da fazenda: o que aconteceu, com qual animal e em que dia."
        action={
          <Button data-tour="notas-nova" className="h-12" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus />Nova anotação
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-1 basis-64 sm:max-w-md">
          <span className="sr-only">Buscar anotações</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-10"
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            placeholder="Texto, brinco ou nome do animal"
          />
        </label>
        <div role="group" aria-label="Filtrar anotações" className="flex flex-wrap gap-2">
          {ABAS.map((t) => (
            <button
              key={t.chave}
              type="button"
              aria-pressed={aba === t.chave}
              onClick={() => setAba(t.chave)}
              className={`h-11 rounded-full border px-4 text-sm font-bold ${aba === t.chave ? "border-primary bg-sucesso-fundo text-primary" : "border-input text-muted-foreground"}`}
            >
              {t.rotulo}
            </button>
          ))}
        </div>
        <span className="text-sm text-muted-foreground sm:ml-auto">
          {paged.totalReady ? plural(summary.total, "anotação", "anotações") : "contando…"}
        </span>
      </div>

      {paged.isPending ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-52 animate-pulse rounded-2xl border border-border bg-muted/40" />)}
        </div>
      ) : paged.error ? (
        <div role="alert" className="painel grid place-items-center gap-4 p-10 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-alerta-fundo text-alerta"><AlertCircle className="size-6" /></span>
          <div>
            <p className="font-bold">Não foi possível carregar as anotações</p>
            <p className="mt-1 text-sm text-alerta">{paged.error.message}</p>
          </div>
          <Button variant="outline" className="h-12" onClick={() => paged.refetch()}><RefreshCw />Tentar de novo</Button>
        </div>
      ) : rows.length === 0 ? (
        <Empty
          message={
            search ? "Nenhuma anotação com essa busca."
              : aba === "marcadas" ? "Você ainda não marcou nenhuma anotação. Toque na estrela de uma anotação para guardá-la aqui."
              : aba === "animais" ? "Nenhuma anotação ligada a um animal."
              : aba === "gerais" ? "Todas as suas anotações estão ligadas a algum animal."
              : "Ainda não há anotações. Escreva o que aconteceu hoje na fazenda."
          }
          action={!search && aba === "todas" ? { label: "Escrever a primeira anotação", onClick: () => { setEditing(null); setOpen(true); } } : undefined}
        />
      ) : (
        <div className="space-y-6">
          {dias.map(([dia, doDia]) => {
            const fechado = diasFechados.has(dia);
            return (
              <section key={dia}>
                <button
                  type="button"
                  onClick={() => alternarDia(dia)}
                  aria-expanded={!fechado}
                  className="mb-3 flex w-full items-center gap-2 border-b border-border pb-2 text-left"
                >
                  <CalendarDays className="size-5 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1 truncate font-bold first-letter:uppercase">{rotuloDoDia(dia, hoje)}</span>
                  <span className="shrink-0 text-sm text-muted-foreground">{plural(doDia.length, "anotação", "anotações")}</span>
                  <ChevronDown className={`size-5 shrink-0 text-muted-foreground transition-transform ${fechado ? "-rotate-90" : ""}`} />
                </button>
                {!fechado && (
                  <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {doDia.map((row) => {
                      const animal = refs.data?.animals.find((x) => x.id === row["animal_id"]);
                      const lote = loteName(row["lote_id"]);
                      const producao = Number(row["producao"]);
                      const marcada = row["marcada"] === true;
                      const texto = String(row["observacao"] ?? "").trim() || pretty(row["comportamento"]) || pretty(row["alimentacao"]) || String(row["informacoes_adicionais"] ?? "") || "Anotação sem texto";
                      const hora = horaDe(row["created_at"]);
                      return (
                        <li key={String(row["id"])}>
                          <article className={`painel flex h-full min-w-0 flex-col gap-3 p-4 ${marcada ? "marca-ativa relative overflow-hidden" : ""}`}>
                            <header className="flex items-start gap-2">
                              {animal ? (
                                <Brinco valor={animal.numero_brinco} tamanho="pequeno" rotulo={`Anotação do animal ${animal.numero_brinco}`} />
                              ) : (
                                <span className="inline-flex h-11 items-center gap-1.5 rounded-full bg-muted px-3 text-sm font-bold text-muted-foreground">
                                  <Tractor className="size-4" />Geral
                                </span>
                              )}
                              <div className="min-w-0 flex-1 pt-1">
                                <p className="truncate font-bold">{animal ? (animal.nome || animal.numero_brinco) : "Anotação geral"}</p>
                                {lote && <p className="truncate text-sm text-muted-foreground">{lote}</p>}
                              </div>
                              <button
                                type="button"
                                aria-pressed={marcada}
                                aria-label={marcada ? "Tirar a marca desta anotação" : "Marcar esta anotação como importante"}
                                title={marcada ? "Tirar a marca" : "Marcar como importante"}
                                className={`grid size-11 shrink-0 place-items-center rounded-[10px] ${marcada ? "text-brinco" : "text-muted-foreground hover:text-foreground"}`}
                                onClick={() => void marcar(row)}
                              >
                                <Star className={`size-5 ${marcada ? "fill-current" : ""}`} />
                              </button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" aria-label="Mais opções da anotação"><MoreHorizontal /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => { setEditing(row); setOpen(true); }}><Pencil />Abrir e editar</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => void marcar(row)}><Star />{marcada ? "Tirar a marca" : "Marcar como importante"}</DropdownMenuItem>
                                  {animal && abrirAnimal && (
                                    <DropdownMenuItem onClick={() => abrirAnimal(animal.id)}><NotebookPen />Ver a ficha do animal</DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem className="text-alerta" onClick={() => void remove(row)}><Trash2 />Excluir</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </header>

                            <p className="min-w-0 whitespace-pre-wrap break-words leading-relaxed">{texto}</p>

                            {!!(row["comportamento"] || row["alimentacao"]) && (
                              <div className="grid gap-1.5 border-l-2 border-border pl-3 text-sm">
                                {!!row["comportamento"] && <p className="break-words"><span className="font-bold">Comportamento: </span>{pretty(row["comportamento"])}</p>}
                                {!!row["alimentacao"] && <p className="break-words"><span className="font-bold">Alimentação: </span>{pretty(row["alimentacao"])}</p>}
                              </div>
                            )}
                            {!!row["informacoes_adicionais"] && (
                              <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{String(row["informacoes_adicionais"])}</p>
                            )}

                            <footer className="mt-auto flex flex-wrap items-center gap-2 border-t border-border pt-2.5 text-sm text-muted-foreground">
                              <span>{hora || formatarDataBR(row["data"])}</span>
                              {producao > 0 && (
                                <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-sucesso-fundo px-2.5 py-1 font-bold text-primary">
                                  <Milk className="size-4" />{producao.toLocaleString("pt-BR")} L
                                </span>
                              )}
                            </footer>
                          </article>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
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
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, MoreHorizontal, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import { maxPage, PAGE_SIZES, pageSummary, pageWindow } from "@/lib/pagination";
import { Empty, type IconType, type Row } from "./shared";

export const ROW_HEIGHT = 56;
const OVERSCAN = 8;

export type VirtualColumns = { key: string; label: string }[];
export type AcaoLinha = { rotulo: string; icone?: IconType; aoClicar: () => void; perigo?: boolean };

export type VirtualTableProps = {
  columns: VirtualColumns;
  rows: Row[];
  page: number;
  pageSize: number;
  total: number;
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
  render: (row: Row, col: VirtualColumns[number], index: number) => ReactNode;
  /** Ações de cada linha (menu "…"). A primeira também abre ao tocar na linha no celular. */
  actions?: (row: Row) => AcaoLinha[];
  emptyMessage: string;
  emptyAction?: { label: string; onClick: () => void };
  /** Nome curto da linha para leitores de tela (ex.: "animal 1040"). */
  rowLabel?: (row: Row) => string;
};

function MenuAcoes({ acoes, rotulo }: { acoes: AcaoLinha[]; rotulo: string }) {
  if (!acoes.length) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="grid size-11 place-items-center rounded-[10px] text-muted-foreground hover:bg-accent hover:text-foreground" aria-label={`Ações: ${rotulo}`}>
        <MoreHorizontal className="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48 rounded-xl p-1.5">
        {acoes.map((a) => {
          const Icone = a.icone;
          return (
            <DropdownMenuItem key={a.rotulo} onSelect={a.aoClicar} className={`min-h-11 gap-2 text-[15px] ${a.perigo ? "text-alerta focus:text-alerta" : ""}`}>
              {Icone && <Icone className="size-4" />}
              {a.rotulo}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Lista de registros. No computador: tabela com cabeçalho fixo e janelamento (só as linhas
 * visíveis são desenhadas). No celular: linhas empilhadas, nome forte em cima e detalhes embaixo.
 * A paginação e a contagem são feitas no servidor (usePagedRows).
 */
export function VirtualTable({
  columns, rows, page, pageSize, total, loading, error, onRetry, onPage, onPageSize, render, actions, emptyMessage, emptyAction, rowLabel,
}: VirtualTableProps) {
  const celular = useIsMobile();
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewH, setViewH] = useState(480);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onResize = () => {
      if (el.clientHeight > 0) setViewH(el.clientHeight);
      setScrollTop(el.scrollTop);
    };
    const onScroll = () => setScrollTop(el.scrollTop);
    onResize();
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(onResize);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, [celular]);

  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const end = Math.min(rows.length, start + Math.ceil(viewH / ROW_HEIGHT) + OVERSCAN * 2);
  const visible = rows.slice(start, end);
  const totalHeight = rows.length * ROW_HEIGHT;
  const summary = pageSummary({ page, pageSize, total });
  const last = maxPage({ total, pageSize });
  const janela = pageWindow(page, total, pageSize);
  const gridColumns = `repeat(${columns.length}, minmax(0, 1fr))${actions ? " 64px" : ""}`;
  const rotulo = (row: Row, i: number) => rowLabel?.(row) ?? `registro ${i + 1}`;

  let corpo: ReactNode;
  if (loading) {
    corpo = (
      <div aria-busy="true" aria-label="Carregando registros">
        {Array.from({ length: Math.min(pageSize, 8) }, (_, i) => (
          <div key={i} className="flex h-14 animate-pulse items-center border-b border-border px-4">
            <div className="h-3 w-2/3 rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  } else if (error) {
    corpo = (
      <div role="alert" className="grid place-items-center gap-3 px-4 py-12 text-center">
        <p className="font-bold">Os registros não abriram.</p>
        <p className="max-w-xl text-sm text-muted-foreground">Confira a internet e tente de novo. Detalhe: {error.message}</p>
        <Button variant="outline" className="h-11" onClick={onRetry}><RefreshCw />Tentar de novo</Button>
      </div>
    );
  } else if (rows.length === 0) {
    corpo = <Empty message={emptyMessage} action={emptyAction} />;
  } else if (celular) {
    corpo = (
      <ul className="divide-y divide-border">
        {rows.map((row, i) => {
          const acoes = actions?.(row) ?? [];
          // Brinco à esquerda (quando a lista tem brinco), nome forte em cima e o resto embaixo.
          const lider = columns[0]?.key === "numero_brinco" ? columns[0] : null;
          const [titulo, ...detalhes] = lider ? columns.slice(1) : columns;
          return (
            <li key={String(row["id"] ?? i)} className="flex items-center gap-2 py-1 pl-3 pr-1">
              <button type="button" disabled={!acoes[0]} onClick={() => acoes[0]?.aoClicar()} className="flex min-w-0 flex-1 items-center gap-3 py-2.5 text-left">
                {lider && <span className="shrink-0">{render(row, lider, i)}</span>}
                <span className="min-w-0">
                  <span className="block truncate font-bold">{titulo ? render(row, titulo, i) : null}</span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">
                    {detalhes.map((c) => (
                      <span key={c.key} className="mr-3 inline-block">
                        <span className="sr-only">{c.label}: </span>
                        {render(row, c, i)}
                      </span>
                    ))}
                  </span>
                </span>
              </button>
              <MenuAcoes acoes={acoes} rotulo={rotulo(row, i)} />
            </li>
          );
        })}
      </ul>
    );
  } else {
    corpo = (
      <div className="relative" style={{ height: totalHeight }}>
        <div style={{ position: "absolute", top: start * ROW_HEIGHT, left: 0, right: 0 }}>
          {visible.map((row, i) => {
            const realIndex = start + i;
            return (
              <div
                key={String(row["id"] ?? realIndex)}
                role="row"
                className="grid items-center border-b border-border last:border-0 hover:bg-muted/60"
                style={{ gridTemplateColumns: gridColumns, height: ROW_HEIGHT }}
              >
                {columns.map((c) => (
                  <div role="cell" className="min-w-0 truncate px-4" key={c.key}>{render(row, c, realIndex)}</div>
                ))}
                {actions && (
                  <div role="cell" className="flex justify-end pr-2">
                    <MenuAcoes acoes={actions(row)} rotulo={rotulo(row, realIndex)} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="painel overflow-hidden">
      {celular ? (
        corpo
      ) : (
        <div ref={containerRef} className="max-h-[68vh] overflow-auto" role="table" aria-rowcount={total}>
          <div style={{ minWidth: Math.max(560, columns.length * 150) }}>
            <div role="row" className="sticky top-0 z-10 grid border-b border-border bg-card text-sm font-bold text-muted-foreground" style={{ gridTemplateColumns: gridColumns }}>
              {columns.map((c) => (
                <div role="columnheader" className="px-4 py-3" key={c.key}>{c.label}</div>
              ))}
              {actions && <div role="columnheader" className="px-2 py-3"><span className="sr-only">Ações</span></div>}
            </div>
            {corpo}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3">
        <span className="text-sm text-muted-foreground">
          {summary.total ? (
            <>
              {summary.de.toLocaleString("pt-BR")}–{summary.ate.toLocaleString("pt-BR")} de <strong className="text-foreground">{summary.total.toLocaleString("pt-BR")}</strong>
            </>
          ) : (
            "Nenhum registro"
          )}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-1">
          {total > pageSize && (
            <>
              <Button variant="ghost" size="icon" className="size-11" aria-label="Primeira página" disabled={page <= 1} onClick={() => onPage(1)}><ChevronsLeft /></Button>
              <Button variant="ghost" size="icon" className="size-11" aria-label="Página anterior" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft /></Button>
              {janela.map((p) => (
                <Button key={p} variant={p === page ? "default" : "ghost"} className="hidden size-11 sm:inline-flex" aria-current={p === page ? "page" : undefined} onClick={() => onPage(p)}>{p}</Button>
              ))}
              <span className="px-2 text-sm sm:hidden">Página {page} de {last}</span>
              <Button variant="ghost" size="icon" className="size-11" aria-label="Próxima página" disabled={page >= last} onClick={() => onPage(page + 1)}><ChevronRight /></Button>
              <Button variant="ghost" size="icon" className="size-11" aria-label="Última página" disabled={page >= last} onClick={() => onPage(last)}><ChevronsRight /></Button>
            </>
          )}
          <Select value={String(pageSize)} onValueChange={(v) => onPageSize(Number(v))}>
            <SelectTrigger className="h-11 w-36" aria-label="Registros por página"><SelectValue /></SelectTrigger>
            <SelectContent>{PAGE_SIZES.map((s) => <SelectItem value={String(s)} key={s}>{s} por página</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

export const rowHeightStyle = (height = ROW_HEIGHT): CSSProperties => ({ height });

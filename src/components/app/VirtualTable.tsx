import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { maxPage, PAGE_SIZES, pageSummary, pageWindow } from "@/lib/pagination";
import { Empty, type Row } from "./shared";

export const ROW_HEIGHT = 56;
const OVERSCAN = 8;

export type VirtualColumns = { key: string; label: string }[];

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
  actions?: (row: Row) => ReactNode;
  emptyMessage: string;
};

/**
 * Tabela com janelamento no cliente (virtualização): apenas as linhas visíveis
 * são renderizadas. A paginação/count são feitos no servidor (usePagedRows).
 */
export function VirtualTable({
  columns,
  rows,
  page,
  pageSize,
  total,
  loading,
  error,
  onRetry,
  onPage,
  onPageSize,
  render,
  actions,
  emptyMessage,
}: VirtualTableProps) {
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
  }, []);

  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const end = Math.min(rows.length, start + Math.ceil(viewH / ROW_HEIGHT) + OVERSCAN * 2);
  const visible = rows.slice(start, end);
  const totalHeight = rows.length * ROW_HEIGHT;
  const summary = pageSummary({ page, pageSize, total });
  const last = maxPage({ total, pageSize });
  const window = pageWindow(page, total, pageSize);
  const gridColumns = `[auto] repeat(${columns.length}, minmax(0, 1fr))${actions ? " 150px" : ""}`;

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div ref={containerRef} className="max-h-[68vh] overflow-auto">
        <div className="grid gap-px bg-border" style={{ gridTemplateColumns: gridColumns, minWidth: 700 }}>
          <div className="sticky top-0 z-10 col-span-full grid bg-muted/35 text-xs font-semibold uppercase text-muted-foreground" style={{ gridTemplateColumns: gridColumns }}>
            <div className="px-3 py-2" />
            {columns.map((c) => (
              <div className="px-5 py-3" key={c.key}>{c.label}</div>
            ))}
            {actions && <div className="px-5 py-3 text-right">Ações</div>}
          </div>

          {loading ? (
            <div className="col-span-full grid bg-card" style={{ gridTemplateColumns: gridColumns }}>
              {Array.from({ length: Math.min(pageSize, 12) }, (_, i) => (
                <div className="grid animate-pulse" style={{ gridTemplateColumns: gridColumns }} key={i}>
                  <div className="col-span-full row-start-1 grid h-14 items-center border-b border-border/70 px-5">
                    <div className="h-3 w-2/3 rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="col-span-full grid place-items-center gap-3 bg-card py-12 text-sm text-muted-foreground">
              <div className="grid gap-1 place-items-center text-center">
                <span>Erro ao carregar os registros.</span>
                <span className="max-w-xl text-xs text-destructive">{error.message}</span>
              </div>
              <Button variant="outline" size="sm" onClick={onRetry}><RefreshCw />Tentar novamente</Button>
            </div>
          ) : rows.length === 0 ? (
            <div className="col-span-full bg-card"><Empty message={emptyMessage} /></div>
          ) : (
            <div className="col-span-full grid bg-card" style={{ height: totalHeight, position: "relative" }}>
              <div style={{ position: "absolute", top: start * ROW_HEIGHT, left: 0, right: 0 }} className="grid" >
                {visible.map((row, i) => {
                  const realIndex = start + i;
                  return (
                    <div
                      key={String(row["id"] ?? realIndex)}
                      className="grid items-center border-b border-border/70 bg-card last:border-0 hover:bg-muted/25"
                      style={{ gridTemplateColumns: gridColumns, height: ROW_HEIGHT }}
                    >
                      <div className="w-3" />
                      {columns.map((c) => (
                        <div className="min-w-0 truncate px-5" key={c.key}>{render(row, c, realIndex)}</div>
                      ))}
                      {actions && <div className="flex justify-end gap-1 px-3">{actions(row)}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3">
        <span className="text-xs text-muted-foreground">
          Exibindo {summary.de.toLocaleString("pt-BR")}–{summary.ate.toLocaleString("pt-BR")} de{" "}
          <strong className="text-foreground">{summary.total.toLocaleString("pt-BR")}</strong> registros
        </span>
        <div className="ml-auto flex items-center gap-1">
          {total > pageSize && (
            <>
              <Button variant="ghost" size="icon" aria-label="Primeira página" disabled={page <= 1} onClick={() => onPage(1)}><ChevronsLeft /></Button>
              <Button variant="ghost" size="icon" aria-label="Página anterior" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft /></Button>
              {window.map((p) => (
                <Button key={p} variant={p === page ? "default" : "ghost"} size="sm" className="min-w-9" onClick={() => onPage(p)}>{p}</Button>
              ))}
              <Button variant="ghost" size="icon" aria-label="Próxima página" disabled={page >= last} onClick={() => onPage(page + 1)}><ChevronRight /></Button>
              <Button variant="ghost" size="icon" aria-label="Última página" disabled={page >= last} onClick={() => onPage(last)}><ChevronsRight /></Button>
            </>
          )}
          <Select value={String(pageSize)} onValueChange={(v) => onPageSize(Number(v))} disabled={total <= 25}>
            <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
            <SelectContent>{PAGE_SIZES.map((s) => <SelectItem value={String(s)} key={s}>{s} por página</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

export const rowHeightStyle = (height = ROW_HEIGHT): CSSProperties => ({ height });
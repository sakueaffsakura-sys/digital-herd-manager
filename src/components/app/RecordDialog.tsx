import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { CalendarDays, FileText, LoaderCircle, NotebookPen, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { dateNow, type Field, type FormRefs, type Module, type Row } from "./shared";
import { ensureRecordReferences, recordReferenceRows, vaccinationTarget } from "@/lib/recordInput";

export function RecordDialog({
  open,
  onClose,
  config,
  row,
  refs,
  onSave,
  saving,
  propertyId,
  demo,
  /** Exemplos que a Yui oferece durante a demonstração; escolher um preenche o formulário de novo. */
  demoExemplos,
  demoExemploAtual,
  onDemoExemplo,
}: {
  open: boolean;
  onClose: () => void;
  config: Module;
  row: Row | null;
  refs: FormRefs | undefined;
  onSave: (r: Row) => void;
  saving: boolean;
  propertyId: string;
  /** Valores digitados automaticamente pela Yui; nunca são salvos. */
  demo?: Row | null;
  demoExemplos?: { rotulo: string; valores: Record<string, string> }[];
  demoExemploAtual?: number;
  onDemoExemplo?: (i: number) => void;
}) {
  const initial = () =>
    Object.fromEntries(
      config.fields.map((f) => [
        f.key,
        row?.[f.key] ?? (f.type === "date" ? dateNow() : f.key === "situacao" ? f.options?.[0]?.value : ""),
      ]),
    );
  const [form, setForm] = useState<Row>(initial);
  const [writtenRefs, setWrittenRefs] = useState<Record<string, string>>({});
  const [resolving, setResolving] = useState(false);
  const submitLock = useRef(false);
  const queryClient = useQueryClient();
  const isNote = config.table === "anotacoes_producao";
  useEffect(() => { setWrittenRefs({}); }, [row, open, config]);
  const referenceRows = (f: Field) => recordReferenceRows(f, refs, row?.[f.key]);
  const referenceText = (f: Field) => {
    if (writtenRefs[f.key] !== undefined) return writtenRefs[f.key];
    const id = form[f.key];
    const found = referenceRows(f).find((r) => r.id === id);
    if (!found) return id ? String(id) : "";
    return "numero_brinco" in found ? String(found.numero_brinco) : found.nome ?? "";
  };
  useEffect(() => { if (!demo) setForm(initial()); }, [row, open, demo, config]);
  // Demonstração da Yui: digita campo a campo, como uma pessoa faria.
  // A cada passo reescreve o formulário inteiro de forma cumulativa, para que
  // nenhum campo preenchido seja perdido por atualizações fora de ordem.
  useEffect(() => {
    if (!open || !demo) return;
    setForm({ ...initial(), producao: "", observacao: "", comportamento: "", alimentacao: "", informacoes_adicionais: "" });
    const fila = Object.entries(demo).map(([k, v]) => [k, String(v)] as const);
    const total = fila.reduce((acc, [, v]) => acc + v.length, 0);
    let pos = 0;
    const timer = window.setInterval(() => {
      pos = Math.min(pos + 2, total);
      let resto = pos;
      const parcial: Row = {};
      for (const [k, v] of fila) {
        const n = Math.max(0, Math.min(resto, v.length));
        parcial[k] = v.slice(0, n);
        resto -= n;
      }
      setForm((f) => ({ ...f, ...parcial }));
      if (pos >= total) window.clearInterval(timer);
    }, 45);
    return () => window.clearInterval(timer);
  }, [open, demo, config]);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitLock.current || saving) return;
    if (demo) { toast.info("Isto é só uma demonstração da Yui — nada foi salvo."); onClose(); return; }
    submitLock.current = true;
    setResolving(true);
    let result: Awaited<ReturnType<typeof ensureRecordReferences>>;
    try {
      result = await ensureRecordReferences(config.fields, form, writtenRefs, refs, row, propertyId);
    } catch {
      toast.error("Não foi possível conferir os cadastros. Tente salvar novamente.");
      return;
    } finally {
      setResolving(false);
      submitLock.current = false;
      void queryClient.invalidateQueries({ queryKey: ["form-refs", propertyId] });
    }
    if (result.error) { toast.error(result.error); return; }
    if (result.created.length) {
      toast.success(`Cadastro criado automaticamente: ${result.created.join(", ")}.`);
      void queryClient.invalidateQueries({ queryKey: ["form-refs", propertyId] });
    }
    const resolved = config.table === "vacinacoes" ? vaccinationTarget(result.values) : result.values;
    const missing = config.fields.find(
      (f) => f.required && (resolved[f.key] === undefined || resolved[f.key] === null || String(resolved[f.key]).trim() === ""),
    );
    if (missing) {
      toast.error(`Preencha o campo ${missing.label}.`);
      return;
    }
    if (config.table === "vacinacoes" && !resolved["animal_id"] && !resolved["lote_id"]) {
      toast.error("Informe o brinco ou nome de um animal, ou o nome de um lote.");
      return;
    }
    if (config.table === "inseminacoes" && String(form["previsao_parto"]) <= String(form["data_inseminacao"])) {
      toast.error("A previsão de parto deve ser posterior à data da inseminação.");
      return;
    }
    if (config.table === "nascimentos" && resolved["vaca_id"] === resolved["bezerro_id"]) {
      toast.error("A vaca e o bezerro devem ser animais diferentes.");
      return;
    }
    const invalidNumber = config.fields.find((f) => f.type === "number" && f.required && Number(form[f.key]) <= 0);
    if (invalidNumber) {
      toast.error(`${invalidNumber.label} deve ser maior que zero.`);
      return;
    }
    const cleaned = Object.fromEntries(
      Object.entries(resolved).map(([k, v]) => [
        k,
        v === "" || v === "none" ? null : config.fields.find((f) => f.key === k)?.type === "number" ? Number(v) : v,
      ]),
    );
    onSave(cleaned);
  };
  return (
    <Dialog open={open} modal={!demo} onOpenChange={(v) => !v && onClose()}>
      <DialogContent data-tour={demo ? "demo-dialog" : undefined} className={`max-h-[90vh] overflow-y-auto sm:max-w-2xl ${isNote ? "w-[calc(100%-2rem)] gap-0 rounded-lg p-0" : ""} ${demo ? "z-[80]" : ""}`}>
        <DialogHeader className={isNote ? "border-b border-border px-5 py-5 pr-12 text-left sm:px-6" : ""}>
          {isNote && <div className="mb-2 flex items-center gap-2 text-xs font-bold text-primary"><NotebookPen className="size-4" />Produção · Anotações</div>}
          <DialogTitle className={isNote ? "text-2xl leading-tight" : ""}>{isNote ? row ? "Editar anotação" : "Nova anotação" : `${row ? "Editar" : "Novo"} ${config.singular}`}</DialogTitle>
          <DialogDescription>{demo ? "Demonstração da Yui: os campos estão sendo preenchidos sozinhos e nada será salvo." : "Os dados serão gravados na propriedade selecionada."}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className={isNote ? "px-5 pt-5 sm:px-6" : ""}>
          <div className={`grid gap-4 sm:grid-cols-2 ${isNote ? "gap-y-5" : ""}`}>
            {isNote && <div className="flex items-center gap-2 border-b border-border pb-2 text-sm font-semibold sm:col-span-2"><CalendarDays className="size-4 text-chart-2" />Registro da produção</div>}
            {config.fields.map((f) => (
              <div key={f.key} className={`${f.type === "textarea" ? "sm:col-span-2" : ""} ${isNote ? "min-w-0 space-y-2" : ""}`}>
                {isNote && f.key === "observacao" && <div className="mb-4 mt-1 flex items-center gap-2 border-b border-border pb-2 text-sm font-semibold"><FileText className="size-4 text-chart-4" />Observações do dia</div>}
                <Label htmlFor={`record-${f.key}`} className={isNote ? "text-xs font-medium text-muted-foreground" : ""}>{f.label}{isNote && f.required && <span className="ml-1 text-primary" aria-hidden="true">*</span>}</Label>
                {f.type === "textarea" ? (
                  <Textarea id={`record-${f.key}`} className={isNote ? `resize-y bg-background/50 leading-relaxed ${f.key === "observacao" ? "min-h-32" : "min-h-20"}` : undefined} required={f.required} value={String(form[f.key] ?? "")} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                ) : f.type === "animal" || f.type === "lote" || f.type === "vacina" ? (
                  <Input id={`record-${f.key}`} className={isNote ? "h-11 bg-background/50" : undefined} required={f.required} type="text" value={referenceText(f)} placeholder={f.type === "animal" ? "Digite o brinco ou nome do animal" : f.type === "vacina" ? "Digite o nome da vacina" : "Digite o nome do lote"} onChange={(e) => setWrittenRefs((previous) => ({ ...previous, [f.key]: e.target.value }))} />
                ) : f.type === "select" ? (
                  <Input id={`record-${f.key}`} required={f.required} type="text" value={f.options?.find((option) => option.value === form[f.key])?.label ?? String(form[f.key] ?? "")} placeholder={f.options?.map((option) => option.label).join(" / ")} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                ) : (
                  <Input
                    id={`record-${f.key}`}
                    className={isNote ? "h-11 bg-background/50" : undefined}
                    required={f.required}
                    type={f.type ?? "text"}
                    step={f.type === "number" ? "0.01" : undefined}
                    value={String(form[f.key] ?? "")}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  />
                )}
              </div>
            ))}
          </div>
          {demo && demoExemplos && onDemoExemplo && (
            <div className="mt-4 rounded-lg border border-primary/30 bg-background/60 p-2.5">
              <p className="mb-1.5 text-xs font-semibold text-primary">Escolha outro exemplo — a Yui preenche para você ver:</p>
              <div className="flex flex-wrap gap-1.5">
                {demoExemplos.map((ex, i) => (
                  <Button key={ex.rotulo} type="button" size="sm" variant={i === demoExemploAtual ? "default" : "outline"} className="h-7 px-2.5 text-xs" onClick={() => onDemoExemplo(i)}>{ex.rotulo}</Button>
                ))}
              </div>
            </div>
          )}
          <DialogFooter className={isNote ? "sticky bottom-0 -mx-5 mt-6 gap-2 border-t border-border bg-card px-5 py-4 sm:-mx-6 sm:px-6" : "mt-6"}>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving || resolving}>{isNote && (saving || resolving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />)}{resolving ? "Conferindo cadastros…" : saving ? "Salvando…" : demo ? "Salvar (demonstração)" : isNote ? "Salvar anotação" : "Salvar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
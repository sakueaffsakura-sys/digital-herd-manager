import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { dateNow, type Field, type FormRefs, type Module, type Row } from "./shared";
import { recordReferenceRows, resolveRecordInputs } from "@/lib/recordInput";

export function RecordDialog({
  open,
  onClose,
  config,
  row,
  refs,
  onSave,
  saving,
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
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (demo) { toast.info("Isto é só uma demonstração da Yui — nada foi salvo."); onClose(); return; }
    const result = resolveRecordInputs(config.fields, form, writtenRefs, refs, row);
    if (result.error) { toast.error(result.error); return; }
    const resolved = result.values;
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
      <DialogContent data-tour={demo ? "demo-dialog" : undefined} className={`dark max-h-[90vh] overflow-y-auto border-border bg-card sm:max-w-2xl ${demo ? "z-[80]" : ""}`}>
        <DialogHeader>
          <DialogTitle>{row ? "Editar" : "Novo"} {config.singular}</DialogTitle>
          <DialogDescription>{demo ? "Demonstração da Yui: os campos estão sendo preenchidos sozinhos e nada será salvo." : "Os dados serão gravados na propriedade selecionada."}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            {config.fields.map((f) => (
              <div key={f.key} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
                <Label htmlFor={`record-${f.key}`}>{f.label}</Label>
                {f.type === "textarea" ? (
                  <Textarea id={`record-${f.key}`} required={f.required} value={String(form[f.key] ?? "")} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                ) : f.type === "animal" || f.type === "lote" || f.type === "vacina" ? (
                  <Input id={`record-${f.key}`} required={f.required} type="text" value={referenceText(f)} placeholder={f.type === "animal" ? "Digite o brinco ou nome do animal" : f.type === "vacina" ? "Digite o nome da vacina" : "Digite o nome do lote"} onChange={(e) => setWrittenRefs((previous) => ({ ...previous, [f.key]: e.target.value }))} />
                ) : f.type === "select" ? (
                  <Input id={`record-${f.key}`} required={f.required} type="text" value={f.options?.find((option) => option.value === form[f.key])?.label ?? String(form[f.key] ?? "")} placeholder={f.options?.map((option) => option.label).join(" / ")} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                ) : (
                  <Input
                    id={`record-${f.key}`}
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
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Salvando…" : demo ? "Salvar (demonstração)" : "Salvar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
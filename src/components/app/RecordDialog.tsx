import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { dateNow, type Field, type FormRefs, type Module, type Row } from "./shared";

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
  const options = (f: Field) =>
    f.type === "animal"
      ? refs?.animals
          .filter((a) => (!f.sex || a.sexo === f.sex) && (!f.activeOnly || a.situacao === "ativo" || a.id === form[f.key]))
          .map((a) => ({ value: a.id, label: a.nome ? `${a.nome} · ${a.numero_brinco}` : a.numero_brinco }))
      : f.type === "lote"
        ? refs?.lots.map((x) => ({ value: x.id, label: x.nome }))
        : f.type === "vacina"
          ? refs?.vaccines.map((x) => ({ value: x.id, label: x.nome }))
          : f.options;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (demo) { toast.info("Isto é só uma demonstração da Yui — nada foi salvo."); onClose(); return; }
    const missing = config.fields.find(
      (f) => f.required && (form[f.key] === undefined || form[f.key] === null || String(form[f.key]).trim() === ""),
    );
    if (missing) {
      toast.error(`Preencha o campo ${missing.label}.`);
      return;
    }
    if (config.table === "vacinacoes" && !form["animal_id"] && !form["lote_id"]) {
      toast.error("Selecione um animal ou um lote.");
      return;
    }
    if (config.table === "inseminacoes" && String(form["previsao_parto"]) <= String(form["data_inseminacao"])) {
      toast.error("A previsão de parto deve ser posterior à data da inseminação.");
      return;
    }
    if (config.table === "nascimentos" && form["vaca_id"] === form["bezerro_id"]) {
      toast.error("A vaca e o bezerro devem ser animais diferentes.");
      return;
    }
    const invalidNumber = config.fields.find((f) => f.type === "number" && f.required && Number(form[f.key]) <= 0);
    if (invalidNumber) {
      toast.error(`${invalidNumber.label} deve ser maior que zero.`);
      return;
    }
    const cleaned = Object.fromEntries(
      Object.entries(form).map(([k, v]) => [
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
                <Label>{f.label}</Label>
                {f.type === "textarea" ? (
                  <Textarea value={String(form[f.key] ?? "")} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                ) : f.type === "select" || f.type === "animal" || f.type === "lote" || f.type === "vacina" ? (
                  <Select value={String(form[f.key] ?? "")} onValueChange={(v) => setForm({ ...form, [f.key]: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      {!f.required && <SelectItem value="none">Não informado</SelectItem>}
                      {options(f)?.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
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
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { CheckCircle2, FileSpreadsheet, Loader2, Upload, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { chunk, detectAndParse, fnv1a, splitInHalf, type ParsedImport } from "@/lib/importParser";
import { naturalKeyForTable, normalizeAndValidate, type ImportField } from "@/lib/validate";
import { friendlyError, type Module, type Row } from "./shared";

type Reason = { linha: number; motivo: string };

type State =
  | { step: "upload" }
  | { step: "preview"; data: ParsedImport; fields: ImportField[]; valid: Row[]; reasons: Reason[]; fieldsTouched: number }
  | { step: "running"; data: ParsedImport; fields: ImportField[]; progress: number; total: number; aceitas: number; rejeitadas: number }
  | { step: "done"; aceitas: number; rejeitadas: number; reasons: Reason[]; duplicated: number };

const MAX_DETAIL = 500;

const toImportFields = (config: Module): ImportField[] =>
  config.fields.map((f) => ({
    key: f.key,
    label: f.label,
    required: f.required,
    type: f.type === "number" ? "number" : f.type === "date" ? "date" : f.type === "select" ? "select" : "text",
    options: f.options,
  }));

export default function ImportDialog({
  open,
  onClose,
  config,
  propertyId,
  refs,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  config: Module;
  propertyId: string;
  refs?: { animals: { id: string; nome: string | null; numero_brinco: string; situacao: string }[]; lots: { id: string; nome: string }[]; vaccines: { id: string; nome: string }[] };
  onImported: (quantidade: number) => void;
}) {
  const [state, setState] = useState<State>({ step: "upload" });
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const doneId = useRef(0);

  useEffect(() => {
    if (open) {
      setState({ step: "upload" });
      setFile(null);
      resume.current = null;
      doneId.current += 1;
    }
  }, [open]);

  const fields = useMemo(() => toImportFields(config), [config]);
  const resume = useRef<{ processadas: number; reasons: Reason[] } | null>(null);

  const applyRefMapping = (rows: Row[]): { rows: Row[]; reasons: Reason[] } => {
    const reasons: Reason[] = [];
    const lookupAnimals = new Map<string, string>();
    refs?.animals.forEach((a) => {
      if (a.numero_brinco) lookupAnimals.set(a.numero_brinco.toLowerCase(), a.id);
      if (a.nome) lookupAnimals.set(a.nome.toLowerCase(), a.id);
    });
    const lookupLots = new Map<string, string>();
    refs?.lots.forEach((l) => lookupLots.set(l.nome.toLowerCase(), l.id));
    const lookupVaccines = new Map<string, string>();
    refs?.vaccines.forEach((v) => lookupVaccines.set(v.nome.toLowerCase(), v.id));

    const mapped = rows.map((row) => {
      const next = { ...row };
      for (const f of config.fields) {
        const value = String(row[f.key] ?? "").trim();
        if (!value) continue;
        if (f.type === "animal") {
          const id = lookupAnimals.get(value.toLowerCase());
          if (id) next[f.key] = id;
          else reasons.push({ linha: Number(row["__linha"] ?? 0), motivo: `Animal "${value}" não encontrado na propriedade.` });
        } else if (f.type === "lote") {
          const id = lookupLots.get(value.toLowerCase());
          if (id) next[f.key] = id;
          else reasons.push({ linha: Number(row["__linha"] ?? 0), motivo: `Lote "${value}" não encontrado.` });
        } else if (f.type === "vacina") {
          const id = lookupVaccines.get(value.toLowerCase());
          if (id) next[f.key] = id;
          else reasons.push({ linha: Number(row["__linha"] ?? 0), motivo: `Tipo de vacina "${value}" não encontrado.` });
        }
      }
      return next;
    });
    return { rows: mapped, reasons };
  };

  const start = async () => {
    let current = state;
    if (current.step !== "preview") return;
    const data = current.data;

    const seen = new Set<string>();
    const reasons: Reason[] = [...current.reasons];
    const rejectedLines = new Set(reasons.map((r) => r.linha));
    let aceitas = 0;
    const startAt = resume.current?.processadas ?? 0;
    resume.current?.reasons.forEach((r) => {
      rejectedLines.add(r.linha);
      reasons.push(r);
    });

    setState({ step: "running", data, fields: current.fields, progress: startAt, total: data.rows.length, aceitas: 0, rejeitadas: rejectedLines.size });

    const saveProgress = async (processadas: number, status: "em_andamento" | "erro" | "concluida" = "em_andamento", erro?: string) => {
      const payload = {
        propriedade_id: propertyId,
        tabela: config.table,
        arquivo: file?.name ?? `import_${config.table}`,
        total_linhas: data.rows.length,
        processadas,
        aceitas,
        rejeitadas: reasons.length,
        rejeitadas_detalhe: reasons.slice(0, MAX_DETAIL),
        status: status,
        erro: erro ?? null,
      };
      await supabase.from("importacoes").upsert(payload, { onConflict: "propriedade_id,tabela,arquivo" });
    };

    const insertChunk = async (rows: Row[]): Promise<void> => {
      const payload = rows.map((r) => {
        const { __linha: _line, ...rest } = r as Row & { __linha?: unknown };
        return rest;
      });
      const { data: inserted, error } = await (supabase.from(config.table as any) as any).insert(payload).select("id");
      if (!error) {
        aceitas += inserted?.length ?? rows.length;
        for (const row of rows) seen.add(naturalKeyForTable(config.table, row));
        return;
      }
      if (error.code !== "23505" || rows.length <= 1) {
        for (const row of rows) {
          reasons.push({ linha: Number(row["__linha"] ?? 0), motivo: error.code === "23505" ? "Registro duplicado (já existe no banco)." : friendlyError(error) });
        }
        return;
      }
      const [a, b] = splitInHalf<Row>(rows);
      await insertChunk(a);
      await insertChunk(b);
    };

    try {
      if (startAt === 0) await saveProgress(0);
      const byLinha = new Map<number, Row>(current.valid.map((r) => [Number(r["__linha"]), r]));
      let innerReasons = reasons.length;
      for (let i = 0; i < data.rows.length; i += 50) {
        if (i < startAt) continue;
        const slice = data.rows
          .slice(i, i + 50)
          .map((_raw, k) => byLinha.get(i + k + 2))
          .filter((r): r is Row => Boolean(r));
        for (const row of slice) {
          const key = naturalKeyForTable(config.table, row);
          if (seen.has(key)) {
            reasons.push({ linha: Number(row["__linha"] ?? 0), motivo: "Registro duplicado dentro do próprio arquivo." });
            rejectedLines.add(Number(row["__linha"]));
            continue;
          }
        }
        const fresh = slice.filter((r) => !rejectedLines.has(Number(r["__linha"])));
        if (fresh.length) {
          await insertChunk(fresh.map((r) => ({ ...r, propriedade_id: propertyId })));
          innerReasons = reasons.length;
        }
        const processed = Math.min(i + 50, data.rows.length);
        setState((s) => (s.step === "running" ? { ...s, progress: processed, aceitas, rejeitadas: innerReasons } : s));
        if (processed % 250 === 0) await saveProgress(processed);
      }
      const duplicated = reasons.filter((r) => r.motivo.includes("duplicado")).length;
      await saveProgress(data.rows.length, "concluida");
      setState({ step: "done", aceitas, rejeitadas: reasons.length, reasons: reasons.slice(0, MAX_DETAIL), duplicated });
      toast.success(`Importação concluída: ${aceitas} registros adicionados.`);
      onImported(aceitas);
    } catch (error) {
      await saveProgress(data.rows.length, "erro", friendlyError(error)).catch(() => undefined);
      setState({ step: "preview", data, fields: current.fields, valid: current.valid, reasons: [...current.reasons, { linha: 0, motivo: "Erro inesperado: " + friendlyError(error) }], fieldsTouched: current.fieldsTouched });
      toast.error("A importação foi pausada. Reabra o arquivo para retomar de onde parou.");
    }
  };

  const preview = (e: FormEvent) => {
    e.preventDefault();
    const input = fileRef.current;
    const selected = input?.files?.[0];
    if (!selected) return;
    setFile(selected);

    void (async () => {
      try {
        const text = await selected.text();
        const data = detectAndParse(selected.name, text);
        if (!data.rows.length) {
          toast.error("Nenhuma linha encontrada no arquivo.");
          return;
        }
        const { rows: mapped, reasons } = applyRefMapping(
          data.rows.map((r, i) => ({ ...r, __linha: i + 2 })),
        );
        const errors: Reason[] = [];
        const valid: Row[] = [];
        mapped.forEach((row) => {
          const { value, errors: errs } = normalizeAndValidate(fields, row as Record<string, string>, Number(row["__linha"]));
          if (errs.length) errs.forEach((m) => errors.push({ linha: Number(row["__linha"]), motivo: m }));
          else valid.push({ ...value, __linha: row["__linha"] });
        });
        const combined = [...reasons, ...errors];
        const fieldNames = new Set(fields.map((f) => f.key));
        const ignored = data.headers.filter((h) => !fieldNames.has(h) && h !== "__linha").length;
        const fieldsTouched = data.headers.filter((h) => fieldNames.has(h)).length;
        setState({ step: "preview", data, fields, valid, reasons: combined, fieldsTouched });
        if (ignored) toast.info(`${ignored} coluna(s) ignorada(s) por não existirem no cadastro.`);
      } catch (error) {
        toast.error("Não foi possível ler o arquivo: " + friendlyError(error));
      }
    })();
  };

  const probeResume = () => {
    const selected = fileRef.current?.files?.[0];
    if (!selected) return;
    void (async () => {
      const { data } = await supabase
        .from("importacoes")
        .select("processadas,rejeitadas_detalhe,status")
        .eq("propriedade_id", propertyId)
        .eq("tabela", config.table)
        .eq("arquivo", selected.name)
        .maybeSingle();
      if (data && data.status === "em_andamento" && Number(data.processadas) !== 0) {
        resume.current = {
          processadas: Number(data.processadas),
          reasons: ((data.rejeitadas_detalhe as unknown) ?? []) as Reason[],
        };
      } else {
        resume.current = null;
      }
    })();
  };

  const s = state;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="dark max-h-[92vh] overflow-y-auto border-border bg-card sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar {config.singular}s</DialogTitle>
          <DialogDescription>
            Arquivo CSV, TSV ou JSON. Linhas válidas são adicionadas; inválidas são listadas sem apagar nada.
          </DialogDescription>
        </DialogHeader>

        {s.step === "upload" && (
          <form onSubmit={preview} className="space-y-4">
            <div>
              <Label>Arquivo</Label>
              <Input ref={fileRef} type="file" accept=".csv,.tsv,.json,.txt" className="mt-1" onChange={probeResume} />
            </div>
            <p className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              Colunas esperadas: <strong>{fields.map((f) => f.key).join(", ")}</strong>
            </p>
            <DialogFooter>
              <Button type="submit"><Upload />Analisar arquivo</Button>
            </DialogFooter>
          </form>
        )}

        {s.step === "preview" && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <PreviewStat label="Total de linhas" value={s.data.rows.length} tone="" />
              <PreviewStat label="Válidas" value={s.valid.length} tone="text-chart-3" />
              <PreviewStat label="Com problema" value={s.reasons.length} tone="text-destructive" />
            </div>
            {resume.current && (
              <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-500">
                Há uma importação anterior deste arquivo (parou em {resume.current.processadas} linhas). Ao iniciar, ela será retomada do ponto onde parou.
              </p>
            )}
            {s.reasons.length > 0 && (
              <div className="max-h-44 overflow-y-auto rounded-lg border border-border bg-muted/20 p-3">
                <p className="mb-2 text-xs font-semibold text-muted-foreground">Problemas encontrados (amostra):</p>
                {s.reasons.slice(0, 10).map((r, i) => (
                  <p key={i} className="text-xs text-destructive"><XCircle className="mr-1 inline size-3" />Linha {r.linha}: {r.motivo}</p>
                ))}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setState({ step: "upload" })}>Trocar arquivo</Button>
              <Button disabled={!s.valid.length} onClick={start}><Upload />Importar {s.valid.length} registros</Button>
            </DialogFooter>
          </div>
        )}

        {s.step === "running" && (
          <div className="space-y-4 py-6">
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${s.total ? (s.progress / s.total) * 100 : 0}%` }} />
            </div>
            <p className="flex items-center gap-2 text-sm"><Loader2 className="size-4 animate-spin" />Processando {s.progress.toLocaleString("pt-BR")} de {s.total.toLocaleString("pt-BR")}… ({s.aceitas} aceitas)</p>
          </div>
        )}

        {s.step === "done" && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <PreviewStat label="Adicionados" value={s.aceitas} tone="text-chart-3" />
              <PreviewStat label="Duplicados ignorados" value={s.duplicated} tone="text-amber-500" />
              <PreviewStat label="Rejeitados" value={s.rejeitadas - s.duplicated} tone="text-destructive" />
            </div>
            {s.reasons.length > 0 && (
              <div className="max-h-56 overflow-y-auto rounded-lg border border-border bg-muted/20 p-3">
                {s.reasons.map((r, i) => (
                  <p key={i} className="py-0.5 text-xs text-muted-foreground"><XCircle className="mr-1 inline size-3 text-destructive" />Linha {r.linha}: {r.motivo}</p>
                ))}
                {s.reasons.length === MAX_DETAIL && <p className="text-xs text-muted-foreground">…demais itens suprimidos para manter o registro compacto.</p>}
              </div>
            )}
            <DialogFooter>
              <Button onClick={onClose}><CheckCircle2 />Concluir</Button>
            </DialogFooter>
          </div>
        )}

        <div className="hidden" key={doneId.current}><FileSpreadsheet className="size-0" /></div>
      </DialogContent>
    </Dialog>
  );
}

function PreviewStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4 text-center">
      <strong className={`block text-2xl ${tone || "text-foreground"}`}>{value.toLocaleString("pt-BR")}</strong>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
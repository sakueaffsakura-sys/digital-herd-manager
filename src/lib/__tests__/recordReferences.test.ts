import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ from: vi.fn(), responses: [] as unknown[], inserts: [] as unknown[] }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mock.from } }));
import { ensureRecordReferences, vaccinationTarget } from "../recordInput";
import type { Field } from "@/components/app/shared";

beforeEach(() => {
  mock.responses = []; mock.inserts = [];
  mock.from.mockImplementation(() => {
    const q: Record<string, unknown> = {};
    for (const key of ["select", "eq", "ilike", "limit", "single"]) q[key] = () => q;
    q.insert = (value: unknown) => { mock.inserts.push(value); return q; };
    q.then = (resolve: (value: unknown) => unknown) => Promise.resolve(mock.responses.shift() ?? { data: [], error: null }).then(resolve);
    return q;
  });
});
const field: Field = { key: "animal_id", label: "Animal", type: "animal", activeOnly: true };
const cow = { id: "cow", nome: "Mimosa", numero_brinco: "001", sexo: "F", situacao: "ativo" };

describe("referências existentes antes de criar", () => {
  it.each(["lote", "vacina"] as const)("reutiliza %s ausente no cache sem inserir", async (type) => {
    mock.responses = [{ data: [{ id: "existing", nome: "78", ativo: false }], error: null }];
    const result = await ensureRecordReferences([{ key: "ref", label: type, type }], {}, { ref: "78" }, undefined, null, "property");
    expect(result.values.ref).toBe("existing"); expect(result.created).toEqual([]); expect(mock.inserts).toHaveLength(0);
  });
  it("reutiliza animal ausente no cache", async () => {
    mock.responses = [{ data: [cow], error: null }, { data: [], error: null }];
    const result = await ensureRecordReferences([field], {}, { animal_id: "001" }, undefined, null, "property");
    expect(result.values.animal_id).toBe("cow"); expect(mock.inserts).toHaveLength(0);
  });
  it("recupera inserção concorrente sem duplicar", async () => {
    mock.responses = [{ data: [], error: null }, { data: null, error: { code: "23505", message: "duplicate" } }, { data: [{ id: "winner", nome: "Raiva" }], error: null }];
    const result = await ensureRecordReferences([{ key: "ref", label: "Vacina", type: "vacina" }], {}, { ref: "Raiva" }, undefined, null, "property");
    expect(result.values.ref).toBe("winner"); expect(result.created).toEqual([]); expect(mock.inserts).toHaveLength(1);
  });
  it("não cria fêmea duplicada quando brinco pertence a macho", async () => {
    mock.responses = [{ data: [{ ...cow, sexo: "M" }], error: null }, { data: [], error: null }];
    const result = await ensureRecordReferences([{ ...field, sex: "F" }], {}, { animal_id: "001" }, undefined, null, "property");
    expect(result.error).toContain("fêmea"); expect(mock.inserts).toHaveLength(0);
  });
  it("não cria após falha de consulta", async () => {
    mock.responses = [{ data: null, error: { message: "offline" } }, { data: [], error: null }];
    const result = await ensureRecordReferences([field], {}, { animal_id: "001" }, undefined, null, "property");
    expect(result.error).toContain("conferir"); expect(mock.inserts).toHaveLength(0);
  });
});
describe("destino da vacinação", () => {
  it("salva por animal mesmo quando lote foi informado", () => {
    expect(vaccinationTarget({ animal_id: "cow", lote_id: "lot" })).toEqual({ animal_id: "cow", lote_id: null });
  });
  it("preserva vacinação coletiva sem animal", () => {
    expect(vaccinationTarget({ animal_id: null, lote_id: "lot" })).toEqual({ animal_id: null, lote_id: "lot" });
  });
});
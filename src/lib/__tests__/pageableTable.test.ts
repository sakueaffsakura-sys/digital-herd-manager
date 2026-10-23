import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock }));
import { createPageableTable } from "@/components/app/usePagedRows";

describe("consultas paginadas", () => {
  beforeEach(() => mock.from.mockReset());

  it("solicita contagem exata antes de aplicar os filtros", async () => {
    const query = { eq: vi.fn(), then: (resolve: (v: unknown) => unknown) => Promise.resolve({ count: 99999, error: null }).then(resolve) };
    query.eq.mockReturnValue(query);
    const select = vi.fn().mockReturnValue(query);
    mock.from.mockReturnValue({ select });
    const result = await createPageableTable({ table: "anotacoes_producao", propertyId: "fazenda" }).count({ search: "" });
    expect(select).toHaveBeenCalledExactlyOnceWith("id", { count: "exact", head: true });
    expect(query.eq).toHaveBeenCalledWith("propriedade_id", "fazenda");
    expect(result.count).toBe(99999);
  });

  it("busca a segunda página sem refazer select em um filtro", async () => {
    const row = { id: "anotacao-26" };
    const query = { eq: vi.fn(), order: vi.fn(), range: vi.fn(), then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data: [row], error: null }).then(resolve) };
    query.eq.mockReturnValue(query); query.order.mockReturnValue(query); query.range.mockReturnValue(query);
    const select = vi.fn().mockReturnValue(query);
    mock.from.mockReturnValue({ select });
    const result = await createPageableTable({ table: "anotacoes_producao", propertyId: "fazenda" }).rows({ cols: "id,observacao", page: 2, pageSize: 25, search: "" });
    expect(select).toHaveBeenCalledExactlyOnceWith("id,observacao", undefined);
    expect(query.range).toHaveBeenCalledWith(25, 49);
    expect(result.data).toEqual([row]);
  });
});
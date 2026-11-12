import { describe, expect, it } from "vitest";
import { AcessoNegado, conferirGravacao, escopoExigido, exigirAdmin, exigirPropriedade, filtroDeLeitura, TabelaDesconhecida, type Quem } from "../dados/acesso";
import { ESCOPO_DA_TABELA } from "../dados/escopos";

const MINHA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ALHEIA = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const EU = "11111111-1111-4111-8111-111111111111";
const OUTRO = "22222222-2222-4222-8222-222222222222";

const dona: Quem = { userId: EU, admin: false, propriedades: [MINHA] };
const semFazenda: Quem = { userId: OUTRO, admin: false, propriedades: [] };
const chefe: Quem = { userId: EU, admin: true, propriedades: [MINHA] };

describe("quem pode ver o quê", () => {
  it("dados de fazenda só saem com a lista de fazendas da pessoa", () => {
    const f = filtroDeLeitura("animais", dona);
    expect(f.sql).toBe("propriedade_id IN (?)");
    expect(f.valores).toEqual([MINHA]);
    expect(f.valores).not.toContain(ALHEIA);
  });

  it("quem não tem fazenda nenhuma não lê nada, em vez de ler tudo", () => {
    // O erro clássico: lista vazia virar "IN ()" ou sumir a condição e abrir o banco inteiro.
    expect(filtroDeLeitura("animais", semFazenda)).toEqual({ sql: "1 = 0", valores: [] });
    expect(filtroDeLeitura("propriedades", semFazenda)).toEqual({ sql: "1 = 0", valores: [] });
  });

  it("administrador não ganha as fazendas dos outros de brinde", () => {
    const f = filtroDeLeitura("animais", chefe);
    expect(f.valores).toEqual([MINHA]);
    expect(f.sql).not.toBe("1 = 1");
  });

  it("linha de pessoa só sai para ela, e o administrador vê todas", () => {
    expect(filtroDeLeitura("notificacoes", dona)).toEqual({ sql: "user_id = ?", valores: [EU] });
    expect(filtroDeLeitura("notificacoes", chefe).sql).toBe("1 = 1");
  });

  it("a conta da pessoa só sai para ela", () => {
    expect(filtroDeLeitura("profiles", dona)).toEqual({ sql: "id = ?", valores: [EU] });
  });

  it("tabela de administrador não sai para quem não é", () => {
    expect(filtroDeLeitura("eventos_seguranca", dona)).toEqual({ sql: "1 = 0", valores: [] });
    expect(filtroDeLeitura("eventos_seguranca", chefe).sql).toBe("1 = 1");
  });

  it("tabela de segredo não sai nem para o administrador", () => {
    expect(() => filtroDeLeitura("chaves_sistema", chefe)).toThrow(AcessoNegado);
    expect(() => filtroDeLeitura("rate_limits", chefe)).toThrow(AcessoNegado);
  });

  it("tabela que ninguém classificou é recusada, não liberada", () => {
    expect(() => filtroDeLeitura("tabela_que_nao_existe", chefe)).toThrow(TabelaDesconhecida);
    expect(() => filtroDeLeitura("", chefe)).toThrow(TabelaDesconhecida);
  });
});

describe("quem pode gravar o quê", () => {
  it("não dá para gravar numa fazenda alheia", () => {
    expect(() => conferirGravacao("animais", dona, { propriedade_id: ALHEIA })).toThrow(AcessoNegado);
    expect(() => conferirGravacao("animais", chefe, { propriedade_id: ALHEIA })).toThrow(AcessoNegado);
  });

  it("não dá para gravar sem dizer a fazenda", () => {
    expect(() => conferirGravacao("animais", dona, {})).toThrow(AcessoNegado);
    expect(() => conferirGravacao("animais", dona, { propriedade_id: "" })).toThrow(AcessoNegado);
    expect(() => conferirGravacao("animais", dona, { propriedade_id: null })).toThrow(AcessoNegado);
  });

  it("na própria fazenda, grava", () => {
    expect(() => conferirGravacao("animais", dona, { propriedade_id: MINHA })).not.toThrow();
  });

  it("não dá para gravar em nome de outra pessoa", () => {
    expect(() => conferirGravacao("notificacoes", dona, { user_id: OUTRO })).toThrow(AcessoNegado);
    expect(() => conferirGravacao("profiles", dona, { id: OUTRO })).toThrow(AcessoNegado);
    expect(() => conferirGravacao("profiles", dona, { id: EU })).not.toThrow();
  });

  it("só o administrador mexe no que é do site inteiro", () => {
    expect(() => conferirGravacao("planos", dona, {})).toThrow(AcessoNegado);
    expect(() => conferirGravacao("imagens_site", dona, {})).toThrow(AcessoNegado);
    expect(() => conferirGravacao("planos", chefe, {})).not.toThrow();
  });

  it("tabela de segredo não é gravada por aqui", () => {
    expect(() => conferirGravacao("chaves_sistema", chefe, {})).toThrow(AcessoNegado);
  });
});

describe("portas diretas", () => {
  it("exigirPropriedade deixa passar a própria e barra a alheia", () => {
    expect(() => exigirPropriedade(dona, MINHA)).not.toThrow();
    expect(() => exigirPropriedade(dona, ALHEIA)).toThrow(AcessoNegado);
    expect(() => exigirPropriedade(semFazenda, MINHA)).toThrow(AcessoNegado);
  });

  it("exigirAdmin barra quem não é", () => {
    expect(() => exigirAdmin(chefe)).not.toThrow();
    expect(() => exigirAdmin(dona)).toThrow(AcessoNegado);
  });
});

describe("a lista de escopos cobre o banco inteiro", () => {
  it("toda tabela tem um dono definido", () => {
    const tabelas = Object.keys(ESCOPO_DA_TABELA);
    expect(tabelas.length).toBeGreaterThanOrEqual(81);
    for (const t of tabelas) expect(() => escopoExigido(t)).not.toThrow();
  });

  it("as tabelas de fazenda são a maioria e incluem as do aplicativo", () => {
    for (const t of ["animais", "pastos", "tarefas", "estoque_mov", "plantios", "tratamentos", "contas"]) {
      expect(escopoExigido(t)).toBe("propriedade");
    }
  });

  it("nenhuma tabela de dados de fazenda ficou marcada como pública", () => {
    for (const [tabela, escopo] of Object.entries(ESCOPO_DA_TABELA)) {
      if (escopo !== "publico") continue;
      expect(["manutencao_config", "imagens_site", "planos", "ebooks"]).toContain(tabela);
    }
  });
});

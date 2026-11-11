/**
 * O jeito de pedir dados a partir da tela.
 *
 * Tem de propósito a mesma forma de escrever do cliente antigo
 * (`dados.from("animais").select("*").eq("propriedade_id", x).order("data")`), para as
 * telas do site mudarem só a linha do import, e não a lógica de cada consulta.
 *
 * A diferença está em quem decide: antes o navegador falava com o banco e as regras de
 * acesso ficavam no banco. Agora o navegador fala com o nosso servidor, e é lá que a
 * separação entre fazendas é aplicada. Nada aqui é confiável — tudo é conferido de novo
 * do outro lado.
 *
 * Os tipos de cada linha vêm de `integrations/supabase/types`, o mesmo arquivo que o
 * cliente antigo usava. É o que mantém o TypeScript conferindo nome e feitio de coluna
 * nas telas depois da troca: um `select("nome")` numa tabela sem `nome` continua sendo
 * erro de compilação, e não um campo vazio em produção.
 */
import type { Database } from "@/integrations/supabase/types";

/**
 * O que deu errado. `code` existe para a tela distinguir um erro de outro sem ler o texto
 * da mensagem: a importação de planilha, por exemplo, precisa saber se a linha já estava
 * lá (que não é problema) ou se o banco recusou de verdade.
 */
export type ErroDados = { message: string; code?: string; details?: string };

/**
 * A resposta é uma união de dois casos, e não um objeto com tudo podendo ser nulo. É o que
 * faz `if (error) return;` já garantir que `data` existe dali para frente — sem isso, cada
 * tela precisaria de um `!` ou de uma conferência a mais depois de já ter conferido o erro.
 */
export type Resposta<T> =
  | { data: T; error: null; count: number | null }
  | { data: null; error: ErroDados; count: null };

type Operacao = "=" | "<>" | ">" | ">=" | "<" | "<=" | "contem" | "vazio" | "naoVazio" | "entre" | "em";
type FiltroPedido = { coluna: string; op: Operacao; valor?: unknown; ate?: unknown };

/** Tabelas e visões juntas: a tela lê das duas do mesmo jeito. */
type Conjunto = Database["public"]["Tables"] & Database["public"]["Views"];
type Conhecida = keyof Conjunto & string;

/** A linha de uma tabela conhecida; para um nome montado em tempo de execução, livre. */
type LinhaDe<N extends string> = N extends Conhecida
  ? Conjunto[N] extends { Row: infer R } ? R : Record<string, unknown>
  : Record<string, unknown>;
/** O que se pode gravar. Visão não tem: gravar nela é recusado pelo servidor. */
type EntradaDe<N extends string> = N extends Conhecida
  ? Conjunto[N] extends { Insert: infer I } ? I : Record<string, unknown>
  : Record<string, unknown>;

/** O que cada consulta pronta devolve, pelos mesmos tipos gerados de antes. */
type Funcoes = Database["public"]["Functions"];
type RetornoDe<N extends string> = N extends keyof Funcoes
  ? Funcoes[N] extends { Returns: infer R } ? R : unknown
  : unknown;

const CAMINHO = "/api/dados";

async function chamar<T>(corpo: unknown): Promise<Resposta<T>> {
  try {
    const r = await fetch(CAMINHO, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(corpo),
      credentials: "same-origin",
    });
    const json = (await r.json().catch(() => ({}))) as { linhas?: T; total?: number; erro?: string; codigo?: string };
    if (!r.ok) {
      return {
        data: null,
        error: { message: json.erro ?? "Não deu para falar com o servidor.", ...(json.codigo ? { code: json.codigo } : {}) },
        count: null,
      };
    }
    return { data: (json.linhas ?? null) as T, error: null, count: json.total ?? null };
  } catch {
    return { data: null, error: { message: "Sem conexão com o servidor." }, count: null };
  }
}

class Consulta<T> implements PromiseLike<Resposta<T[]>> {
  private filtros: FiltroPedido[] = [];
  private ordem: { coluna: string; crescente?: boolean }[] = [];
  private colunas: string[] | undefined;
  private porPagina: number | undefined;
  private pagina = 1;
  private texto: { termo: string; colunas: string[] } | undefined;
  private qualquerDe: FiltroPedido[] = [];
  private soContar = false;

  constructor(private readonly tabela: string) {}

  /**
   * As colunas desejadas. Com `{ head: true }` traz só a contagem, sem as linhas — é o que
   * a tela usa para o "3 pedidos abertos" do painel, onde ninguém vai ler os registros.
   */
  select(colunas = "*", opcoes?: { count?: "exact" | "planned" | "estimated"; head?: boolean }): this {
    const limpas = colunas.split(",").map((c) => c.trim()).filter((c) => c && c !== "*");
    this.colunas = limpas.length ? limpas : undefined;
    if (opcoes?.head) this.soContar = true;
    return this;
  }

  /**
   * "Qualquer um destes": as crias de um animal são as que têm ele como mãe OU como pai.
   * Recebe coluna e valor, nunca um texto de consulta — o que o navegador manda não vira
   * pedaço de comando.
   */
  qualquerIgual(condicoes: readonly { coluna: string; valor: unknown }[]): this {
    for (const c of condicoes) this.qualquerDe.push({ coluna: c.coluna, op: "=", valor: c.valor });
    return this;
  }
  eq(coluna: string, valor: unknown): this { return this.onde(coluna, "=", valor); }
  neq(coluna: string, valor: unknown): this { return this.onde(coluna, "<>", valor); }
  gt(coluna: string, valor: unknown): this { return this.onde(coluna, ">", valor); }
  gte(coluna: string, valor: unknown): this { return this.onde(coluna, ">=", valor); }
  lt(coluna: string, valor: unknown): this { return this.onde(coluna, "<", valor); }
  lte(coluna: string, valor: unknown): this { return this.onde(coluna, "<=", valor); }
  ilike(coluna: string, padrao: string): this { return this.onde(coluna, "contem", String(padrao).replace(/^%|%$/g, "")); }
  in(coluna: string, valores: readonly unknown[]): this { return this.onde(coluna, "em", [...valores]); }
  is(coluna: string, valor: null | boolean): this {
    return valor === null ? this.onde(coluna, "vazio") : this.onde(coluna, "=", valor);
  }
  /** Procura o mesmo texto em várias colunas. */
  procurar(termo: string, colunas: readonly string[]): this {
    this.texto = { termo, colunas: [...colunas] };
    return this;
  }
  match(valores: Record<string, unknown>): this {
    for (const [c, v] of Object.entries(valores)) this.onde(c, "=", v);
    return this;
  }
  order(coluna: string, opcoes?: { ascending?: boolean }): this {
    this.ordem.push({ coluna, crescente: opcoes?.ascending ?? true });
    return this;
  }
  limit(quantas: number): this { this.porPagina = quantas; return this; }
  range(de: number, ate: number): this {
    const tamanho = Math.max(1, ate - de + 1);
    this.porPagina = tamanho;
    this.pagina = Math.floor(de / tamanho) + 1;
    return this;
  }

  private onde(coluna: string, op: Operacao, valor?: unknown): this {
    this.filtros.push({ coluna, op, valor });
    return this;
  }

  private pedido() {
    return {
      acao: "listar",
      tabela: this.tabela,
      colunas: this.colunas,
      filtros: this.filtros,
      ordem: this.ordem,
      pagina: this.pagina,
      // Contando, uma linha basta: a contagem vem junto da resposta de qualquer jeito.
      porPagina: this.soContar ? 1 : this.porPagina,
      texto: this.texto,
      qualquerDe: this.qualquerDe,
    };
  }

  /** Espera uma linha só; nenhuma linha vira erro. */
  async single(): Promise<Resposta<T>> {
    const r = await chamar<T[]>({ ...this.pedido(), porPagina: 2 });
    if (r.error) return { data: null, error: r.error, count: null };
    const linhas = r.data ?? [];
    if (linhas.length !== 1) return { data: null, error: { message: "Esperava um registro só." }, count: null };
    return { data: linhas[0]!, error: null, count: 1 };
  }

  /** Espera uma linha ou nenhuma. Não achar não é erro: volta `data: null`. */
  async maybeSingle(): Promise<Resposta<T | null>> {
    const r = await chamar<T[]>({ ...this.pedido(), porPagina: 1 });
    if (r.error) return { data: null, error: r.error, count: null };
    return { data: (r.data ?? [])[0] ?? null, error: null, count: r.count };
  }

  then<R1 = Resposta<T[]>, R2 = never>(
    aoResolver?: ((v: Resposta<T[]>) => R1 | PromiseLike<R1>) | null,
    aoFalhar?: ((m: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    const pedido = chamar<T[]>(this.pedido()).then((r) =>
      // Com `head`, quem pediu quer a contagem, não as linhas.
      this.soContar && !r.error ? ({ data: null, error: null, count: r.count } as Resposta<T[]>) : r,
    );
    return pedido.then(aoResolver, aoFalhar);
  }
}

/**
 * Uma gravação. Dá para esperar direto, ou pedir `.select("id")` antes para receber de
 * volta o que foi gravado — a mesma escrita do cliente antigo.
 *
 * O que volta é sempre o identificador: o servidor não devolve a linha inteira depois de
 * gravar, porque nenhuma tela usa isso e seria uma leitura a mais em cada gravação.
 */
class Gravacao<T> implements PromiseLike<Resposta<T[]>> {
  constructor(private readonly pedido: Record<string, unknown>) {}

  select(_colunas = "id"): this { return this; }

  async single(): Promise<Resposta<T>> {
    const r = await chamar<T[]>(this.pedido);
    if (r.error) return { data: null, error: r.error, count: null };
    const linhas = r.data ?? [];
    if (!linhas.length) return { data: null, error: { message: "Nada foi gravado." }, count: null };
    return { data: linhas[0]!, error: null, count: 1 };
  }
  maybeSingle(): Promise<Resposta<T | null>> { return this.single(); }

  then<R1 = Resposta<T[]>, R2 = never>(
    aoResolver?: ((v: Resposta<T[]>) => R1 | PromiseLike<R1>) | null,
    aoFalhar?: ((m: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return chamar<T[]>(this.pedido).then(aoResolver, aoFalhar);
  }
}

class Tabela<L, E> {
  constructor(private readonly nome: string) {}

  select<T = L>(colunas = "*"): Consulta<T> {
    return new Consulta<T>(this.nome).select(colunas) as unknown as Consulta<T>;
  }

  insert(linhas: E | E[]): Gravacao<{ id: string }> {
    return new Gravacao({ acao: "criar", tabela: this.nome, linhas: Array.isArray(linhas) ? linhas : [linhas] });
  }

  /**
   * Gravar ou atualizar. `onConflict` diz quais colunas identificam a mesma linha, e
   * `ignoreDuplicates` pede para não mexer no que já existe.
   *
   * O servidor confere que essas colunas formam mesmo uma chave única da tabela: o MySQL
   * não deixa escolher em qual chave o conflito bate, então nomear colunas erradas
   * atualizaria a linha errada sem ninguém notar.
   */
  upsert(
    linhas: E | E[],
    opcoes?: { onConflict?: string; ignoreDuplicates?: boolean },
  ): Gravacao<{ id: string }> {
    return new Gravacao({
      acao: "gravarOuAtualizar",
      tabela: this.nome,
      linhas: Array.isArray(linhas) ? linhas : [linhas],
      conflito: opcoes?.onConflict ?? "id",
      soIgnorar: opcoes?.ignoreDuplicates === true,
    });
  }

  update(mudancas: Partial<E> | Record<string, unknown>) {
    return new Alteracao(this.nome, "atualizar", mudancas as Record<string, unknown>);
  }
  delete() {
    return new Alteracao(this.nome, "apagar", {});
  }
}

/** Alteração e exclusão exigem dizer qual registro: sem `eq("id", ...)` o servidor recusa. */
class Alteracao implements PromiseLike<Resposta<null>> {
  private id: string | null = null;
  constructor(
    private readonly tabela: string,
    private readonly acao: "atualizar" | "apagar",
    private readonly mudancas: Record<string, unknown>,
  ) {}
  eq(coluna: string, valor: unknown): this {
    if (coluna === "id") this.id = String(valor);
    return this;
  }
  select(_colunas = "id"): this { return this; }
  then<R1 = Resposta<null>, R2 = never>(
    aoResolver?: ((v: Resposta<null>) => R1 | PromiseLike<R1>) | null,
    aoFalhar?: ((m: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    if (!this.id) {
      return Promise.resolve({ data: null, error: { message: "Diga qual registro alterar." }, count: null } as Resposta<null>).then(aoResolver as never, aoFalhar);
    }
    return chamar<null>({ acao: this.acao, tabela: this.tabela, id: this.id, mudancas: this.mudancas }).then(aoResolver, aoFalhar);
  }
}

export const dados = {
  from: <N extends string>(tabela: N) => new Tabela<LinhaDe<N>, EntradaDe<N>>(tabela),
  /**
   * As consultas prontas que antes eram funções dentro do banco. O que cada uma devolve
   * vem dos mesmos tipos gerados de antes, então a tela continua sabendo o feitio da
   * resposta sem precisar de `as`.
   */
  rpc: <N extends string, T = RetornoDe<N>>(nome: N, argumentos: Record<string, unknown> = {}): Promise<Resposta<T>> =>
    chamar<T>({ acao: "consulta", nome, argumentos }),
};

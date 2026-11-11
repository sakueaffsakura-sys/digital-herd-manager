/**
 * Quem pode mexer em quê.
 *
 * No banco antigo (PostgreSQL) era o próprio banco que impedia uma fazenda de enxergar
 * a outra. O MySQL não faz isso. Então a separação passou para cá, e TODA leitura e
 * gravação de dados tem de passar por este arquivo.
 *
 * A ideia central é não depender de ninguém lembrar: quem monta a condição de acesso é
 * este módulo, a partir do escopo da tabela. Tabela que não está na lista de escopos é
 * recusada — na dúvida, ninguém entra.
 */
import { escopoDa, type Escopo } from "./escopos";

/** Quem está pedindo. Sai da sessão; nunca de algo que o navegador mandou. */
export type Quem = {
  userId: string;
  /** Administrador do sistema. Vem da tabela de papéis, nunca de um campo do navegador. */
  admin: boolean;
  /** As fazendas a que a pessoa tem acesso, já conferidas no banco. */
  propriedades: readonly string[];
};

export class AcessoNegado extends Error {
  readonly status = 403;
  constructor(mensagem = "Você não tem acesso a este registro.") {
    super(mensagem);
    this.name = "AcessoNegado";
  }
}

export class TabelaDesconhecida extends Error {
  readonly status = 500;
  constructor(tabela: string) {
    super(`A tabela "${tabela}" não tem dono definido. Veja banco/mysql/escopos.py.`);
    this.name = "TabelaDesconhecida";
  }
}

/** Pedaço de SQL com os valores separados, para o banco nunca receber texto colado. */
export type Condicao = { sql: string; valores: unknown[] };

const SEMPRE_FALSO: Condicao = { sql: "1 = 0", valores: [] };

/**
 * A condição que limita uma leitura ao que a pessoa pode ver.
 * É isto que substitui as regras de acesso do banco antigo.
 */
export function filtroDeLeitura(tabela: string, quem: Quem): Condicao {
  const escopo = escopoDa(tabela);
  if (!escopo) throw new TabelaDesconhecida(tabela);
  switch (escopo) {
    case "propriedade": {
      if (quem.propriedades.length === 0) return SEMPRE_FALSO;
      const marcas = quem.propriedades.map(() => "?").join(",");
      return { sql: `propriedade_id IN (${marcas})`, valores: [...quem.propriedades] };
    }
    case "usuario":
      // O administrador lê tudo porque as telas de administração dependem disso;
      // quem não é administrador lê apenas as próprias linhas.
      return quem.admin ? { sql: "1 = 1", valores: [] } : { sql: "user_id = ?", valores: [quem.userId] };
    case "proprio":
      return quem.admin ? { sql: "1 = 1", valores: [] } : { sql: "id = ?", valores: [quem.userId] };
    case "fazendas": {
      if (quem.propriedades.length === 0) return SEMPRE_FALSO;
      const marcas = quem.propriedades.map(() => "?").join(",");
      return { sql: `id IN (${marcas})`, valores: [...quem.propriedades] };
    }
    case "publico":
      return { sql: "1 = 1", valores: [] };
    case "admin":
      return quem.admin ? { sql: "1 = 1", valores: [] } : SEMPRE_FALSO;
    case "servidor":
      // Estas tabelas não saem pela API de jeito nenhum, nem para administrador.
      throw new AcessoNegado("Esta tabela não é lida por aqui.");
    default: {
      const nunca: never = escopo;
      throw new TabelaDesconhecida(String(nunca));
    }
  }
}

/** Confere se a pessoa pode gravar nesta tabela, e com que valores obrigatórios. */
export function conferirGravacao(tabela: string, quem: Quem, linha: Record<string, unknown>): void {
  const escopo = escopoDa(tabela);
  if (!escopo) throw new TabelaDesconhecida(tabela);
  switch (escopo) {
    case "propriedade": {
      const prop = linha["propriedade_id"];
      if (typeof prop !== "string" || !prop) throw new AcessoNegado("Falta dizer de qual fazenda é este registro.");
      exigirPropriedade(quem, prop);
      return;
    }
    case "usuario": {
      const dono = linha["user_id"];
      if (!quem.admin && dono !== undefined && dono !== quem.userId) {
        throw new AcessoNegado("Você só pode gravar em nome da sua própria conta.");
      }
      return;
    }
    case "proprio": {
      const id = linha["id"];
      if (!quem.admin && id !== undefined && id !== quem.userId) {
        throw new AcessoNegado("Você só pode alterar a sua própria conta.");
      }
      return;
    }
    case "fazendas":
      // Criar fazenda é liberado; alterar uma existente passa por exigirPropriedade antes.
      return;
    case "publico":
    case "admin":
      if (!quem.admin) throw new AcessoNegado("Só o administrador pode alterar isto.");
      return;
    case "servidor":
      throw new AcessoNegado("Esta tabela não é gravada por aqui.");
    default: {
      const nunca: never = escopo;
      throw new TabelaDesconhecida(String(nunca));
    }
  }
}

/** Para quando a tela já traz a fazenda escolhida: ou a pessoa tem acesso, ou para aqui. */
export function exigirPropriedade(quem: Quem, propriedadeId: string): void {
  if (!quem.propriedades.includes(propriedadeId)) {
    throw new AcessoNegado("Você não tem acesso a esta fazenda.");
  }
}

export function exigirAdmin(quem: Quem): void {
  if (!quem.admin) throw new AcessoNegado("Esta área é só do administrador.");
}

/** Só para teste e para mensagens: diz o escopo sem deixar passar tabela desconhecida. */
export function escopoExigido(tabela: string): Escopo {
  const e = escopoDa(tabela);
  if (!e) throw new TabelaDesconhecida(tabela);
  return e;
}

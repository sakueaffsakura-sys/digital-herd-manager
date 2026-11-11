"""Gera src/lib/dados/escopos.ts: quem pode ver e mexer em cada tabela.

É o coração da segurança depois da mudança para o MySQL. No PostgreSQL, quem garantia
que uma fazenda não enxerga a outra eram as 185 regras de acesso do próprio banco. O
MySQL não tem isso, então a garantia passa para o servidor — e passa por aqui.

A lista é GERADA, não escrita à mão: toda tabela do banco precisa aparecer com um
escopo. Tabela nova sem escopo faz este programa parar, em vez de nascer sem dono.
"""
from pathlib import Path

BASE = Path(__file__).resolve().parent
SAIDA = BASE.parent.parent / "src" / "lib" / "dados" / "escopos.ts"

# Escopos:
#   propriedade  linha pertence a uma fazenda; só quem tem acesso à fazenda vê
#   usuario      linha pertence a uma pessoa; só ela vê (e o administrador, pelas telas de admin)
#   proprio      a própria conta da pessoa (profiles)
#   fazendas     a lista de fazendas da pessoa (propriedades)
#   publico      qualquer pessoa que entrou pode ler; só administrador grava
#   admin        só administrador, em leitura e escrita
#   servidor     nunca sai pela API; só o próprio servidor toca
ESCOPOS_ESPECIAIS = {
    "propriedades": "fazendas",
    "profiles": "proprio",
    "notificacoes": "usuario",
    "suporte_contatos": "usuario",
    "plano_auditoria": "admin",
    "bloqueios_acesso": "admin",
    "configuracoes_sistema": "admin",
    "eventos_seguranca": "admin",
    "manutencao_config": "publico",
    "imagens_site": "publico",
    "planos": "publico",
    "ebooks": "publico",
    "chaves_sistema": "servidor",
    "rate_limits": "servidor",
}

tabelas = {}
for linha in (BASE / "colunas.txt").read_text(encoding="utf-8").strip().split("\n"):
    partes = linha.split("|")
    tabelas[partes[0]] = [c.split(":") for c in partes[1:]]

escopos = {}
for nome, colunas in tabelas.items():
    if nome in ESCOPOS_ESPECIAIS:
        escopos[nome] = ESCOPOS_ESPECIAIS[nome]
        continue
    nomes = {c[0]: c for c in colunas}
    if "propriedade_id" in nomes and nomes["propriedade_id"][2] == "N":
        escopos[nome] = "propriedade"
    elif "user_id" in nomes:
        escopos[nome] = "usuario"
    else:
        raise SystemExit(
            f"A tabela '{nome}' não tem propriedade_id nem user_id e não está na lista de escopos "
            f"especiais. Diga em escopos.py quem pode ver e mexer nela."
        )

por_escopo = {}
for t, e in sorted(escopos.items()):
    por_escopo.setdefault(e, []).append(t)

linhas = [
    "// Quem pode ver e mexer em cada tabela.",
    "//",
    "// GERADO por banco/mysql/escopos.py. Não edite à mão: rode o programa de novo.",
    "//",
    "// No banco antigo (PostgreSQL) quem separava uma fazenda da outra era o próprio banco.",
    "// O MySQL não faz isso, então a separação passou para o servidor e começa nesta lista.",
    "// Tabela nova sem escopo faz o gerador parar, para nenhuma nascer sem dono.",
    "",
    "export type Escopo =",
    '  | "propriedade" // linha de uma fazenda: só quem tem acesso à fazenda',
    '  | "usuario" //     linha de uma pessoa: só ela',
    '  | "proprio" //     a conta da própria pessoa',
    '  | "fazendas" //    a lista de fazendas da pessoa',
    '  | "publico" //     qualquer pessoa que entrou lê; só administrador grava',
    '  | "admin" //       só administrador',
    '  | "servidor"; //   nunca sai pela API',
    "",
    "export const ESCOPO_DA_TABELA = {",
]
for t, e in sorted(escopos.items()):
    linhas.append(f'  {t}: "{e}",')
linhas += [
    "} as const satisfies Record<string, Escopo>;",
    "",
    "export type TabelaDeDados = keyof typeof ESCOPO_DA_TABELA;",
    "",
    "/** Tabela desconhecida nunca é tratada como pública: na dúvida, ninguém entra. */",
    "export function escopoDa(tabela: string): Escopo | null {",
    "  return (ESCOPO_DA_TABELA as Record<string, Escopo>)[tabela] ?? null;",
    "}",
    "",
]
SAIDA.parent.mkdir(parents=True, exist_ok=True)
SAIDA.write_text("\n".join(linhas), encoding="utf-8")
print(f"{len(escopos)} tabelas classificadas")
for e, ts in sorted(por_escopo.items()):
    print(f"  {e}: {len(ts)}")
print(f"gravado em {SAIDA}")

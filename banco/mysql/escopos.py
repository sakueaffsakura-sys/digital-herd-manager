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

# As visões (banco/mysql/visoes.sql): resumos por mês e por lote que as telas leem direto.
# Pertencem a uma fazenda, como as tabelas, mas são SÓ LEITURA: ninguém grava num resumo.
# As colunas estão aqui porque visão não aparece em colunas.txt, que vem das tabelas.
VISOES = {
    "v_financeiro_mensal": {"propriedade_id": "texto", "mes": "data", "receitas": "numero",
                            "despesas": "numero", "investimentos": "numero", "lucro": "numero"},
    "v_financeiro_por_categoria": {"propriedade_id": "texto", "mes": "data", "tipo": "texto",
                                   "categoria": "texto", "total": "numero"},
    "v_producao_mensal": {"propriedade_id": "texto", "mes": "data", "total_litros": "numero",
                          "media_registro": "numero", "valor_total": "numero"},
    "v_producao_por_lote": {"propriedade_id": "texto", "lote_id": "texto", "lote_nome": "texto",
                            "mes": "data", "total_litros": "numero", "valor_total": "numero", "vacas": "inteiro"},
    "v_animais_por_lote": {"propriedade_id": "texto", "lote_id": "texto", "nome": "texto", "quantidade": "inteiro"},
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

for visao in VISOES:
    escopos[visao] = "propriedade"

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
    "/**",
    " * As visões: resumos por mês e por lote. Só leitura — ninguém grava num resumo, e uma",
    " * tentativa é recusada em vez de virar erro do banco.",
    " */",
    "export const SOMENTE_LEITURA: ReadonlySet<string> = new Set([",
] + [f'  "{v}",' for v in sorted(VISOES)] + [
    "]);",
    "",
]

# As chaves únicas de cada tabela, para o "gravar ou atualizar" (upsert).
#
# No PostgreSQL o pedido dizia em qual chave o conflito deve bater. O MySQL não deixa
# escolher: o ON DUPLICATE KEY dispara na primeira chave única que repetir, qualquer que
# seja. Então o servidor confere se as colunas que o pedido nomeou formam mesmo uma chave
# única; se não formarem, recusa, em vez de atualizar a linha errada sem ninguém notar.
unicas = {}
for linha in (BASE / "chaves.txt").read_text(encoding="utf-8").strip().split("\n"):
    partes = linha.split()
    if len(partes) == 3 and partes[1] in ("UQ", "PK"):
        unicas.setdefault(partes[0], []).append(partes[2].split(","))

linhas += [
    "/**",
    " * As chaves únicas de cada tabela, para o \"gravar ou atualizar\".",
    " *",
    " * No banco antigo o pedido dizia em qual chave o conflito deve bater. O MySQL não deixa",
    " * escolher: dispara na primeira chave única que repetir. Então o servidor confere se as",
    " * colunas que o pedido nomeou formam mesmo uma chave única — senão atualizaria a linha",
    " * errada sem ninguém notar.",
    " */",
    "export const CHAVES_UNICAS: Record<string, readonly string[][]> = {",
]
for t in sorted(unicas):
    conjuntos = ", ".join("[" + ", ".join(f'"{c}"' for c in chave) + "]" for chave in unicas[t])
    linhas.append(f"  {t}: [{conjuntos}],")
linhas += [
    "};",
    "",
    "/** As colunas nomeadas formam uma chave única desta tabela? A ordem não importa. */",
    "export function ehChaveUnica(tabela: string, colunas: readonly string[]): boolean {",
    "  const chaves = CHAVES_UNICAS[tabela];",
    "  if (!chaves) return false;",
    "  const pedida = [...colunas].sort().join(\",\");",
    "  return chaves.some((chave) => [...chave].sort().join(\",\") === pedida);",
    "}",
    "",
]
# A lista de colunas de cada tabela vira uma peneira: nome de coluna que vem do navegador
# só entra na consulta se estiver aqui. É o que impede comando colado pelo nome do campo.
COLUNAS = SAIDA.parent / "colunas.ts"
tipo_ts = {"uuid": "texto", "text": "texto", "date": "data", "boolean": "sim", "jsonb": "json",
           "json": "json", "ARRAY": "json", "integer": "inteiro", "bigint": "inteiro",
           "smallint": "inteiro"}
def tipo_simples(t):
    if t in tipo_ts: return tipo_ts[t]
    if t.startswith("timestamp"): return "instante"
    if t.startswith("numeric"): return "numero"
    if t == "USER-DEFINED": return "texto"
    raise SystemExit(f"tipo sem feitio: {t}")

linhas_cols = [
    "// Colunas de cada tabela e o feitio de cada uma.",
    "//",
    "// GERADO por banco/mysql/escopos.py. Não edite à mão.",
    "//",
    "// Serve de peneira: nome de coluna que chega do navegador só entra na consulta se",
    "// estiver nesta lista. Assim nome de campo não vira comando colado no banco.",
    "",
    'export type Feitio = "texto" | "numero" | "inteiro" | "data" | "instante" | "sim" | "json";',
    "",
    "export const COLUNAS_DA_TABELA: Record<string, Record<string, Feitio>> = {",
]
for nome, colunas in sorted(tabelas.items()):
    campos = ", ".join(f'{c[0]}: "{tipo_simples(c[1])}"' for c in colunas)
    linhas_cols.append(f"  {nome}: {{ {campos} }},")
linhas_cols.append("  // As visões (banco/mysql/visoes.sql). Só leitura: ver SOMENTE_LEITURA em escopos.ts.")
for nome, campos_visao in sorted(VISOES.items()):
    campos = ", ".join(f'{c}: "{f}"' for c, f in campos_visao.items())
    linhas_cols.append(f"  {nome}: {{ {campos} }},")
linhas_cols += [
    "};",
    "",
    "/** Coluna conhecida desta tabela, ou nada. Nunca devolve o que veio do navegador. */",
    "export function colunaValida(tabela: string, coluna: string): Feitio | null {",
    "  return COLUNAS_DA_TABELA[tabela]?.[coluna] ?? null;",
    "}",
    "",
]
COLUNAS.write_text("\n".join(linhas_cols), encoding="utf-8")
print(f"colunas gravadas em {COLUNAS}")

# A ordem de apagar uma fazenda.
#
# No PostgreSQL bastava apagar a linha da fazenda: as regras de "apagar junto" resolviam
# o resto, e as que dizem "não apague se alguém aponta para cá" eram conferidas só no fim
# da operação, quando já não sobrava ninguém apontando. O MySQL confere na hora, então
# apagar a fazenda direto esbarra em `nascimentos`, que aponta para `animais`.
#
# A saída é o servidor apagar na ordem, de baixo para cima: primeiro quem aponta, depois
# quem é apontado. A ordem vem de ordem.txt (a mesma da importação, de cima para baixo)
# invertida, então não dá para divergir do que o banco tem.
ordem_importacao = [l.strip() for l in (BASE / "ordem.txt").read_text(encoding="utf-8").split("\n") if l.strip()]
# Visão não tem linha para apagar: o que ela mostra vem das tabelas.
faltando = [t for t in escopos if t not in ordem_importacao and t not in VISOES]
if faltando:
    raise SystemExit(f"tabelas fora de ordem.txt: {', '.join(sorted(faltando))}. Rode gerar.py de novo.")
ordem_exclusao = [t for t in reversed(ordem_importacao) if escopos.get(t) == "propriedade"]

linhas += [
    "/**",
    " * A ordem de apagar o que é de uma fazenda: primeiro quem aponta, depois quem é apontado.",
    " *",
    " * No banco antigo bastava apagar a linha da fazenda. O MySQL confere as referências na",
    " * hora, e não no fim da operação, então apagar direto esbarra em `nascimentos`, que",
    " * aponta para `animais`. Por isso o servidor apaga na ordem.",
    " */",
    "export const ORDEM_DE_EXCLUSAO = [",
]
for t in ordem_exclusao:
    linhas.append(f'  "{t}",')
linhas += ["] as const;", ""]

SAIDA.parent.mkdir(parents=True, exist_ok=True)
SAIDA.write_text("\n".join(linhas), encoding="utf-8")
print(f"{len(ordem_exclusao)} tabelas na ordem de exclusão")
print(f"{len(escopos)} tabelas classificadas")
for e, ts in sorted(por_escopo.items()):
    print(f"  {e}: {len(ts)}")
print(f"gravado em {SAIDA}")

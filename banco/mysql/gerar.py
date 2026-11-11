"""Traduz o esquema do PostgreSQL (Supabase) para MySQL/MariaDB.

Lê os arquivos extraídos do banco atual e escreve o SQL de criação.
Regras importantes, e o porquê de cada uma:

* uuid vira CHAR(36): o MySQL não tem tipo uuid. Fica em texto, como já chega da aplicação.
* timestamptz vira DATETIME(3) e TUDO é gravado em UTC. O MySQL não guarda fuso junto;
  guardar em UTC e converter na hora de mostrar é o único jeito que não erra o dia.
* date NÃO ganha valor padrão. No PostgreSQL o padrão era "hoje no horário de Brasília";
  no MySQL o padrão seria o dia do servidor, que é UTC — depois das 21h daria amanhã.
  Quem preenche a data passa a ser o servidor da aplicação, que sabe o fuso certo.
* text vira VARCHAR(255) quando é nome/categoria/situação (precisa de índice e de padrão)
  e TEXT quando é texto livre. O MySQL não indexa TEXT sem recorte.
* boolean vira TINYINT(1); jsonb e listas viram JSON.
"""
import re
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent
SAIDA = BASE / "esquema.sql"

# Texto livre: sem limite de tamanho, nunca entra em índice.
TEXTO_LIVRE = {
    "obs", "observacao", "observacoes", "descricao", "mensagem", "detalhe", "orientacao",
    "biografia", "texto_apresentacao", "motivo", "pecas", "erro", "sinais", "resposta",
    "conservacao", "operadores", "lotes", "capacidade", "titulo", "avatar_url", "logo_url",
    "banner_url", "imagem_url", "website", "endereco", "agente",
}
# Texto muito grande (imagem em base64, configuração comprida).
TEXTO_ENORME = {("imagens_site", "valor"): "LONGTEXT", ("configuracoes_sistema", "valor"): "MEDIUMTEXT"}
# Esses têm limite declarado maior que 255 na verificação da tabela.
VARCHAR_MAIOR = {("ebooks", "descricao"): 2000, ("solicitacoes_exclusao", "motivo"): 1000,
                 ("suporte_contatos", "mensagem"): 4000, ("planos", "descricao"): 500}
# Chaves que apontam para o usuário. Viram ligação com a tabela usuarios (etapa 3).
COLUNAS_DE_USUARIO = {
    "user_id", "proprietario_id", "criado_por", "alterado_por", "atendida_por",
    "respondido_por", "removido_por", "atualizado_por",
}
# Contadores automáticos (eram bigint identity no PostgreSQL).
AUTO_INCREMENTO = {("ebook_acessos", "id"), ("registros_excluidos", "id"), ("eventos_seguranca", "id")}
# Colunas que entram em chave: ficam curtas para o índice caber com folga.
TAMANHOS = {
    ("animais", "numero_brinco"): 60, ("lotes", "nome"): 120, ("tipos_vacinas", "nome"): 120,
    ("configuracoes", "chave"): 120, ("configuracoes_sistema", "chave"): 120,
    ("imagens_site", "chave"): 60, ("chaves_sistema", "nome"): 60, ("rate_limits", "chave"): 180,
    ("importacoes", "tabela"): 60, ("suporte_mensagens", "mensagem_id"): 120,
    ("pagamentos", "mp_payment_id"): 60,
}
# Só estas tabelas listam por data; nas outras o índice de data seria peso sem uso.
COLUNAS_DE_LISTA = {"data", "entrada", "inicio", "vencimento", "emissao", "data_entrada", "criado_em", "janela"}

# Coluna calculada pelo próprio banco.
CALCULADAS = {("producao_leite", "valor_total"): "DECIMAL(12,2) AS (litros * valor_litro) STORED"}


# Tabelas de conta e entrada no site. Substituem o login do Supabase (etapa 3).
# Nenhum token é guardado inteiro: só o resumo (sha256). Quem rouba o banco não entra com ele.
TABELAS_DE_CONTA = """
CREATE TABLE `usuarios` (
  `id` CHAR(36) NOT NULL,
  `email` VARCHAR(180) NOT NULL,
  `senha_hash` VARCHAR(255) NULL,
  `email_confirmado_em` DATETIME(3) NULL,
  `bloqueado` TINYINT(1) NOT NULL DEFAULT 0,
  `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `ultimo_acesso` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `usuarios_email_uq` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `identidades` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `provedor` VARCHAR(40) NOT NULL,
  `provedor_id` VARCHAR(180) NOT NULL,
  `email` VARCHAR(180) NULL,
  `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `identidades_provedor_uq` (`provedor`,`provedor_id`),
  KEY `identidades_user_id_idx` (`user_id`),
  CONSTRAINT `identidades_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `sessoes` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `token_hash` CHAR(64) NOT NULL,
  `criada_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `ultimo_uso` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `expira_em` DATETIME(3) NOT NULL,
  `navegador` VARCHAR(512) NULL,
  `ip` VARCHAR(64) NULL,
  `aal` VARCHAR(10) NOT NULL DEFAULT 'aal1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `sessoes_token_uq` (`token_hash`),
  KEY `sessoes_user_id_idx` (`user_id`),
  KEY `sessoes_expira_idx` (`expira_em`),
  CONSTRAINT `sessoes_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `recuperacoes_senha` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `token_hash` CHAR(64) NOT NULL,
  `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `expira_em` DATETIME(3) NOT NULL,
  `usado_em` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `recuperacoes_token_uq` (`token_hash`),
  KEY `recuperacoes_user_id_idx` (`user_id`),
  CONSTRAINT `recuperacoes_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `fatores_2fa` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `tipo` VARCHAR(20) NOT NULL DEFAULT 'totp',
  `segredo_cifrado` TEXT NOT NULL,
  `confirmado_em` DATETIME(3) NULL,
  `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `fatores_user_id_idx` (`user_id`),
  CONSTRAINT `fatores_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
"""


def ler(nome):
    return (BASE / nome).read_text(encoding="utf-8").strip().split("\n")


enums = {}
for linha in ler("enums.txt"):
    nome, valores = linha.split("=", 1)
    enums[nome] = valores.split(",")

col_enum = {}
for linha in ler("colunas_enum.txt"):
    alvo, tipo = linha.split("=", 1)
    tabela, coluna = alvo.split(".")
    col_enum[(tabela, coluna)] = tipo

chaves = {}
for linha in ler("chaves.txt"):
    tabela, tipo, cols = linha.split(" ", 2)
    chaves.setdefault(tabela, []).append((tipo, cols.split(",")))

fks = []
for linha in ler("fks.txt"):
    origem, resto = linha.split(" -> ")
    destino, acao = resto.rsplit(" ", 1)
    t_o, c_o = origem.split(".")
    t_d, c_d = destino.split(".")
    fks.append((t_o, c_o, t_d, c_d, acao))

checks = {}
# O MySQL proíbe verificação numa coluna que, ao apagar o registro apontado, "perde a
# referência" (ON DELETE SET NULL). Essas poucas regras passam a ser conferidas pelo
# servidor, e ficam anotadas em regras-no-servidor.txt para não se perderem.
colunas_que_perdem_referencia = {(t_o, c_o) for t_o, c_o, _, _, acao in fks if acao == "SETNULL"}
movidas = []
for linha in ler("checks.txt"):
    tabela, nome, expr = linha.split(" ", 2)
    citadas = set(re.findall(r"\b[a-z_]+\b", expr))
    if any((tabela, c) in colunas_que_perdem_referencia for c in citadas):
        movidas.append(f"{tabela} {nome} {expr}")
        continue
    checks.setdefault(tabela, []).append((nome, expr))

tabelas = {}
for linha in ler("colunas.txt"):
    partes = linha.split("|")
    nome = partes[0]
    colunas = []
    for p in partes[1:]:
        campos = p.split(":")
        col, tipo, nulo = campos[0], campos[1], campos[2]
        padrao = campos[3] if len(campos) > 3 else ""
        gerada = next((c[7:] for c in campos if c.startswith("GERADA=")), None)
        colunas.append({"nome": col, "tipo": tipo, "nulo": nulo == "S", "padrao": padrao, "gerada": gerada})
    tabelas[nome] = colunas


def tipo_mysql(tabela, c):
    chave = (tabela, c["nome"])
    if chave in CALCULADAS:
        return CALCULADAS[chave]
    t = c["tipo"]
    if chave in col_enum:
        valores = ",".join("'" + v + "'" for v in enums[col_enum[chave]])
        return f"ENUM({valores})"
    if t == "uuid":
        return "CHAR(36)"
    if t == "date":
        return "DATE"
    if t.startswith("timestamp"):
        return "DATETIME(3)"
    if t == "boolean":
        return "TINYINT(1)"
    if t in ("jsonb", "json", "ARRAY"):
        return "JSON"
    if t == "bigint":
        return "BIGINT"
    if t == "integer":
        return "INT"
    if t == "smallint":
        return "SMALLINT"
    m = re.match(r"numeric\((\d+),(\d+)\)", t)
    if m:
        return f"DECIMAL({m.group(1)},{m.group(2)})"
    if t == "numeric":
        return "DECIMAL(18,6)"
    if t == "text":
        if chave in TEXTO_ENORME:
            return TEXTO_ENORME[chave]
        if chave in VARCHAR_MAIOR:
            return f"VARCHAR({VARCHAR_MAIOR[chave]})"
        if c["nome"] in TEXTO_LIVRE:
            return "TEXT"
        return f"VARCHAR({TAMANHOS.get(chave, 255)})"
    raise SystemExit(f"tipo sem tradução: {tabela}.{c['nome']} = {t}")


def padrao_mysql(tabela, c, tipo):
    p = (c["padrao"] or "").strip()
    chave = (tabela, c["nome"])
    if chave in CALCULADAS or chave in AUTO_INCREMENTO:
        return ""
    if not p or p.startswith("nextval(") or p.startswith("auth.uid()"):
        return ""
    if p in ("now()", "clock_timestamp()"):
        return " DEFAULT CURRENT_TIMESTAMP(3)"
    # Data do dia: fica por conta da aplicação, que sabe o fuso de Brasília.
    if "hoje_br()" in p or p == "CURRENT_DATE" or "interval" in p:
        return ""
    if p in ("true", "false"):
        return f" DEFAULT {1 if p == 'true' else 0}"
    if p.endswith("::jsonb") or p.endswith("[]"):
        valor = p.split("::")[0].strip("'")
        if valor.startswith("{") and valor.endswith("}") and not valor.startswith("{}"):
            itens = ",".join("'" + v + "'" for v in valor.strip("{}").split(","))
            return f" DEFAULT (JSON_ARRAY({itens}))" if tipo == "JSON" else ""
        return f" DEFAULT (JSON_OBJECT())" if valor == "{}" else f" DEFAULT (JSON_ARRAY())"
    texto = p.split("::")[0].strip()
    if texto.startswith("'") and texto.endswith("'"):
        return f" DEFAULT {texto}"
    if re.fullmatch(r"-?\d+(\.\d+)?", texto):
        return f" DEFAULT {texto}"
    return ""


def criar_tabela(nome, colunas):
    linhas = []
    for c in colunas:
        tipo = tipo_mysql(nome, c)
        chave = (nome, c["nome"])
        if chave in CALCULADAS:
            linhas.append(f"  `{c['nome']}` {tipo}")
            continue
        nulo = " NULL" if c["nulo"] else " NOT NULL"
        auto = " AUTO_INCREMENT" if chave in AUTO_INCREMENTO else ""
        linhas.append(f"  `{c['nome']}` {tipo}{nulo}{padrao_mysql(nome, c, tipo)}{auto}")
    for tipo, cols in chaves.get(nome, []):
        lista = ",".join(f"`{c}`" for c in cols)
        if tipo == "PK":
            linhas.append(f"  PRIMARY KEY ({lista})")
        else:
            linhas.append(f"  UNIQUE KEY `{nome}_{'_'.join(cols)}_uq` ({lista})")
    # Índices: coluna de ligação e o par propriedade + data, que é como as telas listam.
    indexados = {tuple(cols) for _, cols in chaves.get(nome, [])}
    primeiras = {cols[0] for _, cols in chaves.get(nome, [])}  # chave já começando por essa coluna serve de índice
    nomes_col = [c["nome"] for c in colunas]
    for t_o, c_o, _, _, _ in fks:
        if t_o == nome and (c_o,) not in indexados and c_o not in primeiras:
            indexados.add((c_o,))
            linhas.append(f"  KEY `{nome}_{c_o}_idx` (`{c_o}`)")
    if "propriedade_id" in nomes_col:
        data = next((c["nome"] for c in colunas if c["tipo"] == "date" and c["nome"] in COLUNAS_DE_LISTA), None)
        if data and ("propriedade_id", data) not in {(k[0], k[1]) for _, k in chaves.get(nome, []) if len(k) > 1}:
            linhas.append(f"  KEY `{nome}_prop_data_idx` (`propriedade_id`,`{data}` DESC)")
    for nome_check, expr in checks.get(nome, []):
        linhas.append(f"  CONSTRAINT `{nome_check}` CHECK ({expr})")
    corpo = ",\n".join(linhas)
    return f"CREATE TABLE `{nome}` (\n{corpo}\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;"


# Ordem: quem é apontado vem antes de quem aponta.
dependencias = {t: {d for o, _, d, _, _ in fks if o == t and d != t} for t in tabelas}
ordem, pendentes = [], dict(tabelas)
while pendentes:
    avancou = False
    for t in list(pendentes):
        if dependencias.get(t, set()) <= set(ordem) | {"usuarios"}:
            ordem.append(t)
            del pendentes[t]
            avancou = True
    if not avancou:
        print("ciclo entre:", sorted(pendentes), file=sys.stderr)
        ordem += list(pendentes)
        break

partes = [
    "-- Esquema do Pecuária Digital em MySQL/MariaDB.",
    "-- Gerado a partir do banco PostgreSQL atual por gerar.py. Não edite à mão.",
    "--",
    "-- Datas e horas são gravadas SEMPRE em UTC. Quem converte para o horário de Brasília",
    "-- é o servidor da aplicação; o MySQL não guarda fuso junto com a hora.",
    "",
    "SET NAMES utf8mb4;",
    "SET FOREIGN_KEY_CHECKS = 0;",
    "",
    TABELAS_DE_CONTA.strip(),
    "",
]
for t in ordem:
    partes.append(criar_tabela(t, tabelas[t]))
    partes.append("")

partes.append("-- Ligações entre tabelas, depois que todas existem.")
partes.append("ALTER TABLE `profiles` ADD CONSTRAINT `profiles_id_fk` FOREIGN KEY (`id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE;")
for t_o, c_o, t_d, c_d, acao in fks:
    regra = {"CASCADE": "CASCADE", "SETNULL": "SET NULL", "RESTRICT": "RESTRICT", "NOACTION": "NO ACTION"}[acao]
    partes.append(
        f"ALTER TABLE `{t_o}` ADD CONSTRAINT `{t_o}_{c_o}_fk` FOREIGN KEY (`{c_o}`) "
        f"REFERENCES `{t_d}` (`{c_d}`) ON DELETE {regra};"
    )
partes += ["", "SET FOREIGN_KEY_CHECKS = 1;", ""]

SAIDA.write_text("\n".join(partes), encoding="utf-8")
# A ordem de dependência serve também para a migração dos dados.
(BASE / "ordem.txt").write_text("\n".join(ordem) + "\n", encoding="utf-8")
(BASE / "regras-no-servidor.txt").write_text(
    "# Regras que o MySQL não aceita guardar e que o servidor precisa conferir ao gravar.\n"
    + "\n".join(movidas) + "\n", encoding="utf-8")
print(f"{len(ordem)} tabelas, {len(fks)} ligações, {sum(len(v) for v in checks.values())} verificações no banco, "
      f"{len(movidas)} regra(s) que passam para o servidor")
print(f"gravado em {SAIDA}")

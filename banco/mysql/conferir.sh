#!/usr/bin/env bash
# Confere o esquema MySQL contra um banco de verdade.
# Uso: conferir.sh (lê MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE)
set -euo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOST="${MYSQL_HOST:-127.0.0.1}"
PORTA="${MYSQL_PORT:-3306}"
USUARIO="${MYSQL_USER:-root}"
SENHA="${MYSQL_PASSWORD:-senha}"
BANCO="${MYSQL_DATABASE:-pecuaria}"

sql() { mysql --protocol=TCP -h "$HOST" -P "$PORTA" -u "$USUARIO" -p"$SENHA" -D "$BANCO" -N -B -e "$1"; }
falhas=0
conferir() { # conferir "nome" "esperado" "obtido"
  if [ "$2" = "$3" ]; then printf '  ok   %s: %s\n' "$1" "$3"
  else printf '  FALHA %s: esperado %s, veio %s\n' "$1" "$2" "$3"; falhas=$((falhas + 1)); fi
}
recusa() { # recusa "nome" "sql que tem de falhar"
  if sql "$2" >/dev/null 2>&1; then printf '  FALHA %s: o banco aceitou e não devia\n' "$1"; falhas=$((falhas + 1))
  else printf '  ok   %s: recusado, como esperado\n' "$1"; fi
}

echo "== Criando o esquema =="
mysql --protocol=TCP -h "$HOST" -P "$PORTA" -u "$USUARIO" -p"$SENHA" -D "$BANCO" < "$AQUI/esquema.sql"
echo "   esquema aplicado sem erro"

echo "== Estrutura =="
esperadas=$(grep -c '^CREATE TABLE' "$AQUI/esquema.sql")
conferir "tabelas criadas" "$esperadas" "$(sql "select count(*) from information_schema.tables where table_schema='$BANCO' and table_type='BASE TABLE'")"
# as tabelas de conta já nascem com as ligações dentro do CREATE TABLE
conferir "tabelas fora do InnoDB ou do utf8mb4" "0" "$(sql "select count(*) from information_schema.tables where table_schema='$BANCO' and table_type='BASE TABLE' and (engine<>'InnoDB' or table_collation not like 'utf8mb4%')")"
conferir "tabelas sem chave primária" "0" "$(sql "select count(*) from information_schema.tables t where t.table_schema='$BANCO' and t.table_type='BASE TABLE' and not exists (select 1 from information_schema.table_constraints c where c.table_schema=t.table_schema and c.table_name=t.table_name and c.constraint_type='PRIMARY KEY')")"

echo "== Gravando e lendo =="
sql "insert into usuarios (id,email,senha_hash,email_confirmado_em) values ('11111111-1111-4111-8111-111111111111','teste@exemplo.com','\$2b\$10\$abcdefghijklmnopqrstuv',now(3));
     insert into propriedades (id,proprietario_id,nome,cidade,estado) values ('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','Fazenda Boa Vista','Patos de Minas','MG');
     insert into lotes (id,propriedade_id,nome) values ('33333333-3333-4333-8333-333333333333','22222222-2222-4222-8222-222222222222','Lactantes');
     insert into animais (id,propriedade_id,lote_id,numero_brinco,nome,sexo,situacao,data_nascimento) values ('44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','1124','Jóia da Ribeira — ação','F','ativo','2024-03-10');"
conferir "animal gravado" "1" "$(sql "select count(*) from animais")"
conferir "acentuação preservada" "Jóia da Ribeira — ação" "$(sql "select nome from animais")"

echo "== Coluna calculada pelo banco =="
sql "insert into producao_leite (id,propriedade_id,animal_id,data,litros,valor_litro) values ('55555555-5555-4555-8555-555555555555','22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444444','2026-11-10',18.5,2.40);"
conferir "valor total calculado" "44.40" "$(sql "select valor_total from producao_leite")"

echo "== O banco recusa dado inválido =="
recusa "sexo fora da lista" "insert into animais (id,propriedade_id,numero_brinco,sexo,situacao) values (uuid(),'22222222-2222-4222-8222-222222222222','9001','X','ativo')"
recusa "brinco repetido na mesma propriedade" "insert into animais (id,propriedade_id,numero_brinco,sexo,situacao) values (uuid(),'22222222-2222-4222-8222-222222222222','1124','M','ativo')"
recusa "peso de pesagem zero" "insert into pesagens (id,propriedade_id,animal_id,data,peso_kg) values (uuid(),'22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444444','2026-11-10',0)"
recusa "propriedade que não existe" "insert into lotes (id,propriedade_id,nome) values (uuid(),'99999999-9999-4999-8999-999999999999','Fantasma')"
recusa "vacinação sem animal e sem lote" "insert into vacinacoes (id,propriedade_id,tipo_vacina_id,data_aplicacao) values (uuid(),'22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444444','2026-11-10')"
recusa "temperatura impossível no clima" "insert into clima_obs (id,propriedade_id,data,temp_max) values (uuid(),'22222222-2222-4222-8222-222222222222','2026-11-10',900)"
recusa "parto previsto antes da inseminação" "insert into inseminacoes (id,propriedade_id,animal_id,data_inseminacao,reprodutor_semen,previsao_parto,situacao) values (uuid(),'22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444444','2026-11-10','Touro','2026-11-01','em_andamento')"

echo "== Regras que o MySQL não guarda e o servidor precisa conferir =="
# O MySQL proíbe verificação em coluna que perde a referência ao apagar o apontado.
# Aqui só se confere que a lista dessas regras existe; quem as aplica é o servidor.
pendentes=$(grep -vc '^#' "$AQUI/regras-no-servidor.txt" || true)
conferir "regras anotadas para o servidor" "2" "$pendentes"

echo "== Apagar a propriedade leva junto o que é dela =="
sql "delete from propriedades where id='22222222-2222-4222-8222-222222222222';"
conferir "animais da propriedade apagada" "0" "$(sql "select count(*) from animais")"
conferir "leite da propriedade apagada" "0" "$(sql "select count(*) from producao_leite")"
conferir "usuário continua" "1" "$(sql "select count(*) from usuarios")"

echo "== Apagar o usuário leva a conta junto =="
sql "insert into profiles (id,nome_completo) values ('11111111-1111-4111-8111-111111111111','Teste');
     delete from usuarios where id='11111111-1111-4111-8111-111111111111';"
conferir "perfil do usuário apagado" "0" "$(sql "select count(*) from profiles")"

echo "== Migração dos dados: do banco antigo para o novo =="
sql "drop database if exists ${BANCO}_migrado; create database ${BANCO}_migrado character set utf8mb4 collate utf8mb4_unicode_ci;"
mysql --protocol=TCP -h "$HOST" -P "$PORTA" -u "$USUARIO" -p"$SENHA" -D "${BANCO}_migrado" < "$AQUI/esquema.sql"
node "$AQUI/supabase-de-mentira.mjs" 54330 >/dev/null 2>&1 &
mentira=$!
sleep 2
rm -rf "$AQUI/dados-teste"
SUPABASE_URL=http://127.0.0.1:54330 SUPABASE_SERVICE_ROLE_KEY=teste   node "$AQUI/migrar.mjs" --saida="$AQUI/dados-teste" >/dev/null
kill $mentira 2>/dev/null || true
# O usuário vem do outro arquivo (as contas saem do login antigo), então entra antes.
mysql --protocol=TCP -h "$HOST" -P "$PORTA" -u "$USUARIO" -p"$SENHA" -D "${BANCO}_migrado"   -e "insert into usuarios (id,email,email_confirmado_em) values ('11111111-1111-4111-8111-111111111111','dona.nair@exemplo.com',now(3));"
for f in "$AQUI"/dados-teste/dados-*.sql; do
  mysql --protocol=TCP -h "$HOST" -P "$PORTA" -u "$USUARIO" -p"$SENHA" -D "${BANCO}_migrado" < "$f"
done
sqlm() { mysql --protocol=TCP -h "$HOST" -P "$PORTA" -u "$USUARIO" -p"$SENHA" -D "${BANCO}_migrado" -N -B -e "$1"; }
conferir "animal migrado" "1" "$(sqlm "select count(*) from animais")"
conferir "acento e travessão" "Jóia da Ribeira — ação" "$(sqlm "select nome from animais")"
conferir "aspas e barra no texto" "Aspas 'simples', barra \\ e quebra" "$(sqlm "select substring_index(observacoes, char(10), 1) from animais")"
# 10/11 às 21h30 em Brasília é 11/11 às 00h30 em UTC: é onde a migração costuma errar o dia.
conferir "hora convertida para UTC" "2026-11-11 00:30:00.000" "$(sqlm "select created_at from animais")"
conferir "data continua a mesma" "2026-11-10" "$(sqlm "select data from producao_leite")"
conferir "sim/não virou 1" "1" "$(sqlm "select ativo from lotes")"
conferir "valor do leite recalculado pelo banco" "44.40" "$(sqlm "select valor_total from producao_leite")"
conferir "preferências em JSON" "escuro" "$(sqlm "select json_unquote(json_extract(preferencias,'\$.tema')) from profiles")"
conferir "marcas de exclusão: só as recentes" "2" "$(sqlm "select count(*) from registros_excluidos")"
conferir "campo vazio continua vazio" "NULL" "$(sqlm "select ifnull(descricao,'NULL') from lotes")"
rm -rf "$AQUI/dados-teste"

echo
if [ "$falhas" -gt 0 ]; then echo "$falhas conferência(s) falharam."; exit 1; fi
echo "Todas as conferências passaram."

/*
 * Prova, contra um MySQL de verdade e usando o código que vai para produção, que uma
 * fazenda não enxerga a outra.
 *
 * Esta é a conferência mais importante da migração: no banco antigo quem garantia isso era
 * o próprio PostgreSQL. Aqui quem garante é o nosso código, então ele precisa ser testado
 * de ponta a ponta, e não só nas peças soltas.
 *
 * Roda com: bun banco/mysql/conferir-separacao.ts
 */
import { usarPool, consultar, executar } from "../../src/lib/dados/banco.server";
import { listar, obter, criar, atualizar, apagar } from "../../src/lib/dados/repositorio.server";
import { AcessoNegado, type Quem } from "../../src/lib/dados/acesso";
import { rodarConsulta } from "../../src/lib/dados/consultas.server";
import mysql from "mysql2/promise";

const NAIR = "11111111-1111-4111-8111-111111111111";
const JOAO = "22222222-2222-4222-8222-222222222222";
const FAZENDA_NAIR = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const FAZENDA_JOAO = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const dona: Quem = { userId: NAIR, admin: false, propriedades: [FAZENDA_NAIR] };
const vizinho: Quem = { userId: JOAO, admin: false, propriedades: [FAZENDA_JOAO] };
const recemChegado: Quem = { userId: JOAO, admin: false, propriedades: [] };
const chefe: Quem = { userId: NAIR, admin: true, propriedades: [FAZENDA_NAIR] };

let falhas = 0;
function conferir(nome: string, esperado: unknown, obtido: unknown) {
  const ok = JSON.stringify(esperado) === JSON.stringify(obtido);
  if (!ok) falhas++;
  console.log(`  ${ok ? "ok  " : "FALHA"} ${nome}: ${ok ? JSON.stringify(obtido) : `esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(obtido)}`}`);
}
async function recusa(nome: string, tarefa: () => Promise<unknown>) {
  try {
    await tarefa();
    falhas++;
    console.log(`  FALHA ${nome}: passou e não devia`);
  } catch (erro) {
    const esperado = erro instanceof AcessoNegado;
    if (!esperado) falhas++;
    console.log(`  ${esperado ? "ok  " : "FALHA"} ${nome}: ${(erro as Error).name} — ${(erro as Error).message}`);
  }
}

usarPool(mysql.createPool({
  host: process.env["MYSQL_HOST"] ?? "127.0.0.1",
  port: Number(process.env["MYSQL_PORT"] ?? 3306),
  user: process.env["MYSQL_USER"] ?? "root",
  password: process.env["MYSQL_PASSWORD"] ?? "senha",
  database: process.env["MYSQL_DATABASE"] ?? "pecuaria_separacao",
  timezone: "Z",
  dateStrings: ["DATE"] as never,
  connectionLimit: 4,
  multipleStatements: false,
}));

console.log("== Preparando duas fazendas de donos diferentes ==");
for (const [id, email] of [[NAIR, "nair@exemplo.com"], [JOAO, "joao@exemplo.com"]]) {
  await executar("INSERT INTO usuarios (id, email, email_confirmado_em) VALUES (?, ?, NOW(3))", [id, email]);
}
for (const [id, dono, nome] of [[FAZENDA_NAIR, NAIR, "Fazenda Boa Vista"], [FAZENDA_JOAO, JOAO, "Sítio do Vizinho"]]) {
  await executar("INSERT INTO propriedades (id, proprietario_id, nome) VALUES (?, ?, ?)", [id, dono, nome]);
}

console.log("== Cada uma grava na sua ==");
const animalDaNair = await criar(dona, "animais", { propriedade_id: FAZENDA_NAIR, numero_brinco: "1124", nome: "Jóia", sexo: "F", situacao: "ativo" });
const animalDoJoao = await criar(vizinho, "animais", { propriedade_id: FAZENDA_JOAO, numero_brinco: "2200", nome: "Mimosa", sexo: "F", situacao: "ativo" });
conferir("animal da Nair criado", true, animalDaNair.length === 36);
conferir("animal do João criado", true, animalDoJoao.length === 36);

console.log("== E só enxerga a sua ==");
const listaNair = await listar<{ nome: string }>(dona, { tabela: "animais" });
conferir("a Nair vê 1 animal", 1, listaNair.total);
conferir("e é o dela", "Jóia", listaNair.linhas[0]?.nome);
const listaJoao = await listar<{ nome: string }>(vizinho, { tabela: "animais" });
conferir("o João vê 1 animal", 1, listaJoao.total);
conferir("e é o dele", "Mimosa", listaJoao.linhas[0]?.nome);
conferir("quem não tem fazenda não vê nada", 0, (await listar(recemChegado, { tabela: "animais" })).total);
conferir("o administrador também não vê a fazenda alheia", 1, (await listar(chefe, { tabela: "animais" })).total);

console.log("== Pedir pelo identificador do animal alheio não adianta ==");
conferir("buscar o animal do vizinho pelo id", null, await obter(dona, "animais", animalDoJoao));
await recusa("alterar o animal do vizinho", () => atualizar(dona, "animais", animalDoJoao, { nome: "Roubada" }));
await recusa("apagar o animal do vizinho", () => apagar(dona, "animais", animalDoJoao));
await recusa("criar animal na fazenda do vizinho", () => criar(dona, "animais", { propriedade_id: FAZENDA_JOAO, numero_brinco: "9", sexo: "F", situacao: "ativo" }));
conferir("o animal do vizinho continua com o nome dele", "Mimosa", (await obter<{ nome: string }>(vizinho, "animais", animalDoJoao))?.nome);

console.log("== Mudar a fazenda de um registro pela porta dos fundos ==");
await atualizar(dona, "animais", animalDaNair, { propriedade_id: FAZENDA_JOAO, nome: "Jóia II" });
conferir("a fazenda do registro não mudou", 1, (await listar(dona, { tabela: "animais" })).total);
conferir("mas o nome mudou", "Jóia II", (await obter<{ nome: string }>(dona, "animais", animalDaNair))?.nome);

console.log("== Texto de busca e nome de campo não viram comando ==");
const busca = await listar(dona, { tabela: "animais", texto: { termo: "' OR 1=1 --", colunas: ["nome"] } });
conferir("busca com aspas e comentário não abre o banco", 0, busca.total);
const curinga = await listar(dona, { tabela: "animais", texto: { termo: "%", colunas: ["nome"] } });
conferir("o curinga % é procurado como texto", 0, curinga.total);
await recusa("ordenar por campo inventado", () => listar(dona, { tabela: "animais", ordem: [{ coluna: "nome; DROP TABLE animais" }] }));
await recusa("filtrar por campo inventado", () => listar(dona, { tabela: "animais", filtros: [{ coluna: "1=1", op: "=", valor: 1 }] }));
await recusa("ler tabela que não existe", () => listar(dona, { tabela: "animais; DROP TABLE animais" }));
await recusa("ler a tabela de chaves", () => listar(chefe, { tabela: "chaves_sistema" }));
conferir("a tabela de animais continua de pé", 2, Number((await consultar<{ n: number }>("SELECT COUNT(*) AS n FROM animais"))[0]?.n));

console.log("== Campo que não é da tabela é descartado, não gravado ==");
const comLixo = await criar(dona, "animais", { propriedade_id: FAZENDA_NAIR, numero_brinco: "1200", sexo: "M", situacao: "ativo", campo_inventado: "x", admin: true });
conferir("gravou mesmo assim, sem o campo inventado", true, comLixo.length === 36);

console.log("== Data e hora voltam como foram gravadas ==");
await criar(dona, "producao_leite", { propriedade_id: FAZENDA_NAIR, animal_id: animalDaNair, data: "2026-11-10", litros: 18.5, valor_litro: 2.4 });
const leite = (await listar<{ data: string; valor_total: string; created_at: Date }>(dona, { tabela: "producao_leite" })).linhas[0]!;
conferir("a data continua 10/11, sem andar um dia", "2026-11-10", String(leite.data).slice(0, 10));
conferir("o banco calculou o valor", "44.40", String(leite.valor_total));
conferir("o instante volta em UTC", true, leite.created_at instanceof Date && Math.abs(Date.now() - leite.created_at.getTime()) < 120_000);

console.log("== Consultas prontas respeitam a mesma separação ==");
const resumo = await rodarConsulta("dashboard_resumo", dona, { propriedade_id: FAZENDA_NAIR }) as { animais_ativos: number };
conferir("o resumo da Nair conta só os animais dela", 2, resumo.animais_ativos);
await recusa("pedir o resumo da fazenda do vizinho", () => rodarConsulta("dashboard_resumo", dona, { propriedade_id: FAZENDA_JOAO }));
await recusa("pedir o resumo sem dizer a fazenda", () => rodarConsulta("dashboard_resumo", dona, {}));
await recusa("chamar consulta de administrador sem ser", () => rodarConsulta("admin_suporte", dona, {}));
await recusa("chamar consulta que não existe", () => rodarConsulta("apagar_tudo", chefe, {}));
conferir("quem é administrador sai do banco, não do pedido", false, await rodarConsulta("sou_admin", dona, { admin: true }));

console.log("== Apagar a fazenda leva junto o que é dela, e só dela ==");
await executar("DELETE FROM propriedades WHERE id = ?", [FAZENDA_NAIR]);
conferir("a Nair ficou sem animais", 0, (await listar(dona, { tabela: "animais" })).total);
conferir("o João continua com o dele", 1, (await listar(vizinho, { tabela: "animais" })).total);

console.log();
if (falhas > 0) {
  console.log(`${falhas} conferência(s) falharam.`);
  process.exit(1);
}
console.log("A separação entre fazendas está de pé.");
process.exit(0);

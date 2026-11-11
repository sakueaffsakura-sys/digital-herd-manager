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
import { dataNoFuso, somarDias } from "../../src/lib/datas";
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

console.log("== Vacina: só a última dose cobra algo ==");
const hoje = dataNoFuso();
const VACINA_NAIR = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
await executar("INSERT INTO tipos_vacinas (id, propriedade_id, nome, intervalo_dias) VALUES (?, ?, 'Aftosa', 180)", [VACINA_NAIR, FAZENDA_NAIR]);
// A Jóia tomou a dose antiga (venceu) e depois o reforço (vence ano que vem): não deve cobrar nada.
await executar(
  `INSERT INTO vacinacoes (id, propriedade_id, animal_id, tipo_vacina_id, data_aplicacao, proxima_aplicacao)
   VALUES (UUID(), ?, ?, ?, ?, ?)`,
  [FAZENDA_NAIR, animalDaNair, VACINA_NAIR, somarDias(hoje, -400), somarDias(hoje, -200)],
);
await executar(
  `INSERT INTO vacinacoes (id, propriedade_id, animal_id, tipo_vacina_id, data_aplicacao, proxima_aplicacao)
   VALUES (UUID(), ?, ?, ?, ?, ?)`,
  [FAZENDA_NAIR, animalDaNair, VACINA_NAIR, somarDias(hoje, -30), somarDias(hoje, 150)],
);
const resumoVacina = await rodarConsulta("dashboard_resumo", dona, { propriedade_id: FAZENDA_NAIR }) as Record<string, number>;
conferir("dose antiga com reforço depois não conta como atrasada", 0, resumoVacina["vacinas_vencidas"]);
// O outro animal tomou uma dose só, e ela venceu.
await executar(
  `INSERT INTO vacinacoes (id, propriedade_id, animal_id, tipo_vacina_id, data_aplicacao, proxima_aplicacao)
   VALUES (UUID(), ?, ?, ?, ?, ?)`,
  [FAZENDA_NAIR, comLixo, VACINA_NAIR, somarDias(hoje, -300), somarDias(hoje, -10)],
);
const resumoVacina2 = await rodarConsulta("dashboard_resumo", dona, { propriedade_id: FAZENDA_NAIR }) as Record<string, number>;
conferir("dose única vencida conta uma vez", 1, resumoVacina2["vacinas_vencidas"]);

console.log("== Os números do Início têm as chaves que as telas leem ==");
// O leite é medido pela diferença: já existe um lançamento de outra conferência, e a data
// dele cai perto de hoje quando esta conferência roda em novembro de 2026.
const antes = await rodarConsulta("dashboard_resumo", dona, { propriedade_id: FAZENDA_NAIR }) as Record<string, number>;
await executar("INSERT INTO producao_leite (id, propriedade_id, animal_id, data, litros) VALUES (UUID(), ?, ?, ?, 30)", [FAZENDA_NAIR, animalDaNair, hoje]);
await executar("INSERT INTO producao_leite (id, propriedade_id, animal_id, data, litros) VALUES (UUID(), ?, ?, ?, 25)", [FAZENDA_NAIR, animalDaNair, somarDias(hoje, -1)]);
const inicio = await rodarConsulta("dashboard_resumo", dona, { propriedade_id: FAZENDA_NAIR }) as Record<string, number>;
const faltando = ["total_animais", "animais_ativos", "bezerros", "vacinacoes_em_dia", "inseminacoes", "nascidos_mes",
  "perdas_mes", "vendas_mes", "compras_mes", "receitas_mes", "despesas_mes", "investimentos_mes", "leite_mes",
  "total_lotes", "leite_hoje", "leite_ontem", "vacinas_vencidas", "partos_30d"].filter((k) => !(k in inicio));
conferir("não falta nenhuma das 18 chaves do Início", [], faltando);
conferir("o leite de hoje entrou em leite_hoje", 30, inicio["leite_hoje"]! - antes["leite_hoje"]!);
conferir("e o de ontem em leite_ontem", 25, inicio["leite_ontem"]! - antes["leite_ontem"]!);
// No dia 1º, "ontem" é do mês passado e não entra na soma do mês.
conferir("o mês soma o que é do mês", hoje.endsWith("-01") ? 30 : 55, inicio["leite_mes"]! - antes["leite_mes"]!);

console.log("== Central de avisos ==");
type AvisoLido = { chave: string; nivel: string; secao: string; titulo: string; texto: string };
await criar(dona, "tarefas", { propriedade_id: FAZENDA_NAIR, titulo: "Consertar a cerca", tipo: "Geral", data: somarDias(hoje, -5), prioridade: "Normal", status: "Pendente" });
const avisos = await rodarConsulta("central_avisos", dona, { propriedade_id: FAZENDA_NAIR }) as AvisoLido[];
const chaves = avisos.map((a) => a.chave.split(":")[0]);
conferir("a vacina atrasada vem antes da tarefa atrasada", true, chaves.indexOf("vacinas_atrasadas") === 0 && chaves.includes("tarefa_atrasada"));
conferir("a chave da vacina leva a quantidade e a data", true, /^vacinas_atrasadas:1:\d{4}-\d{2}-\d{2}$/.test(avisos[0]?.chave ?? ""));
conferir("o aviso da vacina é alerta e aponta a seção", "alerta/vacinacao", `${avisos[0]?.nivel}/${avisos[0]?.secao}`);
const tarefaAtrasada = avisos.find((a) => a.chave.startsWith("tarefa_atrasada"))!;
conferir("o texto da tarefa diz o dia em DD/MM", true, tarefaAtrasada.texto.includes(`${somarDias(hoje, -5).slice(8, 10)}/${somarDias(hoje, -5).slice(5, 7)}`));
conferir("o vizinho não recebe os avisos da fazenda alheia", 0, (await rodarConsulta("central_avisos", vizinho, { propriedade_id: FAZENDA_JOAO }) as AvisoLido[]).length);
await recusa("pedir os avisos da fazenda do vizinho", () => rodarConsulta("central_avisos", dona, { propriedade_id: FAZENDA_JOAO }));

console.log("== Dispensar um aviso esconde aquela situação, e só ela ==");
await executar(
  "INSERT INTO notificacoes (id, user_id, propriedade_id, titulo, mensagem, lida, chave) VALUES (UUID(), ?, ?, ?, ?, 1, ?)",
  [NAIR, FAZENDA_NAIR, avisos[0]!.titulo, avisos[0]!.texto, avisos[0]!.chave],
);
const depois = await rodarConsulta("central_avisos", dona, { propriedade_id: FAZENDA_NAIR }) as AvisoLido[];
conferir("o aviso dispensado saiu", false, depois.some((a) => a.chave === avisos[0]!.chave));
conferir("os outros continuam", true, depois.some((a) => a.chave.startsWith("tarefa_atrasada")));

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

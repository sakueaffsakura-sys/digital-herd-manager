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
import { trocarSenhaComLink } from "../../src/lib/conta/recuperacao.server";
import { conferirSenha } from "../../src/lib/conta/senha";
import { createHash } from "node:crypto";
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

/** Como `recusa`, mas para o que falha por outro motivo que não acesso: link, senha. */
async function recusaQualquer(nome: string, tarefa: () => Promise<unknown>) {
  try {
    await tarefa();
    falhas++;
    console.log(`  FALHA ${nome}: passou e não devia`);
  } catch (erro) {
    console.log(`  ok   ${nome}: ${(erro as Error).message}`);
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

console.log("== Agenda ==");
type AgendaLida = {
  eventos: { data: string; tipo: string; registro_id: string; titulo: string; detalhe: string | null; brinco: string | null }[];
  truncado: boolean;
  atrasadas: { data: string; titulo: string }[];
  sem_pesagem: unknown[];
  hoje: string;
};
// Um parto previsto para depois de amanhã e uma vacina a vencer na semana.
await executar(
  `INSERT INTO inseminacoes (id, propriedade_id, animal_id, data_inseminacao, reprodutor_semen, previsao_parto, situacao)
   VALUES (UUID(), ?, ?, ?, 'Touro Jaguar', ?, 'confirmada')`,
  [FAZENDA_NAIR, animalDaNair, somarDias(hoje, -280), somarDias(hoje, 2)],
);
await executar(
  `INSERT INTO vacinacoes (id, propriedade_id, animal_id, tipo_vacina_id, data_aplicacao, proxima_aplicacao)
   VALUES (UUID(), ?, ?, ?, ?, ?)`,
  [FAZENDA_NAIR, animalDaNair, VACINA_NAIR, somarDias(hoje, -20), somarDias(hoje, 3)],
);
const agenda = await rodarConsulta("agenda_periodo", dona, { propriedade_id: FAZENDA_NAIR, de: hoje, ate: somarDias(hoje, 7) }) as AgendaLida;
conferir("o parto está na agenda", true, agenda.eventos.some((e) => e.tipo === "parto" && e.data === somarDias(hoje, 2)));
conferir("a vacina a vencer está na agenda", true, agenda.eventos.some((e) => e.tipo === "vacina" && e.titulo === "Aftosa" && e.data === somarDias(hoje, 3)));
conferir("o reforço mais novo é que conta, não o antigo", 1, agenda.eventos.filter((e) => e.tipo === "vacina").length);
conferir("a agenda vem em ordem de dia", true, agenda.eventos.every((e, i) => i === 0 || agenda.eventos[i - 1]!.data <= e.data));
conferir("a vacina já vencida vem na lista de atrasadas", 1, agenda.atrasadas.length);
conferir("nada foi cortado", false, agenda.truncado);
conferir("o hoje da agenda é o de Brasília", hoje, agenda.hoje);
// A tarefa criada na conferência anterior era para cinco dias atrás: fica de fora da
// semana que começa hoje, e aparece quando o período alcança a data dela.
conferir("a tarefa de dias atrás não entra na semana que vem", false, agenda.eventos.some((e) => e.tipo === "tarefa"));
const agendaLarga = await rodarConsulta("agenda_periodo", dona, { propriedade_id: FAZENDA_NAIR, de: somarDias(hoje, -10), ate: somarDias(hoje, 7) }) as AgendaLida;
conferir("e aparece quando o período alcança o dia dela", true, agendaLarga.eventos.some((e) => e.tipo === "tarefa" && e.titulo === "Consertar a cerca"));
conferir("o vizinho vê a agenda vazia da fazenda dele", 0, (await rodarConsulta("agenda_periodo", vizinho, { propriedade_id: FAZENDA_JOAO, de: hoje, ate: somarDias(hoje, 7) }) as AgendaLida).eventos.length);
await recusa("pedir a agenda da fazenda do vizinho", () => rodarConsulta("agenda_periodo", dona, { propriedade_id: FAZENDA_JOAO, de: hoje, ate: somarDias(hoje, 7) }));
await recusa("pedir um período de trás para frente", () => rodarConsulta("agenda_periodo", dona, { propriedade_id: FAZENDA_NAIR, de: somarDias(hoje, 7), ate: hoje }));
await recusa("pedir um período de dois anos", () => rodarConsulta("agenda_periodo", dona, { propriedade_id: FAZENDA_NAIR, de: hoje, ate: somarDias(hoje, 800) }));
await recusa("pedir um período com data inventada", () => rodarConsulta("agenda_periodo", dona, { propriedade_id: FAZENDA_NAIR, de: "2026-02-31", ate: hoje }));

console.log("== Indicadores: número sem base é travessão, não zero ==");
type Ind = { hoje: string; reproducao: Record<string, number | null>; peso: Record<string, number | null>;
  leite: Record<string, number | null>; dinheiro: Record<string, number | null>; rebanho: Record<string, number | null> };
// A fazenda do João tem um animal e mais nada: quase tudo não tem base para ser calculado.
const vazio = await rodarConsulta("indicadores_propriedade", vizinho, { propriedade_id: FAZENDA_JOAO }) as Ind;
conferir("sem pesagem, o ganho é nulo e não zero", null, vazio.peso["ganho_kg_dia"]);
conferir("sem pesagem, o peso médio é nulo", null, vazio.peso["peso_medio_kg"]);
conferir("sem inseminação, a taxa de prenhez é nula", null, vazio.reproducao["taxa_prenhez"]);
conferir("sem parto, o intervalo entre partos é nulo", null, vazio.reproducao["intervalo_partos_dias"]);
conferir("sem leite, os litros por dia são nulos", null, vazio.leite["litros_dia"]);
conferir("mas o rebanho dele existe", 1, vazio.rebanho["ativos"]);
conferir("e sem morte a mortalidade é zero de verdade", 0, vazio.rebanho["taxa_mortalidade"]);

console.log("== Indicadores: as contas ==");
const PESADO = await criar(dona, "animais", { propriedade_id: FAZENDA_NAIR, numero_brinco: "3000", nome: "Garoto", sexo: "M", situacao: "ativo", data_nascimento: somarDias(hoje, -300) });
const CURTO = await criar(dona, "animais", { propriedade_id: FAZENDA_NAIR, numero_brinco: "3001", nome: "Pressa", sexo: "M", situacao: "ativo", data_nascimento: somarDias(hoje, -200) });
const pesar = (animal: string, quandoAtras: number, kg: number) =>
  executar("INSERT INTO pesagens (id, propriedade_id, animal_id, data, peso_kg) VALUES (UUID(), ?, ?, ?, ?)", [FAZENDA_NAIR, animal, somarDias(hoje, -quandoAtras), kg]);
await pesar(PESADO, 60, 100);
await pesar(PESADO, 10, 130); // 30 kg em 50 dias = 0,6 kg/dia
await pesar(CURTO, 15, 200);
await pesar(CURTO, 5, 260);   // 10 dias de intervalo: curto demais para virar média
const ind = await rodarConsulta("indicadores_propriedade", dona, { propriedade_id: FAZENDA_NAIR }) as Ind;
conferir("o ganho por dia sai da primeira à última pesagem", 0.6, ind.peso["ganho_kg_dia"]);
conferir("só o animal com 20 dias ou mais entre pesagens entra na média", 1, ind.peso["animais_pesados"]);
conferir("o peso médio usa a pesagem mais recente de cada animal", 195, ind.peso["peso_medio_kg"]);

await executar(
  `INSERT INTO inseminacoes (id, propriedade_id, animal_id, data_inseminacao, reprodutor_semen, previsao_parto, situacao)
   VALUES (UUID(), ?, ?, ?, 'Touro Jaguar', ?, 'falhou')`,
  [FAZENDA_NAIR, animalDaNair, somarDias(hoje, -60), somarDias(hoje, 220)],
);
await executar(
  `INSERT INTO inseminacoes (id, propriedade_id, animal_id, data_inseminacao, reprodutor_semen, previsao_parto, situacao)
   VALUES (UUID(), ?, ?, ?, 'Touro Jaguar', ?, 'em_andamento')`,
  [FAZENDA_NAIR, animalDaNair, somarDias(hoje, -10), somarDias(hoje, 270)],
);
const comIns = await rodarConsulta("indicadores_propriedade", dona, { propriedade_id: FAZENDA_NAIR }) as Ind;
conferir("as três inseminações do ano foram contadas", 3, comIns.reproducao["inseminacoes_ano"]);
// Uma pegou, uma falhou, uma está em andamento: a taxa é 1 de 2, não 1 de 3.
conferir("a taxa de prenhez ignora o que ainda não teve desfecho", 50, comIns.reproducao["taxa_prenhez"]);

console.log("== Indicadores: valor impossível é descartado, não corrigido ==");
const VACA = animalDaNair;
for (const [atras, brinco] of [[800, "4001"], [430, "4002"], [60, "4003"]] as [number, string][]) {
  const bezerro = await criar(dona, "animais", { propriedade_id: FAZENDA_NAIR, numero_brinco: brinco, sexo: "F", situacao: "ativo", data_nascimento: somarDias(hoje, -atras) });
  await executar(
    "INSERT INTO nascimentos (id, propriedade_id, vaca_id, bezerro_id, data_nascimento, sexo) VALUES (UUID(), ?, ?, ?, ?, 'F')",
    [FAZENDA_NAIR, VACA, bezerro, somarDias(hoje, -atras)],
  );
}
const comPartos = await rodarConsulta("indicadores_propriedade", dona, { propriedade_id: FAZENDA_NAIR }) as Ind;
// A cria de 800 dias atrás está fora da janela de 24 meses, então sobra um intervalo só:
// de 430 para 60 dias atrás, 370 dias.
conferir("o intervalo entre partos olha dois anos e descarta o resto", 370, comPartos.reproducao["intervalo_partos_dias"]);
// Só a cria de 60 dias atrás está dentro dos 12 meses.
conferir("o parto do ano foi contado", 1, comPartos.reproducao["nascidos_ano"]);
conferir("a vaca sem data de nascimento não entra na idade ao primeiro parto", null, comPartos.reproducao["idade_primeiro_parto_meses"]);
// Duas crias da mesma vaca com 20 dias de diferença é erro de digitação: entrar na média
// baixaria o intervalo de toda a fazenda. Fora da faixa de 250 a 900 dias, não conta.
for (const [atras, brinco] of [[100, "4101"], [80, "4102"]] as [number, string][]) {
  const bezerro = await criar(dona, "animais", { propriedade_id: FAZENDA_NAIR, numero_brinco: brinco, sexo: "F", situacao: "ativo", data_nascimento: somarDias(hoje, -atras) });
  await executar(
    "INSERT INTO nascimentos (id, propriedade_id, vaca_id, bezerro_id, data_nascimento, sexo) VALUES (UUID(), ?, ?, ?, ?, 'F')",
    [FAZENDA_NAIR, comLixo, bezerro, somarDias(hoje, -atras)],
  );
}
const comErro = await rodarConsulta("indicadores_propriedade", dona, { propriedade_id: FAZENDA_NAIR }) as Ind;
conferir("intervalo de 20 dias entre partos não estraga a média", 370, comErro.reproducao["intervalo_partos_dias"]);
conferir("mas as crias continuam contadas como nascimentos", 3, comErro.reproducao["nascidos_ano"]);
await recusa("pedir os indicadores da fazenda do vizinho", () => rodarConsulta("indicadores_propriedade", dona, { propriedade_id: FAZENDA_JOAO }));

console.log("== Área do assinante: vale a última assinatura, não a primeira ==");
conferir("sem assinatura, não é assinante", false, await rodarConsulta("sou_assinante", dona, {}));
const vence = new Date(Date.now() + 40 * 3600_000); // 40 horas: um dia e pouco
await executar(
  "INSERT INTO assinaturas (id, user_id, propriedade_id, plano, status, origem, data_expiracao, created_at) VALUES (UUID(), ?, ?, 'premium', 'ativo', 'mercadopago', ?, NOW(3))",
  [NAIR, FAZENDA_NAIR, vence],
);
// Depois veio um cancelamento: é esta a que vale.
await executar(
  "INSERT INTO assinaturas (id, user_id, propriedade_id, plano, status, origem, created_at) VALUES (UUID(), ?, ?, 'gratuito', 'cancelado', 'painel', DATE_ADD(NOW(3), INTERVAL 1 SECOND))",
  [NAIR, FAZENDA_NAIR],
);
conferir("a assinatura cancelada depois é a que vale", false, await rodarConsulta("sou_assinante", dona, {}));
type Area = { assinante: boolean; assinaturas: { propriedade: string; plano: string; ativa: boolean; dias_restantes: number | null }[] };
const areaCancelada = await rodarConsulta("minha_area_assinante", dona, {}) as Area;
conferir("a área mostra uma assinatura só por fazenda", 1, areaCancelada.assinaturas.length);
conferir("e é a última", "gratuito", areaCancelada.assinaturas[0]?.plano);
// Renovou: agora a última é premium outra vez.
await executar(
  "INSERT INTO assinaturas (id, user_id, propriedade_id, plano, status, origem, data_expiracao, created_at) VALUES (UUID(), ?, ?, 'premium', 'ativo', 'mercadopago', ?, DATE_ADD(NOW(3), INTERVAL 2 SECOND))",
  [NAIR, FAZENDA_NAIR, vence],
);
const area = await rodarConsulta("minha_area_assinante", dona, {}) as Area;
conferir("depois de renovar, é assinante de novo", true, area.assinante);
conferir("a assinatura está marcada como ativa", true, area.assinaturas[0]?.ativa);
conferir("40 horas restantes viram 2 dias, arredondando para cima", 2, area.assinaturas[0]?.dias_restantes);
conferir("o vizinho não vê a assinatura da fazenda alheia", 0, (await rodarConsulta("minha_area_assinante", vizinho, {}) as Area).assinaturas.length);

console.log("== Diagnóstico: aponta o registro impossível, sem corrigir ==");
conferir("sem nada estranho, a lista é vazia", 0, (await rodarConsulta("registros_inconsistentes", dona, { propriedade_id: FAZENDA_NAIR }) as unknown[]).length);
await executar("INSERT INTO pesagens (id, propriedade_id, animal_id, data, peso_kg) VALUES (UUID(), ?, ?, ?, 300)", [FAZENDA_NAIR, animalDaNair, somarDias(hoje, 5)]);
type Achado = { tabela: string; checagem: string; qtd: number };
const achados = await rodarConsulta("registros_inconsistentes", dona, { propriedade_id: FAZENDA_NAIR }) as Achado[];
conferir("a pesagem com data no futuro foi apontada", "datas/1", `${achados[0]?.tabela}/${achados[0]?.qtd}`);
conferir("mas continua no banco: quem lançou é que decide", 1,
  Number((await consultar<{ n: number }>("SELECT COUNT(*) AS n FROM pesagens WHERE propriedade_id = ? AND data > ?", [FAZENDA_NAIR, hoje]))[0]?.n));
await recusa("pedir o diagnóstico da fazenda do vizinho", () => rodarConsulta("registros_inconsistentes", dona, { propriedade_id: FAZENDA_JOAO }));

console.log("== Relatório por período ==");
type Rel = Record<string, number>;
// Um lançamento num dia isolado, longe de tudo, para medir a janela sem depender do que
// as outras conferências deixaram no banco.
await executar("INSERT INTO producao_leite (id, propriedade_id, animal_id, data, litros) VALUES (UUID(), ?, ?, ?, 7)", [FAZENDA_NAIR, animalDaNair, somarDias(hoje, -100)]);
const noDia = somarDias(hoje, -100);
conferir("um dia só traz o daquele dia", 7, (await rodarConsulta("relatorio_indicadores", dona, { propriedade_id: FAZENDA_NAIR, de: noDia, ate: noDia }) as Rel)["litros"]);
conferir("o dia seguinte não traz nada", 0, (await rodarConsulta("relatorio_indicadores", dona, { propriedade_id: FAZENDA_NAIR, de: somarDias(hoje, -99), ate: somarDias(hoje, -99) }) as Rel)["litros"]);
const todoLeite = Number((await consultar<{ s: number }>("SELECT COALESCE(SUM(litros), 0) AS s FROM producao_leite WHERE propriedade_id = ?", [FAZENDA_NAIR]))[0]?.s);
conferir("o relatório sem período pega tudo", todoLeite, (await rodarConsulta("relatorio_indicadores", dona, { propriedade_id: FAZENDA_NAIR }) as Rel)["litros"]);
await recusa("pedir um período de trás para frente", () => rodarConsulta("relatorio_indicadores", dona, { propriedade_id: FAZENDA_NAIR, de: hoje, ate: somarDias(hoje, -10) }));
await recusa("pedir o relatório da fazenda do vizinho", () => rodarConsulta("relatorio_indicadores", dona, { propriedade_id: FAZENDA_JOAO }));

console.log("== Diagnóstico das tabelas ==");
type Diag = { tabela: string; contagem: number; tempo_ms: number }[];
const quantosLeites = Number((await consultar<{ n: number }>("SELECT COUNT(*) AS n FROM producao_leite WHERE propriedade_id = ?", [FAZENDA_NAIR]))[0]?.n);
const diag = await rodarConsulta("diagnostico_propriedade", dona, { propriedade_id: FAZENDA_NAIR }) as Diag;
conferir("o diagnóstico olha as 13 tabelas de sempre", 13, diag.length);
conferir("e conta só o que é da fazenda", quantosLeites, diag.find((l) => l.tabela === "producao_leite")?.contagem);
conferir("o diagnóstico do vizinho mostra a fazenda dele vazia", 0, (await rodarConsulta("diagnostico_propriedade", vizinho, { propriedade_id: FAZENDA_JOAO }) as Diag).find((l) => l.tabela === "producao_leite")?.contagem);

console.log("== Sincronização do aplicativo: a marca é data E identificador ==");
type LinhaSync = { id: string; updated_at: string | Date };
const pagina1 = await rodarConsulta("app_sincronizar", dona, { propriedade_id: FAZENDA_NAIR, tabela: "producao_leite", limite: 1 }) as LinhaSync[];
conferir("a primeira página traz uma linha", 1, pagina1.length);
const pagina2 = await rodarConsulta("app_sincronizar", dona, {
  propriedade_id: FAZENDA_NAIR, tabela: "producao_leite", limite: 50,
  apos_updated_at: new Date(pagina1[0]!.updated_at).toISOString(), apos_id: pagina1[0]!.id,
}) as LinhaSync[];
conferir("a página seguinte não repete a linha anterior", false, pagina2.some((l) => l.id === pagina1[0]!.id));
conferir("e traz o resto", quantosLeites - 1, pagina2.length);
await recusa("sincronizar uma tabela que não está na lista", () => rodarConsulta("app_sincronizar", dona, { propriedade_id: FAZENDA_NAIR, tabela: "usuarios" }));
await recusa("sincronizar a tabela de chaves", () => rodarConsulta("app_sincronizar", dona, { propriedade_id: FAZENDA_NAIR, tabela: "chaves_sistema" }));
await recusa("sincronizar a fazenda do vizinho", () => rodarConsulta("app_sincronizar", vizinho, { propriedade_id: FAZENDA_NAIR, tabela: "animais" }));

console.log("== Painel do administrador ==");
const chefeCom2fa: Quem = { userId: NAIR, admin: true, propriedades: [FAZENDA_NAIR], aal: "aal2" };
await recusa("pedir os pagamentos sem ser administrador", () => rodarConsulta("admin_pagamentos", dona, {}));
conferir("o administrador vê a lista de pagamentos", true, Array.isArray(await rodarConsulta("admin_pagamentos", chefe, {})));
conferir("e o resumo dos eBooks", true, Array.isArray(await rodarConsulta("admin_ebooks_resumo", chefe, {})));
await recusa("exigir 2FA de todos sem estar usando 2FA", () => rodarConsulta("admin_exigir_2fa", chefe, { ligar: true }));
conferir("quem já usa 2FA pode exigir dos outros", true, await rodarConsulta("admin_exigir_2fa", chefeCom2fa, { ligar: true }));
conferir("desligar não exige 2FA", false, await rodarConsulta("admin_exigir_2fa", chefe, { ligar: false }));
conferir("e ficou gravado", "nao",
  (await consultar<{ valor: string }>("SELECT valor FROM configuracoes_sistema WHERE chave = 'exigir_2fa_admin'"))[0]?.valor);

console.log("== Plano de demonstração: toda mudança fica registrada ==");
await recusa("liberar Premium sem ser administrador", () => rodarConsulta("setar_plano_demonstracao", dona, { propriedade_id: FAZENDA_JOAO }));
const liberado = await rodarConsulta("setar_plano_demonstracao", chefe, { propriedade_id: FAZENDA_JOAO, motivo: "atendimento" }) as Record<string, unknown>;
conferir("o administrador libera Premium na fazenda de outra pessoa", true, liberado["premium_ativo"]);
conferir("e o vizinho passa a ser assinante", true, await rodarConsulta("sou_assinante", vizinho, {}));
conferir("a mudança foi anotada com quem fez e por quê", "atendimento",
  (await consultar<{ motivo: string }>("SELECT motivo FROM plano_auditoria WHERE propriedade_id = ? ORDER BY created_at DESC LIMIT 1", [FAZENDA_JOAO]))[0]?.motivo);
const cancelado = await rodarConsulta("cancelar_plano_demonstracao", chefe, { propriedade_id: FAZENDA_JOAO, motivo: "fim do teste" }) as Record<string, unknown>;
conferir("e consegue cancelar", "cancelado", cancelado["status"]);
conferir("o vizinho deixa de ser assinante", false, await rodarConsulta("sou_assinante", vizinho, {}));
conferir("cancelar de novo não quebra", true, (await rodarConsulta("cancelar_plano_demonstracao", chefe, { propriedade_id: FAZENDA_JOAO }) as Record<string, unknown>)["ja_cancelado"]);

console.log("== Incidente de segurança ==");
const incidente = await rodarConsulta("seg_registrar_incidente", dona, {
  tipo: "senha_errada", severidade: "aviso", ip: "203.0.113.9", disp: "aparelho-1",
  user: JOAO, motivo: "cinco tentativas", bloquear: true,
}) as string;
conferir("o incidente foi registrado", 36, String(incidente).length);
conferir("ficou no nome de quem pediu, não de quem o pedido disse", NAIR,
  (await consultar<{ user_id: string }>("SELECT user_id FROM incidentes_seguranca WHERE id = ?", [incidente]))[0]?.user_id);
conferir("o pedido não consegue mandar bloquear", 0,
  Number((await consultar<{ n: number }>("SELECT COUNT(*) AS n FROM bloqueios_acesso"))[0]?.n));

console.log("== Visões: resumo por mês, e só de leitura ==");
const porMes = await listar<{ mes: string; total_litros: string }>(dona, { tabela: "v_producao_mensal", ordem: [{ coluna: "mes" }] });
conferir("o resumo mensal de leite aparece", true, porMes.total > 0);
conferir("o mês vem como data, não como texto", true, /^\d{4}-\d{2}-01/.test(String(porMes.linhas[0]?.mes)));
const somaDoMes = Number((await consultar<{ s: number }>(
  "SELECT COALESCE(SUM(litros), 0) AS s FROM producao_leite WHERE propriedade_id = ? AND data >= ? AND data < DATE_ADD(?, INTERVAL 1 MONTH)",
  [FAZENDA_NAIR, `${hoje.slice(0, 7)}-01`, `${hoje.slice(0, 7)}-01`],
))[0]?.s);
const mesAtual = porMes.linhas.find((l) => String(l.mes).startsWith(hoje.slice(0, 7)));
conferir("e soma o leite do mês", somaDoMes, Number(mesAtual?.total_litros));
conferir("o lançamento de 100 dias atrás caiu no mês dele", true,
  porMes.linhas.some((l) => String(l.mes).startsWith(somarDias(hoje, -100).slice(0, 7))));
conferir("o vizinho não vê o resumo da fazenda alheia", 0, (await listar(vizinho, { tabela: "v_producao_mensal" })).total);
await recusa("gravar num resumo", () => criar(dona, "v_producao_mensal", { propriedade_id: FAZENDA_NAIR, mes: hoje, total_litros: 999 }));

console.log("== Esqueci minha senha: o link serve uma vez e derruba o resto ==");
const tokenBom = "token-de-conferencia-1";
const resumoDe = (t: string) => createHash("sha256").update(t).digest("hex");
const pedirLink = (token: string, minutos: number) => executar(
  "INSERT INTO recuperacoes_senha (id, user_id, token_hash, expira_em) VALUES (UUID(), ?, ?, ?)",
  [NAIR, resumoDe(token), new Date(Date.now() + minutos * 60_000)],
);
await pedirLink(tokenBom, 60);
await pedirLink("token-de-conferencia-2", 60);   // outro link pendente da mesma conta
await pedirLink("token-vencido", -10);           // já venceu
// Duas sessões abertas, para ver se a troca de senha derruba as duas.
for (const t of ["sessao-a", "sessao-b"]) {
  await executar(
    "INSERT INTO sessoes (id, user_id, token_hash, expira_em) VALUES (UUID(), ?, ?, DATE_ADD(NOW(3), INTERVAL 30 DAY))",
    [NAIR, resumoDe(t)],
  );
}
await recusaQualquer("senha fraca não gasta o link", () => trocarSenhaComLink(tokenBom, "123"));
await recusaQualquer("link que não existe", () => trocarSenhaComLink("token-inventado", "Capim-Alto-2026"));
await recusaQualquer("link vencido", () => trocarSenhaComLink("token-vencido", "Capim-Alto-2026"));
conferir("o link bom troca a senha", NAIR, (await trocarSenhaComLink(tokenBom, "Capim-Alto-2026")).userId);
await recusaQualquer("e não serve de novo", () => trocarSenhaComLink(tokenBom, "Outra-Senha-2026"));
await recusaQualquer("o outro link pendente também perdeu valor", () => trocarSenhaComLink("token-de-conferencia-2", "Outra-Senha-2026"));
conferir("a senha nova confere", true, (await conferirSenha("Capim-Alto-2026",
  String((await consultar<{ h: string }>("SELECT senha_hash AS h FROM usuarios WHERE id = ?", [NAIR]))[0]?.h))).confere);
conferir("as sessões abertas caíram", 0,
  Number((await consultar<{ n: number }>("SELECT COUNT(*) AS n FROM sessoes WHERE user_id = ?", [NAIR]))[0]?.n));

console.log("== Apagar a fazenda leva junto o que é dela, e só dela ==");
// Pelo caminho de verdade (`apagar`), que apaga na ordem: o MySQL confere as referências
// na hora, então um DELETE direto na fazenda esbarraria em nascimentos -> animais.
await recusa("o vizinho não apaga a fazenda alheia", () => apagar(vizinho, "propriedades", FAZENDA_NAIR));
conferir("a dona apaga a fazenda dela", true, await apagar(dona, "propriedades", FAZENDA_NAIR));
conferir("não sobrou nascimento da fazenda apagada", 0,
  Number((await consultar<{ n: number }>("SELECT COUNT(*) AS n FROM nascimentos WHERE propriedade_id = ?", [FAZENDA_NAIR]))[0]?.n));
conferir("nem pesagem", 0,
  Number((await consultar<{ n: number }>("SELECT COUNT(*) AS n FROM pesagens WHERE propriedade_id = ?", [FAZENDA_NAIR]))[0]?.n));
conferir("a Nair ficou sem animais", 0, (await listar(dona, { tabela: "animais" })).total);
conferir("o João continua com o dele", 1, (await listar(vizinho, { tabela: "animais" })).total);

console.log();
if (falhas > 0) {
  console.log(`${falhas} conferência(s) falharam.`);
  process.exit(1);
}
console.log("A separação entre fazendas está de pé.");
process.exit(0);

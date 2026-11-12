/*
 * Supabase de mentira para conferir o migrar.mjs sem tocar no banco de verdade.
 *
 * Responde como o PostgREST responde, com dados escolhidos para pegar justamente o que
 * costuma quebrar numa migração: hora com fuso de Brasília, sim/não, JSON, acento,
 * campo vazio, número com casas decimais e lista com mais de uma página.
 */
import { createServer } from "node:http";

const PROP = "22222222-2222-4222-8222-222222222222";
const USUARIO = "11111111-1111-4111-8111-111111111111";
const LOTE = "33333333-3333-4333-8333-333333333333";
const ANIMAL = "44444444-4444-4444-8444-444444444444";

/** 10/11/2026 às 21:30 em Brasília = 11/11/2026 às 00:30 em UTC. É a armadilha do fuso. */
const NOITE_BR = "2026-11-10T21:30:00.000-03:00";

export const DADOS = {
  usuarios: [],
  propriedades: [{
    id: PROP, proprietario_id: USUARIO, nome: "Fazenda Boa Vista", cidade: "Patos de Minas",
    estado: "MG", periodo_gestacao_dias: 283, ativo: true,
    created_at: NOITE_BR, updated_at: NOITE_BR,
  }],
  lotes: [{
    id: LOTE, propriedade_id: PROP, nome: "Lactantes", descricao: null, finalidade: "Leite",
    ativo: true, created_at: NOITE_BR, updated_at: NOITE_BR,
  }],
  animais: [{
    id: ANIMAL, propriedade_id: PROP, lote_id: LOTE, numero_brinco: "1124",
    nome: "Jóia da Ribeira — ação", sexo: "F", raca: "Girolando", data_nascimento: "2024-03-10",
    mae_id: null, pai_id: null, situacao: "ativo",
    observacoes: "Aspas 'simples', barra \\ e quebra\nde linha",
    created_at: NOITE_BR, updated_at: NOITE_BR,
  }],
  producao_leite: [{
    id: "55555555-5555-4555-8555-555555555555", propriedade_id: PROP, animal_id: ANIMAL,
    lote_id: LOTE, data: "2026-11-10", litros: "18.50", valor_litro: "2.40",
    valor_total: "44.40", observacao: null, created_at: NOITE_BR, updated_at: NOITE_BR,
  }],
  profiles: [{
    id: USUARIO, nome_completo: "Dona Nair", telefone: null, avatar_url: null,
    preferencias: { tema: "escuro", avisos: true }, created_at: NOITE_BR, updated_at: NOITE_BR,
    nome_exibicao: null, cargo: null, biografia: null, bloqueado: false,
  }],
  configuracoes: [{
    id: "66666666-6666-4666-8666-666666666666", propriedade_id: PROP, chave: "leite",
    valor: { meta_diaria: 420, alerta: "queda" }, created_at: NOITE_BR, updated_at: NOITE_BR,
  }],
};

// Muitas marcas de exclusão: uma velha (fora do corte) e duas novas (dentro).
const diasAtras = (n) => new Date(Date.now() - n * 86400000).toISOString();
DADOS.registros_excluidos = [
  { id: 1, propriedade_id: PROP, tabela: "animais", registro_id: ANIMAL, excluido_em: diasAtras(120) },
  { id: 2, propriedade_id: PROP, tabela: "lotes", registro_id: LOTE, excluido_em: diasAtras(3) },
  { id: 3, propriedade_id: PROP, tabela: "lotes", registro_id: ANIMAL, excluido_em: diasAtras(1) },
];

export function subir(porta = 0) {
  const servidor = createServer((req, res) => {
    const url = new URL(req.url, "http://local");
    const tabela = url.pathname.replace("/rest/v1/", "");
    let linhas = DADOS[tabela] ?? [];
    const corte = url.searchParams.get("excluido_em");
    if (corte?.startsWith("gte.")) {
      const limite = corte.slice(4);
      linhas = linhas.filter((l) => l.excluido_em >= limite);
    }
    const inicio = Number(url.searchParams.get("offset") ?? 0);
    const tamanho = Number(url.searchParams.get("limit") ?? 1000);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(linhas.slice(inicio, inicio + tamanho)));
  });
  return new Promise((ok) => servidor.listen(porta, "127.0.0.1", () => ok(servidor)));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const porta = Number(process.argv[2] ?? 54330);
  await subir(porta);
  console.log(`Supabase de mentira em http://127.0.0.1:${porta}`);
}

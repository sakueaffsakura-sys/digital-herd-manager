// Banco de mentira para as fotos de tela (scripts/capturas/capturar.mjs).
// Responde como o Supabase (Auth + PostgREST) com dados de uma fazenda fictícia,
// para conferir o visual sem tocar no banco real. Nada aqui vai para o site publicado.

const DIA = 86_400_000;
const hoje = new Date();
const iso = (d) => new Date(d).toISOString();
const dataISO = (offsetDias = 0) => {
  const d = new Date(hoje.getTime() + offsetDias * DIA);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const mesISO = (offsetMeses) => {
  const d = new Date(hoje.getFullYear(), hoje.getMonth() + offsetMeses, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};
let seq = 0;
const uuid = () => {
  seq += 1;
  return `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`;
};
// Números pseudoaleatórios estáveis (mesma foto a cada execução).
let semente = 42;
const rnd = () => {
  semente = (semente * 1103515245 + 12345) % 2147483648;
  return semente / 2147483648;
};
const escolha = (lista) => lista[Math.floor(rnd() * lista.length)];

export const USUARIO = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "maria.souza@exemplo.com.br",
  nome: "Maria Souza",
};
export const PROPRIEDADE_ID = "22222222-2222-4222-8222-222222222222";
const P = PROPRIEDADE_ID;

function base64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}

export function sessaoFalsa({ aal = "aal1" } = {}) {
  const agora = Math.floor(Date.now() / 1000);
  const payload = {
    aud: "authenticated", exp: agora + 86_400, iat: agora, sub: USUARIO.id, email: USUARIO.email,
    role: "authenticated", aal, amr: [{ method: "password", timestamp: agora }], session_id: "33333333-3333-4333-8333-333333333333",
    is_anonymous: false,
  };
  const token = `${base64url({ alg: "HS256", typ: "JWT" })}.${base64url(payload)}.assinatura-falsa`;
  return {
    access_token: token, token_type: "bearer", expires_in: 86_400, expires_at: agora + 86_400,
    refresh_token: "refresh-falso", user: usuarioAuth(),
  };
}

export function usuarioAuth() {
  return {
    id: USUARIO.id, aud: "authenticated", role: "authenticated", email: USUARIO.email,
    email_confirmed_at: iso(hoje.getTime() - 200 * DIA), phone: "", confirmed_at: iso(hoje.getTime() - 200 * DIA),
    last_sign_in_at: iso(hoje.getTime() - DIA), app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: { nome_completo: USUARIO.nome }, identities: [], created_at: iso(hoje.getTime() - 200 * DIA),
    updated_at: iso(hoje.getTime() - DIA), is_anonymous: false, factors: [],
  };
}

// ---------- Dados da fazenda ----------
const lotes = [
  ["Vacas em lactação", "Leite"], ["Novilhas", "Recria"], ["Bezerros", "Cria"], ["Secas", "Leite"], ["Engorda", "Corte"],
].map(([nome, finalidade]) => ({ id: uuid(), propriedade_id: P, nome, finalidade, descricao: null, ativo: true, created_at: iso(hoje.getTime() - 300 * DIA), updated_at: iso(hoje.getTime() - 30 * DIA) }));

const nomesVacas = ["Mimosa", "Estrela", "Pintada", "Boneca", "Malhada", "Princesa", "Jabuticaba", "Serena", "Morena", "Flor", "Bela", "Canela", "Graúna", "Faceira", "Jóia", "Lua", "Pérola", "Sereia", "Valente", "Branquinha"];
const racas = ["Girolando", "Gir", "Holandesa", "Nelore", "Jersey"];
const animais = [];
for (let i = 0; i < 48; i++) {
  const femea = i % 5 !== 0;
  const idadeDias = i < 10 ? 60 + i * 25 : 700 + Math.floor(rnd() * 2400);
  animais.push({
    id: uuid(), propriedade_id: P, numero_brinco: String(1040 + i * 7), nome: femea ? (nomesVacas[i % nomesVacas.length]) : (i % 2 ? "Trovão" : null),
    sexo: femea ? "F" : "M", raca: escolha(racas), data_nascimento: dataISO(-idadeDias), lote_id: i < 10 ? lotes[2].id : femea ? (i % 3 ? lotes[0].id : lotes[3].id) : lotes[4].id,
    mae_id: null, pai_id: null, situacao: i === 47 ? "vendido" : "ativo", observacoes: null,
    created_at: iso(hoje.getTime() - (400 - i) * DIA), updated_at: iso(hoje.getTime() - i * DIA),
  });
}
const ref = (a) => ({ nome: a.nome, numero_brinco: a.numero_brinco });

const tiposVacinas = [["Febre aftosa", 180], ["Brucelose (B19)", null], ["Clostridiose", 365], ["Raiva", 365]].map(([nome, intervalo]) => ({
  id: uuid(), propriedade_id: P, nome, intervalo_dias: intervalo, descricao: null, ativo: true, created_at: iso(hoje.getTime() - 300 * DIA), updated_at: iso(hoje.getTime() - 300 * DIA),
}));

const vacinacoes = [];
const status = [];
[-12, -3, 2, 6, 11, 18, 25, 40, 75, 120].forEach((dias, i) => {
  const animal = animais[10 + i];
  const tipo = tiposVacinas[i % tiposVacinas.length];
  const v = {
    id: uuid(), propriedade_id: P, animal_id: animal.id, lote_id: null, tipo_vacina_id: tipo.id, data_aplicacao: dataISO(dias - 180),
    proxima_aplicacao: dataISO(dias), responsavel: i % 2 ? "João (vaqueiro)" : "Dra. Ana", observacao: null,
    created_at: iso(hoje.getTime() - 100 * DIA), updated_at: iso(hoje.getTime() - 100 * DIA),
    tipos_vacinas: { nome: tipo.nome }, animais: ref(animal), lotes: null,
  };
  vacinacoes.push(v);
  status.push({ ...v, dias_restantes: dias, ultima_dose: true, status_calculado: dias < 0 ? "vencida" : dias <= 15 ? "proxima" : "em_dia", status_atual: dias < 0 ? "vencida" : dias <= 15 ? "proxima" : "em_dia" });
});

const inseminacoes = [8, 21, 45, 90, 160, 230].map((dias, i) => {
  const animal = animais[12 + i * 3];
  return {
    id: uuid(), propriedade_id: P, animal_id: animal.id, data_inseminacao: dataISO(dias - 283), previsao_parto: dataISO(dias),
    reprodutor_semen: i % 2 ? "Touro Gir Leiteiro — Sêmen 2231" : "Holandês Top — Sêmen 118", situacao: i < 2 ? "confirmada" : "em_andamento",
    observacao: null, created_at: iso(hoje.getTime() - 200 * DIA), updated_at: iso(hoje.getTime() - 10 * DIA), animais: ref(animal),
  };
});

const nascimentos = animais.slice(0, 6).map((bezerro, i) => ({
  id: uuid(), propriedade_id: P, bezerro_id: bezerro.id, vaca_id: animais[20 + i].id, data_nascimento: bezerro.data_nascimento, sexo: bezerro.sexo,
  lote_id: lotes[2].id, observacoes: null, created_at: iso(hoje.getTime() - 60 * DIA), updated_at: iso(hoje.getTime() - 60 * DIA),
}));

const pesagens = [];
animais.slice(0, 10).forEach((a, i) => {
  for (let k = 0; k < 3; k++) {
    pesagens.push({ id: uuid(), propriedade_id: P, animal_id: a.id, data: dataISO(-k * 30 - i), peso_kg: 95 + i * 12 - k * 18, observacoes: null, created_at: iso(hoje.getTime() - k * 30 * DIA), updated_at: iso(hoje.getTime() - k * 30 * DIA) });
  }
});

const producao = [];
for (let d = 0; d < 30; d++) {
  for (const a of animais.slice(12, 16)) {
    const litros = Math.round((14 + rnd() * 9) * 10) / 10;
    producao.push({ id: uuid(), propriedade_id: P, animal_id: a.id, lote_id: lotes[0].id, data: dataISO(-d), litros, valor_litro: 2.45, valor_total: Math.round(litros * 2.45 * 100) / 100, observacao: null, created_at: iso(hoje.getTime() - d * DIA), updated_at: iso(hoje.getTime() - d * DIA) });
  }
}

const movimentacoes = [
  ["receita", "Venda de leite — laticínio", "Leite", 18450], ["despesa", "Ração concentrada", "Alimentação", 6230], ["despesa", "Sal mineral", "Alimentação", 980],
  ["despesa", "Vacinas e vermífugo", "Sanidade", 1260], ["investimento", "Ordenhadeira nova", "Equipamentos", 14800], ["despesa", "Energia elétrica", "Infraestrutura", 870],
  ["receita", "Venda de bezerros", "Animais", 9600], ["despesa", "Salário do vaqueiro", "Mão de obra", 2600],
].map(([tipo, descricao, categoria, valor], i) => ({ id: uuid(), propriedade_id: P, tipo, descricao, categoria, valor, data: dataISO(-i * 3), observacao: null, origem_tipo: null, origem_id: null, created_at: iso(hoje.getTime() - i * DIA), updated_at: iso(hoje.getTime() - i * DIA) }));

const compras = [["Ração 40 kg (sacos)", 30, 3900, "Agropecuária Boa Safra"], ["Novilha Girolando", 2, 9800, "Fazenda Água Limpa"]].map(([produto_animal, quantidade, valor, fornecedor], i) => ({ id: uuid(), propriedade_id: P, produto_animal, quantidade, valor, fornecedor, categoria: i ? "Animais" : "Alimentação", data: dataISO(-i * 9 - 2), observacao: null, movimentacao_id: null, created_at: iso(hoje.getTime()), updated_at: iso(hoje.getTime()) }));
const vendas = [["Bezerro macho desmamado", 3, 6300, "Sítio São José"], ["Esterco curtido (t)", 4, 1200, "Horta Verde"]].map(([item, quantidade, valor, comprador], i) => ({ id: uuid(), propriedade_id: P, item, quantidade, valor, comprador, categoria: i ? "Outros" : "Animais", animal_id: null, data: dataISO(-i * 11 - 1), observacao: null, movimentacao_id: null, created_at: iso(hoje.getTime()), updated_at: iso(hoje.getTime()) }));

const anotacoes = [
  ["Mimosa comeu pouco pela manhã; observar à tarde.", "Silagem + concentrado", "Calma"], ["Lote das lactantes mudou para o piquete 3.", null, null],
  ["Estrela com casco sensível — chamar a veterinária.", null, "Mancando"],
].map(([observacao, alimentacao, comportamento], i) => ({ id: uuid(), propriedade_id: P, animal_id: animais[12 + i].id, lote_id: null, data: dataISO(-i), observacao, alimentacao, comportamento, producao: 18 - i, informacoes_adicionais: null, created_at: iso(hoje.getTime() - i * DIA), updated_at: iso(hoje.getTime() - i * DIA) }));

const meses12 = Array.from({ length: 12 }, (_, i) => mesISO(i - 11));
const vProducaoMensal = meses12.map((mes, i) => ({ propriedade_id: P, mes, total_litros: 7200 + Math.round(Math.sin(i / 2) * 900) + i * 60, valor_total: (7200 + i * 60) * 2.4, media_registro: 17.2 }));
const vFinanceiroMensal = meses12.map((mes, i) => {
  const receitas = 19000 + Math.round(Math.cos(i / 2) * 2500) + i * 200;
  const despesas = 12000 + Math.round(Math.sin(i / 3) * 1800);
  const investimentos = i === 8 ? 14800 : 0;
  return { propriedade_id: P, mes, receitas, despesas, investimentos, lucro: receitas - despesas - investimentos };
});
const porLote = lotes.map((l, i) => ({ propriedade_id: P, lote_id: l.id, nome: l.nome, lote_nome: l.nome, quantidade: [16, 9, 10, 6, 7][i], quantidade_animais: [16, 9, 10, 6, 7][i] }));

const leiteHoje = producao.filter((p) => p.data === dataISO(0)).reduce((s, p) => s + p.litros, 0);

export const TABELAS = {
  propriedades: [{ id: P, nome: "Fazenda Boa Vista", cidade: "Patos de Minas", estado: "MG", proprietario_id: USUARIO.id, ativo: true, periodo_gestacao_dias: 283, created_at: iso(hoje.getTime() - 400 * DIA), updated_at: iso(hoje.getTime() - 5 * DIA) }],
  profiles: [{ id: USUARIO.id, nome_completo: USUARIO.nome, nome_exibicao: "Maria", telefone: "(34) 99999-0000", cargo: "Proprietária", biografia: null, avatar_url: null, bloqueado: false, preferencias: {}, created_at: iso(hoje.getTime() - 400 * DIA), updated_at: iso(hoje.getTime() - 5 * DIA) }],
  animais, lotes, tipos_vacinas: tiposVacinas, vacinacoes, v_vacinacoes_status: status, inseminacoes, nascimentos, pesagens,
  producao_leite: producao, anotacoes_producao: anotacoes, movimentacoes_financeiras: movimentacoes, compras, vendas, investimentos: [],
  v_producao_mensal: vProducaoMensal, v_financeiro_mensal: vFinanceiroMensal, v_animais_por_lote: porLote, v_producao_por_lote: [], v_financeiro_por_categoria: [],
  assinaturas: [], propriedade_perfil: [], configuracoes: [], notificacoes: [
    { id: uuid(), user_id: USUARIO.id, propriedade_id: P, titulo: "Bem-vinda ao novo visual", mensagem: "As telas foram reorganizadas para ficar mais fáceis de usar no celular.", lida: false, created_at: iso(hoje.getTime() - DIA) },
  ],
  suporte_mensagens: [], imagens_site: [], configuracoes_sistema: [], presenca_usuarios: [], registros_excluidos: [], importacoes: [], user_roles: [], plano_auditoria: [],
  propriedade_membros: [{ id: uuid(), propriedade_id: P, user_id: USUARIO.id, role: "proprietario", created_at: iso(hoje.getTime() - 400 * DIA) }],
};

export function rpc(nome, { admin }) {
  const ativos = animais.filter((a) => a.situacao === "ativo").length;
  switch (nome) {
    case "sou_admin": case "pode_gerenciar_planos": return admin;
    case "sou_assinante": return false;
    case "estado_manutencao":
      return { status: "ativo", titulo: "", mensagem: "", modulos: [], atualizado_em: iso(hoje), termina_em: null, sou_admin: admin, conta_bloqueada: false };
    case "dashboard_resumo":
      return {
        total_animais: ativos, animais_ativos: ativos, bezerros: 10, vacinacoes_em_dia: 5, inseminacoes: 6, nascidos_mes: 2, perdas_mes: 0,
        receitas_mes: vFinanceiroMensal[11].receitas, despesas_mes: vFinanceiroMensal[11].despesas, investimentos_mes: 0,
        leite_mes: vProducaoMensal[11].total_litros, leite_hoje: Math.round(leiteHoje * 10) / 10, vacinas_vencidas: 2, partos_30d: 2,
      };
    case "minha_assinatura":
      return { id: null, plano: "gratuito", status: null, origem: null, data_inicio: null, data_expiracao: null, premium_ativo: false, demonstracao: false };
    case "relatorio_indicadores":
      return { animais_ativos: ativos, nascidos: 6, perdas: 0, vendas_qtd: 2, vendas_valor: 7500, compras_qtd: 2, compras_valor: 13700, litros: 21400, valor_leite: 52430, receitas: 58000, despesas: 36000, investimentos: 14800, lucro: 7200 };
    case "diagnostico_propriedade":
      return ["animais", "lotes", "pesagens", "vacinacoes"].map((tabela) => ({ tabela, contagem: (TABELAS[tabela] ?? []).length, ultima_atualizacao: iso(hoje), tempo_ms: 1.2 }));
    case "registros_inconsistentes": return [];
    case "admin_contas":
      return [{ user_id: USUARIO.id, email: USUARIO.email, nome: USUARIO.nome, criado_em: iso(hoje.getTime() - 400 * DIA), ultimo_acesso: iso(hoje), bloqueado: false, admin: true, propriedades: 1, registros: 412, bytes_estimados: 120_000 },
        { user_id: uuid(), email: "joao.pereira@exemplo.com.br", nome: "João Pereira", criado_em: iso(hoje.getTime() - 40 * DIA), ultimo_acesso: iso(hoje.getTime() - 2 * DIA), bloqueado: false, admin: false, propriedades: 2, registros: 1830, bytes_estimados: 380_000 }];
    case "admin_sistema":
      return { banco_bytes: 82_000_000, armazenamento_bytes: 12_400_000, arquivos: 31, usuarios: 2, propriedades: 3, conexoes_ativas: 3, conexoes_total: 18, cache_hit: 99.6, ping_ms: 0.8, novos_7d: 1, ativos_7d: 2, tabelas: [] };
    case "admin_alertas": return [];
    case "admin_metricas": return { cadastros_90d: [], acessos_30d: [], registros_dia: [] };
    case "admin_saude": return { consultas_lentas: [], rate_limits: [], rate_limit_total: 0, seq_scans: [], manutencao: [] };
    case "admin_tempo_real":
      return { ts: Date.now() / 1000, commits: 1000, rollbacks: 0, lidas: 1, inseridas: 1, atualizadas: 1, removidas: 0, blks_hit: 100, blks_read: 1, deadlocks: 0, conexoes_ativas: 2, conexoes_ociosas: 10, conexoes_total: 12, conexoes_max: 60, bloqueios: 0, consulta_mais_longa_s: 0, banco_bytes: 82_000_000, usuarios_online: 1, usuarios_hora: 2, sessoes_abertas: 2 };
    case "admin_seguranca_painel":
      return { config: { id: 1, status: "ativo", titulo: "", mensagem: "", modulos: [], duracao_bloqueio_min: 60, termina_em: null }, totais: { suspeitas: 0, negados: 0, ips: 0, dispositivos: 0, contas: 0 }, tipos: [], incidentes: [], bloqueios: [], historico: [] };
    default: return null;
  }
}

// ---------- PostgREST (filtros simples) ----------
function aplicarFiltros(linhas, params) {
  let out = linhas;
  for (const [col, valorBruto] of params.entries()) {
    if (["select", "order", "limit", "offset", "or", "and", "columns", "on_conflict"].includes(col)) continue;
    const m = /^(not\.)?(eq|neq|gt|gte|lt|lte|in|is|ilike|like)\.(.*)$/.exec(valorBruto);
    if (!m) continue;
    const [, nao, op, valor] = m;
    const teste = (linha) => {
      const v = linha[col];
      switch (op) {
        case "eq": return String(v) === valor;
        case "neq": return String(v) !== valor;
        case "gt": return v != null && String(v) > valor;
        case "gte": return v != null && String(v) >= valor;
        case "lt": return v != null && String(v) < valor;
        case "lte": return v != null && String(v) <= valor;
        case "in": return valor.replace(/^\(|\)$/g, "").split(",").map((s) => s.replace(/^"|"$/g, "")).includes(String(v));
        case "is": return valor === "null" ? v == null : String(v) === valor;
        case "ilike": case "like": {
          const re = new RegExp(`^${valor.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/[*%]/g, ".*")}$`, "i");
          return re.test(String(v ?? ""));
        }
        default: return true;
      }
    };
    out = out.filter((linha) => (nao ? !teste(linha) : teste(linha)));
  }
  return out;
}

export function responderRest({ caminho, metodo, params, cabecalhos, admin }) {
  const json = (status, corpo, extra = {}) => ({ status, headers: { "content-type": "application/json; charset=utf-8", ...extra }, body: corpo === undefined ? "" : JSON.stringify(corpo) });
  if (caminho.startsWith("rpc/")) {
    const nome = caminho.slice(4);
    const r = rpc(nome, { admin });
    return json(200, r);
  }
  const tabela = caminho.split("/")[0];
  if (metodo !== "GET" && metodo !== "HEAD") {
    // Escritas: devolvem o próprio registro, sem gravar nada.
    return json(201, [{ id: uuid() }]);
  }
  const todas = TABELAS[tabela] ?? [];
  const filtradas = aplicarFiltros(todas, params);
  const offset = Number(params.get("offset") ?? 0);
  const limit = params.has("limit") ? Number(params.get("limit")) : filtradas.length;
  const pagina = filtradas.slice(offset, offset + limit);
  const prefer = cabecalhos["prefer"] ?? "";
  const extra = {};
  if (/count=(exact|planned|estimated)/.test(prefer)) extra["content-range"] = `${pagina.length ? `${offset}-${offset + pagina.length - 1}` : "*"}/${filtradas.length}`;
  const aceitaObjeto = (cabecalhos["accept"] ?? "").includes("vnd.pgrst.object");
  if (metodo === "HEAD") return { status: 200, headers: { ...extra }, body: "" };
  if (aceitaObjeto) {
    if (!pagina.length) return json(406, { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned", details: "The result contains 0 rows", hint: null });
    return json(200, pagina[0], extra);
  }
  return json(200, pagina, extra);
}

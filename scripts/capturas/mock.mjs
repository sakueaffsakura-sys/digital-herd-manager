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

// ---------- Assinatura, eBooks e pedidos (fase C) ----------
const PLANO_MENSAL = "44444444-4444-4444-8444-000000000001";
const PLANO_ANUAL = "44444444-4444-4444-8444-000000000002";
const planos = [
  { id: PLANO_MENSAL, nome: "Mensal", descricao: "Tudo liberado por 1 mês. Renova só se você pagar de novo.", meses: 1, preco_centavos: 2990, ativo: true, ordem: 1, criado_em: iso(hoje.getTime() - 30 * DIA), atualizado_em: iso(hoje) },
  { id: PLANO_ANUAL, nome: "Anual", descricao: "12 meses pelo preço de 10.", meses: 12, preco_centavos: 29900, ativo: true, ordem: 2, criado_em: iso(hoje.getTime() - 30 * DIA), atualizado_em: iso(hoje) },
];
export const EBOOK_ID = "00000000-0000-4000-8000-000000000101";
const ebooks = [
  ["Ordenha limpa, leite de qualidade", "Rita Carvalho", "Leite", 64],
  ["Calendário sanitário do rebanho", "Equipe Pecuária Digital", "Sanidade", 32],
  ["Recria de bezerras do desmame ao parto", "Ana Ribeiro", "Reprodução", 88],
  ["Quanto custa o seu litro de leite", "Carlos Menezes", "Gestão", 40],
  ["Pastejo rotacionado em áreas pequenas", "João Batista Lima", "Pastagem", 56],
  ["Inseminação artificial passo a passo", "Equipe Pecuária Digital", "Reprodução", 48],
  ["Silagem de milho sem desperdício", "Paulo Andrade", "Alimentação", 36],
].map(([titulo, autor, categoria, paginas], i) => ({
  id: `00000000-0000-4000-8000-0000000001${String(i + 1).padStart(2, "0")}`, titulo, autor, categoria, paginas,
  descricao: "Guia prático, com fotos e listas para usar no dia a dia da fazenda.", capa_path: null,
  arquivo_path: `00000000-0000-4000-8000-0000000001${String(i + 1).padStart(2, "0")}.pdf`, tamanho_bytes: 2_400_000 + i * 310_000,
  sha256: null, publicado: i < 6, publicado_em: i < 6 ? iso(hoje.getTime() - i * 9 * DIA) : null, criado_por: USUARIO.id,
  created_at: iso(hoje.getTime() - (i * 9 + 1) * DIA), updated_at: iso(hoje.getTime() - i * 9 * DIA),
}));
const pagamentos = [
  { id: uuid(), user_id: USUARIO.id, propriedade_id: P, plano_id: PLANO_ANUAL, plano_nome: "Anual", meses: 12, valor_centavos: 29900, moeda: "BRL", status: "aprovado", metodo: "pix", mp_payment_id: "1320000001", mp_preference_id: null, detalhes: {}, criado_em: iso(hoje.getTime() - 341 * DIA), aprovado_em: iso(hoje.getTime() - 341 * DIA), estornado_em: null, atualizado_em: iso(hoje.getTime() - 341 * DIA) },
  { id: uuid(), user_id: USUARIO.id, propriedade_id: P, plano_id: PLANO_MENSAL, plano_nome: "Mensal", meses: 1, valor_centavos: 2990, moeda: "BRL", status: "recusado", metodo: "credit_card", mp_payment_id: "1320000002", mp_preference_id: null, detalhes: {}, criado_em: iso(hoje.getTime() - 342 * DIA), aprovado_em: null, estornado_em: null, atualizado_em: iso(hoje.getTime() - 342 * DIA) },
];
const solicitacoes = [
  { id: uuid(), user_id: uuid(), email: "joao.pereira@exemplo.com.br", motivo: "Vendi a fazenda.", status: "pendente", criado_em: iso(hoje.getTime() - 4 * DIA), prazo: dataISO(11), concluida_em: null, atendida_por: null },
  { id: uuid(), user_id: uuid(), email: "teste.antigo@exemplo.com.br", motivo: null, status: "concluida", criado_em: iso(hoje.getTime() - 40 * DIA), prazo: dataISO(-25), concluida_em: iso(hoje.getTime() - 33 * DIA), atendida_por: USUARIO.id },
];

/** PDF pequeno de verdade (para o leitor de eBooks nas fotos). */
export function pdfDeExemplo(titulo = "Ordenha limpa, leite de qualidade", paginas = 3) {
  const esc = (t) => t.replace(/[\\()]/g, (c) => `\\${c}`);
  const linhas = [
    "A ordenha começa antes de a vaca entrar na sala: curral limpo, animais calmos",
    "e tetos secos. Este capítulo mostra a rotina que reduz a mastite e melhora",
    "a contagem de células somáticas em poucas semanas.",
    "",
    "1. Faça o teste da caneca de fundo escuro nos três primeiros jatos.",
    "2. Aplique o pré-dipping e espere 30 segundos.",
    "3. Seque cada teto com papel toalha individual.",
    "4. Coloque as teteiras sem deixar entrar ar.",
    "5. Depois da ordenha, use o pós-dipping e mantenha a vaca em pé.",
  ];
  const objetos = [null];
  const n = paginas;
  objetos[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objetos[2] = `<< /Type /Pages /Kids [${Array.from({ length: n }, (_, i) => `${4 + 2 * i} 0 R`).join(" ")}] /Count ${n} >>`;
  objetos[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  for (let i = 0; i < n; i++) {
    const corpo = [`BT /F1 26 Tf 56 760 Td (${esc(titulo)}) Tj ET`, `BT /F1 14 Tf 56 730 Td (Capítulo ${i + 1} de ${n}) Tj ET`]
      .concat(linhas.map((l, k) => `BT /F1 12 Tf 56 ${690 - k * 20} Td (${esc(l)}) Tj ET`)).join("\n");
    objetos[4 + 2 * i] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + 2 * i} 0 R >>`;
    objetos[5 + 2 * i] = `<< /Length ${Buffer.byteLength(corpo, "latin1")} >>\nstream\n${corpo}\nendstream`;
  }
  let texto = "%PDF-1.4\n";
  const pos = [];
  for (let k = 1; k < objetos.length; k++) {
    pos[k] = Buffer.byteLength(texto, "latin1");
    texto += `${k} 0 obj\n${objetos[k]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(texto, "latin1");
  texto += `xref\n0 ${objetos.length}\n0000000000 65535 f \n${pos.slice(1).map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  texto += `trailer\n<< /Size ${objetos.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(texto, "latin1");
}

export const TABELAS = {
  propriedades: [{ id: P, nome: "Fazenda Boa Vista", cidade: "Patos de Minas", estado: "MG", proprietario_id: USUARIO.id, ativo: true, periodo_gestacao_dias: 283, created_at: iso(hoje.getTime() - 400 * DIA), updated_at: iso(hoje.getTime() - 5 * DIA) }],
  profiles: [{ id: USUARIO.id, nome_completo: USUARIO.nome, nome_exibicao: "Maria", telefone: "(34) 99999-0000", cargo: "Proprietária", biografia: null, avatar_url: null, bloqueado: false, preferencias: {}, created_at: iso(hoje.getTime() - 400 * DIA), updated_at: iso(hoje.getTime() - 5 * DIA) }],
  animais, lotes, tipos_vacinas: tiposVacinas, vacinacoes, v_vacinacoes_status: status, inseminacoes, nascimentos, pesagens,
  producao_leite: producao, anotacoes_producao: anotacoes, movimentacoes_financeiras: movimentacoes, compras, vendas, investimentos: [],
  v_producao_mensal: vProducaoMensal, v_financeiro_mensal: vFinanceiroMensal, v_animais_por_lote: porLote, v_producao_por_lote: [], v_financeiro_por_categoria: [],
  planos, ebooks, ebook_acessos: [], pagamentos,
  assinaturas: [], propriedade_perfil: [], configuracoes: [], notificacoes: [
    { id: uuid(), user_id: USUARIO.id, propriedade_id: P, titulo: "Bem-vinda ao novo visual", mensagem: "As telas foram reorganizadas para ficar mais fáceis de usar no celular.", lida: false, created_at: iso(hoje.getTime() - DIA) },
  ],
  suporte_mensagens: [], imagens_site: [], configuracoes_sistema: [{ chave: "exigir_2fa_admin", valor: "nao", atualizado_em: iso(hoje), atualizado_por: null }], presenca_usuarios: [], registros_excluidos: [], importacoes: [], user_roles: [], plano_auditoria: [],
  manutencao_config: [{ id: 1, status: "ativo", titulo: "", mensagem: "", modulos: [], duracao_bloqueio_min: 60, termina_em: null, atualizado_em: iso(hoje), atualizado_por: null }],
  bloqueios_acesso: [], solicitacoes_exclusao: solicitacoes, eventos_seguranca: [], incidentes_seguranca: [], manutencao_historico: [], rate_limits: [],
  propriedade_membros: [{ id: uuid(), propriedade_id: P, user_id: USUARIO.id, role: "proprietario", created_at: iso(hoje.getTime() - 400 * DIA) }],
};

export function rpc(nome, { admin, assinante = false }) {
  const ativos = animais.filter((a) => a.situacao === "ativo").length;
  switch (nome) {
    case "sou_admin": case "pode_gerenciar_planos": return admin;
    case "sou_assinante": return assinante;
    case "minha_area_assinante":
      return {
        assinante,
        assinaturas: [assinante
          ? { propriedade_id: P, propriedade: "Fazenda Boa Vista", plano: "premium", status: "ativo", origem: "mercadopago", data_expiracao: iso(hoje.getTime() + 24 * DIA), ativa: true, dias_restantes: 24 }
          : { propriedade_id: P, propriedade: "Fazenda Boa Vista", plano: "gratuito", status: null, origem: null, data_expiracao: null, ativa: false, dias_restantes: null }],
      };
    case "ebook_registrar_acesso": return { permitido: true };
    case "admin_pagamentos":
      return [
        { id: uuid(), criado_em: iso(hoje.getTime() - 2 * 3600e3), email: "joao.pereira@exemplo.com.br", propriedade: "Sítio Três Irmãos", plano_nome: "Mensal", meses: 1, valor_centavos: 2990, metodo: "pix", status: "pendente", mp_payment_id: null, aprovado_em: null },
        { id: uuid(), criado_em: iso(hoje.getTime() - DIA), email: USUARIO.email, propriedade: "Fazenda Boa Vista", plano_nome: "Anual", meses: 12, valor_centavos: 29900, metodo: "pix", status: "aprovado", mp_payment_id: "1320000003", aprovado_em: iso(hoje.getTime() - DIA) },
        { id: uuid(), criado_em: iso(hoje.getTime() - 3 * DIA), email: "ana.lima@exemplo.com.br", propriedade: "Fazenda Santa Luzia", plano_nome: "Mensal", meses: 1, valor_centavos: 2990, metodo: "credit_card", status: "recusado", mp_payment_id: "1320000004", aprovado_em: null },
        { id: uuid(), criado_em: iso(hoje.getTime() - 8 * DIA), email: "carlos.m@exemplo.com.br", propriedade: "Chácara Recanto", plano_nome: "Mensal", meses: 1, valor_centavos: 2990, metodo: "bolbradesco", status: "aprovado", mp_payment_id: "1320000005", aprovado_em: iso(hoje.getTime() - 7 * DIA) },
      ];
    case "admin_ebooks_resumo":
      return ebooks.filter((e) => e.publicado).slice(0, 4).map((e, i) => ({ ebook_id: e.id, aberturas: [42, 17, 9, 3][i], leitores: [11, 6, 4, 2][i], ultima: iso(hoje.getTime() - i * DIA) }));
    case "admin_2fa_resumo":
      return [{ email: USUARIO.email, tem_2fa: false, eu: true }, { email: "suporte@exemplo.com.br", tem_2fa: true, eu: false }];
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
    case "central_avisos":
      return [
        { chave: "vacinas_atrasadas:2", nivel: "alerta", secao: "vacinacao", titulo: "2 vacinas atrasadas", texto: "A data da próxima dose já passou. Aplique e registre para sair da lista." },
        { chave: "partos_15d:1", nivel: "aviso", secao: "agenda", titulo: "1 parto nos próximos 15 dias", texto: `O primeiro está previsto para ${dataISO(8).slice(8, 10)}/${dataISO(8).slice(5, 7)}. Prepare a maternidade.` },
        { chave: "sem_pesagem:4", nivel: "info", secao: "bezerros", titulo: "4 animais jovens sem pesagem há mais de 60 dias", texto: "Pesar a cada 30 a 60 dias mostra se estão ganhando peso como deveriam." },
      ];
    case "agenda_periodo": {
      const eventos = [
        ...status.filter((v) => v.dias_restantes >= 0 && v.dias_restantes <= 40).map((v) => ({ data: v.proxima_aplicacao, tipo: "vacina", registro_id: v.id, animal_id: v.animal_id, titulo: v.tipos_vacinas.nome, detalhe: v.animais.nome ?? v.animais.numero_brinco, brinco: v.animais.numero_brinco, situacao: v.status_atual })),
        ...inseminacoes.filter((i) => i.previsao_parto <= dataISO(40)).map((i) => ({ data: i.previsao_parto, tipo: "parto", registro_id: i.id, animal_id: i.animal_id, titulo: "Parto previsto", detalhe: i.animais.nome ?? i.animais.numero_brinco, brinco: i.animais.numero_brinco, situacao: i.situacao })),
        { data: dataISO(3), tipo: "cio", registro_id: inseminacoes[3].id, animal_id: inseminacoes[3].animal_id, titulo: "Observar retorno de cio", detalhe: inseminacoes[3].animais.nome, brinco: inseminacoes[3].animais.numero_brinco, situacao: "em_andamento" },
      ].sort((a, b) => a.data.localeCompare(b.data));
      return {
        eventos, truncado: false, hoje: dataISO(0),
        atrasadas: status.filter((v) => v.dias_restantes < 0).map((v) => ({ data: v.proxima_aplicacao, registro_id: v.id, animal_id: v.animal_id, titulo: v.tipos_vacinas.nome, detalhe: v.animais.nome, brinco: v.animais.numero_brinco })),
        sem_pesagem: animais.slice(6, 10).map((a) => ({ animal_id: a.id, nome: a.nome, brinco: a.numero_brinco, data_nascimento: a.data_nascimento, ultima_pesagem: dataISO(-75) })),
      };
    }
    case "minhas_sessoes":
      return [
        { id: uuid(), criada_em: iso(hoje.getTime() - 3 * DIA), ultimo_uso: iso(hoje), navegador: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36", ip: "177.12.40.x", aal: "aal1", atual: true },
        { id: uuid(), criada_em: iso(hoje.getTime() - 9 * DIA), ultimo_uso: iso(hoje.getTime() - 2 * DIA), navegador: "Mozilla/5.0 (Linux; Android 14; SM-A146M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36", ip: "189.40.2.x", aal: "aal1", atual: false },
      ];
    case "admin_contas":
      return [{ user_id: USUARIO.id, email: USUARIO.email, nome: USUARIO.nome, criado_em: iso(hoje.getTime() - 400 * DIA), ultimo_acesso: iso(hoje), bloqueado: false, admin: true, propriedades: 1, registros: 412, bytes_estimados: 120_000 },
        { user_id: uuid(), email: "joao.pereira@exemplo.com.br", nome: "João Pereira", criado_em: iso(hoje.getTime() - 40 * DIA), ultimo_acesso: iso(hoje.getTime() - 2 * DIA), bloqueado: false, admin: false, propriedades: 2, registros: 1830, bytes_estimados: 380_000 }];
    case "admin_sistema":
      return { banco_bytes: 82_000_000, armazenamento_bytes: 12_400_000, arquivos: 31, usuarios: 2, propriedades: 3, conexoes_ativas: 3, conexoes_total: 18, cache_hit: 99.6, ping_ms: 0.8, novos_7d: 1, ativos_7d: 2, tabelas: [] };
    case "admin_alertas": return { alertas: [], bloqueios_10min: 0, bloqueios_60min: 0, ips_60min: 0, conexoes: 3, conexoes_max: 60, cache: 99, eventos: [], por_hora: [], top_ips: [] };
    case "admin_metricas": return { cadastros_90d: [], acessos_30d: [], registros_dia: [] };
    case "admin_saude": return { consultas_lentas: [], rate_limits: [], rate_limit_total: 0, seq_scans: [], manutencao: [] };
    case "admin_tempo_real":
      return { ts: Date.now() / 1000, commits: 1000, rollbacks: 0, lidas: 1, inseridas: 1, atualizadas: 1, removidas: 0, blks_hit: 100, blks_read: 1, deadlocks: 0, conexoes_ativas: 2, conexoes_ociosas: 10, conexoes_total: 12, conexoes_max: 60, bloqueios: 0, consulta_mais_longa_s: 0, banco_bytes: 82_000_000, usuarios_online: 1, usuarios_hora: 2, sessoes_abertas: 2, online_lista: [{ email: USUARIO.email, pagina: "/app/inicio", visto_em: iso(hoje) }], ping_ms: 1 };
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

export function responderRest({ caminho, metodo, params, cabecalhos, admin, assinante = false }) {
  const json = (status, corpo, extra = {}) => ({ status, headers: { "content-type": "application/json; charset=utf-8", ...extra }, body: corpo === undefined ? "" : JSON.stringify(corpo) });
  if (caminho.startsWith("rpc/")) {
    const nome = caminho.slice(4);
    const r = rpc(nome, { admin, assinante });
    return json(200, r);
  }
  const tabela = caminho.split("/")[0];
  if (metodo !== "GET" && metodo !== "HEAD") {
    // Escritas: devolvem o próprio registro, sem gravar nada.
    return json(201, [{ id: uuid() }]);
  }
  // Quem não assina não tem pagamentos; e só o administrador vê planos desligados e eBooks em rascunho.
  const todas = tabela === "pagamentos" && !assinante ? [] : (TABELAS[tabela] ?? []).filter((l) => admin || !(tabela === "ebooks" && !l.publicado));
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

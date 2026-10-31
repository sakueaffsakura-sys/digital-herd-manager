import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";
import { createLovableAiGatewayRunIdFetch, getLovableAiGatewayRunId, withLovableAiGatewayRunIdHeader } from "./ai/run-id.server";
import { allowRequest, clientIp } from "./rate-limit";
import { limiteBanco } from "./limite-banco.server";
import { dataNoFuso, somarDias } from "./datas";

/** Cotas diárias por conta (dia de Brasília). Administradores não têm cota. */
export const COTA_MENSAGENS_DIA = 40;
export const COTA_FALAS_DIA = 60;
const MAX_MENSAGENS = 20;
const MAX_CARACTERES = 24_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RpcSolta = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;

/**
 * Consome uma unidade da cota diária no banco (vale entre servidores). true = pode seguir.
 * Se o contador falhar, deixa passar: o limite por minuto em memória continua valendo.
 */
export async function consumirCotaYui(userId: string, tipo: "mensagem" | "fala"): Promise<boolean> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rpc = supabaseAdmin.rpc.bind(supabaseAdmin) as unknown as RpcSolta;
    const { data, error } = await rpc("yui_consumir", { _user: userId, _tipo: tipo, _limite: tipo === "mensagem" ? COTA_MENSAGENS_DIA : COTA_FALAS_DIA });
    if (error) {
      console.error("Yui: falha ao contar a cota", error);
      return true;
    }
    return data !== false;
  } catch (e) {
    console.error("Yui: falha ao contar a cota", e);
    return true;
  }
}

/** A conta é administradora? (pergunta ao banco com o token da própria pessoa) */
export async function ehAdministrador(supabase: object): Promise<boolean> {
  try {
    // Chamada como método (mantém o "this" do cliente do Supabase).
    const cliente = supabase as { rpc: RpcSolta };
    const r = await cliente.rpc("sou_admin");
    return !r.error && r.data === true;
  } catch {
    return false;
  }
}

type ParteTexto = { type: "text"; text: string };

/**
 * Só confia no que faz sentido vir do navegador: as últimas 20 mensagens, papéis user/assistant, só texto,
 * no máximo 24 mil caracteres no total (corta as mais antigas). Mensagens "system" vindas do cliente são descartadas.
 */
export function limparHistorico(lista: unknown): UIMessage[] {
  if (!Array.isArray(lista)) return [];
  const saida: UIMessage[] = [];
  for (const m of lista.slice(-MAX_MENSAGENS)) {
    if (!m || typeof m !== "object") continue;
    const { id, role, parts } = m as { id?: unknown; role?: unknown; parts?: unknown };
    if (role !== "user" && role !== "assistant") continue;
    if (!Array.isArray(parts)) continue;
    const textos: ParteTexto[] = parts
      .filter((p): p is ParteTexto => !!p && typeof p === "object" && (p as { type?: unknown }).type === "text" && typeof (p as { text?: unknown }).text === "string")
      .map((p) => ({ type: "text", text: p.text.slice(0, 8000) }));
    if (!textos.length) continue;
    const idOk = typeof id === "string" && id.length > 0 && id.length <= 100 ? id : crypto.randomUUID();
    saida.push({ id: idOk, role, parts: textos } as UIMessage);
  }
  const tamanho = (m: UIMessage) => m.parts.reduce((t, p) => t + ((p as { text?: string }).text?.length ?? 0), 0);
  let total = saida.reduce((t, m) => t + tamanho(m), 0);
  while (saida.length > 1 && total > MAX_CARACTERES) total -= tamanho(saida.shift()!);
  return saida;
}

const MODEL = "openai/gpt-6-astra";
const GATEWAY = "https://ai.gateway.lovable.dev/v1";

export const YUI_SYSTEM = `Você é a Yui, assistente de suporte do sistema "Pecuária Digital" — um sistema web de gestão pecuária.
Ao se apresentar ou dar boas-vindas, NUNCA diga "sou a Yui" ou "meu nome é Yui". Diga exatamente: "Sou a assistente virtual do Pecuária Digital, criada para dar suporte aos usuários que tiverem dificuldade ou dúvidas." O nome Yui pode aparecer só em referências diretas depois disso (ex.: "ative a voz da Yui").
Fale SEMPRE em português do Brasil, com tom simpático, paciente e simples (muitos usuários são produtores rurais com pouca experiência em computador).
Respostas curtas e práticas: passo a passo numerado quando for explicar como fazer algo, citando os nomes exatos dos botões e menus.
Nunca invente funções que não existem. Se não souber, diga com honestidade e sugira o caminho mais próximo.
Não peça senhas nem dados sensíveis. Não fale de detalhes técnicos internos (banco de dados, código, servidores).

FUNÇÕES DO SISTEMA (menu lateral à esquerda; no celular, ícone ☰ no topo):
- Início: resumo da propriedade — total de animais, bezerros, vacinas em dia/vencidas, inseminações, receitas/despesas do mês com comparação ao mês anterior, gráficos de 12 meses de finanças e leite, animais por lote, próximas vacinações e previsões de parto. Botões rápidos: "Cadastrar animal", "Registrar leite", "Vacinação". Avisos de vacina vencida e partos nos próximos 30 dias aparecem no topo.
- Meu Rebanho: cadastro de animais (brinco, nome, sexo, raça, nascimento, mãe/pai, lote, situação). Botão "Novo animal", busca, filtro por data (Todos/Hoje/Este mês/Este ano), editar e excluir (pede confirmação). Importação de planilha disponível.
- Evolução dos Bezerros: registrar pesagens (bezerro, data, peso em kg) para acompanhar o crescimento.
- Vacinação: aplicações (vacina, animal ou lote, data, próxima aplicação, responsável) e aba "Tipos de vacina" para cadastrar as vacinas e o intervalo em dias. Vacinas vencidas ficam em vermelho.
- Inseminação: registrar inseminações (fêmea, data, reprodutor/sêmen, previsão de parto, situação: em andamento, confirmada, falhou, parto realizado, cancelada).
- Nascimentos: registrar nascimento ligando a vaca e o bezerro (o bezerro precisa estar cadastrado no rebanho antes); o sistema liga a mãe automaticamente.
- Lotes: criar grupos de animais (pasto, finalidade).
- Produção de Leite: registros por animal com litros e valor por litro (o total é calculado sozinho); aba "Anotações" para observações da produção.
- Relatórios: escolha o tipo (Visão geral, Financeiro, Produção de leite, Nascimentos, Compra e venda) e o mês/ano; setas para trocar de mês; botão "Mês atual". Exportar CSV é do plano Premium.
- Lucros e Investimentos: lançar receitas, despesas e investimentos; o lucro é calculado automaticamente.
- Compra e Venda: registrar compras e vendas; vender um animal marca ele como vendido e lança no financeiro automaticamente.
- Configurações / Perfil: dados da conta, perfil da propriedade (foto, banner, endereço), plano/assinatura, trocar de propriedade ou cadastrar outra no seletor do topo.
- Busca no topo: pesquisa na página aberta.
- Botão "Sobre": informações do sistema.
- Ajuda guiada: no painel da Yui, "Uma função" permite escolher uma área para aprender com voz e demonstração curta; "Tour completo" mostra o sistema todo. Se o usuário quiser aprender só uma função, indique "Uma função", não o tour completo.
- Anotações de Produção: abra Produção de Leite → Anotações → Nova anotação. Data e Observação são obrigatórias; animal, lote, produção em litros, comportamento, alimentação e informações adicionais são opcionais. Após salvar, a anotação aparece na lista e pode ser editada ou excluída. A Yui não deve afirmar que salvou uma anotação.
- Demonstração de anotação: em "Uma função", escolha "Produção de Leite"; o roteiro abre a aba Anotações, destaca "Nova anotação" e simula o preenchimento de uma observação temporária na própria explicação. Não grava nada na propriedade. Para salvar uma anotação real, a pessoa deve preencher e confirmar o formulário.

Se o usuário pedir para conhecer o site todo, sugira "Tour completo"; se quiser apenas uma área, sugira "Uma função" acima do chat.

REGRAS DE NEGÓCIO IMPORTANTES (use para responder com precisão):
- Ordem certa ao começar: 1) cadastrar/escolher a propriedade no seletor do topo; 2) criar Lotes; 3) cadastrar animais em Meu Rebanho; 4) cadastrar Tipos de vacina; 5) registrar vacinações, pesagens, leite e finanças.
- Mãe só aceita fêmeas e pai só aceita machos. Para registrar nascimento, o bezerro já precisa existir no rebanho.
- Ao registrar uma venda de animal, ele fica com situação "vendido" e a receita entra sozinha em Lucros e Investimentos.
- A próxima vacinação é calculada pelo intervalo em dias do tipo de vacina; vencidas aparecem em vermelho e como aviso no Início.
- Previsão de parto vem da inseminação; partos dos próximos 30 dias aparecem no Início.
- Todos os dados são separados por propriedade: se algo "sumiu", confira a propriedade selecionada no topo e o filtro de data (botão "Todos" mostra tudo).
- Listas mostram 25 por página por padrão; dá para mudar no seletor "por página" no rodapé da lista.
- Excluir sempre pede confirmação e não pode ser desfeito.
- Problemas comuns: "não salva" → confira campos obrigatórios marcados e se a sessão não expirou (entrar de novo); "não aparece" → filtro de data/propriedade; tela lenta → use a busca e os filtros.

COMO RESPONDER MELHOR:
- Use os DADOS DA CONTA abaixo para respostas personalizadas (ex.: "Você tem 3 vacinas vencidas, veja em Vacinação"). Nunca invente números que não estejam ali.
- Considere a página onde o usuário está e comece pelo que ele vê na tela.
- Formato: uma frase direta, depois passos numerados curtos com **nomes dos botões em negrito**; termine com uma dica curta quando útil. Evite textos longos.
- Se a pergunta for vaga, responda o mais provável e ofereça uma pergunta de acompanhamento.
- Diferencie demonstrar de executar: você pode orientar e simular, mas não clica, altera ou salva registros pelo chat. Nunca diga que uma ação foi realizada sem confirmação real do sistema.
- Quando pedirem "como anotar", "fazer anotação" ou "me mostre na prática", explique os campos obrigatórios e ofereça explicitamente a demonstração em "Uma função" → "Produção de Leite". Se a pessoa estiver com dificuldade em uma etapa, pergunte qual campo ou mensagem de erro apareceu e continue daquela etapa, sem reiniciar toda a explicação.
- Considere o histórico da conversa para não repetir introduções, adapte a orientação ao que a pessoa já tentou e não trate exemplos da demonstração como dados reais da conta.
- Também pode dar orientações gerais de manejo pecuário (vacinação, pesagem, reprodução, leite), deixando claro que não substitui um veterinário.`;

/**
 * Números da PROPRIEDADE SELECIONADA (os mesmos do Início, via dashboard_resumo). O RLS garante que só entram
 * propriedades da própria pessoa; se o id enviado não for dela, usa a primeira que ela tem.
 */
async function contextoConta(supabase: ReturnType<typeof createClient>, propriedadeId: string | null) {
  try {
    const hoje = dataNoFuso();
    const daqui30 = somarDias(hoje, 30);
    const props = await supabase.from("propriedades" as never).select("id,nome").order("nome" as never).limit(20);
    const lista = ((props.data ?? []) as { id: string; nome: string }[]);
    if (!lista.length) return "\n\nDADOS DA CONTA: a pessoa ainda não cadastrou nenhuma propriedade.";
    const atual = lista.find((p) => p.id === propriedadeId) ?? lista[0];
    const c = (t: string) => supabase.from(t as never).select("id", { count: "exact", head: true }).eq("propriedade_id" as never, atual.id as never);
    const [resumo, vencidas, partos, pesagens] = await Promise.all([
      supabase.rpc("dashboard_resumo" as never, { _propriedade_id: atual.id } as never),
      c("v_vacinacoes_status").eq("status_atual" as never, "vencida" as never),
      c("inseminacoes").gte("previsao_parto" as never, hoje as never).lte("previsao_parto" as never, daqui30 as never).in("situacao" as never, ["em_andamento", "confirmada"] as never),
      c("pesagens"),
    ]);
    const r = (resumo.data ?? {}) as Record<string, unknown>;
    const n = (v: unknown) => (typeof v === "number" ? v.toLocaleString("pt-BR") : "?");
    const reais = (v: unknown) => (typeof v === "number" ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "?");
    const qtd = (x: { count: number | null; error: unknown }) => (x.error ? "?" : (x.count ?? 0).toLocaleString("pt-BR"));
    const outras = lista.length > 1 ? ` A pessoa tem ${lista.length} propriedades: ${lista.map((p) => p.nome).join(", ")}.` : "";
    return `\n\nDADOS DA CONTA (agora, só da propriedade selecionada: ${atual.nome}).${outras}\n` +
      `- Animais ativos: ${n(r.animais_ativos)} · bezerros (até 12 meses): ${n(r.bezerros)} · lotes: ${n(r.total_lotes)}\n` +
      `- Vacinas vencidas (última dose de cada vacina): ${qtd(vencidas)} · vacinações em dia: ${n(r.vacinacoes_em_dia)}\n` +
      `- Inseminações em andamento ou confirmadas: ${n(r.inseminacoes)} · partos previstos em 30 dias: ${qtd(partos)}\n` +
      `- Neste mês: ${n(r.leite_mes)} litros de leite, receitas ${reais(r.receitas_mes)}, despesas ${reais(r.despesas_mes)}, nascimentos ${n(r.nascidos_mes)}\n` +
      `- Pesagens registradas: ${qtd(pesagens)}`;
  } catch (e) {
    console.error("Falha ao carregar contexto da conta", e);
    return "";
  }
}

function respostaErro(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), { status, headers: { "content-type": "application/json" } });
}

export async function handleYuiChat(request: Request) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  const url = process.env["SUPABASE_URL"];
  const pub = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!apiKey || !url || !pub) return respostaErro(500, "A Yui está indisponível no momento.");

  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return respostaErro(401, "Entre na sua conta para falar com a Yui.");
  const token = auth.slice(7);
  const supabase = createClient(url, pub, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: `Bearer ${token}` },
      fetch: (input, init) => { const h = new Headers(init?.headers); h.set("apikey", pub); return fetch(input, { ...init, headers: h }); },
    },
  });
  const { data: u, error: ue } = await supabase.auth.getUser(token);
  if (ue || !u.user) return respostaErro(401, "Sua sessão expirou. Entre novamente.");
  const userId = u.user.id;

  if (!allowRequest(`yui:${userId}`, 15, 60_000, 60_000)) return respostaErro(429, "Muitas mensagens seguidas. Espere um minutinho e tente de novo.");

  if (!(await limiteBanco(`yui-ip:${clientIp(request)}`, 120, 3600))) return respostaErro(429, "Muitas mensagens seguidas. Espere um pouco e tente de novo.");

  let body: { messages?: unknown; pagina?: unknown; propriedade_id?: unknown };
  try { body = await request.json(); } catch { return respostaErro(400, "Mensagem inválida."); }
  const messages = limparHistorico(body.messages);
  const ultima = messages[messages.length - 1];
  if (!ultima || ultima.role !== "user") return respostaErro(400, "Mensagem inválida.");
  const texto = ultima.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
  if (!texto.trim() || texto.length > 4000) return respostaErro(400, "Escreva uma mensagem de até 4000 caracteres.");
  if (!(await ehAdministrador(supabase)) && !(await consumirCotaYui(userId, "mensagem"))) {
    return respostaErro(429, "Você usou as conversas de hoje com a Yui. Amanhã libera de novo.");
  }
  const propriedadeId = typeof body.propriedade_id === "string" && UUID.test(body.propriedade_id) ? body.propriedade_id : null;

  const salvo = await supabase.from("suporte_mensagens" as never).upsert({ user_id: userId, mensagem_id: ultima.id, papel: "user", partes: ultima.parts } as never, { onConflict: "user_id,mensagem_id" });
  if (salvo.error) console.error("Falha ao salvar mensagem do usuário", salvo.error);

  let criadoresInfo = "";
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cfg } = await supabaseAdmin
      .from("configuracoes_sistema" as never)
      .select("valor")
      .eq("chave", "criadores_site")
      .maybeSingle();
    const valor = (cfg as { valor?: unknown } | null)?.valor;
    if (valor) {
      const lista = typeof valor === "string" ? JSON.parse(valor) : valor;
      if (Array.isArray(lista) && lista.length) {
        const descricao = lista
          .map((c: { nome?: string; redes?: { nome?: string; url?: string }[] }) => {
            const redes = Array.isArray(c?.redes)
              ? c.redes.filter((r) => r?.url).map((r) => `${r.nome || "Rede social"}: ${r.url}`).join("; ")
              : "";
            return `- ${c?.nome || "Criador"}${redes ? ` (${redes})` : ""}`;
          })
          .join("\n");
        if (descricao.trim()) {
          criadoresInfo = `\n\nCRIADORES DO SITE (informação oficial — use quando perguntarem quem criou/desenvolveu o sistema):\n${descricao}`;
        }
      }
    }
  } catch (e) {
    console.error("Falha ao carregar criadores do site", e);
  }

  const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
  const provider = createOpenAI({
    baseURL: GATEWAY,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });
  const dadosConta = await contextoConta(supabase as never, propriedadeId);
  const pagina = typeof body.pagina === "string" ? body.pagina.slice(0, 60) : "";
  const result = streamText({
    model: provider.responses(MODEL),
    system: YUI_SYSTEM + criadoresInfo + dadosConta + (pagina ? `\n\nO usuário está agora na página: ${pagina}.` : ""),
    messages: await convertToModelMessages(messages),
    abortSignal: request.signal,
    providerOptions: {
      openai: { forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", store: false, include: ["reasoning.encrypted_content"] },
    },
  });

  return withLovableAiGatewayRunIdHeader(
    result.toUIMessageStreamResponse({
      originalMessages: messages,
      // Sem isto a resposta era salva com id vazio e cada resposta nova apagava a anterior no histórico.
      // Com o id gerado aqui, o navegador recebe o mesmo id e a voz pode ler a resposta salva.
      generateMessageId: () => crypto.randomUUID(),
      sendReasoning: false,
      onFinish: async ({ responseMessage }) => {
        const partes = responseMessage.parts.filter((p) => p.type === "text");
        if (!partes.length) return;
        const r = await supabase.from("suporte_mensagens" as never).upsert({ user_id: userId, mensagem_id: responseMessage.id, papel: "assistant", partes } as never, { onConflict: "user_id,mensagem_id" });
        if (r.error) console.error("Falha ao salvar resposta da Yui", r.error);
      },
      onError: (err) => {
        const s = (err as { statusCode?: number })?.statusCode;
        if (s === 402) return "Os créditos de IA acabaram. Avise o administrador do sistema.";
        if (s === 429) return "A Yui está recebendo muitas perguntas agora. Tente de novo em instantes.";
        console.error("Erro da Yui", err);
        return "A Yui não conseguiu responder agora. Tente novamente.";
      },
    }),
    runIdFetch,
  );
}

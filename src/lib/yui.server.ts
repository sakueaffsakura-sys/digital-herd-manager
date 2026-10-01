import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";
import { createLovableAiGatewayRunIdFetch, getLovableAiGatewayRunId, withLovableAiGatewayRunIdHeader } from "./ai/run-id.server";
import { allowRequest } from "./rate-limit";

const MODEL = "openai/gpt-6-astra";
const GATEWAY = "https://ai.gateway.lovable.dev/v1";

export const YUI_SYSTEM = `Você é a Yui, assistente de suporte do sistema "Pecuária Digital" — um sistema web de gestão pecuária.
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

Se o usuário pedir para conhecer o site todo, sugira "Tour completo"; se quiser apenas uma área, sugira "Uma função" acima do chat.`;

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

  let body: { messages?: UIMessage[]; pagina?: string };
  try { body = await request.json(); } catch { return respostaErro(400, "Mensagem inválida."); }
  const messages = Array.isArray(body.messages) ? body.messages.slice(-30) : [];
  const ultima = messages[messages.length - 1];
  if (!ultima || ultima.role !== "user") return respostaErro(400, "Mensagem inválida.");
  const texto = ultima.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
  if (!texto.trim() || texto.length > 4000) return respostaErro(400, "Escreva uma mensagem de até 4000 caracteres.");

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
  const pagina = typeof body.pagina === "string" ? body.pagina.slice(0, 60) : "";
  const result = streamText({
    model: provider.responses(MODEL),
    system: YUI_SYSTEM + (pagina ? `\n\nO usuário está agora na página: ${pagina}.` : ""),
    messages: await convertToModelMessages(messages),
    abortSignal: request.signal,
    providerOptions: {
      openai: { forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", store: false, include: ["reasoning.encrypted_content"] },
    },
  });

  return withLovableAiGatewayRunIdHeader(
    result.toUIMessageStreamResponse({
      originalMessages: messages,
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

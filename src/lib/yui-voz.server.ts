// Voz realista da Yui via Lovable AI Gateway (Gemini TTS) — retorna WAV completo.
import { createClient } from "@supabase/supabase-js";
import { allowRequest } from "./rate-limit";

const GATEWAY = "https://ai.gateway.lovable.dev";
const MODEL = "google/gemini-3.1-flash-tts-preview";
const VOICE = "Callirrhoe";

function respostaErro(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), { status, headers: { "content-type": "application/json" } });
}

export async function handleYuiVoz(request: Request) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  const url = process.env["SUPABASE_URL"];
  const pub = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!apiKey || !url || !pub) return respostaErro(500, "A voz da Yui está indisponível no momento.");

  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return respostaErro(401, "Entre na sua conta para ouvir a Yui.");
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

  if (!allowRequest(`yui-voz:${u.user.id}`, 90, 60_000, 30_000)) return respostaErro(429, "Muitas falas seguidas. Espere um minutinho.");

  let texto: string;
  try {
    const body = (await request.json()) as { texto?: string };
    texto = typeof body.texto === "string" ? body.texto.trim() : "";
  } catch { return respostaErro(400, "Pedido inválido."); }
  if (!texto || texto.length > 1500) return respostaErro(400, "Texto inválido.");

  // Controlador próprio: o cancelamento do navegador chega via stream.cancel(), sem rejeição solta.
  const upstreamAbort = new AbortController();
  let upstream: Response;
  try {
    upstream = await fetch(`${GATEWAY}/v1/audio/speech`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        contents: [{ role: "user", parts: [{ text: `Fale o texto a seguir em português do Brasil com voz feminina jovem, leve e espontânea, como uma amiga explicando algo com naturalidade. Ritmo de conversa real, com pequenas variações de velocidade e pausas naturais entre as frases. Tom amigável e descontraído, sem soar formal, robótica, teatral ou como locutora de anúncio. Não acrescente nem altere palavras. Texto: ${texto}` }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } },
        },
        stream_format: "audio",
      }),
      signal: upstreamAbort.signal,
    });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") return new Response(null, { status: 499 });
    console.error("Falha na voz da Yui", err);
    return respostaErro(502, "A voz da Yui falhou. Tente de novo.");
  }

  if (!upstream.ok || !upstream.body) {
    const corpo = await upstream.text().catch(() => "");
    console.error(`Voz da Yui: erro ${upstream.status}: ${corpo}`);
    if (upstream.status === 402) return respostaErro(402, "Os créditos de IA acabaram. Avise o administrador do sistema.");
    if (upstream.status === 429) return respostaErro(429, "A Yui está falando com muita gente agora. Tente em instantes.");
    return respostaErro(502, "A voz da Yui falhou. Tente de novo.");
  }

  // Repassa o áudio engolindo cancelamentos (usuário parou a voz) para não virar erro sem tratamento.
  const reader = upstream.body.getReader();
  const seguro = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) controller.close();
        else controller.enqueue(value);
      } catch (err) {
        if ((err as Error)?.name !== "AbortError") console.error("Voz da Yui interrompida", err);
        try { controller.close(); } catch { /* já fechado */ }
      }
    },
    cancel() {
      reader.cancel().catch(() => {});
      upstreamAbort.abort();
    },
  });

  return new Response(seguro, {
    status: 200,
    headers: { "content-type": upstream.headers.get("content-type") ?? "audio/wav", "cache-control": "no-cache" },
  });
}

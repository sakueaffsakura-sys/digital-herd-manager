// Previsão do tempo pelo Open-Meteo (gratuito, sem chave). O site faz o pedido pelo servidor:
// assim o endereço de quem usa não vai para fora e uma mesma região é consultada uma vez por hora.
import { allowRequest } from "./rate-limit";
import { clienteDoSite, falha, resposta } from "./conta.server";

type Cache = { ate: number; corpo: unknown };
const cache = new Map<string, Cache>();
const UMA_HORA = 3_600_000;

function guardar(chave: string, corpo: unknown) {
  if (cache.size > 500) cache.clear();
  cache.set(chave, { ate: Date.now() + UMA_HORA, corpo });
}

async function exigirUsuario(request: Request, limitePorMinuto: number) {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return falha(401, "Entre na sua conta para continuar.");
  const token = auth.slice(7).trim();
  const supabase = clienteDoSite(token);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return falha(401, "Sua sessão expirou. Entre novamente.");
  if (!allowRequest(`clima:${data.user.id}`, limitePorMinuto, 60_000, 60_000)) return falha(429, "Muitos pedidos. Espere um minuto.");
  return data.user.id;
}

/** GET /api/clima/lugares?nome=Patos de Minas → lista de cidades com coordenadas. */
export async function handleLugares(request: Request) {
  const u = await exigirUsuario(request, 30);
  if (u instanceof Response) return u;
  const nome = (new URL(request.url).searchParams.get("nome") ?? "").trim().slice(0, 60);
  if (nome.length < 3) return falha(400, "Escreva pelo menos 3 letras do nome da cidade.");
  const chave = `lugar:${nome.toLowerCase()}`;
  const guardado = cache.get(chave);
  if (guardado && guardado.ate > Date.now()) return resposta(200, guardado.corpo);
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(nome)}&count=8&language=pt&format=json&country=BR`;
  let dados: { results?: { name: string; admin1?: string; latitude: number; longitude: number }[] };
  try {
    const r = await fetch(url, { headers: { accept: "application/json" } });
    if (!r.ok) return falha(502, "Não foi possível buscar a cidade agora.");
    dados = (await r.json()) as typeof dados;
  } catch {
    return falha(502, "Não foi possível buscar a cidade agora.");
  }
  const corpo = {
    ok: true,
    lugares: (dados.results ?? []).slice(0, 8).map((l) => ({
      nome: l.name, estado: l.admin1 ?? null,
      lat: Math.round(l.latitude * 1000) / 1000, lon: Math.round(l.longitude * 1000) / 1000,
    })),
  };
  guardar(chave, corpo);
  return resposta(200, corpo);
}

/** GET /api/clima?lat=&lon= → agora e os próximos 7 dias. */
export async function handleClima(request: Request) {
  const u = await exigirUsuario(request, 30);
  if (u instanceof Response) return u;
  const p = new URL(request.url).searchParams;
  const lat = Number(p.get("lat")), lon = Number(p.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return falha(400, "Lugar inválido.");
  // Arredondar junta vizinhos no mesmo cache (≈1 km) e tira precisão desnecessária do endereço.
  const rl = Math.round(lat * 100) / 100, rn = Math.round(lon * 100) / 100;
  const chave = `clima:${rl},${rn}`;
  const guardado = cache.get(chave);
  if (guardado && guardado.ate > Date.now()) return resposta(200, guardado.corpo);
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${rl}&longitude=${rn}`
    + "&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code"
    + "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max"
    + "&timezone=America%2FSao_Paulo&forecast_days=7";
  let dados: {
    current?: Record<string, number>;
    daily?: { time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_sum: number[]; precipitation_probability_max: (number | null)[] };
  };
  try {
    const r = await fetch(url, { headers: { accept: "application/json" } });
    if (!r.ok) return falha(502, "Não foi possível ver o tempo agora.");
    dados = (await r.json()) as typeof dados;
  } catch {
    return falha(502, "Não foi possível ver o tempo agora.");
  }
  const d = dados.daily;
  const corpo = {
    ok: true,
    agora: dados.current
      ? {
          temperatura: dados.current["temperature_2m"] ?? null,
          umidade: dados.current["relative_humidity_2m"] ?? null,
          chuva: dados.current["precipitation"] ?? null,
          vento: dados.current["wind_speed_10m"] ?? null,
          codigo: dados.current["weather_code"] ?? null,
        }
      : null,
    dias: (d?.time ?? []).map((dia, i) => ({
      dia,
      codigo: d!.weather_code[i] ?? null,
      max: d!.temperature_2m_max[i] ?? null,
      min: d!.temperature_2m_min[i] ?? null,
      chuva_mm: d!.precipitation_sum[i] ?? null,
      chance_chuva: d!.precipitation_probability_max[i] ?? null,
    })),
  };
  guardar(chave, corpo);
  return resposta(200, corpo);
}

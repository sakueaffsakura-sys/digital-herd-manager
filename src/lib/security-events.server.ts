// Registro de eventos de segurança (bloqueios por excesso de acesso / possível DoS-DDoS).
// Agrega em memória por instância e grava no banco no máximo a cada 15s para não
// virar, ele mesmo, uma fonte de carga durante um ataque.
type Pendente = { tipo: string; severidade: "info" | "aviso" | "critico"; ip: string; caminho: string; quantidade: number; detalhe: string };
const pendentes = new Map<string, Pendente>();
let ultimoEnvio = 0;
let enviando = false;

// Contador global de requisições por instância (detecta picos distribuídos, típicos de DDoS).
let janelaGlobal = { inicio: Date.now(), total: 0, alertado: false };
const LIMITE_GLOBAL_MIN = 3000;

const mascararIp = (ip: string) => {
  if (ip.includes(".")) return ip.split(".").slice(0, 3).join(".") + ".x";
  if (ip.includes(":")) return ip.split(":").slice(0, 4).join(":") + ":…";
  return ip;
};

export function registrarEvento(e: Omit<Pendente, "quantidade" | "ip"> & { ip: string }) {
  const ip = mascararIp(e.ip);
  const chave = `${e.tipo}|${ip}|${e.caminho}`;
  const atual = pendentes.get(chave);
  if (atual) {
    atual.quantidade++;
    if (e.severidade === "critico") atual.severidade = "critico";
  } else if (pendentes.size < 500) {
    pendentes.set(chave, { ...e, ip, quantidade: 1 });
  }
  void enviar();
}

export function contarRequisicao(ip: string, caminho: string) {
  const agora = Date.now();
  if (agora - janelaGlobal.inicio > 60_000) janelaGlobal = { inicio: agora, total: 0, alertado: false };
  janelaGlobal.total++;
  if (janelaGlobal.total > LIMITE_GLOBAL_MIN && !janelaGlobal.alertado) {
    janelaGlobal.alertado = true;
    registrarEvento({ tipo: "pico_global", severidade: "critico", ip, caminho, detalhe: `Mais de ${LIMITE_GLOBAL_MIN} requisições por minuto em um servidor — possível DDoS.` });
  }
}

async function enviar() {
  const agora = Date.now();
  if (enviando || agora - ultimoEnvio < 15_000 || pendentes.size === 0) return;
  enviando = true;
  ultimoEnvio = agora;
  const lote = [...pendentes.values()];
  pendentes.clear();
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin.from("eventos_seguranca" as never) as unknown as { insert: (r: unknown) => Promise<unknown> }).insert(lote);
  } catch (err) {
    console.error("Falha ao registrar eventos de segurança", err);
  } finally {
    enviando = false;
  }
}

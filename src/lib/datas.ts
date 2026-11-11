/**
 * Datas "de calendário" (AAAA-MM-DD) sem surpresas de fuso horário.
 *
 * `new Date().toISOString().slice(0, 10)` devolve a data em UTC: no Brasil
 * (UTC-3/UTC-4) depois das 21h/20h isso já é o dia seguinte, e um registro
 * feito à noite saía com a data de amanhã. Aqui a data é sempre a do relógio
 * de quem está usando (navegador) ou a de um fuso fixo (servidor).
 */

export const FUSO_PADRAO = "America/Sao_Paulo";

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Data local (relógio do navegador) no formato AAAA-MM-DD. */
export function dataLocalISO(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Mês local no formato AAAA-MM. */
export function mesLocalISO(d: Date = new Date()): string {
  return dataLocalISO(d).slice(0, 7);
}

/**
 * Data em um fuso específico (para código que roda no servidor, onde o
 * relógio é UTC). `sv-SE` formata como AAAA-MM-DD.
 */
export function dataNoFuso(d: Date = new Date(), fuso: string = FUSO_PADRAO): string {
  try {
    return new Intl.DateTimeFormat("sv-SE", {
      timeZone: fuso,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    return dataLocalISO(d);
  }
}

export function diasNoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/** Confere se ano/mês/dia formam uma data real (rejeita 31/02, mês 13, etc.). */
export function dataValida(ano: number, mes: number, dia: number): boolean {
  if (![ano, mes, dia].every(Number.isInteger)) return false;
  if (ano < 1900 || ano > 2100) return false;
  if (mes < 1 || mes > 12) return false;
  return dia >= 1 && dia <= diasNoMes(ano, mes);
}

/** Confere uma string AAAA-MM-DD. */
export function isoValido(iso: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return !!m && dataValida(Number(m[1]), Number(m[2]), Number(m[3]));
}

/** Soma dias a uma data AAAA-MM-DD (aritmética de calendário, sem fuso). */
export function somarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(a, m - 1, d + dias));
  return `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}-${pad2(t.getUTCDate())}`;
}

/**
 * Quanto o relógio de Brasília está atrasado em relação ao UTC, em minutos, naquele
 * instante. Vem do fuso, e não de um "-3" escrito à mão, porque horário de verão já
 * existiu no Brasil e pode voltar.
 */
function deslocamentoDoFuso(d: Date, fuso: string): number {
  try {
    const texto = new Intl.DateTimeFormat("en-US", { timeZone: fuso, timeZoneName: "longOffset" })
      .formatToParts(d)
      .find((p) => p.type === "timeZoneName")?.value ?? "GMT+00:00";
    const m = /GMT([+-])(\d{2}):(\d{2})/.exec(texto);
    if (!m) return 0;
    return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
  } catch {
    return 0;
  }
}

/**
 * O instante em que começa um dia do calendário brasileiro.
 *
 * Serve para comparar com coluna de data E hora, que o banco guarda em UTC: o dia 1º de
 * novembro no Brasil começa às 03:00 UTC, então quem comparar com "2026-11-01 00:00" pega
 * três horas do mês anterior.
 */
export function inicioDoDiaNoFuso(iso: string, fuso: string = FUSO_PADRAO): Date {
  const [a, m, d] = iso.split("-").map(Number);
  const palpite = Date.UTC(a, m - 1, d);
  const desloc = deslocamentoDoFuso(new Date(palpite), fuso);
  return new Date(palpite - desloc * 60_000);
}

/**
 * A mesma data, `meses` meses antes. Conta mês de calendário, como o banco: 12 meses
 * antes de 11/11/2026 é 11/11/2025, e não 365 dias atrás. Quando o dia não existe no mês
 * de destino (31 de março menos um mês), cai no último dia daquele mês.
 */
export function mesesAntes(iso: string, meses: number): string {
  const [a, m, d] = iso.split("-").map(Number);
  const total = a * 12 + (m - 1) - meses;
  const ano = Math.floor(total / 12);
  const mes = (total % 12 + 12) % 12 + 1;
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return `${ano}-${pad2(mes)}-${pad2(Math.min(d, ultimoDia))}`;
}

/** Primeiro dia do mês de uma data AAAA-MM-DD. */
export function primeiroDiaDe(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

/** Primeiro dia do mês seguinte ao de uma data AAAA-MM-DD. */
export function primeiroDiaDoMesSeguinte(iso: string): string {
  const [a, m] = iso.split("-").map(Number);
  return m === 12 ? `${a + 1}-01-01` : `${a}-${pad2(m + 1)}-01`;
}

/**
 * Semana do ano no padrão ISO 8601 ("2026-46"), igual ao `to_char(data, 'IYYY-IW')` do
 * PostgreSQL: a semana começa na segunda e pertence ao ano que tem a quinta-feira dela.
 */
export function semanaISO(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  const dia = new Date(Date.UTC(a, m - 1, d));
  const diaDaSemana = (dia.getUTCDay() + 6) % 7; // 0 = segunda
  const quinta = new Date(dia.getTime() + (3 - diaDaSemana) * 86_400_000);
  const ano = quinta.getUTCFullYear();
  const primeiraQuinta = new Date(Date.UTC(ano, 0, 4));
  const deslocPrimeira = (primeiraQuinta.getUTCDay() + 6) % 7;
  const segundaDaSemana1 = new Date(primeiraQuinta.getTime() - deslocPrimeira * 86_400_000);
  const semana = Math.round((quinta.getTime() - segundaDaSemana1.getTime()) / (7 * 86_400_000)) + 1;
  return `${ano}-${pad2(semana)}`;
}

/** Primeiro dia do mês `deslocamento` meses antes/depois de `base` (local). */
export function primeiroDiaDoMes(deslocamento = 0, base: Date = new Date()): string {
  const d = new Date(base.getFullYear(), base.getMonth() + deslocamento, 1);
  return dataLocalISO(d);
}

/** "2026-03-15" (ou "2026-03-15T10:00:00Z") -> "15/03/2026", sem passar por Date (sem erro de fuso). */
export function formatarDataBR(valor: unknown): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(valor ?? ""));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "—";
}

/** Momento com hora (timestamptz) -> "31/10/2026" no horário de Brasília (não vira o dia às 21h). */
export function diaBR(valor: unknown): string {
  if (valor == null || valor === "") return "—";
  const d = new Date(String(valor));
  return Number.isNaN(d.getTime()) ? "—" : formatarDataBR(dataNoFuso(d));
}

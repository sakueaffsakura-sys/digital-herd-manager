/**
 * Contas do dia a dia da fazenda. Funções puras (sem tela, sem banco) para poderem ser testadas.
 * Todas devolvem `null` quando falta dado ou o número não faz sentido, em vez de NaN.
 */

const ok = (...valores: (number | null | undefined)[]) =>
  valores.every((v) => typeof v === "number" && Number.isFinite(v));

/** Lê número digitado em português ("1.234,5" ou "12,5"). Devolve null se não der. */
export function lerNumero(texto: string): number | null {
  const limpo = texto.trim().replace(/\s/g, "");
  if (!limpo) return null;
  const n = Number(limpo.replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/**
 * Dose do medicamento pelo peso: "1 mL para cada X kg".
 * Ex.: 320 kg com 1 mL/50 kg = 6,4 mL.
 */
export function dosePorPeso(pesoKg: number | null, kgPorMl: number | null): number | null {
  if (!ok(pesoKg, kgPorMl) || pesoKg! <= 0 || kgPorMl! <= 0) return null;
  return pesoKg! / kgPorMl!;
}

/**
 * Quadrado de Pearson: quanto usar de cada alimento para chegar na proteína desejada.
 * Devolve a parte (0 a 1) de cada um. O desejado precisa ficar entre os dois.
 */
export function quadradoPearson(
  altoPct: number | null, baixoPct: number | null, desejadoPct: number | null,
): { parteAlto: number; parteBaixo: number } | null {
  if (!ok(altoPct, baixoPct, desejadoPct)) return null;
  const alto = altoPct!, baixo = baixoPct!, alvo = desejadoPct!;
  if (alto <= baixo) return null;
  if (alvo < baixo || alvo > alto) return null;
  const total = alto - baixo;
  const parteAlto = (alvo - baixo) / total;
  return { parteAlto, parteBaixo: 1 - parteAlto };
}

/**
 * Calagem: quantas toneladas de calcário por hectare.
 * NC = (V2 − V1) × CTC ÷ 100, corrigido pelo PRNT. V em %, CTC em cmolc/dm³.
 */
export function calagem(
  ctc: number | null, vAtual: number | null, vDesejado: number | null, prnt: number | null,
): number | null {
  if (!ok(ctc, vAtual, vDesejado, prnt) || ctc! <= 0 || prnt! <= 0) return null;
  if (vDesejado! <= vAtual!) return 0;
  const necessidade = ((vDesejado! - vAtual!) * ctc!) / 100;
  return (necessidade * 100) / prnt!;
}

/** Uma UA (unidade animal) são 450 kg de peso vivo. */
export const KG_POR_UA = 450;

/** Lotação: UA por hectare e peso vivo total. */
export function lotacao(
  animais: number | null, pesoMedioKg: number | null, hectares: number | null,
): { ua: number; uaPorHa: number; kgPorHa: number } | null {
  if (!ok(animais, pesoMedioKg, hectares) || animais! < 0 || pesoMedioKg! <= 0 || hectares! <= 0) return null;
  const pesoTotal = animais! * pesoMedioKg!;
  const ua = pesoTotal / KG_POR_UA;
  return { ua, uaPorHa: ua / hectares!, kgPorHa: pesoTotal / hectares! };
}

/** Uma arroba são 15 kg de carcaça. */
export const KG_POR_ARROBA = 15;

/**
 * Peso vivo para arrobas de carcaça, pelo rendimento (em %).
 * Ex.: 480 kg com 52% = 249,6 kg de carcaça = 16,64 arrobas.
 */
export function pesoVivoParaArrobas(pesoVivoKg: number | null, rendimentoPct: number | null): { carcacaKg: number; arrobas: number } | null {
  if (!ok(pesoVivoKg, rendimentoPct) || pesoVivoKg! <= 0 || rendimentoPct! <= 0 || rendimentoPct! > 100) return null;
  const carcacaKg = (pesoVivoKg! * rendimentoPct!) / 100;
  return { carcacaKg, arrobas: carcacaKg / KG_POR_ARROBA };
}

/** Arrobas de carcaça de volta para peso vivo. */
export function arrobasParaPesoVivo(arrobas: number | null, rendimentoPct: number | null): number | null {
  if (!ok(arrobas, rendimentoPct) || arrobas! <= 0 || rendimentoPct! <= 0 || rendimentoPct! > 100) return null;
  return (arrobas! * KG_POR_ARROBA * 100) / rendimentoPct!;
}

/** Quanto rende a venda: arrobas × preço da arroba. */
export function valorDaVenda(arrobas: number | null, precoArroba: number | null): number | null {
  if (!ok(arrobas, precoArroba) || arrobas! < 0 || precoArroba! < 0) return null;
  return arrobas! * precoArroba!;
}

/** Data prevista do parto: dia da cobertura + dias de gestação (283 no gado de leite). */
export function previsaoParto(dataISO: string, diasGestacao = 283): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dataISO);
  if (!m || !Number.isFinite(diasGestacao) || diasGestacao < 150 || diasGestacao > 400) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + Math.round(diasGestacao));
  return d.toISOString().slice(0, 10);
}

/** Quanto de ração por dia: % do peso vivo. Ex.: 450 kg a 2,5% = 11,25 kg. */
export function racaoPorDia(pesoKg: number | null, pctPesoVivo: number | null, animais = 1): { porAnimal: number; total: number } | null {
  if (!ok(pesoKg, pctPesoVivo, animais) || pesoKg! <= 0 || pctPesoVivo! <= 0 || animais < 1) return null;
  const porAnimal = (pesoKg! * pctPesoVivo!) / 100;
  return { porAnimal, total: porAnimal * animais };
}

/**
 * Código de 6 dígitos que muda a cada 30 segundos (o mesmo do Google Authenticator).
 *
 * Feito com o que o Node já traz, sem biblioteca nova. O cálculo segue as normas
 * RFC 4226 (o código a partir de um contador) e RFC 6238 (o contador a partir do relógio),
 * e os testes conferem os valores de exemplo que as próprias normas publicam.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; // base32, como manda a norma
export const PASSO_SEGUNDOS = 30;
export const DIGITOS = 6;

/** Segredo novo, em base32, para mostrar no QR Code e guardar cifrado. */
export function novoSegredo(bytes = 20): string {
  return paraBase32(randomBytes(bytes));
}

export function paraBase32(dados: Uint8Array): string {
  let bits = 0;
  let valor = 0;
  let saida = "";
  for (const b of dados) {
    valor = (valor << 8) | b;
    bits += 8;
    while (bits >= 5) {
      saida += ALFABETO[(valor >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) saida += ALFABETO[(valor << (5 - bits)) & 31];
  return saida;
}

export function deBase32(texto: string): Buffer {
  const limpo = texto.toUpperCase().replace(/[=\s-]/g, "");
  let bits = 0;
  let valor = 0;
  const saida: number[] = [];
  for (const c of limpo) {
    const i = ALFABETO.indexOf(c);
    if (i < 0) throw new Error("Segredo inválido.");
    valor = (valor << 5) | i;
    bits += 5;
    if (bits >= 8) {
      saida.push((valor >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(saida);
}

/** Código para um contador (RFC 4226). */
export function codigoDoContador(segredoBase32: string, contador: number, digitos = DIGITOS): string {
  const bloco = Buffer.alloc(8);
  bloco.writeBigUInt64BE(BigInt(contador));
  const mac = createHmac("sha1", deBase32(segredoBase32)).update(bloco).digest();
  const inicio = mac[mac.length - 1]! & 0x0f;
  const numero = ((mac[inicio]! & 0x7f) << 24) | (mac[inicio + 1]! << 16) | (mac[inicio + 2]! << 8) | mac[inicio + 3]!;
  return String(numero % 10 ** digitos).padStart(digitos, "0");
}

/** Código válido agora (RFC 6238). */
export function codigoAgora(segredoBase32: string, agoraMs = Date.now(), digitos = DIGITOS): string {
  return codigoDoContador(segredoBase32, Math.floor(agoraMs / 1000 / PASSO_SEGUNDOS), digitos);
}

/**
 * Confere o código digitado, aceitando uma janela para trás e para frente:
 * o relógio do celular quase nunca bate exatamente com o do servidor.
 * A comparação é feita em tempo constante para não vazar o código por medida de tempo.
 */
export function conferirCodigo(segredoBase32: string, digitado: string, agoraMs = Date.now(), janela = 1): boolean {
  const limpo = (digitado ?? "").replace(/\D/g, "");
  if (limpo.length !== DIGITOS) return false;
  const base = Math.floor(agoraMs / 1000 / PASSO_SEGUNDOS);
  const alvo = Buffer.from(limpo);
  let bateu = false;
  for (let d = -janela; d <= janela; d++) {
    const esperado = Buffer.from(codigoDoContador(segredoBase32, base + d));
    if (esperado.length === alvo.length && timingSafeEqual(esperado, alvo)) bateu = true;
  }
  return bateu;
}

/** Endereço que vira QR Code no aplicativo de códigos. */
export function enderecoDoQr(segredoBase32: string, email: string, sistema = "Pecuária Digital"): string {
  const conta = encodeURIComponent(`${sistema}:${email}`);
  const params = new URLSearchParams({ secret: segredoBase32, issuer: sistema, algorithm: "SHA1", digits: String(DIGITOS), period: String(PASSO_SEGUNDOS) });
  return `otpauth://totp/${conta}?${params.toString()}`;
}

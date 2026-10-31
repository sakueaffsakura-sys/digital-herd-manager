/**
 * Gerador de QR Code (modo byte, correção M), sem biblioteca de fora.
 * Devolve uma matriz de true/false; quem desenha decide se vira SVG, canvas ou blocos.
 * Cobre as versões 1 a 10, o bastante para um endereço de site.
 */

// Quantos bytes de dados cabem em cada versão (correção M).
const CAPACIDADE_M = [0, 14, 26, 42, 62, 84, 106, 122, 152, 180, 213];
// Por versão: [bytes de correção por bloco, blocos do grupo 1, bytes do grupo 1, blocos do grupo 2, bytes do grupo 2]
const BLOCOS_M: Record<number, [number, number, number, number, number]> = {
  1: [10, 1, 16, 0, 0],
  2: [16, 1, 28, 0, 0],
  3: [26, 1, 44, 0, 0],
  4: [18, 2, 32, 0, 0],
  5: [24, 2, 43, 0, 0],
  6: [16, 4, 27, 0, 0],
  7: [18, 4, 31, 0, 0],
  8: [22, 2, 38, 2, 39],
  9: [22, 3, 36, 2, 37],
  10: [26, 4, 43, 1, 44],
};
// Centros dos padrões de alinhamento por versão.
const ALINHAMENTO: Record<number, number[]> = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
  6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
};

// ---------- GF(256) ----------
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();
const mul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

/** Polinômio gerador para `grau` bytes de correção. */
function gerador(grau: number): number[] {
  let g = [1];
  for (let i = 0; i < grau; i++) {
    const novo = new Array<number>(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) {
      novo[j] ^= mul(g[j], 1);
      novo[j + 1] ^= mul(g[j], EXP[i]);
    }
    g = novo;
  }
  return g;
}

/** Bytes de correção de um bloco. */
function correcao(dados: number[], quantos: number): number[] {
  const g = gerador(quantos);
  const resto = [...dados, ...new Array<number>(quantos).fill(0)];
  for (let i = 0; i < dados.length; i++) {
    const coef = resto[i];
    if (coef === 0) continue;
    for (let j = 0; j < g.length; j++) resto[i + j] ^= mul(g[j], coef);
  }
  return resto.slice(dados.length);
}

// ---------- Informação de formato (BCH 15,5) ----------
function bitsDoFormato(mascara: number): number {
  // 00 = correção M.
  const dados = (0b00 << 3) | mascara;
  let resto = dados << 10;
  for (let i = 14; i >= 10; i--) if (resto & (1 << i)) resto ^= 0b10100110111 << (i - 10);
  return ((dados << 10) | resto) ^ 0b101010000010010;
}

/** Informação de versão (só a partir da 7). */
function bitsDaVersao(versao: number): number {
  let resto = versao << 12;
  for (let i = 17; i >= 12; i--) if (resto & (1 << i)) resto ^= 0b1111100100101 << (i - 12);
  return (versao << 12) | resto;
}

type Mat = { m: (boolean | null)[][]; reservado: boolean[][]; n: number };

function novaMatriz(versao: number): Mat {
  const n = versao * 4 + 17;
  return {
    n,
    m: Array.from({ length: n }, () => new Array<boolean | null>(n).fill(null)),
    reservado: Array.from({ length: n }, () => new Array<boolean>(n).fill(false)),
  };
}

function por(mat: Mat, linha: number, coluna: number, valor: boolean, reserva = true) {
  if (linha < 0 || coluna < 0 || linha >= mat.n || coluna >= mat.n) return;
  mat.m[linha][coluna] = valor;
  if (reserva) mat.reservado[linha][coluna] = true;
}

function padroesFixos(mat: Mat, versao: number) {
  const n = mat.n;
  const finder = (l0: number, c0: number) => {
    for (let l = -1; l <= 7; l++) {
      for (let c = -1; c <= 7; c++) {
        const dentro = l >= 0 && l <= 6 && c >= 0 && c <= 6;
        const escuro = dentro && (l === 0 || l === 6 || c === 0 || c === 6 || (l >= 2 && l <= 4 && c >= 2 && c <= 4));
        por(mat, l0 + l, c0 + c, escuro);
      }
    }
  };
  finder(0, 0); finder(0, n - 7); finder(n - 7, 0);
  // Linhas de tempo.
  for (let i = 8; i < n - 8; i++) {
    por(mat, 6, i, i % 2 === 0);
    por(mat, i, 6, i % 2 === 0);
  }
  // Alinhamento (nunca por cima dos finders).
  const centros = ALINHAMENTO[versao] ?? [];
  for (const l0 of centros) {
    for (const c0 of centros) {
      const perto = (l: number, c: number) => (l < 8 && c < 8) || (l < 8 && c > n - 9) || (l > n - 9 && c < 8);
      if (perto(l0, c0)) continue;
      for (let l = -2; l <= 2; l++) {
        for (let c = -2; c <= 2; c++) {
          por(mat, l0 + l, c0 + c, Math.max(Math.abs(l), Math.abs(c)) !== 1);
        }
      }
    }
  }
  // Espaço do formato (preenchido depois). Em baixo, a coluna só vai até a linha n-7:
  // a linha n-8 é o módulo que fica sempre escuro.
  for (let i = 0; i < 9; i++) {
    if (i !== 6) { por(mat, 8, i, false); por(mat, i, 8, false); }
  }
  for (let i = 0; i < 8; i++) por(mat, 8, n - 1 - i, false);
  for (let i = 0; i < 7; i++) por(mat, n - 1 - i, 8, false);
  // Módulo sempre escuro (fica entre as duas partes do formato de baixo).
  por(mat, n - 8, 8, true);
  // Espaço da versão.
  if (versao >= 7) {
    for (let i = 0; i < 18; i++) {
      const l = Math.floor(i / 3), c = i % 3;
      por(mat, l, n - 11 + c, false);
      por(mat, n - 11 + c, l, false);
    }
  }
}

function escreverFormato(mat: Mat, mascara: number) {
  const n = mat.n;
  const bits = bitsDoFormato(mascara);
  const bit = (i: number) => ((bits >> i) & 1) === 1;
  // Primeira cópia, em volta do olho de cima à esquerda (linha, coluna).
  for (let i = 0; i <= 5; i++) por(mat, i, 8, bit(i));
  por(mat, 7, 8, bit(6));
  por(mat, 8, 8, bit(7));
  por(mat, 8, 7, bit(8));
  for (let i = 9; i <= 14; i++) por(mat, 8, 14 - i, bit(i));
  // Segunda cópia, repartida entre os outros dois olhos.
  for (let i = 0; i <= 7; i++) por(mat, 8, n - 1 - i, bit(i));
  for (let i = 8; i <= 14; i++) por(mat, n - 15 + i, 8, bit(i));
}

function escreverVersao(mat: Mat, versao: number) {
  if (versao < 7) return;
  const n = mat.n;
  const bits = bitsDaVersao(versao);
  for (let i = 0; i < 18; i++) {
    const b = ((bits >> i) & 1) === 1;
    const l = Math.floor(i / 3), c = i % 3;
    por(mat, l, n - 11 + c, b);
    por(mat, n - 11 + c, l, b);
  }
}

const MASCARAS: ((l: number, c: number) => boolean)[] = [
  (l, c) => (l + c) % 2 === 0,
  (l) => l % 2 === 0,
  (_l, c) => c % 3 === 0,
  (l, c) => (l + c) % 3 === 0,
  (l, c) => (Math.floor(l / 2) + Math.floor(c / 3)) % 2 === 0,
  (l, c) => ((l * c) % 2) + ((l * c) % 3) === 0,
  (l, c) => (((l * c) % 2) + ((l * c) % 3)) % 2 === 0,
  (l, c) => (((l + c) % 2) + ((l * c) % 3)) % 2 === 0,
];

/** Penalidade das regras 1 a 4, para escolher a melhor máscara. */
function penalidade(m: boolean[][]): number {
  const n = m.length;
  let p = 0;
  const linhaOuColuna = (pegar: (i: number, j: number) => boolean) => {
    for (let i = 0; i < n; i++) {
      let contagem = 1;
      for (let j = 1; j < n; j++) {
        if (pegar(i, j) === pegar(i, j - 1)) {
          contagem++;
        } else {
          if (contagem >= 5) p += contagem - 2;
          contagem = 1;
        }
      }
      if (contagem >= 5) p += contagem - 2;
    }
  };
  linhaOuColuna((i, j) => m[i][j]);
  linhaOuColuna((i, j) => m[j][i]);
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < n - 1; j++) {
      const a = m[i][j];
      if (a === m[i][j + 1] && a === m[i + 1][j] && a === m[i + 1][j + 1]) p += 3;
    }
  }
  const padrao = [true, false, true, true, true, false, true, false, false, false, false];
  const invertido = [false, false, false, false, true, false, true, true, true, false, true];
  const bate = (vals: boolean[], alvo: boolean[]) => alvo.every((v, k) => vals[k] === v);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= n - 11; j++) {
      const linha = Array.from({ length: 11 }, (_, k) => m[i][j + k]);
      const coluna = Array.from({ length: 11 }, (_, k) => m[j + k][i]);
      if (bate(linha, padrao) || bate(linha, invertido)) p += 40;
      if (bate(coluna, padrao) || bate(coluna, invertido)) p += 40;
    }
  }
  let escuros = 0;
  for (const linha of m) for (const v of linha) if (v) escuros++;
  const pct = (escuros * 100) / (n * n);
  p += Math.floor(Math.abs(pct - 50) / 5) * 10;
  return p;
}

/** Texto → matriz de módulos (true = escuro). Lança se o texto não couber até a versão 10. */
export function gerarQr(texto: string): boolean[][] {
  const bytes = [...new TextEncoder().encode(texto)];
  const versao = CAPACIDADE_M.findIndex((cap, i) => i > 0 && bytes.length <= cap);
  if (versao < 1) throw new Error("Texto grande demais para o QR Code.");
  const [ecPorBloco, b1, d1, b2, d2] = BLOCOS_M[versao];
  const totalDados = b1 * d1 + b2 * d2;

  // 1) Fila de bits: modo byte, tamanho, dados, terminador e enchimento.
  const bits: number[] = [];
  const empurrar = (valor: number, quantos: number) => {
    for (let i = quantos - 1; i >= 0; i--) bits.push((valor >> i) & 1);
  };
  empurrar(0b0100, 4);
  empurrar(bytes.length, versao >= 10 ? 16 : 8);
  for (const b of bytes) empurrar(b, 8);
  for (let i = 0; i < 4 && bits.length < totalDados * 8; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);
  const dados: number[] = [];
  for (let i = 0; i < bits.length; i += 8) dados.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  for (let i = 0; dados.length < totalDados; i++) dados.push(i % 2 === 0 ? 0xec : 0x11);

  // 2) Blocos e correção de erro.
  const blocos: number[][] = [];
  const ecs: number[][] = [];
  let pos = 0;
  for (let i = 0; i < b1 + b2; i++) {
    const tam = i < b1 ? d1 : d2;
    const bloco = dados.slice(pos, pos + tam);
    pos += tam;
    blocos.push(bloco);
    ecs.push(correcao(bloco, ecPorBloco));
  }
  // 3) Intercalar.
  const fluxo: number[] = [];
  const maiorDado = Math.max(...blocos.map((b) => b.length));
  for (let i = 0; i < maiorDado; i++) for (const b of blocos) if (i < b.length) fluxo.push(b[i]);
  for (let i = 0; i < ecPorBloco; i++) for (const e of ecs) fluxo.push(e[i]);

  // 4) Desenhar.
  const mat = novaMatriz(versao);
  padroesFixos(mat, versao);
  escreverVersao(mat, versao);
  const fluxoBits: number[] = [];
  for (const b of fluxo) for (let i = 7; i >= 0; i--) fluxoBits.push((b >> i) & 1);
  let k = 0;
  const n = mat.n;
  let subindo = true;
  for (let c = n - 1; c > 0; c -= 2) {
    if (c === 6) c--; // pula a coluna de tempo
    for (let passo = 0; passo < n; passo++) {
      const l = subindo ? n - 1 - passo : passo;
      for (const cc of [c, c - 1]) {
        if (mat.reservado[l][cc]) continue;
        mat.m[l][cc] = k < fluxoBits.length ? fluxoBits[k] === 1 : false;
        k++;
      }
    }
    subindo = !subindo;
  }

  // 5) Escolher a máscara com menor penalidade.
  let melhor: boolean[][] | null = null;
  let melhorNota = Infinity;
  for (let mascara = 0; mascara < 8; mascara++) {
    const copia: boolean[][] = mat.m.map((linha) => linha.map((v) => v === true));
    const teste: Mat = { n, m: copia as (boolean | null)[][], reservado: mat.reservado };
    for (let l = 0; l < n; l++) {
      for (let c = 0; c < n; c++) {
        if (!mat.reservado[l][c] && MASCARAS[mascara](l, c)) copia[l][c] = !copia[l][c];
      }
    }
    escreverFormato(teste, mascara);
    const nota = penalidade(copia);
    if (nota < melhorNota) { melhorNota = nota; melhor = copia; }
  }
  return melhor!;
}

/** Matriz → SVG quadrado, pronto para pôr na tela (sem depender de imagem externa). */
export function qrParaSvg(texto: string, { borda = 4, escuro = "#15231a", claro = "#ffffff" } = {}): string {
  const m = gerarQr(texto);
  const n = m.length;
  const total = n + borda * 2;
  let caminho = "";
  for (let l = 0; l < n; l++) {
    for (let c = 0; c < n; c++) if (m[l][c]) caminho += `M${c + borda} ${l + borda}h1v1h-1z`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges" role="img">`
    + `<rect width="${total}" height="${total}" fill="${claro}"/>`
    + `<path d="${caminho}" fill="${escuro}"/></svg>`;
}

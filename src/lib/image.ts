/**
 * Validação e redimensionamento de imagens de perfil/banner/logo.
 * Parte pura (sniffing por magic bytes, validação, tamanho) é testável;
 * redimensionamento usa `createImageBitmap`/canvas (apenas navegador).
 */

export const ALLOWED_IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"] as const;
export type ImagemMime = (typeof ALLOWED_IMAGE_MIMES)[number];

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB (limite do bucket)
export const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp"] as const;

export type ImagemValidation = { ok: true } | { ok: false; motivo: string };

const MAGIC_JPEG = [0xff, 0xd8, 0xff];
const MAGIC_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Detecta o tipo real da imagem pelos primeiros bytes ("magic bytes"). */
export function sniffImageType(bytes: Uint8Array): ImagemMime | null {
  if (bytes.length >= 3 && MAGIC_JPEG.every((b, i) => bytes[i] === b)) {
    return "image/jpeg";
  }
  if (bytes.length >= 8 && MAGIC_PNG.every((b, i) => bytes[i] === b)) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && // "RIFF"
    bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && // "WEBP"
    bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export function extensionOf(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : "";
}

export function extensaoValida(name: string | undefined): boolean {
  if (!name) return true; // sem nome: confiamos nos magic bytes
  const ext = extensionOf(name);
  if (ext === "") return true; // sem extensão ("foto", "foto."): confiamos nos magic bytes
  return (ALLOWED_EXTENSIONS as readonly string[]).includes(ext);
}

export function mimeAllowed(type: string): boolean {
  return (ALLOWED_IMAGE_MIMES as readonly string[]).includes(type);
}

/**
 * Valida arquivo de imagem: tamanho, extensão e tipo real (magic bytes).
 * `type` declarado (blob.type) inicia o check; se a detecção por magic bytes
 * reconhece um tipo diferente, rejeita (arquivo "mascarado").
 */
export async function validarImagem(
  file: {
    name?: string;
    type?: string;
    size?: number;
    arrayBuffer(): Promise<ArrayBuffer>;
  },
): Promise<ImagemValidation> {
  if (typeof file.size === "number" && file.size > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      motivo: `Imagem acima de ${readableSize(MAX_IMAGE_BYTES)}.`,
    };
  }
  if (file.type && !mimeAllowed(file.type)) {
    return {
      ok: false,
      motivo: "Apenas JPG, PNG e WebP são aceitos.",
    };
  }
  if (!extensaoValida(file.name)) {
    return {
      ok: false,
      motivo: "Extensão de arquivo inválida (use .jpg, .jpeg, .png ou .webp).",
    };
  }

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    return { ok: false, motivo: "Não foi possível ler o arquivo." };
  }

  const detectado = sniffImageType(bytes);
  if (!detectado) {
    return { ok: false, motivo: "Arquivo não parece ser uma imagem válida." };
  }
  if (file.type && detectado !== file.type) {
    return { ok: false, motivo: "Tipo do arquivo não corresponde ao conteúdo." };
  }
  return { ok: true };
}

export type TipoImagem = "avatar" | "logo" | "banner";

export const recomendacoes: Record<TipoImagem, { w: number; h: number; maxDim: number }> = {
  avatar: { w: 400, h: 400, maxDim: 1024 },
  logo: { w: 500, h: 500, maxDim: 1024 },
  banner: { w: 1600, h: 500, maxDim: 2048 },
};

export function readableSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const kb = bytes / 1024;
  // 1023,6 KB arredonda para 1024: já é 1 MB.
  if (Math.round(kb) < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

/**
 * Redimensiona (cover-crop para o box recomendado) e converte para WebP.
 * Apenas navegador (createImageBitmap + canvas). Lança erro fora dele,
 * para que testes rodem apenas na parte pura.
 */
export async function redimensionarParaWebp(blob: Blob, kind: TipoImagem): Promise<Blob> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") {
    throw new Error("Redimensionamento disponível apenas no navegador.");
  }
  const rec = recomendacoes[kind];
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = rec.w;
    canvas.height = rec.h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas indisponível.");
    const scale = Math.max(rec.w / bitmap.width, rec.h / bitmap.height);
    const sw = rec.w / scale;
    const sh = rec.h / scale;
    const sx = (bitmap.width - sw) / 2;
    const sy = (bitmap.height - sh) / 2;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, rec.w, rec.h);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error("Falha ao gerar WebP."));
      }, "image/webp", 0.82);
    });
  } finally {
    bitmap.close();
  }
}

export type UploadResult =
  | { ok: true; path: string; blob: Blob }
  | { ok: false; motivo: string };

/**
 * Prepara o arquivo para upload: valida e, se for maior que os limites
 * recomendados (ou não for WebP), redimensiona para WebP.
 */
export async function prepararUpload(
  file: File,
  kind: TipoImagem,
): Promise<UploadResult> {
  const check = await validarImagem(file);
  if (!check.ok) return { ok: false, motivo: check.motivo };

  try {
    const rec = recomendacoes[kind];
    const precisaRedimensionar =
      file.type !== "image/webp" ||
      file.size > rec.maxDim * rec.maxDim * 0.35;
    const blob =
      precisaRedimensionar && typeof createImageBitmap === "function"
        ? await redimensionarParaWebp(file, kind)
        : file;
    const ext = blob.type === "image/webp" ? "webp" : extensionOf(file.name) || "png";
    return { ok: true, path: `foto.${ext}`, blob };
  } catch {
    return { ok: false, motivo: "Não foi possível processar a imagem." };
  }
}
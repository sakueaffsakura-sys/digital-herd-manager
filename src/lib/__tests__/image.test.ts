import { describe, expect, it } from "vitest";
import {
  MAX_IMAGE_BYTES,
  extensionOf,
  extensaoValida,
  readableSize,
  sniffImageType,
  validarImagem,
} from "../image";

const bytes = (hex: string): Uint8Array => {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
};

const fakeFile = (opts: {
  name?: string;
  type?: string;
  size?: number;
  content?: Uint8Array;
}) => ({
  name: opts.name ?? "foto.png",
  type: opts.type ?? "image/png",
  size: opts.size ?? 100,
  arrayBuffer: async () => (opts.content ?? bytes("89504e470d0a1a0a00")).buffer as ArrayBuffer,
});

describe("sniffImageType", () => {
  it("identifica JPEG/PNG/WebP pelos magic bytes", () => {
    expect(sniffImageType(bytes("ffd8ff"))).toBe("image/jpeg");
    expect(sniffImageType(bytes("89504e470d0a1a0a"))).toBe("image/png");
    expect(sniffImageType(bytes("52494646aaaa57534250"))).toBe("image/webp");
  });

  it("rejeita desconhecido", () => {
    expect(sniffImageType(bytes("00010203"))).toBeNull();
    expect(sniffImageType(new Uint8Array(2))).toBeNull();
  });
});

describe("extensionOf / extensaoValida", () => {
  it("extrai extensão em minúsculas", () => {
    expect(extensionOf("FOTO.JPEG")).toBe("jpeg");
    expect(extensionOf("sem-extensao")).toBe("");
  });

  it("valida extensões permitidas", () => {
    expect(extensaoValida("foto.webp")).toBe(true);
    expect(extensaoValida("foto.jpg")).toBe(true);
    expect(extensaoValida("foto.bmp")).toBe(false);
    expect(extensaoValida("foto")).toBe(true);
    expect(extensaoValida(undefined)).toBe(true);
  });
});

describe("validarImagem", () => {
  it("aceita arquivo válido", async () => {
    expect(await validarImagem(fakeFile({}))).toEqual({ ok: true });
  });

  it("rejeita por tamanho", async () => {
    const r = await validarImagem(fakeFile({ size: MAX_IMAGE_BYTES + 1 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toContain("5");
  });

  it("rejeita mime não permitido", async () => {
    const r = await validarImagem(fakeFile({ type: "image/gif" }));
    expect(r.ok).toBe(false);
  });

  it("rejeita extensão inválida", async () => {
    const r = await validarImagem(fakeFile({ name: "foto.exe" }));
    expect(r.ok).toBe(false);
  });

  it("rejeita conteúdo que não é imagem", async () => {
    const r = await validarImagem(
      fakeFile({ content: bytes("000102030405060708090a0b") }),
    );
    expect(r.ok).toBe(false);
  });

  it("rejeita tipo declarado divergente do conteúdo", async () => {
    const r = await validarImagem(fakeFile({ type: "image/webp", content: bytes("ffd8ff00") }));
    expect(r.ok).toBe(false);
  });
});

describe("readableSize", () => {
  it("formata bytes de forma legível", () => {
    expect(readableSize(500)).toBe("500 B");
    expect(readableSize(2048)).toBe("2 KB");
    expect(readableSize(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});
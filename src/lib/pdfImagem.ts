/** Converte um PDF em imagem PNG (primeira página) no navegador. Outros arquivos passam direto. */
export const ACEITA_IMAGEM_OU_PDF = "image/png,image/jpeg,image/webp,image/*,application/pdf,.pdf";

export const ehPdf = (f: File) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);

export async function pdfParaImagem(f: File): Promise<File> {
  if (!ehPdf(f)) return f;
  const pdfjs = await import("pdfjs-dist");
  const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  try {
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise;
    const pagina = await doc.getPage(1);
    const base = pagina.getViewport({ scale: 1 });
    const escala = Math.min(3, 2000 / Math.max(base.width, base.height));
    const vp = pagina.getViewport({ scale: escala });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(vp.width);
    canvas.height = Math.round(vp.height);
    const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("canvas");
    await pagina.render({ canvasContext: ctx, viewport: vp }).promise;
    const blob = await new Promise<Blob>((ok, erro) => canvas.toBlob((b) => (b ? ok(b) : erro(new Error())), "image/png"));
    return new File([blob], f.name.replace(/\.pdf$/i, "") + ".png", { type: "image/png" });
  } catch {
    throw new Error("Não foi possível extrair a imagem deste PDF.");
  }
}

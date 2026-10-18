/** Text only, client-side. Never renders PDF actions, submits data, or makes payment decisions. */
export async function extractPdfText(data: Uint8Array): Promise<{ text: string; pages: number }> {
  if (data.byteLength > 8 * 1024 * 1024) throw new Error("El PDF supera el límite de 8 MB.");
  if (new TextDecoder().decode(data.subarray(0, 5)) !== "%PDF-")
    throw new Error("El archivo no es un PDF válido.");
  const [{ getDocument, GlobalWorkerOptions }, { default: workerSrc }] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  GlobalWorkerOptions.workerSrc = workerSrc;
  const task = getDocument({
    data,
    enableXfa: false,
    useWorkerFetch: false,
    disableAutoFetch: true,
    stopAtErrors: true,
  });
  const timeout = setTimeout(() => {
    void task.destroy();
  }, 15000);
  try {
    const pdf = await task.promise;
    if (pdf.numPages > 10)
      throw new Error("El PDF supera el límite de 10 páginas. No se procesó parcialmente.");
    const pages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const content = await (await pdf.getPage(i)).getTextContent();
      pages.push(
        content.items
          .map((item) => ("str" in item ? item.str + (item.hasEOL ? "\n" : " ") : ""))
          .join(""),
      );
      if (pages.join("\n\n").length > 20000)
        throw new Error("El PDF supera 20.000 caracteres. No se recortó la evidencia.");
    }
    const text = pages.join("\n\n").trim();
    if (text.length < 10)
      throw new Error(
        "Este PDF no tiene texto suficiente: puede ser un escaneado. Necesita OCR; pega una transcripción revisada.",
      );
    return { text, pages: pdf.numPages };
  } finally {
    clearTimeout(timeout);
    await task.destroy();
  }
}

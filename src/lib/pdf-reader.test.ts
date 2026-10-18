import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getDocument: vi.fn(), destroy: vi.fn() }));
vi.mock("pdfjs-dist", () => ({ getDocument: mocks.getDocument, GlobalWorkerOptions: {} }));
vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?url", () => ({ default: "/pdf.worker.mjs" }));
import { extractPdfText } from "./pdf-reader";

const bytes = new TextEncoder().encode("%PDF-1.7\nsynthetic test");
function document(pages: string[][]) {
  return {
    numPages: pages.length,
    getPage: vi.fn(async (n: number) => ({
      getTextContent: async () => ({ items: pages[n - 1]!.map((str) => ({ str, hasEOL: true })) }),
    })),
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.destroy.mockResolvedValue(undefined);
});
describe("bounded PDF text import", () => {
  it("preserves literal amounts and page boundaries without uploading a PDF", async () => {
    const doc = document([["DEMO FICTICIA", "Total: USD 1,200.00"], ["Cuenta ****4821"]]);
    mocks.getDocument.mockReturnValue({ promise: Promise.resolve(doc), destroy: mocks.destroy });
    const result = await extractPdfText(bytes);
    expect(result.pages).toBe(2);
    expect(result.text).toContain("USD 1,200.00");
    expect(result.text).toContain("Cuenta ****4821");
    expect(mocks.getDocument.mock.calls[0]![0]).toMatchObject({
      useWorkerFetch: false,
      enableXfa: false,
    });
    expect(mocks.destroy).toHaveBeenCalledOnce();
  });
  it("rejects files that are not PDFs before loading the parser", async () => {
    await expect(
      extractPdfText(new TextEncoder().encode("<script>not a PDF</script>")),
    ).rejects.toThrow(/PDF válido/);
    expect(mocks.getDocument).not.toHaveBeenCalled();
  });
  it("rejects oversized files before loading the parser", async () => {
    const large = new Uint8Array(8 * 1024 * 1024 + 1);
    large.set(bytes);
    await expect(extractPdfText(large)).rejects.toThrow(/8 MB/);
    expect(mocks.getDocument).not.toHaveBeenCalled();
  });
  it("does not pretend that an image-only PDF was read", async () => {
    mocks.getDocument.mockReturnValue({
      promise: Promise.resolve(document([[]])),
      destroy: mocks.destroy,
    });
    await expect(extractPdfText(bytes)).rejects.toThrow(/OCR/);
    expect(mocks.destroy).toHaveBeenCalledOnce();
  });
  it("rejects long documents instead of processing a partial invoice", async () => {
    const doc = document(Array.from({ length: 11 }, () => ["texto"]));
    mocks.getDocument.mockReturnValue({ promise: Promise.resolve(doc), destroy: mocks.destroy });
    await expect(extractPdfText(bytes)).rejects.toThrow(/10 páginas/);
    expect(doc.getPage).not.toHaveBeenCalled();
    expect(mocks.destroy).toHaveBeenCalledOnce();
  });
  it("does not silently truncate evidence above the server text limit", async () => {
    mocks.getDocument.mockReturnValue({
      promise: Promise.resolve(document([["a".repeat(20001)]])),
      destroy: mocks.destroy,
    });
    await expect(extractPdfText(bytes)).rejects.toThrow(/20.000/);
    expect(mocks.destroy).toHaveBeenCalledOnce();
  });
});

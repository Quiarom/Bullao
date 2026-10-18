import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  pdf: vi.fn(),
  extract: vi.fn(),
  insert: vi.fn(),
  invalidate: vi.fn(),
  navigate: vi.fn(),
  error: vi.fn(),
}));
vi.mock("@/lib/pdf-reader", () => ({ extractPdfText: mocks.pdf }));
vi.mock("@/lib/extract.functions", () => ({ extractInvoice: {} }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => mocks.extract }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => mocks.navigate }));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mocks.invalidate }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ insert: mocks.insert }) },
}));
vi.mock("@/hooks/use-ap", async () => ({
  DATASET: (await import("@/demo/nodo-labs")).NODO_LABS,
  actorName: async () => "Demo tester",
}));
vi.mock("sonner", () => ({ toast: { error: mocks.error } }));
import { UploadDialog } from "@/components/bullao/upload-dialog";

function openTab(name: string) {
  fireEvent.mouseDown(screen.getByRole("tab", { name }), { button: 0, ctrlKey: false });
}
function pdfFile() {
  const file = new File(["%PDF-1.4"], "cuenta-ficticia.pdf", { type: "application/pdf" });
  Object.defineProperty(file, "arrayBuffer", {
    value: vi.fn(async () => new TextEncoder().encode("%PDF-1.4").buffer),
  });
  return file;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.insert.mockResolvedValue({ error: null });
  mocks.invalidate.mockResolvedValue(undefined);
});
afterEach(cleanup);
describe("document upload user flow", () => {
  it("previews PDF text without invoking AI, storing a draft or approving anything", async () => {
    mocks.pdf.mockResolvedValue({ text: "Documento ficticio. Total USD 1,200.00", pages: 1 });
    render(<UploadDialog open onOpenChange={vi.fn()} />);
    openTab("Subir PDF");
    fireEvent.change(screen.getByLabelText("Seleccionar PDF ficticio"), {
      target: { files: [pdfFile()] },
    });
    await waitFor(() =>
      expect(screen.getByLabelText("Texto de la cuenta")).toHaveValue(
        "Documento ficticio. Total USD 1,200.00",
      ),
    );
    expect(screen.getByRole("status")).toHaveTextContent("localmente");
    expect(mocks.extract).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("keeps existing text and explains that a scanned PDF needs OCR", async () => {
    mocks.pdf.mockRejectedValue(new Error("Este escaneado necesita OCR."));
    render(<UploadDialog open onOpenChange={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Texto de la cuenta"), {
      target: { value: "Borrador anterior ficticio" },
    });
    openTab("Subir PDF");
    fireEvent.change(screen.getByLabelText("Seleccionar PDF ficticio"), {
      target: { files: [pdfFile()] },
    });
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("OCR"));
    openTab("Pegar texto");
    expect(screen.getByLabelText("Texto de la cuenta")).toHaveValue("Borrador anterior ficticio");
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("rejects an oversized PDF before reading its bytes", async () => {
    render(<UploadDialog open onOpenChange={vi.fn()} />);
    openTab("Subir PDF");
    const file = pdfFile();
    Object.defineProperty(file, "size", { value: 8 * 1024 * 1024 + 1 });
    fireEvent.change(screen.getByLabelText("Seleccionar PDF ficticio"), {
      target: { files: [file] },
    });
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("8 MB"));
    expect(file.arrayBuffer).not.toHaveBeenCalled();
    expect(mocks.pdf).not.toHaveBeenCalled();
  });
  it("parses and stores a real synthetic XML through the existing engine without AI", async () => {
    render(<UploadDialog open onOpenChange={vi.fn()} />);
    openTab("Subir XML");
    const file = new File(["demo"], "inv-03.xml", { type: "application/xml" });
    Object.defineProperty(file, "text", {
      value: async () => readFileSync("public/examples/inv-03.xml", "utf8"),
    });
    fireEvent.change(screen.getByLabelText("Seleccionar XML ficticio"), {
      target: { files: [file] },
    });
    await waitFor(() => expect(mocks.insert).toHaveBeenCalledOnce());
    expect(mocks.insert.mock.calls[0]![0]).toMatchObject({
      kind: "review_invoice",
      payload: { draft: { invoiceNumber: "A-209", method: "xml" } },
    });
    expect(mocks.extract).not.toHaveBeenCalled();
  });
  it("does not falsely claim nothing was saved if readback fails after an XML insert", async () => {
    mocks.invalidate.mockRejectedValue(new Error("readback offline"));
    render(<UploadDialog open onOpenChange={vi.fn()} />);
    openTab("Subir XML");
    const file = new File(["demo"], "inv-03.xml", { type: "application/xml" });
    Object.defineProperty(file, "text", {
      value: async () => readFileSync("public/examples/inv-03.xml", "utf8"),
    });
    fireEvent.change(screen.getByLabelText("Seleccionar XML ficticio"), {
      target: { files: [file] },
    });
    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining("confirmar")),
    );
    expect(mocks.insert).toHaveBeenCalledOnce();
  });
});

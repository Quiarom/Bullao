import { describe, expect, it, vi } from "vitest";
import { buildState, contentHash, evaluate } from "./engine";
import { draftFromFields } from "./upload";
import { NODO_LABS } from "@/demo/nodo-labs";
import type { ApEvent, InvoiceDraft } from "./types";

vi.mock("@/lib/mcp/state", () => ({
  stateFor: async () => buildState(NODO_LABS),
  moneyJson: (money: unknown) => money,
}));

const field = (value: string | null, quote: string | null = value) => ({ value, quote });
const fields = {
  vendorName: field("Hosting Andes"),
  invoiceNumber: field("HA-1"),
  amount: field("USD 900.00"),
  currency: field("USD"),
  period: field("2026-10"),
  concept: field("Hosting"),
  bankLast4: field("1029"),
};
const event = (kind: ApEvent["kind"], payload: Record<string, unknown>, at: number): ApEvent => ({
  id: String(at),
  kind,
  payload,
  actor: "Laura",
  created_at: `2026-10-20T00:00:${String(at).padStart(2, "0")}.000Z`,
});

describe("regresiones de evidencia de importación", () => {
  it("fecha de vencimiento solo es válida con fecha calendario y cita congruente", () => {
    const draft = draftFromFields(
      "x",
      "Hosting Andes HA-1 USD 900.00 2026-10 vence 2026-11-31 Hosting 1029",
      {
        ...fields,
        dueDate: field("2026-11-31", "vence 2026-11-31"),
      } as typeof fields & { dueDate: ReturnType<typeof field> },
      "2026-10",
    );
    const result = evaluate({
      invoice: draft,
      rules: NODO_LABS.rules,
      vendors: NODO_LABS.vendors,
      agreements: NODO_LABS.agreements,
      month: { processed: [], reservations: [] },
    });
    expect(result.outcome).not.toBe("READY");
  });

  it("cita no vacía que aparece pero no coincide con el dato no valida el campo", () => {
    const draft = draftFromFields(
      "x",
      "Documento: USD 1.00; proveedor: Otra empresa",
      {
        ...fields,
        vendorName: field("Hosting Andes", "Otra empresa"),
      },
      "2026-10",
    );
    const result = evaluate({
      invoice: draft,
      rules: NODO_LABS.rules,
      vendors: NODO_LABS.vendors,
      agreements: NODO_LABS.agreements,
      month: { processed: [], reservations: [] },
    });
    expect(result.outcome).not.toBe("READY");
  });

  it("draftFromFields exige citas de proveedor, moneda y periodo; no normaliza periodos inválidos", () => {
    const draft = draftFromFields(
      "x",
      "Hosting Andes HA-1 USD 900.00 2026-10 Hosting 1029",
      {
        ...fields,
        vendorName: field("Hosting Andes", ""),
        currency: field("USD", null),
        period: field("2026-13"),
      },
      "2026-10",
    );
    expect(draft.quotes).toEqual(
      expect.arrayContaining([
        { field: "proveedor", text: "" },
        { field: "moneda", text: "" },
        { field: "periodo", text: "2026-13" },
      ]),
    );
    expect(draft.period).toBe("2026-13");
    const result = evaluate({
      invoice: draft,
      rules: NODO_LABS.rules,
      vendors: NODO_LABS.vendors,
      agreements: NODO_LABS.agreements,
      month: { processed: [], reservations: [] },
    });
    expect(result.outcome).not.toBe("READY");
  });

  it("currencyHint en conflicto con moneda literal no queda elegible", () => {
    const draft = draftFromFields(
      "x",
      "Hosting Andes HA-1 USD 900.00 2026-10 Hosting 1029",
      fields,
      "2026-10",
    );
    draft.currencyHint = "MXN";
    const result = evaluate({
      invoice: draft,
      rules: NODO_LABS.rules,
      vendors: NODO_LABS.vendors,
      agreements: NODO_LABS.agreements,
      month: { processed: [], reservations: [] },
    });
    expect(result.outcome).not.toBe("READY");
  });

  it("acepta periodo localizado con mes y año exactos en el texto citado", () => {
    const draft = draftFromFields(
      "x",
      "Hosting Andes HA-1 USD 900.00 octubre de 2026 Hosting 1029",
      {
        ...fields,
        period: field("2026-10", "octubre de 2026"),
      },
      "2026-10",
    );
    const result = evaluate({
      invoice: draft,
      rules: NODO_LABS.rules,
      vendors: NODO_LABS.vendors,
      agreements: NODO_LABS.agreements,
      month: { processed: [], reservations: [] },
    });
    expect(
      result.checks.filter((check) => ["evidence", "amount"].includes(check.id) && !check.ok),
    ).toEqual([]);
  });

  it("visto bueno no sustituye evidencia crítica ni monto válido", () => {
    const base = NODO_LABS.inbox.find((d) => d.id === "inv-11") as InvoiceDraft;
    const draft = {
      ...base,
      id: "bad-agent",
      method: "agent" as const,
      quotes: [],
      amountText: "USD ???",
      period: "2026-13",
    };
    const review = event("review_invoice", { draft }, 1);
    const first = buildState(NODO_LABS, [review]);
    const invoice = first.invoices[0]!.invoice;
    const approved = buildState(NODO_LABS, [
      review,
      event("approve_invoice", { invoiceId: draft.id, contentHash: contentHash(invoice) }, 2),
    ]);
    expect(approved.invoices[0]!.current.outcome).not.toBe("READY");
  });

  it("un vencimiento inválido impide READY aunque el resto de la factura venga revisada", () => {
    const base = NODO_LABS.inbox.find((d) => d.id === "inv-11") as InvoiceDraft;
    const draft = {
      ...base,
      id: "bad-due-date",
      dueDate: "2026-02-29",
      quotes: [...base.quotes, { field: "vencimiento", text: "2026-02-29" }],
    };
    const result = evaluate({
      invoice: draft,
      rules: NODO_LABS.rules,
      vendors: NODO_LABS.vendors,
      agreements: NODO_LABS.agreements,
      month: { processed: [], reservations: [] },
    });
    expect(result.checks.find((check) => check.id === "evidence")?.ok).toBe(false);
  });

  it("rechaza cita de emisión como evidencia de vencimiento y acepta la frase explícita", () => {
    const base = NODO_LABS.inbox.find((d) => d.id === "inv-11") as InvoiceDraft;
    const issuance = {
      ...base,
      id: "issuance-as-due-date",
      dueDate: "2026-11-01",
      text: `${base.text} Fecha de emisión: 2026-11-01`,
      quotes: [...base.quotes, { field: "vencimiento", text: "Fecha de emisión: 2026-11-01" }],
    };
    const explicit = {
      ...issuance,
      id: "explicit-due-date",
      text: `${base.text} Fecha de vencimiento: 2026-11-01`,
      quotes: [...base.quotes, { field: "vencimiento", text: "Fecha de vencimiento: 2026-11-01" }],
    };
    const evaluateDraft = (invoice: InvoiceDraft) => evaluate({
      invoice,
      rules: NODO_LABS.rules,
      vendors: NODO_LABS.vendors,
      agreements: NODO_LABS.agreements,
      month: { processed: [], reservations: [] },
    });
    expect(evaluateDraft(issuance).checks.find((check) => check.id === "evidence")?.ok).toBe(false);
    expect(evaluateDraft(explicit).checks.find((check) => check.id === "evidence")?.ok).toBe(true);
  });

  it("MCP check returns the supplied due date, or null when absent", async () => {
    const { default: tool } = await import("@/lib/mcp/tools/check-draft");
    const handler = tool.handler as (args: Record<string, unknown>, ctx: unknown) => Promise<{
      structuredContent: { dueDate: string | null };
    }>;
    const args = {
      documentText: "Hosting Andes HA-1 USD 900.00 2026-10 Hosting 1029",
      vendorId: "unknown",
      vendorName: "Hosting Andes",
      invoiceNumber: "HA-1",
      businessId: null,
      amountText: "USD 900.00",
      currency: "USD",
      period: "2026-10",
      concept: "Hosting",
      bankLast4: "1029",
    };
    const ctx = {};
    const absent = await handler(args, ctx);
    const supplied = await handler({ ...args, dueDate: "2026-11-01", dueDateQuote: "vence 2026-11-01" }, ctx);
    expect(absent.structuredContent.dueDate).toBeNull();
    expect(supplied.structuredContent.dueDate).toBe("2026-11-01");
  });
});

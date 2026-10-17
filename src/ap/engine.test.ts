import { describe, expect, it } from "vitest";
import { buildState } from "./engine";
import { parseAmount } from "./money";
import type { ApEvent } from "./types";

const out = (s: ReturnType<typeof buildState>, id: string) => s.invoices.find((v) => v.invoice.id === id)!.current.outcome;
let t = 0;
const ev = (kind: ApEvent["kind"], payload: Record<string, unknown>): ApEvent => ({ id: String(++t), kind, payload, actor: "Laura", created_at: `2026-10-20T00:00:${String(t).padStart(2, "0")}Z` });
const hashOf = (id: string) => buildState().invoices.find((v) => v.invoice.id === id)!.current.contentHash;

describe("parseAmount", () => {
  it.each([
    ["4.800.000", 480000000], ["1.250,50", 125050], ["1,250.50", 125050], ["24,000.00", 2400000],
    ["R$ 1.500,00", 150000], ["USD 1,000.00", 100000], ["$26,000.00", 2600000], ["700", 70000],
  ])("%s", (txt, minor) => {
    const r = parseAmount(txt);
    expect(r.ok && r.minor).toBe(minor);
  });
  it("un $ solo no define moneda", () => { const r = parseAmount("$4.800.000"); expect(r.ok && r.currency).toBe(null); });
  it("formato ambiguo falla", () => expect(parseAmount("1.2.3,4.5").ok).toBe(false));
});

describe("casos visibles", () => {
  const s = buildState();
  it.each([
    ["inv-01", "READY"], ["inv-02", "READY"], ["inv-03", "READY"], ["inv-04", "READY"], ["inv-05", "READY"], ["inv-06", "READY"],
    ["inv-07", "BLOCKED"], ["inv-08a", "READY"], ["inv-08b", "BLOCKED"], ["inv-09", "REVIEW"], ["inv-10", "REVIEW"],
    ["inv-11", "REVIEW"], ["inv-12", "REVIEW"], ["inv-13", "BLOCKED"], ["inv-14", "REVIEW"], ["inv-15", "REVIEW"],
    ["inv-16", "READY"], ["inv-17", "BLOCKED"], ["inv-19", "REVIEW"], ["inv-20", "READY"], ["inv-21", "REVIEW"],
  ])("%s → %s", (id, o) => expect(out(s, id)).toBe(o));

  it("lo listo nunca supera el presupuesto", () => {
    for (const cur of ["USD", "COP", "MXN"] as const) {
      const tot = s.reservations.filter((r) => r.amount.currency === cur && r.period === "2026-10").reduce((a, r) => a + r.amount.minor, 0);
      expect(tot).toBeLessThanOrEqual(s.rules.budget[cur]);
    }
  });
});

describe("solo esta vez", () => {
  it("Hosting Andes: octubre autorizado, noviembre vuelve a pedir, modificación lo deja listo", () => {
    const e1 = ev("approve_invoice", { invoiceId: "inv-11", contentHash: hashOf("inv-11") });
    const e2 = ev("receive_invoice", { invoiceId: "inv-11-nov" });
    let s = buildState([e1, e2]);
    expect(out(s, "inv-11")).toBe("READY");
    expect(s.agreements.find((a) => a.id === "ot-inv-11")?.status).toBe("USED");
    expect(s.agreements.find((a) => a.id === "ot-inv-11")?.amount.minor).toBe(20000);
    expect(out(s, "inv-11-nov")).toBe("REVIEW");
    s = buildState([e1, e2, ev("approve_agreement", { agreementId: "ag-hosting-nov" })]);
    expect(out(s, "inv-11-nov")).toBe("READY");
    const oct = s.invoices.find((v) => v.invoice.id === "inv-11")!;
    expect(oct.current.by).toBe("persona");
    expect(oct.history).toHaveLength(2);
  });

  it("visto bueno sin presupuesto queda bloqueado al reevaluar (Mateo)", () => {
    const s = buildState([ev("approve_invoice", { invoiceId: "inv-09", contentHash: hashOf("inv-09") })]);
    expect(out(s, "inv-09")).toBe("BLOCKED");
  });

  it("autorización atada al contenido", () => {
    const s = buildState([ev("approve_invoice", { invoiceId: "inv-11", contentHash: "otro" })]);
    expect(out(s, "inv-11")).toBe("REVIEW");
  });

  it("no hay visto bueno para lo bloqueado", () => {
    const s = buildState([ev("approve_invoice", { invoiceId: "inv-07", contentHash: hashOf("inv-07") })]);
    expect(out(s, "inv-07")).toBe("BLOCKED");
  });

  it("aprobar dos veces no aparta dos veces", () => {
    const h = hashOf("inv-19");
    const s = buildState([ev("approve_invoice", { invoiceId: "inv-19", contentHash: h }), ev("approve_invoice", { invoiceId: "inv-19", contentHash: h })]);
    expect(s.reservations.filter((r) => r.invoiceId === "inv-19")).toHaveLength(1);
  });
});

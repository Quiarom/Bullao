import { describe, expect, it } from "vitest";
import { buildState, inboxReviewEvents, previewRules } from "./engine";
import { parseAmount } from "./money";
import { readCfdi, readDian } from "./xml";
import { NODO_LABS as D } from "@/demo/nodo-labs";
import { isXmlDoc, type ApEvent } from "./types";

const REVIEWS = inboxReviewEvents(D);
let t = 0;
const ev = (kind: ApEvent["kind"], payload: Record<string, unknown>): ApEvent => ({ id: String(++t), kind, payload, actor: "Laura", created_at: `2026-10-20T00:00:${String(t).padStart(2, "0")}.000Z` });
const run = (...extra: ApEvent[]) => buildState(D, [...REVIEWS, ...extra]);
const out = (s: ReturnType<typeof buildState>, id: string) => s.invoices.find((v) => v.invoice.id === id)?.current.outcome;
const hashOf = (id: string) => run().invoices.find((v) => v.invoice.id === id)!.current.contentHash;

describe("parseAmount", () => {
  it.each([
    ["4.800.000", 480000000], ["1.250,50", 125050], ["1,250.50", 125050], ["24,000.00", 2400000],
    ["R$ 1.500,00", 150000], ["USD 1,000.00", 100000], ["$26,000.00", 2600000], ["700", 70000], ["24000.00", 2400000],
  ])("%s", (txt, minor) => {
    const r = parseAmount(txt);
    expect(r.ok && r.minor).toBe(minor);
  });
  it("un $ solo no define moneda", () => { const r = parseAmount("$4.800.000"); expect(r.ok && r.currency).toBe(null); });
  it("formato ambiguo falla", () => expect(parseAmount("1.2.3,4.5").ok).toBe(false));
});

describe("bandeja", () => {
  it("al empezar no hay nada revisado", () => expect(buildState(D, []).invoices).toHaveLength(0));
  it("revisar dos veces la bandeja no duplica decisiones", () => {
    const once = buildState(D, REVIEWS);
    const twice = buildState(D, [...REVIEWS, ...REVIEWS.map((e) => ({ ...e, id: e.id + "b", created_at: e.created_at.replace("2026-10-10", "2026-10-11") }))]);
    expect(twice.decisions).toHaveLength(once.decisions.length);
    expect(twice.reservations).toHaveLength(once.reservations.length);
  });
});

describe("lectura de XML sin IA", () => {
  const doc = (id: string) => { const d = D.inbox.find((x) => x.id === id)!; if (!isXmlDoc(d)) throw new Error(); return d.xml; };
  it("CFDI 4.0", () => {
    const r = readCfdi(doc("inv-03"), D.vendors);
    expect(r).toMatchObject({ vendorRef: "lucia", invoiceNumber: "A-209", businessId: "6F1C2A90-0000-4D2E-9A11-FICTICIO0209", amountText: "24000.00", currencyHint: "MXN", period: "2026-09", bankLast4: "1029", method: "xml" });
  });
  it("DIAN AttachedDocument", () => {
    const r = readDian(doc("inv-14"), D.vendors);
    expect(r).toMatchObject({ vendorRef: "pixel", invoiceNumber: "FE-311", businessId: "CUFE-b22d81aa-FICTICIO-311", amountText: "2400.00", currencyHint: "USD", period: "2026-10", bankLast4: "9001" });
  });
});

describe("casos visibles", () => {
  const s = run();
  it.each(Object.entries(D.expected.inbox))("%s → %s", (id, o) => expect(out(s, id)).toBe(o));
  it("lo listo nunca supera el presupuesto", () => {
    for (const cur of ["USD", "COP", "MXN"] as const) {
      const tot = s.reservations.filter((r) => r.amount.currency === cur && r.period === "2026-10").reduce((a, r) => a + r.amount.minor, 0);
      expect(tot).toBeLessThanOrEqual(s.rules.budget[cur]);
    }
  });
});

describe("cuenta subida", () => {
  it("una cita inventada pide visto bueno", () => {
    const text = "Cuenta de cobro TV-13\nValor: USD 900.00\nCuenta ****1188";
    const draft = { id: "up-1", vendorRef: "Tomás Vega", vendorName: "Tomás Vega", invoiceNumber: "TV-13", businessId: null, amountText: "USD 900.00",
      currencyHint: null, period: "2026-10", concept: "Soporte", bankLast4: "1188", channel: "correo", receivedAt: "", text, method: "agent",
      quotes: [{ field: "monto", text: "USD 900.00" }, { field: "concepto", text: "Soporte noviembre extra" }] };
    const s = buildState(D, [ev("review_invoice", { draft })]);
    const v = s.invoices.find((x) => x.invoice.id === "up-1")!;
    expect(v.invoice.vendorRef).toBe("tomas");
    expect(v.current.outcome).toBe("REVIEW");
    expect(v.current.checks.find((c) => c.id === "evidence")?.message).toBe("No encuentro concepto en el documento.");
  });
});

describe("solo esta vez", () => {
  it("Hosting Andes: octubre autorizado, noviembre vuelve a pedir, modificación lo deja listo", () => {
    const e1 = ev("approve_invoice", { invoiceId: "inv-11", contentHash: hashOf("inv-11") });
    const e2 = ev("receive_invoice", { invoiceId: "inv-11-nov" });
    let s = run(e1, e2);
    expect(out(s, "inv-11")).toBe("READY");
    expect(s.agreements.find((a) => a.id === "ot-inv-11")?.status).toBe("USED");
    expect(s.agreements.find((a) => a.id === "ot-inv-11")?.amount.minor).toBe(20000);
    expect(out(s, "inv-11-nov")).toBe("REVIEW");
    s = run(e1, e2, ev("approve_agreement", { agreementId: "ag-hosting-nov" }));
    expect(out(s, "inv-11-nov")).toBe("READY");
    const oct = s.invoices.find((v) => v.invoice.id === "inv-11")!;
    expect(oct.current.by).toBe("persona");
    expect(oct.history).toHaveLength(2);
  });

  it("visto bueno sin presupuesto queda bloqueado al reevaluar (Estudio Pixel)", () => {
    const ok = (id: string) => ev("approve_invoice", { invoiceId: id, contentHash: hashOf(id) });
    const s = run(ok("inv-11"), ok("inv-19"), ok("inv-21"), ok("inv-15"), ok("inv-14"));
    expect(out(s, "inv-15")).toBe("READY");
    expect(out(s, "inv-14")).toBe("BLOCKED");
  });

  it("autorización atada al contenido", () => expect(out(run(ev("approve_invoice", { invoiceId: "inv-11", contentHash: "otro" })), "inv-11")).toBe("REVIEW"));
  it("no hay visto bueno para lo bloqueado", () => expect(out(run(ev("approve_invoice", { invoiceId: "inv-07", contentHash: hashOf("inv-07") })), "inv-07")).toBe("BLOCKED"));
  it("aprobar dos veces no aparta dos veces", () => {
    const h = hashOf("inv-19");
    const s = run(ev("approve_invoice", { invoiceId: "inv-19", contentHash: h }), ev("approve_invoice", { invoiceId: "inv-19", contentHash: h }));
    expect(s.reservations.filter((r) => r.invoiceId === "inv-19")).toHaveLength(1);
  });
});

describe("reglas editables", () => {
  const base = D.rules;
  const usd2500 = { ...base, autoLimit: { ...base.autoLimit, USD: 250000 } };
  it("subir el límite a USD 2.500 deja lista la cuenta de USD 2.400 de Estudio Pixel, no la que no tiene presupuesto", () => {
    const s = run(ev("update_rules", { rules: usd2500 }));
    expect(out(s, "inv-14")).toBe("READY");
    expect(out(s, "inv-17")).toBe("BLOCKED");
    expect(s.rules.version).toBe("reglas-v2");
  });
  it("subir el límite nunca salta un duplicado", () => {
    const huge = { ...base, autoLimit: { USD: 1e9, COP: 1e12, MXN: 1e9, BRL: 1e9 } };
    const s = run(ev("update_rules", { rules: huge }));
    expect(out(s, "inv-07")).toBe("BLOCKED");
    expect(out(s, "inv-08b")).toBe("BLOCKED");
  });
  it("las decisiones viejas mantienen su versión", () => {
    const s = run(ev("update_rules", { rules: usd2500 }));
    expect(s.invoices.find((v) => v.invoice.id === "inv-01")!.current.rulesVersion).toBe("reglas-v1");
    const pixel = s.invoices.find((v) => v.invoice.id === "inv-14")!;
    expect(pixel.history.map((h) => h.rulesVersion)).toEqual(["reglas-v1", "reglas-v2"]);
  });
  it("la vista previa no guarda nada y lista los cambios", () => {
    const changes = previewRules(D, REVIEWS, usd2500);
    expect(changes).toEqual([{ invoiceId: "inv-14", vendor: "Estudio Pixel SAS", before: "REVIEW", after: "READY" }]);
    expect(buildState(D, REVIEWS).rules.version).toBe("reglas-v1");
  });
});

import { formatMoney, parseAmount, type Currency, type Money } from "./money";
import {
  isXmlDoc,
  type Agreement,
  type ApEvent,
  type Check,
  type Dataset,
  type Decision,
  type InboxDoc,
  type InvoiceDraft,
  type Outcome,
  type Quote,
  type Rules,
  type RulesInput,
  type Vendor,
} from "./types";
import { xmlDocToDraft } from "./xml";

const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];
export const monthName = (p: string) => MONTHS[Number(p.slice(5, 7)) - 1] ?? p;
const prevMonth = (p: string) => {
  const y = Number(p.slice(0, 4));
  const m = Number(p.slice(5, 7));
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
};
const covers = (ag: Agreement, period: string) =>
  ag.effectiveFrom <= period && (!ag.effectiveTo || period <= ag.effectiveTo);

/** Every quote must appear verbatim in the document text. Returns the quotes that do not. */
export function verifyQuotes(text: string, quotes: Quote[]): Quote[] {
  return quotes.filter((q) => !q.text || !text.includes(q.text));
}

function hasFieldEvidence(
  inv: InvoiceDraft,
  field: string,
  value: string | null | undefined,
): boolean {
  if (!value) return false;
  return inv.quotes.some(
    (q) =>
      q.field === field &&
      q.text &&
      inv.text.includes(q.text) &&
      (q.text === value || (field === "periodo" && periodEvidenceMatches(q.text, value))),
  );
}
const validPeriod = (period: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(period);
const validDueDate = (date: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(date) &&
  (() => {
    const d = new Date(`${date}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
  })();
const PERIOD_MONTHS: Record<string, string> = {
  january: "01",
  enero: "01",
  february: "02",
  febrero: "02",
  march: "03",
  marzo: "03",
  april: "04",
  abril: "04",
  may: "05",
  mayo: "05",
  june: "06",
  junio: "06",
  july: "07",
  julio: "07",
  august: "08",
  agosto: "08",
  september: "09",
  septiembre: "09",
  october: "10",
  octubre: "10",
  november: "11",
  noviembre: "11",
  december: "12",
  diciembre: "12",
};
function periodEvidenceMatches(quote: string, period: string): boolean {
  if (!validPeriod(period)) return false;
  const [year, month] = period.split("-");
  if (quote.trim() === period) return true;
  const normalized = quote
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const names = Object.entries(PERIOD_MONTHS)
    .filter(([, number]) => number === month)
    .map(([name]) => name)
    .join("|");
  return new RegExp(`\\b(?:${names})\\s+(?:de\\s+)?${year}\\b`, "i").test(normalized);
}

export function contentHash(inv: InvoiceDraft): string {
  const s = [
    inv.id,
    inv.vendorRef,
    inv.invoiceNumber,
    inv.amountText,
    inv.period,
    inv.bankLast4,
    inv.text,
  ].join("|");
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, "0");
}

export type Reservation = {
  invoiceId: string;
  vendorRef: string;
  period: string;
  amount: Money;
  agreementIds: string[];
};

export type MonthState = {
  processed: InvoiceDraft[];
  reservations: Reservation[];
};

export type Agreed = {
  base: Agreement | null;
  extras: Agreement[];
  proposed: Agreement[];
  allowed: Money | null;
};

/** Lo acordado vigente para un proveedor y mes cobrado. Solo cuenta lo APROBADO. */
export function findAgreed(
  agreements: Agreement[],
  vendorId: string,
  period: string,
  prefer?: Currency,
): Agreed {
  const mine = agreements.filter((a) => a.vendorId === vendorId);
  const base =
    mine
      .filter(
        (a) =>
          (a.kind === "BASE" || a.kind === "MODIFICATION") &&
          a.status === "APPROVED" &&
          covers(a, period),
      )
      .sort((x, y) => (x.effectiveFrom < y.effectiveFrom ? 1 : -1))[0] ?? null;
  const extras = mine.filter(
    (a) =>
      (a.kind === "ONE_TIME" || a.kind === "PROJECT") &&
      a.status === "APPROVED" &&
      a.period === period,
  );
  const proposed = mine.filter(
    (a) => a.status === "PROPOSED" && (a.period === period || covers(a, period)),
  );
  const all = [base, ...extras].filter(Boolean) as Agreement[];
  const parts =
    prefer && all.some((p) => p.amount.currency === prefer)
      ? all.filter((p) => p.amount.currency === prefer)
      : all;
  let allowed: Money | null = null;
  if (parts.length) {
    const cur = parts[0]!.amount.currency;
    allowed = {
      currency: cur,
      minor: parts.filter((p) => p.amount.currency === cur).reduce((s, p) => s + p.amount.minor, 0),
    };
  }
  return { base, extras, proposed, allowed };
}

export type EvalInput = {
  invoice: InvoiceDraft;
  rules: Rules;
  vendors: Vendor[];
  agreements: Agreement[];
  month: MonthState;
};

export type Evaluation = {
  outcome: Outcome;
  checks: Check[];
  amount: Money | null;
  allowed: Money | null;
  remaining: Money | null;
  overBy: Money | null;
  agreed: Agreed;
};

/** Función pura: sin red, sin base de datos, sin modelo. Corre todas las comprobaciones. */
export function evaluate({
  invoice: inv,
  rules,
  vendors,
  agreements,
  month,
}: EvalInput): Evaluation {
  const checks: Check[] = [];
  const vendor = vendors.find((v) => v.id === inv.vendorRef) ?? null;
  const vname = vendor?.name ?? inv.vendorName;
  const mes = monthName(inv.period);

  // evidence
  const missingQuote = verifyQuotes(inv.text, inv.quotes)[0];
  const criticalMissing =
    inv.method === "agent" &&
    (!hasFieldEvidence(inv, "proveedor", inv.vendorName) ||
      !hasFieldEvidence(inv, "número", inv.invoiceNumber) ||
      !hasFieldEvidence(inv, "monto", inv.amountText) ||
      !hasFieldEvidence(inv, "moneda", inv.currencyHint) ||
      !hasFieldEvidence(inv, "periodo", inv.period));
  const dueQuote = inv.quotes.find((q) => q.field === "vencimiento")?.text;
  const dueLabel = dueQuote && /\b(?:fecha\s+de\s+)?(?:vencimiento|pago\s+hasta|vence|pagar\s+antes\s+de)\b/i.test(dueQuote)
    && !/\b(?:emisi[oó]n|expedici[oó]n|facturaci[oó]n)\b/i.test(dueQuote);
  const invalidDueDate =
    inv.dueDate != null &&
    (!validDueDate(inv.dueDate) ||
      !dueQuote ||
      !dueLabel ||
      !dueQuote.includes(inv.dueDate) ||
      !inv.text.includes(dueQuote));
  const needsBank =
    vendor?.kind !== "software" &&
    (vendor !== null || inv.bankLast4 === null) &&
    !(vendor === null && inv.bankLast4);
  const missingBank = needsBank && !inv.bankLast4;
  checks.push({
    id: "evidence",
    kind: "REVIEW",
    ok: !missingQuote && !criticalMissing && !missingBank && !invalidDueDate,
    message: invalidDueDate
      ? "La fecha de vencimiento no es válida o no coincide con su cita."
      : missingQuote
        ? `No encuentro ${missingQuote.field} en el documento.`
        : criticalMissing
          ? "Falta evidencia exacta de proveedor, número, monto, moneda o periodo."
          : "No encuentro datos bancarios en el documento.",
    okMessage: "Cada dato tiene su cita en el documento.",
  });

  // amount
  const parsed = parseAmount(inv.amountText, inv.currencyHint ?? undefined);
  const explicitCurrency = /\b(?:USD|COP|MXN|BRL)\b|US\$|R\$/i.test(inv.amountText);
  const currencyConflict = !!(
    parsed.ok &&
    inv.currencyHint &&
    explicitCurrency &&
    parsed.currency !== inv.currencyHint
  );
  const currency: Currency | null = parsed.ok ? parsed.currency : null;
  const amount: Money | null = parsed.ok && currency ? { minor: parsed.minor, currency } : null;
  checks.push({
    id: "amount",
    kind: "REVIEW",
    ok: !!amount && !currencyConflict && validPeriod(inv.period),
    message: !validPeriod(inv.period)
      ? `Periodo inválido: "${inv.period}".`
      : currencyConflict
        ? "La moneda indicada no coincide con la del monto."
        : `No puedo leer el monto con seguridad: "${inv.amountText}".`,
    okMessage: amount ? `Monto leído: ${formatMoney(amount)}.` : "",
  });

  // duplicate
  const dup = month.processed.find(
    (p) =>
      p.id !== inv.id &&
      ((p.vendorRef === inv.vendorRef &&
        inv.invoiceNumber &&
        p.invoiceNumber === inv.invoiceNumber) ||
        (inv.businessId && p.businessId === inv.businessId)),
  );
  const maybeDup =
    !dup &&
    !inv.invoiceNumber &&
    month.processed.find(
      (p) =>
        p.id !== inv.id &&
        p.vendorRef === inv.vendorRef &&
        p.period === inv.period &&
        p.amountText === inv.amountText,
    );
  const fecha = (iso: string) =>
    new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "long", timeZone: "UTC" });
  checks.push(
    dup
      ? {
          id: "duplicate",
          kind: "BLOCK",
          ok: false,
          message: `Esta cuenta ya llegó el ${fecha(dup.receivedAt)} por ${dup.channel}. No la pago dos veces.`,
          okMessage: "",
        }
      : {
          id: "duplicate",
          kind: "REVIEW",
          ok: !maybeDup,
          message: "Puede ser una cuenta repetida: mismo proveedor, monto y mes, sin número.",
          okMessage: "Es la primera vez que llega esta cuenta.",
        },
  );

  // vendor
  checks.push({
    id: "vendor",
    kind: "REVIEW",
    ok: !!vendor,
    message: `${vname} no está en tu lista de proveedores.`,
    okMessage: `${vname} está en tu lista de proveedores.`,
  });

  // agreement
  const agreed = vendor
    ? findAgreed(agreements, vendor.id, inv.period, amount?.currency)
    : { base: null, extras: [], proposed: [], allowed: null };
  checks.push({
    id: "agreement",
    kind: "REVIEW",
    ok: !!agreed.allowed,
    message: `No hay nada acordado con ${vname} para ${mes}.`,
    okMessage: agreed.allowed ? `Lo acordado para ${mes}: ${formatMoney(agreed.allowed)}.` : "",
  });

  // currency
  const curMismatch = !!(amount && agreed.allowed && amount.currency !== agreed.allowed.currency);
  checks.push({
    id: "currency",
    kind: "BLOCK",
    ok: !curMismatch,
    message: `Cobra en ${amount?.currency}, pero lo acordado es en ${agreed.allowed?.currency}.`,
    okMessage: "La moneda coincide con lo acordado.",
  });

  // matches (contra lo que queda de lo acordado este mes)
  let remaining: Money | null = null;
  let overBy: Money | null = null;
  if (amount && agreed.allowed && !curMismatch) {
    const used = month.reservations
      .filter(
        (r) =>
          r.vendorRef === inv.vendorRef &&
          r.period === inv.period &&
          r.amount.currency === amount.currency &&
          r.invoiceId !== inv.id,
      )
      .reduce((s, r) => s + r.amount.minor, 0);
    remaining = { currency: amount.currency, minor: Math.max(0, agreed.allowed.minor - used) };
    const tol = rules.tolerancePct[vendor?.kind ?? "provider"];
    const cap = remaining.minor + Math.floor((remaining.minor * tol) / 100);
    if (amount.minor > cap)
      overBy = { currency: amount.currency, minor: amount.minor - remaining.minor };
  }
  checks.push({
    id: "matches",
    kind: "REVIEW",
    ok: !overBy,
    message: overBy ? `Cobra ${formatMoney(overBy)} más de lo acordado para ${mes}.` : "",
    okMessage: "Cobra lo acordado.",
  });

  // bank
  const bankChanged = !!(vendor?.bankLast4 && inv.bankLast4 && vendor.bankLast4 !== inv.bankLast4);
  checks.push({
    id: "bank",
    kind: "REVIEW",
    ok: !bankChanged,
    message: `La cuenta bancaria termina en ${inv.bankLast4}; la registrada termina en ${vendor?.bankLast4}.`,
    okMessage: vendor?.bankLast4
      ? `La cuenta bancaria coincide (****${vendor.bankLast4}).`
      : "Sin cambio de cuenta bancaria.",
  });

  // limit
  const lim = amount ? rules.autoLimit[amount.currency] : 0;
  const overLimit = !!(amount && amount.minor > lim);
  checks.push({
    id: "limit",
    kind: "REVIEW",
    ok: !overLimit,
    message: amount
      ? `Supera lo que Bullao puede dejar listo solo: ${formatMoney({ minor: lim, currency: amount.currency })} por pago.`
      : "",
    okMessage: "Está dentro de lo que Bullao puede dejar listo solo.",
  });

  // budget
  let budgetOk = true;
  let falta: Money | null = null;
  if (amount) {
    const reserved = month.reservations
      .filter(
        (r) =>
          r.period === inv.period &&
          r.amount.currency === amount.currency &&
          r.invoiceId !== inv.id,
      )
      .reduce((s, r) => s + r.amount.minor, 0);
    const left = rules.budget[amount.currency] - reserved;
    if (amount.minor > left) {
      budgetOk = false;
      falta = { currency: amount.currency, minor: amount.minor - Math.max(0, left) };
    }
  }
  checks.push({
    id: "budget",
    kind: "BLOCK",
    ok: budgetOk,
    message: falta
      ? `No queda presupuesto en ${falta.currency} este mes: faltan ${formatMoney(falta)}.`
      : "",
    okMessage: "Hay presupuesto este mes.",
  });

  const outcome: Outcome = checks.some((c) => !c.ok && c.kind === "BLOCK")
    ? "BLOCKED"
    : checks.some((c) => !c.ok)
      ? "REVIEW"
      : "READY";
  return { outcome, checks, amount, allowed: agreed.allowed, remaining, overBy, agreed };
}

/* ---------------- Estado del mes reconstruido desde los eventos ---------------- */

export type InvoiceView = {
  invoice: InvoiceDraft;
  current: Decision;
  history: Decision[];
  evaluation: Evaluation;
  held: boolean;
};

export type ApState = {
  dataset: Dataset;
  rules: Rules;
  rulesHistory: Rules[];
  vendors: Vendor[];
  agreements: Agreement[];
  invoices: InvoiceView[];
  reservations: Reservation[];
  decisions: Decision[];
  reviewedIds: Set<string>;
};

/** Turns a document as it arrived into a draft: XML via the parser, everything else as read. */
export function toDraft(doc: InboxDoc, vendors: Vendor[]): InvoiceDraft {
  return isXmlDoc(doc) ? xmlDocToDraft(doc, vendors) : doc;
}

/** Uploaded drafts may name a vendor instead of its id. */
function resolveVendor(d: InvoiceDraft, vendors: Vendor[]): InvoiceDraft {
  if (vendors.some((v) => v.id === d.vendorRef)) return d;
  const n = (x: string) =>
    x
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  const v = vendors.find((x) => n(x.name) === n(d.vendorName) || n(x.name) === n(d.vendorRef));
  return v ? { ...d, vendorRef: v.id, vendorName: v.name } : d;
}

function isDraft(x: unknown): x is InvoiceDraft {
  const d = x as InvoiceDraft;
  return (
    !!d &&
    typeof d === "object" &&
    typeof d.id === "string" &&
    typeof d.text === "string" &&
    typeof d.amountText === "string" &&
    typeof d.period === "string" &&
    Array.isArray(d.quotes) &&
    typeof d.vendorName === "string"
  );
}

function sanitizeRules(input: unknown, prev: Rules, version: string): Rules | null {
  const r = input as RulesInput;
  if (!r || typeof r !== "object") return null;
  const ints = (o: Record<string, unknown>, base: Record<string, number>) => {
    const out: Record<string, number> = { ...base };
    for (const k of Object.keys(base)) {
      const v = o?.[k];
      if (typeof v === "number" && Number.isSafeInteger(v) && v >= 0) out[k] = v;
    }
    return out;
  };
  return {
    version,
    autoLimit: ints(r.autoLimit as never, prev.autoLimit) as Rules["autoLimit"],
    budget: ints(r.budget as never, prev.budget) as Rules["budget"],
    tolerancePct: ints(r.tolerancePct as never, prev.tolerancePct) as Rules["tolerancePct"],
  };
}

export function buildState(dataset: Dataset, events: ApEvent[] = []): ApState {
  let rules: Rules = { ...dataset.rules };
  const rulesHistory: Rules[] = [rules];
  const vendors = dataset.vendors;
  const agreements: Agreement[] = dataset.agreements.map((a) => ({
    ...a,
    amount: { ...a.amount },
  }));
  const month: MonthState = { processed: [], reservations: [] };
  const decisions: Decision[] = [];
  const views = new Map<string, InvoiceView>();
  const reviewedIds = new Set<string>();
  const docs = new Map<string, InboxDoc>(
    [...dataset.inbox, ...dataset.late, ...dataset.holdout].map((d) => [d.id, d]),
  );
  let seq = 0;

  const record = (
    inv: InvoiceDraft,
    ev: Evaluation,
    at: string,
    by: Decision["by"],
    note: string | null,
  ): Decision => {
    const prev = views.get(inv.id)?.current ?? null;
    const d: Decision = {
      id: `dec-${++seq}`,
      invoiceId: inv.id,
      outcome: ev.outcome,
      checks: ev.checks,
      rulesVersion: rules.version,
      contentHash: contentHash(inv),
      allowed: ev.allowed,
      amount: ev.amount,
      timeline: agreements.filter((a) => a.vendorId === inv.vendorRef).map((a) => ({ ...a })),
      createdAt: at,
      replaces: prev?.id ?? null,
      by,
      note,
    };
    decisions.push(d);
    const v = views.get(inv.id);
    if (v) {
      v.current = d;
      v.history.push(d);
      v.evaluation = ev;
    } else
      views.set(inv.id, { invoice: inv, current: d, history: [d], evaluation: ev, held: false });
    return d;
  };

  const reserve = (inv: InvoiceDraft, ev: Evaluation) => {
    if (!ev.amount || month.reservations.some((r) => r.invoiceId === inv.id)) return; // idempotente
    const used = ev.agreed.extras.filter((x) => x.kind === "ONE_TIME");
    month.reservations.push({
      invoiceId: inv.id,
      vendorRef: inv.vendorRef,
      period: inv.period,
      amount: ev.amount,
      agreementIds: used.map((u) => u.id),
    });
    for (const u of used) {
      const ag = agreements.find((a) => a.id === u.id);
      if (ag) ag.status = "USED";
    }
  };

  const process = (inv: InvoiceDraft, at: string) => {
    if (views.has(inv.id)) return; // procesar dos veces no duplica
    const ev = evaluate({ invoice: inv, rules, vendors, agreements, month });
    month.processed.push(inv);
    record(inv, ev, at, "bullao", null);
    if (ev.outcome === "READY") reserve(inv, ev);
  };

  const reevaluatePending = (filter: (v: InvoiceView) => boolean, at: string, note: string) => {
    const list = [...views.values()]
      .filter((v) => v.current.outcome !== "READY" && v.current.by === "bullao" && filter(v))
      .sort((x, y) => (x.invoice.receivedAt < y.invoice.receivedAt ? -1 : 1));
    for (const v of list) {
      const ev = evaluate({ invoice: v.invoice, rules, vendors, agreements, month });
      if (
        ev.outcome === v.current.outcome &&
        JSON.stringify(ev.checks) === JSON.stringify(v.current.checks)
      )
        continue;
      record(v.invoice, ev, at, "bullao", note);
      if (ev.outcome === "READY") reserve(v.invoice, ev);
    }
  };

  const sorted = [...events].sort((x, y) =>
    x.created_at < y.created_at ? -1 : x.created_at > y.created_at ? 1 : 0,
  );
  for (const e of sorted) {
    const actor = e.actor ?? "Operador";
    const p = e.payload ?? {};
    if (e.kind === "review_invoice" || e.kind === "receive_invoice") {
      let draft: InvoiceDraft | null = null;
      try {
        const id = p["invoiceId"] ?? p["docId"];
        if (typeof id === "string" && docs.has(id)) {
          draft = toDraft(docs.get(id)!, vendors);
          if (e.kind === "receive_invoice") draft = { ...draft, receivedAt: e.created_at };
        } else if (isDraft(p["draft"])) {
          draft = resolveVendor(
            { ...(p["draft"] as InvoiceDraft), receivedAt: e.created_at },
            vendors,
          );
        }
      } catch {
        draft = null;
      }
      if (draft) {
        reviewedIds.add(draft.id);
        process(draft, e.created_at);
      }
    } else if (e.kind === "update_rules") {
      const next = sanitizeRules(p["rules"], rules, `reglas-v${rulesHistory.length + 1}`);
      if (!next) continue;
      rules = next;
      rulesHistory.push(next);
      reevaluatePending(() => true, e.created_at, `Revisada de nuevo con ${next.version}.`);
    } else if (e.kind === "hold_invoice") {
      const v = views.get(String(p["invoiceId"]));
      if (v) v.held = true;
    } else if (e.kind === "approve_invoice") {
      const v = views.get(String(p["invoiceId"]));
      if (!v || v.current.outcome !== "REVIEW") continue;
      if (p["contentHash"] !== contentHash(v.invoice)) continue; // la cuenta cambió: la autorización no sirve
      const ev = evaluate({ invoice: v.invoice, rules, vendors, agreements, month });
      if (ev.outcome === "BLOCKED") {
        record(
          v.invoice,
          ev,
          e.created_at,
          "persona",
          `${actor} dio el visto bueno, pero al revisar de nuevo ya no se puede aprobar.`,
        );
        continue;
      }
      if (
        !ev.amount ||
        !validPeriod(v.invoice.period) ||
        !ev.checks.find((c) => c.id === "evidence")?.ok ||
        !ev.checks.find((c) => c.id === "amount")?.ok
      ) {
        record(
          v.invoice,
          ev,
          e.created_at,
          "persona",
          `${actor} no puede suplir evidencia o monto inválidos.`,
        );
        continue;
      }
      let note = `${actor} dio el visto bueno solo para esta cuenta.`;
      if (ev.overBy) {
        const one: Agreement = {
          id: `ot-${v.invoice.id}`,
          vendorId: v.invoice.vendorRef,
          service: ev.agreed.base?.service ?? v.invoice.concept,
          kind: "ONE_TIME",
          amount: ev.overBy,
          effectiveFrom: v.invoice.period,
          effectiveTo: v.invoice.period,
          period: v.invoice.period,
          invoiceId: v.invoice.id,
          status: "APPROVED",
          quote: "Solo esta vez",
          approvedBy: actor,
          approvedAt: e.created_at,
        };
        agreements.push(one);
        ev.agreed.extras.push(one);
        note = `${actor} autorizó ${formatMoney(ev.overBy)} adicionales solo para la cuenta de ${monthName(v.invoice.period)}.`;
      }
      const approved: Evaluation = { ...ev, outcome: "READY" };
      v.held = false;
      record(v.invoice, approved, e.created_at, "persona", note);
      reserve(v.invoice, approved);
    } else if (e.kind === "approve_agreement") {
      const ag = agreements.find((a) => a.id === String(p["agreementId"]));
      if (!ag || ag.status !== "PROPOSED") continue;
      ag.status = "APPROVED";
      ag.approvedBy = actor;
      ag.approvedAt = e.created_at;
      if (ag.kind === "MODIFICATION") {
        for (const old of agreements) {
          if (
            old.id !== ag.id &&
            old.vendorId === ag.vendorId &&
            (old.kind === "BASE" || old.kind === "MODIFICATION") &&
            old.status === "APPROVED" &&
            (!old.effectiveTo || old.effectiveTo >= ag.effectiveFrom) &&
            old.effectiveFrom < ag.effectiveFrom
          ) {
            old.effectiveTo = prevMonth(ag.effectiveFrom);
          }
        }
      }
      reevaluatePending(
        (v) => v.invoice.vendorRef === ag.vendorId,
        e.created_at,
        "Revisada de nuevo porque cambió lo acordado.",
      );
    }
  }

  const invoices = [...views.values()].sort((x, y) =>
    x.invoice.receivedAt < y.invoice.receivedAt ? -1 : 1,
  );
  return {
    dataset,
    rules,
    rulesHistory,
    vendors,
    agreements,
    invoices,
    reservations: month.reservations,
    decisions,
    reviewedIds,
  };
}

/** Evalúa un borrador propuesto por un agente sin guardar nada. */
export function previewDraft(state: ApState, draft: InvoiceDraft): Evaluation {
  return evaluate({
    invoice: resolveVendor(draft, state.vendors),
    rules: state.rules,
    vendors: state.vendors,
    agreements: state.agreements,
    month: { processed: state.invoices.map((v) => v.invoice), reservations: state.reservations },
  });
}

export type RulesChange = { invoiceId: string; vendor: string; before: Outcome; after: Outcome };

/** Qué cuentas cambiarían con estas reglas. No guarda nada. */
export function previewRules(
  dataset: Dataset,
  events: ApEvent[],
  rules: RulesInput,
): RulesChange[] {
  const before = buildState(dataset, events);
  const last = events.reduce(
    (m, e) => (e.created_at > m ? e.created_at : m),
    "1970-01-01T00:00:00Z",
  );
  const at = new Date(new Date(last).getTime() + 1).toISOString();
  const after = buildState(dataset, [
    ...events,
    { id: "preview", kind: "update_rules", payload: { rules }, actor: null, created_at: at },
  ]);
  return after.invoices.flatMap((v) => {
    const b = before.invoices.find((x) => x.invoice.id === v.invoice.id);
    return b && b.current.outcome !== v.current.outcome
      ? [
          {
            invoiceId: v.invoice.id,
            vendor: v.invoice.vendorName,
            before: b.current.outcome,
            after: v.current.outcome,
          },
        ]
      : [];
  });
}

/** Review events for the whole inbox, in arrival order (used by the demo and tests). */
export function inboxReviewEvents(
  dataset: Dataset,
  startIso = "2026-10-10T00:00:00.000Z",
): ApEvent[] {
  const t0 = new Date(startIso).getTime();
  return [...dataset.inbox]
    .sort((a, b) => (a.receivedAt < b.receivedAt ? -1 : 1))
    .map((d, i) => ({
      id: `r-${d.id}`,
      kind: "review_invoice" as const,
      payload: { docId: d.id },
      actor: "Bullao",
      created_at: new Date(t0 + i).toISOString(),
    }));
}

export const OUTCOME_LABEL: Record<Outcome, string> = {
  READY: "Lista para pagar",
  REVIEW: "Necesita tu visto bueno",
  BLOCKED: "No se puede aprobar",
};

export function summaryLine(s: ApState): string {
  const n = s.invoices.length;
  const c = (o: Outcome) => s.invoices.filter((v) => v.current.outcome === o).length;
  return `Revisé ${n} cuentas. ${c("READY")} quedaron listas, ${c("REVIEW")} te esperan, ${c("BLOCKED")} no se pueden aprobar.`;
}

export function firstReason(v: InvoiceView): string {
  if (v.current.note && v.current.by === "persona") return v.current.note;
  const fail = v.current.checks
    .filter((c) => !c.ok)
    .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "BLOCK" ? -1 : 1))[0];
  return fail?.message ?? "Cumple todas las reglas.";
}

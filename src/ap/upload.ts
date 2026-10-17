import { parseAmount, type Currency } from "./money";
import type { InvoiceDraft, Quote, Vendor } from "./types";
import { readXml } from "./xml";

type Field = { value: string | null; quote: string | null };
export type ProposedFields = Record<"vendorName" | "invoiceNumber" | "amount" | "currency" | "period" | "concept" | "bankLast4", Field>;

const CURRENCIES = ["USD", "COP", "MXN", "BRL"];

/** Builds a draft from fields proposed by a reader (model or agent). Nothing is trusted: quotes are verified by the engine. */
export function draftFromFields(id: string, text: string, f: ProposedFields, fallbackPeriod: string): InvoiceDraft {
  const quotes: Quote[] = [];
  const q = (field: string, x: Field | undefined) => { if (x?.value != null) quotes.push({ field, text: x.quote ?? "" }); };
  q("monto", f.amount); q("número", f.invoiceNumber); q("cuenta bancaria", f.bankLast4); q("concepto", f.concept); q("proveedor", f.vendorName);
  const cur = f.currency?.value && CURRENCIES.includes(f.currency.value) ? (f.currency.value as Currency) : null;
  // The amount the engine reads must be the quoted text, not a model-normalized value.
  const amountText = f.amount?.quote && f.amount.value && f.amount.quote.includes(f.amount.value) ? f.amount.value : (f.amount?.value ?? "");
  const period = f.period?.value && /^\d{4}-\d{2}$/.test(f.period.value) ? f.period.value : fallbackPeriod;
  const last4 = f.bankLast4?.value?.replace(/\D/g, "").slice(-4) || null;
  return {
    id, vendorRef: f.vendorName?.value ?? "desconocido", vendorName: f.vendorName?.value ?? "Proveedor sin nombre",
    invoiceNumber: f.invoiceNumber?.value ?? null, businessId: null, amountText, currencyHint: cur,
    period, concept: f.concept?.value ?? "", bankLast4: last4, channel: "correo", receivedAt: "",
    text, quotes, method: "agent",
  };
}

export function draftFromXml(id: string, xml: string, vendors: Vendor[]): InvoiceDraft {
  const r = readXml(xml, vendors);
  return { ...r, id, channel: /Comprobante/.test(xml) ? "XML CFDI" : "XML DIAN", receivedAt: "" };
}

export const amountLooksValid = (t: string) => parseAmount(t).ok;

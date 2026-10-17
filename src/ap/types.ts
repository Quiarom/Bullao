import type { Currency, Money } from "./money";

export type Channel = "correo" | "PDF" | "WhatsApp" | "XML DIAN" | "XML CFDI";

export type Vendor = {
  id: string;
  name: string;
  country: "CO" | "MX" | "BR" | "US" | "—";
  kind: "contractor" | "software" | "provider";
  bankLast4: string | null;
  sends: string;
};

export type Agreement = {
  id: string;
  vendorId: string;
  service: string;
  kind: "BASE" | "MODIFICATION" | "ONE_TIME" | "PROJECT";
  amount: Money;
  effectiveFrom: string; // YYYY-MM
  effectiveTo: string | null;
  period: string | null; // ONE_TIME / PROJECT
  invoiceId: string | null;
  status: "PROPOSED" | "APPROVED" | "SUPERSEDED" | "USED";
  quote: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
};

export type Quote = { field: string; text: string };

export type InvoiceDraft = {
  id: string;
  vendorRef: string; // vendor id or unknown name
  vendorName: string;
  invoiceNumber: string | null;
  businessId: string | null;
  amountText: string;
  currencyHint: Currency | null;
  period: string;
  concept: string;
  bankLast4: string | null;
  channel: Channel;
  receivedAt: string; // ISO date
  text: string; // full document text
  quotes: Quote[];
  method: "xml" | "agent" | "fixture";
  caseNo?: number;
};

export type Check = {
  id: "evidence" | "amount" | "duplicate" | "currency" | "budget" | "vendor" | "bank" | "agreement" | "matches" | "limit";
  ok: boolean;
  kind: "BLOCK" | "REVIEW";
  message: string;
  okMessage: string;
};

export type Outcome = "READY" | "REVIEW" | "BLOCKED";

export type Decision = {
  id: string;
  invoiceId: string;
  outcome: Outcome;
  checks: Check[];
  rulesVersion: string;
  contentHash: string;
  allowed: Money | null;
  amount: Money | null;
  timeline: Agreement[];
  createdAt: string;
  replaces: string | null;
  by: "bullao" | "persona";
  note: string | null;
};

export type Rules = {
  version: string;
  autoLimit: Record<Currency, number>; // minor units
  budget: Record<Currency, number>;
  tolerancePct: { contractor: number; software: number; provider: number };
};

export type ApEvent = {
  id: string;
  kind: "approve_invoice" | "hold_invoice" | "approve_agreement" | "receive_invoice";
  payload: Record<string, unknown>;
  actor: string | null;
  created_at: string;
};

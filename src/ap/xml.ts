import { XMLParser } from "fast-xml-parser";
import type { Channel, InvoiceDraft, Quote, Vendor } from "./types";

/**
 * Deterministic readers for electronic invoices. No model involved.
 * - CFDI 4.0 (México): cfdi:Comprobante + tfd:TimbreFiscalDigital
 * - DIAN UBL 2.1 (Colombia): AttachedDocument with the Invoice embedded in CDATA, or a bare Invoice
 */
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
});

type Node = Record<string, unknown>;
const obj = (v: unknown): Node =>
  v && typeof v === "object" ? (Array.isArray(v) ? (v[0] as Node) : (v as Node)) : {};
const str = (v: unknown): string | null => {
  if (v == null) return null;
  if (typeof v === "string" || typeof v === "number") return String(v);
  const t = (v as Node)["#text"];
  return t == null ? null : String(t);
};

export type XmlReading = Omit<InvoiceDraft, "id" | "channel" | "receivedAt" | "caseNo">;

export class XmlReadError extends Error {}

function quotesFor(xml: string, pairs: [string, string | null][]): Quote[] {
  return pairs
    .filter((p): p is [string, string] => !!p[1] && xml.includes(p[1]))
    .map(([field, text]) => ({ field, text }));
}

function vendorFor(vendors: Vendor[], taxId: string | null, name: string | null) {
  return (
    vendors.find((v) => v.taxId && taxId && v.taxId === taxId) ??
    vendors.find((v) => name && v.name === name) ??
    null
  );
}

export function readCfdi(xml: string, vendors: Vendor[]): XmlReading {
  const doc = parser.parse(xml) as Node;
  const c = obj(doc["Comprobante"]);
  if (!doc["Comprobante"]) throw new XmlReadError("No es un CFDI.");
  const emisor = obj(c["Emisor"]);
  const concepto = obj(obj(c["Conceptos"])["Concepto"]);
  const tfd = obj(obj(c["Complemento"])["TimbreFiscalDigital"]);
  const pago = obj(obj(c["Addenda"])["Pago"]);
  const total = str(c["@Total"]);
  const folio = str(c["@Folio"]);
  const uuid = str(tfd["@UUID"]);
  const fecha = str(c["@Fecha"]) ?? "";
  const dueDate = str(c["@FechaVencimiento"]);
  const rfc = str(emisor["@Rfc"]);
  const name = str(emisor["@Nombre"]);
  const desc = str(concepto["@Descripcion"]) ?? "";
  const clabe = str(pago["@Clabe"]);
  const v = vendorFor(vendors, rfc, name);
  const cur = str(c["@Moneda"]);
  return {
    vendorRef: v?.id ?? name ?? "desconocido",
    vendorName: v?.name ?? name ?? "Emisor desconocido",
    invoiceNumber: folio,
    businessId: uuid,
    amountText: total ?? "",
    currencyHint: cur === "MXN" || cur === "USD" ? cur : null,
    period: fecha.slice(0, 7),
    dueDate,
    concept: desc,
    bankLast4: clabe ? clabe.replace(/\D/g, "").slice(-4) || null : null,
    text: xml,
    method: "xml",
    quotes: quotesFor(xml, [
      ["monto", total],
      ["número", folio],
      ["folio fiscal", uuid],
      ["cuenta bancaria", clabe],
      ["concepto", desc],
      ...(dueDate ? [["vencimiento", dueDate] as [string, string]] : []),
    ]),
  };
}

export function readDian(xml: string, vendors: Vendor[]): XmlReading {
  const outer = parser.parse(xml) as Node;
  let inv: Node;
  if (outer["AttachedDocument"]) {
    const desc = str(
      obj(obj(obj(outer["AttachedDocument"])["Attachment"])["ExternalReference"])["Description"],
    );
    if (!desc) throw new XmlReadError("El AttachedDocument no trae la factura.");
    inv = obj((parser.parse(desc) as Node)["Invoice"]);
  } else if (outer["Invoice"]) {
    inv = obj(outer["Invoice"]);
  } else throw new XmlReadError("No es una factura DIAN.");
  const party = obj(obj(inv["AccountingSupplierParty"])["Party"]);
  const nit = str(obj(party["PartyTaxScheme"])["CompanyID"]);
  const name = str(obj(party["PartyName"])["Name"]);
  const num = str(inv["ID"]);
  const cufe = str(inv["UUID"]);
  const total = str(obj(inv["LegalMonetaryTotal"])["PayableAmount"]);
  const dueDate = str(inv["PaymentDueDate"]);
  const cur = str(inv["DocumentCurrencyCode"]);
  const desc = str(obj(obj(inv["InvoiceLine"])["Item"])["Description"]) ?? "";
  const acct = str(obj(obj(inv["PaymentMeans"])["PayeeFinancialAccount"])["ID"]);
  const v = vendorFor(vendors, nit, name);
  return {
    vendorRef: v?.id ?? name ?? "desconocido",
    vendorName: v?.name ?? name ?? "Emisor desconocido",
    invoiceNumber: num,
    businessId: cufe,
    amountText: total ?? "",
    currencyHint: cur === "COP" || cur === "USD" ? cur : null,
    period: (str(inv["IssueDate"]) ?? "").slice(0, 7),
    dueDate,
    concept: desc,
    bankLast4: acct ? acct.replace(/\D/g, "").slice(-4) || null : null,
    text: xml,
    method: "xml",
    quotes: quotesFor(xml, [
      ["monto", total],
      ["número", num],
      ["CUFE", cufe],
      ["cuenta bancaria", acct],
      ["concepto", desc],
      ...(dueDate ? [["vencimiento", dueDate] as [string, string]] : []),
    ]),
  };
}

export function readXml(xml: string, vendors: Vendor[]): XmlReading {
  return /cfd\/4|Comprobante/.test(xml) ? readCfdi(xml, vendors) : readDian(xml, vendors);
}

export function xmlDocToDraft(
  d: { id: string; caseNo?: number; channel: Channel; receivedAt: string; xml: string },
  vendors: Vendor[],
): InvoiceDraft {
  return {
    ...readXml(d.xml, vendors),
    id: d.id,
    ...(d.caseNo != null ? { caseNo: d.caseNo } : {}),
    channel: d.channel,
    receivedAt: d.receivedAt,
  };
}

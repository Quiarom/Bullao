import type { InboxDoc, InvoiceDraft } from "@/ap/types";
import { isXmlDoc } from "@/ap/types";
import { toDraft } from "@/ap/engine";
import { cn } from "@/lib/utils";

/** Highlight only literal, non-overlapping values, never their surrounding sentences. */
export function Highlighted({ text, quotes }: { text: string; quotes: { text: string }[] }) {
  const ranges: [number, number][] = [];
  for (const q of quotes) {
    if (!q.text) continue;
    const i = text.indexOf(q.text);
    if (i >= 0 && !ranges.some(([s, e]) => i < e && i + q.text.length > s)) ranges.push([i, i + q.text.length]);
  }
  ranges.sort((x, y) => x[0] - y[0]);
  const parts: React.ReactNode[] = [];
  let cur = 0;
  ranges.forEach(([s, e], k) => { parts.push(text.slice(cur, s)); parts.push(<mark key={k} className="mark-quote">{text.slice(s, e)}</mark>); cur = e; });
  parts.push(text.slice(cur));
  return <>{parts}</>;
}
const header = (text: string, key: string) => text.split("\n").find((l) => l.startsWith(key))?.slice(key.length).trim();
export function ArrivedDocument({ doc, draft, className }: { doc: InboxDoc | InvoiceDraft; draft?: InvoiceDraft; className?: string }) {
  const d = isXmlDoc(doc) ? draft ?? toDraft(doc, []) : doc;
  // A reader may quote a whole sentence; presentation only marks the exact amount.
  const amountValue = d.amountText;
  const quote = d.quotes.find((q) => q.field === "monto");
  const exact = quote && d.text.includes(amountValue) ? [{ text: amountValue }] : [];
  if (isXmlDoc(doc) || d.method === "xml") {
    const xml = isXmlDoc(doc) ? doc.xml : d.text;
    return <div className={cn("min-w-0", className)}>
      <div className="document-sheet bg-card p-5 sm:p-6">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-b pb-5"><div className="min-w-0"><p className="text-xs uppercase text-muted-foreground">Factura electrónica</p><p className="mt-2 font-display text-lg font-bold">{d.vendorName}</p></div><p className="text-xs text-muted-foreground">{d.channel}</p></div>
        <dl className="mt-5 grid gap-4 text-sm"><div><dt className="text-xs text-muted-foreground">Número</dt><dd className="mt-1">{d.invoiceNumber ?? "—"}</dd></div><div><dt className="text-xs text-muted-foreground">Periodo</dt><dd className="mt-1">{d.period}</dd></div><div className="border-y py-4"><dt className="text-xs text-muted-foreground">Concepto</dt><dd className="mt-2">{d.concept}</dd></div><div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3"><dt className="font-bold">Total {d.currencyHint ?? ""}</dt><dd className="font-display text-2xl font-semibold"><Highlighted text={amountValue} quotes={exact} /></dd></div>{d.businessId && <div><dt className="text-xs text-muted-foreground">Identificador fiscal</dt><dd className="mt-1 break-all text-xs">{d.businessId}</dd></div>}{d.bankLast4 && <div><dt className="text-xs text-muted-foreground">Cuenta bancaria</dt><dd className="mt-1">****{d.bankLast4}</dd></div>}</dl>
      </div><details className="mt-3 text-sm"><summary className="cursor-pointer font-bold text-primary">Abrir original</summary><pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-all border-t pt-3 font-mono text-xs leading-6">{xml}</pre></details>
    </div>;
  }
  if (d.channel === "correo") {
    const body = d.text.split("\n").filter((l) => !l.startsWith("De:") && !l.startsWith("Asunto:")).join("\n");
    return <div className={cn("document-sheet bg-card p-5", className)}><div className="border-b pb-3 text-xs"><p className="text-muted-foreground">De: <span className="text-foreground">{header(d.text, "De:") ?? d.vendorName}</span></p><p className="mt-1 font-bold">{header(d.text, "Asunto:") ?? d.concept}</p></div><pre className="mt-4 whitespace-pre-wrap break-words font-sans text-sm leading-7"><Highlighted text={body} quotes={exact} /></pre></div>;
  }
  return <div className={cn("document-sheet bg-card p-5 sm:p-6", className)}>{d.channel === "WhatsApp" && <p className="mb-4 border-b pb-3 text-xs text-muted-foreground">WhatsApp · {d.vendorName}</p>}<pre className="whitespace-pre-wrap break-words font-sans text-sm leading-7"><Highlighted text={d.text} quotes={exact} /></pre></div>;
}

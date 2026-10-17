import type { InboxDoc, InvoiceDraft } from "@/ap/types";
import { isXmlDoc } from "@/ap/types";
import { cn } from "@/lib/utils";

/** Highlights each quote (first non-overlapping occurrence) inside the text. */
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
  ranges.forEach(([s, e], k) => {
    parts.push(text.slice(cur, s));
    parts.push(<mark key={k} className="mark-quote">{text.slice(s, e)}</mark>);
    cur = e;
  });
  parts.push(text.slice(cur));
  return <>{parts}</>;
}

const header = (text: string, key: string) => text.split("\n").find((l) => l.startsWith(key))?.slice(key.length).trim();

/** Renders a document the way it arrived: paper, email, chat bubble or XML. */
export function ArrivedDocument({ doc, draft, className }: { doc: InboxDoc | InvoiceDraft; draft?: InvoiceDraft; className?: string }) {
  const quotes = draft?.quotes ?? [];
  if (isXmlDoc(doc as InboxDoc) || (draft?.method === "xml")) {
    const xml = isXmlDoc(doc as InboxDoc) ? (doc as { xml: string }).xml : (doc as InvoiceDraft).text;
    return (
      <pre className={cn("amount max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border bg-muted p-4 text-xs leading-6", className)}>
        <Highlighted text={xml} quotes={quotes} />
      </pre>
    );
  }
  const d = doc as InvoiceDraft;
  if (d.channel === "WhatsApp") {
    const lines = d.text.split("\n").filter(Boolean);
    return (
      <div className={cn("rounded-lg border bg-muted p-4", className)}>
        <p className="mb-2 text-xs font-bold text-muted-foreground">{lines[0]?.replace(/[[\]]/g, "")}</p>
        <div className="max-w-sm rounded-lg rounded-tl-none border bg-card p-3 text-sm leading-6 whitespace-pre-wrap">
          <Highlighted text={lines.slice(1).join("\n")} quotes={quotes} />
        </div>
      </div>
    );
  }
  if (d.channel === "correo") {
    const from = header(d.text, "De:");
    const subject = header(d.text, "Asunto:");
    const body = d.text.split("\n").filter((l) => !l.startsWith("De:") && !l.startsWith("Asunto:")).join("\n");
    return (
      <div className={cn("rounded-lg border bg-card", className)}>
        <div className="border-b px-4 py-2 text-xs text-muted-foreground">
          <p>De: <span className="text-foreground">{from ?? `${d.vendorName.toLowerCase().replace(/\s+/g, ".")}@correo.ficticio`}</span></p>
          <p>Asunto: <span className="text-foreground">{subject ?? d.concept}</span></p>
        </div>
        <pre className="whitespace-pre-wrap p-4 font-sans text-sm leading-6"><Highlighted text={body} quotes={quotes} /></pre>
      </div>
    );
  }
  return (
    <pre className={cn("amount whitespace-pre-wrap rounded-lg border bg-card p-5 text-sm leading-7 paper-ruled", className)}>
      <Highlighted text={d.text} quotes={quotes} />
    </pre>
  );
}

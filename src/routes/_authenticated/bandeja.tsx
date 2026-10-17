import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DATASET, actorName, eventsQuery, useApState } from "@/hooks/use-ap";
import { buildState, OUTCOME_LABEL, summaryLine, toDraft } from "@/ap/engine";
import { draftFromFields, draftFromXml } from "@/ap/upload";
import { XmlReadError } from "@/ap/xml";
import type { InboxDoc, Outcome } from "@/ap/types";
import { extractInvoice } from "@/lib/extract.functions";
import { ArrivedDocument } from "@/components/bullao/document";
import { StatusChip } from "@/components/bullao/brand";
import { ErrorState, Loading } from "@/components/bullao/states";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/bandeja")({
  head: () => ({
    meta: [
      { title: "Bandeja · Bullao" },
      { name: "description", content: "Los documentos tal como llegaron: cuentas de cobro, correos, WhatsApp y facturas electrónicas." },
      { property: "og:title", content: "Bandeja · Bullao" },
      { property: "og:description", content: "Bullao lee cada documento y lo compara con lo acordado." },
    ],
  }),
  component: Bandeja,
});

const KIND: Record<string, string> = { PDF: "Cuenta de cobro", correo: "Correo", WhatsApp: "WhatsApp", "XML DIAN": "Factura DIAN", "XML CFDI": "CFDI" };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function Bandeja() {
  const { state, data: events, isLoading, isError, refetch } = useApState();
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState<string | null>(null);
  const [log, setLog] = useState<{ vendor: string; outcome: Outcome }[]>([]);
  const [upload, setUpload] = useState(false);
  const stop = useRef(false);

  const docs = useMemo(() => [...DATASET.inbox].sort((a, b) => (a.receivedAt < b.receivedAt ? -1 : 1)), []);
  if (isLoading) return <Loading />;
  if (isError || !state || !events) return <ErrorState onRetry={() => refetch()} />;
  const pending = docs.filter((d) => !state.reviewedIds.has(d.id));

  async function reviewAll() {
    setRunning(true); setLog([]); stop.current = false;
    const actor = await actorName();
    for (const d of pending) {
      if (stop.current) break;
      const draft = toDraft(d, DATASET.vendors);
      setStep(`Leyendo ${KIND[d.channel]?.toLowerCase() ?? "el documento"} de ${draft.vendorName}…`);
      await wait(380);
      setStep(`Comparando con lo acordado con ${draft.vendorName}…`);
      const { error } = await supabase.from("ap_events").insert({ kind: "review_invoice", payload: { docId: d.id }, actor });
      if (error) { toast.error("No pude guardar la revisión. Paré aquí; nada se aprobó."); break; }
      const evs = await qc.fetchQuery({ ...eventsQuery, staleTime: 0 });
      const v = buildState(DATASET, evs).invoices.find((x) => x.invoice.id === d.id);
      if (v) { setStep(`${draft.vendorName}: ${OUTCOME_LABEL[v.current.outcome]}`); setLog((l) => [...l, { vendor: draft.vendorName, outcome: v.current.outcome }]); }
      await wait(220);
    }
    await qc.invalidateQueries({ queryKey: ["ap-events"] });
    setStep(null); setRunning(false);
  }

  return (
    <div className="rise grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold md:text-4xl">Bandeja</h1>
          <p className="mt-1 text-muted-foreground">
            {pending.length ? `${pending.length} documentos sin revisar, tal como llegaron.` : summaryLine(state)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setUpload(true)} disabled={running}>Subir una cuenta</Button>
          {running
            ? <Button variant="outline" onClick={() => { stop.current = true; }}>Detener</Button>
            : <Button onClick={reviewAll} disabled={!pending.length}>Revisar la bandeja</Button>}
        </div>
      </div>

      {(running || log.length > 0) && (
        <section className="rounded-xl border bg-card p-5" aria-live="polite">
          <div className="flex items-center justify-between gap-3">
            <p className="font-bold">{running ? step : "Revisión terminada."}</p>
            <span className="amount text-sm text-muted-foreground">{log.length} / {log.length + (running ? pending.length : 0)}</span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${running ? Math.round((log.length / (log.length + pending.length || 1)) * 100) : 100}%` }} />
          </div>
          {!running && <p className="mt-3">{summaryLine(state)} <Link to="/cuentas" className="font-bold text-primary underline">Ver cuentas</Link></p>}
          <ul className="mt-3 flex flex-wrap gap-2">
            {log.map((l, i) => <li key={i} className="flex items-center gap-1.5 text-xs"><span className="text-muted-foreground">{l.vendor}</span><StatusChip outcome={l.outcome} /></li>)}
          </ul>
        </section>
      )}

      <ul className="grid gap-4 md:grid-cols-2">
        {docs.map((d) => <DocCard key={d.id} doc={d} reviewed={state.invoices.find((v) => v.invoice.id === d.id)?.current.outcome ?? null} />)}
      </ul>

      <UploadDialog open={upload} onOpenChange={setUpload} />
    </div>
  );
}

function DocCard({ doc, reviewed }: { doc: InboxDoc; reviewed: Outcome | null }) {
  const draft = useMemo(() => toDraft(doc, DATASET.vendors), [doc]);
  return (
    <li className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold">{draft.vendorName}</p>
          <p className="text-xs text-muted-foreground">{KIND[doc.channel] ?? doc.channel} · llegó el {new Date(doc.receivedAt).toLocaleDateString("es-CO", { day: "numeric", month: "short", timeZone: "UTC" })}</p>
        </div>
        {reviewed ? <Link to="/cuentas/$id" params={{ id: doc.id }}><StatusChip outcome={reviewed} /></Link> : <span className="text-xs text-muted-foreground">Sin revisar</span>}
      </div>
      <ArrivedDocument doc={doc} className="max-h-56 overflow-hidden" />
    </li>
  );
}

function UploadDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const extract = useServerFn(extractInvoice);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(draft: ReturnType<typeof draftFromXml>) {
    const { error } = await supabase.from("ap_events").insert({ kind: "review_invoice", payload: { draft } as never, actor: await actorName() });
    if (error) throw error;
    await qc.invalidateQueries({ queryKey: ["ap-events"] });
    onOpenChange(false); setText("");
    navigate({ to: "/cuentas/$id", params: { id: draft.id } });
  }

  async function fromText() {
    setBusy(true);
    try {
      const r = await extract({ data: { text } });
      if (!r.ok) { toast.error(r.message); return; }
      await save(draftFromFields(`up-${crypto.randomUUID()}`, text, r.fields, DATASET.company.month));
    } catch { toast.error("No pude leer la cuenta. No se guardó nada."); }
    finally { setBusy(false); }
  }

  async function fromXml(file: File) {
    setBusy(true);
    try {
      const xml = await file.text();
      await save(draftFromXml(`up-${crypto.randomUUID()}`, xml, DATASET.vendors));
    } catch (e) { toast.error(e instanceof XmlReadError ? e.message : "No pude leer ese XML."); }
    finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Subir una cuenta</DialogTitle>
          <DialogDescription>Bullao propone los campos con la frase exacta del documento. Si una frase no está en el texto, la cuenta pide tu visto bueno.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="texto">
          <TabsList><TabsTrigger value="texto">Pegar texto</TabsTrigger><TabsTrigger value="xml">Subir XML</TabsTrigger></TabsList>
          <TabsContent value="texto" className="grid gap-3">
            <Textarea rows={9} value={text} onChange={(e) => setText(e.target.value)} placeholder="Pega aquí la cuenta de cobro, el correo o el mensaje…" className="amount text-sm" />
            <Button onClick={fromText} disabled={busy || text.trim().length < 10}>{busy ? "Leyendo…" : "Leer y revisar"}</Button>
          </TabsContent>
          <TabsContent value="xml" className="grid gap-3">
            <p className="text-sm text-muted-foreground">CFDI 4.0 o factura electrónica DIAN. Se lee con un lector de XML, sin IA.</p>
            <input type="file" accept=".xml,text/xml,application/xml" disabled={busy}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) fromXml(f); }}
              className="text-sm file:mr-3 file:rounded-md file:border file:bg-secondary file:px-3 file:py-1.5 file:font-bold file:text-secondary-foreground" />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

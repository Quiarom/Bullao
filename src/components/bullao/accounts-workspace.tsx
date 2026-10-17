import { useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Check, LoaderCircle, Plus, Square, Inbox } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DATASET, actorName, eventsQuery, useApState } from "@/hooks/use-ap";
import { firstReason, monthName, toDraft } from "@/ap/engine";
import { CURRENCIES, formatMoney, parseAmount } from "@/ap/money";
import type { Outcome } from "@/ap/types";
import { Button } from "@/components/ui/button";
import { Amount, StatusChip } from "./brand";
import { ErrorState, Loading } from "./states";
import { AccountDetail } from "./account-detail";
import { ArrivedDocument } from "./document";
import { UploadDialog } from "./upload-dialog";
import { cn } from "@/lib/utils";

const FILTERS: { id: Outcome | "ALL"; label: string }[] = [{ id: "REVIEW", label: "Te esperan" }, { id: "READY", label: "Listas" }, { id: "BLOCKED", label: "No se pueden" }, { id: "ALL", label: "Todas" }];
export function AccountsWorkspace({ selectedId }: { selectedId?: string }) {
  const { state, isLoading, isError, refetch } = useApState();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Outcome | "ALL">("REVIEW");
  const [upload, setUpload] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<Record<string, "reading" | "comparing" | "done">>({});
  const stop = useRef(false);
  const docs = useMemo(() => [...DATASET.inbox].sort((a, b) => a.receivedAt.localeCompare(b.receivedAt)).map((d) => toDraft(d, DATASET.vendors)), []);
  if (isLoading) return <Loading />;
  if (isError || !state) return <ErrorState onRetry={() => refetch()} />;
  const pending = docs.filter((d) => !state.reviewedIds.has(d.id));
  const all = [...docs, ...state.invoices.filter((v) => !docs.some((d) => d.id === v.invoice.id)).map((v) => v.invoice)];
  const rows = all.map((invoice) => ({ invoice, view: state.invoices.find((v) => v.invoice.id === invoice.id) })).filter(({ view }) => filter === "ALL" || (view ? view.current.outcome === filter : filter === "REVIEW"));
  const selected = (selectedId ? all.find((d) => d.id === selectedId) : undefined) ?? rows[0]?.invoice;
  const view = state.invoices.find((v) => v.invoice.id === selected?.id);
  async function reviewAll() {
    setRunning(true); stop.current = false; setProgress({});
    try {
      const actor = await actorName();
      for (const doc of pending) {
        if (stop.current) break;
        setProgress((p) => ({ ...p, [doc.id]: "reading" }));
        await new Promise((r) => setTimeout(r, 300));
        setProgress((p) => ({ ...p, [doc.id]: "comparing" }));
        const { error } = await supabase.from("ap_events").insert({ kind: "review_invoice", payload: { docId: doc.id }, actor });
        if (error) throw error;
        await qc.fetchQuery({ ...eventsQuery, staleTime: 0 });
        setProgress((p) => ({ ...p, [doc.id]: "done" }));
      }
    } catch { toast.error("No pude guardar la revisión. Paré aquí; nada se aprobó."); }
    finally { await qc.invalidateQueries({ queryKey: ["ap-events"] }); setRunning(false); }
  }
  return <div className="rise">
    <header className="mb-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
      <div className="min-w-0"><p className="text-sm text-muted-foreground">{DATASET.company.name} · {monthName(DATASET.company.month)} {DATASET.company.month.slice(0, 4)}</p><h1 className="mt-1 text-4xl font-extrabold">Cuentas</h1></div>
      <div><p className="mb-2 text-xs font-bold text-muted-foreground">Quedan este mes</p><div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:flex sm:flex-wrap">{CURRENCIES.map((c) => { const used = state.reservations.filter((r) => r.period === DATASET.company.month && r.amount.currency === c).reduce((s, r) => s + r.amount.minor, 0); return <Amount key={c} value={{ currency: c, minor: state.rules.budget[c] - used }} className={cn("text-sm", state.rules.budget[c] > 0 && used / state.rules.budget[c] > .9 ? "text-wait" : "text-foreground")} />; })}</div></div>
    </header>
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
      <section className="min-w-0 overflow-hidden rounded-xl border" aria-label="Lista de cuentas">
        <div className="border-b p-4">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2"><p className="font-bold">{all.length} cuentas <span className="font-normal text-muted-foreground">· {pending.length} sin revisar</span></p><Button variant="ghost" size="icon" title="Subir una cuenta" aria-label="Subir una cuenta" disabled={running} onClick={() => setUpload(true)}><Plus /></Button></div>
          {(pending.length > 0 || running) && <div className="mt-3 flex items-center gap-2"><Button className="min-w-0 flex-1" onClick={reviewAll} disabled={running}>{running ? <><LoaderCircle className="animate-spin" /> Revisando…</> : <><Inbox /> Revisar la bandeja</>}</Button>{running && <Button variant="outline" size="icon" title="Detener" aria-label="Detener" onClick={() => { stop.current = true; }}><Square /></Button>}</div>}
          <div className="mt-4 grid grid-cols-4 gap-1" aria-label="Filtrar cuentas">{FILTERS.map((f) => <Button key={f.id} variant="ghost" className={cn("h-auto min-h-9 min-w-0 whitespace-normal px-1 text-xs", filter === f.id && "text-primary underline underline-offset-8")} aria-pressed={filter === f.id} onClick={() => { setFilter(f.id); navigate({ to: "/cuentas", search: {}, replace: true }); }}>{f.label}</Button>)}</div>
        </div>
        <ul className="divide-y lg:max-h-[900px] lg:overflow-y-auto">{rows.map(({ invoice: inv, view: v }) => { const p = progress[inv.id]; const parsed = parseAmount(inv.amountText, inv.currencyHint ?? undefined); return <li key={inv.id}><Button variant="ghost" aria-pressed={selected?.id === inv.id} onClick={() => navigate({ to: "/cuentas", search: { cuenta: inv.id }, replace: true })} className={cn("h-auto w-full justify-start whitespace-normal rounded-none border-0 p-4 text-left", selected?.id === inv.id && "bg-card")}><div className="w-full min-w-0"><div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3"><span className={cn("truncate font-bold", selected?.id === inv.id && "text-primary")}>{inv.vendorName}</span><Amount value={v?.current.amount ?? (parsed.ok && parsed.currency ? { minor: parsed.minor, currency: parsed.currency } : null)} className="shrink-0 text-xs" /></div><p className="mt-1 truncate text-xs text-muted-foreground">{inv.invoiceNumber ?? "Sin número"} · {inv.concept}</p><div className="mt-3 flex min-h-6 items-center gap-2">{p && p !== "done" ? <span className="flex items-center gap-2 text-xs text-primary"><LoaderCircle className="h-3 w-3 animate-spin" />{p === "reading" ? "Leyendo documento…" : "Comparando con lo acordado…"}</span> : v ? <StatusChip outcome={v.current.outcome} /> : <span className="text-xs text-muted-foreground">Sin revisar</span>}{p === "done" && <Check className="h-3 w-3 text-ok" />}</div>{v && <p className="mt-2 text-xs font-normal text-muted-foreground">{firstReason(v)}</p>}</div></Button></li>; })}{!rows.length && <li className="p-8 text-center text-sm text-muted-foreground">No hay cuentas en este grupo.</li>}</ul>
      </section>
      <section className="min-w-0 overflow-hidden rounded-xl border" aria-label="Cuenta seleccionada">{view ? <AccountDetail key={view.invoice.id} view={view} state={state} /> : selected ? <article className="p-5 sm:p-6"><p className="text-sm text-muted-foreground">Sin revisar</p><h2 className="mt-3 text-2xl font-extrabold">{selected.vendorName}</h2><p className="mt-3 text-sm text-muted-foreground">{selected.concept}</p><h3 className="mt-8 border-t pt-5 font-bold">El documento</h3><ArrivedDocument doc={selected} draft={selected} className="mt-4" /></article> : <p className="p-8 text-sm text-muted-foreground">No hay una cuenta seleccionada.</p>}</section>
    </div><UploadDialog open={upload} onOpenChange={setUpload} />
  </div>;
}

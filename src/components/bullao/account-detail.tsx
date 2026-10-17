import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Check, X, Mail } from "lucide-react";
import { toast } from "sonner";
import { useApAction } from "@/hooks/use-ap";
import { monthName, type ApState, type InvoiceView } from "@/ap/engine";
import { formatMoney } from "@/ap/money";
import { ArrivedDocument } from "./document";
import { Amount, StatusChip } from "./brand";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export function AccountDetail({ view: v, state }: { view: InvoiceView; state: ApState }) {
  const act = useApAction();
  const [confirm, setConfirm] = useState(false);
  const { invoice: inv, current: d, evaluation: ev } = v;
  const mes = monthName(inv.period);
  const timeline = state.agreements.filter((a) => a.vendorId === inv.vendorRef);
  const canApprove = d.outcome === "REVIEW" && !d.checks.some((c) => !c.ok && c.kind === "BLOCK");
  const nov = state.invoices.find((x) => x.invoice.id === "inv-11-nov");
  const failed = d.checks.filter((c) => !c.ok);
  const passed = d.checks.filter((c) => c.ok);
  const sentence = !ev.allowed ? `No hay nada acordado con ${inv.vendorName} para ${mes}.` : ev.overBy ? `Lo acordado para ${mes} es ${formatMoney(ev.allowed)}. Cobra ${formatMoney(ev.overBy)} más.` : `Lo acordado para ${mes} es ${formatMoney(ev.allowed)}. Cobra lo acordado.`;
  const approveText = ev.overBy ? `Vas a autorizar ${formatMoney(ev.overBy)} adicionales solo para la cuenta de ${mes}. ${ev.agreed.base ? `El acuerdo mensual sigue siendo ${formatMoney(ev.agreed.base.amount)}. ` : ""}Antes de apartar el monto vuelvo a revisar el presupuesto.` : `Vas a dar el visto bueno a ${inv.vendorName} por ${d.amount ? formatMoney(d.amount) : "este monto"}, solo para esta cuenta. Antes de apartar el monto vuelvo a revisar el presupuesto.`;
  return (
    <article className="min-w-0" aria-label={`Ficha de ${inv.vendorName}`}>
      <header className="border-b p-5 sm:p-6">
        <StatusChip outcome={d.outcome} />
        <h2 className="mt-4 text-2xl font-extrabold">{inv.vendorName}</h2>
        <p className="mt-2 break-words font-display text-4xl font-semibold">{d.amount ? formatMoney(d.amount) : "—"}</p>
        <p className="mt-2 text-sm text-muted-foreground">{inv.concept} · {inv.invoiceNumber ?? "Sin número"}</p>
        <p className="mt-5 leading-6">{sentence}</p>
        {canApprove && <div className="mt-5 flex flex-wrap gap-2">
          <Button className="h-auto min-h-9 whitespace-normal text-left" onClick={() => setConfirm(true)} disabled={act.isPending}>Dar el visto bueno solo esta vez</Button>
          <Button variant="outline" disabled={act.isPending || v.held} onClick={() => act.mutate({ kind: "hold_invoice", payload: { invoiceId: inv.id } }, { onSuccess: () => toast("La dejé pendiente."), onError: () => toast.error("No pude dejarla pendiente.") })}>{v.held ? "Pendiente" : "Dejar pendiente"}</Button>
        </div>}
        {d.note && <p className="mt-3 text-sm text-muted-foreground">{d.note}</p>}
        {inv.id === "inv-11" && d.outcome === "READY" && !nov && <Button className="mt-4 h-auto whitespace-normal" variant="outline" onClick={() => act.mutate({ kind: "receive_invoice", payload: { invoiceId: "inv-11-nov" } })}><Mail /> Llegó la cuenta de noviembre</Button>}
        {nov && inv.id === "inv-11" && <Link to="/cuentas" search={{ cuenta: nov.invoice.id }} className="mt-4 block text-sm text-primary underline">Ver la cuenta de noviembre →</Link>}
      </header>
      <section className="border-b p-5 sm:p-6">
        <h3 className="font-bold">Comprobaciones</h3>
        <ul className="mt-4 grid gap-3">{failed.map((c) => <li key={c.id} className="flex gap-2.5 text-sm"><X className={cn("mt-0.5 h-4 w-4 shrink-0", c.kind === "BLOCK" ? "text-stop" : "text-wait")} /><span className="font-bold">{c.message}</span></li>)}</ul>
        {passed.length > 0 && <details className="mt-4 text-sm"><summary className="cursor-pointer font-bold text-muted-foreground">{passed.length} comprobaciones más pasan</summary><ul className="mt-3 grid gap-3">{passed.map((c) => <li key={c.id} className="flex gap-2.5"><Check className="mt-0.5 h-4 w-4 shrink-0 text-ok" /><span className="text-muted-foreground">{c.okMessage}</span></li>)}</ul></details>}
      </section>
      <section className="border-b p-5 sm:p-6">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3"><h3 className="min-w-0 font-bold">El documento</h3><span className="text-xs text-muted-foreground">{inv.channel}</span></div>
        <ArrivedDocument doc={inv} draft={inv} className="mt-4" />
      </section>
      <details className="border-b p-5 text-sm sm:p-6"><summary className="cursor-pointer font-bold">Lo acordado con {inv.vendorName}</summary><ul className="mt-4 grid gap-4">{timeline.map((a) => <li key={a.id}><p className="font-bold"><Amount value={a.amount} /> · {a.status === "PROPOSED" ? "Todavía no cuenta" : a.status === "USED" ? "Ya usado" : "Vigente"}</p><p className="mt-1 text-muted-foreground">{a.period ? `Solo ${monthName(a.period)}` : `Desde ${monthName(a.effectiveFrom)}`}{a.quote ? ` · “${a.quote}”` : ""}</p></li>)}</ul>{!timeline.length && <p className="mt-3 text-muted-foreground">No hay nada acordado.</p>}</details>
      <details className="p-5 text-sm sm:p-6"><summary className="cursor-pointer font-bold">Registro · {v.history.length}</summary><ol className="mt-4 grid gap-3">{v.history.map((h) => <li key={h.id}><p className="text-xs text-muted-foreground">{new Date(h.createdAt).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })} · {h.rulesVersion}</p><p className="mt-1">{h.note ?? "Revisada por Bullao."}</p></li>)}</ol></details>
      <AlertDialog open={confirm} onOpenChange={setConfirm}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Dar el visto bueno solo esta vez</AlertDialogTitle><AlertDialogDescription>{approveText}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => act.mutate({ kind: "approve_invoice", payload: { invoiceId: inv.id, contentHash: d.contentHash } }, { onSuccess: () => toast("Visto bueno registrado. Revisé de nuevo antes de apartar."), onError: () => toast.error("No pude registrar el visto bueno. Nada cambió.") })}>Dar el visto bueno</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </article>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Check, X, Mail } from "lucide-react";
import { toast } from "sonner";
import { useApAction, useApState } from "@/hooks/use-ap";
import { monthName, OUTCOME_LABEL } from "@/ap/engine";
import { formatMoney } from "@/ap/money";
import type { Agreement, InvoiceDraft } from "@/ap/types";
import { Amount, StatusChip } from "@/components/bullao/brand";
import { Empty, ErrorState, Loading } from "@/components/bullao/states";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/cuentas_/$id")({
  head: () => ({
    meta: [
      { title: "Ficha de la cuenta · Bullao" },
      { name: "description", content: "Estado, lo acordado, comprobaciones y la evidencia de una cuenta." },
      { property: "og:title", content: "Ficha de la cuenta · Bullao" },
      { property: "og:description", content: "Cada pago, explicado." },
    ],
  }),
  component: Ficha,
});

const TONE = { READY: "border-ok bg-ok-soft", REVIEW: "border-wait bg-wait-soft", BLOCKED: "border-stop bg-stop-soft" } as const;

function Ficha() {
  const { id } = Route.useParams();
  const { state, isLoading, isError, refetch } = useApState();
  const act = useApAction();
  const [confirm, setConfirm] = useState(false);

  if (isLoading) return <Loading />;
  if (isError || !state) return <ErrorState onRetry={() => refetch()} />;
  const v = state.invoices.find((x) => x.invoice.id === id);
  if (!v) return <Empty>Esta cuenta no ha llegado todavía. <Link to="/cuentas" className="text-primary underline">Volver a cuentas</Link></Empty>;

  const { invoice: inv, current: d, evaluation: ev } = v;
  const mes = monthName(inv.period);
  const timeline = state.agreements.filter((a) => a.vendorId === inv.vendorRef);
  const blocked = d.checks.some((c) => !c.ok && c.kind === "BLOCK");
  const canApprove = d.outcome === "REVIEW" && !blocked;
  const nov = state.invoices.find((x) => x.invoice.id === "inv-11-nov");

  const sentence = (() => {
    if (!ev.allowed) return `No hay nada acordado con ${inv.vendorName} para ${mes}.`;
    if (ev.overBy) return `Lo acordado para ${mes} es ${formatMoney(ev.allowed)}. Cobra ${formatMoney(ev.overBy)} más.`;
    return `Lo acordado para ${mes} es ${formatMoney(ev.allowed)}. Cobra lo acordado.`;
  })();

  const approveText = ev.overBy
    ? `Vas a autorizar ${formatMoney(ev.overBy)} adicionales solo para la cuenta de ${mes}. ${ev.agreed.base ? `El acuerdo mensual sigue siendo ${formatMoney(ev.agreed.base.amount)}. ` : ""}Antes de apartar el monto vuelvo a revisar el presupuesto.`
    : `Vas a dar el visto bueno a ${inv.vendorName} por ${d.amount ? formatMoney(d.amount) : "este monto"}, solo para esta cuenta. Antes de apartar el monto vuelvo a revisar el presupuesto.`;

  function approve() {
    act.mutate({ kind: "approve_invoice", payload: { invoiceId: inv.id, contentHash: d.contentHash } }, {
      onSuccess: () => toast("Visto bueno registrado. Revisé de nuevo antes de apartar."),
      onError: () => toast.error("No pude registrar el visto bueno. Nada cambió."),
    });
  }

  return (
    <div className="rise grid gap-6">
      <Link to="/cuentas" className="inline-flex w-fit items-center gap-1 text-sm font-bold text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Cuentas</Link>

      <section className={cn("rounded-xl border-l-4 p-6", TONE[d.outcome])}>
        <StatusChip outcome={d.outcome} size="lg" />
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-lg font-bold">{inv.vendorName}</p>
            <Amount value={d.amount} className="block text-4xl font-semibold md:text-5xl" />
            <p className="mt-1 text-sm text-muted-foreground">{inv.concept} · {inv.invoiceNumber ?? "sin número"} · llegó por {inv.channel}</p>
          </div>
          {canApprove && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setConfirm(true)} disabled={act.isPending}>Dar el visto bueno solo esta vez</Button>
              <Button variant="outline" disabled={act.isPending || v.held}
                onClick={() => act.mutate({ kind: "hold_invoice", payload: { invoiceId: inv.id } }, { onSuccess: () => toast("La dejé pendiente.") })}>
                {v.held ? "Pendiente" : "Dejar pendiente"}
              </Button>
            </div>
          )}
        </div>
        <p className="mt-4 text-base">{sentence}</p>
        {d.note && <p className="mt-2 text-sm text-muted-foreground">{d.note}</p>}
      </section>

      {inv.id === "inv-11" && d.outcome === "READY" && !nov && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed bg-card p-4">
          <p className="text-sm">Para la demo: trae la cuenta de noviembre de Hosting Andes.</p>
          <Button variant="secondary" onClick={() => act.mutate({ kind: "receive_invoice", payload: { invoiceId: "inv-11-nov" } })}><Mail /> Llegó la cuenta de noviembre</Button>
        </div>
      )}
      {nov && inv.id === "inv-11" && (
        <Link to="/cuentas/$id" params={{ id: nov.invoice.id }} className="rounded-xl border bg-card p-4 text-sm hover:bg-muted">
          Cuenta de noviembre: <b>{OUTCOME_LABEL[nov.current.outcome]}</b> →
        </Link>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-lg font-extrabold">Lo acordado con {inv.vendorName}</h2>
          {timeline.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No hay nada acordado.</p> : (
            <ol className="mt-4 grid gap-0">
              {timeline.map((a) => <TimelineItem key={a.id} a={a} period={inv.period} />)}
            </ol>
          )}
          {ev.allowed && <p className="mt-4 border-t pt-3 text-sm">Permitido para {mes}: <Amount value={ev.allowed} className="font-semibold" /></p>}
        </section>

        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-lg font-extrabold">Comprobaciones</h2>
          <ul className="mt-4 grid gap-2.5">
            {d.checks.map((c) => (
              <li key={c.id} className="flex gap-2.5 text-sm">
                {c.ok ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-ok" strokeWidth={3} />
                  : <X className={cn("mt-0.5 h-4 w-4 shrink-0", c.kind === "BLOCK" ? "text-stop" : "text-wait")} strokeWidth={3} />}
                <span className={c.ok ? "text-muted-foreground" : "font-bold"}>{c.ok ? c.okMessage : c.message}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rounded-xl border bg-card p-5">
        <h2 className="text-lg font-extrabold">El documento</h2>
        <p className="mt-1 text-xs text-muted-foreground">En amarillo, la frase exacta de donde salió cada dato.</p>
        <Doc inv={inv} />
      </section>

      <section className="rounded-xl border bg-card p-5">
        <h2 className="text-lg font-extrabold">Registro</h2>
        <ol className="mt-3 grid gap-2 text-sm">
          {v.history.map((h) => (
            <li key={h.id} className="flex flex-wrap items-center gap-2">
              <span className="amount text-xs text-muted-foreground">{new Date(h.createdAt).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}</span>
              <StatusChip outcome={h.outcome} />
              <span className="text-muted-foreground">{h.by === "persona" ? h.note : h.note ?? "Revisada por Bullao."} · {h.rulesVersion}</span>
            </li>
          ))}
        </ol>
      </section>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dar el visto bueno solo esta vez</AlertDialogTitle>
            <AlertDialogDescription className="text-base text-foreground">{approveText}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={approve}>Dar el visto bueno</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TimelineItem({ a, period }: { a: Agreement; period: string }) {
  const label =
    a.status === "PROPOSED" ? "Existe, todavía no cuenta"
    : a.status === "USED" ? "Ya usado"
    : a.effectiveTo && a.effectiveTo < period ? `Reemplazado desde ${monthName(nextOf(a.effectiveTo))}`
    : a.effectiveFrom > period ? `Vigente desde ${monthName(a.effectiveFrom)}`
    : "Vigente";
  const tone = a.status === "PROPOSED" ? "bg-muted text-muted-foreground" : a.status === "USED" ? "bg-muted text-muted-foreground line-through decoration-1" : "bg-ledger-soft text-primary";
  const kind = { BASE: "Tarifa mensual", MODIFICATION: "Cambio de tarifa", ONE_TIME: "Solo esta vez", PROJECT: "Por proyecto" }[a.kind];
  return (
    <li className="relative border-l-2 pb-4 pl-4 last:pb-0">
      <span className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-primary" />
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold">{kind}</span>
        <Amount value={a.amount} className="text-sm" />
        <span className={cn("rounded px-1.5 py-0.5 text-xs font-bold", tone)}>{label}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        {a.period ? `Solo ${monthName(a.period)}` : `Desde ${monthName(a.effectiveFrom)} ${a.effectiveFrom.slice(0, 4)}`}
        {a.approvedBy ? ` · aprobó ${a.approvedBy}` : ""}{a.quote ? ` · “${a.quote}”` : ""}
      </p>
    </li>
  );
}

const nextOf = (p: string) => { const y = +p.slice(0, 4), m = +p.slice(5, 7); return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`; };

function Doc({ inv }: { inv: InvoiceDraft }) {
  const ranges: [number, number][] = [];
  for (const q of inv.quotes) {
    const i = inv.text.indexOf(q.text);
    if (i >= 0 && !ranges.some(([s, e]) => i < e && i + q.text.length > s)) ranges.push([i, i + q.text.length]);
  }
  ranges.sort((x, y) => x[0] - y[0]);
  const parts: React.ReactNode[] = [];
  let cur = 0;
  ranges.forEach(([s, e], k) => {
    parts.push(inv.text.slice(cur, s));
    parts.push(<mark key={k} className="mark-quote">{inv.text.slice(s, e)}</mark>);
    cur = e;
  });
  parts.push(inv.text.slice(cur));
  return <pre className="amount mt-4 whitespace-pre-wrap rounded-lg border bg-background p-5 text-sm leading-7 paper-ruled">{parts}</pre>;
}

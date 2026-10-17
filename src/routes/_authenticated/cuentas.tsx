import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { useApState } from "@/hooks/use-ap";
import { firstReason, summaryLine } from "@/ap/engine";
import type { Outcome } from "@/ap/types";
import { Amount, StatusChip } from "@/components/bullao/brand";
import { Empty, ErrorState, Loading } from "@/components/bullao/states";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/cuentas")({
  head: () => ({
    meta: [
      { title: "Cuentas · Bullao" },
      { name: "description", content: "Las cuentas del mes: listas para pagar, las que necesitan tu visto bueno y las que no se pueden aprobar." },
      { property: "og:title", content: "Cuentas · Bullao" },
      { property: "og:description", content: "Las cuentas del mes revisadas por Bullao." },
    ],
  }),
  component: Cuentas,
});

const FILTERS: { id: Outcome | "ALL"; label: string }[] = [
  { id: "ALL", label: "Todas" },
  { id: "REVIEW", label: "Te esperan" },
  { id: "READY", label: "Listas" },
  { id: "BLOCKED", label: "No se pueden aprobar" },
];

function Cuentas() {
  const { state, isLoading, isError, refetch } = useApState();
  const [f, setF] = useState<Outcome | "ALL">("ALL");
  if (isLoading) return <Loading />;
  if (isError || !state) return <ErrorState onRetry={() => refetch()} />;

  const rows = state.invoices.filter((v) => f === "ALL" || v.current.outcome === f);
  const order: Record<Outcome, number> = { REVIEW: 0, BLOCKED: 1, READY: 2 };
  rows.sort((a, b) => order[a.current.outcome] - order[b.current.outcome]);

  return (
    <div className="rise">
      <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Nodo Labs Inc. · octubre 2026</p>
      <h1 className="mt-2 max-w-3xl text-3xl font-extrabold leading-tight md:text-4xl">{summaryLine(state)}</h1>
      <div className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((x) => (
          <button key={x.id} onClick={() => setF(x.id)}
            className={cn("rounded-full border px-3 py-1 text-sm font-bold", f === x.id ? "border-primary bg-ledger-soft text-primary" : "text-muted-foreground hover:text-foreground")}>
            {x.label}
          </button>
        ))}
      </div>
      <ul className="mt-6 divide-y overflow-hidden rounded-xl border bg-card">
        {rows.length === 0 && <li><Empty>No hay cuentas en este grupo.</Empty></li>}
        {rows.map((v) => (
          <li key={v.invoice.id}>
            <Link to="/cuentas/$id" params={{ id: v.invoice.id }}
              className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-4 hover:bg-muted md:grid-cols-[1.3fr_10rem_13rem_2fr_auto] md:px-5">
              <div>
                <p className="font-bold">{v.invoice.vendorName}</p>
                <p className="text-xs text-muted-foreground">{v.invoice.invoiceNumber ?? "Sin número"} · {v.invoice.channel}{v.held ? " · pendiente" : ""}</p>
              </div>
              <Amount value={v.current.amount} className="text-right font-semibold md:text-left" />
              <div className="col-span-2 md:col-span-1"><StatusChip outcome={v.current.outcome} /></div>
              <p className="col-span-2 text-sm text-muted-foreground md:col-span-1">{firstReason(v)}</p>
              <ChevronRight className="hidden h-4 w-4 text-muted-foreground md:block" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

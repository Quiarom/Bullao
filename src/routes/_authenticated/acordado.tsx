import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useApAction, useApState } from "@/hooks/use-ap";
import { findAgreed, monthName } from "@/ap/engine";
import { Amount } from "@/components/bullao/brand";
import { ErrorState, Loading } from "@/components/bullao/states";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/acordado")({
  head: () => ({
    meta: [
      { title: "Lo acordado · Bullao" },
      { name: "description", content: "Tarifas vigentes, adicionales autorizados y propuestas pendientes por proveedor." },
      { property: "og:title", content: "Lo acordado · Bullao" },
      { property: "og:description", content: "Lo que acordaste con cada proveedor, y desde cuándo." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Acordado,
});

const KIND = { BASE: "Tarifa mensual", MODIFICATION: "Cambio de tarifa", ONE_TIME: "Solo esta vez", PROJECT: "Por proyecto" } as const;

function Acordado() {
  const { state, isLoading, isError, refetch } = useApState();
  const act = useApAction();
  if (isLoading) return <Loading />;
  if (isError || !state) return <ErrorState onRetry={() => refetch()} />;

  return (
    <div className="rise">
      <h1 className="text-3xl font-extrabold md:text-4xl">Lo acordado</h1>
      <p className="mt-2 text-muted-foreground">Cambiar lo acordado crea una versión nueva. Las decisiones pasadas conservan la versión con la que se tomaron.</p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {state.vendors.map((v) => {
          const now = findAgreed(state.agreements, v.id, "2026-10");
          const list = state.agreements.filter((a) => a.vendorId === v.id);
          return (
            <article key={v.id} className="rounded-xl border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-extrabold">{v.name}</h2>
                  <p className="text-xs text-muted-foreground">{v.country} · {v.sends}{v.bankLast4 ? ` · banco ****${v.bankLast4}` : ""}</p>
                </div>
                {now.base && <Amount value={now.base.amount} className="text-lg font-semibold" />}
              </div>
              <ul className="mt-4 grid gap-2 text-sm">
                {list.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 border-t pt-2">
                    <span>
                      <b>{KIND[a.kind]}</b> <Amount value={a.amount} /> ·{" "}
                      <span className="text-muted-foreground">
                        {a.period ? `solo ${monthName(a.period)}` : `desde ${monthName(a.effectiveFrom)}`}
                        {a.effectiveTo && !a.period ? ` hasta ${monthName(a.effectiveTo)}` : ""}
                        {a.status === "USED" ? " · ya usado" : a.status === "PROPOSED" ? " · existe, todavía no cuenta" : ""}
                      </span>
                    </span>
                    {a.status === "PROPOSED" && (
                      <Button size="sm" disabled={act.isPending}
                        onClick={() => act.mutate({ kind: "approve_agreement", payload: { agreementId: a.id } }, { onSuccess: () => toast(`Aprobé el cambio con ${v.name}. Revisé de nuevo sus cuentas pendientes.`) })}>
                        Aprobar
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
    </div>
  );
}

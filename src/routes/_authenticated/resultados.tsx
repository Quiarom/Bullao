import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Check, X } from "lucide-react";
import { DATASET, useApState } from "@/hooks/use-ap";
import { holdoutReport, reportFor, type Report } from "@/ap/evaluate";
import { StatusChip } from "@/components/bullao/brand";
import { Empty, ErrorState, Loading } from "@/components/bullao/states";

export const Route = createFileRoute("/_authenticated/resultados")({
  head: () => ({
    meta: [
      { title: "Resultados · Bullao" },
      { name: "description", content: "Cómo le fue a Bullao este mes: decisiones correctas, pagos fuera de las reglas y casos reservados." },
      { property: "og:title", content: "Resultados · Bullao" },
      { property: "og:description", content: "La prueba honesta de Bullao, calculada en vivo." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Resultados,
});

function Resultados() {
  const { state, isLoading, isError, refetch } = useApState();
  const hold = useMemo(() => holdoutReport(DATASET), []);
  if (isLoading) return <Loading />;
  if (isError || !state) return <ErrorState onRetry={() => refetch()} />;
  const live = reportFor(state, DATASET.expected.inbox);

  return (
    <div className="rise grid gap-6">
      <div>
        <h1 className="text-3xl font-extrabold md:text-4xl">Cómo le fue a Bullao este mes</h1>
        <p className="mt-2 text-muted-foreground">Se compara la primera decisión de Bullao, antes de cualquier persona, contra el resultado esperado de cada caso. Los esperados se escribieron antes de programar y no se ajustan.</p>
      </div>
      {live.total === 0 ? (
        <Empty>Todavía no reviso nada. Ve a la <Link to="/cuentas" className="font-bold text-primary underline">lista de cuentas</Link> y pulsa Revisar.</Empty>
      ) : <Block title="Casos del mes" r={live} />}
      <Block title="Casos que Bullao no había visto" note="Cuatro documentos con una plantilla distinta: uno de duplicado, uno de lo acordado, uno de presupuesto y uno de cambio de banco. Se revisan después de toda la bandeja." r={hold} />
    </div>
  );
}

function Block({ title, note, r }: { title: string; note?: string; r: Report }) {
  const stats = [
    ["Decisiones correctas", `${r.correct} de ${r.total}`],
    ["Pagos aprobados fuera de las reglas", String(r.wrongApprovals)],
    ["Decididas sin pedir ayuda", `${r.decidedAlone} de ${r.total}`],
    ["Te consultó", `${r.askedYou} de ${r.total}`],
  ];
  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="text-xl font-extrabold">{title}</h2>
      {note && <p className="mt-1 text-sm text-muted-foreground">{note}</p>}
      <dl className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map(([k, v]) => (
          <div key={k} className="border-t pt-3">
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className="amount text-2xl font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      <ul className="mt-5 divide-y border-t">
        {r.cases.filter((c) => c.got).map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
            {c.ok ? <Check className="h-4 w-4 text-ok" strokeWidth={3} /> : <X className="h-4 w-4 text-stop" strokeWidth={3} />}
            <span className="w-44 font-bold">{c.vendor}</span>
            <span className="text-xs text-muted-foreground">Esperado</span><StatusChip outcome={c.expected} />
            {!c.ok && c.got && <><span className="text-xs text-muted-foreground">Obtuvo</span><StatusChip outcome={c.got} /></>}
          </li>
        ))}
      </ul>
    </section>
  );
}

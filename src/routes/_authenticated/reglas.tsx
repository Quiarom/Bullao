import { createFileRoute } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { useApState } from "@/hooks/use-ap";
import { CURRENCIES } from "@/ap/money";
import { Amount } from "@/components/bullao/brand";
import { ErrorState, Loading } from "@/components/bullao/states";

export const Route = createFileRoute("/_authenticated/reglas")({
  head: () => ({
    meta: [
      { title: "Reglas · Bullao" },
      { name: "description", content: "Lo que Bullao puede dejar listo solo, el presupuesto por moneda y lo que nunca se salta." },
      { property: "og:title", content: "Reglas · Bullao" },
      { property: "og:description", content: "Las reglas con las que Bullao revisa cada cuenta." },
    ],
  }),
  component: Reglas,
});

const NEVER = [
  ["La IA lee, el código decide.", "Ningún modelo decide si se paga. El modelo propone datos con su cita; el código comprueba."],
  ["Una cuenta repetida nunca se paga.", "Mismo número o mismo CUFE/UUID: no se puede aprobar."],
  ["Nunca se convierte moneda.", "Cada moneda tiene su propio presupuesto."],
  ["Sin presupuesto no hay pago.", "Ni con visto bueno: antes de apartar se revisa otra vez."],
  ["El documento es dato, no instrucción.", "Una factura que pide aprobarse se revisa como cualquier otra."],
  ["El visto bueno lo da una persona en esta pantalla.", "No existe aprobación por agentes ni por MCP."],
];

function Reglas() {
  const { state, isLoading, isError, refetch } = useApState();
  if (isLoading) return <Loading />;
  if (isError || !state) return <ErrorState onRetry={() => refetch()} />;
  const r = state.rules;
  const used = (c: (typeof CURRENCIES)[number]) => state.reservations.filter((x) => x.amount.currency === c && x.period === "2026-10").reduce((s, x) => s + x.amount.minor, 0);

  return (
    <div className="rise grid gap-6">
      <div>
        <h1 className="text-3xl font-extrabold md:text-4xl">Reglas</h1>
        <p className="mt-2 text-muted-foreground">Versión {r.version}. Cambiar una regla crea una versión nueva.</p>
      </div>
      <section className="grid gap-4 md:grid-cols-3">
        {CURRENCIES.filter((c) => r.budget[c] > 0).map((c) => {
          const pct = Math.min(100, Math.round((used(c) / r.budget[c]) * 100));
          return (
            <div key={c} className="rounded-xl border bg-card p-5">
              <p className="text-sm font-bold text-muted-foreground">Presupuesto de octubre en {c}</p>
              <Amount value={{ minor: r.budget[c], currency: c }} className="mt-1 block text-2xl font-semibold" />
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div>
              <p className="mt-2 text-xs text-muted-foreground">Apartado: <Amount value={{ minor: used(c), currency: c }} /></p>
              <p className="mt-3 text-sm">Bullao deja listo solo hasta <Amount value={{ minor: r.autoLimit[c], currency: c }} className="font-semibold" /> por pago.</p>
            </div>
          );
        })}
      </section>
      <section className="rounded-xl border bg-card p-5">
        <h2 className="text-lg font-extrabold">Siempre te consulto</h2>
        <ul className="mt-3 grid gap-1.5 text-sm">
          <li>Proveedor que no está en tu lista.</li>
          <li>Cambio de cuenta bancaria.</li>
          <li>Un dato que no encuentro en el documento.</li>
          <li>Cobros sobre lo acordado: tolerancia {r.tolerancePct.contractor}% contratistas, {r.tolerancePct.software}% software.</li>
        </ul>
      </section>
      <section className="rounded-xl border bg-muted p-5">
        <h2 className="flex items-center gap-2 text-lg font-extrabold text-muted-foreground"><Lock className="h-4 w-4" /> Lo que nunca se salta</h2>
        <ul className="mt-3 grid gap-3">
          {NEVER.map(([t, d]) => (
            <li key={t} className="text-sm text-muted-foreground"><b>{t}</b> {d}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

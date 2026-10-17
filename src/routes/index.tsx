import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DemoBadge, Logo, StatusChip } from "@/components/bullao/brand";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bullao · Menos bulla, cuentas claras" },
      { name: "description", content: "Bullao revisa las cuentas que te llegan por correo, PDF o WhatsApp y te trae solo lo que necesita tu visto bueno." },
      { property: "og:title", content: "Bullao · Menos bulla, cuentas claras" },
      { property: "og:description", content: "Cuando autorizas algo solo esta vez, Bullao sabe que fue solo esta vez." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const NOISE = [
  { t: "Cuenta de cobro No. CP-0098 · $4.800.000", r: "-rotate-3", o: "READY" as const },
  { t: "WhatsApp: te reenvío la cuenta por si no te llegó", r: "rotate-2", o: "BLOCKED" as const },
  { t: "Invoice HA-1010 · USD 1,000.00 · servicio mensual", r: "-rotate-1", o: "REVIEW" as const },
  { t: "“dale, por esta vez, solo mayo”", r: "rotate-3", o: null },
];

function Landing() {
  return (
    <div className="min-h-screen paper-ruled">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Logo />
        <Button asChild variant="ghost"><Link to="/auth">Entrar</Link></Button>
      </header>
      <main className="mx-auto grid max-w-6xl gap-14 px-6 pb-24 pt-10 md:grid-cols-[1.15fr_1fr] md:pt-20">
        <section className="rise">
          <DemoBadge />
          <h1 className="mt-6 text-5xl font-extrabold leading-[1.02] md:text-7xl">
            Menos bulla,<br />cuentas claras<span className="text-primary">.</span>
          </h1>
          <p className="mt-6 max-w-lg text-lg text-muted-foreground">
            Bullao revisa las cuentas que te llegan por correo, PDF o WhatsApp, las compara con lo acordado con cada
            proveedor, deja listo lo que cumple y te trae solo lo que necesita tu visto bueno.
          </p>
          <p className="mt-4 max-w-lg text-lg font-bold">Cuando autorizas algo “solo esta vez”, sabe que fue solo esta vez.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg"><Link to="/auth">Revisar el mes de Nodo Labs <ArrowRight /></Link></Button>
          </div>
        </section>
        <section className="relative flex flex-col gap-4" aria-hidden>
          {NOISE.map((n, i) => (
            <div key={i} style={{ animationDelay: `${120 + i * 110}ms` }}
              className={`rise ${n.r} rounded-lg border bg-card p-4 shadow-sm`}>
              <p className="amount text-sm text-muted-foreground">{n.t}</p>
              {n.o && <div className="mt-3"><StatusChip outcome={n.o} /></div>}
            </div>
          ))}
        </section>
      </main>
      <footer className="mx-auto max-w-6xl px-6 pb-10 text-sm text-muted-foreground">
        Reto Blinka · 30X Hackathon. Bullao no es un banco y no mueve dinero real.
      </footer>
    </div>
  );
}

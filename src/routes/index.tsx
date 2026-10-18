import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { startDemo } from "@/lib/demo-session";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DemoBadge, Logo, StatusChip } from "@/components/bullao/brand";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bullao · Menos bulla, cuentas claras" },
      { name: "description", content: "Envía una factura al asistente compatible; Bullao contrasta acuerdos y deja la decisión financiera al motor determinista." },
      { property: "og:title", content: "Bullao · Menos bulla, cuentas claras" },
      { property: "og:description", content: "Cuando autorizas algo solo esta vez, Bullao sabe que fue solo esta vez." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingView,
});

const NOISE = [
  { t: "Factura INV-1042 · $860.000 · servicio mensual", r: "-rotate-1", o: "READY" as const },
  { t: "Factura INV-1042 · mismo número y valor", r: "rotate-2", o: "BLOCKED" as const },
  { t: "“solo esta vez, por favor”", r: "rotate-3", o: "REVIEW" as const },
];

export function LandingView() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  async function demo() {
    setBusy(true);
    const r = await startDemo();
    setBusy(false);
    if (!r.ok) toast.error(r.message);
    else navigate({ to: "/cuentas" });
  }
  return (
    <div className="min-h-screen paper-ruled">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Logo />
        <Button asChild variant="ghost"><Link to="/auth" search={{}}>Entrar con tu cuenta</Link></Button>
      </header>
      <main className="mx-auto grid max-w-6xl gap-14 px-6 pb-24 pt-10 md:grid-cols-[1.15fr_1fr] md:pt-20">
        <section className="rise">
          <DemoBadge />
          <h1 className="mt-6 text-5xl font-extrabold leading-[1.02] md:text-7xl">
            Menos bulla,<br />cuentas claras<span className="text-primary">.</span>
          </h1>
          <p className="mt-6 max-w-lg text-lg text-muted-foreground">
            Envía el documento al asistente compatible que ya usas. Bullao contrasta la factura con acuerdos y política autorizada: lo normal queda listo para simulación; duplicados se frenan y las excepciones vuelven a una persona.
          </p>
          <p className="mt-4 max-w-lg text-lg font-bold">Menos bulla, cuentas claras: “solo esta vez” no cambia la regla para siempre.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" onClick={demo} disabled={busy}>Ver demo <ArrowRight /></Button>
            <Button asChild size="lg" variant="outline"><a href="#conectar">Cómo conectar asistente</a></Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Demo local con datos ficticios precargados; muestra el flujo, no una integración conectada.</p>
        </section>
        <section className="relative flex flex-col gap-4" aria-hidden>
          {NOISE.map((n, i) => (
            <div key={i} style={{ animationDelay: `${120 + i * 110}ms` }}
              className={`rise ${n.r} rounded-lg border bg-card p-4`}>
              <p className="amount text-sm text-muted-foreground">{n.t}</p>
              {n.o && <div className="mt-3"><StatusChip outcome={n.o} /></div>}
            </div>
          ))}
        </section>
      </main>
      <section id="conectar" className="mx-auto max-w-6xl scroll-mt-8 px-6 pb-16">
        <h2 className="text-3xl font-bold">Conecta tu asistente</h2>
        <p className="mt-3 max-w-3xl text-muted-foreground">Configura el cliente MCP remoto con la URL <code>{typeof window === "undefined" ? "https://tu-dominio/mcp" : `${window.location.origin}/mcp`}</code> e inicia sesión en Bullao con tu propia cuenta mediante OAuth. El acceso requiere una cuenta autenticada; el cliente y el login se configuran en tu runtime.</p>
        <p className="mt-3 max-w-3xl text-muted-foreground">Compatibilidad documentada no significa integración probada: no prometemos Hermes ya configurado ni conectores de correo/WhatsApp. La demo local usa política ficticia precargada. No es dinero real, no ofrece OCR universal y no activa una política nueva.</p>
        <ol className="mt-8 grid gap-5 md:grid-cols-3">
          <li><strong>1. Enviar</strong><p className="mt-1 text-sm text-muted-foreground">Adjunta una factura al asistente; la lectura depende del runtime y del documento.</p></li>
          <li><strong>2. Contrastar</strong><p className="mt-1 text-sm text-muted-foreground">Bullao compara evidencia con acuerdos y límites autorizados; el motor registra el resultado.</p></li>
          <li><strong>3. Resolver</strong><p className="mt-1 text-sm text-muted-foreground">Simulación lista, frenada por duplicado o consulta a una persona ante excepción.</p></li>
        </ol>
      </section>
      <footer className="mx-auto max-w-6xl px-6 pb-10 text-sm text-muted-foreground">
        Reto Blinka · 30X Hackathon. Bullao no es un banco y no mueve dinero real.
      </footer>
    </div>
  );
}

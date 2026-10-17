import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { DemoBadge, Logo } from "@/components/bullao/brand";
import { useResetDemo } from "@/hooks/use-ap";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth", search: { next: location.href } });
    return { email: data.session.user.email ?? "Invitado", guest: !!data.session.user.is_anonymous };
  },
  component: Layout,
});

const NAV = [
  { to: "/bandeja", label: "Bandeja" },
  { to: "/cuentas", label: "Cuentas" },
  { to: "/acordado", label: "Lo acordado" },
  { to: "/reglas", label: "Reglas" },
  { to: "/resultados", label: "Resultados" },
] as const;

function Layout() {
  const { email, guest } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const reset = useResetDemo();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: {}, replace: true });
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 md:px-6">
          <Link to="/cuentas"><Logo /></Link>
          <nav className="order-3 flex w-full gap-1 md:order-none md:w-auto">
            {NAV.map((n) => (
              <Link key={n.to} to={n.to}
                className="rounded-md px-3 py-1.5 text-sm font-bold text-muted-foreground hover:text-foreground"
                activeProps={{ className: "bg-ledger-soft text-primary" }}>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden lg:inline"><DemoBadge /></span>
            <Button variant="ghost" size="sm" disabled={reset.isPending} title="Reiniciar el mes de la demo"
              onClick={() => reset.mutate(undefined, { onSuccess: () => toast("Listo: la bandeja tiene las 21 cuentas sin revisar.") })}>
              <RotateCcw /> <span className="hidden sm:inline">Reiniciar demo</span>
            </Button>
            {guest && <span className="hidden text-xs text-muted-foreground sm:inline">Invitado</span>}
            <Button variant="ghost" size="sm" onClick={signOut} title={guest ? "Salir de la demo" : email}><LogOut /></Button>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
        <div className="mb-4 lg:hidden"><DemoBadge /></div>
        <Outlet />
      </div>
    </div>
  );
}

import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/bullao/brand";

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    client_id: typeof s["client_id"] === "string" ? s["client_id"] : "",
    scope: typeof s["scope"] === "string" ? s["scope"] : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.client_id) throw new Error("Falta la solicitud de autorización.");
    const { data } = await authClient.getSession();
    if (!data || data.user.isAnonymous)
      throw redirect({ to: "/auth", search: { next: location.pathname + location.searchStr } });
    return { email: data.user.email };
  },
  head: () => ({
    meta: [
      { title: "Conectar un asistente · Bullao" },
      { name: "description", content: "Autoriza a un asistente a leer tus cuentas en Bullao." },
    ],
  }),
  component: Consent,
});

function Consent() {
  const { client_id, scope } = Route.useSearch();
  const { email } = Route.useRouteContext();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(accept: boolean) {
    setBusy(true);
    setError(null);
    const result = await fetch("/api/auth/oauth2/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ accept, oauth_query: window.location.search.slice(1) }),
    });
    const resultBody = (await result.json()) as {
      url?: string;
      redirect_uri?: string;
      message?: string;
    };
    if (!result.ok) {
      setBusy(false);
      setError(resultBody.message ?? "No pude guardar tu decisión.");
      return;
    }
    const target = resultBody.url ?? resultBody.redirect_uri;
    if (!target) {
      setBusy(false);
      setError("El servidor de autorización no devolvió a dónde volver.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main className="flex min-h-screen items-center justify-center paper-ruled p-6">
      <div className="rise w-full max-w-md rounded-xl border bg-card p-7">
        <Logo />
        <h1 className="mt-5 text-2xl font-extrabold">Conectar asistente a Bullao</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Entraste como <b className="text-foreground">{email}</b>.
        </p>
        <p className="mt-4">
          <span className="font-medium">Cliente:</span> {client_id || "Un asistente"}
        </p>
        <p className="mt-2">
          <span className="font-medium">Permisos:</span> {scope || "perfil básico"}
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          El asistente podrá leer tus cuentas, acuerdos y reglas. No puede aprobar pagos ni mover
          dinero.
        </p>
        {error && (
          <p role="alert" className="mt-4 rounded-md bg-stop-soft p-3 text-sm text-stop">
            {error}
          </p>
        )}
        <div className="mt-6 flex gap-2">
          <Button disabled={busy} onClick={() => decide(true)}>
            Permitir
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => decide(false)}>
            Cancelar conexión
          </Button>
        </div>
      </div>
    </main>
  );
}

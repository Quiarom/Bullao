import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/bullao/brand";

type OAuthResult = { data: { redirect_url?: string; redirect_to?: string; client?: { name?: string; uri?: string }; scope?: string; redirect_uri?: string } | null; error: { message: string } | null };
type OAuthApi = {
  getAuthorizationDetails(id: string): Promise<OAuthResult>;
  approveAuthorization(id: string): Promise<OAuthResult>;
  denyAuthorization(id: string): Promise<OAuthResult>;
};
const oauth = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Falta el identificador de la autorización.");
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth", search: { next: location.pathname + location.searchStr } });
    return { email: data.session.user.email ?? "" };
  },
  loader: async ({ location }) => {
    const id = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth().getAuthorizationDetails(id);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  head: () => ({ meta: [{ title: "Conectar un asistente · Bullao" }, { name: "description", content: "Autoriza a un asistente a leer tus cuentas en Bullao." }] }),
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md rounded-xl border bg-card p-6">
        <Logo />
        <p className="mt-4 font-bold">No pude cargar esta solicitud de conexión.</p>
        <p className="mt-1 text-sm text-muted-foreground">{error instanceof Error ? error.message : String(error)} Puede haber expirado: inicia la conexión de nuevo desde tu asistente.</p>
      </div>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { email } = Route.useRouteContext();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = details?.client?.name ?? "Un asistente";

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve ? await oauth().approveAuthorization(authorization_id) : await oauth().denyAuthorization(authorization_id);
    if (error) { setBusy(false); setError(error.message); return; }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) { setBusy(false); setError("El servidor de autorización no devolvió a dónde volver."); return; }
    window.location.href = target;
  }

  return (
    <main className="flex min-h-screen items-center justify-center paper-ruled p-6">
      <div className="rise w-full max-w-md rounded-xl border bg-card p-7">
        <Logo />
        <h1 className="mt-5 text-2xl font-extrabold">Conectar {name} a Bullao</h1>
        <p className="mt-2 text-sm text-muted-foreground">Entraste como <b className="text-foreground">{email}</b>.</p>
        <p className="mt-4">{name} podrá leer tus cuentas, lo acordado y las reglas, y revisar cuentas nuevas sin guardarlas.</p>
        <ul className="mt-3 grid gap-1 text-sm text-muted-foreground">
          <li>· Compartir tu perfil básico y tu correo</li>
          <li>· No puede dar el visto bueno ni mover dinero: eso solo se hace en esta pantalla</li>
          {details?.redirect_uri && <li>· Volverá a: <span className="amount">{details.redirect_uri}</span></li>}
        </ul>
        {error && <p role="alert" className="mt-4 rounded-md bg-stop-soft p-3 text-sm text-stop">{error}</p>}
        <div className="mt-6 flex gap-2">
          <Button disabled={busy} onClick={() => decide(true)}>Permitir</Button>
          <Button variant="outline" disabled={busy} onClick={() => decide(false)}>Cancelar conexión</Button>
        </div>
      </div>
    </main>
  );
}

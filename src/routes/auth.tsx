import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { oauthReturnPath } from "@/lib/oauth-return-path";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DemoBadge, Logo } from "@/components/bullao/brand";
import "@lovable.dev/cloud-auth-js/styles.css";
import { startDemo } from "@/lib/demo-session";

const NEXT_KEY = "bullao-next";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): { next?: string } => (typeof s["next"] === "string" ? { next: s["next"] } : {}),
  head: () => ({
    meta: [
      { title: "Entrar · Bullao" },
      { name: "description", content: "Entra a Bullao para revisar las cuentas del mes." },
      { property: "og:title", content: "Entrar · Bullao" },
      { property: "og:description", content: "Entra a Bullao para revisar las cuentas del mes." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { next: rawNext } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const next = oauthReturnPath(rawNext ?? (typeof window !== "undefined" ? sessionStorage.getItem(NEXT_KEY) : null) ?? "/cuentas");
  const target = next === "/" ? "/cuentas" : next;

  useEffect(() => {
    if (rawNext) sessionStorage.setItem(NEXT_KEY, oauthReturnPath(rawNext));
    // A guest session must not satisfy a real-login return (e.g. connecting an assistant).
    const usable = (s: { user: { is_anonymous?: boolean } } | null) => !!s && !(rawNext && s.user.is_anonymous);
    supabase.auth.getSession().then(({ data }) => {
      if (usable(data.session)) { sessionStorage.removeItem(NEXT_KEY); navigate({ href: target, replace: true }); }
    });
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      if (usable(session)) { sessionStorage.removeItem(NEXT_KEY); navigate({ href: target, replace: true }); }
    });
    return () => data.subscription.unsubscribe();
  }, [target, rawNext, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error("No pude entrar: revisa el correo y la contraseña.");
    } else {
      const { data, error } = await supabase.auth.signUp({
        email, password, options: { emailRedirectTo: new URL(target, window.location.origin).href },
      });
      if (error) toast.error(error.message);
      else if (!data.session) setSent(true);
    }
    setBusy(false);
  }

  async function social(provider: "google" | "lovable") {
    const r = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin + "/auth" });
    if (r.error) toast.error("No pude abrir el inicio de sesión.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center paper-ruled px-4">
      <div className="rise w-full max-w-sm rounded-xl border bg-card p-8 shadow-sm">
        <Logo className="text-3xl" />
        <p className="mt-1 text-sm text-muted-foreground">Menos bulla, cuentas claras.</p>
        {sent ? (
          <div className="mt-8 rounded-lg bg-ledger-soft p-4 text-sm">
            Te envié un correo a <b>{email}</b>. Abre el enlace para confirmar tu cuenta.
          </div>
        ) : (
          <>
            {!rawNext && (
              <>
                <Button className="mt-6 w-full" size="lg" disabled={busy} onClick={async () => {
                  setBusy(true); const r = await startDemo(); setBusy(false);
                  if (!r.ok) toast.error(r.message); else navigate({ to: "/cuentas", replace: true });
                }}>Ver la demo de Nodo Labs</Button>
                <p className="mt-2 text-center text-xs text-muted-foreground">Sin crear cuenta. Tu propio octubre de prueba.</p>
                <p className="mt-6 text-sm font-bold">Entrar con tu cuenta</p>
              </>
            )}
            {rawNext && <p className="mt-6 text-sm">Para conectar un asistente necesitas entrar con tu cuenta.</p>}
            <div className="mt-3 grid gap-2">
              <Button variant="outline" onClick={() => social("google")}>Continuar con Google</Button>
              <button type="button" className="lovable-auth-button" onClick={() => social("lovable")}>Continue with Lovable</button>
            </div>
            <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />o con tu correo<span className="h-px flex-1 bg-border" /></div>
            <form onSubmit={submit} className="grid gap-3">
              <div className="grid gap-1.5"><Label htmlFor="email">Correo</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div className="grid gap-1.5"><Label htmlFor="pw">Contraseña</Label><Input id="pw" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
              <Button type="submit" disabled={busy}>{mode === "in" ? "Entrar" : "Crear cuenta"}</Button>
            </form>
            <button className="mt-4 w-full text-center text-sm text-primary underline-offset-4 hover:underline" onClick={() => setMode(mode === "in" ? "up" : "in")}>
              {mode === "in" ? "¿No tienes cuenta? Créala" : "Ya tengo cuenta"}
            </button>
          </>
        )}
        <div className="mt-6 flex justify-center"><DemoBadge /></div>
      </div>
    </div>
  );
}

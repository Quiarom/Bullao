import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { oauthReturnPath } from "@/lib/oauth-return-path";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DemoBadge, Logo } from "@/components/bullao/brand";

const NEXT_KEY = "bullao-next";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): { next?: string } =>
    typeof s["next"] === "string" ? { next: s["next"] } : {},
  head: () => ({
    meta: [
      { title: "Entrar · Bullao" },
      { name: "description", content: "Entra a Bullao para revisar las cuentas del mes." },
      { property: "og:title", content: "Entrar · Bullao" },
      { property: "og:description", content: "Entra a Bullao para revisar las cuentas del mes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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

  const next = oauthReturnPath(
    rawNext ??
      (typeof window !== "undefined" ? sessionStorage.getItem(NEXT_KEY) : null) ??
      "/cuentas",
  );
  const target = next === "/" ? "/cuentas" : next;

  useEffect(() => {
    if (rawNext) sessionStorage.setItem(NEXT_KEY, oauthReturnPath(rawNext));
    // A guest session must not satisfy a real-login return (e.g. connecting an assistant).
    authClient.getSession().then(({ data }) => {
      if (data && !(rawNext && data.user.isAnonymous)) {
        sessionStorage.removeItem(NEXT_KEY);
        navigate({ href: target, replace: true });
      }
    });
  }, [target, rawNext, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    if (mode === "in") {
      const { error } = await authClient.signIn.email({ email, password });
      if (error) toast.error("No pude entrar: revisa el correo y la contraseña.");
      else {
        sessionStorage.removeItem(NEXT_KEY);
        navigate({ href: target, replace: true });
      }
    } else {
      const { data, error } = await authClient.signUp.email({
        email,
        password,
        name: email.split("@")[0] ?? "Bullao",
      });
      if (error) toast.error(error.message);
      else if (data) {
        sessionStorage.removeItem(NEXT_KEY);
        navigate({ href: target, replace: true });
      } else setSent(true);
    }
    setBusy(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center paper-ruled px-4">
      <div className="rise w-full max-w-sm rounded-xl border bg-card p-8">
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
                <Button
                  className="mt-6 w-full"
                  size="lg"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    const r = await authClient.signIn.anonymous();
                    setBusy(false);
                    if (r.error) toast.error("No pude abrir la demo. Intenta de nuevo.");
                    else navigate({ to: "/cuentas", replace: true });
                  }}
                >
                  Ver la demo de Nodo Labs
                </Button>
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  Sin crear cuenta. Tu propio octubre de prueba. Solo web, sin conexión MCP.
                </p>
                <p className="mt-6 text-sm font-bold">Entrar con tu cuenta</p>
              </>
            )}
            {rawNext && (
              <p className="mt-6 text-sm">
                Para conectar un asistente necesitas una cuenta con correo y contraseña, incluida una
                cuenta demo de prueba. La demo sin cuenta no permite conexiones MCP.
              </p>
            )}
            <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />o con tu correo
              <span className="h-px flex-1 bg-border" />
            </div>
            <form onSubmit={submit} className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="email">Correo</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="pw">Contraseña</Label>
                <Input
                  id="pw"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={busy}>
                {mode === "in" ? "Entrar" : "Crear cuenta"}
              </Button>
            </form>
            <button
              className="mt-4 w-full text-center text-sm text-primary underline-offset-4 hover:underline"
              onClick={() => setMode(mode === "in" ? "up" : "in")}
            >
              {mode === "in" ? "¿No tienes cuenta? Créala" : "Ya tengo cuenta"}
            </button>
          </>
        )}
        <div className="mt-6 flex justify-center">
          <DemoBadge />
        </div>
      </div>
    </div>
  );
}

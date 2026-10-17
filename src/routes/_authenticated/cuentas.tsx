import { createFileRoute } from "@tanstack/react-router";
import { AccountsWorkspace } from "@/components/bullao/accounts-workspace";
export const Route = createFileRoute("/_authenticated/cuentas")({
  validateSearch: (search: Record<string, unknown>): { cuenta?: string } => typeof search["cuenta"] === "string" ? { cuenta: search["cuenta"] } : {},
  head: () => ({ meta: [
    { title: "Cuentas · Bullao" },
    { name: "description", content: "Revisa las cuentas del mes, sus documentos y comprobaciones en una sola vista." },
    { property: "og:title", content: "Cuentas · Bullao" },
    { property: "og:description", content: "Cuentas, documentos y presupuesto restante, juntos." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Cuentas,
});
function Cuentas() { const { cuenta } = Route.useSearch(); return <AccountsWorkspace selectedId={cuenta} />; }

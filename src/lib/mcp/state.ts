import { ToolError, type ToolContext } from "@lovable.dev/mcp-js";
import { buildState, firstReason, OUTCOME_LABEL } from "@/ap/engine";
import { DATASET } from "@/demo/dataset";
import { formatMoney, type Money } from "@/ap/money";
import type { InvoiceView } from "@/ap/engine";
import { readEventsForUser } from "@/server/events.server";
import { sqlite } from "@/server/db.server";

export function requireMcpUser(ctx: ToolContext, store: typeof sqlite = sqlite): string {
  if (!ctx.isAuthenticated()) throw new ToolError("Necesitas iniciar sesión en Bullao.");
  const userId = ctx.getUserId();
  if (!userId) throw new ToolError("Token sin identificador de usuario.");
  const scopes = ctx.getScopes() ?? [];
  if (!scopes.includes("accounts:read"))
    throw new ToolError("Tu autorización no incluye lectura de cuentas.");
  const user = store.prepare('SELECT isAnonymous FROM "user" WHERE id = ?').get(userId) as
    { isAnonymous?: number | boolean | null } | undefined;
  if (!user) throw new ToolError("La cuenta autorizada ya no existe.");
  if (user.isAnonymous)
    throw new ToolError("Las sesiones de invitado no pueden usar el MCP. Entra con tu cuenta.");
  return userId;
}

/** Rebuilds caller's month from that account's append-only events. */
export async function stateFor(ctx: ToolContext) {
  const userId = requireMcpUser(ctx);
  return buildState(DATASET, readEventsForUser(userId));
}

export const moneyJson = (m: Money | null) =>
  m ? { minor: m.minor, currency: m.currency, text: formatMoney(m) } : null;

export const invoiceJson = (v: InvoiceView) => ({
  id: v.invoice.id,
  vendor: v.invoice.vendorName,
  invoiceNumber: v.invoice.invoiceNumber,
  period: v.invoice.period,
  channel: v.invoice.channel,
  amount: moneyJson(v.current.amount),
  status: OUTCOME_LABEL[v.current.outcome],
  reason: firstReason(v),
  pending: v.held,
});

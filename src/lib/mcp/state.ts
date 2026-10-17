import { ToolError, type ToolContext } from "@lovable.dev/mcp-js";
import { buildState, firstReason, OUTCOME_LABEL } from "@/ap/engine";
import { formatMoney, type Money } from "@/ap/money";
import type { ApEvent } from "@/ap/types";
import type { InvoiceView } from "@/ap/engine";
import { supabaseForUser } from "./supabase";

/** Rebuilds the caller's month from their own events (RLS scoped). */
export async function stateFor(ctx: ToolContext) {
  if (!ctx.isAuthenticated()) throw new ToolError("Necesitas iniciar sesión en Bullao.");
  const sb = supabaseForUser(ctx);
  const { data, error } = await sb.from("ap_events").select("id, kind, payload, actor, created_at").order("created_at").limit(1000);
  if (error) throw new ToolError("No pude leer tu registro de cuentas.");
  return buildState((data ?? []) as ApEvent[]);
}

export const moneyJson = (m: Money | null) => (m ? { minor: m.minor, currency: m.currency, text: formatMoney(m) } : null);

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

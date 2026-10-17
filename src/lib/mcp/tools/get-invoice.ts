import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { invoiceJson, moneyJson, stateFor } from "../state";

export default defineTool({
  name: "get_invoice",
  title: "Ver ficha de una cuenta",
  description: "Devuelve la ficha de una cuenta: comprobaciones, lo acordado para el mes y el registro de decisiones.",
  inputSchema: { id: z.string().min(1).describe("Id de la cuenta, p. ej. inv-11.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    const s = await stateFor(ctx);
    const v = s.invoices.find((x) => x.invoice.id === id);
    if (!v) throw new ToolError(`No encuentro la cuenta ${id}.`);
    const checks = v.current.checks.map((c) => ({ id: c.id, ok: c.ok, kind: c.kind, message: c.ok ? c.okMessage : c.message }));
    const history = v.history.map((h) => ({ outcome: h.outcome, by: h.by, note: h.note, at: h.createdAt }));
    const agreed = moneyJson(v.evaluation.allowed);
    return {
      content: [{ type: "text", text: [
        `${v.invoice.vendorName} · ${moneyJson(v.current.amount)?.text ?? "—"} · ${invoiceJson(v).status}`,
        `Lo acordado para ${v.invoice.period}: ${agreed?.text ?? "nada"}`,
        ...checks.map((c) => `${c.ok ? "✓" : "✗"} ${c.message}`),
        "El visto bueno solo se da desde la pantalla web de Bullao.",
      ].join("\n") }],
      structuredContent: { invoice: invoiceJson(v), agreed, checks, history },
    };
  },
});

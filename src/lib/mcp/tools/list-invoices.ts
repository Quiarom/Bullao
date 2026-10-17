import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { summaryLine } from "@/ap/engine";
import { invoiceJson, stateFor } from "../state";

export default defineTool({
  name: "list_invoices",
  title: "Listar cuentas",
  description: "Lista las cuentas del mes con su estado (lista para pagar, necesita visto bueno, no se puede aprobar) y el motivo.",
  inputSchema: {
    status: z.enum(["READY", "REVIEW", "BLOCKED"]).optional().describe("Filtra por estado."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status }, ctx) => {
    const s = await stateFor(ctx);
    const rows = s.invoices.filter((v) => !status || v.current.outcome === status).map(invoiceJson);
    const summary = summaryLine(s);
    return {
      content: [{ type: "text", text: [summary, ...rows.map((r) => `- ${r.vendor} · ${r.amount?.text ?? "—"} · ${r.status}: ${r.reason} [${r.id}]`)].join("\n") }],
      structuredContent: { summary, invoices: rows },
    };
  },
});

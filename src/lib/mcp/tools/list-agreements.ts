import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { moneyJson, stateFor } from "../state";

export default defineTool({
  name: "list_agreements",
  title: "Ver lo acordado",
  description: "Lista lo acordado con cada proveedor: tarifas, adicionales solo esta vez, propuestas sin aprobar.",
  inputSchema: { vendor: z.string().optional().describe("Id o nombre del proveedor (opcional).") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ vendor }, ctx) => {
    const s = await stateFor(ctx);
    const q = vendor?.toLowerCase();
    const vendors = s.vendors.filter((v) => !q || v.id === q || v.name.toLowerCase().includes(q));
    const out = vendors.map((v) => ({
      id: v.id, name: v.name, country: v.country,
      agreements: s.agreements.filter((a) => a.vendorId === v.id).map((a) => ({
        id: a.id, kind: a.kind, status: a.status, amount: moneyJson(a.amount),
        from: a.effectiveFrom, to: a.effectiveTo, period: a.period, approvedBy: a.approvedBy,
      })),
    }));
    return {
      content: [{ type: "text", text: out.map((v) => `${v.name}: ` + v.agreements.map((a) => `${a.kind} ${a.amount?.text} (${a.status}${a.period ? " " + a.period : " desde " + a.from})`).join("; ")).join("\n") }],
      structuredContent: { vendors: out },
    };
  },
});

import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listInvoices from "./tools/list-invoices";
import getInvoice from "./tools/get-invoice";
import listAgreements from "./tools/list-agreements";
import checkDraft from "./tools/check-draft";
import submitInvoice from "./tools/submit-invoice";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "mcp-prompt-runner",
  title: "MCP Prompt Runner",
  version: "0.1.0",
  instructions:
    "Bullao revisa cuentas por pagar (datos ficticios, no mueve dinero). Lee cuentas del mes, su ficha y lo acordado con cada proveedor, revisa borradores sin guardarlos y envía cuentas leídas (cada campo con su cita exacta). Propón campos con citas exactas; el código decide. No existe aprobación por MCP: el visto bueno solo lo da una persona en la web.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listInvoices, getInvoice, listAgreements, checkDraft, submitInvoice],
});

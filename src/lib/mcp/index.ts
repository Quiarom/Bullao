import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listInvoices from "./tools/list-invoices";
import getInvoice from "./tools/get-invoice";
import listAgreements from "./tools/list-agreements";
import checkDraft from "./tools/check-draft";
import { config } from "@/server/config.server";

const siteURL = config.baseURL;
const issuer = new URL("/api/auth", siteURL).toString();
const resource = new URL("/mcp", siteURL).toString();

export default defineMcp({
  name: "bullao",
  title: "Bullao",
  version: "0.1.0",
  instructions:
    "Bullao revisa cuentas por pagar (datos ficticios, no mueve dinero). Lee cuentas del mes, su ficha y lo acordado con cada proveedor, y revisa borradores sin guardarlos. Propón campos con citas exactas; el código decide. No existe aprobación por MCP: el visto bueno solo lo da una persona en la web.",
  auth: auth.oauth.issuer({
    issuer,
    resource,
    acceptedAudiences: [resource],
    requiredScopes: ["accounts:read"],
    jwksUri: new URL("/api/auth/jwks", siteURL).toString(),
  }),
  tools: [listInvoices, getInvoice, listAgreements, checkDraft],
});

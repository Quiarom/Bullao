import type { Dataset } from "@/ap/types";
import company from "./company.json";
import rules from "./rules.json";
import vendors from "./vendors.json";
import agreements from "./agreements.json";
import inbox from "./inbox.json";
import late from "./late.json";
import holdout from "./holdout.json";
import expected from "./expected.json";

/** Nodo Labs Inc. — empresa ficticia. Reemplaza estos JSON para usar Bullao con otra empresa. */
export const NODO_LABS = {
  company, rules, vendors, agreements, inbox, late, holdout,
  expected: { inbox: expected.inbox, holdout: expected.holdout },
} as unknown as Dataset;

import { describe, expect, it } from "vitest";
import { buildState, inboxReviewEvents } from "./engine";
import { formatReport, holdoutReport, reportFor } from "./evaluate";
import { NODO_LABS as D } from "@/demo/nodo-labs";

/** Prueba honesta: visibles y reservados. Los esperados viven en expected.json y no se ajustan. */
describe("evaluate-ap", () => {
  const visible = reportFor(buildState(D, inboxReviewEvents(D)), D.expected.inbox);
  const hold = holdoutReport(D);
  it("reporte", () => {
    console.log(["", formatReport("Casos visibles", visible), formatReport("Casos que Bullao no había visto", hold), ""].join("\n"));
  });
  it("cero pagos aprobados fuera de las reglas", () => {
    expect(visible.wrongApprovals).toBe(0);
    expect(hold.wrongApprovals).toBe(0);
    expect(visible.budgetRespected && hold.budgetRespected).toBe(true);
  });
  it("visibles: 21 de 21", () => expect(visible.correct).toBe(21));
  it("reservados: 4 de 4", () => expect(hold.correct).toBe(hold.total));
});

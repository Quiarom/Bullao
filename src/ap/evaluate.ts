import { buildState, inboxReviewEvents, type ApState } from "./engine";
import type { ApEvent, Dataset, Outcome } from "./types";

export type CaseResult = { id: string; vendor: string; expected: Outcome; got: Outcome | null; ok: boolean };
export type Report = {
  cases: CaseResult[];
  correct: number;
  total: number;
  /** Bullao dejó "lista para pagar" algo que no debía. Debe ser 0. */
  wrongApprovals: number;
  decidedAlone: number;
  askedYou: number;
  budgetRespected: boolean;
};

/** Compara la primera decisión de Bullao (antes de cualquier persona) contra lo esperado. */
export function reportFor(state: ApState, expected: Record<string, Outcome>): Report {
  const cases: CaseResult[] = Object.entries(expected).map(([id, exp]) => {
    const v = state.invoices.find((x) => x.invoice.id === id);
    const got = v?.history[0]?.outcome ?? null;
    return { id, vendor: v?.invoice.vendorName ?? id, expected: exp, got, ok: got === exp };
  });
  const seen = cases.filter((c) => c.got);
  const budgetRespected = (["USD", "COP", "MXN", "BRL"] as const).every((cur) => {
    const byPeriod = new Map<string, number>();
    for (const r of state.reservations) if (r.amount.currency === cur) byPeriod.set(r.period, (byPeriod.get(r.period) ?? 0) + r.amount.minor);
    return [...byPeriod.values()].every((t) => t <= state.rules.budget[cur] || state.rules.budget[cur] === 0 && t === 0);
  });
  return {
    cases,
    correct: seen.filter((c) => c.ok).length,
    total: seen.length,
    wrongApprovals: seen.filter((c) => c.got === "READY" && c.expected !== "READY").length,
    decidedAlone: seen.filter((c) => c.got === "READY" || c.got === "BLOCKED").length,
    askedYou: seen.filter((c) => c.got === "REVIEW").length,
    budgetRespected,
  };
}

/** Los casos reservados se corren después de revisar toda la bandeja, sin intervención de personas. */
export function holdoutReport(dataset: Dataset): Report {
  const evs = inboxReviewEvents(dataset);
  const last = evs.length;
  const hold: ApEvent[] = dataset.holdout.map((d, i) => ({
    id: `h-${d.id}`, kind: "review_invoice", payload: { docId: d.id }, actor: "Bullao",
    created_at: new Date(new Date("2026-10-10T00:00:00.000Z").getTime() + last + i).toISOString(),
  }));
  return reportFor(buildState(dataset, [...evs, ...hold]), dataset.expected.holdout);
}

export function formatReport(title: string, r: Report): string {
  return [
    `${title}`,
    `  Decisiones correctas: ${r.correct} de ${r.total}`,
    `  Pagos aprobados fuera de las reglas: ${r.wrongApprovals}`,
    `  Decididas sin pedir ayuda: ${r.decidedAlone} de ${r.total}`,
    `  Te consultó: ${r.askedYou} de ${r.total}`,
    ...r.cases.filter((c) => !c.ok).map((c) => `  FALLA ${c.id} (${c.vendor}): esperaba ${c.expected}, obtuvo ${c.got}`),
  ].join("\n");
}

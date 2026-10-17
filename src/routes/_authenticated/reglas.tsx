import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { DATASET, useApAction, useApState } from "@/hooks/use-ap";
import { OUTCOME_LABEL, previewRules } from "@/ap/engine";
import { formatMoney, parseAmount, type Currency } from "@/ap/money";
import type { RulesInput } from "@/ap/types";
import { Amount, StatusChip } from "@/components/bullao/brand";
import { ErrorState, Loading } from "@/components/bullao/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/reglas")({
  head: () => ({
    meta: [
      { title: "Reglas · Bullao" },
      { name: "description", content: "Define el presupuesto por moneda, lo que Bullao puede dejar listo solo y la tolerancia contra lo acordado." },
      { property: "og:title", content: "Reglas · Bullao" },
      { property: "og:description", content: "Las reglas con las que Bullao revisa cada cuenta." },
    ],
  }),
  component: Reglas,
});

const EDITABLE: Currency[] = ["USD", "COP", "MXN"];

const NEVER = [
  ["Una cuenta repetida nunca se paga.", "Mismo número o mismo CUFE/UUID: no se puede aprobar, sin importar el límite."],
  ["Nunca se paga en una moneda distinta a lo acordado.", "Cada moneda tiene su propio presupuesto. No se convierte."],
  ["Sin presupuesto no hay pago.", "Ni con visto bueno: antes de apartar se revisa otra vez."],
  ["La IA lee, el código decide.", "Ningún modelo decide si se paga. El documento es dato, no instrucción."],
  ["El visto bueno lo da una persona en esta pantalla.", "No existe aprobación por agentes ni por MCP."],
];

type Form = { budget: Record<string, string>; limit: Record<string, string>; contractor: string; software: string };

const toText = (minor: number, c: Currency) => formatMoney({ minor, currency: c }).replace(`${c} `, "");

function Reglas() {
  const { state, data: events, isLoading, isError, refetch } = useApState();
  const act = useApAction();
  const [form, setForm] = useState<Form | null>(null);

  useEffect(() => {
    if (state && !form) setForm({
      budget: Object.fromEntries(EDITABLE.map((c) => [c, toText(state.rules.budget[c], c)])),
      limit: Object.fromEntries(EDITABLE.map((c) => [c, toText(state.rules.autoLimit[c], c)])),
      contractor: String(state.rules.tolerancePct.contractor), software: String(state.rules.tolerancePct.software),
    });
  }, [state, form]);

  const parsed = useMemo((): { rules: RulesInput | null; errors: string[] } => {
    if (!form || !state) return { rules: null, errors: [] };
    const errors: string[] = [];
    const money = (txt: string, c: Currency, label: string) => {
      const r = parseAmount(txt, c);
      if (!r.ok) { errors.push(`No entiendo ${label} en ${c}: "${txt}".`); return 0; }
      return r.minor;
    };
    const pct = (t: string, label: string) => { const n = Number(t); if (!Number.isInteger(n) || n < 0 || n > 50) { errors.push(`La tolerancia de ${label} debe ser un entero entre 0 y 50.`); return 0; } return n; };
    const rules: RulesInput = {
      budget: { ...state.rules.budget, ...Object.fromEntries(EDITABLE.map((c) => [c, money(form.budget[c] ?? "", c, "el presupuesto")])) },
      autoLimit: { ...state.rules.autoLimit, ...Object.fromEntries(EDITABLE.map((c) => [c, money(form.limit[c] ?? "", c, "el límite")])) },
      tolerancePct: { ...state.rules.tolerancePct, contractor: pct(form.contractor, "contratistas"), software: pct(form.software, "software") },
    };
    return { rules: errors.length ? null : rules, errors };
  }, [form, state]);

  const dirty = !!(parsed.rules && state && JSON.stringify(parsed.rules) !== JSON.stringify({ autoLimit: state.rules.autoLimit, budget: state.rules.budget, tolerancePct: state.rules.tolerancePct }));
  const changes = useMemo(() => (dirty && parsed.rules && events ? previewRules(DATASET, events, parsed.rules) : []), [dirty, parsed.rules, events]);

  if (isLoading || !form) return <Loading />;
  if (isError || !state) return <ErrorState onRetry={() => refetch()} />;
  const used = (c: Currency) => state.reservations.filter((x) => x.amount.currency === c && x.period === DATASET.company.month).reduce((s, x) => s + x.amount.minor, 0);
  const set = (k: "budget" | "limit", c: string, v: string) => setForm({ ...form, [k]: { ...form[k], [c]: v } });

  function save() {
    if (!parsed.rules) return;
    act.mutate({ kind: "update_rules", payload: { rules: parsed.rules } }, {
      onSuccess: () => { toast(`Guardé reglas-v${state!.rulesHistory.length + 1}. Revisé de nuevo las cuentas sin decisión final.`); setForm(null); },
      onError: () => toast.error("No pude guardar las reglas. Siguen las anteriores."),
    });
  }

  return (
    <div className="rise grid gap-6">
      <div>
        <h1 className="text-3xl font-extrabold md:text-4xl">Reglas</h1>
        <p className="mt-2 text-muted-foreground">Versión vigente: <b className="text-foreground">{state.rules.version}</b>. Guardar crea una versión nueva; las decisiones pasadas conservan la suya.</p>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        {EDITABLE.map((c) => {
          const pct = state.rules.budget[c] ? Math.min(100, Math.round((used(c) / state.rules.budget[c]) * 100)) : 0;
          return (
            <div key={c} className="grid gap-3 rounded-xl border bg-card p-5">
              <p className="font-bold">{c}</p>
              <div className="grid gap-1.5">
                <Label htmlFor={`b-${c}`}>Presupuesto del mes</Label>
                <Input id={`b-${c}`} className="amount" value={form.budget[c]} onChange={(e) => set("budget", c, e.target.value)} />
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div>
              <p className="text-xs text-muted-foreground">Apartado: <Amount value={{ minor: used(c), currency: c }} /></p>
              <div className="grid gap-1.5">
                <Label htmlFor={`l-${c}`}>Bullao deja listo solo hasta (por pago)</Label>
                <Input id={`l-${c}`} className="amount" value={form.limit[c]} onChange={(e) => set("limit", c, e.target.value)} />
              </div>
            </div>
          );
        })}
      </section>

      <section className="grid gap-4 rounded-xl border bg-card p-5 md:grid-cols-[1fr_1fr_2fr]">
        <div className="grid gap-1.5"><Label htmlFor="tc">Tolerancia contratistas (%)</Label><Input id="tc" className="amount" inputMode="numeric" value={form.contractor} onChange={(e) => setForm({ ...form, contractor: e.target.value })} /></div>
        <div className="grid gap-1.5"><Label htmlFor="ts">Tolerancia software (%)</Label><Input id="ts" className="amount" inputMode="numeric" value={form.software} onChange={(e) => setForm({ ...form, software: e.target.value })} /></div>
        <p className="self-end text-sm text-muted-foreground">Siempre te consulto: proveedor nuevo, cambio de cuenta bancaria y datos que no encuentro en el documento.</p>
      </section>

      {(dirty || parsed.errors.length > 0) && (
        <section className="rounded-xl border border-primary bg-card p-5" aria-live="polite">
          {parsed.errors.length > 0 ? (
            <ul className="grid gap-1 text-sm text-stop">{parsed.errors.map((e) => <li key={e}>{e}</li>)}</ul>
          ) : (
            <>
              <p className="font-bold">{changes.length === 0 ? "Con estas reglas no cambia ninguna cuenta." : `Con estas reglas cambian ${changes.length} ${changes.length === 1 ? "cuenta" : "cuentas"}.`}</p>
              <ul className="mt-3 grid gap-2">
                {changes.map((c) => (
                  <li key={c.invoiceId} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-bold">{c.vendor}</span><StatusChip outcome={c.before} /><span aria-label="pasa a">→</span><StatusChip outcome={c.after} />
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">Las cuentas que ya quedaron "{OUTCOME_LABEL.READY}" o que decidió una persona no cambian.</p>
              <div className="mt-4 flex gap-2">
                <Button onClick={save} disabled={act.isPending}>Guardar como reglas-v{state.rulesHistory.length + 1}</Button>
                <Button variant="outline" onClick={() => setForm(null)}>Descartar</Button>
              </div>
            </>
          )}
        </section>
      )}

      <section className="rounded-xl border bg-muted p-5">
        <h2 className="flex items-center gap-2 text-lg font-extrabold text-muted-foreground"><Lock className="h-4 w-4" /> Lo que nunca se salta</h2>
        <ul className="mt-3 grid gap-3">
          {NEVER.map(([t, d]) => <li key={t} className="text-sm text-muted-foreground"><b>{t}</b> {d}</li>)}
        </ul>
      </section>

      {state.rulesHistory.length > 1 && (
        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-lg font-extrabold">Versiones</h2>
          <ul className="mt-2 grid gap-1 text-sm text-muted-foreground">
            {state.rulesHistory.map((r) => <li key={r.version}><b className="text-foreground">{r.version}</b> · límite USD {toText(r.autoLimit.USD, "USD")} · presupuesto USD {toText(r.budget.USD, "USD")}</li>)}
          </ul>
        </section>
      )}
    </div>
  );
}

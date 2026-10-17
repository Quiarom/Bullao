import { cva } from "class-variance-authority";
import { Check, CircleAlert, Ban } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Outcome } from "@/ap/types";
import { OUTCOME_LABEL } from "@/ap/engine";
import { formatMoney, type Money } from "@/ap/money";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("font-display text-2xl font-extrabold tracking-tight text-foreground", className)}>
      bullao<span className="text-primary">.</span>
    </span>
  );
}

export function DemoBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border bg-card px-3 py-1 text-xs text-muted-foreground">
      Demo · datos ficticios · no mueve dinero
    </span>
  );
}

const chip = cva("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap", {
  variants: {
    outcome: {
      READY: "bg-ok-soft text-ok",
      REVIEW: "bg-wait-soft text-wait",
      BLOCKED: "bg-stop-soft text-stop",
    },
    size: { sm: "", lg: "px-3.5 py-1.5 text-sm" },
  },
  defaultVariants: { size: "sm" },
});

const ICON = { READY: Check, REVIEW: CircleAlert, BLOCKED: Ban } as const;

export function StatusChip({ outcome, size }: { outcome: Outcome; size?: "sm" | "lg" }) {
  const I = ICON[outcome];
  return (
    <span className={chip({ outcome, size })}>
      <I className={size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5"} strokeWidth={2.5} />
      {OUTCOME_LABEL[outcome]}
    </span>
  );
}

export function Amount({ value, className }: { value: Money | null; className?: string }) {
  return <span className={cn("amount", className)}>{value ? formatMoney(value) : "—"}</span>;
}

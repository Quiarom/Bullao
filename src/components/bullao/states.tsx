import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export function Loading() {
  return (
    <div className="grid gap-3" aria-busy>
      <Skeleton className="h-10 w-2/3" />
      {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
    </div>
  );
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-xl border bg-stop-soft p-6">
      <p className="font-bold text-stop">No pude leer el registro del mes.</p>
      <p className="mt-1 text-sm text-muted-foreground">Nada se aprobó ni se apartó. Intenta de nuevo.</p>
      <Button className="mt-4" variant="outline" onClick={onRetry}>Intentar de nuevo</Button>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">{children}</div>;
}

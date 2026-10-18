import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { appendEvent, listEvents, resetDemo } from "@/server/events.functions";
import { authClient } from "@/lib/auth-client";
import type { JsonObject } from "@/server/events.server";
import { buildState } from "@/ap/engine";
import { DATASET } from "@/demo/dataset";

export { DATASET };
import type { ApEvent } from "@/ap/types";

export const eventsQuery = queryOptions({
  queryKey: ["ap-events"],
  queryFn: () => listEvents(),
});

export function useApState() {
  const q = useQuery(eventsQuery);
  const state = useMemo(() => (q.data ? buildState(DATASET, q.data) : null), [q.data]);
  return { ...q, state };
}

export async function appendApEvent(e: { kind: ApEvent["kind"]; payload: Record<string, unknown> }) {
  // UI actions build JSON-compatible payloads; the server validates each command before storage.
  return appendEvent({ data: { ...e, payload: e.payload as JsonObject, commandId: crypto.randomUUID() } });
}

export function useApAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (e: { kind: ApEvent["kind"]; payload: Record<string, unknown> }) => {
      await appendApEvent(e);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ap-events"] }),
  });
}

export function useResetDemo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await authClient.getSession();
      if (!data?.user.isAnonymous) throw new Error("Solo la demo de invitado se puede reiniciar.");
      await resetDemo();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ap-events"] }),
  });
}

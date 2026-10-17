import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { buildState } from "@/ap/engine";
import type { ApEvent } from "@/ap/types";

export const eventsQuery = queryOptions({
  queryKey: ["ap-events"],
  queryFn: async (): Promise<ApEvent[]> => {
    const { data, error } = await supabase.from("ap_events").select("id, kind, payload, actor, created_at").order("created_at");
    if (error) throw error;
    return (data ?? []) as ApEvent[];
  },
});

export function useApState() {
  const q = useQuery(eventsQuery);
  const state = useMemo(() => (q.data ? buildState(q.data) : null), [q.data]);
  return { ...q, state };
}

async function actorName() {
  const { data } = await supabase.auth.getUser();
  const u = data.user;
  return (u?.user_metadata?.["full_name"] as string | undefined) ?? u?.email?.split("@")[0] ?? "Operador";
}

export function useApAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (e: { kind: ApEvent["kind"]; payload: Record<string, unknown> }) => {
      const actor = await actorName();
      const { error } = await supabase.from("ap_events").insert({ kind: e.kind, payload: e.payload as never, actor });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ap-events"] }),
  });
}

export function useResetDemo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error("Sin sesión");
      const { error } = await supabase.from("ap_events").delete().eq("user_id", data.user.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ap-events"] }),
  });
}

import { supabase } from "@/integrations/supabase/client";

/** Starts a guest session: each guest gets its own month, isolated by RLS. */
export async function startDemo(): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data } = await supabase.auth.getSession();
  if (data.session) return { ok: true };
  const { error } = await supabase.auth.signInAnonymously();
  return error ? { ok: false, message: "No pude abrir la demo. Intenta de nuevo." } : { ok: true };
}

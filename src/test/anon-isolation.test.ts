import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
const key = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined;

/** Integration test against the real backend: each guest only sees its own events (RLS). */
describe.skipIf(!url || !key)("sesión de invitado", () => {
  it("una sesión anónima solo ve sus propios eventos", async () => {
    const mk = () => createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } });
    const a = mk(); const b = mk();
    const ra = await a.auth.signInAnonymously(); const rb = await b.auth.signInAnonymously();
    expect(ra.error).toBeNull(); expect(rb.error).toBeNull();
    const ins = await a.from("ap_events").insert({ kind: "review_invoice", payload: { docId: "inv-01" }, actor: "test" });
    expect(ins.error).toBeNull();
    const seenA = await a.from("ap_events").select("id"); const seenB = await b.from("ap_events").select("id");
    expect(seenA.data).toHaveLength(1);
    expect(seenB.data).toHaveLength(0);
    // B cannot write as A either
    const forged = await b.from("ap_events").insert({ kind: "review_invoice", payload: {}, user_id: ra.data.user!.id });
    expect(forged.error).not.toBeNull();
    await a.from("ap_events").delete().eq("user_id", ra.data.user!.id);
  }, 20000);
});

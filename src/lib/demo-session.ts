import { authClient } from "@/lib/auth-client";

/** Starts or reuses the current session for the demo. */
export async function startDemo(): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data, error: sessionError } = await authClient.getSession();
  if (sessionError) return { ok: false, message: "No pude abrir la demo. Intenta de nuevo." };
  if (data?.user) return { ok: true };
  const { error } = await authClient.signIn.anonymous();
  return error ? { ok: false, message: "No pude abrir la demo. Intenta de nuevo." } : { ok: true };
}

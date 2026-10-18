import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSession, anonymous } = vi.hoisted(() => ({ getSession: vi.fn(), anonymous: vi.fn() }));

vi.mock("@/lib/auth-client", () => ({
  authClient: { getSession, signIn: { anonymous } },
}));

import { startDemo } from "@/lib/demo-session";

describe("sesión de demo", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reutiliza la sesión existente y no crea otra", async () => {
    getSession.mockResolvedValue({ data: { user: { id: "user-1" } } });

    await expect(startDemo()).resolves.toEqual({ ok: true });
    expect(anonymous).not.toHaveBeenCalled();
  });

  it("crea una sesión anónima cuando no hay sesión", async () => {
    getSession.mockResolvedValue({ data: null });
    anonymous.mockResolvedValue({ error: null });

    await expect(startDemo()).resolves.toEqual({ ok: true });
    expect(anonymous).toHaveBeenCalledOnce();
  });

  it("informa si no puede crear la sesión anónima", async () => {
    getSession.mockResolvedValue({ data: null });
    anonymous.mockResolvedValue({ error: new Error("offline") });

    await expect(startDemo()).resolves.toEqual({ ok: false, message: "No pude abrir la demo. Intenta de nuevo." });
  });

  it("no crea otra sesión si falla la lectura de sesión", async () => {
    getSession.mockResolvedValue({ data: null, error: new Error("offline") });

    await expect(startDemo()).resolves.toEqual({ ok: false, message: "No pude abrir la demo. Intenta de nuevo." });
    expect(anonymous).not.toHaveBeenCalled();
  });
});

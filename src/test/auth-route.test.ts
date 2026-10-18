import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSession, handler } = vi.hoisted(() => ({
  getSession: vi.fn(),
  handler: vi.fn(),
}));
vi.mock("@/server/auth.server", () => ({ auth: { api: { getSession }, handler } }));

import { handleAuthRequest } from "@/routes/api/auth/$";

describe("OAuth entry from the web demo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    handler.mockResolvedValue(new Response("provider"));
  });

  it("asks a guest to log in and preserves the authorization query", async () => {
    getSession.mockResolvedValue({ user: { isAnonymous: true } });
    const url = new URL("http://localhost:8080/api/auth/oauth2/authorize?client_id=codex&state=test&code_challenge=abc");
    const response = await handleAuthRequest(new Request(url));
    expect(response.status).toBe(302);
    const login = new URL(response.headers.get("location")!);
    expect(login.pathname).toBe("/auth");
    expect(login.searchParams.get("next")).toBe(url.pathname + url.search);
    expect(handler).not.toHaveBeenCalled();
  });

  it("still forbids guest consent", async () => {
    getSession.mockResolvedValue({ user: { isAnonymous: true } });
    const response = await handleAuthRequest(new Request("http://localhost:8080/api/auth/oauth2/consent", { method: "POST" }));
    expect(response.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it.each([null, { user: { isAnonymous: false } }])("leaves normal authorization to the provider: %j", async (session) => {
    getSession.mockResolvedValue(session);
    await handleAuthRequest(new Request("http://localhost:8080/api/auth/oauth2/authorize?client_id=codex"));
    expect(handler).toHaveBeenCalledOnce();
  });
});

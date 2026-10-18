import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("@/lib/auth-client", () => ({ authClient: { getSession } }));

import { Route } from "@/routes/[.]lovable.oauth.consent";

const beforeLoad = Route.options.beforeLoad as (context: {
  search: { client_id: string; scope: string };
  location: { pathname: string; searchStr: string };
}) => Promise<{ email: string }>;

describe("OAuth consent page", () => {
  beforeEach(() => {
    getSession.mockResolvedValue({
      data: { user: { email: "operator@example.test", isAnonymous: false } },
    });
  });

  it("accepts a pending authorization before an authorization code exists", async () => {
    await expect(
      beforeLoad({
        search: { client_id: "assistant", scope: "accounts:read" },
        location: {
          pathname: "/.lovable/oauth/consent",
          searchStr: "?client_id=assistant&scope=accounts%3Aread",
        },
      }),
    ).resolves.toEqual({ email: "operator@example.test" });
  });
});

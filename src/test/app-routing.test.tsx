import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    getSession: vi.fn().mockResolvedValue({ data: null }),
    useSession: vi.fn().mockReturnValue({ data: null, isPending: false }),
  },
}));
vi.mock("@/server/auth.server", () => ({ auth: { handler: vi.fn() } }));
vi.mock("@/server/events.functions", () => ({
  listEvents: vi.fn().mockResolvedValue([]),
  appendEvent: vi.fn(),
  resetDemo: vi.fn(),
}));
vi.mock("@/lib/extract.functions", () => ({ extractInvoice: vi.fn() }));

import { routeTree } from "@/routeTree.gen";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });
});

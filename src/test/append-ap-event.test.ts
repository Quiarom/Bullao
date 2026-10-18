import { describe, expect, it, vi } from "vitest";

const { appendEvent } = vi.hoisted(() => ({ appendEvent: vi.fn() }));

vi.mock("@/server/events.functions", () => ({ appendEvent }));

import { appendApEvent } from "@/hooks/use-ap";

describe("appendApEvent", () => {
  it("sends uploaded drafts through the review event command", async () => {
    const draft = { id: "up-1" };

    await appendApEvent({ kind: "review_invoice", payload: { draft } });

    expect(appendEvent).toHaveBeenCalledOnce();
    const [{ data }] = appendEvent.mock.calls[0] as [
      { data: { kind: string; payload: Record<string, unknown>; commandId: string } },
    ];
    expect(data.kind).toBe("review_invoice");
    expect(data.payload).toEqual({ draft });
    expect(data.commandId).toMatch(/^[0-9a-f-]{36}$/i);
  });
});

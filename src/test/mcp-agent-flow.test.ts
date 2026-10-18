import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildState } from "@/ap/engine";
import { NODO_LABS } from "@/demo/nodo-labs";
import { z } from "zod";
import type { ApEvent } from "@/ap/types";

type Handler = (
  args: unknown,
  ctx: unknown,
) => Promise<{
  structuredContent: Partial<
    Record<
      "id" | "outcome" | "reasons" | "dueDate" | "replay" | "link" | "checks" | "invoice",
      unknown
    >
  >;
}>;

const mocks = vi.hoisted(() => ({
  rows: new Map<string, ApEvent & { user_id: string }>(),
  user: "u1",
  authenticated: true,
}));
vi.mock("@lovable.dev/mcp-js", () => ({
  defineTool: (tool: unknown) => tool,
  ToolError: class ToolError extends Error {},
}));
vi.mock("@/lib/mcp/supabase", () => ({
  supabaseForUser: () => {
    const user = mocks.user;
    return {
      from: () => ({
        insert: async (row: Omit<ApEvent, "created_at">) => {
          const key = `${user}:${row.id}`;
          if (mocks.rows.has(key)) return { error: { code: "23505" } };
          mocks.rows.set(key, { ...row, user_id: user, created_at: new Date().toISOString() });
          return { error: null };
        },
        select: () => ({
          eq: (_field: string, id: string) => ({
            maybeSingle: async () => ({ data: mocks.rows.get(`${user}:${id}`) ?? null }),
          }),
          order: () => ({
            limit: async () => ({
              data: [...mocks.rows.values()].filter((r) => r.user_id === user),
              error: null,
            }),
          }),
        }),
      }),
    };
  },
}));

const args = {
  documentText: "Hosting Andes HA-1 USD 800.00 2026-10 Hosting 3344",
  vendorName: { value: "Hosting Andes", quote: "Hosting Andes" },
  invoiceNumber: { value: "HA-1", quote: "HA-1" },
  amount: { value: "USD 800.00", quote: "USD 800.00" },
  currency: { value: "USD", quote: "USD" },
  period: { value: "2026-10", quote: "2026-10" },
  concept: { value: "Hosting", quote: "Hosting" },
  bankLast4: { value: "3344", quote: "3344" },
};
const ctx = {
  isAuthenticated: () => mocks.authenticated,
  getClaims: () => ({ sub: mocks.user }),
  getToken: () => "test-token",
  getClientId: () => "test",
};
const previewArgs = {
  documentText: args.documentText,
  vendorId: "hosting",
  vendorName: "Hosting Andes",
  invoiceNumber: "HA-1",
  businessId: null,
  amountText: "USD 800.00",
  currency: "USD",
  period: "2026-10",
  concept: "Hosting",
  bankLast4: "3344",
};

describe("MCP agent invoice flow", () => {
  beforeEach(() => {
    mocks.rows.clear();
    mocks.user = "u1";
    mocks.authenticated = true;
  });
  it("previews and submits through real handlers with an actionable response", async () => {
    const { default: preview } = await import("@/lib/mcp/tools/check-draft");
    const { default: submit } = await import("@/lib/mcp/tools/submit-invoice");
    const p = await (preview.handler as Handler)(
      {
        documentText: args.documentText,
        vendorId: "unknown",
        vendorName: "Hosting Andes",
        invoiceNumber: "HA-1",
        businessId: null,
        amountText: "USD 800.00",
        currency: "USD",
        period: "2026-10",
        concept: "Hosting",
        bankLast4: "3344",
      },
      ctx,
    );
    expect(mocks.rows.size).toBe(0);
    expect(p.structuredContent).not.toHaveProperty("link");
    expect(p.structuredContent).not.toHaveProperty("id");
    const result = await (submit.handler as Handler)({ ...args, requestId: "retry-1" }, ctx);
    expect(p.structuredContent.checks).toContainEqual(
      expect.objectContaining({ id: "evidence", ok: true }),
    );
    expect(p.structuredContent).toMatchObject({ outcome: "READY", dueDate: null, reasons: [] });
    expect(result.structuredContent).toMatchObject({
      id: expect.any(String),
      outcome: "READY",
      reasons: [],
      dueDate: null,
      replay: false,
      link: expect.stringMatching(/^\/cuentas\?cuenta=/),
    });
    const { default: getInvoice } = await import("@/lib/mcp/tools/get-invoice");
    const read = await (getInvoice.handler as Handler)({ id: result.structuredContent.id }, ctx);
    expect(read.structuredContent.invoice).toMatchObject({
      id: result.structuredContent.id,
      outcome: "READY",
      reasons: [],
      dueDate: null,
      link: result.structuredContent.link,
    });
  });
  it("does not duplicate concurrent retries; rejects payload conflicts and isolates users", async () => {
    const { default: submit } = await import("@/lib/mcp/tools/submit-invoice");
    const handler = submit.handler as Handler;
    const [one, two] = await Promise.all([
      handler({ ...args, requestId: "retry-1" }, ctx),
      handler({ ...args, requestId: "retry-1" }, ctx),
    ]);
    expect(mocks.rows.size).toBe(1);
    expect([one.structuredContent.replay, two.structuredContent.replay].sort()).toEqual([
      false,
      true,
    ]);
    await expect(
      handler(
        { ...args, requestId: "retry-1", ...{ invoiceNumber: { value: "OTHER", quote: "OTHER" } } },
        ctx,
      ),
    ).rejects.toThrow(/otros datos/);
    mocks.user = "u2";
    const other = await handler({ ...args, requestId: "retry-1" }, ctx);
    expect(other.structuredContent.replay).toBe(false);
    expect(mocks.rows.size).toBe(2);
  });
  it("treats the same effective payload as identical regardless of object key order", async () => {
    const { default: submit } = await import("@/lib/mcp/tools/submit-invoice");
    const handler = submit.handler as Handler;
    const first = await handler({ ...args, requestId: "stable-fingerprint" }, ctx);
    const reordered = Object.fromEntries(Object.entries(args).reverse());
    const second = await handler({ ...reordered, requestId: "stable-fingerprint" }, ctx);
    expect(second.structuredContent).toMatchObject({
      id: first.structuredContent.id,
      replay: true,
    });
    expect(mocks.rows.size).toBe(1);
  });
  it("rejects unauthenticated users", async () => {
    const { default: submit } = await import("@/lib/mcp/tools/submit-invoice");
    const { default: preview } = await import("@/lib/mcp/tools/check-draft");
    mocks.authenticated = false;
    await expect(
      (submit.handler as Handler)({ ...args, requestId: "retry-1" }, ctx),
    ).rejects.toThrow(/iniciar sesión/);
    await expect((preview.handler as Handler)(previewArgs, ctx)).rejects.toThrow(/iniciar sesión/);
    expect(mocks.rows.size).toBe(0);
  });
  it("accepts a literal localized period quote in preview and submit", async () => {
    const { default: preview } = await import("@/lib/mcp/tools/check-draft");
    const { default: submit } = await import("@/lib/mcp/tools/submit-invoice");
    const documentText = args.documentText.replace("2026-10", "octubre de 2026");
    const p = await (preview.handler as Handler)(
      {
        documentText,
        vendorId: "hosting",
        vendorName: "Hosting Andes",
        invoiceNumber: "HA-1",
        businessId: null,
        amountText: "USD 800.00",
        currency: "USD",
        period: "2026-10",
        periodQuote: "octubre de 2026",
        concept: "Hosting",
        bankLast4: "3344",
      },
      ctx,
    );
    expect(p.structuredContent.outcome).toBe("READY");
    const result = await (submit.handler as Handler)(
      { ...args, documentText, period: { value: "2026-10", quote: "octubre de 2026" } },
      ctx,
    );
    expect(result.structuredContent.outcome).toBe("READY");
  });
  it("reports duplicate invoices as BLOCKED, not as a replay or a failed submission", async () => {
    const { default: submit } = await import("@/lib/mcp/tools/submit-invoice");
    const { default: preview } = await import("@/lib/mcp/tools/check-draft");
    const one = await (submit.handler as Handler)(args, ctx);
    const p = await (preview.handler as Handler)(previewArgs, ctx);
    expect(p.structuredContent.outcome).toBe("BLOCKED");
    expect(mocks.rows.size).toBe(1);
    const two = await (submit.handler as Handler)(args, ctx);
    expect(two.structuredContent).toMatchObject({ outcome: "BLOCKED", replay: false });
    expect(two.structuredContent.id).not.toBe(one.structuredContent.id);
    expect(two.structuredContent.reasons).toContainEqual(expect.stringMatching(/ya llegó/));
    expect(mocks.rows.size).toBe(2);
    expect(buildState(NODO_LABS, [...mocks.rows.values()]).reservations).toHaveLength(1);
  });
  it("requires evidence in both handlers and persists REVIEW without granting approval", async () => {
    const { default: submit } = await import("@/lib/mcp/tools/submit-invoice");
    const { default: preview } = await import("@/lib/mcp/tools/check-draft");
    const p = await (preview.handler as Handler)(
      { ...previewArgs, documentText: "HA-1 USD 800.00 Hosting 3344" },
      ctx,
    );
    expect(p.structuredContent).toMatchObject({
      outcome: "REVIEW",
      reasons: expect.arrayContaining([expect.stringMatching(/evidencia|documento/)]),
    });
    expect(mocks.rows.size).toBe(0);
    const missingPeriod = await (preview.handler as Handler)(
      { ...previewArgs, periodQuote: null },
      ctx,
    );
    expect(missingPeriod.structuredContent.outcome).toBe("REVIEW");
    const result = await (submit.handler as Handler)(
      {
        ...args,
        vendorName: { ...args.vendorName, quote: null },
        currency: { ...args.currency, quote: null },
        period: { ...args.period, quote: null },
      },
      ctx,
    );
    expect(result.structuredContent.outcome).toBe("REVIEW");
    expect(result.structuredContent.reasons).not.toHaveLength(0);
    expect(mocks.rows.size).toBe(1);
    expect(buildState(NODO_LABS, [...mocks.rows.values()]).reservations).toHaveLength(0);
  });
  it("rejects guest sessions through the real state guard before writing", async () => {
    const { default: submit } = await import("@/lib/mcp/tools/submit-invoice");
    const { default: preview } = await import("@/lib/mcp/tools/check-draft");
    const guest = { ...ctx, getClaims: () => ({ sub: "guest", is_anonymous: true }) };
    await expect((submit.handler as Handler)(args, guest)).rejects.toThrow(/invitado/);
    await expect((preview.handler as Handler)(previewArgs, guest)).rejects.toThrow(/invitado/);
    expect(mocks.rows.size).toBe(0);
  });
  it("returns explicit due dates only with literal due-date evidence and keeps schemas optional", async () => {
    const { default: submit } = await import("@/lib/mcp/tools/submit-invoice");
    const { default: preview } = await import("@/lib/mcp/tools/check-draft");
    expect(z.object(preview.inputSchema!).safeParse(previewArgs).success).toBe(true);
    expect(z.object(submit.inputSchema!).safeParse(args).success).toBe(true);
    const documentText = `${args.documentText}\nVencimiento: 2026-10-31`;
    const dueDate = { value: "2026-10-31", quote: "Vencimiento: 2026-10-31" };
    const invalid = await (preview.handler as Handler)(
      { ...previewArgs, documentText, dueDate: dueDate.value },
      ctx,
    );
    expect(invalid.structuredContent).toMatchObject({
      outcome: "REVIEW",
      reasons: expect.arrayContaining([expect.stringMatching(/vencimiento/)]),
    });
    const p = await (preview.handler as Handler)(
      { ...previewArgs, documentText, dueDate: dueDate.value, dueDateQuote: dueDate.quote },
      ctx,
    );
    const result = await (submit.handler as Handler)({ ...args, documentText, dueDate }, ctx);
    expect(p.structuredContent).toMatchObject({ outcome: "READY", dueDate: "2026-10-31" });
    expect(result.structuredContent).toMatchObject({ outcome: "READY", dueDate: "2026-10-31" });
  });
});

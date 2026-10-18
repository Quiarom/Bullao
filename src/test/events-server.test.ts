import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildState, inboxReviewEvents } from "@/ap/engine";
import { NODO_LABS } from "@/demo/nodo-labs";
import { appendEventForUser, readEventsForUser, resetDemoForUser } from "@/server/events.server";

const stores: InstanceType<typeof Database>[] = [];
const store = () => {
  const db = new Database(":memory:");
  db.exec(
    `CREATE TABLE ap_events (seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, user_id TEXT NOT NULL, command_id TEXT NOT NULL, kind TEXT NOT NULL, payload TEXT NOT NULL, actor TEXT, created_at TEXT NOT NULL, UNIQUE(user_id, command_id))`,
  );
  stores.push(db);
  return db;
};
const user = (id: string, isAnonymous = false) => ({
  id,
  name: "Ada",
  email: "ada@example.test",
  isAnonymous,
});

afterEach(() => {
  for (const db of stores.splice(0)) db.close();
});

describe("SQLite AP events", () => {
  it("keeps user isolation, stable replay order, and command idempotency", () => {
    const db = store();
    const first = appendEventForUser(
      user("a"),
      { kind: "review_invoice", payload: { invoiceId: "inv-11" }, commandId: "c1" },
      db,
    );
    const duplicate = appendEventForUser(
      user("a"),
      { kind: "review_invoice", payload: { invoiceId: "inv-11" }, commandId: "c1" },
      db,
    );
    appendEventForUser(
      user("a"),
      { kind: "hold_invoice", payload: { invoiceId: "inv-11" }, commandId: "c2" },
      db,
    );
    expect(duplicate).toEqual(first);
    expect(readEventsForUser("a", db).map((event) => event.kind)).toEqual([
      "review_invoice",
      "hold_invoice",
    ]);
    expect(readEventsForUser("b", db)).toEqual([]);
  });

  it("rejects invented approval targets and only lets guests reset their rows", () => {
    const db = store();
    expect(() =>
      appendEventForUser(
        user("a"),
        {
          kind: "approve_invoice",
          payload: { invoiceId: "fake", contentHash: "x" },
          commandId: "c1",
        },
        db,
      ),
    ).toThrow();
    appendEventForUser(
      user("a"),
      { kind: "review_invoice", payload: { invoiceId: "inv-11" }, commandId: "c2" },
      db,
    );
    appendEventForUser(
      user("b"),
      { kind: "review_invoice", payload: { invoiceId: "inv-11" }, commandId: "c3" },
      db,
    );
    expect(() => resetDemoForUser(user("a"), db)).toThrow();
    resetDemoForUser(user("guest", true), db);
    expect(readEventsForUser("a", db)).toHaveLength(1);
    expect(readEventsForUser("guest", db)).toEqual([]);
  });

  it("rejects stale hashes and approvals for blocked invoices", () => {
    const db = store();
    const review = appendEventForUser(
      user("a"),
      { kind: "review_invoice", payload: { invoiceId: "inv-11" }, commandId: "review" },
      db,
    );
    const view = buildState(NODO_LABS, [review]).invoices.find(
      (item) => item.invoice.id === "inv-11",
    )!;
    expect(() =>
      appendEventForUser(
        user("a"),
        {
          kind: "approve_invoice",
          payload: { invoiceId: "inv-11", contentHash: "stale" },
          commandId: "stale",
        },
        db,
      ),
    ).toThrow(/cambió/);
    const seed = inboxReviewEvents(NODO_LABS);
    const initial = buildState(NODO_LABS, seed);
    const approvals = ["inv-11", "inv-19", "inv-21", "inv-15"].map((invoiceId, index) => ({
      id: `seed-approval-${index}`,
      kind: "approve_invoice" as const,
      payload: {
        invoiceId,
        contentHash: initial.invoices.find((item) => item.invoice.id === invoiceId)!.current
          .contentHash,
      },
      actor: "Ada",
      created_at: `2026-10-16T00:00:0${index}.000Z`,
    }));
    const current = buildState(NODO_LABS, [...seed, ...approvals]);
    const blocked = current.invoices.find((item) => item.invoice.id === "inv-14")!;
    expect(blocked.current.outcome).toBe("REVIEW");
    const insert = db.prepare(
      "INSERT INTO ap_events (id, user_id, command_id, kind, payload, actor, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    );
    for (const event of [...seed, ...approvals])
      insert.run(
        event.id,
        "b",
        `seed-${event.id}`,
        event.kind,
        JSON.stringify(event.payload),
        event.actor,
        event.created_at,
      );
    expect(() =>
      appendEventForUser(
        user("b"),
        {
          kind: "approve_invoice",
          payload: { invoiceId: "inv-14", contentHash: blocked.current.contentHash },
          commandId: "approve",
        },
        db,
      ),
    ).toThrow(/bloqueo/);
    expect(view.current.outcome).toBe("REVIEW");
  });

  it("rejects reuse of one command ID for different payload", () => {
    const db = store();
    const commandId = "same";
    appendEventForUser(
      user("a"),
      { kind: "review_invoice", payload: { invoiceId: "inv-11" }, commandId },
      db,
    );
    expect(() =>
      appendEventForUser(
        user("a"),
        { kind: "hold_invoice", payload: { invoiceId: "inv-11" }, commandId },
        db,
      ),
    ).toThrow(/ya usado/);
  });

  it("rejects unknown command kinds and malformed drafts, then leaves citation evidence to the engine", () => {
    const db = store();
    expect(() =>
      appendEventForUser(user("a"), { kind: "erase_everything", payload: {}, commandId: "bad" }),
    ).toThrow(/Comando/);
    expect(() =>
      appendEventForUser(
        user("a"),
        { kind: "review_invoice", payload: { draft: { id: "bad" } }, commandId: "bad-draft" },
        db,
      ),
    ).toThrow(/Borrador/);
    const draft = {
      id: "uploaded",
      vendorRef: "unknown",
      vendorName: "Proveedor",
      invoiceNumber: null,
      businessId: null,
      amountText: "USD 10",
      currencyHint: "USD",
      period: "2026-10",
      concept: "Servicio",
      bankLast4: null,
      channel: "correo",
      receivedAt: "",
      text: "Documento sin cita",
      quotes: [{ field: "monto", text: "USD 10" }],
      method: "agent",
    };
    const event = appendEventForUser(
      user("a"),
      { kind: "review_invoice", payload: { draft }, commandId: "unverified-quote" },
      db,
    );
    const state = buildState(NODO_LABS, [event]);
    const invoice = state.invoices.find((item) => item.invoice.id === "uploaded")!;
    expect(invoice.current.outcome).toBe("REVIEW");
    expect(invoice.current.outcome).not.toBe("READY");
    expect(invoice.current.checks.find((check) => check.id === "evidence")?.ok).toBe(false);
  });

  it("persists rows after reopening SQLite and reads more than 1000 events", () => {
    const directory = mkdtempSync(join(tmpdir(), "bullao-events-"));
    const filename = join(directory, "events.sqlite");
    try {
      let db = new Database(filename);
      db.exec(
        `CREATE TABLE ap_events (seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, user_id TEXT NOT NULL, command_id TEXT NOT NULL, kind TEXT NOT NULL, payload TEXT NOT NULL, actor TEXT, created_at TEXT NOT NULL, UNIQUE(user_id, command_id))`,
      );
      appendEventForUser(
        user("a"),
        { kind: "review_invoice", payload: { invoiceId: "inv-11" }, commandId: "review" },
        db,
      );
      db.prepare(
        "INSERT INTO ap_events (id, user_id, command_id, kind, payload, actor, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ).run(
        "seed",
        "a",
        "seed",
        "hold_invoice",
        JSON.stringify({ invoiceId: "inv-11" }),
        "Ada",
        new Date().toISOString(),
      );
      const insert = db.prepare(
        "INSERT INTO ap_events (id, user_id, command_id, kind, payload, actor, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      );
      const seed = db.transaction(() => {
        for (let i = 0; i < 1001; i++)
          insert.run(
            `row-${i}`,
            "large",
            `cmd-${i}`,
            "hold_invoice",
            JSON.stringify({ invoiceId: "inv-11" }),
            "Ada",
            new Date().toISOString(),
          );
      });
      seed();
      db.close();
      db = new Database(filename);
      expect(readEventsForUser("a", db)).toHaveLength(2);
      expect(readEventsForUser("large", db)).toHaveLength(1001);
      db.close();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

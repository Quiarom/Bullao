import { randomUUID } from "node:crypto";
import { z } from "zod";
import { buildState, contentHash } from "@/ap/engine";
import { DATASET } from "@/demo/dataset";
import type { ApEvent, InvoiceDraft } from "@/ap/types";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { apEvents } from "./events-schema";
import { db, sqlite } from "./db.server";

export type EventUser = { id: string; name: string; email: string; isAnonymous?: boolean };
export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };
export type EventCommand = { kind: ApEvent["kind"]; payload: JsonObject; commandId: string };
export type SerializableApEvent = Omit<ApEvent, "payload"> & { payload: JsonObject };

const commandEnvelope = z
  .object({
    kind: z.enum([
      "approve_invoice",
      "hold_invoice",
      "approve_agreement",
      "receive_invoice",
      "review_invoice",
      "update_rules",
    ]),
    payload: z.record(z.string(), z.json()),
    commandId: z.string().min(1).max(200),
  })
  .strict();

export function parseEventCommand(input: unknown): EventCommand {
  const parsed = commandEnvelope.safeParse(input);
  if (!parsed.success) throw new Error("Comando o datos no válidos.");
  return parsed.data;
}

const id = z.string().min(1).max(200);
const currencies = {
  USD: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  COP: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  MXN: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  BRL: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
};
const rulesInput = z
  .object({
    autoLimit: z.object(currencies).strict(),
    budget: z.object(currencies).strict(),
    tolerancePct: z
      .object({
        contractor: z.number().min(0).max(100),
        software: z.number().min(0).max(100),
        provider: z.number().min(0).max(100),
      })
      .strict(),
  })
  .strict();
const schemas = {
  approve_invoice: z.object({ invoiceId: id, contentHash: z.string().min(1).max(100) }).strict(),
  hold_invoice: z.object({ invoiceId: id }).strict(),
  approve_agreement: z.object({ agreementId: id }).strict(),
  receive_invoice: z.object({ invoiceId: id }).strict(),
  review_invoice: z.union([
    z.object({ invoiceId: id }).strict(),
    z.object({ docId: id }).strict(),
    z.object({ draft: z.unknown() }).strict(),
  ]),
  update_rules: z.object({ rules: rulesInput }).strict(),
} satisfies Record<ApEvent["kind"], z.ZodType>;

type EventRow = {
  id: string;
  kind: ApEvent["kind"];
  payload: string;
  actor: string | null;
  created_at: string;
};
const eventFromRow = (row: EventRow): SerializableApEvent => ({
  id: row.id,
  kind: row.kind,
  payload: JSON.parse(row.payload) as JsonObject,
  actor: row.actor,
  created_at: row.created_at,
});
const docs = new Set(
  [...DATASET.inbox, ...DATASET.late, ...DATASET.holdout].map((d) => d.id),
);
const draftSchema = z
  .object({
    id,
    vendorRef: z.string().min(1).max(200),
    vendorName: z.string().min(1).max(200),
    invoiceNumber: z.string().max(200).nullable(),
    businessId: z.string().max(200).nullable(),
    amountText: z.string().min(1).max(200),
    currencyHint: z.enum(["COP", "MXN", "BRL", "USD"]).nullable(),
    period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    concept: z.string().max(1000),
    bankLast4: z.string().max(4).nullable(),
    channel: z.enum(["correo", "PDF", "WhatsApp", "XML DIAN", "XML CFDI"]),
    receivedAt: z.string().datetime().or(z.literal("")),
    text: z.string().min(1).max(20000),
    quotes: z
      .array(
        z.object({ field: z.string().min(1).max(100), text: z.string().min(1).max(500) }).strict(),
      )
      .max(30),
    method: z.enum(["xml", "agent", "fixture"]),
    caseNo: z.number().int().optional(),
  })
  .strict();

export function readEventsForUser(
  userId: string,
  store: typeof sqlite = sqlite,
): SerializableApEvent[] {
  const query = store === sqlite ? db : drizzle(store);
  const rows = query
    .select({
      id: apEvents.id,
      kind: apEvents.kind,
      payload: apEvents.payload,
      actor: apEvents.actor,
      created_at: apEvents.createdAt,
    })
    .from(apEvents)
    .where(eq(apEvents.userId, userId))
    .orderBy(apEvents.seq)
    .all() as EventRow[];
  return rows.map(eventFromRow);
}

function validateCommand(command: EventCommand, events: ApEvent[]): JsonObject {
  const parsed = schemas[command.kind].safeParse(command.payload);
  if (!parsed.success) throw new Error("Comando o datos no válidos.");
  const payload = parsed.data as JsonObject;
  const state = buildState(DATASET, events);
  if (command.kind === "receive_invoice" || command.kind === "review_invoice") {
    const docId = payload["invoiceId"] ?? payload["docId"];
    if (typeof docId === "string" && !docs.has(docId)) throw new Error("Documento no encontrado.");
    if (payload["draft"]) {
      const draft = draftSchema.safeParse(payload["draft"]);
      if (!draft.success) throw new Error("Borrador no válido.");
      const value = draft.data as InvoiceDraft;
      if (docs.has(value.id) || state.invoices.some((v) => v.invoice.id === value.id))
        throw new Error("Identificador de cuenta ya usado.");
    }
  } else if (command.kind === "hold_invoice") {
    if (!state.invoices.some((v) => v.invoice.id === payload["invoiceId"]))
      throw new Error("Cuenta no encontrada.");
  } else if (command.kind === "approve_agreement") {
    if (!state.agreements.some((a) => a.id === payload["agreementId"] && a.status === "PROPOSED"))
      throw new Error("Acuerdo no disponible para aprobación.");
  } else if (command.kind === "approve_invoice") {
    const view = state.invoices.find((v) => v.invoice.id === payload["invoiceId"]);
    if (!view || view.current.outcome !== "REVIEW")
      throw new Error("Cuenta no disponible para aprobación.");
    if (payload["contentHash"] !== contentHash(view.invoice))
      throw new Error("La cuenta cambió. Actualiza antes de aprobar.");
    const next = buildState(DATASET, [
      ...events,
      {
        kind: command.kind,
        payload,
        id: "validation",
        actor: "Operador",
        created_at: new Date().toISOString(),
      },
    ]);
    const after = next.invoices.find((v) => v.invoice.id === payload["invoiceId"]);
    if (!after || after.current.outcome !== "READY")
      throw new Error("La cuenta tiene un bloqueo o excede límites.");
  } else if (command.kind === "update_rules") {
    const trial: ApEvent = {
      kind: command.kind,
      payload,
      id: "validation",
      actor: "Operador",
      created_at: new Date().toISOString(),
    };
    const next = buildState(DATASET, [...events, trial]);
    if (JSON.stringify(next.rules) === JSON.stringify(state.rules))
      throw new Error("Reglas no válidas o sin cambios.");
  }
  return payload;
}

export function appendEventForUser(
  user: EventUser,
  input: unknown,
  store: typeof sqlite = sqlite,
): SerializableApEvent {
  const command = parseEventCommand(input);
  return store.transaction(() => {
    const query = store === sqlite ? db : drizzle(store);
    const old = query
      .select({
        id: apEvents.id,
        kind: apEvents.kind,
        payload: apEvents.payload,
        actor: apEvents.actor,
        created_at: apEvents.createdAt,
      })
      .from(apEvents)
      .where(and(eq(apEvents.userId, user.id), eq(apEvents.commandId, command.commandId)))
      .get() as EventRow | undefined;
    if (old) {
      if (
        old.kind !== command.kind ||
        JSON.stringify(JSON.parse(old.payload)) !== JSON.stringify(command.payload)
      )
        throw new Error("Identificador de comando ya usado con otros datos.");
      return eventFromRow(old);
    }
    const events = readEventsForUser(user.id, store);
    const payload = validateCommand(command, events);
    const event: SerializableApEvent = {
      id: randomUUID(),
      kind: command.kind,
      payload,
      actor: user.isAnonymous ? "Invitado" : user.name || user.email.split("@")[0] || "Operador",
      created_at: new Date().toISOString(),
    };
    query
      .insert(apEvents)
      .values({
        id: event.id,
        userId: user.id,
        commandId: command.commandId,
        kind: event.kind,
        payload: JSON.stringify(event.payload),
        actor: event.actor,
        createdAt: event.created_at,
      })
      .run();
    return event;
  })();
}

export function resetDemoForUser(user: EventUser, store: typeof sqlite = sqlite): void {
  if (!user.isAnonymous) throw new Error("Solo las sesiones de invitado pueden reiniciar la demo.");
  const query = store === sqlite ? db : drizzle(store);
  query.delete(apEvents).where(eq(apEvents.userId, user.id)).run();
}

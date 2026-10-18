import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const apEvents = sqliteTable(
  "ap_events",
  {
    seq: integer("seq").primaryKey({ autoIncrement: true }),
    id: text("id").notNull().unique(),
    userId: text("user_id").notNull(),
    commandId: text("command_id").notNull(),
    kind: text("kind").notNull(),
    payload: text("payload").notNull(),
    actor: text("actor"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [uniqueIndex("ap_events_user_command").on(table.userId, table.commandId)],
);

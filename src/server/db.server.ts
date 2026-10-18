import Database from "better-sqlite3";
import { chmodSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./events-schema";

const filename = resolve(process.env["DATABASE_PATH"] ?? "./data/bullao.sqlite");
mkdirSync(dirname(filename), { recursive: true, mode: 0o700 });

export const sqlite = new Database(filename);
chmodSync(filename, 0o600);
sqlite.pragma("foreign_keys = ON");
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("busy_timeout = 5000");
for (const sidecar of [`${filename}-wal`, `${filename}-shm`]) {
  try { chmodSync(sidecar, 0o600); } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
sqlite.exec(`CREATE TABLE IF NOT EXISTS ap_events (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  command_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL,
  actor TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, command_id)
);`);

export const db = drizzle(sqlite, { schema });

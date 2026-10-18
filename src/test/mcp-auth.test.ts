import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import type { ToolContext } from "@lovable.dev/mcp-js";
import { requireMcpUser } from "@/lib/mcp/state";

const store = new Database(":memory:");
store.exec('CREATE TABLE "user" (id TEXT PRIMARY KEY, isAnonymous INTEGER)');
store.prepare('INSERT INTO "user" VALUES (?, ?)').run("real", 0);
store.prepare('INSERT INTO "user" VALUES (?, ?)').run("guest", 1);

function context(userId: string, scopes: string[], authenticated = true) {
  return {
    isAuthenticated: () => authenticated,
    getUserId: () => userId,
    getScopes: () => scopes,
  } as unknown as ToolContext;
}

describe("MCP access", () => {
  it("accepts existing real user with read scope", () => {
    expect(requireMcpUser(context("real", ["accounts:read"]), store)).toBe("real");
  });

  it("rejects guest and missing read scope", () => {
    expect(() => requireMcpUser(context("guest", ["accounts:read"]), store)).toThrow("invitado");
    expect(() => requireMcpUser(context("real", []), store)).toThrow("lectura de cuentas");
  });
});

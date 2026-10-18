import { strict as assert } from "node:assert";
import { test } from "node:test";
import { findingsFor } from "./security-check.mjs";

test("release guard rejects private paths and credentials without printing values", () => {
  for (const path of [".env", ".env.local", "Docs/brief.md", "data/accounts.json", ".claude/settings.json", "key.pem", "data.sqlite-wal"]) {
    assert.ok(findingsFor(path, "").includes("private file"), path);
  }
  assert.deepEqual(findingsFor(".env.example", "BETTER_AUTH_SECRET=\nPORT=8080"), []);
  assert.ok(findingsFor(".env.example", "DEMO_OPERATIONS_PASSWORD=not-a-real-value").length);
  assert.ok(findingsFor("src/leak.ts", "gh" + "p_" + "x".repeat(36)).includes("credential token"));
  assert.deepEqual(findingsFor("src/ap/money.ts", "export const minor = 100;"), []);
});

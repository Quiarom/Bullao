import { strict as assert } from "node:assert";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseEnv } from "node:util";
import { test } from "node:test";
import { personas, setup } from "./setup.mjs";
import { verifyDemoAccounts } from "./demo-accounts.mjs";

test("setup preserves secrets and migrates legacy credentials", async () => {
  const directory = await mkdtemp(join(tmpdir(), "bullao-setup-"));
  try {
    const secret = "test-only-" + "x".repeat(40);
    await writeFile(join(directory, ".env.example"), "BETTER_AUTH_SECRET=\n");
    await writeFile(join(directory, ".env.local"), `BETTER_AUTH_SECRET=${secret}\nPORT=8089\n`);
    await mkdir(join(directory, "data"));
    const legacy = personas.map(([, email]) => ({ email, password: `test-only-${email}` }));
    await writeFile(join(directory, "data/demo-accounts.local.json"), JSON.stringify(legacy));
    await setup(directory);
    const before = await readFile(join(directory, ".env.local"), "utf8");
    const env = parseEnv(before);
    assert.equal(env.BETTER_AUTH_SECRET, secret);
    assert.equal(env.PORT, "8089");
    personas.forEach(([id], index) => assert.equal(env[`DEMO_${id}_PASSWORD`], legacy[index].password));
    await assert.rejects(stat(join(directory, "data/demo-accounts.local.json")), { code: "ENOENT" });
    assert.equal((await stat(join(directory, ".env.local"))).mode & 0o777, 0o600);
    await setup(directory);
    assert.equal(await readFile(join(directory, ".env.local"), "utf8"), before);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("fresh setup creates distinct random credentials", async () => {
  const directory = await mkdtemp(join(tmpdir(), "bullao-setup-"));
  try {
    await writeFile(join(directory, ".env.example"), "BETTER_AUTH_SECRET=\n");
    await setup(directory);
    const env = parseEnv(await readFile(join(directory, ".env.local"), "utf8"));
    assert.ok(env.BETTER_AUTH_SECRET.length >= 32);
    const passwords = personas.map(([id]) => env[`DEMO_${id}_PASSWORD`]);
    assert.equal(new Set(passwords).size, 3);
    assert.ok(passwords.every((value) => value.length >= 24));
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("demo creation refuses remote servers and missing credentials before requests", async () => {
  await assert.rejects(verifyDemoAccounts({ BETTER_AUTH_URL: "https://example.com" }), /servidor local/);
  await assert.rejects(verifyDemoAccounts({ BETTER_AUTH_URL: "http://localhost:8080" }), /DEMO_OPERATIONS/);
});

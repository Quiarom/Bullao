import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function findingsFor(path, text) {
  const findings = [];
  if (/(^|\/)(Docs|data|\.firecrawl|\.projectmem|\.codegraph|\.claude|\.codex|\.agents|\.atl)\//.test(path) || /(^|\/)\.env(?:\..*)?$/.test(path) && !path.endsWith(".example") || /\.(?:pem|key|sqlite(?:-wal|-shm)?|db)$/.test(path)) findings.push("private file");
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)) findings.push("private key");
  if (/\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|sk-(?:proj-)?[A-Za-z0-9_-]{32,}|sb_secret_[A-Za-z0-9_-]{20,})\b/.test(text)) findings.push("credential token");
  if (path.endsWith(".example") && /^(?:BETTER_AUTH_SECRET|LOVABLE_API_KEY|DEMO_\w+_PASSWORD)[ \t]*=[ \t]*[^\s#]+/m.test(text)) findings.push("example contains a secret value");
  return findings;
}

export function checkRelease() {
  const staged = process.argv.includes("--staged");
  const args = staged ? ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"] : ["ls-files", "--cached", "--others", "--exclude-standard", "-z"];
  const paths = [...new Set(execFileSync("git", args, { encoding: "utf8" }).split("\0").filter(Boolean))];
  let count = 0;
  const findings = [];
  for (const path of paths) {
    let text;
    if (staged) text = execFileSync("git", ["show", `:${path}`], { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
    else {
      try { if (!statSync(path).isFile()) continue; } catch (error) { if (error.code === "ENOENT") continue; throw error; }
      text = readFileSync(path, "utf8");
    }
    count++;
    for (const reason of findingsFor(path, text)) findings.push(`${path}: ${reason}`);
  }
  if (findings.length) {
    console.error(findings.join("\n"));
    process.exitCode = 1;
  } else console.log(`${count} release candidates checked; no private paths or known token patterns found. This is not a full security audit.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) checkRelease();

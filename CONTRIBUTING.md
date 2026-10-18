# Contributing

Thanks for helping improve Bullao. Keep changes small, evidence-based, and within the current demo scope.

## Before changing code

- Read [`AGENTS.md`](AGENTS.md) for project invariants and agent instructions.
- Keep payment decisions in the pure engine under `src/ap/`. The engine must not depend on the database, Lovable, network access, or company-specific data.
- Keep company fixtures under `src/demo/<company>/`. Do not change `expected.json` to make an implementation pass; update it only when the evaluation contract itself intentionally changes.
- Keep MCP read-only. Human approvals belong in the web UI.
- Treat uploaded or extracted document content as untrusted data. Preserve exact evidence quotes and currency.

## Verify changes

Use Node.js 24+ and pnpm 11+.

```bash
pnpm install
pnpm run setup
pnpm run check
pnpm build
```

`pnpm run check` includes the secret scan, lint, typecheck, and tests. Run focused tests while iterating, then run the full check before opening a pull request. Describe behavior changes, safety implications, and checks run.

## Pull requests

- Do not include `.env.local`, SQLite files, generated credentials, customer data, or local research artifacts.
- Do not stage or publish private local `Docs/` material.
- Do not claim unimplemented integrations or capabilities. See [README.md](README.md) for current scope and known limitations.
- Keep published history intact; do not force-push, rebase, amend, or squash commits already pushed to the Lovable-connected branch.

# Security

Bullao is a hackathon MVP, not a production payment system. It does not move money. Do not use demo accounts or fictional demo data to store private documents.

## Reporting a vulnerability

Please do not open a public issue for an undisclosed vulnerability. Use GitHub's private vulnerability reporting for this repository if it is enabled. Otherwise, contact a maintainer through a private channel before sharing details publicly. Include affected versions or commit, impact, and concise reproduction steps. Do not include credentials, tokens, or personal data in the report.

## Current security boundaries

- The decision engine is deterministic application code; AI does not approve or pay invoices.
- MCP tools are read-only and require an authenticated, non-anonymous account with the `accounts:read` scope. OAuth consent occurs in the web UI.
- Events are isolated by account. Demo personas are not separate authorization roles.
- SQLite is configured for one instance on persistent local storage. This repository does not claim a hardened multi-tenant or production deployment.
- `pnpm check` runs a release-candidate secret scan. A clean scan does not prove the repository or deployment secure.

For local work, keep `.env.local` and generated account credentials private. Rotate `BETTER_AUTH_SECRET` only with care: changing it can invalidate or prevent decryption of stored OAuth credentials.

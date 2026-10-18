# Bullao

**Less noise. Clearer accounts.** Bullao is an open-source accounts-payable review demo. It compares submitted invoice details with vendor agreements and rules, then shows what is ready, needs a person, or is blocked.

Bullao is a hackathon MVP with fictional Nodo Labs data. It does not move money. [MIT license](LICENSE) · [Guía en español](README.es.md)

## Quick start

Requires Node.js 24+ and pnpm 11+. The local demo uses SQLite and needs no Supabase, Docker, model, or external service.

```bash
pnpm install
pnpm run setup
pnpm dev
```

Open <http://localhost:8080> and choose **View the Nodo Labs demo**. `pnpm run setup` creates `.env.local` with a local auth secret if the file does not exist. Keep that file private.

## Try the demo

1. Open the inbox and choose **Review inbox** to process the 21 fictional documents.
2. Inspect the account statuses, evidence quotes, agreements, rules, and evaluation results.
3. Find Hosting Andes in October. Its USD 1,000 invoice exceeds the USD 800 agreement because the May extra was already used.
4. Choose **Approve this time only**. The exception applies to October only.
5. Open November's invoice. It asks for approval again. Updating the agreement to USD 1,000 from November affects November, not the recorded October decision.

Each signed-in account has its own event history over the same fictional fixture data. These demo accounts are task examples, not distinct authorization roles; all accounts have the same permissions.

## What works today

- A pure decision engine in `src/ap/` evaluates rules and agreements, validates cited evidence, and rebuilds state from append-only events.
- Demo data and expected results live in `src/demo/nodo-labs/`. Expected results are a fixed evaluation baseline, not a guarantee of real-world accuracy.
- The web app supports the fictional inbox and manual document entry by pasted text or XML (CFDI 4.0 and DIAN UBL readers).
- MCP is available at `/mcp`. Its tools read account data or preview a draft. A person grants OAuth consent in the web UI; anonymous demo sessions cannot connect.
- See [CONTRIBUTING.md](CONTRIBUTING.md) for code boundaries and verification. See [SECURITY.md](SECURITY.md) to report security issues.

## Limits and safety

- No live payments, bank access, accounting integrations, email/WhatsApp ingestion, or PDF upload/OCR.
- No Qdrant or Ollama. Optional `LOVABLE_API_KEY` supports extraction for pasted-text entry; it is not needed for fixtures or XML. The engine verifies extracted values against document quotes.
- No team roles or access-control policies beyond per-account data isolation. Demo accounts have equal permissions.
- The app creates `data/bullao.sqlite`. This local SQLite setup needs persistent local disk and one application instance; do not use it as-is for multi-instance deployment.
- MCP client interoperability beyond the locally verified OAuth/PKCE flow has not been tested. For remote use, deploy behind HTTPS and keep `BETTER_AUTH_SECRET` stable with the database.

The project follows one core rule: **AI reads; code decides; a person approves.** Documents are untrusted data, money stays in integer minor units with its ISO currency, and human approval is never an MCP action.

## Development checks

```bash
pnpm run check
pnpm build
```

`pnpm run check` runs the release-candidate secret scan, lint, typecheck, and tests. The scan is a guardrail, not a complete security audit. `pnpm start` serves the production build locally.

## Project map

```text
src/ap/                 Pure payment decision engine and tests
src/demo/nodo-labs/     Fictional company data and evaluation baseline
src/lib/mcp/            OAuth-scoped, read-only MCP tools
src/routes/             Web routes
src/server/             Auth, SQLite, and append-only event storage
```

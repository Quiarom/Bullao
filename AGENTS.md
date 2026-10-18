<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Payment decisions come only from the pure engine in `src/ap/` (a `Dataset` passed in + replay of the user's append-only `ap_events`); never let a model or MCP tool decide or approve. Why: "la IA lee, el código decide".
- `src/ap/` must not import Lovable, the database or any dataset; company data lives as JSON under `src/demo/<company>/`. Why: open-source reuse with other companies.
- Expected outcomes (`expected.json`) are written before implementation and never edited to make code pass. Why: honest evaluation.
- Guest (anonymous) sessions may use the web demo but never the MCP or OAuth consent. Why: external assistants act only as real accounts.
- MCP tools (`src/lib/mcp/`) are read-only and OAuth-scoped. The server derives the user from the verified token and filters SQLite events by that user; there is no Supabase RLS. Approvals exist only in the web UI.

- Accounts use one shared workspace with URL-selected detail; legacy inbox and detail URLs redirect there. Why: list, review and human approvals must stay together without duplicating logic.
- Document presentation uses existing parsed fields and literal amount evidence; raw XML stays available separately. Why: improve readability without altering extraction or payment decisions.

## Start here

- Read `README.md` (English) or `README.es.md`, then `PRODUCT.md` for confirmed scope. `CONTRIBUTING.md` defines checks; `SECURITY.md` defines boundaries and disclosure.
- Runtime: Node 24 and pnpm 11, pinned in `package.json`; `pnpm-lock.yaml` is the only lockfile. Run `pnpm install --frozen-lockfile`, `pnpm run setup`, then `pnpm dev`.
- Run `pnpm run check` before proposing a release. For staged content, also run `pnpm run security:check -- --staged`. Never claim a check passed without running it.
- Never stage or commit `Docs/`, environment files, SQLite files, local research, agent memories or credentials. `.env.example` contains names and blank secret values only. Do not rewrite pushed history to remove an old credential; coordinate rotation and history cleanup with the maintainer.
- `src/demo/dataset.ts` is the one explicit demo composition point used by UI, server and MCP. It selects Nodo Labs, not a real company or runtime tenant. Do not make the pure engine import it.
- `src/server/config.server.ts` owns the auth origin and secret; MCP must use that same origin. Never introduce a different issuer, secret fallback or hardcoded client token.
- Demo personas have the same permissions and isolated events, not different RBAC roles. The guest demo is web-only. Real accounts cannot reset their event history.
- Current inputs: pasted text and XML. PDF upload, OCR, Ollama, Qdrant and real accounting/payment integrations are not implemented. Do not advertise proposals as shipped features.
- External text extraction is optional and sends submitted text to the configured Lovable gateway. It is not needed for fixture review or XML; never silently enable it or log invoice text.
- Keep changes scoped. Avoid mass formatting of untouched code. ESLint checks semantics; format only files you edit. Generated `src/routeTree.gen.ts` is owned by TanStack Router.

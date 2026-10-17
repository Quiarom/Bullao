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
- MCP tools (`src/lib/mcp/`) are read-only and OAuth-scoped via RLS; approvals exist only in the web UI. Why: approvals must come from a person.

- Accounts use one shared workspace with URL-selected detail; legacy inbox and detail URLs redirect there. Why: list, review and human approvals must stay together without duplicating logic.
- Document presentation uses existing parsed fields and literal amount evidence; raw XML stays available separately. Why: improve readability without altering extraction or payment decisions.

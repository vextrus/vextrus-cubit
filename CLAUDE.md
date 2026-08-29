# VEXTRUS CUBIT — session notes

This file is maintained by the Vextrus Builder engine; the lessons section is rewritten after
merges. Do not edit it inside a build session.

## Commands that must be green
pnpm verify · pnpm test:db · pnpm e2e --journey <J> · pnpm checkup

## Law
- The Bible (docs/specs/cubit.bible.xml) is immutable in sessions: take the most defensible reading and record an Interpretation; a contradiction stops the increment with a named reason.
- A screen is implemented against its Design Decision in docs/design/<screen>.md — layout, every state, copy, motion, tokens. Deviations are graded as defects.
- Never delete a test or weaken a check to green a build; raise an Objection in the handoff.

<!-- builder:lessons:start -->
## Standing lessons (engine-maintained)
- A rollback-wrapped probe INSERT through cubit_app proves \"this scope may write, that one may not\" without polluting the store: Arbitration on that increment (2026-08-29) ruled that a policy posture asserted only from `pg_policy` text is unfalsifiable: widening a policy left every lane green. A live suite proves a write posture *behaviourally*, t
- jsonb re-orders object keys on the way in, so a document whose own key order a screen renders must be stored as json: The rule-set edition store (`ruleset_editions`, `tenant_ruleset_editions` in `src/core/db.ts`) holds `parameters`/`methods` as **`json`, not `jsonb`**. **Why:** `jsonb` normalises — it sorts object keys by (length, byte 
- Cross-repo memory writes are locked, not just this repo's: A build session twice tried to read/write another repo's memory file under its .claude path, and both attempts were denied — .claude/** is locked for every repo, not only the one the session is running in. The lawful pat
- A Verifier session may run pnpm e2e (unlike a grader) and should commit new toHaveScreenshot baselines with --update-snapshots=missing: Adding a `toHaveScreenshot` call to a journey without committing its baseline ships a false red (Playwright errors "A snapshot doesn't exist … writing actual"). In a Verifier session the whole journey lane is runnable — 
- When a locked journey spec fails mid-walk, serve the built app on the stage port against cubit_e2e and drive the rest of the walk with the mcp__stage__ tools: A Playwright journey that fails at line N never executes lines N+1…end, so every later assertion is unproven — and if the failure is in a locked acceptance file the Builder cannot amend, the only way to know the tail pas
- A held-out DXF that must get one entity rejected by L-CAD-05's 2nd–98th inter-percentile window needs ~50+ clustered neighbours, or the outlier IS the 98th percentile: L-CAD-05 rejects a stray when its bbox centre falls outside the 2nd–98th inter-percentile window widened by 25%. Acceptance that stages "one far-off entity gets rejected" fails if the drawing is small: with N entities of
- A migration's privilege scan splits the hand-written half on ';', so a comment above a GRANT that names UPDATE/DELETE fails the append-only assertion: cubit's per-migration acceptance (e.g. `db/__tests__/model-ledger.migration.test.ts`, 2026-08-28) proves "no privilege that writes a row away is granted" by splitting the hand-written half on `;` and, for each chunk cont
- cubit's shared live-suite seeder writes 'verifier-probe' into every required text column, so the first CHECK-closed column in the tree reds seam-tenant.live and act-immutability.live: `db/__tests__/support/live-sql.ts`'s `ensureRowsForTenants` → `ensureRowForTenant` builds a probe row from `requiredColumns()` (NOT NULL, no default, not generated) and `probeValue()`, which answers `'verifier-probe'` fo
- In cubit, core.css's .cx-btn is served after feature stylesheets, so a single-class rule on a DropdownMenuTrigger silently loses font-size/colour/height — name .cx-btn alongside: Every `DropdownMenuTrigger` renders with `cx("cx-btn", "cx-menu-trigger", "cx-reticle", className)`, so `.cx-btn` (core.css) applies to it: `font-family: var(--font-ui)`, `font-size: var(--text-14)`, `font-weight: var(--
- A minimal hand-written R12 DXF string is read by plain ezdxf.readfile, keeps its own group-5 handles, and a huge arc forces the flatten cap — validate it in a scratch uv venv: Proved 2026-08-28 while amending that increment's acceptance. Acceptance for `cad/` can carry a DXF as a **string constant in test support** rather than a committed fixture file — no new path for the structural fixture-g
<!-- builder:lessons:end -->

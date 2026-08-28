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
- A Verifier session may run pnpm e2e (unlike a grader) and should commit new toHaveScreenshot baselines with --update-snapshots=missing: Adding a `toHaveScreenshot` call to a journey without committing its baseline ships a false red (Playwright errors "A snapshot doesn't exist … writing actual"). In a Verifier session the whole journey lane is runnable — 
- When a locked journey spec fails mid-walk, serve the built app on the stage port against cubit_e2e and drive the rest of the walk with the mcp__stage__ tools: A Playwright journey that fails at line N never executes lines N+1…end, so every later assertion is unproven — and if the failure is in a locked acceptance file the Builder cannot amend, the only way to know the tail pas
- A held-out DXF that must get one entity rejected by L-CAD-05's 2nd–98th inter-percentile window needs ~50+ clustered neighbours, or the outlier IS the 98th percentile: L-CAD-05 rejects a stray when its bbox centre falls outside the 2nd–98th inter-percentile window widened by 25%. Acceptance that stages "one far-off entity gets rejected" fails if the drawing is small: with N entities of
- A migration's privilege scan splits the hand-written half on ';', so a comment above a GRANT that names UPDATE/DELETE fails the append-only assertion: cubit's per-migration acceptance (e.g. `db/__tests__/model-ledger.migration.test.ts`, 2026-08-28) proves "no privilege that writes a row away is granted" by splitting the hand-written half on `;` and, for each chunk cont
- cubit's shared live-suite seeder writes 'verifier-probe' into every required text column, so the first CHECK-closed column in the tree reds seam-tenant.live and act-immutability.live: `db/__tests__/support/live-sql.ts`'s `ensureRowsForTenants` → `ensureRowForTenant` builds a probe row from `requiredColumns()` (NOT NULL, no default, not generated) and `probeValue()`, which answers `'verifier-probe'` fo
- In cubit, core.css's .cx-btn is served after feature stylesheets, so a single-class rule on a DropdownMenuTrigger silently loses font-size/colour/height — name .cx-btn alongside: Every `DropdownMenuTrigger` renders with `cx("cx-btn", "cx-menu-trigger", "cx-reticle", className)`, so `.cx-btn` (core.css) applies to it: `font-family: var(--font-ui)`, `font-size: var(--text-14)`, `font-weight: var(--
- A minimal hand-written R12 DXF string is read by plain ezdxf.readfile, keeps its own group-5 handles, and a huge arc forces the flatten cap — validate it in a scratch uv venv: Proved 2026-08-28 while amending that increment's acceptance. Acceptance for `cad/` can carry a DXF as a **string constant in test support** rather than a committed fixture file — no new path for the structural fixture-g
- A settled TEST_AMENDED ruling can be recorded in settled_rulings while the locked acceptance file still carries the old assertion — the Builder's only move is the Objection: `mcp__builder__settled_rulings` records arbitration outcomes, including `TEST_AMENDED` rulings that name the exact repair. That record does **not** mean the repair is in the tree: on the shell increment (2026-08-29) the 
- An arbitration \"test\" named `reviewer:CATEGORY — …` is a review finding, not a file; the amendment can be a no-op on the acceptance set: An amend brief can name a node like `reviewer:CORRECTNESS — theme only resolves at document load (src/app/layout.tsx)`. That is a **reviewer finding**, not a test in `tests/` or `.builder-heldout/` — grepping the tree fo
- src/ui/tokens.test.ts AC-4 runs git status --porcelain over src/ui/fonts and src/ui/brand and asserts it is empty, so no session may add a vendored sibling asset: `src/ui/tokens.test.ts` (tokens increment, AC-4 "the vendored fonts and brand assets are consumed in place, never edited") shells out to `git status --porcelain -- src/ui/fonts src/ui/brand` and asserts the line list is 
<!-- builder:lessons:end -->

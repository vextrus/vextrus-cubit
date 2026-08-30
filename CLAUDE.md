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
- SNAPSHOT_REGENERATED reds the structural stage for any baseline png that shows as M against the base branch — including one a Verifier regenerated after arbitration: Seen on the model call ledger increment (2026-08-30). The gate's structural stage emits `SNAPSHOT_REGENERATED <path>: snapshot/baseline M without a baseline: commit` for **any** baseline whose bytes differ from the base 
- Drive cubit's shipped eslint.config.mjs from a held-out set with createRequire — and why new public lint acceptance goes in tests/lint/, not tests/toolchain/: Verified 2026-08-30 on that increment (the `cubit/no-model-outside-seam` seam ban). **Held-out mount, no literal imports.** The set is mounted outside the checkout, so `import { ESLint } from "eslint"` resolves from the 
- S-Audit's merged tests freeze \"neither panel's table exists\" — creating model_calls or jobs reds one db file (writable) and J-003's audit.spec.ts (locked): the audit surfaces increment merged two frozen-state assertions that the increment shipping `model_calls` (or `jobs`) inevitably reds: - `db/__tests__/audit-surfaces.live.test.ts` — a case asserting `tableExists(...)` is
- pkill -f \"next start\" in a Bash call matches the wrapper shell's own command line and kills the call (exit 144): `pkill -f "next start"` run as part of a Bash tool call matches the harness's own wrapper shell, whose full command line contains that literal string — so the call kills itself and returns exit 144 with empty output. On 
- The held-out mount transforms product .tsx and resolves @testing-library/* — a jsdom component proof needs no extra config, only a @vitest-environment docblock per file: Verified by dry-run probe on 2026-08-30 (that increment): from `.builder-heldout/`, mounted OUTSIDE the checkout, all of this works with the engine's stock `vitest.heldout.config.ts`: - `await productModule("src/ui/shell
- Once S-Design merged, any new src/ui barrel export reds six tests in pnpm verify until it has a gallery catalogue entry: After that increment (the living gallery) landed on main, every component a `src/ui` barrel publishes owes an entry in `src/ui/gallery-derivation/entries.tsx`. Adding one export without one reds six tests across three fi
- J-003's ruleset-pin screenshot used to capture a per-run random email unmasked; arbitration ruled it a V-E2E mis-encoding and it now masks three regions: `tests/e2e/journeys/j-003-projects.spec.ts` signs up as `j003-<random>@cubit.test` and compared the **whole page** at `ruleset-pin-visible.png` with **no mask**. It failed identically on two consecutive runs (5344 px, ra
- denied 5× on the density prefs increment: know the lawful path: Sessions on the density prefs increment were denied 5 times with: > the product's whole test runner would discover .builder-heldout/ inside the tree and recurse (gen-2 an earlier generation's run attempt 8). Use the tool
- Whole-suite test runs recurse into heldout fixtures: An attempt invoked the product's whole test runner while .builder-heldout/ fixtures sat inside the tree; the runner discovered and tried to recurse into them, tripping the write-boundary denial five times in a row before
- The structural stage's ADDED_AS_ANY scan matches the substring \"as any\" in prose, so an assertion message reading \"as any other X\" reds a whole gate attempt: The cubit gate's structural stage flags `ADDED_AS_ANY` on a plain substring match for `as any`, with no regard for whether it sits in code or in a string. On that increment (2026-08-30) the single red on an otherwise all
<!-- builder:lessons:end -->

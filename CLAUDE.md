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
- Once S-Design merged, any new src/ui barrel export reds six tests in pnpm verify until it has a gallery catalogue entry: After that increment (the living gallery) landed on main, every component a `src/ui` barrel publishes owes an entry in `src/ui/gallery-derivation/entries.tsx`. Adding one export without one reds six tests across three fi
- J-003's ruleset-pin screenshot used to capture a per-run random email unmasked; arbitration ruled it a V-E2E mis-encoding and it now masks three regions: `tests/e2e/journeys/j-003-projects.spec.ts` signs up as `j003-<random>@cubit.test` and compared the **whole page** at `ruleset-pin-visible.png` with **no mask**. It failed identically on two consecutive runs (5344 px, ra
- denied 5× on the density prefs increment: know the lawful path: Sessions on the density prefs increment were denied 5 times with: > the product's whole test runner would discover .builder-heldout/ inside the tree and recurse (gen-2 an earlier generation's run attempt 8). Use the tool
- Whole-suite test runs recurse into heldout fixtures: An attempt invoked the product's whole test runner while .builder-heldout/ fixtures sat inside the tree; the runner discovered and tried to recurse into them, tripping the write-boundary denial five times in a row before
- The structural stage's ADDED_AS_ANY scan matches the substring \"as any\" in prose, so an assertion message reading \"as any other X\" reds a whole gate attempt: The cubit gate's structural stage flags `ADDED_AS_ANY` on a plain substring match for `as any`, with no regard for whether it sits in code or in a string. On that increment (2026-08-30) the single red on an otherwise all
- cubit's errorFormatter replaces error.data, so METHOD_NOT_SUPPORTED never appears — read a procedure's query/mutation type off appRouter._def.procedures[path]._def.type instead: An acceptance file that drives a procedure through the shipped route handler cannot discover whether it is a query or a mutation from the wire. `src/server/trpc.ts`'s `errorFormatter` rewrites the envelope: `error.data` 
- A next start left listening on $PORT makes pnpm verify's checkup lane fail with \"ports 3210:busy\": `scripts/checkup.mjs` reports `ports 3210:busy 3211:free — FAIL`, and `tests/toolchain/checkup.test.ts` asserts `pnpm checkup` exits 0 — so a staging server left running on `$PORT` reds two unit tests in `pnpm verify` th
- A src/ui/strings module table must be exported under its file's basename, so a hyphenated filename needs a string-named export: `tests/ui/strings.test.ts` reads each `src/ui/strings/<name>.ts` and asserts `loaded[<name>]` is a record of non-empty strings — the DESIGNATED export is the file's basename verbatim, not its camelCase. A Design Decision
- Run a single db/__tests__ acceptance file without the recursion hazard: pnpm exec vitest run --root db/__tests__ <name-filter>: `pnpm vitest run db/__tests__/<file>.test.ts` collects nothing (the root config's include is `tests/**` + `src/**`), and naming `--config db/__tests__/vitest.config.ts` from the repo root makes that config's `**/*.test.t
- A gallery entry's render() is called outside a renderer, so a stateful sample throws and the component must appear as a literal element: `tests/ui/s-design/gallery-derivation.test.ts` calls `state.render()` directly (no React renderer), so any sample that calls `useState` dies with "Cannot read properties of null (reading 'useState')". Its `rendersCompone
<!-- builder:lessons:end -->

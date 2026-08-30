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
- The structural stage's ADDED_AS_ANY scan matches the substring \"as any\" in prose, so an assertion message reading \"as any other X\" reds a whole gate attempt: The cubit gate's structural stage flags `ADDED_AS_ANY` on a plain substring match for `as any`, with no regard for whether it sits in code or in a string. On that increment (2026-08-30) the single red on an otherwise all
- cubit's errorFormatter replaces error.data, so METHOD_NOT_SUPPORTED never appears — read a procedure's query/mutation type off appRouter._def.procedures[path]._def.type instead: An acceptance file that drives a procedure through the shipped route handler cannot discover whether it is a query or a mutation from the wire. `src/server/trpc.ts`'s `errorFormatter` rewrites the envelope: `error.data` 
- A next start left listening on $PORT makes pnpm verify's checkup lane fail with \"ports 3210:busy\": `scripts/checkup.mjs` reports `ports 3210:busy 3211:free — FAIL`, and `tests/toolchain/checkup.test.ts` asserts `pnpm checkup` exits 0 — so a staging server left running on `$PORT` reds two unit tests in `pnpm verify` th
- A src/ui/strings module table must be exported under its file's basename, so a hyphenated filename needs a string-named export: `tests/ui/strings.test.ts` reads each `src/ui/strings/<name>.ts` and asserts `loaded[<name>]` is a record of non-empty strings — the DESIGNATED export is the file's basename verbatim, not its camelCase. A Design Decision
- Run a single db/__tests__ acceptance file without the recursion hazard: pnpm exec vitest run --root db/__tests__ <name-filter>: `pnpm vitest run db/__tests__/<file>.test.ts` collects nothing (the root config's include is `tests/**` + `src/**`), and naming `--config db/__tests__/vitest.config.ts` from the repo root makes that config's `**/*.test.t
- A gallery entry's render() is called outside a renderer, so a stateful sample throws and the component must appear as a literal element: `tests/ui/s-design/gallery-derivation.test.ts` calls `state.render()` directly (no React renderer), so any sample that calls `useState` dies with "Cannot read properties of null (reading 'useState')". Its `rendersCompone
- B-20's re-baseline proof has two halves — a negative sha256 pin plus a real toHaveScreenshot — and the second half can run from a journey that does not own the screen by re-enrolling the baselined spec's fixed identity: Arbitrated on the projects increment (2026-08-30). A sha256 `not.toBe` against the pre-increment bytes proves only that regeneration *happened*; a truncated file, a re-encode or a capture of the wrong viewport satisfies 
- shell-settings-name holds only label, hint, notice and button — the workspace name lives in the Input's value, so toContainText over that section can never see it: `src/app/(app)/t/[tenant]/settings/rename-form.tsx` renders `<section data-testid="shell-settings-name">` containing exactly: the `shell_settings_name_label` label, the `shell_settings_name_hint` hint, the core `Input` (
- Reverting a locked migration edit doesn't un-stale the snapshot: A plan touched a locked migration file; the hook denied the write, but the file had already been touched once and reverted, leaving the schema snapshot out of sync with the locked source. The structural gate then fired S
- Q-11's \"never widened to any-impact\" must be read in comparison/membership position inside the axe-taint chain, never as a whole-source substring ban: Arbitration struck the same acceptance shape twice on that increment (2026-08-29): a negative substring scan over the concatenated journey spec + page object asserting the words "minor"/"moderate" appear nowhere in any q
<!-- builder:lessons:end -->

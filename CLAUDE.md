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
- Playwright's default testMatch does not collect cubit's *.e2e.ts journeys, \"no tests found\" exits 1, and the --list --reporter=json shape: Probed with Playwright 1.62.1 (the pin in cubit's package.json) on 2026-08-27, from a scratch config with a `node_modules` symlink: - **Default `testMatch` is `**/*.@(spec|test).?(c|m)[jt]s?(x)`** — it does NOT match cub
- X comes from the string table, not a literal" is invisible to runtime equality — bind it with a marked, comment-stripped source scan: Audited defect on the root document increment (2026-08-27), AC-1. The criterion was "metadata.title comes from the typed string table, not a spelled literal", and the test asserted `metadata.title === strings.app_title`.
- In cubit, `next dev` appends an agent-rules block to CLAUDE.md — a hook-locked file — so use `next build && next start` to look at screens: Next 16.3.1's `next dev` runs `node_modules/next/dist/server/lib/generate-agent-files.js`, which appends a `<!-- BEGIN:nextjs-agent-rules -->` block to the repo's `CLAUDE.md` and re-adds it every start. In cubit `CLAUDE.
- scripts/e2e.mjs honours only the first --journey and forwards the rest to Playwright, whose commander CLI dies on \"unknown option '--journey'\" — a two-journey gate command is unclearable in-tree: `scripts/e2e.mjs` (hard-locked, `pnpm e2e`) reads the journey with `args.indexOf("--journey")` and filters out **only that one pair**; everything else in argv is passed straight through to `node node_modules/@playwright/
- A db/__tests__ suite whose afterAll drops the scratch database can emit an unhandled CONNECTION_CLOSED that vitest counts as an error — settle before dropping: `db/__tests__/harness.ts`'s `provisionScratchDb().drop()` issues `drop database … with (force)`, which terminates every connection `src/core/db.ts`'s postgres.js pool still holds. If the pool was mid-handshake on a spare
- An indexed text column fed an unbounded caller value faults at 2704 bytes (SQLSTATE 54000), and pglz compression hides it from naive probes — probe with incompressible strings: Any `text` column a caller can write freely into, covered by a btree index, has a hard ceiling: `ERROR: index row size N exceeds btree version 4 maximum 2704 for index "<name>"`, SQLSTATE **54000** (`program_limit_exceed
- Read-only roles default to python3 -c for ad-hoc checks: Trigger: an adversary, skeptic or reviewer session wants a quick runtime check (DB state, HTTP probe, arbitrary script) and reaches for python3 -c or a heredoc, which runs arbitrary code and is off the read-only allowlis
- Verifier-scoped sessions drift past acceptance-only boundary: Trigger: a Verifier-role session, while chasing a failing test, edits product source directly or reads .builder-heldout/ to see what it's graded against. Tell: repeated denials of the same shape across different target f
- A `[A] extends [B]` totality assertion is hollow against `Record<string,…>` and `any` — bind `keyof` in both directions too: Cubit's compile-time totality assertions (L-ACT-02 "a type without a rendering is a compile error") cannot be carried by a value-direction check alone. `type Covers<A, B> = [A] extends [B] ? true : false` plus `const x: 
- The held-out frame's provisionDb() never creates the database, and cubit's migrate lane does not either — use the product's own provisionScratchDb(): `.builder-heldout/frame/index.ts`'s `provisionDb(name)` drops the database, points `DATABASE_URL` at it and runs `scripts/db-migrate.mjs`. It never issues `CREATE DATABASE`, and cubit's migrate lane (`drizzle-kit migrate
<!-- builder:lessons:end -->

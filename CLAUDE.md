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
- A `[A] extends [B]` totality assertion is hollow against `Record<string,…>` and `any` — bind `keyof` in both directions too: Cubit's compile-time totality assertions (L-ACT-02 "a type without a rendering is a compile error") cannot be carried by a value-direction check alone. `type Covers<A, B> = [A] extends [B] ? true : false` plus `const x: 
- The held-out frame's provisionDb() never creates the database, and cubit's migrate lane does not either — use the product's own provisionScratchDb(): `.builder-heldout/frame/index.ts`'s `provisionDb(name)` drops the database, points `DATABASE_URL` at it and runs `scripts/db-migrate.mjs`. It never issues `CREATE DATABASE`, and cubit's migrate lane (`drizzle-kit migrate
- Owner-proof append-only tables under FORCE RLS in cubit — FK checks bypass policies, TRUNCATE must be tested on all referenced tables at once, and the snapshot purity regex is \\bgrant\\b: Verified on the act-seam increment (2026-08-26), building `acts` / `participants` / `participant_roles` with FORCE RLS plus owner-proof immutability triggers: - **Composite FKs still work under FORCE ROW LEVEL SECURITY.*
- In cubit a drizzle constraint violation reaches the caller as an unmarked fault — refusalCodeOf returns null — so a seam that leans on a DB constraint gives the user a faultId, not an answer: Verified live on that increment (2026-08-26). When a write inside a seam trips a Postgres constraint, drizzle's `DrizzleQueryError` reaches the caller as: ``` name: "Error", refusalCode: absent, cause.code: "23505" | "23
- denied 4× on the act seam increment: know the lawful path: Sessions on the act seam increment were denied 4 times with: > the held-out set is the Verifier's: never read from a build or grading session (§4.3) The lawful path is in the denial's own words — follow it instead of ret
- A whole-tree test runner recursing into the held-out set: When an increment's tests live near .builder-heldout/, a repo-wide test runner will discover and try to execute files inside it, and the session then reaches for reading, moving, or deleting inside .builder-heldout to ma
- The held-out mount DOES import product .ts modules outside its vite root — a scratch probe that says otherwise needs server.fs.allow [\"/\"]: Verified on that increment (2026-08-26), both directions: - **The real mount is fine.** `productModule("src/ui/primitives/overlay/index.ts")` — an existing `.ts` barrel with CSS imports, living in `/tmp/builder-heldout-*
- cubit's no-raw-intl lint flags String.prototype.localeCompare anywhere in the tree, tests included — sort by code point instead: In cubit, `cubit/no-raw-intl` is bound to `**/*.{ts,tsx,mts,mjs,js}` (not just `src/`), and it reads `localeCompare` as a call into the platform's locale machinery: "src/core/format.ts is the tree's sole caller of Intl; 
- How to make \"this prop is required by the component's type\" a real cubit assertion — a conditional type in a .ts (never .tsx) acceptance file: A criterion like "the evidence prop is required by the component's type" (that increment AC-4) is invisible to any runtime render. Make `tsc` the runner: ```ts import * as React from "react"; import type { RefusalState a
- Intl's en-IN/en-GB short month for September is \"Sept\" (ICU 78), so DD MMM YYYY month names are pinned as data in BD_DOCUMENT: Under Node 24 (ICU 78) `new Intl.DateTimeFormat("en-IN", { month: "short" })` renders September as **"Sept"**, not "Sep" — same for `en-GB`. Cubit's L-FMT-01 date format is `DD MMM YYYY` with English three-letter months,
<!-- builder:lessons:end -->

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
- A .builder-heldout/tsconfig.json that extends ../tsconfig.json makes the whole set fail to transform at the mount — zero tests, not a failing claim.: Checked 2026-08-24 (Vitest 4.1.11 / Vite 8, oxc transform). At gate time `.builder-heldout/` is mounted as `/tmp/builder-heldout-<id>/heldout` beside `../repo`, so `"extends": "../tsconfig.json"` resolves to nothing. Vit
- How a db/__tests__ suite mints a real signed-in session against a served cubit build with plain fetch — no browser: Server-rendered acceptance (test ids, `aria-current`, breadcrumbs, empty-state copy) can be read straight out of the HTML a `next start` sends, so a claim about the shell needs no Playwright — it needs a session cookie. 
- A plain constant imported from a 'use client' module into a Server Component is a client reference, not the value — the prop arrives undefined.: Next 16 App Router: every export of a `'use client'` module reaches a Server Component as a *client reference*, not as the value. A discriminator object exported beside the component — ```ts // auth-screen.tsx ('use clie
- `next build` with a NEXT_DIST_DIR the checkout's tsconfig does not already list appends `<distDir>/types/**` and reformats the whole file — dirtying a locked tsconfig.json.: Checked 2026-08-23, Next 16.3.1 / Turbopack. A held-out harness built the checkout with `NEXT_DIST_DIR=.scratch/next-heldout-auth` (gitignored, so it looked safe). Next appended `.scratch/next-heldout-auth/types/**/*.ts`
- db/migrations/meta/_journal.json is hook-locked as \"a landed migration\", so a second migration can never be registered from a build session — the sweep reverts it.: `mcp__builder__ownership_check` and the write hook both answer `never edit a landed migration — supersede it (db/migrations/meta/_journal.json)` for drizzle's journal, even when the increment spec's Ownership names `db/m
- An axe scan run the instant an element becomes visible reads its colour mid-fade and reports color-contrast on a defect nobody can see.: `await expect(alert).toBeVisible()` resolves on the *first* rendered frame. If the element arrives with a `--motion-state-duration` fade (S-Auth §11: the auth-error line, the notice swap, the refusal block), `expectNoAxe
- How better-auth 1.7.1 can be wired to the SEAM-TENANT handle without tripping cubit/db-seam-only, and the exact table shape its adapter expects.: Wiring better-auth 1.7.1 (inc-008-auth, 2026-08-23) into cubit without a lint denial: - `cubit/db-seam-only` binds to every `src/**/*.ts`, so `src/server/auth.ts` may NOT import `pg`, `drizzle-orm`, or `db/schema`. `bett
- AC-2 gate red repeated 7× unchanged: The same AC-2 signature (spine tables, createUserWithPersonalTenant, one-transaction mint) gate-reded identically across multiple test_db and acceptance_public runs within inc-008, with 4 attempts total and only the last
- Verifier touched product source twice: Two denials fired for the same rule: the Verifier writes acceptance only — tests, test support, fixtures and .builder-heldout/ — never product source. It happened once against a $M path and once against a MEMORY path, me
- Stage serves the product itself — never hand-serve the app, and treat an unreachable app as the engine's fault to report.: History: while `pnpm dev`/`start` were stubs AND the engine could not detect that, sessions learned to run `npx next build && npx next start -p 3210` by hand and to inject axe-core from `.pnpm` by absolute path. Both wor
<!-- builder:lessons:end -->

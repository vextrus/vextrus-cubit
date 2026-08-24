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
- heldout_dryrun classifies a set where EVERY test fails as HELDOUT_MOUNT_UNRESOLVED — 'the suite did not run' — even when each failure is an honest missing-feature red.: Measured on inc-015 (2026-08-24), same set, three consecutive dry runs: - 9 failed / 2 passed → "9 of 11 assertion(s) failed — **the red you want**", areas = the suite's name; - 11 failed / 0 passed → "**THE SUITE DID NO
- A held-out suite gets a signed-in chromium against a served cubit build in ~14s: seed.mjs for the roster, POST /api/auth/sign-in/email for the cookie, context.addCookies to wear it.: Measured 2026-08-24 (inc-015 dry runs): provision + migrate + `scripts/seed.mjs` + `next build` (warm `.next-e2e`) + `next start` + chromium + 11 tests ran in **14 seconds** end to end. The fixture path that makes it che
- Founder chose \"The Total Station\" (Lane B) as the new Datum v2 design direction on 2026-08-24; canvas URL and the Bible amendments it implies.: On 2026-08-24 the founder judged the current Datum design system "AI slop" and, from three lanes designed on a canvas, chose **Lane B — The Total Station** for both the CUBIT product and the VEXTRUS brand: graphite surfa
- A production Next build renames ScopedPool, so drizzle stops pinning the connection and every transaction silently splits — dev and vitest never see it.: drizzle 0.45's node-postgres session decides whether to borrow one connection for a transaction with `this.client instanceof Pool || Object.getPrototypeOf(this.client).constructor.name.includes("Pool")`. `ScopedPool` (sr
- A modal at its own URL must close with router.back(), or shell.spec's Projects→Books→Settings back-walk finds an extra history entry.: `tests/e2e/shell.spec.ts`'s R-UI-031 claim walks Projects → Books → Settings and then presses back three times, expecting exactly those three addresses. A route-driven dialog (`/t/{slug}/projects/new` = the projects area
- A held-out suite launches chromium via `@playwright/test`, not `playwright-core` — only direct deps sit at the top of the pnpm store.: Checked 2026-08-24 (inc-014). A held-out suite that drives a real browser must import the launcher as: ```ts const { chromium } = await import('@playwright/test'); import type { Browser, BrowserContext, Page } from '@pla
- Engine state directory is not readable from a product worktree: The session issued three separate Read attempts against /home/riz/vextrus-builder/state/e... during inc-014, each denied by the same rule: state is the engine's own, not the product's (§10) — work in your worktree only. 
- A regex/line-filter \"sole writer\" scan goes green while the clause is violated — close the table bindings over every import/re-export edge instead, and invert the self-check.: Arbitrated on 2026-08-24 (inc-013, `db/__tests__/inc-013-act-seam.test.ts:735`): a scan proving L-ACT-01's "sole writer … unimportable elsewhere" by matching raw-SQL text plus `fullSchema.x` / `import {x} from db/schema`
- ctx.db.transaction() IS safe in cubit — ScopedPool pins and scopes it — so a lock-then-read-then-CTE transaction is available despite the \"seam transaction pitfall\" lesson.: The standing lesson [[cubit-seam-transaction-pitfall]] ("drizzle pins a connection only if the client's class name contains Pool") reads as *never use handle.transaction*. That is no longer the situation: `src/core/db.ts
- inc-012's 'exactly one platform seed' assertion races the probe registry — a new project-dependent probe flips it red.: `db/__tests__/inc-012-rulesets-immutability.test.ts:262` asserts the platform namespace (`scope='platform' and tenant_id is null`) holds **exactly one** row. But `db/__tests__/probes/rulesets.ts` unconditionally mints a 
<!-- builder:lessons:end -->

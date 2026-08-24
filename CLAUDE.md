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
- Founder chose \"The Total Station\" (Lane B) as the new Datum v2 design direction on 2026-08-24; canvas URL and the Bible amendments it implies.: On 2026-08-24 the founder judged the current Datum design system "AI slop" and, from three lanes designed on a canvas, chose **Lane B — The Total Station** for both the CUBIT product and the VEXTRUS brand: graphite surfa
- A production Next build renames ScopedPool, so drizzle stops pinning the connection and every transaction silently splits — dev and vitest never see it.: drizzle 0.45's node-postgres session decides whether to borrow one connection for a transaction with `this.client instanceof Pool || Object.getPrototypeOf(this.client).constructor.name.includes("Pool")`. `ScopedPool` (sr
- A modal at its own URL must close with router.back(), or shell.spec's Projects→Books→Settings back-walk finds an extra history entry.: `tests/e2e/shell.spec.ts`'s R-UI-031 claim walks Projects → Books → Settings and then presses back three times, expecting exactly those three addresses. A route-driven dialog (`/t/{slug}/projects/new` = the projects area
- A held-out suite launches chromium via `@playwright/test`, not `playwright-core` — only direct deps sit at the top of the pnpm store.: Checked 2026-08-24 (inc-014). A held-out suite that drives a real browser must import the launcher as: ```ts const { chromium } = await import('@playwright/test'); import type { Browser, BrowserContext, Page } from '@pla
- Engine state directory is not readable from a product worktree: The session issued three separate Read attempts against /home/riz/vextrus-builder/state/e... during inc-014, each denied by the same rule: state is the engine's own, not the product's (§10) — work in your worktree only. 
- A regex/line-filter \"sole writer\" scan goes green while the clause is violated — close the table bindings over every import/re-export edge instead, and invert the self-check.: Arbitrated on 2026-08-24 (inc-013, `db/__tests__/inc-013-act-seam.test.ts:735`): a scan proving L-ACT-01's "sole writer … unimportable elsewhere" by matching raw-SQL text plus `fullSchema.x` / `import {x} from db/schema`
- ctx.db.transaction() IS safe in cubit — ScopedPool pins and scopes it — so a lock-then-read-then-CTE transaction is available despite the \"seam transaction pitfall\" lesson.: The standing lesson [[cubit-seam-transaction-pitfall]] ("drizzle pins a connection only if the client's class name contains Pool") reads as *never use handle.transaction*. That is no longer the situation: `src/core/db.ts
- inc-012's 'exactly one platform seed' assertion races the probe registry — a new project-dependent probe flips it red.: `db/__tests__/inc-012-rulesets-immutability.test.ts:262` asserts the platform namespace (`scope='platform' and tenant_id is null`) holds **exactly one** row. But `db/__tests__/probes/rulesets.ts` unconditionally mints a 
- Locked test disputes go through Objection, not deletion: The session was denied for editing a Verifier-locked acceptance test and, separately, for deleting/renaming an unrelated test (zz-probe-uuid) apparently to force a green run — both denials point to the same lawful path: 
- Held-out boundary probed three times in one increment: The build session touched the held-out boundary three separate times: twice denied for reading/touching .builder-heldout/ or the heldout acceptance path, once for the product test runner recursing into .builder-heldout/.
<!-- builder:lessons:end -->

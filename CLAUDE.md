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
- A regex/line-filter \"sole writer\" scan goes green while the clause is violated — close the table bindings over every import/re-export edge instead, and invert the self-check.: Arbitrated on 2026-08-24 (inc-013, `db/__tests__/inc-013-act-seam.test.ts:735`): a scan proving L-ACT-01's "sole writer … unimportable elsewhere" by matching raw-SQL text plus `fullSchema.x` / `import {x} from db/schema`
- ctx.db.transaction() IS safe in cubit — ScopedPool pins and scopes it — so a lock-then-read-then-CTE transaction is available despite the \"seam transaction pitfall\" lesson.: The standing lesson [[cubit-seam-transaction-pitfall]] ("drizzle pins a connection only if the client's class name contains Pool") reads as *never use handle.transaction*. That is no longer the situation: `src/core/db.ts
- inc-012's 'exactly one platform seed' assertion races the probe registry — a new project-dependent probe flips it red.: `db/__tests__/inc-012-rulesets-immutability.test.ts:262` asserts the platform namespace (`scope='platform' and tenant_id is null`) holds **exactly one** row. But `db/__tests__/probes/rulesets.ts` unconditionally mints a 
- Locked test disputes go through Objection, not deletion: The session was denied for editing a Verifier-locked acceptance test and, separately, for deleting/renaming an unrelated test (zz-probe-uuid) apparently to force a green run — both denials point to the same lawful path: 
- Held-out boundary probed three times in one increment: The build session touched the held-out boundary three separate times: twice denied for reading/touching .builder-heldout/ or the heldout acceptance path, once for the product test runner recursing into .builder-heldout/.
- A read-only pane taller than the viewport makes axe flag .shell-main serious (scrollable-region-focusable), because the shell's scroll container then holds nothing focusable.: Checked 2026-08-24 on `/t/{slug}/p/{id}/settings/ruleset` (inc-012). `.shell-main` carries `overflow-y: auto` (src/ui/shell/shell.css). Any area whose content overflows it and that mints no control at all — a purely read
- The held-out mount CAN build and serve cubit — real node_modules, NEXT_DIST_DIR=.next-e2e leaves git clean, and only db-migrate.mjs can make a database there.: Probed 2026-08-24 from inside a `heldout_dryrun` (inc-012). The mount is `/tmp/builder-heldout-<id>/heldout` beside `/tmp/builder-heldout-<id>/repo`, and in the repo: - `BUILDER_REPO_ROOT` = the checkout, `cwd` = the che
- State is the engine's own, not the product's: A session in inc-012 tried three times to read /home/riz/vextrus-builder/state/... from within a worktree session, each time denied with the same rule: state is the engine's own, not the product's (§10) — work in your wo
- A real signed-in session (and any route claim) in-process — call the exported route handler with a constructed Request; no next build, no next start, no fetch.: A Next route handler is just `(req: Request, ctx) => Promise<Response>`. Under vitest, importing `src/app/api/**/route.ts` by an absolute path and calling its `GET`/`POST` exercises the real product path with no server a
- Q-07's orphan half flags any SCREAMING_SNAKE string literal under src/ that the closed taxonomy does not carry — including tRPC's NOT_FOUND transport code.: `src/core/__tests__/refusal-register.test.ts` collects every string literal in `src/**` (excluding `src/core/errors/` and `__tests__`) matching `/^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/` and calls one the register does not carry 
<!-- builder:lessons:end -->

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
- next-env.d.ts's generated `import \"./.next-cubit/types/*.d.ts\"` lines do NOT break tsc on a clean checkout — verified with a control probe: In the cubit tree, `npx tsc --noEmit --incremental false` exits 0 with `.next-cubit/` absent even though `next-env.d.ts` carries `import "./.next-cubit/types/routes.d.ts"` and `import "./.next-cubit/types/root-params.d.t
- the fault seam's one-record-per-failure memo must be keyed on (error, requestId, route), not on the error object: In cubit's `src/server/trpc.ts`, `onError` and the errorFormatter both see the same failure, and B-21 wants exactly one `FaultRecord` per failure. They are **not** in the same synchronous tick: tRPC calls `onError` insid
- creating src/app arms checkup's storage-root lane, so storage/.gitkeep is required for pnpm verify even though no increment owns storage/: In cubit, `scripts/lib/lanes.mjs` arms the machine check `storage-root` as soon as `src/app` exists, and `scripts/checkup.mjs` fails it unless `$STORAGE_ROOT` (default `<repo>/storage`) is a writable directory. `tests/to
- Prove a held-out set is red for a missing-feature reason by pointing BUILDER_REPO_ROOT at an empty dir — and how to run the set locally: `mcp__builder__heldout_dryrun` mounts the set against the **current checkout**, so on a tree that already implements the increment (an amend round, or a re-run after the Builder passed) it reports `0 of N failed: the set
- vitest can instantiate one product module twice under racing concurrent imports, so module-scope singletons (fault memo, fault sink) must live on a globalThis symbol: A module-scope `const` is NOT a process singleton under vitest. When two importers race the same first import — e.g. `Promise.all([import(trpc.ts), import(root.ts)])`, where root.ts also imports trpc.ts, which is exactly
- Q-17 bans \"a later increment adds X\" comments in src/, not just increment ids — the lint does not catch them, reviewers do: Cubit's Q-17 reads: *"process artifacts (increment ids, build-organisation narration) never appear in `src/` comments — comments cite Bible ids."* The natural Builder habit of writing forward-looking scope notes — `// th
- Reviewer keeps reinventing test execution instead of using the allowlisted form: Across this increment the reviewer/skeptic hit the read-only Bash denial 8 times trying to run tests: via `node node_modules/.bin/vitest run ...`, `node -p`, `node --experimental-strip-types`, and even `git clone` + `mkd
- Sessions keep reaching into the engine's own state directory: Three denials fired for 'state is the engine's own, not the product's (§10) — work in your worktree only', targeting reads/writes under state/engine paths from inside a product session. This is a §10 boundary the session
- A cubit test under src/ may not spell a hex/rgba/named colour — read R-UI-001's founder table out of the Bible CDATA instead: `cubit/no-colour-literal` (scripts/eslint/rules/no-colour-literal.mjs) scans the whole *text* of every `**/*.{ts,tsx,mts,mjs,js}` and `**/*.css` file and allowlists exactly two paths — `src/ui/tokens.ts` and `src/ui/toke
- cubit/no-db-outside-seam binds **/*.ts tree-wide, so db/__tests__ must reach Postgres through psql; and `vitest run --dir db` collects nothing under the root config: Two things bite every live-database suite in cubit, both verified on the db-seam increment (2026-08-25). **1. The live V-DB suite may not import a driver.** `cubit/no-db-outside-seam` is bound in `eslint.config.mjs` to `
<!-- builder:lessons:end -->

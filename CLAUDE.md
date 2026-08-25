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
- Per-table cross-tenant INSERT proofs need an own-tenant control, and on a table whose PK is tenant_id that control legitimately answers 23505, not success: Writing the per-table cross-tenant write proofs for SEAM-TENANT (inc-001-db-seam, 2026-08-25): a cross-tenant `INSERT ... 42501` assertion is vacuous on its own — the same SQLSTATE is what a *missing grant* produces. Pai
- How to install a spec-declared npm package offline when the pnpm v10 store lacks its tarball but a copy exists elsewhere on the machine: Build sessions have no network ([[no-network-in-build-sessions]]), and `pnpm add --offline <pkg>` fails with `ERR_PNPM_NO_OFFLINE_TARBALL` when the v10 store has no index entry — even if another project on the machine al
- Why package.json's test:db must inject --config conditionally — the gate runs both plain `pnpm test:db` and a form that already passes --config: The cubit gate invokes the database lane two ways: plain `pnpm test:db` (gate stage 4, gate.yml, CLAUDE.md) and `pnpm test:db --config db/__tests__/vitest.config.ts <files>` (the public acceptance command). `scripts/db-t
- drizzle-kit 0.31.10 `generate` exits 0 when it fails, so a drift lane that infers \"no drift\" from an absent .sql is green over real drift: `node node_modules/drizzle-kit/bin.cjs generate ...` (drizzle-kit 0.31.10) prints a stack trace and **still exits 0** in at least two situations, both of which are real schema drift: - a **renamed column or table** — the
- heldout_dryrun reports \"THE SUITE DID NOT RUN — a defect in your set\" when a throwing beforeAll leaves tests skipped; stage lazily instead: `mcp__builder__heldout_dryrun` classifies a set by its *failed* count, not its exit code. A `beforeAll` that throws (the normal shape when the product module it stages does not exist yet) makes vitest mark every test in 
- which cubit paths a Builder may actually write — scripts/** and package.json's scripts block are hard-locked even when package.json is in the increment's ownership: `mcp__builder__ownership_check` answers in three grades, and the grades matter more than the ownership list in the spec (checked 2026-08-25): - **Hard NO** — `scripts/**` ("toolchain scripts are locked unless the increme
- cubit/no-db-outside-seam binds **/*.ts tree-wide, so db/__tests__ must reach Postgres through psql; and `vitest run --dir db` collects nothing under the root config: Two things bite every live-database suite in cubit, both verified on inc-001-db-seam (2026-08-25). **1. The live V-DB suite may not import a driver.** `cubit/no-db-outside-seam` is bound in `eslint.config.mjs` to `["**/*
- the cubit dev cluster at 127.0.0.1:5544 is scram-only, so checkup's passwordless fallback URL needs ~/.pgpass while drizzle-kit/postgres.js need credentials in DATABASE_URL: The native Postgres 16 the build machine offers (`127.0.0.1:5544`) authenticates every TCP connection with `scram-sha-256` (`pg_hba_file_rules`: `host all all 127.0.0.1 scram-sha-256`; only the unix socket is `peer`). Th
- cubit's `scripts/db-drift.mjs --scratch` can never report \"no drift\" as written — drizzle-kit CLI mode plus an empty scratch out dir; the verified three-part fix: `pnpm verify`'s schema-drift lane runs `node scripts/db-drift.mjs --scratch`, which runs `drizzle-kit generate --out <mkdtemp dir>` and fails if any `.sql` appears. As written it cannot go green once `db/schema.ts` exist
- rm -rf is never lawful outside scratch: Builder sessions hit the rm -rf denial 7 times in this one increment. The lawful path, in the hook's own words, is scratch under /tmp or $TMPDIR — mcp__builder__scratch_dir answers with a guaranteed-writable path for exa
<!-- builder:lessons:end -->

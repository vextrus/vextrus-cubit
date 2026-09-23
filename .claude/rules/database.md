---
paths:
  - "db/**"
  - "src/core/db/**"
  - "src/core/db.ts"
  - "scripts/db-*.mjs"
  - "scripts/lib/db-passes.mjs"
  - "scripts/lib/pg-*.mjs"
---
# Database law

- History is append-only: a landed migration is superseded by the next-numbered one, never edited
  (the guard refuses the edit). The schema is split per area (`src/core/db/schema-<area>.ts`), assembled
  by enumeration; RLS, grants and triggers are hand-written SQL appended to generated migrations.
- `pnpm test:db` copies one migrated template per test file over the pooled connection. Never a psql of
  your own beside it, and never beside a served product: the lane refuses while 3210/3211/3213 is held.
- **The drift lock**: a test that mutates tracked source holds only the readers that take its lock
  (`withDriftLock`, `withDriftLockAsync`): the five drift-lane migration suites and the acceptance build.
  drift-lane-breaker, the one suite that rewrites tracked source, runs ALONE after the batch
  (`scripts/lib/db-passes.mjs`), so no suite can load inside its window.
- Every entry point resolves actor, tenant, project, participation and permission through the one
  `authorize()` (`src/server/authorize.ts`; `authorizePage()` for pages) and carries a live-database test
  that a caller without the permission is refused by name.
- **Reading a run back**: read the journeys' own database (`cubit_e2e`) through the `cubit` MCP tool
  `db_read` (read-only, `cubit.system_reason` set, scoped by `:'pid'`), never while the db lane runs.
  SCOPE every query to the project: the database holds every earlier run. `docs/handoff/session-7-readback.sql`
  is the canonical read-back; the `readback` skill is the procedure.
- pg-boss stays on 10.4.2 (npm's maintained `maint-v10` line): v12 cannot migrate a v10 schema, and the
  queue store is installed by the security-reviewed `cubit_jobs.provision_queue_storage()` (0018/0019).
  Moving it is its own increment with a superseding migration and a Deviation.

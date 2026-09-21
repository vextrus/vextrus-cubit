# Architectural Decision Record: Supervised Local Development Lane (AM-19)

**Status:** Accepted / Implemented  
**Date:** 2026-09-20  
**Scope:** Toolchain, Database Provisioning, Local Development Lifecycle, AM-19 Amendment Draft

---

## 1. Context & Problem Statement

Prior to this increment, Vextrus Cubit possessed rigorous automated gates (`pnpm verify`, `pnpm test:db`, `pnpm test:golden`, `pnpm e2e`), but lacked a dedicated, supervised local development environment. Developers and founders attempting manual exploration had to manually configure environment variables, create databases, run migrations, and author seed fixtures.

Key requirements and constraints:
1. **Zero Collision Guarantee:** Local development must never mutate or collide with `.next-cubit`, e2e scratch databases (`cubit_e2e`, `cubit_dbtest_*`), verify waves, or `vextrus-builder` sessions.
2. **Deterministic Canonical Seed:** Exactly one home for dev seed SQL authorship (`db/seed.ts`) adhering to the existing auth contract (folded email key, scrypt `N=32768, r=8, p=1`).
3. **Strict Port Discipline:** If port `3210` or worker health port `3212` is occupied, the supervisor must refuse and report the holding PID rather than silently binding an ephemeral port.
4. **Isolated Storage & Dist Directories:** Dev must run against `.next-dev` and `storage/dev`.
5. **WSL2 Compatibility:** WSL2 localhost forwarding must work out-of-the-box, with explicit network hints for external `--host` access.

---

## 2. Decision Summary

We implemented a five-stage local development architecture:

### A. Shared Database Provisioner (`scripts/lib/pg-database.mjs`)
- Encapsulates cluster reachability, role checking (`cubit_migrate`, `cubit_app`), database creation (`cubit_dev`), migration head verification (`drizzle.__drizzle_migrations` vs `db/migrations/*.sql`), and dropping.
- Keeps `tests/e2e/support/scratch-db.ts` byte-identical to maintain frozen digest constraints while sharing identical database conventions across scripts.

### B. Canonical Dev Seed (`db/seed.ts` & `scripts/seed.mjs`)
- `db/seed.ts` authors deterministic SQL for the founder account (`founder@cubit.dev`), owner workspace (`Founder Works`), and SAMPLE project (`SAMPLE-RCC6`) from `scripts-data/sample-seed/manifest.json`.
- Idempotent execution using `ON CONFLICT DO UPDATE`.
- Enforces driverless live-SQL seam (`psql`/`withSession`) with attribution reason `seed: founder and sample project`.

### C. Supervised Runner (`scripts/dev.mjs`, `pnpm dev`)
- Enforces pre-flight checks: port bindability, dev dist lock (`.next-dev/.dev-server.lock`), storage root readiness, and database provisioning.
- Boots Next.js dev server with Turbopack in `.next-dev` and worker runtime with health port `3212`.
- Handles process tree signals (`SIGINT`, `SIGTERM`, `SIGHUP`) with graceful worker drain, child process tree termination via `pkill -P`, and lock release.

### D. Safe Dev Cleanup (`scripts/dev-clean.mjs`, `pnpm dev:clean`)
- Checks `.next-dev/.dev-server.lock`. If a live server process is detected, refuses execution with exit code 1.
- If idle, cleanly drops `cubit_dev` and removes `.next-dev` and `storage/dev`.

### E. Machine Checkup Extension (`scripts/checkup.mjs`)
- Adds honest machine probes: `dev-db` (validates `cubit_dev` migration head), `dev-storage` (validates `storage/dev` writability), and `dev-env` (validates seven declared environment keys in `.env.example`).

---

## 3. Draft Amendment Text: AM-19 (Local Development Lane)

The following draft text is prepared for incorporation into `docs/specs/cubit.bible.xml` under `<amendments>`:

```xml
<amendment id="AM-19" title="Local Development Lane & Supervisor">
  <rationale>
    Provides a turnkey, deterministic local development environment isolated from verify,
    database test suites, and Playwright journeys, guaranteeing zero collision across build
    artifacts and database instances.
  </rationale>
  <clauses>
    <clause id="AM-19-01" ref="ARCH-02">
      The command `pnpm dev` supervises the web application and worker process for local
      development. The dev lane binds port 3210 by default and isolates its build output
      under `.next-dev` and its file assets under `storage/dev`. Dev builds never write to
      or read from `.next-cubit`.
    </clause>
    <clause id="AM-19-02" ref="B-21">
      The development database is named `cubit_dev`. It is owned by role `cubit_migrate`
      and accessed by application runtime role `cubit_app`. Migrations are applied
      automatically on startup up to the committed migration head.
    </clause>
    <clause id="AM-19-03" ref="B-19">
      Development seeding is authored strictly in `db/seed.ts` and invoked via `pnpm seed`.
      The dev seed is idempotent, installs founder identity `founder@cubit.dev` with
      scrypt N=32768, r=8, p=1, and mounts the F-RCC6 SAMPLE project from
      `scripts-data/sample-seed/manifest.json`.
    </clause>
    <clause id="AM-19-04" ref="C-06">
      `pnpm dev:clean` purges dev-lane artifacts (`cubit_dev`, `.next-dev`, `storage/dev`).
      Cleanup is strictly refused while a live dev server holds `.dev-server.lock`.
    </clause>
    <clause id="AM-19-05" ref="B-23">
      `pnpm checkup` probes dev-lane readiness: `dev-db` validates presence and migration
      head of `cubit_dev`, `dev-storage` validates writability of `storage/dev`, and
      `dev-env` validates declarations in `.env.example`.
    </clause>
  </clauses>
</amendment>
```

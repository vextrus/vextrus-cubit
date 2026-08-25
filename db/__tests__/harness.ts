// The live database suite's harness (V-DB): a scratch database built from DATABASE_URL, owned by
// the migrate role, migrated by the tree's own migration lane, and reachable as both live roles.
//
// Roles are cluster-level, so they are created here idempotently before the database exists; the
// migrations only GRANT and declare policies by name (SEAM-TENANT). Nothing here imports a driver:
// that ban binds every file outside src/core/db.ts, this one included.
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { BOOTSTRAP_URL, ROLE_APP, ROLE_MIGRATE, SCRATCH_DB_PREFIX } from "./support/fixtures";
import { deriveTenantScopedTables, ident, lit, qualified, run } from "./support/live-sql";

const REPO_ROOT = join(import.meta.dirname, "..", "..");

/** A scratch database, addressed as each of the two live roles, and the way to take it away again. */
export type ScratchDb = { urlMigrate: string; urlApp: string; drop(): Promise<void> };

/** Local development passwords for the two live roles; CI may already have created them. */
const PASSWORD: Record<string, string> = { [ROLE_MIGRATE]: ROLE_MIGRATE, [ROLE_APP]: ROLE_APP };

/** The same server, addressed as `role` against `database`. */
function urlAs(role: string, database: string): string {
  const url = new URL(BOOTSTRAP_URL);
  url.username = role;
  url.password = PASSWORD[role] ?? role;
  url.pathname = `/${database}`;
  return url.toString();
}

/** Create a role if the cluster has not got it, and make sure this run can log in as it. */
function ensureRole(role: string): string {
  const password = lit(PASSWORD[role] ?? role);
  return `
    do $$
    begin
      if not exists (select 1 from pg_roles where rolname = ${lit(role)}) then
        execute 'create role ' || quote_ident(${lit(role)}) || ' login password ' || quote_literal(${password});
      else
        execute 'alter role ' || quote_ident(${lit(role)}) || ' with login password ' || quote_literal(${password});
      end if;
    end $$;
    -- Owning a database means being a member of its owner. A cluster that already granted this
    -- says so by refusing, which is not a reason to stop.
    do $$
    begin
      execute 'grant ' || quote_ident(${lit(role)}) || ' to ' || quote_ident(current_user);
    exception when others then null;
    end $$;`;
}

/**
 * A private, migrated database for one run of the suite. The two roles are real: migrations are
 * applied as the owner, and everything the suite proves about tenancy it proves as the app role.
 */
export async function provisionScratchDb(): Promise<ScratchDb> {
  const database = `${SCRATCH_DB_PREFIX}${process.pid.toString(36)}_${Date.now().toString(36)}`;
  run(BOOTSTRAP_URL, [ensureRole(ROLE_MIGRATE), ensureRole(ROLE_APP)].join("\n"));
  run(BOOTSTRAP_URL, `drop database if exists ${ident(database)} with (force);\ncreate database ${ident(database)} owner ${ident(ROLE_MIGRATE)};`);

  const urlMigrate = urlAs(ROLE_MIGRATE, database);
  const migrated = spawnSync(process.execPath, [join(REPO_ROOT, "scripts", "db-migrate.mjs")], {
    cwd: REPO_ROOT,
    env: { ...process.env, DATABASE_URL: urlMigrate },
    encoding: "utf8",
    timeout: 120_000,
  });
  if (migrated.status !== 0) {
    run(BOOTSTRAP_URL, `drop database if exists ${ident(database)} with (force);`);
    throw new Error(`the committed migrations did not apply to ${database}:\n${`${migrated.stdout ?? ""}${migrated.stderr ?? ""}`.slice(-1600)}`);
  }

  return {
    urlMigrate,
    urlApp: urlAs(ROLE_APP, database),
    drop: async () => {
      run(BOOTSTRAP_URL, `drop database if exists ${ident(database)} with (force);`);
    },
  };
}

/**
 * Every base table of the migrated database that carries tenant_id, read from information_schema —
 * the denominator R-SPINE-004's per-table proofs are driven by, so a table a later increment adds
 * is covered the moment it lands (B-19).
 */
export async function enumerateTenantScopedTables(urlOrClient: string): Promise<string[]> {
  return deriveTenantScopedTables(urlOrClient).map(qualified);
}

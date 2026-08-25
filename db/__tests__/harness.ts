// The live database suite's harness (V-DB): a scratch database built from DATABASE_URL, owned by
// the migrate role, migrated by the tree's own migration lane, and reachable as both live roles.
//
// Roles are cluster-level, so they are created here idempotently before the database exists; the
// migrations only GRANT and declare policies by name (SEAM-TENANT). Nothing here imports a driver:
// that ban binds every file outside src/core/db.ts, this one included.
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { BOOTSTRAP_URL, ROLE_APP, ROLE_MIGRATE, SCRATCH_DB_PREFIX, TENANT_COLUMN } from "./support/fixtures";
import { ident, isTrue, lit, psql, run } from "./support/live-sql";

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

/**
 * Create a role the cluster has not got, and never touch one it has. A cluster that already carries
 * `cubit_migrate` or `cubit_app` carries them with a credential somebody chose — resetting that
 * because a test run wanted a password it knew would be a real change to whatever cluster
 * DATABASE_URL happens to name. If the run cannot then log in, it says so and stops (see
 * `assertCanLogIn`) rather than making the cluster fit the test.
 */
function createRoleIfAbsent(role: string): string {
  const password = lit(PASSWORD[role] ?? role);
  return `
    do $$
    begin
      if not exists (select 1 from pg_roles where rolname = ${lit(role)}) then
        execute 'create role ' || quote_ident(${lit(role)}) || ' login password ' || quote_literal(${password});
      end if;
    end $$;
    -- Owning a database means being a member of its owner. Granted only when this user is not
    -- already a member, and given back in drop() — a test run leaves no membership behind.
    do $$
    begin
      if not pg_has_role(current_user, ${lit(role)}, 'member') then
        execute 'grant ' || quote_ident(${lit(role)}) || ' to ' || quote_ident(current_user);
      end if;
    exception when others then null;
    end $$;`;
}

/** Was this user already a member of the role before this run touched the cluster? */
function alreadyMember(role: string): boolean {
  return isTrue(run(BOOTSTRAP_URL, `select pg_has_role(current_user, ${lit(role)}, 'member');`)[0]?.[0] ?? "");
}

/** Give a membership back, so the bootstrap user leaves the run no wider than it arrived. */
function revokeMembership(role: string): void {
  psql(BOOTSTRAP_URL, `do $$ begin execute 'revoke ' || quote_ident(${lit(role)}) || ' from ' || quote_ident(current_user); exception when others then null; end $$;`);
}

/**
 * Prove the run can reach the cluster as this role before anything depends on it. A role the
 * cluster already had with a different credential fails here, loudly and harmlessly, instead of
 * being quietly rewritten to the password this harness happens to use.
 */
function assertCanLogIn(role: string, database: string): void {
  const probe = psql(urlAs(role, database), "select 1;");
  if (probe.ok) return;
  throw new Error(
    `cannot connect to ${database} as ${role}. This cluster already carries the role with a credential this harness did not set, and the harness will not reset an existing role's password — point DATABASE_URL at a scratch cluster, or give ${role} the password '${PASSWORD[role] ?? role}' yourself.\n\n${probe.stderr.slice(-800)}`,
  );
}

/**
 * A private, migrated database for one run of the suite. The two roles are real: migrations are
 * applied as the owner, and everything the suite proves about tenancy it proves as the app role.
 */
export async function provisionScratchDb(): Promise<ScratchDb> {
  const database = `${SCRATCH_DB_PREFIX}${process.pid.toString(36)}_${Date.now().toString(36)}`;
  const roles = [ROLE_MIGRATE, ROLE_APP];
  const borrowed = roles.filter((role) => !alreadyMember(role));
  run(BOOTSTRAP_URL, roles.map(createRoleIfAbsent).join("\n"));
  run(BOOTSTRAP_URL, `drop database if exists ${ident(database)} with (force);\ncreate database ${ident(database)} owner ${ident(ROLE_MIGRATE)};`);
  for (const role of roles) assertCanLogIn(role, database);

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
      for (const role of borrowed) revokeMembership(role);
    },
  };
}

/**
 * Every base table of the migrated database that carries tenant_id, read from information_schema —
 * the denominator R-SPINE-004's per-table proofs are driven by, so a table a later increment adds
 * is covered the moment it lands (B-19).
 */
export async function enumerateTenantScopedTables(urlOrClient: string): Promise<string[]> {
  // Read from pg_catalog, not information_schema: the suite's own derivation reads
  // information_schema, and two readings of the same view agreeing proves nothing about either.
  // Asked of the catalogue directly, the two are independent and their agreement is a finding.
  // relkind 'r' and 'p' are what a base table is — a view or a foreign table carries no rows to
  // scope, and attisdropped keeps a dropped column from counting.
  const rows = run(
    urlOrClient,
    `select n.nspname, c.relname
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       join pg_attribute a on a.attrelid = c.oid
      where c.relkind in ('r', 'p')
        and a.attname = ${lit(TENANT_COLUMN)}
        and a.attnum > 0
        and not a.attisdropped
        and n.nspname not in ('pg_catalog', 'information_schema')
        and n.nspname not like 'pg\\_toast%'
      order by 1, 2;`,
  );
  return rows.map((row) => {
    const schema = row[0];
    const table = row[1];
    if (schema === undefined || table === undefined) throw new Error(`unreadable catalogue row: ${row.join(" ")}`);
    return `${schema}.${table}`;
  });
}

// The live database suite's harness (V-DB): a scratch database built from DATABASE_URL, owned by
// the migrate role, migrated by the tree's own migration lane, and reachable as both live roles.
//
// Roles are cluster-level, so they are created here idempotently before the database exists; the
// migrations only GRANT and declare policies by name (SEAM-TENANT). Nothing here imports a driver:
// that ban binds every file outside src/core/db.ts, this one included.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { BOOTSTRAP_URL, ROLE_APP, ROLE_MIGRATE, SCRATCH_DB_PREFIX, TEMPLATE_DB_PREFIX, TENANT_COLUMN } from "./support/fixtures";
import { ident, isTrue, lit, psql, run } from "./support/live-sql";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const MIGRATIONS_DIR = join(REPO_ROOT, "db", "migrations");

/** Two provisions inside one millisecond of one process are still two databases. */
let counter = 0;

/** A scratch database, addressed as each of the two live roles, and the way to take it away again. */
export type ScratchDb = { urlMigrate: string; urlApp: string; drop(): Promise<void> };

/**
 * The address this scratch deployment answers at (R-SPINE-001). The doors that mail a link build it
 * from the address the deployment named and never from the one a request carries — a `Host` is
 * written by whoever sent the request — so a deployment that has named none sends nothing at all and
 * says so. A suite that drives those doors is a deployment, and names one, exactly as it names the
 * database it writes to.
 *
 * Deliberately not the host the suite's own requests carry: were the two the same string, a run
 * could not tell a link built from the deployment's address from one built from the caller's.
 * An operator's own value is never overwritten.
 */
const PUBLIC_ORIGIN_VAR = "CUBIT_PUBLIC_ORIGIN";
process.env[PUBLIC_ORIGIN_VAR] ??= "https://cubit.example";

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
 * A digest of every byte of every migration input, path included — the name of the template built
 * from them. Editing, adding or renaming a migration moves this digest, so the next run builds a new
 * template rather than cloning a schema the tree no longer says is current (B-19): a template keyed
 * by anything weaker (a count, a head filename, an mtime) would serve a stale schema silently, which
 * is the one failure a cached database can have.
 */
export function migrationsDigest(dir: string = MIGRATIONS_DIR): string {
  const files: string[] = [];
  const walk = (at: string): void => {
    for (const entry of readdirSync(at, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const full = join(at, entry.name);
      if (entry.isDirectory()) walk(full);
      else files.push(full);
    }
  };
  walk(dir);
  const hash = createHash("sha256");
  for (const file of files.sort()) {
    hash.update(relative(dir, file).replace(/\\/g, "/"));
    hash.update("\u0000");
    hash.update(readFileSync(file));
    hash.update("\u0000");
  }
  return hash.digest("hex").slice(0, 16);
}

/** The template database the committed migrations build to, named by what they are. */
export function templateDatabaseName(dir: string = MIGRATIONS_DIR): string {
  return `${TEMPLATE_DB_PREFIX}${migrationsDigest(dir)}`;
}

/** Has this template finished being built? `datistemplate` is set last, and only by the builder. */
function templateIsReady(name: string): boolean {
  return isTrue(run(BOOTSTRAP_URL, `select datistemplate from pg_database where datname = ${lit(name)};`)[0]?.[0] ?? "");
}

/**
 * Apply the committed migrations to a database, through the tree's own migration lane (ARCH-02).
 *
 * Awaited rather than `spawnSync`d, so the builder's event loop keeps turning while the migrations
 * run: that is what lets the heartbeat timer fire, and a builder whose heartbeat stopped for the
 * length of its own build would be reclaimed by its own waiters.
 */
async function migrateInto(database: string): Promise<void> {
  const migrated = await new Promise<{ status: number | null; output: string }>((settle) => {
    const child = spawn(process.execPath, [join(REPO_ROOT, "scripts", "db-migrate.mjs")], {
      cwd: REPO_ROOT,
      env: { ...process.env, DATABASE_URL: urlAs(ROLE_MIGRATE, database) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => { output += String(chunk); });
    child.stderr.on("data", (chunk) => { output += String(chunk); });
    const killer = setTimeout(() => child.kill("SIGKILL"), 300_000);
    child.on("error", (error) => { clearTimeout(killer); settle({ status: 1, output: `${output}\n${String(error)}` }); });
    child.on("close", (code) => { clearTimeout(killer); settle({ status: code, output }); });
  });
  if (migrated.status !== 0) {
    throw new Error(`the committed migrations did not apply to ${database}:\n${migrated.output.slice(-1600)}`);
  }
}

/**
 * Take away templates built from migrations this tree no longer carries, and say what went.
 *
 * A ready template carries `datistemplate = true`, and Postgres refuses `drop database` on such a
 * database outright — so the flag comes off first and goes back on when the drop is refused for any
 * other reason. The old spelling issued the bare drop and discarded its result, which means no
 * template this harness ever marked ready could be taken away at all: a sweep that never once
 * succeeded looked exactly like a sweep that worked, and every digest the tree had ever carried was
 * still standing on the cluster.
 *
 * Still never forced: a template another suite is cloning from right now holds it (55006), and being
 * left behind for the next run to collect is the correct outcome — a forced drop would kill that
 * suite's own provision.
 *
 * `prefix` is the namespace swept, and it is the template prefix in every production call; a suite
 * that judges the sweep names its own namespace instead, so proving this never puts the template the
 * rest of the lane is cloning from at risk.
 */
export function dropStaleTemplates(keep: string, prefix: string = TEMPLATE_DB_PREFIX): string[] {
  // `_` is a wildcard in LIKE and the prefix is full of them: escaped, so the sweep collects the
  // namespace it names and not every database whose name merely rhymes with it.
  const pattern = lit(`${prefix.replace(/[%_\\]/g, "\\$&")}%`);
  const stale = run(BOOTSTRAP_URL, `select datname from pg_database where datname like ${pattern} escape '\\' and datname <> ${lit(keep)};`).map((row) => row[0] ?? "");
  const dropped: string[] = [];
  for (const name of stale) {
    psql(BOOTSTRAP_URL, `alter database ${ident(name)} is_template false;`);
    const gone = psql(BOOTSTRAP_URL, `drop database if exists ${ident(name)};`);
    if (gone.ok) {
      dropped.push(name);
      process.stdout.write(`db-template dropped ${name}\n`);
      continue;
    }
    // It is still somebody's source. Put the flag back, so a run cloning from it still reads it as
    // ready, and leave it for the next sweep.
    psql(BOOTSTRAP_URL, `alter database ${ident(name)} is_template true;`);
    process.stdout.write(`db-template kept ${name} — ${gone.sqlstate ?? "refused"} (a run is cloning from it)\n`);
  }
  return dropped;
}

/**
 * How long a builder's silence means it died. A builder stamps the database it is building with the
 * server's own clock every few seconds; a waiter that finds a non-template database whose stamp is
 * older than this — or that never carried one — is looking at the leavings of a run that was killed
 * mid-build, and rebuilds rather than waiting the full build timeout on a database that can never
 * become ready. Overridable so the case is provable in a test rather than in a minute.
 */
function staleAfterMs(): number {
  const named = Number(process.env["CUBIT_TEMPLATE_STALE_MS"]);
  return Number.isFinite(named) && named > 0 ? named : 60_000;
}

/** How often the builder says it is still alive while the migrations run. */
const HEARTBEAT_EVERY_MS = 5_000;

/**
 * Say, on the database itself, that this run is still building it. `COMMENT ON DATABASE` only takes
 * the database the session is connected to, so the stamp is written from inside the template as its
 * owner — and it is the SERVER's clock, so a waiter on another machine compares like with like. It
 * needs no cleanup: the comment is dropped with the database it sits on.
 */
function heartbeat(name: string): void {
  psql(urlAs(ROLE_MIGRATE, name), `do $$ begin execute format('comment on database %I is %L', current_database(), clock_timestamp()::text); end $$;`);
}

/** Milliseconds since the builder last said it was alive — or that it never said, or that it is gone. */
function heartbeatAgeMs(name: string): number | "absent" | "gone" {
  const answer = run(
    BOOTSTRAP_URL,
    `select case when shobj_description(oid, 'pg_database') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2} '
                 then (extract(epoch from (clock_timestamp() - shobj_description(oid, 'pg_database')::timestamptz)) * 1000)::bigint::text
                 else 'absent' end
       from pg_database where datname = ${lit(name)};`,
  )[0]?.[0];
  if (answer === undefined) return "gone";
  if (answer === "absent") return "absent";
  return Number(answer);
}

/** How long a suite waits for the run that won the race to finish building the template. */
const TEMPLATE_BUILD_TIMEOUT_MS = 300_000;

/** This process builds or waits for the template once, however many files ask it for one. */
let template: Promise<string> | undefined;

/**
 * The migrated template every scratch database of this run is copied from — built ONCE per cluster
 * per migration digest, by whichever process wins the race, and cloned by all the rest (51 files
 * each running 41 migrations was the database lane's whole cost).
 *
 * `CREATE DATABASE` is the mutex: exactly one process can create a given name, and the loser gets
 * 42P04 and waits. Readiness is `datistemplate`, set only after the migrations applied — so a
 * template that exists but is half-built is never cloned, and a builder that dies leaves a database
 * that says plainly it is not ready instead of a schema that lies about being complete.
 */
async function ensureTemplate(): Promise<string> {
  template ??= buildTemplate();
  return template;
}

async function buildTemplate(): Promise<string> {
  return ensureTemplateNamed(templateDatabaseName(), { sweepStale: true });
}

/**
 * Build the named template, or join whoever is already building it — and reclaim it when nobody is.
 *
 * `CREATE DATABASE` is the mutex: exactly one process can create a given name, and the loser gets
 * 42P04 and waits. Readiness is `datistemplate`, set only after the migrations applied. What was
 * missing is the third case: a builder SIGKILLed between the create and that flag leaves a database
 * of the wanted name that can never become ready, and every later run waited the full
 * TEMPLATE_BUILD_TIMEOUT_MS on it and then failed. So a builder stamps a heartbeat while it works,
 * and a waiter that finds no live builder behind the database takes it away and builds it itself.
 *
 * Three rounds, not a loop: two runs reclaiming the same corpse race, and the loser of that race
 * finds a fresh builder on its next round. A name that cannot be settled in three is a fault to
 * report, not one to keep grinding at.
 */
export async function ensureTemplateNamed(name: string, options: { sweepStale?: boolean } = {}): Promise<string> {
  for (let round = 0; round < 3; round += 1) {
    if (templateIsReady(name)) return name;

    const created = psql(BOOTSTRAP_URL, `create database ${ident(name)} owner ${ident(ROLE_MIGRATE)};`);
    if (created.ok) {
      heartbeat(name);
      const beating = setInterval(() => heartbeat(name), HEARTBEAT_EVERY_MS);
      try {
        await migrateInto(name);
      } catch (error) {
        // A half-built template must not outlive the attempt: it would never become ready, and every
        // later run would wait on it.
        psql(BOOTSTRAP_URL, `drop database if exists ${ident(name)} with (force);`);
        throw error;
      } finally {
        clearInterval(beating);
      }
      run(BOOTSTRAP_URL, `update pg_database set datistemplate = true where datname = ${lit(name)};`);
      if (options.sweepStale === true) dropStaleTemplates(name);
      return name;
    }
    if (created.sqlstate !== "42P04") throw new Error(`the template database ${name} could not be created:\n${created.stderr.slice(-1200)}`);

    if (await waitForTemplate(name)) return name;

    process.stdout.write(`db-template reclaiming ${name} — it is not a template and no builder has spoken for ${staleAfterMs()} ms\n`);
    const reclaimed = psql(BOOTSTRAP_URL, `drop database if exists ${ident(name)} with (force);`);
    if (!reclaimed.ok) throw new Error(`the half-built template ${name} could not be taken away (SQLSTATE ${reclaimed.sqlstate ?? "none"}):\n${reclaimed.stderr.slice(-1200)}`);
  }
  throw new Error(`the template database ${name} could be neither built nor reclaimed in three rounds — something else on this cluster is creating and destroying it.`);
}

/**
 * Wait for the run that won the race. `true` when the template came ready; `false` when the database
 * is standing there with no live builder behind it, which is the caller's cue to rebuild it.
 */
async function waitForTemplate(name: string): Promise<boolean> {
  const deadline = Date.now() + TEMPLATE_BUILD_TIMEOUT_MS;
  let missingSince: number | undefined;
  while (Date.now() < deadline) {
    await new Promise((resume) => setTimeout(resume, 250));
    if (templateIsReady(name)) return true;
    const age = heartbeatAgeMs(name);
    // Somebody else already reclaimed it: the next round's CREATE decides who rebuilds.
    if (age === "gone") return false;
    // No stamp at all is either a builder in the instant between its create and its first heartbeat,
    // or a database left by a run too old to stamp. Waiting it out tells the two apart.
    if (age === "absent") {
      missingSince ??= Date.now();
      if (Date.now() - missingSince > staleAfterMs()) return false;
      continue;
    }
    missingSince = undefined;
    if (age > staleAfterMs()) return false;
  }
  throw new Error(`the template database ${name} exists but never became ready — a run that was building it died. Drop it and try again:\n  psql "${BOOTSTRAP_URL}" -c 'drop database ${name} with (force)'`);
}

/**
 * A private, migrated database for one run of the suite, copied from the template rather than
 * migrated again. The two roles are real: the template's migrations were applied as the owner, its
 * grants and policies are copied with it, and everything the suite proves about tenancy it proves as
 * the app role.
 */
export async function provisionScratchDb(): Promise<ScratchDb> {
  const database = `${SCRATCH_DB_PREFIX}${process.pid.toString(36)}_${Date.now().toString(36)}_${(counter += 1).toString(36)}`;
  const roles = [ROLE_MIGRATE, ROLE_APP];
  const borrowed = roles.filter((role) => !alreadyMember(role));
  run(BOOTSTRAP_URL, roles.map(createRoleIfAbsent).join("\n"));
  const source = await ensureTemplate();

  run(BOOTSTRAP_URL, `drop database if exists ${ident(database)} with (force);`);
  // 55006: the template is momentarily held by another process's own clone. Copying is short, so
  // this yields and asks again rather than failing a file for a collision it can wait out.
  for (let attempt = 0; ; attempt += 1) {
    const cloned = psql(BOOTSTRAP_URL, `create database ${ident(database)} template ${ident(source)} owner ${ident(ROLE_MIGRATE)};`);
    if (cloned.ok) break;
    if (cloned.sqlstate !== "55006" || attempt >= 40) throw new Error(`${database} could not be copied from the template ${source}:\n${cloned.stderr.slice(-1200)}`);
    await new Promise((resume) => setTimeout(resume, 250));
  }
  for (const role of roles) assertCanLogIn(role, database);

  return {
    urlMigrate: urlAs(ROLE_MIGRATE, database),
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

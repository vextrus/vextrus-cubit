// The job store's security invariant, measured as state (V-DB).
//
// This suite is the arbitrated form of the SECURITY finding raised against
// db/migrations/0018_job-store-schemas.sql: the ruling replaced the file/line assertion ("0018's
// text grants the destructive door") with a probe of the database itself, because — B-19 — the
// interest being protected is a property of a database at the end of a migrate run, not of the text
// of a mid-chain artifact the repo's append-only history schedules to be superseded. The three
// states it names are the three cases below: a fresh install, a legacy install repaired in place,
// and a run interrupted between the installer's migration and its repair.
//
// Two facts are asserted of each end state, both by catalogue query:
//   * no role holds EXECUTE on `pgboss.delete_queue(text)` — the door that deletes a queue's row and
//     drops its partition with every job in it (R-SPINE-031 / SEAM-JOBS);
//   * `cubit_jobs.provision_queue_storage()` carries the version guard the repair restored, which is
//     the security rule that installer is named by (it is SECURITY DEFINER on purpose — installing a
//     schema is the migration role's authority — so `prosecdef = false` is not the reading here).
//
// Nothing below names a migration by number. The halt point is derived: the earliest prefix of the
// committed journal whose application leaves the installer standing is, by definition, the state a
// run interrupted just after it would be halted in. A chain that introduces the installer somewhere
// else is judged in the same place by the same rule (B-19).
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { provisionScratchDb, type ScratchDb } from "./harness";
import { BOOTSTRAP_URL, ROLE_APP, ROLE_MIGRATE, SCRATCH_DB_PREFIX } from "./support/fixtures";
import { ident, isTrue, lit, psql, run, scalar } from "./support/live-sql";

const REPO_ROOT = join(import.meta.dirname, "..", "..");

/** The two doors the queue library installs. Their signatures are how the catalogue is asked. */
const DESTRUCTIVE_DOOR = "pgboss.delete_queue(text)";
const CONSTRUCTIVE_DOOR = "pgboss.create_queue(text,json)";

/** The installer the managing tier calls; the migrate lane makes it, never the storage itself. */
const INSTALLER = "cubit_jobs.provision_queue_storage()";

/** A database this suite made, addressed as each of the two live roles. */
type Probe = { database: string; urlMigrate: string; urlApp: string };

/** Local development passwords, as the harness sets them for the two live roles. */
function urlAs(role: string, database: string): string {
  const url = new URL(BOOTSTRAP_URL);
  url.username = role;
  url.password = role;
  url.pathname = `/${database}`;
  return url.toString();
}

/**
 * A private database this suite migrates by hand. The harness has already created the two cluster
 * roles and lent this user the standing to own a database as `cubit_migrate` (that is what
 * `provisionScratchDb` does before it migrates), so the ownership here is the same ownership every
 * other live suite runs under.
 */
function createDatabase(suffix: string): Probe {
  const database = `${SCRATCH_DB_PREFIX}${suffix}_${process.pid.toString(36)}_${Date.now().toString(36)}`;
  run(BOOTSTRAP_URL, `drop database if exists ${ident(database)} with (force);\ncreate database ${ident(database)} owner ${ident(ROLE_MIGRATE)};`);
  return { database, urlMigrate: urlAs(ROLE_MIGRATE, database), urlApp: urlAs(ROLE_APP, database) };
}

/** The tree's own migrate lane, against one database, optionally over a trimmed copy of the chain. */
function migrate(url: string, configPath?: string): void {
  const applied = spawnSync(process.execPath, [join(REPO_ROOT, "scripts", "db-migrate.mjs"), ...(configPath === undefined ? [] : ["--config", configPath])], {
    cwd: REPO_ROOT,
    env: { ...process.env, DATABASE_URL: url },
    encoding: "utf8",
    timeout: 120_000,
  });
  if (applied.status !== 0) throw new Error(`the migrate lane refused this run:\n${`${applied.stdout ?? ""}${applied.stderr ?? ""}`.slice(-1600)}`);
}

/** What one journal entry is, for the purpose of cutting the chain short. */
type Journal = { readonly entries: readonly { readonly tag: string }[] };

/**
 * A copy of the committed chain whose journal can be cut to a prefix, plus a drizzle config that
 * points at it. The copy is written outside the tree — a check never writes to the repository — and
 * the config declares no import, so it resolves wherever it is read from.
 */
function prefixLane(): { configPath: string; journal: Journal; setPrefix(count: number): void; discard(): void } {
  const dir = mkdtempSync(join(tmpdir(), "cubit-job-store-"));
  const migrations = join(dir, "migrations");
  cpSync(join(REPO_ROOT, "db", "migrations"), migrations, { recursive: true });
  const journalPath = join(migrations, "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as Journal;
  if (!Array.isArray(journal.entries) || journal.entries.length === 0) throw new Error(`the committed migration journal carries no entries: ${journalPath}`);
  const configPath = join(dir, "prefix.config.ts");
  writeFileSync(
    configPath,
    `export default { dialect: "postgresql", schema: ${JSON.stringify(join(REPO_ROOT, "db", "schema.ts"))}, out: ${JSON.stringify(migrations)}, dbCredentials: { url: process.env["DATABASE_URL"] ?? "" } };\n`,
  );
  return {
    configPath,
    journal,
    setPrefix: (count) => writeFileSync(journalPath, JSON.stringify({ ...journal, entries: journal.entries.slice(0, count) }, null, 2)),
    discard: () => rmSync(dir, { recursive: true, force: true }),
  };
}

/** Does this function stand in this database? */
function stands(url: string, signature: string): boolean {
  return isTrue(scalar(url, `select (to_regprocedure(${lit(signature)}) is not null)::text;`));
}

/**
 * Every login role of the cluster that holds EXECUTE on the destructive door and is not the door's
 * owner (nor a member of it): the owner holds its own function by owning it, and an operator acting
 * as that role is the one hand R-SPINE-031 leaves the act to. Derived from pg_roles, so a role a
 * later deployment adds — a worker of its own, say — is judged the moment it exists (B-19).
 */
function holdersOfDestructiveDoor(url: string): string[] {
  return run(
    url,
    `select r.rolname
       from pg_proc p
       join pg_roles r on r.rolcanlogin and not r.rolsuper
      where p.oid = to_regprocedure(${lit(DESTRUCTIVE_DOOR)})
        and not pg_has_role(r.oid, p.proowner, 'member')
        and has_function_privilege(r.oid, p.oid, 'execute')
      order by 1;`,
  ).map((row) => row[0] ?? "");
}

/** Is the destructive door marked to run as its definer — the mark that made it reachable at all? */
function runsAsDefiner(url: string, signature: string): boolean {
  return isTrue(scalar(url, `select prosecdef::text from pg_proc where oid = to_regprocedure(${lit(signature)});`));
}

/**
 * The end state every migrate run must leave, whatever the database was in before it: the queue's
 * storage stands, the app role may make a queue, and nobody outside the owning role may unmake one.
 * The constructive door is read as a control — a probe that answered "no privilege" everywhere
 * would pass this by saying nothing.
 */
function expectDestructiveDoorHeldByNobody(probe: Probe): void {
  expect(stands(probe.urlMigrate, DESTRUCTIVE_DOOR), `${DESTRUCTIVE_DOOR} does not stand in ${probe.database}; the probe would be vacuous`).toBe(true);
  expect(isTrue(scalar(probe.urlMigrate, `select has_function_privilege(${lit(ROLE_APP)}, ${lit(CONSTRUCTIVE_DOOR)}, 'execute')::text;`)), `${ROLE_APP} cannot make a queue, so this probe cannot see a grant it is given`).toBe(true);
  expect(holdersOfDestructiveDoor(probe.urlMigrate)).toEqual([]);
  expect(runsAsDefiner(probe.urlMigrate, DESTRUCTIVE_DOOR)).toBe(false);
}

/**
 * The guard the repair restored: storage already standing at a version these plans do not install is
 * named, not silently accepted (no tier migrates it — R-SPINE-031). Probed by drifting the standing
 * version and asking the installer again, so nothing here reads the installer's source.
 */
function expectVersionGuard(probe: Probe): void {
  const standing = Number(scalar(probe.urlMigrate, "select max(version) from pgboss.version;"));
  expect(Number.isFinite(standing)).toBe(true);
  const drifted = standing - 1;
  run(probe.urlMigrate, `update pgboss.version set version = ${lit(String(drifted))}::int;`);
  const guarded = psql(probe.urlApp, `select ${INSTALLER};`);
  expect(guarded.ok, `the installer accepted queue storage standing at version ${drifted}`).toBe(false);
  expect(guarded.sqlstate).toBe("P0001");
  expect(guarded.stderr).toContain(String(drifted));
  expect(guarded.stderr).toContain("version");
  run(probe.urlMigrate, `update pgboss.version set version = ${lit(String(standing))}::int;`);
  expect(psql(probe.urlApp, `select ${INSTALLER};`).ok, "the installer refused storage standing at the version it installs").toBe(true);
}

/** The managing tier's own call: the app role asks for the storage, as the runtime does on open. */
function installStorage(probe: Probe): void {
  const installed = psql(probe.urlApp, `select ${INSTALLER};`);
  if (!installed.ok) throw new Error(`${ROLE_APP} could not install the queue storage in ${probe.database}:\n${installed.stderr.slice(-1200)}`);
}

type Stage = { fresh: ScratchDb; interrupted: Probe; legacy: Probe; haltTag: string };

const madeDatabases: string[] = [];
let lane: ReturnType<typeof prefixLane> | undefined;
let scratch: ScratchDb | undefined;
let pending: Promise<Stage> | undefined;

/**
 * The three databases, staged lazily so each case fails with the staging error rather than being
 * skipped, and so the walk that derives the halt point is paid for once.
 */
function staged(): Promise<Stage> {
  return (pending ??= (async (): Promise<Stage> => {
    // Part 1's database: the full committed chain against an empty database, applied by the same
    // harness every live suite provisions through (it also creates the two cluster roles).
    const fresh = await provisionScratchDb();
    scratch = fresh;

    lane = prefixLane();
    const entries = lane.journal.entries;

    // The halt point, derived by walking: the earliest prefix that leaves the installer standing.
    const interrupted = createDatabase("halt");
    madeDatabases.push(interrupted.database);
    let haltIndex = 0;
    for (let count = 1; count <= entries.length; count += 1) {
      lane.setPrefix(count);
      migrate(interrupted.urlMigrate, lane.configPath);
      if (stands(interrupted.urlMigrate, INSTALLER)) {
        haltIndex = count;
        break;
      }
    }
    if (haltIndex === 0) throw new Error(`no prefix of the committed chain leaves ${INSTALLER} standing — the job store's ground is not in the migrations`);
    const haltTag = entries[haltIndex - 1]?.tag ?? "";

    // Part 2's database: the same prefix, with the storage already installed by the installer that
    // prefix carries, and the pre-repair shape of the destructive door standing on it. Declared
    // here rather than assumed of the prefix: the state the finding is about is "an installed
    // database holding the door", and a run that repairs it must be shown to take it back.
    const legacy = createDatabase("legacy");
    madeDatabases.push(legacy.database);
    lane.setPrefix(haltIndex);
    migrate(legacy.urlMigrate, lane.configPath);
    installStorage(legacy);
    run(
      legacy.urlMigrate,
      `alter function ${DESTRUCTIVE_DOOR} security definer set search_path = pg_catalog, pgboss;\ngrant execute on function ${DESTRUCTIVE_DOOR} to ${ident(ROLE_APP)};`,
    );

    return { fresh, interrupted, legacy, haltTag };
  })());
}

afterAll(async () => {
  for (const database of madeDatabases) psql(BOOTSTRAP_URL, `drop database if exists ${ident(database)} with (force);`);
  lane?.discard();
  await scratch?.drop();
});

describe("the job store leaves no destructive door standing (reviewer:SECURITY, arbitrated to a state probe)", () => {
  it("part 1 (fresh install): the full chain against an empty database installs storage no role may unmake, behind a guarded installer", async () => {
    const { fresh } = await staged();
    const probe: Probe = { database: "the freshly migrated scratch database", urlMigrate: fresh.urlMigrate, urlApp: fresh.urlApp };

    // A migrated database holds no queue storage until the managing tier asks for it (R-SPINE-031),
    // so the end state being judged is the one the runtime reaches on its first managing open.
    expect(stands(probe.urlMigrate, INSTALLER)).toBe(true);
    expect(stands(probe.urlMigrate, DESTRUCTIVE_DOOR)).toBe(false);
    installStorage(probe);

    expectDestructiveDoorHeldByNobody(probe);
    expectVersionGuard(probe);
  });

  it("part 2 (legacy install): a migrate run over a database whose earlier installer already handed out the door takes it back", async () => {
    const { legacy, haltTag } = await staged();

    // The state before the repair, asserted so the case cannot pass by there having been nothing to
    // repair: the app role holds the door, and it runs as its definer.
    expect(holdersOfDestructiveDoor(legacy.urlMigrate), `nothing to repair in a database halted at ${haltTag}`).toEqual([ROLE_APP]);
    expect(runsAsDefiner(legacy.urlMigrate, DESTRUCTIVE_DOOR)).toBe(true);

    migrate(legacy.urlMigrate);

    expectDestructiveDoorHeldByNobody(legacy);
  });

  it("part 3 (interrupted run): a chain halted after the installer landed converges on a later run", async () => {
    const { interrupted, haltTag } = await staged();

    // The halted database really is short of the chain, and really is holding the installer's ground
    // — an interrupted run, not a finished one.
    expect(stands(interrupted.urlMigrate, INSTALLER), `nothing stands in a database halted at ${haltTag}`).toBe(true);
    expect(isTrue(scalar(interrupted.urlMigrate, "select (to_regclass('pgboss.version') is null)::text;")), "the halted database already holds queue storage").toBe(true);
    const appliedWhenHalted = Number(scalar(interrupted.urlMigrate, "select count(*) from drizzle.__drizzle_migrations;"));

    migrate(interrupted.urlMigrate);

    expect(Number(scalar(interrupted.urlMigrate, "select count(*) from drizzle.__drizzle_migrations;"))).toBeGreaterThan(appliedWhenHalted);
    installStorage(interrupted);
    expectDestructiveDoorHeldByNobody(interrupted);
    expectVersionGuard(interrupted);
  });
});

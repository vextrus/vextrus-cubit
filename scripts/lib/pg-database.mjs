// Shared Postgres database provisioner for dev and test lanes (ARCH-02).
// Provides create-if-absent, migration, role/grant validation, URL derivation, and dropping.
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));

export const DEFAULT_BOOTSTRAP_URL = "postgres://postgres:postgres@127.0.0.1:5544/postgres";
export const ROLE_MIGRATE = "cubit_migrate";
export const ROLE_APP = "cubit_app";
export const DEV_DATABASE = "cubit_dev";
export const E2E_DATABASE = "cubit_e2e";

const ROLE_PASSWORDS = Object.freeze({
  [ROLE_MIGRATE]: ROLE_MIGRATE,
  [ROLE_APP]: ROLE_APP,
});

/**
 * Resolves the bootstrap cluster connection URL.
 * @param {Record<string, string | undefined>} [env=process.env]
 * @returns {string}
 */
export function bootstrapUrl(env = process.env) {
  const custom = env["DATABASE_URL"]?.trim();
  if (custom && !custom.includes(`/${DEV_DATABASE}`) && !custom.includes(`/${E2E_DATABASE}`)) {
    return custom;
  }
  return DEFAULT_BOOTSTRAP_URL;
}

/**
 * Builds a database connection URL for a target database and role.
 * @param {string} database
 * @param {string} [role=ROLE_APP]
 * @param {string} [bootstrap=bootstrapUrl()]
 * @returns {string}
 */
export function databaseUrlFor(database, role = ROLE_APP, bootstrap = bootstrapUrl()) {
  const parsed = new URL(bootstrap);
  parsed.username = role;
  parsed.password = ROLE_PASSWORDS[/** @type {keyof typeof ROLE_PASSWORDS} */ (role)] ?? role;
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

/**
 * Returns the dev database URL for the given role.
 * @param {string} [role=ROLE_APP]
 * @param {string} [bootstrap=bootstrapUrl()]
 * @returns {string}
 */
export function devDatabaseUrl(role = ROLE_APP, bootstrap = bootstrapUrl()) {
  return databaseUrlFor(DEV_DATABASE, role, bootstrap);
}

/**
 * Returns the e2e database URL for the given role.
 * @param {string} [role=ROLE_APP]
 * @param {string} [bootstrap=bootstrapUrl()]
 * @returns {string}
 */
export function e2eDatabaseUrl(role = ROLE_APP, bootstrap = bootstrapUrl()) {
  return databaseUrlFor(E2E_DATABASE, role, bootstrap);
}

/**
 * Executes a SQL query via psql and returns stdout or throws an actionable error.
 * @param {string} url
 * @param {string} sql
 * @returns {string}
 */
export function runSql(url, sql) {
  const result = spawnSync("psql", [url, "-tAc", sql], {
    encoding: "utf8",
    timeout: 30_000,
  });
  if (result.error !== undefined || result.status !== 0) {
    const detail = (result.stderr || result.stdout || result.error?.message || "").trim();
    throw new Error(`psql query failed against ${url}:\n${detail}`);
  }
  return result.stdout.trim();
}

/**
 * Checks whether Postgres is reachable at the given connection URL.
 * @param {string} [url=bootstrapUrl()]
 * @returns {{ok: boolean, detail: string}}
 */
export function checkPostgresReachable(url = bootstrapUrl()) {
  const result = spawnSync("psql", [url, "-tAc", "select 1"], {
    encoding: "utf8",
    timeout: 10_000,
  });
  if (result.error !== undefined || result.status !== 0) {
    const detail = (result.stderr || result.stdout || result.error?.message || "").trim();
    return { ok: false, detail: `unreachable at ${url}: ${detail}` };
  }
  return { ok: true, detail: `reachable at ${url}` };
}

/**
 * Returns the list of role names present on the cluster.
 * @param {string} [url=bootstrapUrl()]
 * @returns {string[]}
 */
export function queryRoles(url = bootstrapUrl()) {
  try {
    const stdout = runSql(url, "select rolname from pg_roles order by 1");
    return stdout
      .split(/\r?\n/)
      .map((r) => r.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Checks whether the required roles exist on the cluster.
 * @param {string} [url=bootstrapUrl()]
 * @param {string[]} [required=[ROLE_MIGRATE, ROLE_APP]]
 * @returns {{ok: boolean, missing: string[]}}
 */
export function checkRequiredRoles(url = bootstrapUrl(), required = [ROLE_MIGRATE, ROLE_APP]) {
  const present = new Set(queryRoles(url));
  const missing = required.filter((r) => !present.has(r));
  return { ok: missing.length === 0, missing };
}

/**
 * Checks whether a database exists.
 * @param {string} dbName
 * @param {string} [url=bootstrapUrl()]
 * @returns {boolean}
 */
export function databaseExists(dbName, url = bootstrapUrl()) {
  try {
    const stdout = runSql(url, `select 1 from pg_database where datname = '${dbName.replace(/'/g, "''")}';`);
    return stdout === "1";
  } catch {
    return false;
  }
}

/**
 * Creates a database if it does not already exist.
 * @param {string} dbName
 * @param {string} [owner=ROLE_MIGRATE]
 * @param {string} [url=bootstrapUrl()]
 * @returns {boolean} true if created, false if already existed
 */
export function createDatabaseIfAbsent(dbName, owner = ROLE_MIGRATE, url = bootstrapUrl()) {
  if (databaseExists(dbName, url)) {
    return false;
  }
  runSql(url, `create database "${dbName.replace(/"/g, '""')}" owner "${owner.replace(/"/g, '""')}";`);
  return true;
}

/**
 * Drops a database after terminating any active connections.
 * @param {string} dbName
 * @param {string} [url=bootstrapUrl()]
 * @returns {boolean} true if dropped, false if did not exist
 */
export function dropDatabase(dbName, url = bootstrapUrl()) {
  if (!databaseExists(dbName, url)) {
    return false;
  }
  const escaped = dbName.replace(/'/g, "''");
  runSql(
    url,
    `select pg_terminate_backend(pid) from pg_stat_activity where datname = '${escaped}' and pid <> pg_backend_pid();`,
  );
  runSql(url, `drop database if exists "${dbName.replace(/"/g, '""')}";`);
  return true;
}

/**
 * Applies all committed migrations to the target database URL.
 * @param {string} migrateUrl
 * @param {string} [rootDir=ROOT]
 */
export function migrateDatabase(migrateUrl, rootDir = ROOT) {
  const result = spawnSync("node", ["scripts/db-migrate.mjs"], {
    cwd: rootDir,
    env: { ...process.env, DATABASE_URL: migrateUrl },
    encoding: "utf8",
    timeout: 180_000,
  });
  if (result.status !== 0) {
    const detail = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
    throw new Error(`the committed migrations did not apply to ${migrateUrl}:\n${detail}`);
  }
}

/**
 * Compares migration files in db/migrations/*.sql with applied migrations in drizzle.__drizzle_migrations.
 * Uses migrateUrl (or resolves it for ROLE_MIGRATE) since drizzle schema is owned by cubit_migrate.
 * @param {string} [dbUrl]
 * @param {string} [rootDir=ROOT]
 * @returns {{ok: boolean, applied: number, total: number, detail: string}}
 */
export function checkMigrationHead(dbUrl, rootDir = ROOT) {
  const targetUrl = dbUrl ?? devDatabaseUrl(ROLE_MIGRATE);
  const migrationsDir = join(rootDir, "db", "migrations");
  let total;
  try {
    const migrationFiles = readdirSync(migrationsDir).filter((file) => file.endsWith(".sql"));
    total = migrationFiles.length;
  } catch {
    return { ok: false, applied: 0, total: 0, detail: `migrations directory missing at ${migrationsDir}` };
  }

  try {
    const stdout = runSql(targetUrl, "select count(*) from drizzle.__drizzle_migrations;");
    const applied = Number(stdout);
    if (!Number.isInteger(applied)) {
      return { ok: false, applied: 0, total, detail: "unreadable migration count in drizzle.__drizzle_migrations" };
    }
    const ok = applied === total;
    const detail = `${applied}/${total} migrations applied`;
    return { ok, applied, total, detail };
  } catch (error) {
    return { ok: false, applied: 0, total, detail: `cannot query drizzle.__drizzle_migrations: ${/** @type {Error} */ (error).message}` };
  }
}

/**
 * Runs seed on the target database.
 * @param {string} appUrl
 * @param {string} [rootDir=ROOT]
 * @param {{reset?: boolean}} [options={}]
 */
export function seedDatabase(appUrl, rootDir = ROOT, options = {}) {
  const args = ["scripts/seed.mjs"];
  if (options.reset) args.push("--reset");
  const result = spawnSync("node", args, {
    cwd: rootDir,
    env: { ...process.env, DATABASE_URL: appUrl },
    encoding: "utf8",
    timeout: 60_000,
  });
  if (result.status !== 0) {
    const detail = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
    throw new Error(`seeding failed for ${appUrl}:\n${detail}`);
  }
}

/**
 * Checks whether the database contains the seeded founder account.
 * Sets cubit.system_reason so RLS allows reading users.
 * @param {string} [dbUrl]
 * @returns {boolean}
 */
export function isDatabaseSeeded(dbUrl) {
  const targetUrl = dbUrl ?? devDatabaseUrl(ROLE_APP);
  try {
    const sql = "select set_config('cubit.system_reason', 'check seed', false); select count(*) from users where email like '%founder@cubit.dev%';";
    const stdout = runSql(targetUrl, sql);
    const lines = stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const count = Number(lines[lines.length - 1]);
    return Number.isInteger(count) && count > 0;
  } catch {
    return false;
  }
}

/**
 * Full provisioner for the isolated dev database `cubit_dev`.
 * Checks cluster reachability, verifies roles, creates database if absent,
 * applies migrations, and seeds founder/SAMPLE project if needed or requested.
 *
 * @param {{
 *   reset?: boolean,
 *   rootDir?: string,
 *   env?: Record<string, string | undefined>
 * }} [options={}]
 * @returns {{url: string, created: boolean, migrated: boolean, seeded: boolean}}
 */
export function provisionDevDatabase(options = {}) {
  const rootDir = options.rootDir ?? ROOT;
  const bootstrap = bootstrapUrl(options.env ?? process.env);

  // 1. Verify Postgres reachability
  const reachability = checkPostgresReachable(bootstrap);
  if (!reachability.ok) {
    throw new Error(`the dev lane cannot reach Postgres at ${bootstrap} — start the cluster or set DATABASE_URL.\n${reachability.detail}`);
  }

  // 2. Verify roles
  const rolesCheck = checkRequiredRoles(bootstrap, [ROLE_MIGRATE, ROLE_APP]);
  if (!rolesCheck.ok) {
    throw new Error(`the dev lane requires database roles ${rolesCheck.missing.join(", ")} on ${bootstrap}.`);
  }

  // 3. Reset if requested
  if (options.reset) {
    dropDatabase(DEV_DATABASE, bootstrap);
  }

  // 4. Create if absent
  const created = createDatabaseIfAbsent(DEV_DATABASE, ROLE_MIGRATE, bootstrap);

  // 5. Migrate
  const migrateUrl = devDatabaseUrl(ROLE_MIGRATE, bootstrap);
  const headBefore = checkMigrationHead(migrateUrl, rootDir);
  let migrated = false;
  if (!headBefore.ok || headBefore.applied < headBefore.total) {
    migrateDatabase(migrateUrl, rootDir);
    migrated = true;
  }

  // 6. Seed
  const appUrl = devDatabaseUrl(ROLE_APP, bootstrap);
  const alreadySeeded = !options.reset && isDatabaseSeeded(appUrl);
  let seeded = false;
  if (!alreadySeeded || options.reset) {
    seedDatabase(appUrl, rootDir, { reset: options.reset });
    seeded = true;
  }

  return { url: appUrl, created, migrated, seeded };
}

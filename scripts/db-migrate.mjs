/**
 * `pnpm db:migrate` — the one migration lane: drizzle's SQL migrations applied by the
 * migrate role against PostgreSQL 16 on 127.0.0.1:5544 (C-07, SEAM-TENANT, V-DB).
 *
 * The lane does three things, in this order, and says one line about all of it:
 *
 *   1. Bootstrap, as the admin URL. The three login roles are cluster-level, so they are
 *      ensured here and never in a migration — a migration runs inside one database and
 *      cannot be the thing that creates the role which owns it. The target database is
 *      ensured the same way, which is what makes "on a cold database" a true description.
 *   2. The ledger, as the migrate role. `cubit_ops.migration_ledger` is the runner's own
 *      table, created with IF NOT EXISTS outside drizzle's snapshots: it records what was
 *      applied, so it cannot itself be one of the things that was applied. It is append-only
 *      by a trigger rather than by convention, and SELECT-only for the app role (B-05).
 *   3. The journal, in order. A file already recorded whose content no longer hashes to what
 *      was recorded is LEDGER_DRIFT: the database and the tree disagree about what ran, and
 *      that is reported before anything else is applied, so a refused run changes nothing.
 *
 * The contract lines go on stdout (`db:migrate: ok` / `db:migrate: FAIL LEDGER_DRIFT`);
 * everything the machine has to say goes on stderr, where it cannot interleave with them.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { REPO, detail, say } from './lib/lane.mjs';

/** C-07: the dev cluster, reached as the app role. `db:migrate` targets its database name. */
export const DEFAULT_DATABASE_URL = 'postgres://cubit_app:cubit_app@127.0.0.1:5544/cubit_dev';

/** The superuser URL that bootstraps roles and databases — never the product's own handle. */
export const DEFAULT_ADMIN_URL = 'postgres://postgres:postgres@127.0.0.1:5544/postgres';

/** SEAM-TENANT's three login roles. In dev the password is the role's own name. */
export const ROLES = ['cubit_migrate', 'cubit_app', 'cubit_auth'];

const MIGRATIONS = join(REPO, 'db', 'migrations');
const JOURNAL = join(MIGRATIONS, 'meta', '_journal.json');

/** drizzle writes this between statements; it is the only place a file may be split. */
const BREAKPOINT = '--> statement-breakpoint';

function env(name, fallback) {
  const value = process.env[name];
  return value === undefined || value.trim() === '' ? fallback : value;
}

export function appUrl() {
  return env('DATABASE_URL', DEFAULT_DATABASE_URL);
}

export function adminUrl() {
  return env('DATABASE_ADMIN_URL', DEFAULT_ADMIN_URL);
}

/** The database `db:migrate` targets: the one the app URL names. */
export function targetDatabase(url = appUrl()) {
  return new URL(url).pathname.replace(/^\//, '');
}

/** The same cluster, another database — how the bootstrap reaches the one it just made. */
export function urlForDatabase(url, database) {
  const next = new URL(url);
  next.pathname = `/${database}`;
  return next.toString();
}

async function connect(url) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  return client;
}

/**
 * The three roles, as roles and nothing more: they log in, they inherit, and none of them
 * is a superuser or bypasses row-level security. FORCE ROW LEVEL SECURITY on a table means
 * nothing at all if the role that owns it carries BYPASSRLS.
 */
export async function ensureRoles(admin) {
  for (const role of ROLES) {
    const attributes = `login inherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls password '${role}'`;
    await admin.query(
      `do $$
       begin
         if not exists (select 1 from pg_roles where rolname = '${role}') then
           create role "${role}" ${attributes};
         else
           alter role "${role}" with ${attributes};
         end if;
       end $$;`,
    );
  }
}

/** The database itself, owned by the migrate role, reachable by the other two. */
async function ensureDatabase(admin, database) {
  const existing = await admin.query('select 1 from pg_database where datname = $1', [database]);
  if (existing.rowCount === 0) {
    await admin.query(`create database "${database}" owner "cubit_migrate"`);
  }
  for (const role of ROLES) {
    await admin.query(`grant connect on database "${database}" to "${role}"`);
  }
}

/**
 * Schema `public` in a database the admin made is the admin's; the migrate role owns the
 * product's objects, so it needs to be able to create them.
 */
async function ensurePublicSchema(admin) {
  await admin.query('grant usage, create on schema public to "cubit_migrate"');
}

/**
 * `cubit_ops.migration_ledger` — append-only by trigger, not by convention (B-05). The
 * refusal carries 42501, which is the same insufficient_privilege a grant refusal reports:
 * a caller reading the SQLSTATE learns "you may not", not "you have a syntax error".
 */
async function ensureLedger(migrate) {
  await migrate.query('create schema if not exists cubit_ops');
  await migrate.query(
    `create table if not exists cubit_ops.migration_ledger (
       filename text primary key,
       checksum text not null,
       applied_at timestamptz not null default now()
     )`,
  );
  await migrate.query(
    `create or replace function cubit_ops.refuse_ledger_mutation() returns trigger
     language plpgsql as $fn$
     begin
       raise exception 'cubit_ops.migration_ledger is append-only: % refused', tg_op
         using errcode = '42501';
     end;
     $fn$`,
  );
  await migrate.query(
    'drop trigger if exists migration_ledger_append_only on cubit_ops.migration_ledger',
  );
  await migrate.query(
    `create trigger migration_ledger_append_only
       before update or delete or truncate on cubit_ops.migration_ledger
       for each statement execute function cubit_ops.refuse_ledger_mutation()`,
  );
  await migrate.query('revoke all on table cubit_ops.migration_ledger from public');
  await migrate.query('grant usage on schema cubit_ops to "cubit_app"');
  await migrate.query('grant select on table cubit_ops.migration_ledger to "cubit_app"');
}

/** The journal: drizzle's own record of which SQL file came first. */
export function journalEntries() {
  if (!existsSync(JOURNAL)) return [];
  const parsed = JSON.parse(readFileSync(JOURNAL, 'utf8'));
  return (parsed.entries ?? [])
    .map((entry) => String(entry.tag ?? ''))
    .filter((tag) => tag !== '')
    .map((tag) => ({
      tag,
      // The recorded name is relative to the tree: the same migration applied from a copy
      // of the repository is the same migration, and the ledger has to say so.
      filename: `db/migrations/${tag}.sql`,
      path: join(MIGRATIONS, `${tag}.sql`),
    }));
}

export function checksumOf(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function statementsOf(sql) {
  return sql
    .split(BREAKPOINT)
    .map((statement) => statement.trim())
    .filter((statement) => statement !== '');
}

async function readLedger(migrate) {
  const result = await migrate.query('select filename, checksum from cubit_ops.migration_ledger');
  return new Map(result.rows.map((row) => [String(row.filename), String(row.checksum)]));
}

/**
 * What the tree and the ledger disagree about. Empty is the only acceptable answer, and it
 * is read before a single statement is applied.
 */
function ledgerDrift(entries, recorded) {
  const drift = [];
  for (const entry of entries) {
    const was = recorded.get(entry.filename);
    if (was === undefined) continue;
    if (!existsSync(entry.path)) {
      drift.push(`${entry.filename} was applied, but the file is gone`);
      continue;
    }
    const now = checksumOf(entry.path);
    if (now !== was) {
      drift.push(`${entry.filename} was applied as ${was}, but now hashes to ${now}`);
    }
  }
  const journalled = new Set(entries.map((entry) => entry.filename));
  for (const filename of recorded.keys()) {
    if (!journalled.has(filename)) drift.push(`${filename} was applied, but the journal has dropped it`);
  }
  return drift;
}

async function applyMigration(migrate, entry) {
  await migrate.query('begin');
  try {
    for (const statement of statementsOf(readFileSync(entry.path, 'utf8'))) {
      await migrate.query(statement);
    }
    await migrate.query(
      'insert into cubit_ops.migration_ledger (filename, checksum) values ($1, $2)',
      [entry.filename, checksumOf(entry.path)],
    );
    await migrate.query('commit');
  } catch (error) {
    await migrate.query('rollback').catch(() => undefined);
    throw error;
  }
}

export async function migrate() {
  const database = targetDatabase();
  const admin = await connect(adminUrl());
  try {
    await ensureRoles(admin);
    await ensureDatabase(admin, database);
  } finally {
    await admin.end();
  }

  const adminHere = await connect(urlForDatabase(adminUrl(), database));
  try {
    await ensurePublicSchema(adminHere);
  } finally {
    await adminHere.end();
  }

  const migrateUrl = (() => {
    const url = new URL(appUrl());
    url.username = 'cubit_migrate';
    url.password = 'cubit_migrate';
    return url.toString();
  })();

  const client = await connect(migrateUrl);
  try {
    await ensureLedger(client);
    const entries = journalEntries();
    const recorded = await readLedger(client);

    const drift = ledgerDrift(entries, recorded);
    if (drift.length > 0) {
      detail(drift.join('\n'));
      return { ok: false, reason: 'LEDGER_DRIFT', applied: 0, recorded: recorded.size };
    }

    let applied = 0;
    for (const entry of entries) {
      if (recorded.has(entry.filename)) continue;
      say(`db:migrate: applying ${entry.filename}`);
      await applyMigration(client, entry);
      applied += 1;
    }
    return { ok: true, applied, recorded: recorded.size + applied, database };
  } finally {
    await client.end();
  }
}

async function main() {
  try {
    const result = await migrate();
    if (!result.ok) {
      say(`db:migrate: FAIL ${result.reason}`);
      process.exitCode = 1;
      return;
    }
    say(`db:migrate: ok (applied ${result.applied}, recorded ${result.recorded}, ${result.database})`);
  } catch (error) {
    detail(error instanceof Error ? (error.stack ?? error.message) : String(error));
    say('db:migrate: FAIL');
    process.exitCode = 1;
  }
}

/** Imported by scripts/test-db.mjs for its bootstrap; run as a lane from the command line. */
if (process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await main();
}

/**
 * `pnpm test:db` — the V-DB lane: a cold database, migrated, with the live seam suite run
 * against it (V-DB, Q-02, C-07).
 *
 * Cold is the whole point. The suite proves what row-level security refuses and what the
 * grants allow, and both are properties of a database built by the migrations in this tree
 * — not of whatever a previous run, or a previous increment, happened to leave behind. So
 * the named database (CUBIT_TEST_DB, default cubit_test) is dropped and made again on every
 * run, and the suite is pointed at it as the app role. The dev database is never touched.
 *
 * The suite lives under db/__tests__ with a config of its own: `pnpm verify`'s vitest stage
 * and CI both run without a provisioned database, and a live-DB test there would be red for
 * a reason that has nothing to do with the code under review.
 */
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import pg from 'pg';
import { REPO, detail, say } from './lib/lane.mjs';
import {
  adminUrl,
  appUrl,
  ensureRoles,
  quoteIdent,
  targetDatabase,
  urlForDatabase,
} from './db-migrate.mjs';

/** The database this lane owns: it drops it, so it is never the one anybody works in. */
const database = (() => {
  const name = process.env['CUBIT_TEST_DB'];
  return name === undefined || name.trim() === '' ? 'cubit_test' : name;
})();

/** The suite reaches its database as the app role — the seam's role, and nothing above it. */
const url = urlForDatabase(appUrl(), database);

/**
 * "The dev database is never touched" is prose until something compares the two names (B-05).
 * This lane drops what CUBIT_TEST_DB names, with force, and the app URL names the database
 * somebody works in — normally cubit_dev. One stale export is all it takes for those to be
 * the same word, so the run refuses before it connects rather than after it has dropped.
 */
function refusesToDropTheAppDatabase() {
  const app = targetDatabase(appUrl());
  if (app !== database) return undefined;
  return (
    `test:db: CUBIT_TEST_DB names "${database}", which is the database DATABASE_URL points at.\n` +
    `This lane drops its database with (force). Point CUBIT_TEST_DB at a database of its own.`
  );
}

async function provision() {
  const admin = new pg.Client({ connectionString: adminUrl() });
  await admin.connect();
  try {
    // The roles are cluster-level and the database is owned by the migrate role, so they
    // have to exist before it can be made.
    await ensureRoles(admin);
    await admin.query(`drop database if exists ${quoteIdent(database)} with (force)`);
    await admin.query(`create database ${quoteIdent(database)} owner "cubit_migrate"`);
  } finally {
    await admin.end();
  }
}

function spawn(file, args) {
  return spawnSync(file, args, {
    cwd: REPO,
    env: { ...process.env, DATABASE_URL: url, CUBIT_TEST_DB: database, FORCE_COLOR: '0' },
    stdio: 'inherit',
  });
}

async function main() {
  const refusal = refusesToDropTheAppDatabase();
  if (refusal !== undefined) {
    detail(refusal);
    say('test:db: FAIL');
    process.exitCode = 1;
    return;
  }

  try {
    await provision();
  } catch (error) {
    detail(error instanceof Error ? (error.stack ?? error.message) : String(error));
    say('test:db: FAIL');
    process.exitCode = 1;
    return;
  }

  const migrated = spawn(process.execPath, [join(REPO, 'scripts', 'db-migrate.mjs')]);
  if (migrated.status !== 0) {
    detail(`test:db: db:migrate exited ${migrated.status} against ${database}`);
    say('test:db: FAIL');
    process.exitCode = 1;
    return;
  }

  // Arguments are forwarded, so a single file runs as
  // `pnpm test:db db/__tests__/<file>.test.ts` once the database is provisioned.
  const suite = spawn(join(REPO, 'node_modules', '.bin', 'vitest'), [
    'run',
    '--config',
    join('db', '__tests__', 'vitest.config.ts'),
    ...process.argv.slice(2),
  ]);
  if (suite.status !== 0) {
    say('test:db: FAIL');
    process.exitCode = 1;
    return;
  }
  say('test:db: ok');
}

await main();

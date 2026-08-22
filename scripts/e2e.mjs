/**
 * `pnpm e2e [--journey <J>]` — the V-E2E lane (V-E2E, C-07, Q-03, C-09).
 *
 * One run, in order: build the app once, drop and recreate the scratch database, migrate it
 * with this tree's migrations, seed the e2e fixture tenant, serve the build with
 * `next start` on 3211, run the Playwright journeys against it, tear the server down, and
 * exit with the run's status and no other.
 *
 * Two things this lane is judged on beyond "did the journeys pass":
 *
 *   Honesty. A lane that swallowed a red run would be worse than no lane, so the runner's
 *   exit code is captured before anything is torn down and is what this process exits with;
 *   the teardown cannot overwrite it. tests/e2e/red.spec.ts exists to prove that.
 *
 *   Coldness. The database is dropped and made again on every run, because the journeys
 *   assert what this tree's migrations and this tree's fixtures produce — not what a
 *   previous run left behind. Which is exactly why the one database it must never point at
 *   is the one somebody works in, and why the check for that happens before it connects.
 *
 * Arming is a directory question and nothing else: tests/e2e exists, so the lane runs. No
 * flag, no environment variable, no list in this file (C-06).
 */
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import pg from 'pg';
import { REPO, detail, hasInputDir, say, skipLane } from './lib/lane.mjs';
import {
  adminUrl,
  appUrl,
  ensureRoles,
  quoteIdent,
  targetDatabase,
  urlForDatabase,
} from './db-migrate.mjs';

/** The journeys' own directory. Its existence is what arms this lane. */
const SPECS = 'tests/e2e';

/** C-07: the e2e build is served on 3211; a parallel lane offsets it by environment. */
const PORT = Number(process.env['E2E_PORT'] ?? 3211);

/** Not `.next`: a developer's dev build and a verify build are neither consumed nor poisoned. */
const DIST_DIR = '.next-e2e';

/** The database this lane owns. It drops it, so it is never the one anybody works in. */
const DATABASE = (() => {
  const name = process.env['CUBIT_E2E_DB'];
  return name === undefined || name.trim() === '' ? 'cubit_e2e' : name;
})();

/**
 * AC-3: the deliberately failing spec is committed and always fails. The default run must
 * not execute it, and only `--journey HARNESS-RED` may.
 */
const DELIBERATE_RED = 'HARNESS-RED';

const bin = (name) => join(REPO, 'node_modules', '.bin', name);

/** `--journey <J>` / `--journey=<J>`, and nothing else. */
function parseArgs(argv) {
  let journey;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--journey') {
      journey = argv[index + 1];
      index += 1;
      if (journey === undefined) return { error: 'e2e: --journey needs a value, e.g. J-000' };
      continue;
    }
    if (arg.startsWith('--journey=')) {
      journey = arg.slice('--journey='.length);
      continue;
    }
    return { error: `e2e: unknown argument "${arg}" — usage: pnpm e2e [--journey <J>]` };
  }
  return journey === undefined || journey.trim() === '' ? {} : { journey };
}

/** The V-DB lane's own scratch database (scripts/test-db.mjs), which this lane must not take. */
const TEST_DATABASE = (() => {
  const name = process.env['CUBIT_TEST_DB'];
  return name === undefined || name.trim() === '' ? 'cubit_test' : name;
})();

const clusterOf = (url) => {
  const parsed = new URL(url);
  return `${parsed.hostname}:${parsed.port === '' ? '5432' : parsed.port}`;
};

/**
 * Every database this lane may not drop, and why. DATABASE_URL's is the one somebody works
 * in (B-05); DATABASE_ADMIN_URL's is the maintenance database the drop is *issued from*, so
 * dropping it would be sawing through the branch mid-statement; CUBIT_TEST_DB's belongs to
 * the V-DB lane, and a `pnpm test:db` running beside this one would have its database pulled
 * out from under it with (force) — which is what db/__tests__/support/live.ts had to learn to
 * survive.
 */
function protectedDatabases() {
  return [
    {
      name: targetDatabase(appUrl()),
      why: 'the database DATABASE_URL points at',
      cluster: clusterOf(appUrl()),
    },
    {
      name: targetDatabase(adminUrl()),
      why: 'the maintenance database DATABASE_ADMIN_URL connects to, which this lane issues its drop from',
      cluster: clusterOf(adminUrl()),
    },
    {
      name: TEST_DATABASE,
      why: "the V-DB lane's scratch database (CUBIT_TEST_DB)",
      cluster: clusterOf(appUrl()),
    },
  ];
}

/**
 * B-05: "the dev database is never touched" is prose until something compares the names.
 * This lane drops what CUBIT_E2E_DB names, with force; one stale export is all it takes for
 * that to be a name somebody else is holding, so the run refuses here — before a connection
 * is opened and long before anything is dropped.
 *
 * The comparison is by name across all three handles, deliberately, and not by
 * host/port/name together: a match on a *different* cluster is far likelier to be a
 * mispointed URL than a genuine intention to drop a same-named database elsewhere, and the
 * cost of over-refusing is a message, while the cost of under-refusing is somebody's data.
 * The cluster each name came from is in the message so the mistake is visible.
 */
function refusesToDropTheAppDatabase() {
  const clash = protectedDatabases().find((entry) => entry.name === DATABASE);
  if (clash === undefined) return undefined;
  const here = clusterOf(adminUrl());
  const elsewhere = clash.cluster === here ? '' : ` on ${clash.cluster}`;
  return (
    `e2e: CUBIT_E2E_DB names "${DATABASE}", which is ${clash.why}${elsewhere}.\n` +
    `This lane drops its database with (force) on ${here}. ` +
    `Point CUBIT_E2E_DB at a database of its own.`
  );
}

/**
 * A child process, with everything it says routed to stderr. The contract lines are this
 * lane's own and belong on stdout alone; a build's progress and a runner's report are
 * detail, however much of it there is (scripts/lib/lane.mjs).
 */
function child(file, args, env = {}, options = {}) {
  return spawn(file, args, {
    cwd: REPO,
    env: { ...process.env, FORCE_COLOR: '0', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
}

function pipeToDetail(running) {
  running.stdout?.on('data', (chunk) => process.stderr.write(chunk));
  running.stderr?.on('data', (chunk) => process.stderr.write(chunk));
}

function runToCompletion(file, args, env = {}) {
  return new Promise((resolve) => {
    const running = child(file, args, env);
    pipeToDetail(running);
    running.on('error', (error) => {
      detail(`e2e: ${file} — ${error.message}`);
      resolve(1);
    });
    running.on('close', (code) => resolve(code ?? 1));
  });
}

/** The cold database, made from nothing, owned by the migrate role (V-DB's bootstrap). */
async function provision() {
  const admin = new pg.Client({ connectionString: adminUrl() });
  await admin.connect();
  try {
    await ensureRoles(admin);
    await admin.query(`drop database if exists ${quoteIdent(DATABASE)} with (force)`);
    await admin.query(`create database ${quoteIdent(DATABASE)} owner "cubit_migrate"`);
  } finally {
    await admin.end();
  }
}

/** The served app answers, or it never will. Loopback only — the lane has no other address. */
async function waitForServer(url, server, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = 'no response';
  while (Date.now() < deadline) {
    if (server.exitCode !== null) return `next start exited ${server.exitCode} before it served`;
    try {
      const response = await fetch(url, { redirect: 'manual' });
      if (response.status < 500) return undefined;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return `${url} did not answer within ${timeoutMs}ms (${lastError})`;
}

/**
 * The server, and the process group under it. `next start` is a parent: killing the pid
 * alone can leave a worker holding 3211, and the next run would then test the last run's
 * build.
 */
function stopServer(server) {
  return new Promise((resolve) => {
    if (server.exitCode !== null || server.pid === undefined) {
      resolve();
      return;
    }
    const killer = setTimeout(() => {
      try {
        process.kill(-server.pid, 'SIGKILL');
      } catch {
        /* already gone */
      }
    }, 5_000);
    server.on('close', () => {
      clearTimeout(killer);
      resolve();
    });
    try {
      process.kill(-server.pid, 'SIGTERM');
    } catch {
      clearTimeout(killer);
      resolve();
    }
  });
}

/**
 * Playwright's own title filter. Without `--journey` the lane runs everything except the
 * spec that fails on purpose; with it, the caller's value is the filter and nothing is
 * excluded — `--journey HARNESS-RED` is how a person asks to see the lane go red (AC-3).
 */
function grepArgs(journey) {
  return journey === undefined ? ['--grep-invert', DELIBERATE_RED] : ['--grep', journey];
}

async function runJourneys(journey, env) {
  const args = ['test', '--config', 'playwright.config.ts', ...grepArgs(journey)];
  return runToCompletion(bin('playwright'), args, env);
}

async function main() {
  const startedAt = performance.now();

  if (!hasInputDir(SPECS)) {
    skipLane('e2e');
    return;
  }

  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.error !== undefined) {
    detail(parsed.error);
    say('e2e: FAIL');
    process.exitCode = 2;
    return;
  }

  const refusal = refusesToDropTheAppDatabase();
  if (refusal !== undefined) {
    detail(refusal);
    say('e2e: FAIL');
    process.exitCode = 1;
    return;
  }

  const url = urlForDatabase(appUrl(), DATABASE);
  const served = `http://127.0.0.1:${PORT}`;
  /**
   * What the build, the server and the runner all share: the scratch database, the lane's
   * own distDir, and a font configuration of the lane's own. The baselines are committed
   * pixels, so which font the machine happens to prefer for `sans-serif` is part of the
   * contract, not of the machine (tests/e2e/setup/fonts.conf).
   */
  const laneEnv = {
    DATABASE_URL: url,
    CUBIT_E2E_DB: DATABASE,
    NEXT_DIST_DIR: DIST_DIR,
    E2E_PORT: String(PORT),
    FONTCONFIG_FILE: join(REPO, SPECS, 'setup', 'fonts.conf'),
  };

  const fail = (line) => {
    detail(line);
    say('e2e: FAIL');
    process.exitCode = 1;
  };

  // Once. The server serves this build, and the journeys never rebuild between specs.
  const built = await runToCompletion(bin('next'), ['build'], laneEnv);
  if (built !== 0) {
    fail(`e2e: next build exited ${built}`);
    return;
  }

  try {
    await provision();
  } catch (error) {
    fail(error instanceof Error ? (error.stack ?? error.message) : String(error));
    return;
  }

  const migrated = await runToCompletion(
    process.execPath,
    [join(REPO, 'scripts', 'db-migrate.mjs')],
    laneEnv,
  );
  if (migrated !== 0) {
    fail(`e2e: db:migrate exited ${migrated} against ${DATABASE}`);
    return;
  }

  const seeded = await runToCompletion(
    process.execPath,
    [join(REPO, 'scripts', 'seed.mjs')],
    laneEnv,
  );
  if (seeded !== 0) {
    fail(`e2e: seed exited ${seeded} against ${DATABASE}`);
    return;
  }

  const server = child(
    bin('next'),
    ['start', '--hostname', '127.0.0.1', '--port', String(PORT)],
    laneEnv,
    // Its own process group: `next start` is a parent, and killing the pid alone can leave
    // a worker holding 3211 for the next run to test the last run's build against.
    { detached: true },
  );
  server.on('error', (error) => detail(`e2e: next start — ${error.message}`));
  pipeToDetail(server);

  // The runner's own answer, captured before anything is torn down (AC-3).
  let ran = 1;
  try {
    const unserved = await waitForServer(served, server);
    if (unserved !== undefined) {
      detail(`e2e: ${unserved}`);
    } else {
      ran = await runJourneys(parsed.journey, laneEnv);
    }
  } finally {
    await stopServer(server);
  }

  if (ran !== 0) {
    detail(`e2e: the journeys exited ${ran}`);
    say('e2e: FAIL');
    process.exitCode = 1;
    return;
  }
  say(`e2e: ok (${((performance.now() - startedAt) / 1000).toFixed(1)}s)`);
}

await main();

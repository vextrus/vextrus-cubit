/**
 * `pnpm e2e [--journey <J-nnn>]… [--update-baselines]` — V-E2E.
 *
 * "Builds once, … starts web (3211) …, runs Playwright journeys (J-nnn) with traces,
 * screenshots at named checkpoints, video on failure, axe on every checkpoint page, and
 * visual comparisons against committed Linux baselines."
 *
 * A journey id maps to one spec: `J-004` → `tests/e2e/j-004-*.spec.ts`. An id no spec answers
 * is not a failure and is not silence either — it prints its own recorded reason,
 * `e2e: <J> SKIP JOURNEY_NOT_YET_WRITTEN`, and exits 0. That is what keeps C-09 ("J-000 runs
 * on every merge to main") honest before J-000 is written: the lane says, by name, that the
 * journey does not exist yet, rather than reporting a pass nobody ran. The line rides stdout
 * because the gate reports stderr after stdout, so a contract split across the two streams
 * reads out of order.
 *
 * With no `--journey` the lane runs every journey spec that exists. With nothing to run at
 * all — every requested journey unwritten, or no spec in the tree — nothing is built and
 * nothing is served: a `next build` for a suite of zero tests is two minutes of nothing.
 */
import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { REPO, detail, say } from './lib/lane.mjs';

/** The recorded reason for a journey id the tree has no spec for. */
const JOURNEY_NOT_YET_WRITTEN = 'SKIP JOURNEY_NOT_YET_WRITTEN';

/** C-07: the e2e build serves on 3211 unless the harness offsets the lane. */
const PORT = Number(process.env['E2E_PORT'] ?? 3211);

/** Where the journeys live, and the shape of a journey file name. */
const E2E_DIR = join(REPO, 'tests', 'e2e');
const SPEC = /^j-(\d{3})-.*\.spec\.ts$/;

/** How long the started server is given to answer before the lane gives up on it. */
const START_TIMEOUT_MS = 60_000;
const POLL_MS = 250;

/** `--journey J-004 --journey J-000 --update-baselines`, as the caller wrote it. */
function parseArgs(argv) {
  const journeys = [];
  let updateBaselines = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--journey') {
      const value = argv[index + 1];
      if (value !== undefined) journeys.push(value);
      index += 1;
      continue;
    }
    if (arg.startsWith('--journey=')) {
      journeys.push(arg.slice('--journey='.length));
      continue;
    }
    if (arg === '--update-baselines') updateBaselines = true;
  }
  return { journeys, updateBaselines };
}

/** Every journey spec in the tree: `J-004` → `tests/e2e/j-004-design.spec.ts`. */
function specsByJourney() {
  const found = new Map();
  if (!existsSync(E2E_DIR)) return found;
  for (const entry of readdirSync(E2E_DIR)) {
    const match = SPEC.exec(entry);
    if (match === null) continue;
    found.set(`J-${match[1]}`, join('tests', 'e2e', entry));
  }
  return found;
}

/** One child process, run to completion with its output on the lane's own streams. */
function run(command, args, env) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: REPO,
      stdio: ['ignore', 'inherit', 'inherit'],
      env: { ...process.env, ...env },
    });
    child.on('error', (error) => {
      detail(error.message);
      resolve(1);
    });
    child.on('close', (code) => resolve(code ?? 1));
  });
}

/** Next's own CLI, driven through node so the lane never depends on a PATH shim. */
const NEXT_BIN = join(REPO, 'node_modules', 'next', 'dist', 'bin', 'next');
const PLAYWRIGHT_BIN = join(REPO, 'node_modules', '@playwright', 'test', 'cli.js');

/** The server, started and left running; the caller stops it. */
function startServer() {
  const child = spawn(process.execPath, [NEXT_BIN, 'start', '-p', String(PORT)], {
    cwd: REPO,
    stdio: ['ignore', 'inherit', 'inherit'],
    env: { ...process.env, PORT: String(PORT) },
  });
  return child;
}

/** Answering is the only definition of started that means anything. */
async function waitForServer() {
  const deadline = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${String(PORT)}/design`);
      if (response.status < 500) return true;
    } catch {
      // Not up yet. The deadline is the only thing that decides this loop.
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  return false;
}

/** Stop the server and wait for the port to be given back. */
function stopServer(child) {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve();
      return;
    }
    child.once('close', () => resolve());
    child.kill('SIGTERM');
  });
}

async function main() {
  const { journeys, updateBaselines } = parseArgs(process.argv.slice(2));
  const specs = specsByJourney();

  const running = [];
  if (journeys.length === 0) {
    for (const spec of [...specs.entries()].sort().map(([, path]) => path)) running.push(spec);
  } else {
    for (const journey of journeys) {
      const spec = specs.get(journey);
      if (spec === undefined) {
        say(`e2e: ${journey} ${JOURNEY_NOT_YET_WRITTEN}`);
        continue;
      }
      running.push(spec);
    }
  }

  if (running.length === 0) {
    // Every requested journey is unwritten (or the tree holds no journey at all). The lane
    // has said so, by name, on stdout; building an app to run nothing would say it slower.
    return 0;
  }

  const built = await run(process.execPath, [NEXT_BIN, 'build'], {});
  if (built !== 0) {
    detail(`e2e: next build exited ${String(built)}`);
    return built;
  }

  const server = startServer();
  try {
    if (!(await waitForServer())) {
      detail(`e2e: no answer from http://127.0.0.1:${String(PORT)} within 60s`);
      return 1;
    }
    const args = [PLAYWRIGHT_BIN, 'test', ...running];
    if (updateBaselines) args.push('--update-snapshots');
    return await run(process.execPath, args, { E2E_PORT: String(PORT) });
  } finally {
    await stopServer(server);
  }
}

process.exitCode = await main();

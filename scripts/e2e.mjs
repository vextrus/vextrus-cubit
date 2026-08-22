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

/**
 * The recorded reason for a bare `pnpm e2e` over a tree that holds no journey spec at all.
 * C-06 forbids a silently passed lane: the "run everything" path has no journey id to name,
 * so it names the condition instead rather than exiting 0 on an empty stream.
 */
const NO_JOURNEYS_YET_WRITTEN = 'SKIP NO_JOURNEYS_YET_WRITTEN';

/** C-07: the e2e build serves on 3211 unless the harness offsets the lane. */
const PORT = Number(process.env['E2E_PORT'] ?? 3211);

/** Where the journeys live, and the shape of a journey file name. */
const E2E_DIR = join(REPO, 'tests', 'e2e');
const SPEC = /^j-(\d{3})-.*\.spec\.ts$/;

/** How long the started server is given to answer before the lane gives up on it. */
const START_TIMEOUT_MS = 60_000;
const POLL_MS = 250;

/** How long a server gets to honour SIGTERM before the lane stops asking politely. */
const STOP_TIMEOUT_MS = 10_000;

/** How long the preflight waits for an answer from a port that should be nobody's. */
const PREFLIGHT_TIMEOUT_MS = 2_000;

/**
 * Q-06 asks the same pixels of two machines. Text is the one thing a machine renders out of
 * its own installation rather than out of this tree: `--font-ui` names Inter, 'Helvetica
 * Neue', Arial, sans-serif, and no face is shipped, so whichever of those the host happens to
 * have installed decides every glyph advance on an 8000-px page — far past maxDiffPixelRatio
 * 0.002. A developer box with only DejaVu and a CI runner that gets fonts-liberation from
 * `playwright install --with-deps` (fontconfig aliases Arial → Liberation Sans, ahead of
 * sans-serif) do not draw the same page.
 *
 * So the lane fixes the resolution instead of hoping: tests/e2e/fonts.conf maps every family
 * the token stack names onto the DejaVu faces both environments carry, and every process the
 * lane starts renders through it. A machine missing DejaVu is a machine that reddens loudly
 * on the baseline, which is the correct outcome rather than a silent substitution.
 */
const FONTS_CONF = join(E2E_DIR, 'fonts.conf');

/** Point fontconfig — and so Chromium — at the lane's own configuration. */
function pinFonts() {
  if (!existsSync(FONTS_CONF)) {
    detail(`e2e: no ${FONTS_CONF}; screenshots render through this host's own fonts`);
    return;
  }
  process.env['FONTCONFIG_FILE'] = FONTS_CONF;
}

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

/** One GET against the lane's port, or `null` when nothing answered. */
async function probe(timeoutMs) {
  try {
    const response = await fetch(`http://127.0.0.1:${String(PORT)}/design`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    return response.status;
  } catch {
    return null;
  }
}

/**
 * Nobody may be listening on the lane's port before the lane starts. A leftover server from an
 * earlier run answers every poll below, so Playwright would drive a build nobody just made —
 * green or red, its verdict would be about the wrong tree, and `--update-baselines` in that
 * state would rewrite the committed PNGs from it. The port is checked, by name, first.
 */
async function preflight() {
  const status = await probe(PREFLIGHT_TIMEOUT_MS);
  if (status === null) return true;
  detail(
    `e2e: something is already serving http://127.0.0.1:${String(PORT)}/design ` +
      `(HTTP ${String(status)}) — stop it, or run with another E2E_PORT; the lane will not ` +
      'test a build it did not make',
  );
  return false;
}

/** The server, started and left running; the caller stops it. */
function startServer() {
  const child = spawn(process.execPath, [NEXT_BIN, 'start', '-p', String(PORT)], {
    cwd: REPO,
    stdio: ['ignore', 'inherit', 'inherit'],
    env: { ...process.env, PORT: String(PORT) },
  });
  // A child that dies is remembered here rather than diagnosed 60 seconds later as silence.
  child.on('error', (error) => {
    detail(`e2e: next start could not be spawned: ${error.message}`);
  });
  return child;
}

/** Has this child already gone? */
function isDead(child) {
  return child.exitCode !== null || child.signalCode !== null;
}

/**
 * Answering is the only definition of started that means anything — but a process that has
 * exited will never answer, and waiting out the full deadline for it reports the wrong fault.
 * The loop therefore watches the child as well as the port and returns the moment either
 * settles it.
 */
async function waitForServer(child) {
  const deadline = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (isDead(child)) {
      const how =
        child.signalCode === null ? `exited ${String(child.exitCode)}` : `died on ${child.signalCode}`;
      detail(`e2e: next start ${how} before it answered — see its output above`);
      return false;
    }
    const status = await probe(POLL_MS * 4);
    if (status !== null && status < 500) return true;
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  detail(
    `e2e: no answer from http://127.0.0.1:${String(PORT)}/design within ` +
      `${String(START_TIMEOUT_MS / 1000)}s (the server process is still running)`,
  );
  return false;
}

/**
 * Stop the server and wait for the port to be given back — with an end to the waiting. A Next
 * server that is slow on SIGTERM, or a worker of its own that never sees one, would otherwise
 * hold `pnpm e2e` open past Playwright's verdict until CI's job timeout kills the whole run.
 */
function stopServer(child) {
  return new Promise((resolve) => {
    if (isDead(child)) {
      resolve();
      return;
    }
    let timer = null;
    const done = () => {
      if (timer !== null) clearTimeout(timer);
      resolve();
    };
    child.once('close', done);
    child.kill('SIGTERM');
    timer = setTimeout(() => {
      detail(`e2e: the server ignored SIGTERM for ${String(STOP_TIMEOUT_MS / 1000)}s — SIGKILL`);
      child.kill('SIGKILL');
      // Even SIGKILL is delivered to a process, not to a promise: the lane stops waiting on
      // it after one more grace period rather than hanging on a child that cannot be reaped.
      timer = setTimeout(done, STOP_TIMEOUT_MS);
    }, STOP_TIMEOUT_MS);
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
    // Every requested journey is unwritten, and the lane has said so by name on stdout;
    // building an app to run nothing would say it slower. The one path with no journey id
    // to name — a bare `pnpm e2e` over an empty spec tree — still records its reason, so a
    // bad testDir or a renamed spec is never a silent green (C-06).
    if (journeys.length === 0) say(`e2e: ${NO_JOURNEYS_YET_WRITTEN}`);
    return 0;
  }

  if (!(await preflight())) return 1;
  pinFonts();

  const built = await run(process.execPath, [NEXT_BIN, 'build'], {});
  if (built !== 0) {
    detail(`e2e: next build exited ${String(built)}`);
    return built;
  }

  const server = startServer();
  try {
    if (!(await waitForServer(server))) return 1;
    const args = [PLAYWRIGHT_BIN, 'test', ...running];
    if (updateBaselines) args.push('--update-snapshots');
    return await run(process.execPath, args, { E2E_PORT: String(PORT) });
  } finally {
    await stopServer(server);
  }
}

process.exitCode = await main();

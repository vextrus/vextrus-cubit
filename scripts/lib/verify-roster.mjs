/**
 * The verify roster: what the stages are, how one is run, and the grammar of the contract
 * lines they print (V-VERIFY, AC-1).
 *
 * It lives beside verify.mjs rather than inside it so the contract can be judged by a test
 * in the tree's own suite. verify's fourth stage is `vitest run`, so a test cannot spawn the
 * real verify without running itself; what it can do — and what tests/toolchain/verify.test.ts
 * does — is read the real STAGES exported here, and drive runRoster over a stubbed roster to
 * prove the line grammar, the order and the fail-fast branch.
 */
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { LANE_NOT_YET_BUILT, REPO, hasInputDir } from './lane.mjs';
import { checkSchemaDrift } from './schema-drift.mjs';

const bin = (name) => join(REPO, 'node_modules', '.bin', name);

/**
 * The roster, in order. `input` is the directory whose absence skips the stage; a stage
 * with no `input` is armed always. A stage is either a command (`file`/`args`) or a `run`
 * function, for a check that is a comparison rather than one exit code.
 */
export const STAGES = [
  { name: 'typegen', input: 'src/app', file: bin('next'), args: ['typegen'] },
  { name: 'tsc', file: bin('tsc'), args: ['--noEmit'] },
  { name: 'eslint', file: bin('eslint'), args: ['.'] },
  { name: 'vitest', file: bin('vitest'), args: ['run'] },
  { name: 'db-drift', input: 'db/schema', run: () => checkSchemaDrift(REPO) },
  {
    name: 'method-hashes',
    input: 'src/core/methods',
    file: process.execPath,
    args: [join(REPO, 'scripts', 'method-hashes.mjs')],
  },
  {
    name: 'catalogue-drift',
    input: 'src/core/catalogue',
    file: null,
    unwired:
      'catalogue-drift: src/core/catalogue exists, but no drift command is wired. The ' +
      'increment that delivers the work-item catalogue must wire the bears-table drift ' +
      'check, and its spec must be tagged `toolchain` and name scripts/verify.mjs (C-06).',
  },
  {
    name: 'cad-ruff',
    input: 'cad',
    file: 'uv',
    args: ['run', '--frozen', 'ruff', 'check', '.'],
    cwd: join(REPO, 'cad'),
  },
  {
    name: 'cad-pytest',
    input: 'cad/tests',
    file: 'uv',
    args: ['run', '--frozen', 'pytest', '-q'],
    cwd: join(REPO, 'cad'),
  },
  {
    name: 'build',
    input: 'src/app',
    file: bin('next'),
    args: ['build'],
    // "cold into its own distDir": a verify build never consumes or poisons the dev
    // build. Next reads distDir from next.config, so the increment that delivers the app
    // must read NEXT_DIST_DIR there; .next-verify is gitignored for it already.
    env: { NEXT_DIST_DIR: '.next-verify' },
  },
];

/** Run one stage. `{ ok, output }` — output is everything the machine said, never contract. */
export function runStage(stage) {
  if (stage.run !== undefined) return stage.run();
  if (stage.file === null) return { ok: false, output: stage.unwired };
  const result = spawnSync(stage.file, stage.args, {
    cwd: stage.cwd ?? REPO,
    env: { ...process.env, CI: '1', FORCE_COLOR: '0', ...(stage.env ?? {}) },
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error !== undefined) {
    return { ok: false, output: `${stage.name}: ${stage.file} — ${result.error.message}` };
  }
  return { ok: result.status === 0, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

/**
 * The whole contract in one function: one line per stage in roster order, fail-fast, and
 * the final wall-time line only when nothing failed. Returns the exit code.
 */
export async function runRoster(stages, io) {
  const { say, detail, isArmed = hasInputDir, run = runStage, now = () => performance.now() } = io;
  const startedAt = now();
  for (const stage of stages) {
    if (stage.input !== undefined && !isArmed(stage.input)) {
      say(`verify: ${stage.name} ${LANE_NOT_YET_BUILT}`);
      continue;
    }
    const stageStartedAt = now();
    const outcome = await run(stage);
    const ms = Math.round(now() - stageStartedAt);
    if (outcome.ok) {
      say(`verify: ${stage.name} ok (${ms}ms)`);
      continue;
    }
    // Fail-fast: the first failure is the answer, and everything after it is noise.
    detail(outcome.output);
    say(`verify: ${stage.name} FAIL (${ms}ms)`);
    return 1;
  }
  say(`verify: ok (${((now() - startedAt) / 1000).toFixed(1)}s)`);
  return 0;
}

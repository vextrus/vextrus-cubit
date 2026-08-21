/**
 * `pnpm verify` — V-VERIFY: "`next typegen` → `tsc --noEmit` → `eslint .` → `vitest run` →
 * schema drift → method-hash manifest → catalogue/bears table drift → `ruff check` +
 * `pytest` (cad) → `next build` cold into its own distDir. Fail-fast; exit code is the
 * whole contract; wall time printed."
 *
 * Two rules hold this file together:
 *
 *   1. The contract lives on stdout. One line per roster stage, in roster order, then the
 *      final line. Everything a stage says for itself is captured and re-emitted on
 *      stderr, so `pnpm verify 2>/dev/null` still reads the whole contract, and the
 *      gate — which reports stderr after stdout — never interleaves the two.
 *   2. A stage arms when its input root exists, and skips with the recorded reason when it
 *      does not (C-06). Never a config flag, never an env var: the tree decides, so an
 *      increment cannot arm a lane by wishing.
 */
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { LANE_NOT_YET_BUILT, REPO, detail, hasInputDir, say } from './lib/lane.mjs';

const bin = (name) => join(REPO, 'node_modules', '.bin', name);

/** Schema drift generates here: gitignored, cold on every run, tree untouched. */
const DRIFT_SCRATCH = join(REPO, '.scratch', 'db-drift');

const coldScratch = () => {
  rmSync(DRIFT_SCRATCH, { recursive: true, force: true });
};

/**
 * The roster, in order. `input` is the directory whose absence skips the stage; a stage
 * with no `input` is armed always.
 */
const STAGES = [
  { name: 'typegen', input: 'src/app', file: bin('next'), args: ['typegen'] },
  { name: 'tsc', file: bin('tsc'), args: ['--noEmit'] },
  { name: 'eslint', file: bin('eslint'), args: ['.'] },
  { name: 'vitest', file: bin('vitest'), args: ['run'] },
  {
    name: 'db-drift',
    input: 'db/schema',
    file: bin('drizzle-kit'),
    args: ['generate', '--config', 'drizzle.config.ts', '--out', DRIFT_SCRATCH],
    before: coldScratch,
  },
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
    // "cold into its own distDir": a verify build never consumes or poisons the dev build.
    env: { NEXT_DIST_DIR: '.next-verify' },
  },
];

function runStage(stage) {
  if (stage.file === null) return { ok: false, output: stage.unwired };
  stage.before?.();
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

const startedAt = performance.now();
let failed = false;

for (const stage of STAGES) {
  if (stage.input !== undefined && !hasInputDir(stage.input)) {
    say(`verify: ${stage.name} ${LANE_NOT_YET_BUILT}`);
    continue;
  }
  const stageStartedAt = performance.now();
  const outcome = runStage(stage);
  const ms = Math.round(performance.now() - stageStartedAt);
  if (outcome.ok) {
    say(`verify: ${stage.name} ok (${ms}ms)`);
    continue;
  }
  // Fail-fast: the first failure is the answer, and everything after it is noise.
  detail(outcome.output);
  say(`verify: ${stage.name} FAIL (${ms}ms)`);
  failed = true;
  break;
}

if (failed) {
  process.exitCode = 1;
} else {
  say(`verify: ok (${((performance.now() - startedAt) / 1000).toFixed(1)}s)`);
}

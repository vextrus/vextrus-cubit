/**
 * V-VERIFY — the gate, in one process.
 *
 *   next typegen → tsc --noEmit → eslint . → vitest run → schema drift →
 *   method-hash manifest → catalogue drift → ruff → pytest → next build
 *
 * Fail-fast; the exit code is the whole contract; the wall time is printed.
 *
 * Two properties this file exists to keep:
 *
 *  1. Every contract line goes to stdout. The gate reports stderr after
 *     stdout, so `pnpm verify 2>/dev/null` must still carry the whole roster
 *     and the verdict. A failing stage's own output is diagnostics, not
 *     contract, and goes to stderr.
 *
 *  2. A stage that cannot run yet says so. Arming is decided by one thing —
 *     whether the stage's input root exists in the tree. Never a config flag,
 *     never an environment variable (C-06).
 */
import { spawnSync } from 'node:child_process';
import { NOT_YET_BUILT, ROOT, at, hasInput, say } from './lib/lane.mjs';

/** node_modules/.bin/<name>, so no stage pays pnpm's start-up twice. */
const bin = (name) => at(`node_modules/.bin/${name}`);

/**
 * The roster, in the order V-VERIFY states it.
 *
 * `input` is the directory whose absence skips the stage; `null` means the
 * stage is armed in every tree. `command` is the argv the stage runs once it
 * is armed — `null` marks a stage whose command arrives with the increment
 * that lands its input, and being armed without one is a failure, never a
 * silent pass.
 *
 * @type {ReadonlyArray<{
 *   name: string,
 *   input: string | null,
 *   command: readonly [string, readonly string[]] | null,
 *   cwd?: string,
 * }>}
 */
const ROSTER = [
  { name: 'typegen', input: 'src/app', command: [bin('next'), ['typegen']] },
  { name: 'tsc', input: null, command: [bin('tsc'), ['--noEmit']] },
  { name: 'eslint', input: null, command: [bin('eslint'), ['.']] },
  { name: 'vitest', input: null, command: [bin('vitest'), ['run']] },
  // The three stages below have no command yet, and a command is not something
  // that can be written in advance of the thing it checks:
  //
  //   db-drift        V-VERIFY's check is "generate into scratch and compare
  //                   against the committed migrations". `drizzle-kit generate`
  //                   into an empty scratch --out has no journal to compare
  //                   with, regenerates the whole schema and exits 0 either
  //                   way, so it would answer `ok` for a drifted tree.
  //   method-hashes   the manifest is a file that does not exist; scripts/
  //                   method-hashes.mjs is the skeleton C-06 asks for.
  //   catalogue-drift there is no catalogue table to drift from.
  //
  // Each one is armed by its input root all the same, so the increment that
  // lands the input meets a loud failure with a recorded reason rather than a
  // green light nobody earned (C-06: never silently passed).
  { name: 'db-drift', input: 'db/schema', command: null },
  { name: 'method-hashes', input: 'src/core/methods', command: null },
  { name: 'catalogue-drift', input: 'src/core/catalogue', command: null },
  {
    name: 'cad-ruff',
    input: null,
    command: ['uv', ['run', '--frozen', 'ruff', 'check', '.']],
    cwd: at('cad'),
  },
  {
    name: 'cad-pytest',
    input: 'cad/tests',
    command: ['uv', ['run', '--frozen', 'pytest', '-q']],
    cwd: at('cad'),
  },
  {
    name: 'build',
    input: 'src/app',
    // V-VERIFY wants a cold build into a distDir of its own, never the dev
    // server's `.next`. Next reads `distDir` from next.config and from nowhere
    // else — there is no CLI flag for it and no environment variable — so this
    // command belongs to the increment that lands src/app and its next.config,
    // where `distDir: '.next-verify'` can actually be written. Until then the
    // stage stays unwired rather than wired to a build that stomps `.next`.
    command: null,
  },
];

/** @param {number} startedAt */
const sinceMs = (startedAt) => Math.round(Number(process.hrtime.bigint() - startedAt) / 1e6);

const startedAt = process.hrtime.bigint();

for (const stage of ROSTER) {
  if (stage.input !== null && !hasInput(stage.input)) {
    say(`verify: ${stage.name} SKIP ${NOT_YET_BUILT}`);
    continue;
  }

  const stageStartedAt = process.hrtime.bigint();

  if (stage.command === null) {
    say(`verify: ${stage.name} FAIL (${sinceMs(stageStartedAt)}ms)`);
    process.stderr.write(
      `${stage.name}: ${stage.input} exists but no command is wired to it. ` +
        'The increment that lands this input owns the stage command (C-06).\n',
    );
    process.exit(1);
  }

  const [file, args] = stage.command;
  const result = spawnSync(file, [...args], {
    cwd: stage.cwd ?? ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });

  const elapsedMs = sinceMs(stageStartedAt);
  const failed = result.status !== 0 || result.error !== undefined;

  if (failed) {
    say(`verify: ${stage.name} FAIL (${elapsedMs}ms)`);
    // Diagnostics are not contract: stderr, so 2>/dev/null keeps the roster.
    process.stderr.write(`--- ${stage.name} ---\n`);
    if (result.error !== undefined) {
      process.stderr.write(`${result.error.message}\n`);
    }
    process.stderr.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
    process.exit(1);
  }

  say(`verify: ${stage.name} ok (${elapsedMs}ms)`);
}

say(`verify: ok (${(sinceMs(startedAt) / 1000).toFixed(1)}s)`);

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
import { NOT_YET_BUILT, ROOT, hasInput, say } from './lib/lane.mjs';
import { ROSTER } from './lib/roster.mjs';

/** @param {bigint} startedAt a `process.hrtime.bigint()` reading */
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

#!/usr/bin/env node
/**
 * pnpm verify — V-VERIFY. Fail-fast; the exit code is the whole contract; the
 * wall time is printed.
 *
 * C-06: stages arm progressively during increment zero. A lane that does not
 * exist yet prints exactly `SKIP <stage> LANE_NOT_YET_BUILT` — named, recorded,
 * never silently passed. From increment one every stage is armed.
 *
 * The whole run reports on one stream. Every stage's stderr is merged into our
 * stdout and verify itself never writes to stderr, so `VERIFY OK <seconds>s` is
 * the last line a reader sees however it captures us — a tool's warning on the
 * other stream must not be able to land after the summary.
 */
import { loadEnv, run, seconds, wholeSeconds } from './lib/run.mjs';

loadEnv();

/** In order. `skip` carries the reason a stage is not armed yet. */
const STAGES = [
  { name: 'typegen', command: ['pnpm', ['exec', 'next', 'typegen']] },
  { name: 'tsc', command: ['pnpm', ['exec', 'tsc', '--noEmit']] },
  { name: 'eslint', command: ['pnpm', ['exec', 'eslint', '.']] },
  { name: 'vitest', command: ['pnpm', ['exec', 'vitest', 'run']] },
  { name: 'schema-drift', command: ['node', ['scripts/db-drift.mjs']] },
  { name: 'method-hashes', skip: 'LANE_NOT_YET_BUILT' },
  { name: 'catalogue-drift', skip: 'LANE_NOT_YET_BUILT' },
  { name: 'cad', skip: 'LANE_NOT_YET_BUILT' },
  {
    name: 'build',
    // cold, into its own distDir, so verify never fights a running dev server
    command: ['pnpm', ['exec', 'next', 'build']],
    env: { NEXT_DIST_DIR: '.next-verify' },
  },
];

const startedAt = Date.now();

for (const stage of STAGES) {
  if (stage.skip !== undefined) {
    console.log(`SKIP ${stage.name} ${stage.skip}`);
    continue;
  }

  const stageStartedAt = Date.now();
  const [command, args] = stage.command;
  const code = await run(command, args, { env: stage.env ?? {}, mergeStderr: true });
  if (code !== 0) {
    console.log(`VERIFY FAIL ${stage.name} (exit ${code}) after ${wholeSeconds(startedAt)}s`);
    process.exit(code);
  }
  console.log(`OK ${stage.name} ${seconds(stageStartedAt)}s`);
}

console.log(`VERIFY OK ${wholeSeconds(startedAt)}s`);

/**
 * inc-000 acceptance — the fourteen unbuilt lanes announce themselves (AC-4, C-06).
 *
 * C-06: "a lane that does not exist yet is skipped with the recorded reason
 * LANE_NOT_YET_BUILT, never silently passed". Every script but verify and checkup is a
 * stub in this increment, and a stub that prints nothing is a silent pass.
 */
import { spawn } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const REPO = process.cwd();

type Ran = { code: number; stdout: string; stderr: string };

function run(cmd: string, args: string[]): Promise<Ran> {
  return new Promise<Ran>((resolve) => {
    const child = spawn(cmd, args, { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d: Buffer) => {
      stdout += d.toString('utf8');
    });
    child.stderr?.on('data', (d: Buffer) => {
      stderr += d.toString('utf8');
    });
    child.on('error', (e: Error) => resolve({ code: -1, stdout, stderr: `${stderr}${e.message}` }));
    child.on('close', (code) => resolve({ code: code ?? -1, stdout, stderr }));
  });
}

/**
 * AC-4: every script whose lane is not yet built — the full block minus verify and checkup.
 *
 * inc-001 armed three of them (`test:db`, `db:migrate`, `db:drift`) and took them off this
 * roster: C-06's recorded reason is for a lane that does not exist yet, and a built lane
 * that still printed it would be reporting a lie. Their contract lines are asserted by the
 * V-DB suite in db/__tests__, which is where a test that needs a database belongs.
 *
 * inc-007 armed four more the same way — `dev`, `build`, `start` and `e2e` are Next and
 * Playwright now, and the V-E2E lane's own contract lines (the journey skip, the baselines,
 * the CI job) are asserted in src/app/design/__tests__/lane.acceptance.test.ts, beside the
 * screen they exist for. `worker` and the rest are still unbuilt and still say so.
 */
const STUBS = [
  'worker',
  'test:golden',
  'test:docs',
  'test:perf',
  'seed',
  'gen:fixtures',
  'traceability',
];

describe('inc-000 — unbuilt lanes skip out loud (C-06)', () => {
  it.each(STUBS)(
    'AC-4 / C-06: `pnpm %s` prints its recorded reason on stdout and exits 0',
    async (script) => {
      const ran = await run('pnpm', ['run', script]);
      // C-06: never an error — the lane is unbuilt, not broken.
      expect(ran.code).toBe(0);
      // C-06: never a silent pass — the recorded reason is on stdout, so it survives 2>/dev/null.
      expect(ran.stdout.split(/\r?\n/)).toContain(`${script}: SKIP LANE_NOT_YET_BUILT`);
    },
    120_000,
  );
});

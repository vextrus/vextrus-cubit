/**
 * inc-000 acceptance — the machine's report (AC-3, V-CHECKUP, C-06).
 *
 * V-CHECKUP: "node/pnpm/uv/typst/libredwg pins and hashes, Postgres reachable, roles,
 * ledger drift, ports bindable, storage root, env; runs at session start." Only node,
 * pnpm and uv are armed in this increment; the rest carry the recorded reason rather
 * than a green light for a machine state nobody has defined yet.
 */
import { spawn } from 'node:child_process';
import { dirname } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO = process.cwd();

type Ran = { code: number; stdout: string; stderr: string };

function run(args: string[], env: NodeJS.ProcessEnv): Promise<Ran> {
  return new Promise<Ran>((resolve) => {
    const child = spawn('pnpm', args, { cwd: REPO, env, stdio: ['ignore', 'pipe', 'pipe'] });
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

const contractLines = (stdout: string): string[] =>
  stdout
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.startsWith('checkup:'));

/** AC-3: the item roster, in order, with this increment's arming. */
const EXPECTED = [
  'checkup: node ok',
  'checkup: pnpm ok',
  'checkup: uv ok',
  'checkup: typst SKIP LANE_NOT_YET_BUILT',
  'checkup: libredwg SKIP LANE_NOT_YET_BUILT',
  'checkup: postgres SKIP LANE_NOT_YET_BUILT',
  'checkup: ports SKIP LANE_NOT_YET_BUILT',
  'checkup: storage SKIP LANE_NOT_YET_BUILT',
  'checkup: env SKIP LANE_NOT_YET_BUILT',
  'checkup: ok',
];

describe('inc-000 — checkup reports the machine (V-CHECKUP)', () => {
  it(
    'AC-3 / V-CHECKUP: the item roster prints in order on stdout and exits 0',
    async () => {
      const ran = await run(['run', 'checkup'], process.env);
      expect(ran.code).toBe(0);
      // V-CHECKUP: the whole report is the contract, and it lives on stdout.
      expect(contractLines(ran.stdout)).toEqual(EXPECTED);
      // AC-3: `checkup: ok` is the last thing said.
      const lines = ran.stdout.split(/\r?\n/).filter((l) => l.trim().length > 0);
      expect(lines[lines.length - 1]).toBe('checkup: ok');
    },
    120_000,
  );

  it(
    'AC-3 / V-CHECKUP: a missing armed tool is a FAIL line and a nonzero exit',
    async () => {
      // Hide uv (it lives outside the Node bin directory) without touching the tree:
      // an armed item whose tool is absent must report, not shrug.
      const nodeBin = dirname(process.execPath);
      const ran = await run(['run', 'checkup'], { ...process.env, PATH: nodeBin });
      expect(ran.code).not.toBe(0);
      expect(ran.stdout).toMatch(/^checkup: uv FAIL .+$/m);
      // V-CHECKUP: a report that ends "ok" after a FAIL is a lie.
      expect(contractLines(ran.stdout)).not.toContain('checkup: ok');
      expect(contractLines(ran.stdout)).not.toContain('checkup: uv ok');
    },
    120_000,
  );
});

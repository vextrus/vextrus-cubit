/**
 * inc-000 acceptance — the verify roster and its contract lines (AC-1, V-VERIFY, C-06).
 *
 * verify's fourth stage is `vitest run`, so a test cannot spawn the real `pnpm verify`
 * without running itself. What it can do is judge the real thing rather than a copy: the
 * roster asserted here is the exported STAGES that scripts/verify.mjs runs, the arming is
 * read off this tree's own directories, and the line grammar and the fail-fast branch are
 * produced by the real runRoster/runStage. A regression in stage order, line format, SKIP
 * wording or the FAIL branch turns this red locally, not two pushes later.
 */
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  STAGES,
  runRoster,
  runStage,
  type Stage,
} from '../../scripts/lib/verify-roster.mjs';

const REPO = process.cwd();

/** AC-1 / test contract: the roster, fixed order. */
const ROSTER = [
  'typegen',
  'tsc',
  'eslint',
  'vitest',
  'db-drift',
  'method-hashes',
  'catalogue-drift',
  'cad-ruff',
  'cad-pytest',
  'build',
];

/** The arming rule, verbatim from the test contract: input root → stage. */
const INPUT_ROOTS: Record<string, string> = {
  typegen: 'src/app',
  build: 'src/app',
  'db-drift': 'db/schema',
  'method-hashes': 'src/core/methods',
  'catalogue-drift': 'src/core/catalogue',
  'cad-pytest': 'cad/tests',
  'cad-ruff': 'cad',
};

const isDir = (relative: string): boolean => {
  try {
    return statSync(join(REPO, relative)).isDirectory();
  } catch {
    return false;
  }
};

/** A recorder standing in for stdout and stderr, so the two streams stay distinguishable. */
function recorder() {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    say: (line: string) => stdout.push(line),
    detail: (text: string) => stderr.push(text),
  };
}

/** A clock that advances a fixed amount per reading, so the printed times are decidable. */
function clock(stepMs: number) {
  let at = 0;
  return () => {
    const now = at;
    at += stepMs;
    return now;
  };
}

describe('inc-000 — the verify roster is the real one (AC-1, V-VERIFY)', () => {
  it('AC-1: scripts/verify.mjs runs the roster in the fixed order, with no stage added or dropped', () => {
    expect(STAGES.map((s) => s.name)).toEqual(ROSTER);
  });

  it('C-06: every stage that arms on an input root names the root the contract names', () => {
    for (const stage of STAGES) {
      expect(stage.input ?? null, stage.name).toBe(INPUT_ROOTS[stage.name] ?? null);
    }
  });

  it('AC-1: against this tree, exactly tsc, eslint, vitest, db-drift and cad-ruff are armed', () => {
    // A stage arms when its input root exists and never otherwise (C-06), so this list is a
    // reading of the tree rather than a setting: db-drift joined it in inc-001, when
    // db/schema was founded, with no change to scripts/verify.mjs or to the roster.
    const armed = STAGES.filter((s) => s.input === undefined || isDir(s.input)).map((s) => s.name);
    expect(armed).toEqual(['tsc', 'eslint', 'vitest', 'db-drift', 'cad-ruff']);
  });
});

describe('inc-000 — the contract lines (AC-1, AC-6)', () => {
  const ok = { ok: true, output: 'chatter the contract never carries\n' };

  it('AC-1: one line per stage, in roster order, then the final wall-time line', async () => {
    const io = recorder();
    const stages: Stage[] = [
      { name: 'alpha' },
      { name: 'beta', input: 'not/here' },
      { name: 'gamma', input: 'here' },
    ];
    const code = await runRoster(stages, {
      ...io,
      isArmed: (input) => input === 'here',
      run: () => ok,
      now: clock(5),
    });
    expect(code).toBe(0);
    expect(io.stdout).toEqual([
      'verify: alpha ok (5ms)',
      'verify: beta SKIP LANE_NOT_YET_BUILT',
      'verify: gamma ok (5ms)',
      'verify: ok (0.0s)',
    ]);
    // AC-6: stdout carries the contract and nothing else — a passing stage's own output
    // is not a contract line, and is not printed at all.
    expect(io.stdout.every((line) => line.startsWith('verify: '))).toBe(true);
    expect(io.stderr.join('')).not.toContain('chatter');
  });

  it('AC-1: the final line prints wall time in seconds to one decimal', async () => {
    const io = recorder();
    const code = await runRoster([{ name: 'alpha' }], {
      ...io,
      run: () => ok,
      now: clock(1_500),
    });
    expect(code).toBe(0);
    expect(io.stdout).toEqual(['verify: alpha ok (1500ms)', 'verify: ok (4.5s)']);
  });

  it('AC-1: a failing stage prints FAIL, stops the roster and exits nonzero', async () => {
    const io = recorder();
    const ran: string[] = [];
    const stages: Stage[] = [{ name: 'alpha' }, { name: 'beta' }, { name: 'gamma' }];
    const code = await runRoster(stages, {
      ...io,
      run: (stage) => {
        ran.push(stage.name);
        return stage.name === 'beta'
          ? { ok: false, output: 'beta: the reason it failed\n' }
          : ok;
      },
      now: clock(5),
    });
    // Fail-fast: the exit code is the whole contract, and gamma never ran.
    expect(code).toBe(1);
    expect(ran).toEqual(['alpha', 'beta']);
    expect(io.stdout).toEqual(['verify: alpha ok (5ms)', 'verify: beta FAIL (5ms)']);
    // No final line after a failure: `verify: ok` would be a lie.
    expect(io.stdout).not.toContain('verify: ok');
    expect(io.stderr.join('')).toContain('the reason it failed');
  });
});

describe('inc-000 — runStage reports what actually happened (V-VERIFY)', () => {
  it('a command that exits nonzero is not ok, and its output is kept for the detail stream', async () => {
    const outcome = await runStage({
      name: 'probe',
      file: process.execPath,
      args: ['-e', 'process.stdout.write("said something"); process.exit(3)'],
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.output).toContain('said something');
  });

  it('a command that exits 0 is ok', async () => {
    const outcome = await runStage({ name: 'probe', file: process.execPath, args: ['-e', ''] });
    expect(outcome.ok).toBe(true);
  });

  it('a stage whose command cannot be run fails with the reason, rather than throwing', async () => {
    const outcome = await runStage({
      name: 'probe',
      file: join(REPO, 'node_modules', '.bin', 'no-such-tool-exists'),
      args: [],
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.output).toContain('probe:');
  });

  it('C-06: a stage whose lane exists but whose command is unwired fails with the recorded explanation', async () => {
    const outcome = await runStage({ name: 'probe', file: null, unwired: 'nothing is wired here' });
    expect(outcome.ok).toBe(false);
    expect(outcome.output).toBe('nothing is wired here');
  });
});

describe('inc-000 — the entry point is the same contract (AC-1)', () => {
  it('scripts/verify.mjs runs the exported roster rather than a list of its own', () => {
    // The roster and the grammar are tested above, on the real exports; this reads the
    // entry point only to prove it is still the thing that runs them.
    const source = readFileSync(join(REPO, 'scripts', 'verify.mjs'), 'utf8');
    expect(source).toContain('runRoster(STAGES');
  });
});

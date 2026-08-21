/**
 * AC-3 — V-CHECKUP: the machine's report. Armed items this increment are
 * node, pnpm and uv; the rest of the roster skips with its recorded reason.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { run, lines, transcript, type RunResult } from './support/exec.js';

const ROOT = process.cwd();

/** V-CHECKUP's roster, in order. */
const ITEM_ROSTER = [
  'node',
  'pnpm',
  'uv',
  'typst',
  'libredwg',
  'postgres',
  'ports',
  'storage',
  'env',
] as const;

const ARMED_ITEMS = ['node', 'pnpm', 'uv'] as const;

type Item = (typeof ITEM_ROSTER)[number];

const isArmed = (item: Item): boolean =>
  (ARMED_ITEMS as readonly string[]).includes(item);

/** Any line that follows the checkup item grammar, whatever the item is. */
const ITEM_LINE = /^checkup: (\S+) (ok|SKIP LANE_NOT_YET_BUILT|FAIL(?: .*)?)$/;

describe('AC-3 pnpm checkup on the pinned dev machine', () => {
  let result: RunResult;

  beforeAll(async () => {
    result = await run('pnpm', ['run', 'checkup'], { cwd: ROOT, timeoutMs: 120_000 });
  }, 180_000);

  it('AC-3: checkup exits 0', () => {
    expect(result.timedOut, 'pnpm checkup never exited').toBe(false);
    expect(result.code, transcript('pnpm checkup', result)).toBe(0);
  });

  it('AC-3: node, pnpm and uv report ok on stdout', () => {
    const stdout = lines(result.stdout);
    for (const item of ARMED_ITEMS) {
      expect(stdout, transcript('pnpm checkup', result)).toContain(`checkup: ${item} ok`);
    }
  });

  it('AC-3: the unarmed items skip with the recorded reason, never silently', () => {
    const stdout = lines(result.stdout);
    const unarmed = ITEM_ROSTER.filter((item) => !isArmed(item));
    for (const item of unarmed) {
      expect(stdout, transcript('pnpm checkup', result)).toContain(
        `checkup: ${item} SKIP LANE_NOT_YET_BUILT`,
      );
    }
  });

  it('AC-3: exactly one line per roster item, in roster order, and nothing else', () => {
    const reported = lines(result.stdout)
      .map((line) => ITEM_LINE.exec(line))
      .filter((match): match is RegExpExecArray => match !== null)
      .map((match) => match[1] ?? '');
    expect(reported, transcript('pnpm checkup', result)).toEqual([...ITEM_ROSTER]);
  });

  it('AC-3: the final stdout line is "checkup: ok"', () => {
    const stdout = lines(result.stdout);
    expect(stdout.at(-1), transcript('pnpm checkup', result)).toBe('checkup: ok');
  });
});

describe('AC-3 a broken armed item is a FAIL with a reason, not a pass', () => {
  let shimDir = '';
  let result: RunResult;

  beforeAll(async () => {
    // Fault injection through the environment only: a `uv` earlier on PATH
    // that refuses to answer. Nothing in the tree is touched (AC-8).
    shimDir = mkdtempSync(path.join(tmpdir(), 'cubit-checkup-shim-'));
    writeFileSync(
      path.join(shimDir, 'uv'),
      '#!/bin/sh\necho "uv: broken shim" >&2\nexit 1\n',
      { mode: 0o755 },
    );
    result = await run('pnpm', ['run', 'checkup'], {
      cwd: ROOT,
      timeoutMs: 120_000,
      env: { ...process.env, PATH: `${shimDir}:${process.env.PATH ?? ''}` },
    });
  }, 180_000);

  afterAll(() => {
    if (shimDir !== '') {
      rmSync(shimDir, { recursive: true, force: true });
    }
  });

  it('V-CHECKUP: a missing or mismatched armed tool prints FAIL with a reason', () => {
    const failure = lines(result.stdout).find((line) => line.startsWith('checkup: uv FAIL'));
    expect(failure, transcript('pnpm checkup (broken uv)', result)).toBeDefined();
    expect(
      (failure ?? '').length,
      'checkup: uv FAIL must carry a reason after FAIL',
    ).toBeGreaterThan('checkup: uv FAIL'.length);
  });

  it('V-CHECKUP: checkup exits nonzero when an armed item fails', () => {
    expect(result.timedOut, 'pnpm checkup never exited').toBe(false);
    // The nonzero exit has to be checkup's verdict, not the shell failing to
    // find it: the items it could still answer must have been answered.
    expect(
      lines(result.stdout),
      `checkup never ran: ${transcript('pnpm checkup (broken uv)', result)}`,
    ).toContain('checkup: node ok');
    expect(result.code, transcript('pnpm checkup (broken uv)', result)).not.toBe(0);
    expect(lines(result.stdout), 'a failed run must not claim checkup: ok').not.toContain(
      'checkup: ok',
    );
  });
});

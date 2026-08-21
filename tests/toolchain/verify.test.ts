/**
 * AC-1 — verify's own contract: the roster, its order, the grammar of every
 * line, the final line, stdout-only, fail-fast, and the arming rule.
 *
 * verify's fourth stage is `vitest run`, so a test that ran the repository's
 * own verify would run itself. The contract is read off the real script in a
 * tree of its own instead: scripts/ copied under $TMPDIR, stub executables
 * where the stage commands would be, and the input roots present or absent to
 * drive the arming rule. verify resolves its root from its own location, so the
 * copy answers for the copy and the repository is never touched (AC-8).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { run, lines, transcript, type RunResult } from './support/exec.js';

const ROOT = process.cwd();

/** The stage roster, in the fixed order the test contract states. */
const STAGE_ROSTER = [
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
] as const;

/** Armed in this increment; the rest have no input root yet. */
const ARMED_STAGES = ['tsc', 'eslint', 'vitest', 'cad-ruff'] as const;

/** `verify: <stage> ok (<N>ms)` | `SKIP LANE_NOT_YET_BUILT` | `FAIL (<N>ms)`. */
const STAGE_LINE = /^verify: (\S+) (ok \(\d+ms\)|SKIP LANE_NOT_YET_BUILT|FAIL \(\d+ms\))$/;

/** The final success line: `verify: ok (<S>s)`, wall time printed. */
const FINAL_LINE = /^verify: ok \(\d+\.\d+s\)$/;

/** The commands the armed stages reach for, as verify spells them. */
const STUB_BINARIES = ['next', 'tsc', 'eslint', 'vitest'] as const;

interface Tree {
  readonly root: string;
  /** Prepended to PATH so `uv` is the stub, not the machine's. */
  readonly binDir: string;
}

const trees: string[] = [];

/**
 * A tree that is nothing but verify and the things it invokes. `failing` names
 * the stub that exits 1; `inputs` are the input roots to create.
 */
function makeTree(options: { failing?: string; inputs?: readonly string[] } = {}): Tree {
  const root = mkdtempSync(path.join(tmpdir(), 'cubit-verify-'));
  trees.push(root);
  cpSync(path.join(ROOT, 'scripts'), path.join(root, 'scripts'), { recursive: true });

  const nodeBin = path.join(root, 'node_modules', '.bin');
  mkdirSync(nodeBin, { recursive: true });
  const binDir = path.join(root, 'stub-bin');
  mkdirSync(binDir, { recursive: true });

  const stub = (file: string, exitCode: number): void => {
    writeFileSync(
      file,
      `#!/bin/sh\necho "$(basename "$0") ran" \necho "$(basename "$0") diagnostics" >&2\nexit ${exitCode}\n`,
      { mode: 0o755 },
    );
  };

  for (const name of STUB_BINARIES) {
    stub(path.join(nodeBin, name), options.failing === name ? 1 : 0);
  }
  // cad-ruff runs `uv` from PATH with cad/ as its cwd.
  stub(path.join(binDir, 'uv'), options.failing === 'uv' ? 1 : 0);
  mkdirSync(path.join(root, 'cad'), { recursive: true });

  for (const input of options.inputs ?? []) {
    mkdirSync(path.join(root, input), { recursive: true });
  }
  return { root, binDir };
}

function verify(tree: Tree, options: { discardStderr?: boolean } = {}): Promise<RunResult> {
  return run('node', [path.join(tree.root, 'scripts', 'verify.mjs')], {
    cwd: tree.root,
    timeoutMs: 60_000,
    env: { ...process.env, PATH: `${tree.binDir}:${process.env.PATH ?? ''}` },
    ...(options.discardStderr === true ? { discardStderr: true } : {}),
  });
}

const stageLines = (result: RunResult): readonly RegExpExecArray[] =>
  lines(result.stdout)
    .map((line) => STAGE_LINE.exec(line))
    .filter((match): match is RegExpExecArray => match !== null);

afterAll(() => {
  for (const tree of trees) {
    rmSync(tree, { recursive: true, force: true });
  }
});

describe('AC-1 the stage roster and its grammar', () => {
  let result: RunResult;

  beforeAll(async () => {
    result = await verify(makeTree());
  }, 120_000);

  it('AC-1: verify exits 0 when every armed stage passes', () => {
    expect(result.timedOut, 'verify never exited').toBe(false);
    expect(result.code, transcript('verify', result)).toBe(0);
  });

  it('AC-1: exactly one line per roster stage, in roster order', () => {
    const reported = stageLines(result).map((match) => match[1] ?? '');
    expect(reported, transcript('verify', result)).toEqual([...STAGE_ROSTER]);
  });

  it('AC-1: the armed stages report ok with an elapsed time', () => {
    const stdout = lines(result.stdout);
    for (const stage of ARMED_STAGES) {
      const line = stdout.find((candidate) => candidate.startsWith(`verify: ${stage} `));
      expect(line, transcript('verify', result)).toMatch(
        new RegExp(`^verify: ${stage} ok \\(\\d+ms\\)$`),
      );
    }
  });

  it('AC-1: an unbuilt lane skips with the recorded reason, never silently', () => {
    const stdout = lines(result.stdout);
    const unarmed = STAGE_ROSTER.filter(
      (stage) => !(ARMED_STAGES as readonly string[]).includes(stage),
    );
    for (const stage of unarmed) {
      expect(stdout, transcript('verify', result)).toContain(
        `verify: ${stage} SKIP LANE_NOT_YET_BUILT`,
      );
    }
  });

  it('AC-1: the final stdout line is the verdict with the wall time', () => {
    const stdout = lines(result.stdout);
    expect(stdout.at(-1), transcript('verify', result)).toMatch(FINAL_LINE);
  });
});

describe('AC-1 the contract survives 2>/dev/null', () => {
  it('AC-1: every roster line and the verdict are on stdout', async () => {
    const result = await verify(makeTree(), { discardStderr: true });
    const stdout = lines(result.stdout);
    const reported = stageLines(result).map((match) => match[1] ?? '');
    expect(reported, transcript('verify (stderr discarded)', result)).toEqual([...STAGE_ROSTER]);
    expect(stdout.at(-1), transcript('verify (stderr discarded)', result)).toMatch(FINAL_LINE);
  }, 120_000);
});

describe('AC-1 fail-fast: the exit code is the whole contract', () => {
  let result: RunResult;

  beforeAll(async () => {
    result = await verify(makeTree({ failing: 'eslint' }));
  }, 120_000);

  it('AC-1: the failing stage prints FAIL with its elapsed time and exits nonzero', () => {
    expect(lines(result.stdout), transcript('verify (eslint fails)', result)).toContainEqual(
      expect.stringMatching(/^verify: eslint FAIL \(\d+ms\)$/),
    );
    expect(result.code, transcript('verify (eslint fails)', result)).not.toBe(0);
  });

  it('AC-1: no stage after the failure runs, and no verdict is claimed', () => {
    const reported = stageLines(result).map((match) => match[1] ?? '');
    expect(reported, transcript('verify (eslint fails)', result)).toEqual([
      'typegen',
      'tsc',
      'eslint',
    ]);
    expect(lines(result.stdout).some((line) => FINAL_LINE.test(line))).toBe(false);
  });

  it("AC-1: the failing stage's own output is diagnostics on stderr, not contract", () => {
    expect(result.stderr, transcript('verify (eslint fails)', result)).toContain('eslint ran');
    expect(result.stdout, transcript('verify (eslint fails)', result)).not.toContain('eslint ran');
  });
});

describe('C-06 arming is decided by the input root and nothing else', () => {
  let result: RunResult;

  beforeAll(async () => {
    // src/app is typegen's input root and build's. typegen has a command;
    // build's belongs to the increment that lands next.config, so an armed
    // build is a loud failure rather than a green light nobody earned.
    result = await verify(makeTree({ inputs: ['src/app'] }));
  }, 120_000);

  it('C-06: a stage whose input root appears runs, with no flag and no env var', () => {
    expect(lines(result.stdout), transcript('verify (src/app present)', result)).toContainEqual(
      expect.stringMatching(/^verify: typegen ok \(\d+ms\)$/),
    );
  });

  it('C-06: an armed stage with no command fails; it is never silently passed', () => {
    expect(lines(result.stdout), transcript('verify (src/app present)', result)).toContainEqual(
      expect.stringMatching(/^verify: build FAIL \(\d+ms\)$/),
    );
    expect(result.code, transcript('verify (src/app present)', result)).not.toBe(0);
  });
});

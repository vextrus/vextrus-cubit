/**
 * AC-2 / B-05 — every NEVER is a named lint rule with a committed fixture
 * proving it fires. Prose is not enforcement.
 *
 * This runs the project's own flat config through ESLint's Node API so the
 * Builder gets the answer in-process; the gate re-asks the same question
 * through the real CLI.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { ESLint } from 'eslint';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FIXTURE_ROOT = path.join(ROOT, 'tests/lint-fixtures');
const CONFIG = path.join(ROOT, 'eslint.config.mjs');

interface RegistryRow {
  /** tests/lint-fixtures/<dir>/ */
  readonly dir: string;
  /** the rule id the run must name */
  readonly ruleId: string;
  /** the extension of that row's fixtures */
  readonly ext: 'ts' | 'tsx';
  /** the Bible clause the rule mechanises */
  readonly clause: string;
}

/** The guardrail registry, exactly as the increment's interfaces list it. */
const REGISTRY: readonly RegistryRow[] = [
  { dir: 'no-float-arithmetic', ruleId: 'cubit/no-float-arithmetic', ext: 'ts', clause: 'B-07' },
  { dir: 'format-seam-only', ruleId: 'cubit/format-seam-only', ext: 'ts', clause: 'L-FMT-01' },
  { dir: 'model-seam-only', ruleId: 'cubit/model-seam-only', ext: 'ts', clause: 'L-AI-01' },
  { dir: 'db-seam-only', ruleId: 'cubit/db-seam-only', ext: 'ts', clause: 'SEAM-TENANT' },
  { dir: 'no-colour-literal', ruleId: 'cubit/no-colour-literal', ext: 'ts', clause: 'R-UI-001' },
  {
    dir: 'no-jsx-string-literal',
    ruleId: 'cubit/no-jsx-string-literal',
    ext: 'tsx',
    clause: 'R-SPINE-060',
  },
  {
    dir: 'no-conversion-literal',
    ruleId: 'cubit/no-conversion-literal',
    ext: 'ts',
    clause: 'L-FRM-06',
  },
  { dir: 'no-suppressions', ruleId: 'cubit/no-suppressions', ext: 'ts', clause: 'Q-08' },
  { dir: 'no-skip-only', ruleId: 'cubit/no-skip-only', ext: 'ts', clause: 'Q-08' },
  {
    dir: 'no-explicit-any',
    ruleId: '@typescript-eslint/no-explicit-any',
    ext: 'ts',
    clause: 'Q-08',
  },
];

const fixturePath = (row: RegistryRow, which: 'bad' | 'good'): string =>
  path.join(FIXTURE_ROOT, row.dir, `${which}.${row.ext}`);

/** `--no-ignore`: the fixtures are config-ignored, the probe opts back in. */
const probeLinter = (): ESLint =>
  new ESLint({ cwd: ROOT, overrideConfigFile: CONFIG, ignore: false });

interface Report {
  readonly ruleIds: readonly (string | null)[];
  readonly hits: number;
  readonly errorSeverityHits: number;
  readonly fatal: readonly string[];
}

/**
 * All twenty fixtures go through one ESLint instance in one call: a fresh
 * instance per file would rebuild the type-aware program twenty times and
 * spend Q-01's sixty seconds on this file alone.
 */
const linted = new Map<string, ESLint.LintResult>();
let lintFailure = '';

beforeAll(async () => {
  if (!existsSync(CONFIG)) {
    lintFailure = 'eslint.config.mjs is missing';
    return;
  }
  const targets = REGISTRY.flatMap((row) =>
    (['bad', 'good'] as const).map((which) => fixturePath(row, which)),
  ).filter((target) => existsSync(target));
  if (targets.length === 0) {
    lintFailure = 'no guardrail fixtures exist yet under tests/lint-fixtures/';
    return;
  }
  try {
    for (const result of await probeLinter().lintFiles(targets)) {
      linted.set(path.resolve(result.filePath), result);
    }
  } catch (error) {
    lintFailure = error instanceof Error ? error.message : String(error);
  }
}, 120_000);

function lint(row: RegistryRow, which: 'bad' | 'good'): Report {
  const target = fixturePath(row, which);
  expect(existsSync(target), `tests/lint-fixtures/${row.dir}/${which}.${row.ext} is missing`).toBe(
    true,
  );
  expect(lintFailure, 'the flat config could not lint the fixtures').toBe('');
  const result = linted.get(target);
  expect(result, `eslint returned no result for ${target}`).toBeDefined();
  const messages = result?.messages ?? [];
  return {
    ruleIds: messages.map((message) => message.ruleId),
    hits: messages.filter((message) => message.ruleId === row.ruleId).length,
    errorSeverityHits: messages.filter(
      (message) => message.ruleId === row.ruleId && message.severity === 2,
    ).length,
    fatal: messages
      .filter(
        (message) =>
          message.fatal === true || /Definition for rule .* was not found/.test(message.message),
      )
      .map((message) => `${message.line}:${message.column} ${message.message}`),
  };
}

describe('AC-2 the fixture surface', () => {
  it('AC-2: each registry row has its directory with exactly bad.* and good.*', () => {
    const problems: string[] = [];
    for (const row of REGISTRY) {
      const dir = path.join(FIXTURE_ROOT, row.dir);
      if (!existsSync(dir)) {
        problems.push(`tests/lint-fixtures/${row.dir}/ is missing`);
        continue;
      }
      const entries = readdirSync(dir).sort();
      const expected = [`bad.${row.ext}`, `good.${row.ext}`];
      if (JSON.stringify(entries) !== JSON.stringify(expected)) {
        problems.push(
          `tests/lint-fixtures/${row.dir}/ holds ${JSON.stringify(entries)}, expected ${JSON.stringify(expected)}`,
        );
      }
    }
    expect(problems, 'the guardrail registry fixtures are incomplete').toEqual([]);
  });
});

describe('AC-2/B-05 every registry rule fires on its bad fixture', () => {
  for (const row of REGISTRY) {
    it(`AC-2 (${row.clause}): ${row.ruleId} reports bad.${row.ext} as an error`, () => {
      const report = lint(row, 'bad');
      expect(
        report.hits,
        `${row.ruleId} said nothing about tests/lint-fixtures/${row.dir}/bad.${row.ext}; ` +
          `what was reported: ${JSON.stringify(report.ruleIds)}`,
      ).toBeGreaterThan(0);
      expect(
        report.errorSeverityHits,
        `${row.ruleId} must be severity "error" — a NEVER is never a warning`,
      ).toBe(report.hits);
    });

    it(`AC-2 (${row.clause}): ${row.ruleId} stays silent on good.${row.ext}`, () => {
      const report = lint(row, 'good');
      expect(
        report.fatal,
        `tests/lint-fixtures/${row.dir}/good.${row.ext} did not parse or the rule is undefined`,
      ).toEqual([]);
      expect(
        report.hits,
        `${row.ruleId} false-positived on its own good fixture: ${JSON.stringify(report.ruleIds)}`,
      ).toBe(0);
    });
  }
});

describe('AC-2 the fixtures never poison the tree-wide run', () => {
  it('AC-2: eslint.config.mjs globally ignores tests/lint-fixtures/**', async () => {
    const treeWide = new ESLint({ cwd: ROOT, overrideConfigFile: CONFIG });
    const notIgnored: string[] = [];
    for (const row of REGISTRY) {
      for (const which of ['bad', 'good'] as const) {
        if (!(await treeWide.isPathIgnored(fixturePath(row, which)))) {
          notIgnored.push(`tests/lint-fixtures/${row.dir}/${which}.${row.ext}`);
        }
      }
    }
    expect(
      notIgnored,
      'these fixtures would make `eslint .` — and therefore pnpm verify — permanently red',
    ).toEqual([]);
  });
});

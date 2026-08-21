/**
 * B-05 / Q-01 — every guardrail rule has a fixture test proving it fires.
 *
 * One row per registry entry: the rule must report `bad.*` at severity error
 * and say nothing about `good.*`. The fixtures live beside this file, one
 * directory per rule, and are globally ignored by `eslint .` — the probe here
 * opts back in with `ignore: false`, exactly as the CLI does with --no-ignore.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { ESLint, type Linter } from 'eslint';
import path from 'node:path';

const ROOT = process.cwd();
const FIXTURES = path.join(ROOT, 'tests/lint-fixtures');

interface Row {
  readonly dir: string;
  readonly ruleId: string;
  readonly ext: 'ts' | 'tsx';
  readonly clause: string;
}

const REGISTRY: readonly Row[] = [
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
  { dir: 'no-explicit-any', ruleId: '@typescript-eslint/no-explicit-any', ext: 'ts', clause: 'Q-08' },
];

const fixture = (row: Row, which: 'bad' | 'good'): string =>
  path.join(FIXTURES, row.dir, `${which}.${row.ext}`);

/** One program, twenty files: a linter per file would cost the whole budget. */
const reports = new Map<string, readonly Linter.LintMessage[]>();

beforeAll(async () => {
  const linter = new ESLint({
    cwd: ROOT,
    overrideConfigFile: path.join(ROOT, 'eslint.config.mjs'),
    ignore: false,
  });
  const targets = REGISTRY.flatMap((row) => [fixture(row, 'bad'), fixture(row, 'good')]);
  for (const result of await linter.lintFiles(targets)) {
    reports.set(path.resolve(result.filePath), result.messages);
  }
}, 120_000);

const messagesFor = (row: Row, which: 'bad' | 'good'): readonly Linter.LintMessage[] => {
  const messages = reports.get(fixture(row, which));
  expect(messages, `eslint returned no result for ${row.dir}/${which}.${row.ext}`).toBeDefined();
  return messages ?? [];
};

describe('B-05 the guardrail registry fires', () => {
  for (const row of REGISTRY) {
    it(`${row.clause}: ${row.ruleId} reports ${row.dir}/bad.${row.ext} as an error`, () => {
      const messages = messagesFor(row, 'bad');
      const hits = messages.filter((message) => message.ruleId === row.ruleId);
      expect(
        hits.length,
        `nothing was reported for ${row.ruleId}; eslint said ${JSON.stringify(
          messages.map((message) => message.ruleId),
        )}`,
      ).toBeGreaterThan(0);
      expect(
        hits.every((message) => message.severity === 2),
        'a NEVER is an error, never a warning',
      ).toBe(true);
    });

    it(`${row.clause}: ${row.ruleId} stays silent on ${row.dir}/good.${row.ext}`, () => {
      const messages = messagesFor(row, 'good');
      expect(
        messages.filter((message) => message.fatal === true),
        `${row.dir}/good.${row.ext} did not parse`,
      ).toEqual([]);
      // The contract is the probe's exit code: `eslint --no-ignore
      // tests/lint-fixtures/<dir>/good.<ext>` exits 0, and that is zero
      // diagnostics from every rule, not just this row's. Q-08's own rules and
      // no-explicit-any are bound tree-wide and do reach these files, so a good
      // fixture that trips one of them would fail the probe while a
      // rule-filtered assertion stayed green.
      expect(
        messages.map((message) => `${message.line}:${message.column} ${message.ruleId}`),
        `${row.dir}/good.${row.ext} must be clean for every rule — the probe's contract is exit 0`,
      ).toEqual([]);
    });
  }
});

describe('B-05 the fixtures stay out of the tree-wide run', () => {
  it('eslint . ignores tests/lint-fixtures/**', async () => {
    const treeWide = new ESLint({
      cwd: ROOT,
      overrideConfigFile: path.join(ROOT, 'eslint.config.mjs'),
    });
    for (const row of REGISTRY) {
      expect(
        await treeWide.isPathIgnored(fixture(row, 'bad')),
        `${row.dir}/bad.${row.ext} would make eslint . permanently red`,
      ).toBe(true);
    }
  });
});

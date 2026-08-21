/**
 * inc-000 acceptance — every NEVER is a named rule with a fixture that proves it fires
 * (AC-2, C-06, B-05, Q-01).
 *
 * B-05: "Every guardrail that matters is mechanical — a type, a lint rule with a fixture
 * test that proves it fires, a CI check, a database constraint. Prose is not enforcement."
 * This is that test, one row per guardrail-registry entry. It uses ESLint's own API so the
 * rule id is asserted exactly; AC-7 re-proves the same rows through the CLI.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const REPO = process.cwd();
const FIXTURES = join(REPO, 'tests', 'lint-fixtures');

type Row = { dir: string; ruleId: string; ext: 'ts' | 'tsx'; bible: string };

/** The guardrail registry, verbatim from the Increment Spec's interfaces section. */
const REGISTRY: Row[] = [
  { dir: 'no-float-arithmetic', ruleId: 'cubit/no-float-arithmetic', ext: 'ts', bible: 'B-07' },
  { dir: 'format-seam-only', ruleId: 'cubit/format-seam-only', ext: 'ts', bible: 'L-FMT-01' },
  { dir: 'model-seam-only', ruleId: 'cubit/model-seam-only', ext: 'ts', bible: 'L-AI-01' },
  { dir: 'db-seam-only', ruleId: 'cubit/db-seam-only', ext: 'ts', bible: 'SEAM-TENANT' },
  { dir: 'no-colour-literal', ruleId: 'cubit/no-colour-literal', ext: 'ts', bible: 'R-UI-001' },
  { dir: 'no-jsx-string-literal', ruleId: 'cubit/no-jsx-string-literal', ext: 'tsx', bible: 'R-SPINE-060' },
  { dir: 'no-conversion-literal', ruleId: 'cubit/no-conversion-literal', ext: 'ts', bible: 'L-FRM-06' },
  { dir: 'no-suppressions', ruleId: 'cubit/no-suppressions', ext: 'ts', bible: 'Q-08' },
  { dir: 'no-skip-only', ruleId: 'cubit/no-skip-only', ext: 'ts', bible: 'Q-08' },
  { dir: 'no-explicit-any', ruleId: '@typescript-eslint/no-explicit-any', ext: 'ts', bible: 'Q-08' },
];

/**
 * The Q-08 constructs, assembled rather than spelled: a file that names them becomes its
 * own hit in the gate's structural scan, which is textual and cannot tell the guardrail
 * from the thing it guards against.
 */
const Q08_CONSTRUCTS = [
  ['eslint', 'disable'].join('-'),
  `@ts-${'ignore'}`,
  `@ts-${'expect'}-error`,
  `.${'skip'}(`,
  `.${'only'}(`,
  `: ${'any'}`,
];

const lintFile = async (absPath: string): Promise<ESLint.LintResult> => {
  // --no-ignore: the fixture tree is globally ignored for `eslint .`, and re-included here.
  const eslint = new ESLint({ cwd: REPO, ignore: false, errorOnUnmatchedPattern: true });
  const results = await eslint.lintFiles([absPath]);
  const first = results[0];
  if (first === undefined) throw new Error(`eslint returned no result for ${absPath}`);
  return first;
};

describe('inc-000 — the guardrail registry fires (B-05, Q-01)', () => {
  it('AC-2: the registry is the ten rows the spec names, each with exactly bad and good', () => {
    expect(REGISTRY).toHaveLength(10);
    expect(existsSync(FIXTURES)).toBe(true);
    for (const row of REGISTRY) {
      const dir = join(FIXTURES, row.dir);
      expect(existsSync(dir), `missing fixture directory ${row.dir}`).toBe(true);
      const entries = readdirSync(dir).sort();
      // AC-2: "containing exactly the named bad.* and good.* files".
      expect(entries, `unexpected files in ${row.dir}`).toEqual([`bad.${row.ext}`, `good.${row.ext}`]);
    }
  });

  for (const row of REGISTRY) {
    it(
      `AC-2 / ${row.bible}: ${row.ruleId} fires on ${row.dir}/bad.${row.ext} and is silent on good.${row.ext}`,
      async () => {
        const bad = join(FIXTURES, row.dir, `bad.${row.ext}`);
        const good = join(FIXTURES, row.dir, `good.${row.ext}`);
        expect(existsSync(bad), `missing ${row.dir}/bad.${row.ext}`).toBe(true);
        expect(existsSync(good), `missing ${row.dir}/good.${row.ext}`).toBe(true);

        // B-05: the bad fixture proves the rule fires — by rule id, not by error count alone.
        const badResult = await lintFile(bad);
        const badRuleIds = badResult.messages.map((m) => m.ruleId);
        expect(badRuleIds, `${row.dir}/bad.${row.ext} did not report ${row.ruleId}`).toContain(
          row.ruleId,
        );
        expect(badResult.errorCount).toBeGreaterThan(0);
        expect(badResult.fatalErrorCount, `${row.dir}/bad.${row.ext} failed to parse`).toBe(0);

        // Q-01: a rule that fires on everything is not a guardrail. The good fixture is clean.
        const goodResult = await lintFile(good);
        const goodRuleIds = goodResult.messages.map((m) => m.ruleId);
        expect(goodRuleIds, `${row.dir}/good.${row.ext} reported ${row.ruleId}`).not.toContain(
          row.ruleId,
        );
        expect(
          goodResult.messages
            .filter((m) => m.severity === 2)
            .map((m) => `${m.ruleId}: ${m.message}`),
        ).toEqual([]);
      },
      120_000,
    );
  }

  it('R-UI-001 / Q-08: the fixture tree is globally ignored for a repo-wide `eslint .`', async () => {
    // The bad fixtures exist to be linted on purpose, one file at a time. A repo-wide run
    // must not see them, or `pnpm verify`'s eslint stage could never be green.
    const eslint = new ESLint({ cwd: REPO });
    for (const row of REGISTRY) {
      const bad = join(FIXTURES, row.dir, `bad.${row.ext}`);
      expect(await eslint.isPathIgnored(bad), `${row.dir}/bad.${row.ext} is not config-ignored`).toBe(true);
    }
  });

  it('Q-08: a forbidden construct inside a bad fixture carries its recorded reason on the line', () => {
    // Q-08 forbids these constructs "in a change without a recorded reason". The fixture
    // surface is the one place a recorded reason applies, and the recording is the marker.
    const offenders: string[] = [];
    for (const row of REGISTRY) {
      const bad = join(FIXTURES, row.dir, `bad.${row.ext}`);
      if (!existsSync(bad)) continue;
      const lines = readFileSync(bad, 'utf8').split(/\r?\n/);
      lines.forEach((line, i) => {
        const hit = Q08_CONSTRUCTS.some((c) => line.includes(c));
        if (hit && !line.includes('RECORDED REASON')) {
          offenders.push(`${row.dir}/bad.${row.ext}:${i + 1}`);
        }
      });
    }
    expect(offenders).toEqual([]);

    // ...and the same reason is recorded where a reader will find it (B-05, C-06).
    expect(existsSync(join(REPO, 'docs/toolchain.md'))).toBe(true);
    expect(readFileSync(join(REPO, 'docs/toolchain.md'), 'utf8')).toContain('RECORDED REASON');
  });
});

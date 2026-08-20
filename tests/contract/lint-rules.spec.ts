import { describe, it, expect, beforeAll } from 'vitest';
import { ESLint } from 'eslint';
import { readdirSync, existsSync } from 'node:fs';
import path from 'node:path';

// AC-04 / C-06 — every NEVER is an ESLint rule with a fixture proving it fires.

const ROOT = process.cwd();
const FIXTURES = path.join(ROOT, 'tests/lint-fixtures');
const CONFIG = path.join(ROOT, 'eslint.config.mjs');

const RULES = [
  'no-float-arithmetic',
  'no-locale-methods',
  'no-colour-literals',
  'no-jsx-string-literals',
  'db-seam-only',
  'module-boundaries',
] as const;

/** Lints the fixture files themselves with the project's own flat config. */
function fixtureLinter(): ESLint {
  return new ESLint({
    cwd: ROOT,
    overrideConfigFile: CONFIG,
    // fixtures are deliberately excluded from the tree-wide run; the contract
    // test opts back in so the rule is exercised against real files on disk
    ignore: false,
  });
}

function fixturePath(rule: string, which: 'bad' | 'good'): string {
  const dir = path.join(FIXTURES, rule);
  expect(existsSync(dir), `tests/lint-fixtures/${rule}/ is missing`).toBe(true);
  const match = readdirSync(dir).find((f) => f.startsWith(`${which}.`));
  expect(match, `tests/lint-fixtures/${rule}/${which}.* is missing`).toBeDefined();
  return path.join(dir, match as string);
}

async function messagesFor(rule: string, which: 'bad' | 'good'): Promise<ESLint.LintResult[]> {
  const eslint = fixtureLinter();
  return eslint.lintFiles([fixturePath(rule, which)]);
}

describe('AC-04 local ESLint plugin: every NEVER is a rule', () => {
  beforeAll(() => {
    expect(existsSync(CONFIG), 'eslint.config.mjs is missing').toBe(true);
  });

  for (const rule of RULES) {
    const ruleId = `cubit/${rule}`;

    it(`AC-04: ${ruleId} fires on its bad fixture`, async () => {
      const results = await messagesFor(rule, 'bad');
      const hits = results.flatMap((r) => r.messages).filter((m) => m.ruleId === ruleId);
      expect(
        hits.length,
        `${ruleId} reported nothing on tests/lint-fixtures/${rule}/bad.* — ` +
          'the flat config must apply the cubit rules to tests/lint-fixtures/**',
      ).toBeGreaterThan(0);
      // a NEVER is an error, never a warning
      expect(hits.every((m) => m.severity === 2), `${ruleId} must be an error`).toBe(true);
    });

    it(`AC-04: ${ruleId} stays silent on its good fixture`, async () => {
      const results = await messagesFor(rule, 'good');
      const hits = results.flatMap((r) => r.messages).filter((m) => m.ruleId === ruleId);
      expect(
        hits.map((m) => `${m.line}:${m.column} ${m.message}`),
        `${ruleId} false-positived on tests/lint-fixtures/${rule}/good.*`,
      ).toEqual([]);
    });

    it(`AC-04: ${ruleId} is a real rule, not an unknown-rule error`, async () => {
      const results = await messagesFor(rule, 'good');
      const fatal = results
        .flatMap((r) => r.messages)
        .filter((m) => m.fatal === true || /Definition for rule .* was not found/.test(m.message));
      expect(fatal.map((m) => m.message)).toEqual([]);
    });
  }
});

describe('AC-04 fixtures are excluded from the tree-wide lint', () => {
  it('AC-04: eslint ignores tests/lint-fixtures in a normal run', async () => {
    const eslint = new ESLint({ cwd: ROOT, overrideConfigFile: CONFIG });
    for (const rule of RULES) {
      const ignored = await eslint.isPathIgnored(fixturePath(rule, 'bad'));
      expect(
        ignored,
        `tests/lint-fixtures/${rule}/bad.* is not ignored — pnpm verify would be permanently red`,
      ).toBe(true);
    }
  });
});

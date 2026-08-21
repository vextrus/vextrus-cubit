/**
 * inc-004 acceptance — the colour guardrail fires on component shapes (AC-3).
 *
 * R-UI-001 ends with "no colour literal outside tokens (lint rule with fixture test)", and
 * B-05 says a guardrail that matters is mechanical — "a lint rule with a fixture test that
 * proves it fires. Prose is not enforcement."
 *
 * inc-000 proved `cubit/no-colour-literal` against a constant and a template string. That is
 * not where colour gets improvised: it gets improvised in a component, as a Tailwind
 * arbitrary value in `className` and as a functional colour in an inline style. So the pair
 * under tests/lint-fixtures/tokens/ is a component and its silent twin, and this suite is the
 * fixture test for it — driven through ESLint's own API so the verdict is a rule id and not
 * an error count.
 *
 * The pair needs a registry row in eslint.config.mjs to be bound at all: without it the
 * fixture directory matches no block that arms the rule, the bad file lints clean, and this
 * suite is red. That is the point — the row is what makes the fixture a guardrail rather
 * than a file.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const REPO = process.cwd();

const DIR = 'tests/lint-fixtures/tokens';
const BAD = `${DIR}/bad.tsx`;
const GOOD = `${DIR}/good.tsx`;
const RULE = 'cubit/no-colour-literal';

/** inc-000's pair, which stays exactly as it is: registry.test.ts pins that directory. */
const INC000_DIR = 'tests/lint-fixtures/no-colour-literal';

const absolute = (relative: string): string => join(REPO, relative);

/** One file at a time, ignores off — the fixture tree is config-ignored for `eslint .`. */
async function lint(relative: string): Promise<ESLint.LintResult> {
  const eslint = new ESLint({ cwd: REPO, ignore: false, errorOnUnmatchedPattern: true });
  const results = await eslint.lintFiles([absolute(relative)]);
  const first = results[0];
  if (first === undefined) throw new Error(`eslint returned no result for ${relative}`);
  return first;
}

describe('AC-3 — the colour guardrail fires on a component (R-UI-001, B-05)', () => {
  it('reports the rule on the Tailwind arbitrary value and the functional colour', async () => {
    expect(existsSync(absolute(BAD)), `missing ${BAD}`).toBe(true);
    const result = await lint(BAD);

    // By rule id: a file that fails to parse, or fails on some other rule, proves nothing
    // about R-UI-001.
    expect(result.fatalErrorCount, `${BAD} failed to parse`).toBe(0);
    expect(result.messages.map((message) => message.ruleId), `${BAD} did not report ${RULE}`).toContain(
      RULE,
    );
    expect(result.errorCount).toBeGreaterThan(0);

    // Both shapes the fixture exists for, each on its own line: the bracketed hex inside a
    // class list, and the colour function inside a style value.
    const source = readFileSync(absolute(BAD), 'utf8').split(/\r?\n/);
    const reported = result.messages
      .filter((message) => message.ruleId === RULE)
      .map((message) => source[message.line - 1] ?? '');
    expect(
      reported.some((line) => /className/.test(line) && /#[0-9a-fA-F]{6}/.test(line)),
      `${RULE} did not reach the Tailwind arbitrary value in className`,
    ).toBe(true);
    expect(
      reported.some((line) => /\b(?:rgba?|oklch|hsla?|color-mix)\s*\(/.test(line)),
      `${RULE} did not reach the functional colour in a style value`,
    ).toBe(true);
  });

  it('stays silent on the twin that consumes var(--…) tokens', async () => {
    expect(existsSync(absolute(GOOD)), `missing ${GOOD}`).toBe(true);

    // Silence proves nothing until the rule is armed for this directory. Its twin next door
    // is the proof that it is: an unregistered fixture pair lints clean on both sides.
    const armed = await lint(BAD);
    expect(armed.messages.map((message) => message.ruleId), `${RULE} is not armed for ${DIR}`).toContain(
      RULE,
    );

    const result = await lint(GOOD);

    // Q-01: a rule that fires on everything is not a guardrail. The same component, on the
    // token sheet, is clean — under every rule the repo config binds to it, not just this one.
    expect(result.fatalErrorCount, `${GOOD} failed to parse`).toBe(0);
    expect(result.messages.map((message) => message.ruleId)).not.toContain(RULE);
    expect(
      result.messages
        .filter((message) => message.severity === 2)
        .map((message) => `${message.ruleId}: ${message.message}`),
    ).toEqual([]);
  });

  it('is a registered guardrail: a row in eslint.config.mjs, and ignored by a repo-wide run', async () => {
    // The registry row the interface fixes, verbatim.
    const config = readFileSync(absolute('eslint.config.mjs'), 'utf8');
    expect(config.replace(/\s+/g, ' '), 'eslint.config.mjs carries no tokens registry row').toContain(
      "{ dir: 'tokens', ruleId: 'cubit/no-colour-literal' }",
    );

    // Broken on purpose, so `pnpm verify`'s `eslint .` stage must never see it.
    const repoWide = new ESLint({ cwd: REPO });
    for (const relative of [BAD, GOOD]) {
      expect(existsSync(absolute(relative)), `missing ${relative}`).toBe(true);
      expect(
        await repoWide.isPathIgnored(absolute(relative)),
        `${relative} is not config-ignored`,
      ).toBe(true);
    }

    // inc-000's directory is pinned at exactly bad.ts and good.ts by
    // tests/lint-fixtures/registry.test.ts — the new shapes land beside it, never inside it.
    expect(readdirSync(absolute(INC000_DIR)).sort()).toEqual(['bad.ts', 'good.ts']);
  });
});

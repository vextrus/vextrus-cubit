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

/**
 * Q-08 — the branches the committed fixtures deliberately do not spell.
 *
 * Both Q-08 rules have more than one branch, and a fixture file proves a branch
 * only by holding the construct: every such line is a hit in the structural
 * diff Q-08 itself asks for. So each `bad.ts` holds exactly one construct — the
 * floor AC-2 sets — and the remaining branches are linted here from source
 * assembled at run time, which is text no diff of this change contains. The
 * directives are built from their parts for the same reason the rule that
 * forbids them builds its patterns that way (eslint-rules/no-suppressions.mjs).
 */
describe('Q-08 the rule branches no fixture spells', () => {
  const lintAssembled = async (
    code: string,
    dir: string,
  ): Promise<readonly Linter.LintMessage[]> => {
    const linter = new ESLint({
      cwd: ROOT,
      overrideConfigFile: path.join(ROOT, 'eslint.config.mjs'),
      ignore: false,
    });
    const [result] = await linter.lintText(code, { filePath: path.join(FIXTURES, dir, 'bad.ts') });
    return result?.messages ?? [];
  };

  const hitsOf = (
    messages: readonly Linter.LintMessage[],
    ruleId: string,
  ): readonly Linter.LintMessage[] => messages.filter((message) => message.ruleId === ruleId);

  const LINT_DIRECTIVE = ['eslint', 'disable'].join('-');
  const ONLY = ['on', 'ly'].join('');
  const SKIP = ['sk', 'ip'].join('');

  const branches: readonly { rule: string; dir: string; branch: string; code: string }[] = [
    {
      rule: 'cubit/no-suppressions',
      dir: 'no-suppressions',
      branch: 'a one-line lint disable',
      code: `// ${LINT_DIRECTIVE}-next-line cubit/no-float-arithmetic\nexport const rate = 0.05;\n`,
    },
    ...['ignore', 'expect-error', 'nocheck'].map((word) => ({
      rule: 'cubit/no-suppressions',
      dir: 'no-suppressions',
      branch: `a type-error suppression (@ts-${word})`,
      code: `// @ts-${word}\nexport const total: number = 'not a number';\n`,
    })),
    {
      rule: 'cubit/no-skip-only',
      dir: 'no-skip-only',
      branch: 'an exclusive test',
      code: `it.${ONLY}('is the only test that would run', () => {});\n`,
    },
    {
      rule: 'cubit/no-skip-only',
      dir: 'no-skip-only',
      branch: 'a skipped test in bracket form',
      code: `test[${JSON.stringify(SKIP)}]('measures nothing', () => {});\n`,
    },
  ];

  for (const { rule, dir, branch, code } of branches) {
    it(`Q-08: ${rule} fires on ${branch}`, async () => {
      const hits = hitsOf(await lintAssembled(code, dir), rule);
      expect(
        hits.length,
        `${rule} said nothing about ${branch} — the branch is unproved`,
      ).toBeGreaterThan(0);
      expect(
        hits.every((message) => message.severity === 2),
        'a NEVER is an error, never a warning',
      ).toBe(true);
    });
  }
});

/**
 * B-07 / L-FRM-06 — the one exemption in the registry that no fixture file can
 * carry, because it is decided by the linted file's path: `src/core/units.ts`
 * may hold the unit canon's exact decimals and nothing else. A fixture cannot
 * live at that path (AM-02 keeps src/** out of this increment), so the proof is
 * a lint of text at that filename.
 */
describe('B-07 the units seam is exempt for the canon, not for parseFloat', () => {
  const lintAsUnits = async (code: string): Promise<readonly Linter.LintMessage[]> => {
    const linter = new ESLint({
      cwd: ROOT,
      overrideConfigFile: path.join(ROOT, 'eslint.config.mjs'),
      ignore: false,
    });
    const [result] = await linter.lintText(code, { filePath: path.join(ROOT, 'src/core/units.ts') });
    return result?.messages ?? [];
  };

  const floatRule = (messages: readonly Linter.LintMessage[]): readonly Linter.LintMessage[] =>
    messages.filter((message) => message.ruleId === 'cubit/no-float-arithmetic');

  it('L-FRM-06: the canon decimals are silent in src/core/units.ts', async () => {
    const messages = await lintAsUnits(
      ['export const FT_M = 0.3048;', 'export const CFT_M3 = 0.028316846592;', ''].join('\n'),
    );
    expect(
      floatRule(messages).map((message) => message.message),
      'the Bible requires the canon to live here as exact constants',
    ).toEqual([]);
  });

  it('B-07: parseFloat still fires in src/core/units.ts', async () => {
    const messages = await lintAsUnits(
      [
        'export const a = parseFloat(process.argv[2] ?? "0");',
        'export const b = Number.parseFloat(process.argv[3] ?? "0");',
        '',
      ].join('\n'),
    );
    expect(
      floatRule(messages).length,
      'the file every quantity passes through is the last place a parsed float may enter',
    ).toBe(2);
  });
});

/**
 * C-06 / B-05 — the seam-scoped blocks, which no fixture can reach.
 *
 * The interfaces require blocks "pre-wired for src/**, db/** so the rules arm
 * automatically when product code lands". Every test above binds its rule
 * through the per-registry-row block at tests/lint-fixtures/<dir>/**, so
 * deleting the seam blocks from eslint.config.mjs would leave this suite green
 * while the guardrails quietly stopped arming for product code — the precise
 * failure C-06 and B-05 exist to prevent.
 *
 * AM-02 keeps src/** and db/** out of this increment, so the proof is a lint of
 * text at those paths: no file is created, and surface.test.ts's "no product
 * code beside the toolchain" check stays true.
 */
describe('C-06 the seam blocks arm the guardrails for product code', () => {
  /** One instance for the whole describe; a fresh one per lint costs seconds. */
  const seamLinter = new ESLint({
    cwd: ROOT,
    overrideConfigFile: path.join(ROOT, 'eslint.config.mjs'),
    ignore: false,
  });

  const lintAt = async (
    relativePath: string,
    code: string,
  ): Promise<readonly (string | null)[]> => {
    const [result] = await seamLinter.lintText(code, {
      filePath: path.join(ROOT, relativePath),
    });
    return (result?.messages ?? []).map((message) => message.ruleId);
  };

  /** Every seam offence at once: one lint answers for the whole block. */
  const OFFENCES = [
    "import { Pool } from 'pg';",
    "import Anthropic from '@anthropic-ai/sdk';",
    'export const rate = 0.05;',
    'export const feet = 0.3048;',
    "export const shown = new Intl.NumberFormat('en-IN').format(1);",
    "export const brand = '#0f62fe';",
    '',
  ].join('\n');

  /** Bound to src/** and db/** alike. */
  const SEAM_RULES = [
    'cubit/no-float-arithmetic',
    'cubit/format-seam-only',
    'cubit/model-seam-only',
    'cubit/no-colour-literal',
    'cubit/no-conversion-literal',
  ] as const;

  it('C-06: the src/** block arms every seam rule bound to it', async () => {
    const reported = await lintAt('src/features/billing/panel.ts', OFFENCES);
    const silent = SEAM_RULES.filter((rule) => !reported.includes(rule));
    expect(
      silent,
      `these rules did not arm for src/**; eslint reported ${JSON.stringify(reported)}`,
    ).toEqual([]);
  });

  it('SEAM-TENANT: db-seam-only arms for src/**', async () => {
    const reported = await lintAt('src/features/billing/panel.ts', OFFENCES);
    expect(reported, 'a driver import outside src/core/db.ts is a handle nobody scoped').toContain(
      'cubit/db-seam-only',
    );
  });

  it('C-06: the db/** block arms the same seam rules', async () => {
    const reported = await lintAt('db/schema/invoices.ts', OFFENCES);
    const silent = SEAM_RULES.filter((rule) => !reported.includes(rule));
    expect(
      silent,
      `these rules did not arm for db/**; eslint reported ${JSON.stringify(reported)}`,
    ).toEqual([]);
  });

  it('SEAM-TENANT: db-seam-only stays off in db/**, where the schema defines itself', async () => {
    const reported = await lintAt('db/schema/invoices.ts', OFFENCES);
    expect(
      reported,
      'banning the driver in db/** would ban the schema from importing drizzle to declare itself',
    ).not.toContain('cubit/db-seam-only');
  });

  it('R-SPINE-060: the src/**/*.tsx block arms the string-table rule', async () => {
    const reported = await lintAt(
      'src/features/billing/Panel.tsx',
      'export const Panel = () => <p>Payment received</p>;\n',
    );
    expect(reported, 'a design increment lands .tsx into an already-armed rule').toContain(
      'cubit/no-jsx-string-literal',
    );
  });

  it('C-06: the seam rules stay off the toolchain they are pre-wired beside', async () => {
    // The blocks are scoped, not global: a script or a config that happens to
    // hold a decimal is not product code at a seam.
    const reported = await lintAt('scripts/probe.ts', OFFENCES);
    const armed = SEAM_RULES.filter((rule) => reported.includes(rule));
    expect(armed, 'these rules are scoped to src/** and db/**').toEqual([]);
  });
});

/**
 * SEAM-TENANT / L-AI-01 — the specifier spelling no fixture carries.
 *
 * `import('pg')` and ``import(`pg`)`` are one import to the loader and two node
 * types to the parser. The committed fixtures use the ordinary quoted form, so
 * the backtick branch is proved here, at the fixture path where each rule is
 * bound.
 */
describe('SEAM-TENANT a template-literal specifier is still an import', () => {
  const branchLinter = new ESLint({
    cwd: ROOT,
    overrideConfigFile: path.join(ROOT, 'eslint.config.mjs'),
    ignore: false,
  });

  const lintFixtureText = async (dir: string, code: string): Promise<readonly (string | null)[]> => {
    const [result] = await branchLinter.lintText(code, {
      filePath: path.join(FIXTURES, dir, 'bad.ts'),
    });
    return (result?.messages ?? []).map((message) => message.ruleId);
  };

  const BACKTICK = '`';
  const specifier = (module: string): string => `${BACKTICK}${module}${BACKTICK}`;

  const branches: readonly { rule: string; dir: string; branch: string; code: string }[] = [
    {
      rule: 'cubit/db-seam-only',
      dir: 'db-seam-only',
      branch: 'a dynamic import of the driver',
      code: `export const pool = await import(${specifier('pg')});\n`,
    },
    {
      rule: 'cubit/db-seam-only',
      dir: 'db-seam-only',
      branch: 'a require of the driver',
      code: `export const orm = require(${specifier('drizzle-orm')});\n`,
    },
    {
      rule: 'cubit/db-seam-only',
      dir: 'db-seam-only',
      branch: 'a dynamic import of the schema',
      code: `export const schema = await import(${specifier('@/db/schema')});\n`,
    },
    {
      rule: 'cubit/model-seam-only',
      dir: 'model-seam-only',
      branch: 'a dynamic import of the SDK',
      code: `export const sdk = await import(${specifier('@anthropic-ai/sdk')});\n`,
    },
    {
      rule: 'cubit/model-seam-only',
      dir: 'model-seam-only',
      branch: 'a require of the SDK',
      code: `export const sdk = require(${specifier('@anthropic-ai/sdk')});\n`,
    },
  ];

  for (const { rule, dir, branch, code } of branches) {
    it(`${rule} fires on ${branch} written with backticks`, async () => {
      const reported = await lintFixtureText(dir, code);
      expect(
        reported,
        `${rule} said nothing about ${branch}; eslint reported ${JSON.stringify(reported)}`,
      ).toContain(rule);
    });
  }

  it('a computed specifier is not a static import and is not reported', async () => {
    const reported = await lintFixtureText(
      'db-seam-only',
      `const name = 'pg';\nexport const pool = await import(${BACKTICK}\${name}${BACKTICK});\n`,
    );
    expect(
      reported,
      'an interpolated specifier is a computed module id, not a spelling of one',
    ).not.toContain('cubit/db-seam-only');
  });
});

/**
 * R-SPINE-060 — the exemption's own edge: a code is not a shouted word.
 *
 * Button captions are the strings a design increment writes by the dozen, and
 * they are short. Exempting a token because it is short and upper case would
 * let SAVE, DONE, PAID and OK render outside the string table — a hole the
 * table never learns about.
 */
describe('R-SPINE-060 a shouted caption is prose, not a code', () => {
  const captionLinter = new ESLint({
    cwd: ROOT,
    overrideConfigFile: path.join(ROOT, 'eslint.config.mjs'),
    ignore: false,
  });

  const lintCaption = async (text: string): Promise<readonly (string | null)[]> => {
    const [result] = await captionLinter.lintText(
      `export const Btn = () => <button>${text}</button>;\n`,
      { filePath: path.join(FIXTURES, 'no-jsx-string-literal', 'bad.tsx') },
    );
    return (result?.messages ?? []).map((message) => message.ruleId);
  };

  const RULE = 'cubit/no-jsx-string-literal';

  for (const caption of ['SAVE', 'DONE', 'PAID', 'OPEN', 'EDIT', 'NEXT', 'BACK', 'YES', 'OK']) {
    it(`R-SPINE-060: ${caption} is keyed in the string table like any other caption`, async () => {
      expect(await lintCaption(caption), `${caption} rendered outside the string table`).toContain(
        RULE,
      );
    });
  }

  for (const code of ['BDT', 'GRN', 'J-000', 'RFI-2031', 'VAT-2031:04']) {
    it(`R-SPINE-060: ${code} is a code and stays exempt`, async () => {
      expect(await lintCaption(code), `${code} is an identifier, not prose`).not.toContain(RULE);
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

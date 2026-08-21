/**
 * The branches a committed fixture cannot hold (B-05, Q-08).
 *
 * A fixture directory holds one bad file, and one file cannot spell every way a rule can
 * be broken — nor should it: three of these constructs are themselves Q-08 constructs, and
 * every committed copy is a line the structural diff check must be told about. So the
 * committed fixture proves the rule fires, and this suite proves the rest of each rule by
 * linting source assembled at run time, at the path the rule reasons about. Same rule,
 * same config, same verdict; no extra text in the diff.
 *
 * The seam blocks are asserted here too: a rule bound to src/** and db/** is a promise
 * that product code arms it on arrival, and a promise no test reads can be deleted without
 * anything turning red.
 */
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const REPO = process.cwd();

/** One instance for the suite: loading the flat config is the expensive part. */
const eslint = new ESLint({ cwd: REPO, ignore: false });

/** The rule ids reported when this source is linted as if it were this file. */
async function ruleIdsFor(filePath: string, source: string): Promise<string[]> {
  const results = await eslint.lintText(source, { filePath });
  const first = results[0];
  if (first === undefined) throw new Error(`eslint returned no result for ${filePath}`);
  const fatal = first.messages.filter((m) => m.fatal === true);
  expect(fatal.map((m) => m.message), `${filePath} failed to parse`).toEqual([]);
  return first.messages.map((m) => m.ruleId ?? '');
}

const fixture = (dir: string, name: string): string => `tests/lint-fixtures/${dir}/${name}`;

/**
 * The Q-08 constructs, assembled from parts. A guardrail that cannot be described without
 * tripping the textual scan that guards the same thing is a guardrail nobody can maintain.
 */
const LINT_SUPPRESSION = ['eslint', 'disable'].join('-');
const COMPILER_DIRECTIVES = ['ignore', ['expect', 'error'].join('-'), 'nocheck'].map(
  (name) => `${['@ts', ''].join('-')}${name}`,
);
const EXCLUDED = 'skip';
const EXCLUSIVE = 'only';
const LOOSE = 'any';

describe('the guardrails fire on the branches no fixture spells (B-05)', () => {
  it('Q-08: every spelling of a lint suppression is reported, not just the committed one', async () => {
    const path = fixture('no-suppressions', 'bad.ts');
    const wholeFile = `/* ${LINT_SUPPRESSION} */\nexport const a = 1;\n`;
    const oneLine = `export const a = 1; // ${LINT_SUPPRESSION}-line\n`;
    const nextLine = `// ${LINT_SUPPRESSION}-next-line\nexport const a = 1;\n`;
    for (const source of [wholeFile, oneLine, nextLine]) {
      expect(await ruleIdsFor(path, source)).toContain('cubit/no-suppressions');
    }
  });

  it('Q-08: each compiler-silencing directive is reported', async () => {
    const path = fixture('no-suppressions', 'bad.ts');
    for (const directive of COMPILER_DIRECTIVES) {
      const source = `// ${directive}\nexport const a: string = 1 as unknown as string;\n`;
      expect(await ruleIdsFor(path, source), directive).toContain('cubit/no-suppressions');
    }
  });

  it('Q-08: an ordinary comment is not a suppression', async () => {
    const path = fixture('no-suppressions', 'good.ts');
    const source = '// A note about why this is shaped the way it is.\nexport const a = 1;\n';
    expect(await ruleIdsFor(path, source)).not.toContain('cubit/no-suppressions');
  });

  it('Q-08: the exclusive marker, the bracket form and a nested chain all report', async () => {
    const path = fixture('no-skip-only', 'bad.ts');
    const sources = [
      `describe.${EXCLUSIVE}('x', () => {});\n`,
      `it.${EXCLUDED}('x', () => {});\n`,
      `describe['${EXCLUDED}']('x', () => {});\n`,
      `test.concurrent.${EXCLUSIVE}('x', () => {});\n`,
      `it.each([1])('x', () => {}).${EXCLUDED};\n`,
    ];
    for (const source of sources) {
      expect(await ruleIdsFor(path, source), source.trim()).toContain('cubit/no-skip-only');
    }
  });

  it('Q-08: a marker that is not a test marker is left alone', async () => {
    const path = fixture('no-skip-only', 'good.ts');
    const source = `export const page = { ${EXCLUDED}: 20, ${EXCLUSIVE}: true };\n`;
    expect(await ruleIdsFor(path, source)).not.toContain('cubit/no-skip-only');
  });

  it('Q-08: the loose type is reported in every position it can be written', async () => {
    const path = fixture('no-explicit-any', 'bad.ts');
    const sources = [
      `export function f(rows: ${LOOSE}[]): void { void rows; }\n`,
      `export type Box = Record<string, ${LOOSE}>;\n`,
      `export const f = (x: unknown): ${LOOSE} => x;\n`,
    ];
    for (const source of sources) {
      expect(await ruleIdsFor(path, source), source.trim()).toContain(
        '@typescript-eslint/no-explicit-any',
      );
    }
  });

  it('SEAM-TENANT: a driver reached by dynamic import, backtick or require is still the driver', async () => {
    const path = 'src/services/report.ts';
    const sources = [
      "import { Pool } from 'pg';\nexport const p = new Pool();\n",
      "export const load = () => import('drizzle-orm/node-postgres');\n",
      'export const load = () => import(`drizzle-orm`);\n',
      "export const p = require('pg');\n",
      'export const s = () => import(`@/db/schema`);\n',
    ];
    for (const source of sources) {
      expect(await ruleIdsFor(path, source), source.trim()).toContain('cubit/db-seam-only');
    }
  });

  it('SEAM-TENANT: the seam file itself imports the driver, and db/** defines the schema', async () => {
    const driver = "import { Pool } from 'pg';\nexport const p = new Pool();\n";
    expect(await ruleIdsFor('src/core/db.ts', driver)).not.toContain('cubit/db-seam-only');
    // The schema must import drizzle to define itself, which is why db/** is not bound.
    const schema = "import { pgTable, text } from 'drizzle-orm/pg-core';\nexport const t = pgTable('t', { id: text('id') });\n";
    expect(await ruleIdsFor('db/schema/projects.ts', schema)).not.toContain('cubit/db-seam-only');
  });

  it('L-AI-01: the SDK is the SDK however it is imported, and src/core is the one importer', async () => {
    const outside = 'src/ui/panel.ts';
    const sources = [
      "import Anthropic from '@anthropic-ai/sdk';\nexport const c = new Anthropic();\n",
      'export const load = () => import(`@anthropic-ai/sdk`);\n',
      "export const load = () => require('openai');\n",
    ];
    for (const source of sources) {
      expect(await ruleIdsFor(outside, source), source.trim()).toContain('cubit/model-seam-only');
    }
    const inCore = "import Anthropic from '@anthropic-ai/sdk';\nexport const c = new Anthropic();\n";
    expect(await ruleIdsFor('src/core/model.ts', inCore)).not.toContain('cubit/model-seam-only');
  });

  it('L-FMT-01: collation counts as formatting, and the seam file is exempt', async () => {
    const outside = 'src/ui/table.ts';
    const collator = 'export const c = new Intl.Collator();\n';
    expect(await ruleIdsFor(outside, collator)).toContain('cubit/format-seam-only');
    const tag = 'export const l = `${"en"}-BD`;\nexport const m = "en-BD";\n';
    expect(await ruleIdsFor(outside, tag)).toContain('cubit/format-seam-only');
    expect(await ruleIdsFor('src/core/format.ts', collator)).not.toContain('cubit/format-seam-only');
  });

  it('L-FMT-01: reaching the global by another name, or by bracket, is the same reach', async () => {
    const outside = 'src/ui/table.ts';
    for (const source of [
      'export const f = globalThis.Intl.NumberFormat;\n',
      'export const f = globalThis["Intl"];\n',
      'export const f = window.Intl;\n',
      'declare const a: string;\nexport const c = a["localeCompare"]("b");\n',
      'declare const n: number;\nexport const s = n["toLocaleString"]();\n',
    ]) {
      expect(await ruleIdsFor(outside, source), source.trim()).toContain('cubit/format-seam-only');
    }
    // A property that merely shares the name is not the global, and stays silent.
    const named = 'export const formats = { Intl: 1 };\nexport const n = formats.Intl;\n';
    expect(await ruleIdsFor(outside, named)).not.toContain('cubit/format-seam-only');
  });

  it('B-07: the float rule reads the number, not the spelling, and the canon is exempt', async () => {
    const outside = 'src/services/price.ts';
    for (const source of [
      'export const r = 1.0;\n',
      'export const r = 15e-2;\n',
      'export const r = Number.parseFloat("1.5");\n',
    ]) {
      expect(await ruleIdsFor(outside, source), source.trim()).toContain(
        'cubit/no-float-arithmetic',
      );
    }
    expect(await ruleIdsFor(outside, 'export const rows = 250;\n')).not.toContain(
      'cubit/no-float-arithmetic',
    );
    expect(await ruleIdsFor('src/core/units.ts', 'export const FT = 0.3048;\n')).not.toContain(
      'cubit/no-float-arithmetic',
    );
  });

  it('L-FRM-06: all five canon factors report, and a plain 1000 does not', async () => {
    const outside = 'src/services/convert.ts';
    for (const source of [
      'export const a = x * 0.3048;\n',
      'export const b = x * 0.09290304;\n',
      'export const c = x * 0.45359237;\n',
      'export const d = x * 0.028316846592;\n',
      'export const e = x / 1000;\n',
    ]) {
      expect(await ruleIdsFor(outside, `declare const x: number;\n${source}`), source.trim()).toContain(
        'cubit/no-conversion-literal',
      );
    }
    expect(await ruleIdsFor(outside, 'export const TIMEOUT_MS = 1000;\n')).not.toContain(
      'cubit/no-conversion-literal',
    );
    expect(await ruleIdsFor('src/core/units.ts', 'export const FT = 0.3048;\n')).not.toContain(
      'cubit/no-conversion-literal',
    );
  });

  it('R-UI-001: every colour syntax reports, and tokens.ts is where they live', async () => {
    const outside = 'src/ui/chart.ts';
    for (const source of [
      'export const a = "#fff";\n',
      'export const b = "oklch(62% 0.19 264)";\n',
      'export const c = `hsl(210 40% 96%)`;\n',
    ]) {
      expect(await ruleIdsFor(outside, source), source.trim()).toContain('cubit/no-colour-literal');
    }
    expect(await ruleIdsFor('src/ui/tokens.ts', 'export const a = "#fff";\n')).not.toContain(
      'cubit/no-colour-literal',
    );
    // A fragment in a path is not a colour; a rule that cannot tell gets switched off.
    expect(await ruleIdsFor(outside, 'export const href = "/docs/pins#abcdef";\n')).not.toContain(
      'cubit/no-colour-literal',
    );
  });

  it('R-SPINE-060: a short upper-case word is copy, a reason code is not', async () => {
    const path = 'src/ui/Bar.tsx';
    const shouting = 'export const C = () => <button>SAVE</button>;\n';
    expect(await ruleIdsFor(path, shouting)).toContain('cubit/no-jsx-string-literal');
    const code = 'export const C = () => <code data-testid="refusal">PIN_STALE</code>;\n';
    expect(await ruleIdsFor(path, code)).not.toContain('cubit/no-jsx-string-literal');
    const className = 'export const C = () => <div className="flex gap-2" />;\n';
    expect(await ruleIdsFor(path, className)).not.toContain('cubit/no-jsx-string-literal');
    const label = 'export const C = () => <input aria-label="Search projects" />;\n';
    expect(await ruleIdsFor(path, label)).toContain('cubit/no-jsx-string-literal');
  });
});

describe('the seam blocks are wired for the product tree that has not landed yet', () => {
  it('C-06: src/** arms every seam rule the moment a file exists there', async () => {
    const source = [
      'export const accent = "#2447f0";',
      'export const rate = 0.15;',
      'export const m = x * 0.3048;',
      'declare const x: number;',
    ].join('\n');
    const reported = new Set(await ruleIdsFor('src/services/anything.ts', source));
    expect([...reported].sort()).toEqual(
      ['cubit/no-colour-literal', 'cubit/no-conversion-literal', 'cubit/no-float-arithmetic'].sort(),
    );
  });

  it('C-06: db/** arms the rules a schema file can break', async () => {
    const source = 'export const accent = "#2447f0";\n';
    expect(await ruleIdsFor('db/schema/theme.ts', source)).toContain('cubit/no-colour-literal');
  });

  it('Q-01: a repo-wide run ignores the fixture tree, so the bad files never fail the gate', async () => {
    const configured = new ESLint({ cwd: REPO });
    expect(await configured.isPathIgnored(fixture('no-explicit-any', 'bad.ts'))).toBe(true);
    expect(await configured.isPathIgnored('eslint.config.mjs')).toBe(false);
  });
});

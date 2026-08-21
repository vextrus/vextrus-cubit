/**
 * inc-006 acceptance — the Design Decision and the lint floor under both modules (AC-5).
 *
 * AM-03: "For any increment that ships or changes a screen: (1) a DESIGN DECISION is committed
 * at docs/design/<screen>.md BEFORE acceptance is written — layout and hierarchy; every
 * R-UI-050 state with its copy verbatim; motion per R-UI-004; the Datum tokens used; both
 * themes; and the data-testid/route names it introduces." AC-5 ends with the same document and
 * with "all colour through Datum tokens (the colour-literal guardrail stays green)".
 *
 * The document is already committed, so nothing here re-reads it on its own: every assertion
 * below is the document *against the modules* — what they export, what copy they register,
 * which tokens their stylesheets and the sheet define, and what ESLint makes of them. A
 * document that decides nothing about a component this leaf ships is what fails, and so is a
 * component whose copy was improvised in code rather than decided in the document.
 *
 * This is the one node-environment suite of the increment: it judges files, not a DOM.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const REPO = process.cwd();

/** The two modules this leaf founds, and the three files the Design Decision §1 fixes in each. */
const MODULES: readonly string[] = ['src/ui/data', 'src/ui/patterns'];
const BARRELS: readonly string[] = ['src/ui/data/index.ts', 'src/ui/patterns/index.ts'];
const SHEETS: readonly string[] = ['src/ui/data/data.css', 'src/ui/patterns/patterns.css'];
const TABLES: readonly string[] = ['src/ui/data/strings.ts', 'src/ui/patterns/strings.ts'];

/** AM-03 names the document by the screen it decides; this leaf's screen is the pattern layer. */
const DESIGN = 'docs/design/datum-patterns.md';

/** R-UI-001's emitted sheet — the closed set of tokens anything may name. */
const TOKENS_CSS = 'src/ui/tokens.css';
const PRIMITIVES_CSS = 'src/ui/primitives/primitives.css';

/** Every data-testid the test contract introduces (the C-05 contract draws them from §13). */
const TESTIDS: readonly string[] = [
  'datatable',
  'datatable-header',
  'datatable-footer',
  'datatable-row',
  'datatable-group-row',
  'datatable-empty',
  'datatable-sort',
  'datatable-select-row',
  'datatable-edit-cell',
  'refusal-state',
  'refusal-code',
  'refusal-message',
  'refusal-remedy',
  'evidence-link',
  'consequence-dialog',
  'consequence-line',
  'consequence-stale',
  'consequence-confirm',
  'consequence-cancel',
  'empty-state',
  'empty-state-action',
  'error-state',
  'error-state-retry',
  'error-state-report-id',
  'partial-notice',
  'offline-banner',
  'permission-denied',
  'basis-chip',
  'coverage-chip',
  'unit-badge',
];

const absolute = (relative: string): string => join(REPO, relative);

function read(relative: string): string {
  expect(existsSync(absolute(relative)), `missing ${relative}`).toBe(true);
  return readFileSync(absolute(relative), 'utf8');
}

/** The two module barrels, per test, so a module that does not exist reads as one failure. */
const barrels = async (): Promise<object[]> => [
  await import('../../data/index'),
  await import('../index'),
];

/** The two module string tables, per test. */
const tables = async (): Promise<object[]> => [
  await import('../../data/strings'),
  await import('../strings'),
];

/**
 * R-UI-004: "120–200 ms ease-out for state changes; 240 ms for panels; the viewer 'fly-to'
 * 320 ms with easing" — plus zero, which is what reduced motion resolves the tokens to.
 */
function isLawfulDuration(ms: number): boolean {
  if (ms === 0) return true;
  if (ms >= 120 && ms <= 200) return true;
  return ms === 240 || ms === 320;
}

/** Every string leaf of every object a module exports — the table, whatever it is named. */
function stringValuesOf(namespace: object): string[] {
  const found: string[] = [];
  for (const exported of Object.values(namespace)) {
    if (exported === null || typeof exported !== 'object') continue;
    for (const value of Object.values(exported as Record<string, unknown>)) {
      if (typeof value === 'string') found.push(value);
    }
  }
  return found;
}

/** Every `--name` any Datum stylesheet defines: the sheet, the primitives', and this leaf's. */
function definedTokens(): Set<string> {
  const sources = [TOKENS_CSS, PRIMITIVES_CSS, ...SHEETS].map((relative) => read(relative));
  const names = new Set<string>();
  for (const match of sources.join('\n').matchAll(/(--[A-Za-z0-9-]+)\s*:/g)) {
    const name = match[1];
    if (name !== undefined) names.add(name);
  }
  return names;
}

describe('AC-5 — the modules have the shape the Design Decision fixes (§1)', () => {
  it('ships a barrel, a stylesheet and a string table in each module', () => {
    for (const relative of [...BARRELS, ...SHEETS, ...TABLES]) {
      expect(existsSync(absolute(relative)), `missing ${relative}`).toBe(true);
    }
  });
});

describe('AC-5 — docs/design/datum-patterns.md is the contract (AM-03)', () => {
  it('decides every component the two barrels export, and names every test id', async () => {
    const doc = read(DESIGN);

    // AM-03: "A screen with no Design Decision is not ready to build." A component shipped
    // but undecided is the same absence, one component wide.
    const exported = (await barrels()).flatMap((module) =>
      Object.keys(module).filter((name) => /^[A-Z]/.test(name)),
    );
    expect(exported.length, 'the barrels export no components at all').toBeGreaterThan(0);

    const undecided = exported.filter((name) => !doc.includes(name));
    expect(undecided, `${DESIGN} decides nothing about: ${undecided.join(', ')}`).toEqual([]);

    // AM-03 (1): "the data-testid names it introduces, which C-05's test contract draws from".
    const unnamed = TESTIDS.filter((id) => !doc.includes(id));
    expect(unnamed, `${DESIGN} does not name the test ids: ${unnamed.join(', ')}`).toEqual([]);
  });

  it('quotes every registered default string verbatim (AM-03 (2): copy is design)', async () => {
    const doc = read(DESIGN);
    const values = (await tables()).flatMap((table) => stringValuesOf(table));

    // The rule, not a snapshot: whatever the tables register, the document quotes. A value a
    // later leaf adds is covered without editing this suite.
    expect(values.length, 'the modules register no copy at all').toBeGreaterThan(0);
    const unquoted = values.filter((value) => !doc.includes(value));
    expect(
      unquoted,
      `copy improvised in code rather than decided in ${DESIGN}: ${unquoted.join(' | ')}`,
    ).toEqual([]);
  });

  it('names only tokens a Datum stylesheet actually defines (R-UI-001)', () => {
    const doc = read(DESIGN);
    const defined = definedTokens();

    const named = [...doc.matchAll(/(--[a-z][A-Za-z0-9-]*)/g)]
      .map((match) => match[1] ?? '')
      .filter((name) => name.length > 0);
    expect(named.length, `${DESIGN} does not say which Datum tokens it uses`).toBeGreaterThan(0);

    const invented = [...new Set(named)].filter((name) => !defined.has(name));
    expect(invented, `${DESIGN} names tokens no sheet defines: ${invented.join(', ')}`).toEqual([]);
  });
});

describe('AC-5 — the lint floor holds over both modules (R-UI-001, Q-08)', () => {
  it('lints clean under every armed rule, including cubit/no-colour-literal', async () => {
    // The existence check first: `eslint` over a directory that is not there reports an
    // unmatched pattern, which is a different complaint from a rule that fired.
    for (const relative of BARRELS) {
      expect(existsSync(absolute(relative)), `missing ${relative}`).toBe(true);
    }

    const eslint = new ESLint({ cwd: REPO, errorOnUnmatchedPattern: true });
    const results = await eslint.lintFiles(MODULES.map((relative) => absolute(relative)));
    expect(results.length, 'eslint linted no file in the two modules').toBeGreaterThan(0);

    // By rule id and file, so the red names the law that was broken rather than a count.
    const complaints = results.flatMap((result) =>
      result.messages
        .filter((message) => message.severity === 2)
        .map(
          (message) =>
            `${result.filePath.slice(REPO.length + 1)}:${String(message.line)} ${message.ruleId ?? 'parse'} — ${message.message}`,
        ),
    );
    expect(complaints, complaints.join('\n')).toEqual([]);
  });

  it('states no duration outside R-UI-004 in either module stylesheet', () => {
    for (const relative of SHEETS) {
      const sheet = read(relative);
      // A sheet carrying no duration at all passes vacuously — motion may lawfully be
      // expressed as `var(--motion-state-duration)`, where reduced motion is already honoured.
      const stated = [...sheet.matchAll(/(\d+)ms\b/g)].map((match) => Number(match[1]));
      const unlawful = stated.filter((ms) => !isLawfulDuration(ms));
      expect(
        unlawful,
        `${relative} states durations R-UI-004 does not allow: ${unlawful.join(', ')}`,
      ).toEqual([]);
    }
  });
});

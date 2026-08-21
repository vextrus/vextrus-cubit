/**
 * inc-005 acceptance — the Design Decision and the lint floor under the primitives (AC-1).
 *
 * AM-03: "For any increment that ships or changes a screen: (1) a DESIGN DECISION is
 * committed at docs/design/<screen>.md BEFORE acceptance is written — layout and hierarchy;
 * every R-UI-050 state (loading, empty, error, refusal, partial, offline,
 * permission-denied) with its copy verbatim; motion per R-UI-004; the Datum tokens used;
 * both themes; and the data-testid/route names it introduces, which C-05's test contract
 * draws from."
 *
 * AC-1 also holds the lint floor: "`pnpm verify`'s lint stage (cubit/no-colour-literal and
 * every armed rule) stays green over src/ui/primitives/**". That is asserted here through
 * ESLint's own API, by rule id, over whatever the directory actually holds — so it keeps
 * meaning the same thing when a later leaf adds a file to it.
 *
 * Every assertion here is written against a *rule*, never against today's tree:
 *   - the copy check is "every value the primitives string table registers is quoted in the
 *     document", derived from the table at run time — a value added tomorrow is covered;
 *   - the token check is "every `--token` the document names is one src/ui/tokens.css
 *     defines", which cannot be satisfied by inventing a token;
 *   - the motion check is "every duration the document states is one R-UI-004 allows",
 *     which is the Bible's number, not a number copied off this increment's draft.
 *
 * The modules are loaded inside each test so that a module which does not exist yet reads
 * as one missing behaviour per test rather than a single collection error (the shape
 * src/ui/__tests__/strings.acceptance.test.ts already uses).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const REPO = process.cwd();

/** The module this increment founds, and the three files the Increment Spec names in it. */
const PRIMITIVES_DIR = 'src/ui/primitives';
const BARREL = `${PRIMITIVES_DIR}/index.ts`;
const SHEET = `${PRIMITIVES_DIR}/primitives.css`;
const TABLE = `${PRIMITIVES_DIR}/strings.ts`;

/** AM-03 names the document by the screen it decides; this leaf's screen is the primitives. */
const DESIGN = 'docs/design/datum-primitives.md';

/** R-UI-001's emitted sheet — the closed set of tokens anything may name. */
const TOKENS_CSS = 'src/ui/tokens.css';

/** The primitives' string table, per test (see the file header). */
const stringTable = async () => await import('../strings');

/**
 * The primitive families this increment ships, from the Increment Spec's `interfaces` line.
 * The compound primitives are named by their family here: AM-03 asks the document to fix
 * each primitive's anatomy, and a family's parts are that anatomy.
 */
const FAMILIES: readonly string[] = [
  'Button',
  'IconButton',
  'Input',
  'Textarea',
  'NumberInput',
  'Checkbox',
  'Radio',
  'RadioGroup',
  'Switch',
  'Slider',
  'Select',
  'Combobox',
  'Tabs',
  'Tooltip',
  'Popover',
  'DropdownMenu',
  'ContextMenu',
  'Dialog',
  'Sheet',
  'Toast',
  'Badge',
  'Tag',
  'Kbd',
  'Progress',
  'Skeleton',
  'Separator',
];

/** Every data-testid the test contract introduces. AM-03 (1): the document names them. */
const TESTIDS: readonly string[] = [
  'number-input-field',
  'number-input-suffix',
  'combobox-input',
  'combobox-list',
  'combobox-option',
  'combobox-empty',
  'dialog-content',
  'sheet-content',
  'toast-region',
];

/**
 * R-UI-004: "120–200 ms ease-out for state changes; 240 ms for panels; the viewer 'fly-to'
 * 320 ms with easing". A duration a Design Decision may state is one of those, or zero —
 * which is what `prefers-reduced-motion: reduce` resolves the motion tokens to.
 */
function isLawfulDuration(ms: number): boolean {
  if (ms === 0) return true;
  if (ms >= 120 && ms <= 200) return true;
  return ms === 240 || ms === 320;
}

const absolute = (relative: string): string => join(REPO, relative);

function read(relative: string): string {
  expect(existsSync(absolute(relative)), `missing ${relative}`).toBe(true);
  return readFileSync(absolute(relative), 'utf8');
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

/**
 * The `--name` of every custom property the Datum sheet defines, in either theme block —
 * plus any the primitives' own sheet introduces, which is equally a token this document may
 * name. What the check refuses is a token that is defined nowhere: a document naming one has
 * decided a value no stylesheet carries.
 */
function definedTokens(): Set<string> {
  const source = `${read(TOKENS_CSS)}\n${existsSync(absolute(SHEET)) ? read(SHEET) : ''}`;
  const names = new Set<string>();
  for (const match of source.matchAll(/(--[A-Za-z0-9-]+)\s*:/g)) {
    const name = match[1];
    if (name !== undefined) names.add(name);
  }
  return names;
}

describe('AC-1 — docs/design/datum-primitives.md is the contract (AM-03)', () => {
  it('is committed and fixes the anatomy of every primitive family it ships', () => {
    const doc = read(DESIGN);

    // AM-03: "A screen with no Design Decision is not ready to build." A stub file is the
    // same absence with a filename on it.
    expect(doc.length, `${DESIGN} is too short to fix an anatomy`).toBeGreaterThan(2000);

    const missing = FAMILIES.filter((family) => !doc.includes(family));
    expect(missing, `${DESIGN} decides nothing about: ${missing.join(', ')}`).toEqual([]);
  });

  it('names every data-testid the test contract draws from it', () => {
    const doc = read(DESIGN);

    // AM-03 (1): "the data-testid/route names it introduces, which C-05's test contract
    // draws from" — the document is where they are decided, not this suite.
    const missing = TESTIDS.filter((id) => !doc.includes(id));
    expect(missing, `${DESIGN} does not name the test ids: ${missing.join(', ')}`).toEqual([]);
  });

  it('quotes every registered default string verbatim (AM-03 (2): copy is design)', async () => {
    const doc = read(DESIGN);
    const values = stringValuesOf(await stringTable());

    // The rule, not a snapshot: whatever the table registers, the document quotes. A value
    // added by a later leaf is covered without editing this suite.
    expect(values.length, `${TABLE} registers no copy at all`).toBeGreaterThan(0);
    const unquoted = values.filter((value) => !doc.includes(value));
    expect(
      unquoted,
      `copy improvised in code rather than decided in ${DESIGN}: ${unquoted.join(' | ')}`,
    ).toEqual([]);
  });

  it('decides both themes and states its motion at R-UI-004 durations', () => {
    const doc = read(DESIGN);

    // AM-03 (1): "both themes". The selectors are inc-004's, so the document says which
    // theme it is describing in the same vocabulary the sheet is written in.
    expect(doc, `${DESIGN} does not decide the light theme`).toMatch(/data-theme="light"|light theme/i);
    expect(doc, `${DESIGN} does not decide the dark theme`).toMatch(/data-theme="dark"|dark theme/i);

    // R-UI-004 ends "prefers-reduced-motion respected everywhere".
    expect(doc, `${DESIGN} does not say what reduced motion does`).toContain(
      'prefers-reduced-motion',
    );

    const stated = [...doc.matchAll(/(\d+)\s*ms\b/g)].map((match) => Number(match[1]));
    expect(stated.length, `${DESIGN} states no motion duration`).toBeGreaterThan(0);
    const unlawful = stated.filter((ms) => !isLawfulDuration(ms));
    expect(
      unlawful,
      `R-UI-004 allows 120–200 ms for a state change, 240 ms for a panel, 320 ms for the fly-to: ${unlawful.join(', ')}`,
    ).toEqual([]);
  });

  it('names only tokens src/ui/tokens.css actually defines (R-UI-001)', () => {
    const doc = read(DESIGN);
    const defined = definedTokens();

    const named = [...doc.matchAll(/(--[a-z][A-Za-z0-9-]*)/g)]
      .map((match) => match[1] ?? '')
      .filter((name) => name.length > 0);
    expect(named.length, `${DESIGN} does not say which Datum tokens it uses`).toBeGreaterThan(0);

    const invented = [...new Set(named)].filter((name) => !defined.has(name));
    expect(
      invented,
      `${DESIGN} names tokens ${TOKENS_CSS} does not define: ${invented.join(', ')}`,
    ).toEqual([]);
  });
});

describe('AC-1 — the increment’s declared dependencies are on the tree', () => {
  // The four suites that drive a DOM cannot run at all until these are installed, so the
  // absence is stated here, in the one node-environment suite, rather than showing up as an
  // environment error with no explanation. Presence, never exactness: a later increment may
  // lawfully declare more.
  const DECLARED: readonly string[] = [
    'radix-ui',
    'sonner',
    'jsdom',
    '@testing-library/react',
    '@testing-library/dom',
    '@testing-library/user-event',
  ];

  it('declares each of them at an exact pin', () => {
    const manifest: unknown = JSON.parse(read('package.json'));
    const record = manifest as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const declared = { ...record.dependencies, ...record.devDependencies };

    const missing = DECLARED.filter((name) => declared[name] === undefined);
    expect(missing, `package.json declares no: ${missing.join(', ')}`).toEqual([]);

    // tests/toolchain/pins.test.ts already holds this tree-wide; naming it here means the
    // red says "pin it" rather than "some other suite went red too".
    const loose = DECLARED.filter((name) => !/^\d+\.\d+\.\d+/.test(declared[name] ?? ''));
    expect(loose, `not pinned exactly: ${loose.map((n) => `${n}@${declared[n] ?? ''}`).join(', ')}`).toEqual(
      [],
    );
  });

  it('has them installed, so the jsdom suites can run', () => {
    const absent = DECLARED.filter(
      (name) => !existsSync(join(REPO, 'node_modules', name, 'package.json')),
    );
    expect(absent, `declared but not installed — run pnpm install: ${absent.join(', ')}`).toEqual(
      [],
    );
  });
});

describe('AC-1 — the lint floor holds over src/ui/primitives/** (R-UI-001, Q-08)', () => {
  it('has the three files the Increment Spec names in the module', () => {
    for (const relative of [BARREL, SHEET, TABLE]) {
      expect(existsSync(absolute(relative)), `missing ${relative}`).toBe(true);
    }
  });

  it('lints clean under every armed rule', async () => {
    // The existence check first: `eslint` over a directory that is not there reports an
    // unmatched pattern, which is a different complaint from a rule that fired.
    expect(existsSync(absolute(BARREL)), `missing ${BARREL}`).toBe(true);

    const eslint = new ESLint({ cwd: REPO, errorOnUnmatchedPattern: true });
    const results = await eslint.lintFiles([absolute(PRIMITIVES_DIR)]);
    expect(results.length, `eslint linted no file under ${PRIMITIVES_DIR}`).toBeGreaterThan(0);

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

  it('states no duration outside R-UI-004 in primitives.css', () => {
    const sheet = read(SHEET);

    // R-UI-004 is a number, and this is where a stylesheet would improvise one. A sheet
    // that carries no duration at all passes vacuously — motion may lawfully be expressed
    // as `var(--motion-state-duration)`, which is where reduced motion is already honoured.
    const stated = [...sheet.matchAll(/(\d+)ms\b/g)].map((match) => Number(match[1]));
    const unlawful = stated.filter((ms) => !isLawfulDuration(ms));
    expect(
      unlawful,
      `${SHEET} states durations R-UI-004 does not allow: ${unlawful.join(', ')}`,
    ).toEqual([]);
  });
});

/**
 * inc-013, AC-2 — the closed act vocabulary and the two total maps (L-ACT-03, L-ACT-02, Q-07).
 *
 * L-ACT-03 is a list, and a list in a law is a closed set: "a closed permission enum cuts on
 * what an act moves", thirteen names, and six role bundles that "are the only thing a human
 * picks". So the permission set and the six bundles are compared *exactly* here — they are the
 * clause, not today's snapshot of it. `ACT_TYPES` is not: M0 carries the one act the tree can
 * perform and every later increment adds to it, so what is asserted about the act types is
 * membership and totality, ranged over whatever `ACT_TYPES` holds when the test runs.
 *
 * Three things are graded that a runtime read cannot see, and each is graded the way it exists:
 *
 *   - totality as a *compile-time* property (AC-2: "an act type without a rendering is a
 *     compile error") — by the conditional types below, which `pnpm verify`'s `tsc --noEmit`
 *     decides and which are asserted here so `noUnusedLocals` sees them used;
 *   - the `satisfies Record<ActType, …>` mechanism that carries it, read off the seam's own
 *     source: a `Record<ActType, …>` built by hand and annotated would type-check while
 *     silently widening, and the difference between the two is textual;
 *   - Q-07's second half (AC-1): none of these names may appear under `src/` as a *quoted*
 *     literal. Q-07's own register already refuses the ten that carry an underscore, as
 *     orphans; the single-word ones (MEASURE, REVIEW, SIGN, PRICE, BID, LEAD) share the
 *     hazard and not the grammar, so they are refused here.
 *
 * Every product module is loaded by an absolute path assembled at run time: a literal import
 * of a module that does not exist yet fails the file at transform time, and vitest reports
 * "0 test" instead of one named failure. The type positions below use inline `import(…)`
 * queries for the same reason — they are erased before the file runs.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO = process.cwd();

/** The barrel AC-2 names — "the seam's only import surface". */
const ACTS_BARREL = 'src/core/acts';

/** The seam's own directory: the only place the vocabulary and the maps may be declared. */
const ACTS_DIR = 'src/core/acts';

/** L-ACT-03's permission enum, verbatim and in the clause's own order. */
const PERMISSION_NAMES: readonly string[] = [
  'PIN_SET',
  'AUTHOR_LEVEL_STACK',
  'AUTHOR_PROJECT_FACT',
  'MEASURE',
  'SET_BILL_BOUNDARY',
  'ADMINISTER_SAMPLE',
  'ENTER_BLIND_FIGURE',
  'REVIEW',
  'SIGN',
  'ADMINISTER_PROJECT',
  'ADMINISTER_BOOK',
  'PRICE',
  'BID',
];

/**
 * L-ACT-03's five named bundles, verbatim. PRINCIPAL is deliberately absent: the clause says
 * "PRINCIPAL (all)", and "all" is whatever the permission enum holds — derived below rather
 * than copied, so the bundle stays right if the law's enum is ever read differently.
 */
const NAMED_BUNDLES: Readonly<Record<string, readonly string[]>> = {
  MEASURER: ['MEASURE', 'AUTHOR_PROJECT_FACT', 'ENTER_BLIND_FIGURE'],
  REVIEWER: ['REVIEW'],
  LEAD: ['PIN_SET', 'AUTHOR_LEVEL_STACK', 'SET_BILL_BOUNDARY', 'ADMINISTER_SAMPLE', 'SIGN'],
  ESTIMATOR: ['PRICE'],
  BID_MANAGER: ['BID'],
};

const PRINCIPAL = 'PRINCIPAL';

/** L-ACT-03: "ADMINISTER_PROJECT (ASSIGN_PARTICIPANT_ROLE)" — the one act M0 can perform. */
const ASSIGN_PARTICIPANT_ROLE = 'ASSIGN_PARTICIPANT_ROLE';
const ADMINISTER_PROJECT = 'ADMINISTER_PROJECT';

/* ─────────────────────── the compile-time half of AC-2 (graded by tsc) ──────────────── */

/** Every member of `Keys` is a key of `M`, or this resolves to `false` and the const is red. */
type TotalOver<Keys extends string, M> = [Keys] extends [keyof M] ? true : false;

type ActType = import('../acts').ActType;
type Permission = import('../acts').Permission;
type Role = import('../acts').Role;
type ActPermissions = (typeof import('../acts'))['ACT_PERMISSIONS'];

/** AC-2: `ACT_PERMISSIONS` answers for every act type — a missing entry is a compile error. */
const ACT_PERMISSIONS_IS_TOTAL: TotalOver<ActType, ActPermissions> = true;

/** AC-2: and what it answers with is a Permission, not a widened string. */
const ACT_PERMISSIONS_ANSWERS_PERMISSIONS: ActPermissions[ActType] extends Permission
  ? true
  : false = true;

/** AC-2: the three vocabularies are derived from their tables (`keyof typeof …`), not declared. */
const VOCABULARY_IS_DERIVED: TotalOver<ActType, (typeof import('../acts'))['ACT_TYPES']> extends true
  ? TotalOver<Permission, (typeof import('../acts'))['PERMISSIONS']> extends true
    ? TotalOver<Role, (typeof import('../acts'))['ROLE_BUNDLES']>
    : false
  : false = true;

/* ───────────────────────────────── loading the barrel ───────────────────────────────── */

const at = (relative: string): string => join(REPO, ...relative.split('/'));

async function importProduct(relative: string): Promise<Record<string, unknown>> {
  const base = at(relative);
  const found = [base, `${base}.ts`, join(base, 'index.ts')].find((path) => existsSync(path));
  if (found === undefined) throw new Error(`${relative} is not in the tree`);
  return (await import(pathToFileURL(found).href)) as Record<string, unknown>;
}

let barrelOnce: Promise<Record<string, unknown>> | undefined;

/** Memoised, and awaited inside each test: a throwing `beforeAll` reports its tests as skipped. */
function barrel(): Promise<Record<string, unknown>> {
  barrelOnce ??= importProduct(ACTS_BARREL);
  return barrelOnce;
}

/** One of the barrel's frozen tables, as a plain record. */
async function table(name: string): Promise<Record<string, unknown>> {
  const module = await barrel();
  const value = module[name];
  expect(typeof value, `${ACTS_BARREL} exports no ${name} object`).toBe('object');
  expect(value, `${ACTS_BARREL} exports ${name} as null`).not.toBeNull();
  return value as Record<string, unknown>;
}

const namesIn = async (name: string): Promise<string[]> => Object.keys(await table(name));

/**
 * The permissions one role bundles, however the bundle is carried.
 *
 * AC-2 fixes the *contents* of each bundle and leaves the container to the seam — an array, a
 * Set and a frozen record of flags all say the same six things — so this reads whichever it
 * is and refuses anything it cannot read rather than reporting an empty bundle.
 */
function membersOf(role: string, value: unknown): string[] {
  if (Array.isArray(value)) return value.map((member) => String(member));
  if (value instanceof Set) return [...value].map((member) => String(member));
  if (typeof value === 'object' && value !== null) return Object.keys(value);
  throw new Error(`ROLE_BUNDLES.${role} is ${typeof value}, which carries no permissions`);
}

const sorted = (values: readonly string[]): string[] => [...values].sort();

/* ──────────────────────────────── reading the tree, for Q-07 ────────────────────────── */

const SKIP_DIRS = new Set(['node_modules', 'out', 'dist', 'coverage', 'test-results', 'cad']);

/** Every TypeScript file under a repo-relative directory, as repo-relative POSIX paths. */
function walk(dir: string): string[] {
  const absolute = at(dir);
  if (!existsSync(absolute)) return [];
  const found: string[] = [];
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
    const child = `${dir}/${entry.name}`;
    if (entry.isDirectory()) found.push(...walk(child));
    else if (child.endsWith('.ts') || child.endsWith('.tsx')) found.push(child);
  }
  return found;
}

const read = (relative: string): string => readFileSync(at(relative), 'utf8');

/**
 * Product source under `src/`: outside every `__tests__`, and outside the registries — the one
 * place a name of the taxonomy is allowed to be spelled (src/core/errors/, per Q-07's own
 * exclusion). This is the set AC-1's second half is about.
 */
const isProductSource = (relative: string): boolean =>
  relative.startsWith('src/') &&
  !relative.startsWith('src/core/errors/') &&
  !relative.split('/').includes('__tests__');

/**
 * Every quoted string literal in a TypeScript file, comments left out.
 *
 * Comments are skipped whole because a doc comment naming a permission in prose is prose, and
 * calling it a spelled literal would make every well-written header a violation.
 */
function literals(text: string): string[] {
  const found: string[] = [];
  let i = 0;
  while (i < text.length) {
    const pair = text.slice(i, i + 2);
    if (pair === '//') {
      const end = text.indexOf('\n', i);
      i = end === -1 ? text.length : end + 1;
      continue;
    }
    if (pair === '/*') {
      const end = text.indexOf('*/', i + 2);
      i = end === -1 ? text.length : end + 2;
      continue;
    }
    const quote = text[i];
    if (quote !== "'" && quote !== '"' && quote !== '`') {
      i += 1;
      continue;
    }
    i += 1;
    let value = '';
    while (i < text.length && text[i] !== quote) {
      if (text[i] === '\\') {
        i += 2;
        continue;
      }
      value += text[i];
      i += 1;
    }
    i += 1;
    found.push(value);
  }
  return found;
}

/** Every module specifier a file imports from, `import` and `export … from` alike. */
function importedFrom(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g)) {
    const specifier = match[1];
    if (specifier !== undefined) found.push(specifier);
  }
  for (const match of text.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    const specifier = match[1];
    if (specifier !== undefined) found.push(specifier);
  }
  return found;
}

describe('AC-2 — the closed vocabulary (L-ACT-03)', () => {
  it('AC-2: PERMISSIONS carries exactly the thirteen names L-ACT-03 cuts on', async () => {
    expect(
      sorted(await namesIn('PERMISSIONS')),
      'the permission enum is not L-ACT-03’s closed set',
    ).toEqual(sorted(PERMISSION_NAMES));
  });

  it('AC-2: ROLE_BUNDLES carries exactly the six roles, each bundling exactly its clause', async () => {
    const bundles = await table('ROLE_BUNDLES');
    expect(
      sorted(Object.keys(bundles)),
      'the shipped roles are not L-ACT-03’s six ("roles … are the only thing a human picks")',
    ).toEqual(sorted([...Object.keys(NAMED_BUNDLES), PRINCIPAL]));

    for (const [role, expected] of Object.entries(NAMED_BUNDLES)) {
      expect(
        sorted(membersOf(role, bundles[role])),
        `${role} does not bundle exactly what L-ACT-03 gives it`,
      ).toEqual(sorted(expected));
    }

    // "PRINCIPAL (all)" — all of whatever the enum holds, read from the enum itself.
    const permissions = await namesIn('PERMISSIONS');
    expect(
      sorted(membersOf(PRINCIPAL, bundles[PRINCIPAL])),
      'PRINCIPAL does not hold every permission',
    ).toEqual(sorted(permissions));
  });

  it('AC-2: no two roles bundle the same permissions, and every member is a permission', async () => {
    const bundles = await table('ROLE_BUNDLES');
    const permissions = new Set(await namesIn('PERMISSIONS'));
    const seen = new Map<string, string>();
    for (const role of Object.keys(bundles)) {
      const members = membersOf(role, bundles[role]);
      for (const member of members) {
        expect(
          permissions.has(member),
          `${role} bundles ${member}, which is not a member of the permission enum`,
        ).toBe(true);
      }
      const signature = sorted(members).join('+');
      const twin = seen.get(signature);
      expect(twin, `${role} and ${String(twin)} bundle exactly the same permissions`).toBeUndefined();
      seen.set(signature, role);
    }
  });

  it('AC-2 / R-SPINE-062: the three tables are frozen, so nothing can widen the closed sets', async () => {
    // "ACT_TYPES, PERMISSIONS, ROLE_BUNDLES as frozen objects": closed is a property of the
    // vocabulary at runtime, not of the annotations — a `readonly` that vanishes at compile
    // time still lets an importer add a permission.
    for (const name of ['ACT_TYPES', 'PERMISSIONS', 'ROLE_BUNDLES']) {
      expect(Object.isFrozen(await table(name)), `${name} is not frozen`).toBe(true);
    }
  });
});

describe('AC-2 — the total maps (L-ACT-02, L-ACT-03)', () => {
  it('AC-2: ACT_TYPES carries ASSIGN_PARTICIPANT_ROLE — the one act the tree can perform', async () => {
    // `toContain`, not an exact set: every later increment founds act types here, and a test
    // that pinned today's roster would redden the first one that did.
    expect(await namesIn('ACT_TYPES'), 'the act-type enum does not carry M0’s one act').toContain(
      ASSIGN_PARTICIPANT_ROLE,
    );
  });

  it('AC-2: ACT_PERMISSIONS answers for every member of ACT_TYPES, with a real permission', async () => {
    const actTypes = await namesIn('ACT_TYPES');
    const map = await table('ACT_PERMISSIONS');
    const permissions = new Set(await namesIn('PERMISSIONS'));
    expect(actTypes.length, 'ACT_TYPES is empty, so ranging over it proves nothing').toBeGreaterThan(0);
    for (const actType of actTypes) {
      const permission = map[actType];
      expect(permission, `ACT_PERMISSIONS has no entry for ${actType}`).toBeDefined();
      expect(
        permissions.has(String(permission)),
        `ACT_PERMISSIONS maps ${actType} to ${String(permission)}, which is not a permission`,
      ).toBe(true);
    }
  });

  it('AC-2 / L-ACT-03: ASSIGN_PARTICIPANT_ROLE moves the project, so it needs ADMINISTER_PROJECT', async () => {
    const map = await table('ACT_PERMISSIONS');
    expect(String(map[ASSIGN_PARTICIPANT_ROLE])).toBe(ADMINISTER_PROJECT);
  });

  it('AC-2: both maps are declared total over ActType, so a rendering-less act cannot compile', async () => {
    // The compile-time half — decided by `tsc --noEmit` inside `pnpm verify`, asserted here so
    // the consts above are used and a regression is a red test rather than a silent edit.
    expect(ACT_PERMISSIONS_IS_TOTAL).toBe(true);
    expect(ACT_PERMISSIONS_ANSWERS_PERMISSIONS).toBe(true);
    expect(VOCABULARY_IS_DERIVED).toBe(true);

    // And the mechanism that carries it. AC-2 names `satisfies Record<ActType, …>` because an
    // annotated `const m: Record<ActType, X> = {…}` type-checks while widening the value's own
    // type — the totality would hold and the map would stop being the closed thing it is.
    const declarations = walk(ACTS_DIR)
      .filter((relative) => !relative.split('/').includes('__tests__'))
      .flatMap((relative) => [...read(relative).matchAll(/satisfies\b[^;\n]*\bRecord<\s*ActType\b/g)]);
    expect(
      declarations.length,
      `${ACTS_DIR} declares ${String(declarations.length)} map(s) with "satisfies … Record<ActType, …>"; ` +
        'AC-2 names two — act type → permission, and act type → { preview, commit }',
    ).toBeGreaterThanOrEqual(2);
  });
});

describe('AC-1 / Q-07 — the vocabulary is never spelled as a quoted literal', () => {
  it('AC-1: no act type, permission or role appears under src/ as a string literal', async () => {
    const vocabulary = new Set([
      ...(await namesIn('ACT_TYPES')),
      ...(await namesIn('PERMISSIONS')),
      ...(await namesIn('ROLE_BUNDLES')),
    ]);
    const offences: string[] = [];
    for (const relative of walk('src')) {
      if (!isProductSource(relative)) continue;
      for (const literal of literals(read(relative))) {
        if (vocabulary.has(literal)) offences.push(`${relative}: "${literal}"`);
      }
    }
    expect(
      offences,
      'these are quoted spellings of the closed vocabulary. Declare them as unquoted identifier ' +
        'keys on the frozen tables and derive every other use (zod enums included) from ' +
        'Object.keys — Q-07’s orphan scan refuses the rest',
    ).toEqual([]);
  });

  it('AC-1: the scan reads literals and not prose, so neither answer is an accident', () => {
    // Non-vacuity, both ways: a name in a comment is prose (the headers above are full of
    // them), a name in quotes is a spelling, and the scanner has to tell them apart or this
    // whole claim passes any tree at all.
    expect(literals(`/* PRINCIPAL is a role */ const a = 'MEASURE';`)).toEqual(['MEASURE']);
    expect(literals(`// SIGN\nconst b = 1;`)).toEqual([]);
  });
});

describe('AC-2 — the barrel is the seam’s only import surface', () => {
  it('AC-2: nothing outside src/core/acts reaches past the barrel', () => {
    const offences: string[] = [];
    for (const relative of walk('src')) {
      if (relative.startsWith(`${ACTS_DIR}/`)) continue;
      for (const specifier of importedFrom(read(relative))) {
        const match = /(?:^|\/)core\/acts\/(.+)$/.exec(specifier);
        const inner = match?.[1];
        if (inner === undefined || inner === 'index') continue;
        offences.push(`${relative}: ${specifier}`);
      }
    }
    expect(
      offences,
      'the act seam is imported past its barrel; src/core/acts/index.ts is its only import surface',
    ).toEqual([]);
  });
});

/**
 * Test support for inc-007b's public acceptance — the three things every suite here needs:
 * the public component surface (derived, never listed), the gallery module (loaded per test),
 * and the Design Decision's roster (parsed from the committed document).
 *
 * Nothing in this file names a component. R-UI-011's rule is "a component without a gallery
 * entry fails a test", which is only true if the roster of components is read from the barrels
 * at the moment the test runs: a list written down here would pass today and go quietly wrong
 * on the first increment that lawfully adds a primitive.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactElement } from 'react';

const REPO = process.cwd();

/** The three barrels the Increment Spec settles as "the public component surface". */
export const BARRELS: readonly string[] = [
  'src/ui/primitives/index.ts',
  'src/ui/patterns/index.ts',
  'src/ui/data/index.ts',
];

/** Where the Design Decision lives (AM-03). */
export const DESIGN_DOC = 'docs/design/s-design.md';

export const absolute = (relative: string): string => join(REPO, relative);

/** One state of one entry, as the spec's `GalleryEntryState` describes it. */
export interface EntryStateLike {
  readonly name: string;
  readonly render: () => unknown;
}

/** One entry, as the spec's `GalleryEntry` describes it. */
export interface EntryLike {
  readonly id: string;
  readonly covers: readonly string[];
  readonly states: readonly EntryStateLike[];
}

/** `GalleryScreen`, as the Increment Spec types it: one optional `screenState` prop. */
export type GalleryScreenComponent = (props: { screenState?: string }) => ReactElement;

/** The gallery module's public shape, as the Increment Spec's `interfaces` section fixes it. */
export interface GalleryModule {
  readonly GalleryScreen: GalleryScreenComponent;
  readonly galleryEntries: readonly EntryLike[];
  readonly coverageReport: (
    exportNames: readonly string[],
    entries: readonly EntryLike[],
  ) => { missing: string[]; unknown: string[] };
}

/**
 * Import a product module by repo-relative path, at run time.
 *
 * The specifier is assembled here rather than written as a literal on purpose: a literal
 * relative specifier is resolved by the bundler while it transforms this file, so a module the
 * Builder has not written yet turns the whole suite into a collection error reporting "0 test"
 * — no test fails, and an acceptance that reports no failures proves no red. Assembled, the
 * import is resolved when the test runs, and a missing module is one failing test with a
 * message that names it.
 */
export async function importProduct<T>(relative: string): Promise<T> {
  const path = absolute(relative);
  if (!existsSync(path)) throw new Error(`missing ${relative}`);
  return (await import(path)) as T;
}

/**
 * Load `src/ui/gallery/index.ts`. Called from inside each test rather than from a hook: a
 * throwing `beforeAll` makes vitest report its tests as skipped, and a suite that skips proves
 * no red (standing lesson, inc-104).
 */
export async function gallery(): Promise<GalleryModule> {
  return await importProduct<GalleryModule>('src/ui/gallery/index.ts');
}

/**
 * The predicate the Increment Spec settles: a capitalized value export that is a React
 * component. `toast` is lower-case and excluded by the same rule that keeps `SelectItem` in.
 */
export function isComponentExport(name: string, value: unknown): boolean {
  if (!/^[A-Z]/.test(name)) return false;
  if (typeof value === 'function') return true;
  return typeof value === 'object' && value !== null && '$$typeof' in value;
}

/** Every component export of one barrel, read off the module object at run time. */
async function barrelComponents(relative: string): Promise<string[]> {
  const module_ = await importProduct<Record<string, unknown>>(relative);
  return Object.entries(module_)
    .filter(([name, value]) => isComponentExport(name, value))
    .map(([name]) => name);
}

/** The public component surface: every component export of the three barrels, sorted. */
export async function publicSurface(): Promise<string[]> {
  const found: string[] = [];
  for (const barrel of BARRELS) found.push(...(await barrelComponents(barrel)));
  return [...new Set(found)].sort();
}

/** One row of the Design Decision's §5 roster. */
export interface DocRow {
  readonly id: string;
  readonly states: readonly string[];
}

/**
 * The roster the Design Decision commits (§5), parsed from the document rather than copied
 * into this file: AM-03 makes docs/design/s-design.md the contract, so the test reads the
 * contract instead of a transcription of it that can drift.
 */
export function docRoster(): DocRow[] {
  const source = readFileSync(absolute(DESIGN_DOC), 'utf8');
  const start = source.indexOf('## 5.');
  const end = source.indexOf('## 6.');
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`${DESIGN_DOC}: could not find the §5 roster section`);
  }
  const rows: DocRow[] = [];
  for (const line of source.slice(start, end).split('\n')) {
    const cells = line.split('|').map((cell) => cell.trim());
    // A roster row is `| \`id\` | covers | states | sample |` — five cells with the leading
    // and trailing empties. The header and the `|---|` rule do not match the backticked id.
    if (cells.length < 5) continue;
    const id = /^`([a-z][a-z0-9-]*)`$/.exec(cells[1] ?? '')?.[1];
    if (id === undefined) continue;
    const states = (cells[3] ?? '')
      .split('·')
      .map((state) => state.trim().replace(/`/g, ''))
      .filter((state) => state.length > 0);
    rows.push({ id, states });
  }
  return rows;
}

/**
 * The screen-chrome string table the Design Decision commits (§7), parsed from the document:
 * AM-03 (2) makes copy design, so the table's English values are read from the decision and
 * compared with the table the module ships.
 */
export function docStringTable(): Map<string, string> {
  const source = readFileSync(absolute(DESIGN_DOC), 'utf8');
  const start = source.indexOf('## 7.');
  const end = source.indexOf('## 8.');
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`${DESIGN_DOC}: could not find the §7 string table section`);
  }
  const table = new Map<string, string>();
  for (const line of source.slice(start, end).split('\n')) {
    const cells = line.split('|').map((cell) => cell.trim());
    if (cells.length < 4) continue;
    const key = /^`(design\.[A-Za-z0-9.]+)`$/.exec(cells[1] ?? '')?.[1];
    const value = cells[2] ?? '';
    if (key === undefined || value.length === 0) continue;
    table.set(key, value);
  }
  return table;
}

/** The seven R-UI-050 state names, in the Design Decision's §2 order. */
export const SCREEN_STATES: readonly string[] = [
  'loading',
  'empty',
  'error',
  'refusal',
  'partial',
  'offline',
  'permission-denied',
];

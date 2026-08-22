/**
 * inc-007 acceptance — the gallery registry, and completeness with teeth (AC-2, R-UI-011).
 *
 * R-UI-011: "A living gallery at `/design` renders every component in every state in both
 * themes with sample data; the visual baseline suite screenshots it; a component without a
 * gallery entry fails a test." This suite is that test.
 *
 * AC-2: "a vitest test under src/app/design/__tests__/ derives the component roster AT RUN
 * TIME from the three barrels (every capitalised value export of src/ui/primitives,
 * src/ui/patterns, src/ui/data — never a frozen list) and fails if any derived component is
 * absent from the union of covers, or any covers name is no longer exported."
 *
 * Nothing here names a component. The roster is whatever the barrels export when the suite
 * runs, so the increment that lawfully adds a component to a barrel reddens this file until
 * the gallery shows it — which is the only form of R-UI-011 that stays true after today.
 * `toast` is a function rather than a component and is lowercase; the capitalisation rule the
 * criterion states is what excludes it (Design Decision §3 says so in the same words).
 *
 * The registry is loaded inside each test, so a module that does not exist yet reads as one
 * missing behaviour per test rather than a single collection error. It is loaded through a
 * runtime URL for the same reason the held-out set does: the specifier is not a compile-time
 * dependency of the acceptance, so the red is the missing gallery and never a type error in
 * this file.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { rosterRows } from './design-doc';

const REPO = process.cwd();

/** AC-2 names the three barrels the roster is derived from, and nothing else. */
const BARRELS: Readonly<Record<string, () => Promise<Record<string, unknown>>>> = {
  'src/ui/primitives': () => import('../../../ui/primitives') as Promise<Record<string, unknown>>,
  'src/ui/patterns': () => import('../../../ui/patterns') as Promise<Record<string, unknown>>,
  'src/ui/data': () => import('../../../ui/data') as Promise<Record<string, unknown>>,
};

/** The file the Increment Spec's `interfaces` line names. */
const REGISTRY_PATH = 'src/app/design/registry.tsx';

/** The entry shape AC-2 fixes, typed here so the acceptance never depends on product types. */
interface GalleryEntryShape {
  readonly slug: string;
  readonly covers: readonly string[];
  readonly states: readonly { readonly name: string; readonly render: () => unknown }[];
}

/** The registry module, per test (see the file header). */
async function loadRegistry(): Promise<Record<string, unknown>> {
  // A clear red beats a module-resolution error: the gallery is what is missing.
  expect(
    existsSync(join(REPO, REGISTRY_PATH)),
    `AC-2: ${REGISTRY_PATH} must export galleryEntries`,
  ).toBe(true);
  const specifier = new URL('../registry.tsx', import.meta.url).href;
  return (await import(specifier)) as Record<string, unknown>;
}

/** `galleryEntries`, shape-checked once so every other assertion can read it as data. */
async function galleryEntries(): Promise<readonly GalleryEntryShape[]> {
  const mod = await loadRegistry();
  const entries = mod['galleryEntries'];
  expect(Array.isArray(entries), 'AC-2: galleryEntries is an array of entries').toBe(true);
  return entries as readonly GalleryEntryShape[];
}

/** Every capitalised value export of the three barrels, at run time: name → barrel. */
async function derivedRoster(): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  for (const [barrel, load] of Object.entries(BARRELS)) {
    const mod = await load();
    for (const [name, value] of Object.entries(mod)) {
      if (!/^[A-Z]/.test(name)) continue;
      if (value === undefined) continue;
      found.set(name, barrel);
    }
  }
  return found;
}

/**
 * R-UI-011's rule, as a function: which derived components no entry demonstrates. Naming it
 * lets the suite prove the rule bites rather than only that today's tree satisfies it.
 */
function uncovered(roster: Iterable<string>, covers: ReadonlySet<string>): string[] {
  return [...roster].filter((name) => !covers.has(name)).sort();
}

/** The union of every entry's `covers`. */
function coveredNames(entries: readonly GalleryEntryShape[]): Set<string> {
  return new Set(entries.flatMap((entry) => [...entry.covers]));
}

describe('inc-007 — the gallery registry (AC-2, R-UI-011)', () => {
  it('AC-2: galleryEntries is a list of { slug, covers, states: { name, render }[] }', async () => {
    const entries = await galleryEntries();
    expect(entries.length, 'AC-2: an empty registry demonstrates nothing').toBeGreaterThan(0);

    const slugs = entries.map((entry) => entry.slug);
    expect(new Set(slugs).size, 'AC-2: one entry per slug — a testid is unique').toBe(slugs.length);

    for (const entry of entries) {
      // The testid is `gallery-entry-${slug}`, so the slug is kebab-case (test contract).
      expect(entry.slug, 'AC-2: slug is kebab-case').toMatch(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/);
      expect(entry.covers.length, `AC-2: ${entry.slug} covers at least one export`).toBeGreaterThan(
        0,
      );
      expect(entry.states.length, `AC-2: ${entry.slug} renders at least one state`).toBeGreaterThan(
        0,
      );
      for (const state of entry.states) {
        expect(typeof state.name, `AC-2: ${entry.slug} state name is a string`).toBe('string');
        expect(state.name.trim(), `AC-2: ${entry.slug} state name is not blank`).not.toBe('');
        expect(
          typeof state.render,
          `AC-2: ${entry.slug} / ${state.name} renders through a function`,
        ).toBe('function');
      }
      const stateNames = entry.states.map((state) => state.name);
      expect(new Set(stateNames).size, `AC-2: ${entry.slug} names each state once`).toBe(
        stateNames.length,
      );
    }
  });

  it('AC-2 / R-UI-011: every component the three barrels export has a gallery entry', async () => {
    const roster = await derivedRoster();
    expect(roster.size, 'AC-2: the barrels export a roster to cover').toBeGreaterThan(0);
    const covers = coveredNames(await galleryEntries());
    expect(
      uncovered(roster.keys(), covers),
      'R-UI-011: a component without a gallery entry fails a test',
    ).toEqual([]);
  });

  it('AC-2: no entry covers a name the barrels no longer export', async () => {
    const roster = await derivedRoster();
    const entries = await galleryEntries();
    const stale = [...coveredNames(entries)].filter((name) => !roster.has(name)).sort();
    expect(stale, 'AC-2: a covers name that is no longer exported is a stale entry').toEqual([]);
  });

  it('AC-2: the derived roster draws from all three barrels', async () => {
    const roster = await derivedRoster();
    // AC-2: "derives the component roster AT RUN TIME from the three barrels". Each barrel the
    // criterion names must contribute at least one capitalised export, so a derivation that
    // goes blind to one of them reddens here directly rather than only once a name goes stale.
    // The expected set is the barrel list the criterion fixes, never a count copied from today.
    expect(
      new Set(roster.values()),
      'AC-2: every one of the three barrels contributes to the derived roster',
    ).toEqual(new Set(Object.keys(BARRELS)));
  });

  it('AC-2: uncovered() reports a missing name — the roster test’s completeness assertion is not vacuous', async () => {
    const roster = await derivedRoster();
    const covers = coveredNames(await galleryEntries());
    // A vacuity guard for the test above, not the clause's teeth: a real barrel export with no
    // gallery entry fails the roster test, which runs uncovered() over the derivation itself.
    // Here a name the barrels do not export is appended by hand, so that if the shared helper
    // ever stopped reporting misses, the roster test's `toEqual([])` could no longer pass for
    // the wrong reason without this one going red.
    const withMissingName = [...roster.keys(), 'ComponentAddedByALaterIncrement'];
    expect(
      uncovered(withMissingName, covers),
      'AC-2: uncovered() must report a name no entry covers',
    ).toEqual(['ComponentAddedByALaterIncrement']);
  });

  it('AC-1 / AM-03: the registry carries every entry the Design Decision §3 decides', async () => {
    const entries = await galleryEntries();
    const bySlug = new Map(entries.map((entry) => [entry.slug, entry]));
    const rows = rosterRows(REPO);
    expect(rows.length, 'AM-03: the Design Decision §3 roster is the contract').toBeGreaterThan(0);

    for (const row of rows) {
      const entry = bySlug.get(row.slug);
      expect(entry, `AM-03: §3 decides an entry for ${row.slug}`).toBeDefined();
      if (entry === undefined) continue;
      // A floor, not a freeze: §3 is what must be there, and a later row is a later red.
      const states = new Set(entry.states.map((state) => state.name));
      for (const state of row.states) {
        expect(states, `AM-03: ${row.slug} renders the §3 state "${state}"`).toContain(state);
      }
      const covers = new Set(entry.covers);
      for (const name of row.covers) {
        expect(covers, `AM-03: ${row.slug} covers ${name}`).toContain(name);
      }
    }
  });
});

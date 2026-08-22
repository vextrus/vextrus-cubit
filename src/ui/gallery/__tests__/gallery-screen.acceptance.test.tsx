// @vitest-environment jsdom
/**
 * inc-007b acceptance — the living gallery paints every component in every state (AC-1, AC-3).
 *
 * R-UI-011: "A living gallery at `/design` renders every component in every state in both
 * themes with sample data; the visual baseline suite screenshots it; a component without a
 * gallery entry fails a test." The last clause is this file: the roster of components is
 * derived from the three barrels at run time, so a primitive that lands next month with no
 * entry reddens here by name — and a frozen list, which would pass that day and lie, is
 * exactly what the lanes-armed arbitration punished.
 *
 * AM-03 makes docs/design/s-design.md the contract, so §5's roster is parsed out of the
 * document and compared with what the gallery declares: the design decides the entry ids and
 * the state names, and the build matches it or is a defect.
 *
 * The module is loaded inside each test, never in a hook: a throwing `beforeAll` makes vitest
 * report its tests as skipped, and a skipped acceptance proves nothing (standing lesson).
 */
import { existsSync, readFileSync } from 'node:fs';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
// Type-only: erased before the module is resolved, and still binds the names the Increment
// Spec fixes for `src/ui/gallery/index.ts` to what tsc checks.
import type { GalleryEntry, GalleryEntryState } from '../index';
import {
  DESIGN_DOC,
  SCREEN_STATES,
  absolute,
  docRoster,
  gallery,
  importProduct,
  publicSurface,
} from './support/surface';

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('data-theme');
});

/** Every `gallery-entry-*` cell the render painted, by test id. */
function paintedCells(): string[] {
  return [...document.querySelectorAll('[data-testid^="gallery-entry-"]')].map(
    (node) => node.getAttribute('data-testid') ?? '',
  );
}

describe('AC-3 — every component of the public surface has an entry (R-UI-011)', () => {
  it('covers every capitalized component export of the three barrels, by name', async () => {
    const surface = await publicSurface();
    const { galleryEntries } = await gallery();

    // The surface is derived, so this guard is about the derivation itself: if the barrels
    // stopped exporting components the rest of the suite would be vacuously green.
    expect(surface.length).toBeGreaterThan(0);

    const coveredBy = new Map<string, string[]>();
    for (const entry of galleryEntries) {
      for (const name of entry.covers) {
        coveredBy.set(name, [...(coveredBy.get(name) ?? []), entry.id]);
      }
    }

    // R-UI-011 fails BY NAME: the message is the component nobody drew, not a count.
    const missing = surface.filter((name) => !coveredBy.has(name));
    expect(missing, `components with no gallery entry: ${missing.join(', ')}`).toEqual([]);

    // "exactly one entry" (AC-2): two entries claiming SelectItem is an unresolved question
    // about where it is drawn, not coverage.
    const duplicated = surface.filter((name) => (coveredBy.get(name) ?? []).length > 1);
    expect(
      duplicated.map((name) => `${name} → ${(coveredBy.get(name) ?? []).join(' + ')}`),
      'components covered by more than one entry',
    ).toEqual([]);

    // And nothing is claimed that the barrels do not export (the `unknown` half of the seam).
    const claimed = [...coveredBy.keys()];
    const unknown = claimed.filter((name) => !surface.includes(name));
    expect(unknown, `covers names matching no barrel export: ${unknown.join(', ')}`).toEqual([]);
  });

  it('agrees with coverageReport, the pure seam the completeness test stands on', async () => {
    const surface = await publicSurface();
    const { coverageReport, galleryEntries } = await gallery();

    expect(coverageReport(surface, galleryEntries)).toEqual({ missing: [], unknown: [] });
  });

  it('paints one cell per declared state, all inside design-gallery-root', async () => {
    const { GalleryScreen, galleryEntries } = await gallery();

    render(<GalleryScreen />);

    const root = screen.getByTestId('design-gallery-root');
    const expected: string[] = [];
    for (const entry of galleryEntries) {
      expect(entry.states.length, `entry ${entry.id} declares no state`).toBeGreaterThan(0);
      for (const state of entry.states) {
        const testid = `gallery-entry-${entry.id}-${state.name}`;
        expected.push(testid);
        const cells = document.querySelectorAll(`[data-testid="${testid}"]`);
        expect(cells.length, `${testid}: expected exactly one cell`).toBe(1);
        expect(root.contains(cells[0] ?? null), `${testid} is outside design-gallery-root`).toBe(
          true,
        );
      }
    }

    // No stray cells either: every `gallery-entry-*` id on the page belongs to a declared
    // id × state pair (Design Decision §11).
    const strays = paintedCells().filter((testid) => !expected.includes(testid));
    expect(strays, `cells for undeclared entry states: ${strays.join(', ')}`).toEqual([]);
  });

  it('paints the same roster in both themes (R-UI-011)', async () => {
    const { GalleryScreen } = await gallery();

    render(<GalleryScreen />);
    const light = paintedCells().sort();
    expect(light.length, 'the gallery painted no cells in the default theme').toBeGreaterThan(0);
    cleanup();

    // The flip is the token sheet's (Design Decision §10): the same components, drawn on the
    // other surface — an entry that disappears in dark is not "every component in both themes".
    document.documentElement.setAttribute('data-theme', 'dark');
    render(<GalleryScreen />);

    expect(paintedCells().sort(), 'the dark theme paints a different roster').toEqual(light);
  });

  it('ships one entry module per root component at src/ui/gallery/entries/<component>.tsx', async () => {
    const { galleryEntries } = await gallery();

    for (const entry of galleryEntries) {
      const path = `src/ui/gallery/entries/${entry.id}.tsx`;
      expect(existsSync(absolute(path)), `missing ${path}`).toBe(true);

      const module_ = await importProduct<{ entry?: GalleryEntry }>(path);
      expect(module_.entry, `${path} exports no \`entry\``).toBeDefined();
      expect(module_.entry?.id, `${path} exports an entry with a different id`).toBe(entry.id);

      // The id is the kebab-case root component name the Increment Spec fixes.
      expect(entry.id, `${entry.id} is not kebab-case`).toMatch(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/);
      const states: readonly GalleryEntryState[] = entry.states as readonly GalleryEntryState[];
      for (const state of states) {
        expect(typeof state.render, `${entry.id}/${state.name} has no render()`).toBe('function');
      }
    }
  });
});

describe('AC-1 — the gallery renders the roster the Design Decision commits (AM-03)', () => {
  it('declares exactly the id × state pairs of docs/design/s-design.md §5', async () => {
    const rows = docRoster();

    // The premise: the committed decision is a roster, not a sketch (AM-03 (1)).
    expect(rows.length, 'docs/design/s-design.md §5 lists no entries').toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.states.length, `§5 row ${row.id} declares no state`).toBeGreaterThan(0);
    }

    const { galleryEntries } = await gallery();

    const documented = rows.map((row) => row.id).sort();
    const built = galleryEntries.map((entry) => entry.id).sort();
    expect(built, 'the built roster is not the roster the Design Decision commits').toEqual(
      documented,
    );

    for (const row of rows) {
      const entry = galleryEntries.find((candidate) => candidate.id === row.id);
      expect(entry, `no entry for §5 row ${row.id}`).toBeDefined();
      expect(
        (entry?.states ?? []).map((state) => state.name).sort(),
        `${row.id}: states differ from the Design Decision`,
      ).toEqual([...row.states].sort());
    }
  });

  it('paints the chrome the decision names: the root wrapper and the theme control', async () => {
    // C-05: the names are product API, and AM-03 (1) puts them in the decision first. The
    // premise is that the document spells them; what is graded is that the screen paints them.
    const decision = readFileSync(absolute(DESIGN_DOC), 'utf8');
    const names = ['/design', 'design-gallery-root', 'design-theme-toggle', ...SCREEN_STATES];
    for (const name of names) {
      expect(decision, `the Design Decision does not name ${name}`).toContain(name);
    }

    const { GalleryScreen } = await gallery();
    render(<GalleryScreen />);

    expect(screen.getAllByTestId('design-gallery-root')).toHaveLength(1);
    expect(screen.getAllByTestId('design-theme-toggle')).toHaveLength(1);
  });
});

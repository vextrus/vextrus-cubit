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
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
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

  it('paints a roster that is invariant under data-theme (Design Decision §10)', async () => {
    const { GalleryScreen } = await gallery();

    render(<GalleryScreen />);
    const light = paintedCells().sort();
    expect(light.length, 'the gallery painted no cells in the default theme').toBeGreaterThan(0);
    cleanup();

    // Scope, honestly stated: this is the no-forked-markup guard of Design Decision §10 ("No
    // forked CSS in this screen"), not the both-themes grade. jsdom applies no CSS, so a render
    // under `data-theme="dark"` can only differ if the gallery branches its own markup on the
    // attribute — which the decision forbids, and which would let an entry vanish in dark. The
    // dark theme's existence is graded below off the shipped token sheet; the actual paint in
    // both themes is the visual-baseline suite's, where AM-03 (4) puts it.
    document.documentElement.setAttribute('data-theme', 'dark');
    render(<GalleryScreen />);

    expect(paintedCells().sort(), 'the roster changes when data-theme is set').toEqual(light);
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

describe('R-UI-011 — the dark theme the gallery is drawn in exists (Design Decision §9, §10)', () => {
  /*
   * The token half of "in both themes". jsdom paints nothing, so the browser-side half — the
   * screen actually rendered on both surfaces — is the visual-baseline suite's under AM-03 (4)
   * ("screenshotted in both themes and diffed across increments"). What is checkable here, and
   * fails by name when it is wrong, is the premise that whole arrangement rests on: §10 says
   * "the flip is the token sheet's", so every token this screen paints with has to be given a
   * dark value by the sheet the segment loads. A build with no dark theme reddens here.
   *
   * Nothing below names a token or a count: the consumed names are read out of the shipped
   * sources and the scopes out of the shipped sheet, so a later increment that paints with one
   * more token is graded on the same rule rather than against today's list.
   */

  /** The stylesheet the `/design` segment loads, with its relative `@import`s inlined. */
  function segmentStylesheet(): string {
    const layout = readFileSync(absolute('src/app/design/layout.tsx'), 'utf8');
    const entry = /import\s+['"](\.[^'"]+\.css)['"]/.exec(layout)?.[1];
    expect(entry, 'src/app/design/layout.tsx imports no stylesheet (AC-4)').toBeDefined();

    const read = (relative: string, seen: Set<string>): string => {
      if (seen.has(relative)) return '';
      seen.add(relative);
      expect(existsSync(absolute(relative)), `the segment's sheet imports missing ${relative}`).toBe(
        true,
      );
      const source = readFileSync(absolute(relative), 'utf8');
      let out = source;
      for (const [, imported] of source.matchAll(/@import\s+['"](\.[^'"]+)['"]/g)) {
        out += read(join(dirname(relative), imported ?? ''), seen);
      }
      return out;
    };
    return read(join('src/app/design', entry ?? ''), new Set());
  }

  /** Drop `@media` blocks: their overrides are conditional, not a theme scope. */
  function withoutMediaBlocks(css: string): string {
    let out = '';
    for (let index = 0; index < css.length; index += 1) {
      if (!css.startsWith('@media', index)) {
        out += css[index];
        continue;
      }
      let depth = 0;
      for (; index < css.length; index += 1) {
        if (css[index] === '{') depth += 1;
        else if (css[index] === '}' && (depth -= 1) === 0) break;
      }
    }
    return out;
  }

  /** Every custom property the given selectors declare, last declaration winning. */
  function scopeDeclarations(css: string, selectors: readonly string[]): Map<string, string> {
    const declared = new Map<string, string>();
    for (const [, selectorList, body] of withoutMediaBlocks(css).matchAll(
      /([^{}]*)\{([^{}]*)\}/g,
    )) {
      const listed = (selectorList ?? '').split(',').map((one) => one.trim());
      if (!listed.some((one) => selectors.includes(one))) continue;
      for (const [, name, value] of (body ?? '').matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
        declared.set(name ?? '', (value ?? '').trim());
      }
    }
    return declared;
  }

  /** Every `var(--token)` the gallery's shipped sources paint with, derived at run time. */
  function consumedTokens(): string[] {
    const found = new Set<string>();
    const walk = (relative: string): void => {
      for (const item of readdirSync(absolute(relative), { withFileTypes: true })) {
        const child = `${relative}/${item.name}`;
        if (item.isDirectory()) {
          // The acceptance suite's own files are not the screen.
          if (item.name !== '__tests__') walk(child);
          continue;
        }
        // Wherever the screen spends a token: its own sheet, or a style prop in a module.
        if (!/\.(tsx?|css)$/.test(item.name)) continue;
        for (const [, token] of readFileSync(absolute(child), 'utf8').matchAll(
          /var\(\s*(--[a-z0-9-]+)/g,
        )) {
          found.add(token ?? '');
        }
      }
    };
    for (const root of ['src/ui/gallery', 'src/app/design']) walk(root);
    return [...found].sort();
  }

  it('gives every token the gallery paints with a value under [data-theme="dark"]', () => {
    const css = segmentStylesheet();
    const consumed = consumedTokens();

    // Derivation guard: with no consumed token the rest would be vacuously green.
    expect(consumed.length, 'the gallery paints with no Datum token at all').toBeGreaterThan(0);

    const light = scopeDeclarations(css, [':root', '[data-theme="light"]']);
    const dark = scopeDeclarations(css, ['[data-theme="dark"]']);

    expect(dark.size, 'the token sheet defines no [data-theme="dark"] scope').toBeGreaterThan(0);

    // An orphan var() is a token role the sheet never defines — the light half of §9.
    const undefinedInLight = consumed.filter((token) => !light.has(token));
    expect(
      undefinedInLight,
      `tokens the gallery paints with that no light scope defines: ${undefinedInLight.join(', ')}`,
    ).toEqual([]);

    // §10: the flip is the token sheet's, so the dark scope has to reach every one of them.
    const undefinedInDark = consumed.filter((token) => !dark.has(token));
    expect(
      undefinedInDark,
      `tokens with no [data-theme="dark"] value: ${undefinedInDark.join(', ')}`,
    ).toEqual([]);
  });

  it('repaints the colour roles the gallery paints with, rather than repeating light', () => {
    const css = segmentStylesheet();
    const light = scopeDeclarations(css, [':root', '[data-theme="light"]']);
    const dark = scopeDeclarations(css, ['[data-theme="dark"]']);

    // A colour value, by its syntax — no token is named here.
    const isColour = (value: string): boolean =>
      /#[0-9a-f]{3,8}\b/i.test(value) || /\b(rgba?|hsla?|oklch|lab|lch|color-mix)\(/.test(value);

    const colours = consumedTokens().filter((token) => isColour(light.get(token) ?? ''));
    expect(colours.length, 'the gallery paints with no colour token').toBeGreaterThan(0);

    // A colour role that reads identically on both surfaces is one theme wearing two names.
    const unflipped = colours.filter((token) => dark.get(token) === light.get(token));
    expect(
      unflipped,
      `colour tokens the dark scope leaves at their light value: ${unflipped.join(', ')}`,
    ).toEqual([]);
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

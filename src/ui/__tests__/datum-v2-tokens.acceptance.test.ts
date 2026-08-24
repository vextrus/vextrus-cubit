/**
 * inc-016 acceptance — Datum v2 ("The Total Station") re-issues the token sheet.
 *
 * AM-04 supersedes R-UI-001's `one accent "cobalt" for interactive` with one accent "beam"
 * plus an "act" copper reserved for commitment; AM-05 supersedes R-UI-003's Inter/JetBrains
 * Mono with Spline Sans / Spline Sans Mono, vendored in-repo because build sessions are
 * loopback-only. Everything else in R-UI-001/R-UI-003/R-UI-004 stands.
 *
 * The expected values below are `docs/specs/datum-v2-total-station.md` §2 — founder-final,
 * write-locked. Nothing here is re-derived: a hex that differs from §2 is a defect, not a
 * refinement. Contrast is graded in the held-out set (AC-6) off the same sheet, never off a
 * jsdom theme flip.
 *
 * Everything is graded through the module's stable exports (`cssVariables`, `renderTokensCss`,
 * `BASIS`) and through the files on disk. The emission order of `GROUPS` is observable in the
 * key order `cssVariables()` returns and in the sheet it prints, so this suite reads the
 * order law without reaching into the tree's private shape.
 *
 * A note on how the values are spelled: `cubit/no-colour-literal` binds `src/**` and exempts
 * only `src/ui/tokens.ts`, so a test that pins colour cannot write a colour. The hexes are
 * carried as digits and the alpha colours as function name + arguments, assembled by `hex()`
 * and `fn()` below. The rule is unweakened — the sheet is still the only place a colour is
 * spelled in this tree.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { BASIS, cssVariables, renderTokensCss, type Theme } from '../tokens';

const REPO = process.cwd();
const read = (relative: string): string => readFileSync(join(REPO, relative), 'utf8');

const TOKENS_CSS = 'src/ui/tokens.css';
const GLOBALS_CSS = 'src/ui/globals.css';
const FONTS_DIR = 'src/ui/fonts';
const FONTS_CSS = `${FONTS_DIR}/fonts.css`;
const FONTS_README = `${FONTS_DIR}/README.md`;
const TOKENS_DD = 'docs/design/datum-tokens.md';

const THEMES: readonly Theme[] = ['light', 'dark'];

/** A colour, assembled: the sheet stays the one file that spells one. */
const hex = (digits: string): string => '#' + digits;
/** A functional colour or easing, assembled for the same reason. */
const fn = (name: string, args: string): string => name + '(' + args + ')';

/** One token's two theme values, light first — the file's own `dual()`, read back. */
type Pair = readonly [string, string];
const light = (pair: Pair): string => pair[0];
const dark = (pair: Pair): string => pair[1];
const forTheme = (pair: Pair, theme: Theme): string => (theme === 'light' ? light(pair) : dark(pair));

const hexPair = (lightDigits: string, darkDigits: string): Pair => [hex(lightDigits), hex(darkDigits)];

/** §2 — graphite, retinted slot-for-slot; roles unchanged, all thirteen slots. */
const GRAPHITE: ReadonlyArray<readonly [string, Pair]> = [
  ['0', hexPair('F4F5F4', '0C0E11')],
  ['50', hexPair('EFF0EF', '101318')],
  ['100', hexPair('E9EBEA', '12151A')],
  ['200', hexPair('DDE0E0', '22262E')],
  ['300', hexPair('C9CDD1', '333A46')],
  ['400', hexPair('B0B6BC', '414957')],
  ['500', hexPair('7F868D', '66707F')],
  ['600', hexPair('5F6772', '7E8899')],
  ['700', hexPair('4A515B', '9AA3B2')],
  ['800', hexPair('363C45', 'C3C9D2')],
  ['900', hexPair('262B33', 'E7EAEE')],
  ['950', hexPair('191D24', 'F1F4F7')],
  ['1000', hexPair('101318', 'FBFCFD')],
];

/** §2 — beam, the one interactive accent (AM-04). Same five slots cobalt had. */
const BEAM: ReadonlyArray<readonly [string, Pair]> = [
  ['100', hexPair('E8E6F7', '1A1830')],
  ['300', hexPair('B7B1E8', '3B3478')],
  ['500', hexPair('5A4FB0', '6E63C8')],
  ['600', hexPair('473E92', '8B84E8')],
  ['700', hexPair('38316F', 'A7A1F0')],
];

/** §2 — act, the copper reserved for commitment and for nothing else (AM-04). */
const ACT: ReadonlyArray<readonly [string, Pair]> = [
  ['surface', hexPair('FBEFE4', '1D1610')],
  ['500', hexPair('A85B28', 'C97F4A')],
  ['600', hexPair('9A5326', 'E29A68')],
];

/** §2 — canvas: four keys move, four stay, and light paper/grid are untouched. */
const CANVAS_CHANGED: ReadonlyArray<readonly [string, Pair]> = [
  ['paper', hexPair('FCFCFB', '101216')],
  ['grid', hexPair('E9EAE7', '1B1F26')],
  ['selection', hexPair('5A4FB0', '8B84E8')],
  ['hover', [fn('rgba', '90, 79, 176, 0.18'), fn('rgba', '139, 132, 232, 0.26')]],
];

const CANVAS_UNCHANGED: ReadonlyArray<readonly [string, Pair]> = [
  ['ink', hexPair('23282F', 'D5D9DF')],
  ['pulse', hexPair('E8930C', 'FFB224')],
  ['measure', hexPair('C13515', 'FF7A4D')],
  ['snap', hexPair('1D7A46', '4CC38A')],
];

/** §2 "Unchanged groups (do not touch)" — semantics. */
const SEMANTIC: ReadonlyArray<readonly [string, Pair]> = [
  ['success', hexPair('1D7A46', '4CC38A')],
  ['success-surface', hexPair('E7F5EC', '12271C')],
  ['warn', hexPair('9A5B00', 'E8A33D')],
  ['warn-surface', hexPair('FCF2E3', '2A2113')],
  ['danger', hexPair('C22A2A', 'F26D6D')],
  ['danger-surface', hexPair('FBEAEA', '2C1717')],
  ['info', hexPair('1866D1', '6CA8F5')],
  ['info-surface', hexPair('E9F1FC', '14202F')],
];

/** R-UI-002's seven, in the Bible's order — law, and law does not move for a retint. */
const BASIS_PALETTE: ReadonlyArray<readonly [string, Pair]> = [
  ['measured', hexPair('0E7A70', '34C7B5')],
  ['transcribed', hexPair('1D6FB8', '55A7F0')],
  ['derived', hexPair('6B3FC9', 'A78BF5')],
  ['imported', hexPair('55617A', '93A1BC')],
  ['entered', hexPair('9A6200', 'E5B04E')],
  ['interpreted', hexPair('B01E77', 'EE6DB8')],
  ['defaulted', hexPair('6B7280', '98A0AC')],
];

/** The element classes the viewer paints — untouched by §2. */
const ELEMENT: ReadonlyArray<readonly [string, Pair]> = [
  ['wall', hexPair('3E7CB8', '6BA6DC')],
  ['column', hexPair('C2492F', 'E07B5F')],
  ['beam', hexPair('B57F16', 'D9A83C')],
  ['slab', hexPair('4F8A5D', '7FB68A')],
  ['footing', hexPair('7A5CC0', 'A78BE0')],
  ['opening', hexPair('21A0A8', '4FC4CC')],
  ['rebar', hexPair('B8478F', 'DD7FB4')],
  ['generic', hexPair('6B7280', '98A0AC')],
];

/** Four shadows, theme-differing; hairline first (R-UI-001). */
const SHADOW: ReadonlyArray<readonly [string, Pair]> = [
  ['1', ['0 1px 2px 0 ' + fn('rgba', '16, 20, 26, 0.06'), '0 1px 2px 0 ' + fn('rgba', '0, 0, 0, 0.40')]],
  ['2', ['0 2px 8px -2px ' + fn('rgba', '16, 20, 26, 0.10'), '0 2px 8px -2px ' + fn('rgba', '0, 0, 0, 0.50')]],
  ['3', ['0 8px 24px -4px ' + fn('rgba', '16, 20, 26, 0.14'), '0 8px 24px -4px ' + fn('rgba', '0, 0, 0, 0.55')]],
  ['4', ['0 16px 48px -8px ' + fn('rgba', '16, 20, 26, 0.20'), '0 16px 48px -8px ' + fn('rgba', '0, 0, 0, 0.60')]],
];

/** §2 / AM-05 — the new stacks; Noto Sans for documents kept. */
const FONT_STACKS: ReadonlyArray<readonly [string, string]> = [
  ['--font-ui', "'Spline Sans', 'Helvetica Neue', Arial, sans-serif"],
  ['--font-mono', "'Spline Sans Mono', ui-monospace, 'Cascadia Mono', Consolas, monospace"],
  ['--font-doc', "'Noto Sans', 'Spline Sans', Arial, sans-serif"],
];

/** R-UI-004 motion: the four existing keys, plus §2's one addition. */
const MOTION: ReadonlyArray<readonly [string, string]> = [
  ['--motion-state-duration', '160ms'],
  ['--motion-panel-duration', '240ms'],
  ['--motion-flyto-duration', '320ms'],
  ['--motion-reticle-duration', '120ms'],
  ['--motion-ease', fn('cubic-bezier', '0.2, 0, 0, 1')],
  ['--motion-flyto-ease', fn('cubic-bezier', '0.45, 0.05, 0.25, 1')],
];

/** The non-colour groups, verbatim from §3 of the Design Decision — identical in both themes. */
const SCALARS: ReadonlyArray<readonly [string, string]> = [
  ['--space-1', '4px'],
  ['--space-2', '8px'],
  ['--space-3', '12px'],
  ['--space-4', '16px'],
  ['--space-5', '20px'],
  ['--space-6', '24px'],
  ['--space-7', '28px'],
  ['--space-8', '32px'],
  ['--space-9', '36px'],
  ['--space-10', '40px'],
  ['--space-11', '44px'],
  ['--space-12', '48px'],
  ['--radius-2', '2px'],
  ['--radius-4', '4px'],
  ['--radius-8', '8px'],
  ['--radius-12', '12px'],
  ['--hairline', '1px solid ' + fn('var', '--graphite-200')],
  ['--text-12', '12px'],
  ['--text-13', '13px'],
  ['--text-14', '14px'],
  ['--text-16', '16px'],
  ['--text-20', '20px'],
  ['--text-24', '24px'],
  ['--text-32', '32px'],
  ['--leading-ui', '1.45'],
  ['--weight-heading', '600'],
  ['--weight-body', '400'],
  ['--weight-body-medium', '500'],
  ['--z-base', '0'],
  ['--z-sticky', '100'],
  ['--z-overlay', '200'],
  ['--z-toast', '300'],
  ['--breakpoint-sm', '640px'],
  ['--breakpoint-md', '960px'],
  ['--breakpoint-lg', '1280px'],
  ['--breakpoint-xl', '1680px'],
  ['--row-comfortable', '36px'],
  ['--row-compact', '28px'],
];

/** R-UI-002's glyph pairing — carried here so the retint cannot quietly move it. */
const BASIS_GLYPHS: ReadonlyArray<readonly [string, string]> = [
  ['MEASURED', '◆'],
  ['TRANSCRIBED', '▣'],
  ['DERIVED', 'ƒ'],
  ['IMPORTED', '⇩'],
  ['ENTERED', '✎'],
  ['INTERPRETED', '▦'],
  ['DEFAULTED', '○'],
];

const beamNames = BEAM.map(([key]) => `--beam-${key}`);
const actNames = ACT.map(([key]) => `--act-${key}`);

/** Assert a whole group's values, both themes, against §2. */
function expectGroup(prefix: string, table: ReadonlyArray<readonly [string, Pair]>): void {
  for (const theme of THEMES) {
    const variables = cssVariables(theme);
    for (const [key, pair] of table) {
      const name = prefix === '' ? `--${key}` : `--${prefix}-${key}`;
      expect(variables[name], `${name} in ${theme}`).toBe(forTheme(pair, theme));
    }
  }
}

describe('AC-1 — src/ui/tokens.ts carries the Total Station sheet (AM-04, AM-05, R-UI-001)', () => {
  it('R-UI-001/AM-04: graphite is retinted slot-for-slot, all thirteen slots, roles unchanged', () => {
    // §2: "graphite — retinted slot-for-slot; roles unchanged … Light 0 is instrument
    // grey-white, deliberately not #FFFFFF."
    expectGroup('graphite', GRAPHITE);

    // The ramp is thirteen slots and stays thirteen: a slot that vanished would strand a role.
    for (const theme of THEMES) {
      const ramp = Object.keys(cssVariables(theme)).filter((name) => /^--graphite-\d+$/.test(name));
      expect(ramp, `the graphite ramp in ${theme}`).toEqual(GRAPHITE.map(([key]) => `--graphite-${key}`));
    }
  });

  it('AM-04: the cobalt group is gone and beam carries §2 in its place, both themes', () => {
    // AM-04: "R-UI-001's `one accent \"cobalt\" for interactive` is superseded by: one accent
    // \"beam\" (the brand indigo) for interactive".
    expectGroup('beam', BEAM);

    for (const theme of THEMES) {
      const names = Object.keys(cssVariables(theme));
      expect(
        names.filter((name) => name.startsWith('--cobalt')),
        `cobalt variables surviving in ${theme}`,
      ).toEqual([]);
      // The five slots and no sixth: beam replaces cobalt slot for slot.
      expect(names.filter((name) => name.startsWith('--beam-')), `the beam group in ${theme}`).toEqual(
        beamNames,
      );
    }
  });

  it('AM-04: the act group carries §2 and is emitted immediately after beam', () => {
    // AM-04: "an \"act\" copper reserved for act commitment … and for nothing else".
    expectGroup('act', ACT);

    for (const theme of THEMES) {
      const names = Object.keys(cssVariables(theme));
      expect(names.filter((name) => name.startsWith('--act-')), `the act group in ${theme}`).toEqual(
        actNames,
      );

      // §2: "act — NEW group, emitted right after beam in GROUPS." Emission order is the key
      // order of this map, so the two groups are one contiguous run, beam first, and the run
      // sits after graphite (where cobalt used to be) and before the semantics.
      const first = names.indexOf(beamNames[0] ?? '');
      const last = names.indexOf(actNames[actNames.length - 1] ?? '');
      expect(first, `--beam-100 is emitted in ${theme}`).toBeGreaterThan(-1);
      expect(last, `--act-600 is emitted in ${theme}`).toBeGreaterThan(first);
      expect(names.slice(first, last + 1), `the beam→act run in ${theme}`).toEqual([
        ...beamNames,
        ...actNames,
      ]);
      expect(names.indexOf('--graphite-1000'), `graphite precedes beam in ${theme}`).toBeLessThan(first);
      expect(names.indexOf('--success'), `the semantics follow act in ${theme}`).toBeGreaterThan(last);
    }
  });

  it('R-UI-001/AM-04: the canvas moves in exactly the four keys §2 names, and no others', () => {
    // §2: "canvas — only these four keys change (selection/hover re-point to the beam;
    // paper/grid cool slightly). ink, pulse, measure, snap and the light paper/grid values
    // are unchanged."
    expectGroup('canvas', CANVAS_CHANGED);
    expectGroup('canvas', CANVAS_UNCHANGED);

    // Selection repeats the beam's value on purpose but stays its own variable — the render
    // manifest resolves canvas colour independently of UI chrome.
    expect(cssVariables('light')['--canvas-selection'], '--canvas-selection in light').toBe(
      cssVariables('light')['--beam-500'],
    );
    expect(cssVariables('dark')['--canvas-selection'], '--canvas-selection in dark').toBe(
      cssVariables('dark')['--beam-600'],
    );
  });

  it('AM-05: the font stacks are Spline Sans / Spline Sans Mono, Noto Sans kept (R-UI-003)', () => {
    // AM-05: "`Inter for UI` is superseded by `Spline Sans for UI`, and `JetBrains Mono for
    // every number…` by `Spline Sans Mono for every number…` … Noto Sans for documents kept".
    for (const theme of THEMES) {
      const variables = cssVariables(theme);
      for (const [name, stack] of FONT_STACKS) {
        expect(variables[name], `${name} in ${theme}`).toBe(stack);
      }
      // The superseded families are named nowhere in the sheet.
      for (const [name] of FONT_STACKS) {
        expect(variables[name] ?? '', `${name} in ${theme} still names a v1 family`).not.toMatch(
          /Inter|JetBrains/,
        );
      }
    }
  });

  it('R-UI-004: motion gains reticle-duration: 120ms and every existing key is unchanged', () => {
    // §2: "motion — one addition; existing keys unchanged (reduced-motion zeroing picks it up
    // automatically because the key ends in -duration)." R-UI-004's bands are untouched:
    // 120–200 ms state changes, 240 ms panels, the fly-to 320 ms, no bounce.
    for (const theme of THEMES) {
      const variables = cssVariables(theme);
      for (const [name, value] of MOTION) {
        expect(variables[name], `${name} in ${theme}`).toBe(value);
      }
      // Every motion token the sheet emits is one R-UI-004 names or §2 adds — a key that
      // vanished would strand a consumer, and the sheet is where a new one is declared.
      for (const name of Object.keys(variables).filter((key) => key.startsWith('--motion-'))) {
        expect(
          MOTION.some(([known]) => known === name),
          `${name} in ${theme} is not a motion token R-UI-004 or §2 names`,
        ).toBe(true);
      }
    }
  });

  it('R-UI-001/R-UI-002: on the v2 sheet the groups §2 did not touch are value-identical to v1', () => {
    // §2: "Unchanged groups (do not touch): semantic, basis (+ glyph pairing in `BASIS`),
    // element, space, radius, hairline … text, leading, weight, z, breakpoint, row, shadow."
    // The precondition is that this IS the v2 sheet — otherwise "unchanged" proves nothing.
    expect(cssVariables('light')['--beam-500'], 'the sheet is Datum v2').toBe(hex('5A4FB0'));
    expect(cssVariables('light')['--act-500'], 'the sheet is Datum v2').toBe(hex('A85B28'));

    expectGroup('', SEMANTIC);
    expectGroup('basis', BASIS_PALETTE);
    expectGroup('element', ELEMENT);
    expectGroup('shadow', SHADOW);

    for (const theme of THEMES) {
      const variables = cssVariables(theme);
      for (const [name, value] of SCALARS) {
        expect(variables[name], `${name} in ${theme}`).toBe(value);
      }
    }

    // The glyph pairing is law (R-UI-002) and the colour is named, never spelled.
    for (const [code, glyph] of BASIS_GLYPHS) {
      const entry = BASIS[code as keyof typeof BASIS];
      expect(entry.glyph, `BASIS.${code}.glyph`).toBe(glyph);
      expect(entry.cssVar, `BASIS.${code}.cssVar`).toBe(`--basis-${code.toLowerCase()}`);
    }
  });
});

describe('AC-2 — src/ui/tokens.css is the emitter’s output, cobalt-free (R-UI-001, R-UI-004)', () => {
  it('R-UI-001: the committed sheet is character-identical to renderTokensCss() and names no cobalt', () => {
    const committed = read(TOKENS_CSS);
    // "src/ui/tokens.css is not a file anybody edits — it is renderTokensCss() committed."
    expect(committed, `${TOKENS_CSS} has drifted from renderTokensCss()`).toBe(renderTokensCss());
    // AM-04: the accent is superseded, so the variable is gone from the emitted sheet.
    expect(committed.includes('--cobalt'), `${TOKENS_CSS} still spells a cobalt variable`).toBe(false);
  });

  it('R-UI-001: the sheet keeps its three blocks, in order, with the new groups inside both themes', () => {
    const sheet = read(TOKENS_CSS);
    const headerIndex = sheet.indexOf('/* Generated by renderTokensCss()');
    const lightIndex = sheet.indexOf(':root, [data-theme="light"] {');
    const darkIndex = sheet.indexOf('[data-theme="dark"] {\n');
    const mediaIndex = sheet.indexOf('@media (prefers-reduced-motion: reduce) {');

    // §1 of the Design Decision: three blocks, in this order, the generated header first.
    expect(headerIndex, 'the generated-file header').toBe(0);
    expect(lightIndex, 'the light block').toBeGreaterThan(headerIndex);
    expect(darkIndex, 'the dark block follows the light block').toBeGreaterThan(lightIndex);
    expect(mediaIndex, 'the reduced-motion block is last').toBeGreaterThan(darkIndex);
    expect(sheet.endsWith('}\n'), `${TOKENS_CSS} ends with a closed block and a newline`).toBe(true);

    // Both themes carry the new groups — a theme flip strands nothing (J-004).
    for (const [name, pair] of [
      ...BEAM.map(([key, pair]) => [`--beam-${key}`, pair] as const),
      ...ACT.map(([key, pair]) => [`--act-${key}`, pair] as const),
    ]) {
      const lightBlock = sheet.slice(lightIndex, darkIndex);
      const darkBlock = sheet.slice(darkIndex, mediaIndex);
      expect(lightBlock, `${name} in the light block`).toContain(`  ${name}: ${light(pair)};`);
      expect(darkBlock, `${name} in the dark block`).toContain(`  ${name}: ${dark(pair)};`);
    }
  });

  it('R-UI-004: the reduced-motion block zeroes every --motion-*-duration, reticle included', () => {
    const sheet = read(TOKENS_CSS);
    const mediaIndex = sheet.indexOf('@media (prefers-reduced-motion: reduce) {');
    expect(mediaIndex, 'the reduced-motion block').toBeGreaterThan(-1);
    const block = sheet.slice(mediaIndex);

    // "prefers-reduced-motion respected everywhere" — and by the suffix rule, not by a list
    // someone remembers to extend: every duration the sheet emits is zeroed here, and the
    // new one is zeroed for exactly that reason.
    const durations = Object.keys(cssVariables('light')).filter(
      (name) => name.startsWith('--motion-') && name.endsWith('-duration'),
    );
    expect(durations, 'the durations the sheet emits').toContain('--motion-reticle-duration');
    for (const name of durations) {
      expect(block, `${name} is inert under reduced motion`).toContain(`${name}: 0ms;`);
    }
    // Equal specificity with both theme blocks, so last-in-file wins either way.
    expect(block, 'the reduced-motion selector names both themes').toContain(
      ':root, [data-theme="light"], [data-theme="dark"] {',
    );
  });
});

/** A parsed `@font-face` — the substance the README fixes, indentation aside. */
type FontFace = {
  family: string;
  style: string;
  weight: string;
  display: string;
  src: string;
  unicodeRange: string;
};

function parseFontFaces(css: string): FontFace[] {
  const blocks = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((match) => match[1] ?? '');
  return blocks.map((body) => {
    const declaration = (property: string): string => {
      const found = new RegExp(property + '\\s*:\\s*([^;]+);').exec(body);
      return (found?.[1] ?? '').trim();
    };
    return {
      family: declaration('font-family'),
      style: declaration('font-style'),
      weight: declaration('font-weight'),
      display: declaration('font-display'),
      src: declaration('src'),
      unicodeRange: declaration('unicode-range'),
    };
  });
}

describe('AC-3 — the vendored families are wired with no network reliance (AM-05, R-UI-003)', () => {
  it('AM-05: fonts.css declares the README’s four faces verbatim and every woff2 exists', () => {
    expect(existsSync(join(REPO, FONTS_CSS)), `missing ${FONTS_CSS}`).toBe(true);

    // AM-05: "Both families are vendored in-repo at `src/ui/fonts/` (variable woff2 + OFL
    // licenses + ready @font-face …); build sessions are loopback-only, so a runtime or
    // build-time font fetch is unlawful." The README's block is the ready declaration.
    const expected = parseFontFaces(read(FONTS_README));
    const actual = parseFontFaces(read(FONTS_CSS));
    expect(expected.length, `${FONTS_README} should carry four @font-face blocks`).toBe(4);
    expect(actual, `${FONTS_CSS} does not carry the README's declarations`).toEqual(expected);

    // The two families, latin and latin-ext each, at the vendored variable range.
    expect(actual.map((face) => face.family)).toEqual([
      "'Spline Sans'",
      "'Spline Sans'",
      "'Spline Sans Mono'",
      "'Spline Sans Mono'",
    ]);
    for (const face of actual) {
      expect(face.weight, 'the vendored variable range').toBe('300 700');
      expect(face.display, 'font-display').toBe('swap');
      expect(face.unicodeRange, 'the subset range is kept').not.toBe('');
    }

    // Every file the src points at is on disk, and the path is relative to src/ui/fonts.
    const urls = actual.map((face) => /url\(['"](.+?)['"]\)/.exec(face.src)?.[1] ?? '');
    expect(urls.length, 'four src urls').toBe(4);
    for (const url of urls) {
      expect(url.startsWith('./'), `${url} is relative to ${FONTS_DIR}`).toBe(true);
      expect(url.endsWith('.woff2'), `${url} is a woff2`).toBe(true);
      expect(existsSync(join(REPO, FONTS_DIR, url)), `${url} is vendored on disk`).toBe(true);
    }
  });

  it('AM-05: globals.css imports the vendored sheet and no owned CSS reaches the network', () => {
    const globals = read(GLOBALS_CSS);
    // The @font-face sheet arrives through the global stylesheet — not next/font/local, which
    // would touch src/app, outside this increment's ownership.
    expect(globals, `${GLOBALS_CSS} does not import ${FONTS_CSS}`).toMatch(
      /@import\s+['"][^'"]*fonts\/fonts\.css['"]/,
    );

    // AM-05: a runtime or build-time font fetch is unlawful (lanes are loopback-only).
    for (const file of [TOKENS_CSS, GLOBALS_CSS, FONTS_CSS]) {
      expect(existsSync(join(REPO, file)), `missing ${file}`).toBe(true);
      expect(read(file), `${file} reaches the network`).not.toMatch(/https?:\/\//);
    }
  });

  it('R-UI-001/R-UI-003: the @theme bridge maps beam and act by var(), and .numeric is kept', () => {
    const globals = read(GLOBALS_CSS);

    // "Every R-UI-001 category enters @theme … var() reference only" — the new groups too.
    for (const name of [...beamNames, ...actNames]) {
      const mapping = '--color-' + name.slice(2);
      expect(globals, `${mapping} is bridged into Tailwind`).toContain(`${mapping}: var(${name});`);
    }
    // AM-04: no cobalt namespace survives the bridge.
    expect(globals.includes('--cobalt'), `${GLOBALS_CSS} still spells a cobalt variable`).toBe(false);

    // R-UI-003 as amended: "font-variant-numeric: tabular-nums slashed-zero kept".
    expect(globals, '.numeric keeps the mono family').toMatch(
      /\.numeric\s*\{[^}]*font-family:\s*var\(--font-mono\)/,
    );
    expect(globals, '.numeric keeps tabular-nums slashed-zero').toMatch(
      /\.numeric\s*\{[^}]*font-variant-numeric:\s*tabular-nums slashed-zero/,
    );

    // R-UI-001: "no colour literal outside tokens" — the bridge introduces none, and neither
    // does the font sheet. tokens.css is the emitter's output and is exempt by construction.
    for (const file of [GLOBALS_CSS, FONTS_CSS]) {
      const text = read(file);
      expect(text, `${file} spells a hex colour`).not.toMatch(/#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6})\b/);
      expect(text, `${file} spells a functional colour`).not.toMatch(
        /\b(?:rgba?|hsla?|hwb|oklch|oklab|lab|lch|color-mix)\s*\(/,
      );
    }
  });
});

describe('AC-4 — docs/design/datum-tokens.md is the Datum v2 contract (R-UI-001, AM-04, AM-05)', () => {
  const doc = (): string => read(TOKENS_DD);

  it('AM-04: §2 states the beam, act, graphite and canvas values the emitter emits', () => {
    const text = doc();
    // "Every value in the doc agrees with tokens.ts — the doc may not disagree with the
    // emitter." So the expectation is derived from the emitter, not copied beside it.
    const lightVariables = cssVariables('light');
    const darkVariables = cssVariables('dark');
    const documented: readonly string[] = [
      ...GRAPHITE.map(([key]) => `--graphite-${key}`),
      ...beamNames,
      ...actNames,
      ...[...CANVAS_CHANGED, ...CANVAS_UNCHANGED].map(([key]) => `--canvas-${key}`),
    ];

    for (const name of documented) {
      // The §2 table row, not a prose mention: the row is where the two values are stated.
      const row = text
        .split(/\r?\n/)
        .find((line) => line.trimStart().startsWith('|') && line.includes('`' + name + '`'));
      expect(row, `${TOKENS_DD} has no §2 table row for ${name}`).toBeDefined();
      expect(row ?? '', `${TOKENS_DD} states the light value of ${name}`).toContain(
        '`' + (lightVariables[name] ?? '') + '`',
      );
      expect(row ?? '', `${TOKENS_DD} states the dark value of ${name}`).toContain(
        '`' + (darkVariables[name] ?? '') + '`',
      );
    }
  });

  it('AM-04: act is documented after beam, and no cobalt table or variable survives', () => {
    const text = doc();
    const beamIndex = text.indexOf(beamNames[0] ?? '');
    const actIndex = text.indexOf(actNames[0] ?? '');
    expect(beamIndex, 'the beam group is documented').toBeGreaterThan(-1);
    expect(actIndex, 'act follows beam in the documented group order').toBeGreaterThan(beamIndex);

    const lines = text.split(/\r?\n/);
    // No cobalt heading and no cobalt table row: the group is gone, not demoted.
    for (const line of lines) {
      if (/^#{1,6}\s/.test(line)) {
        expect(line.toLowerCase(), `${TOKENS_DD} keeps a cobalt section`).not.toContain('cobalt');
      }
      if (line.trimStart().startsWith('|')) {
        expect(line, `${TOKENS_DD} keeps a cobalt table row`).not.toContain('--cobalt');
      }
      // Anything left may only be an explicit v1-history note.
      if (/cobalt/i.test(line)) {
        expect(line, `${TOKENS_DD} names cobalt outside a v1-history note`).toMatch(/\bv1\b/);
      }
    }
  });

  it('AM-05/R-UI-004: §3 names the vendored stacks and lists the reticle duration', () => {
    const text = doc();
    const variables = cssVariables('light');

    for (const [name] of FONT_STACKS) {
      expect(text, `${TOKENS_DD} states ${name}`).toContain(`${name}: ${variables[name] ?? ''}`);
    }
    expect(text, `${TOKENS_DD} names the vendored loading path`).toContain(FONTS_DIR);
    expect(text, `${TOKENS_DD} names the @font-face wiring`).toContain('@font-face');

    // R-UI-004: the new duration is listed among the motion tokens.
    expect(text, `${TOKENS_DD} lists the reticle duration`).toContain(
      '--motion-reticle-duration: ' + (variables['--motion-reticle-duration'] ?? ''),
    );
  });

  it('R-UI-001/R-UI-004: the emission-shape law and §2’s contrast facts are restated', () => {
    const text = doc();
    // The generated-file discipline, the three blocks, and the suffix rule that zeroes them.
    expect(text, 'the doc names the emitter').toContain('renderTokensCss()');
    expect(text, 'the doc states the light selector').toContain(':root, [data-theme="light"]');
    expect(text, 'the doc states the dark selector').toContain('[data-theme="dark"]');
    expect(text, 'the doc states the reduced-motion block').toContain(
      '@media (prefers-reduced-motion: reduce)',
    );
    expect(text, 'the doc states the suffix rule').toContain('--motion-*-duration');
    expect(text, 'the doc states the zeroing').toContain('0ms');

    // §2: "Contrast facts already verified (keep them true)" — the doc restates them so the
    // next reader knows which pairs are load-bearing (they are graded in the held-out set).
    expect(text.toLowerCase().includes('contrast'), 'the doc restates the contrast facts').toBe(true);
    expect(text.includes('4.5'), 'the doc names the AA text floor').toBe(true);
    expect(text.includes('3:1'), 'the doc names the disabled floor').toBe(true);
  });
});

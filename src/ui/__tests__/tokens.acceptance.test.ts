/**
 * inc-004 acceptance — the Datum token sheet, emitted from one source (AC-1, AC-2).
 *
 * R-UI-001: "Tokens are CSS variables emitted from one TS source (`src/ui/tokens.ts`)
 * consumed by Tailwind: colour … spacing (4-pt grid), radii (2/4/8/12), elevation (four
 * shadows, hairline borders preferred over shadows), typography scale, motion
 * durations/easings, z-layers, breakpoints. Both themes defined on `:root` and
 * `[data-theme]`; no colour literal outside tokens."
 *
 * Two properties carry this suite. First, *one* source: `src/ui/tokens.css` is not a file
 * anybody edits, it is `renderTokensCss()` committed, and the drift check is what makes
 * that true rather than aspirational. Second, *both* themes: each emitted block is exactly
 * its `cssVariables(theme)` map — not a superset, not a subset — so a variable cannot be
 * defined in the sheet and missing from the map, or the reverse.
 *
 * The module is loaded inside each test so that a module which does not exist yet reads as
 * one missing behaviour per test rather than a single collection error (the shape
 * `src/ui/__tests__/strings.acceptance.test.ts` already uses).
 *
 * The design decision this increment is built against is docs/design/datum-tokens.md; where
 * a test names it, that document is the contract for the membership in question.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO = process.cwd();

/** R-UI-001 names the source; the emission and the Tailwind bridge sit beside it. */
const TOKENS_CSS = 'src/ui/tokens.css';
const GLOBALS_CSS = 'src/ui/globals.css';

/** The token module, per test (see the file header). */
const tokensModule = async () => await import('../tokens');

const read = (relative: string): string => readFileSync(join(REPO, relative), 'utf8');

/** The theme selectors, verbatim from the test contract. */
const LIGHT_SELECTOR = ':root, [data-theme="light"]';
const DARK_SELECTOR = '[data-theme="dark"]';
const REDUCED_MOTION = '@media (prefers-reduced-motion: reduce)';

/** One `--name: value;` declaration, wherever it stands. */
const DECLARATION = /--([A-Za-z0-9-]+)\s*:\s*([^;}]+)[;}]/g;

function declarations(block: string): Record<string, string> {
  const found: Record<string, string> = {};
  for (const match of block.matchAll(DECLARATION)) {
    found[`--${match[1] ?? ''}`] = (match[2] ?? '').trim();
  }
  return found;
}

/** The body of the first rule whose selector is `selector`. Theme blocks do not nest. */
function blockFor(source: string, selector: string): string {
  const at = source.indexOf(selector);
  if (at === -1) return '';
  const open = source.indexOf('{', at + selector.length);
  if (open === -1) return '';
  const close = source.indexOf('}', open);
  return close === -1 ? '' : source.slice(open + 1, close);
}

/** Everything before the reduced-motion block: the two theme rules, and only those. */
function themeSection(css: string): string {
  const at = css.indexOf(REDUCED_MOTION);
  return at === -1 ? css : css.slice(0, at);
}

/**
 * A colour literal, read the way `eslint-rules/no-colour-literal.mjs` reads one: a hex that
 * stands on its own, or a colour function. globals.css is outside ESLint's lint set — CSS is
 * not linted — so the rule cannot speak for it, and this is where R-UI-001's "no colour
 * literal outside tokens" is enforced for that file.
 */
const HEX = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})(?![0-9a-zA-Z_-])/;
const FUNCTIONAL = /\b(?:rgba?|hsla?|hwb|oklch|oklab|lab|lch|color-mix|color)\s*\(/;

function colourLiteralLines(source: string): string[] {
  return source
    .split(/\r?\n/)
    .map((line, index) => ({ line, number: index + 1 }))
    .filter(({ line }) => HEX.test(line) || FUNCTIONAL.test(line))
    .map(({ line, number }) => `${number}: ${line.trim()}`);
}

/** AC-2's variable roster, by category. Presence is asserted in both themes. */
const GRAPHITE_STEPS = [
  '0',
  '50',
  '100',
  '200',
  '300',
  '400',
  '500',
  '600',
  '700',
  '800',
  '900',
  '950',
  '1000',
];

/** R-UI-002's seven, in the Bible's order. */
const BASIS_KEYS = [
  'measured',
  'transcribed',
  'derived',
  'imported',
  'entered',
  'interpreted',
  'defaulted',
];

const SPACE_STEPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const RADIUS_STEPS = [2, 4, 8, 12];
const TEXT_STEPS = [12, 13, 14, 16, 20, 24, 32];

const REQUIRED_NAMES: string[] = [
  ...GRAPHITE_STEPS.map((step) => `--graphite-${step}`),
  '--cobalt-500',
  '--success',
  '--warn',
  '--danger',
  '--info',
  ...BASIS_KEYS.map((key) => `--basis-${key}`),
  ...SPACE_STEPS.map((step) => `--space-${step}`),
  ...RADIUS_STEPS.map((step) => `--radius-${step}`),
  '--shadow-1',
  '--shadow-2',
  '--shadow-3',
  '--shadow-4',
  '--hairline',
  '--font-ui',
  '--font-mono',
  '--font-doc',
  ...TEXT_STEPS.map((step) => `--text-${step}`),
  '--leading-ui',
  '--weight-heading',
  '--weight-body',
  '--weight-body-medium',
  '--motion-state-duration',
  '--motion-panel-duration',
  '--motion-flyto-duration',
  '--motion-ease',
  '--motion-flyto-ease',
  '--z-base',
  '--z-sticky',
  '--z-overlay',
  '--z-toast',
  '--breakpoint-sm',
  '--breakpoint-md',
  '--breakpoint-lg',
  '--breakpoint-xl',
  '--row-comfortable',
  '--row-compact',
];

/**
 * The element-class and canvas membership. AC-2 asks for "at least one" of each and defers
 * the roster to docs/design/datum-tokens.md §2 — which is the contract this increment is
 * built against, so the roster is asserted whole.
 */
const ELEMENT_KEYS = [
  'wall',
  'column',
  'beam',
  'slab',
  'footing',
  'opening',
  'rebar',
  'generic',
];
const CANVAS_KEYS = [
  'paper',
  'grid',
  'ink',
  'selection',
  'hover',
  'pulse',
  'measure',
  'snap',
];

const THEMES = ['light', 'dark'] as const;

describe('AC-1 — one source, emitted verbatim, both themes (R-UI-001)', () => {
  it('exports the token tree, the per-theme map and the renderer', async () => {
    const { tokens, cssVariables, renderTokensCss } = await tokensModule();

    // "readonly token tree": frozen is what readonly is at run time, and the reason the
    // string table and the refusal registries are frozen — a tree an importer can edit is a
    // default, not a source of truth.
    expect(typeof tokens).toBe('object');
    expect(Object.keys(tokens as Record<string, unknown>).length).toBeGreaterThan(0);
    expect(Object.isFrozen(tokens)).toBe(true);

    expect(typeof cssVariables).toBe('function');
    expect(typeof renderTokensCss).toBe('function');

    // The flat map: every key is a CSS custom property name, every value a non-empty string.
    for (const theme of THEMES) {
      const variables = cssVariables(theme);
      const entries = Object.entries(variables);
      expect(entries.length, `cssVariables('${theme}') is empty`).toBeGreaterThan(0);
      for (const [name, value] of entries) {
        expect(name, `${name} is not a --custom-property`).toMatch(/^--[a-z][a-z0-9-]*$/);
        expect(typeof value, `${name} is not a string value`).toBe('string');
        expect(value.trim(), `${name} is blank`).not.toBe('');
      }
    }
  });

  it('commits the emission: src/ui/tokens.css is character-identical to renderTokensCss()', async () => {
    const { renderTokensCss } = await tokensModule();
    const emitted = renderTokensCss();

    expect(emitted.length, 'renderTokensCss() emitted nothing').toBeGreaterThan(0);
    // Deterministic: the renderer is a function of the tree, not of the clock or the run.
    expect(renderTokensCss()).toBe(emitted);

    // The drift check. A hand-edit to the committed sheet, or a token added to the tree and
    // not re-emitted, is the same failure — which is what "one source" has to mean.
    expect(read(TOKENS_CSS), `${TOKENS_CSS} has drifted from renderTokensCss()`).toBe(emitted);
  });

  it('defines light on `:root, [data-theme="light"]` and dark on `[data-theme="dark"]`, each block exactly its map', async () => {
    const { cssVariables, renderTokensCss } = await tokensModule();
    const css = renderTokensCss();

    // Verbatim, per the test contract: a theme nobody can select is not a theme.
    expect(css).toContain(LIGHT_SELECTOR);
    expect(css).toContain(DARK_SELECTOR);

    const themes = themeSection(css);
    // Not a superset and not a subset: what the sheet declares is what the map says, so a
    // consumer reading either one is reading the same tokens.
    expect(declarations(blockFor(themes, LIGHT_SELECTOR))).toEqual(cssVariables('light'));
    expect(declarations(blockFor(themes, DARK_SELECTOR))).toEqual(cssVariables('dark'));
  });

  it('R-UI-004: a prefers-reduced-motion block zeroes the durations', async () => {
    const { renderTokensCss } = await tokensModule();
    const css = renderTokensCss();

    const at = css.indexOf(REDUCED_MOTION);
    expect(at, `${REDUCED_MOTION} is missing from the emitted sheet`).toBeGreaterThan(-1);

    // "`prefers-reduced-motion` respected everywhere" (R-UI-004) — the three durations the
    // Bible names, inert at the source rather than at each future call site.
    const reduced = declarations(css.slice(at));
    for (const name of [
      '--motion-state-duration',
      '--motion-panel-duration',
      '--motion-flyto-duration',
    ]) {
      expect(reduced[name], `${name} is not zeroed under reduced motion`).toBe('0ms');
    }
  });

  it('bridges the tokens into Tailwind through globals.css, with no colour of its own', () => {
    const globals = read(GLOBALS_CSS);

    // The two imports the interface fixes: Tailwind, then the sheet it reads.
    expect(globals, 'globals.css does not import tailwindcss').toMatch(
      /@import\s+['"]tailwindcss['"]/,
    );
    expect(globals, 'globals.css does not import ./tokens.css').toMatch(
      /@import\s+['"]\.\/tokens\.css['"]/,
    );

    // `@theme` maps tokens by reference only. A value spelled out here is a second place a
    // colour lives, which is the one thing R-UI-001 forbids.
    const theme = blockFor(globals, '@theme');
    const mapped = Object.entries(declarations(theme));
    expect(mapped.length, 'globals.css maps nothing into @theme').toBeGreaterThan(0);
    for (const [name, value] of mapped) {
      expect(value, `@theme ${name} is not a var() reference`).toMatch(/^var\(--[a-z0-9-]+\)$/);
    }

    // R-UI-003: "JetBrains Mono for every number … with `font-variant-numeric: tabular-nums
    // slashed-zero`" — the utility that carries it.
    // Written as plain CSS or through Tailwind's `@utility`; either way the class is `.numeric`.
    const numeric = blockFor(globals, '.numeric') || blockFor(globals, '@utility numeric');
    expect(numeric, 'globals.css defines no .numeric utility').not.toBe('');
    expect(numeric.replace(/\s+/g, ' ')).toContain('font-family: var(--font-mono)');
    expect(numeric.replace(/\s+/g, ' ')).toContain(
      'font-variant-numeric: tabular-nums slashed-zero',
    );

    expect(colourLiteralLines(globals), `${GLOBALS_CSS} carries a colour literal`).toEqual([]);
  });
});

describe('AC-2 — every R-UI-001 category is defined, in both themes', () => {
  it('defines the whole roster in light and in dark', async () => {
    const { cssVariables } = await tokensModule();

    for (const theme of THEMES) {
      const variables = cssVariables(theme);
      const missing = REQUIRED_NAMES.filter((name) => variables[name] === undefined);
      expect(missing, `cssVariables('${theme}') is missing these R-UI-001 tokens`).toEqual([]);
    }
  });

  it('carries an element-class palette and a canvas palette (docs/design/datum-tokens.md §2)', async () => {
    const { cssVariables } = await tokensModule();

    for (const theme of THEMES) {
      const names = Object.keys(cssVariables(theme));
      // AC-2's floor is "at least one" of each; the design decision fixes the membership.
      expect(names.filter((name) => name.startsWith('--element-')).length).toBeGreaterThan(0);
      expect(names.filter((name) => name.startsWith('--canvas-')).length).toBeGreaterThan(0);
      for (const key of ELEMENT_KEYS) {
        expect(names, `--element-${key} is missing from ${theme}`).toContain(`--element-${key}`);
      }
      for (const key of CANVAS_KEYS) {
        expect(names, `--canvas-${key} is missing from ${theme}`).toContain(`--canvas-${key}`);
      }
    }
  });

  it('R-UI-001: the 4-pt grid, the four radii and the hairline hold their fixed values', async () => {
    const { cssVariables } = await tokensModule();

    for (const theme of THEMES) {
      const variables = cssVariables(theme);
      for (const step of SPACE_STEPS) {
        // "spacing (4-pt grid)" — every step is n × 4 px, with no off-grid value smuggled in.
        expect(variables[`--space-${step}`], `--space-${step} is off the 4-pt grid`).toBe(
          `${step * 4}px`,
        );
      }
      for (const step of RADIUS_STEPS) {
        expect(variables[`--radius-${step}`], `--radius-${step} in ${theme}`).toBe(`${step}px`);
      }
      // "hairline borders preferred over shadows" — the hairline is a token, not a habit.
      expect(variables['--hairline'], `--hairline in ${theme}`).toBeTruthy();
    }
  });

  it('R-UI-003: the type scale, the families and the weights are the Bible’s', async () => {
    const { cssVariables } = await tokensModule();

    for (const theme of THEMES) {
      const variables = cssVariables(theme);
      for (const step of TEXT_STEPS) {
        // "a type scale of 12/13/14/16/20/24/32" — each token is its own px number.
        expect(variables[`--text-${step}`], `--text-${step} in ${theme}`).toBe(`${step}px`);
      }
      // "Inter for UI … JetBrains Mono for every number … document typography Noto Sans".
      expect(variables['--font-ui'], `--font-ui in ${theme}`).toContain('Inter');
      expect(variables['--font-mono'], `--font-mono in ${theme}`).toContain('JetBrains Mono');
      expect(variables['--font-doc'], `--font-doc in ${theme}`).toContain('Noto Sans');
      // "14 px base … 1.45 line height"; "headings weight 600, body 400/500".
      expect(variables['--leading-ui'], `--leading-ui in ${theme}`).toBe('1.45');
      expect(variables['--weight-heading'], `--weight-heading in ${theme}`).toBe('600');
      expect(variables['--weight-body'], `--weight-body in ${theme}`).toBe('400');
      expect(variables['--weight-body-medium'], `--weight-body-medium in ${theme}`).toBe('500');
    }
  });

  it('R-UI-004 / R-UI-005: panel and fly-to durations, and the two density rows', async () => {
    const { cssVariables } = await tokensModule();

    for (const theme of THEMES) {
      const variables = cssVariables(theme);
      // "240 ms for panels; the viewer 'fly-to' 320 ms with easing".
      expect(variables['--motion-panel-duration'], `--motion-panel-duration in ${theme}`).toBe(
        '240ms',
      );
      expect(variables['--motion-flyto-duration'], `--motion-flyto-duration in ${theme}`).toBe(
        '320ms',
      );
      // "two modes (comfortable 36 px rows, compact 28 px)".
      expect(variables['--row-comfortable'], `--row-comfortable in ${theme}`).toBe('36px');
      expect(variables['--row-compact'], `--row-compact in ${theme}`).toBe('28px');
    }
  });
});

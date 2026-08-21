/**
 * The Datum token sheet — one TypeScript source for every design value (R-UI-001).
 *
 * "Tokens are CSS variables emitted from one TS source (`src/ui/tokens.ts`) consumed by
 * Tailwind … Both themes defined on `:root` and `[data-theme]`; no colour literal outside
 * tokens." This module is that source, and it is the one file `cubit/no-colour-literal`
 * exempts: every hex and every `rgba()` in the product is written here or nowhere.
 *
 * `src/ui/tokens.css` is not a file anybody edits — it is `renderTokensCss()` committed, and
 * a test compares the two character for character. So a token is added in one place and the
 * sheet follows, rather than the two drifting until nobody trusts either.
 *
 * The shape is a tree of groups (docs/design/datum-tokens.md §2–§4) and an ordered list that
 * fixes emission order, because a renderer whose output depends on nothing but the tree is a
 * renderer whose diffs are readable. A value is either one string (identical in both themes —
 * spacing, type, motion) or a `{ light, dark }` pair. Roles are theme-stable: `--graphite-0`
 * is always the app background, so dark mode flips values and never consumer code.
 */

/** The two themes the sheet defines; `[data-theme]` carries the second. */
export type Theme = 'light' | 'dark';

/** One token: the same in both themes, or a value per theme. */
type TokenValue = string | { readonly light: string; readonly dark: string };

/** A value that differs by theme. */
const dual = (light: string, dark: string): TokenValue => Object.freeze({ light, dark });

/**
 * The token tree. Group order here is emission order, and key order within a group is the
 * order docs/design/datum-tokens.md lists them in.
 */
export const tokens = Object.freeze({
  /** Surfaces and ink. 0 is the app background in both themes; 1000 is maximum ink. */
  graphite: Object.freeze({
    '0': dual('#FFFFFF', '#0C0E12'),
    '50': dual('#F7F8FA', '#111419'),
    '100': dual('#EFF1F4', '#161A21'),
    '200': dual('#E2E5EA', '#1F242D'),
    '300': dual('#CBD1D9', '#2A303B'),
    '400': dual('#A6AEBB', '#414957'),
    '500': dual('#8591A0', '#5C6678'),
    '600': dual('#66707F', '#7E8899'),
    '700': dual('#4C5563', '#9AA4B2'),
    '800': dual('#353D49', '#BFC6D1'),
    '900': dual('#232933', '#E2E6EC'),
    '950': dual('#171C24', '#F1F3F6'),
    '1000': dual('#0F1319', '#FBFCFD'),
  }),

  /** The one interactive accent (R-UI-001: "one accent 'cobalt' for interactive"). */
  cobalt: Object.freeze({
    '100': dual('#E7EDFD', '#16203B'),
    '300': dual('#9AB1F4', '#35509F'),
    '500': dual('#2E5CE6', '#5B82F0'),
    '600': dual('#2349BE', '#7D9BF4'),
    '700': dual('#1B3893', '#A6BCF8'),
  }),

  /** Semantics: the colour and its surface tint, nothing more. Unprefixed by naming law. */
  semantic: Object.freeze({
    success: dual('#1D7A46', '#4CC38A'),
    'success-surface': dual('#E7F5EC', '#12271C'),
    warn: dual('#9A5B00', '#E8A33D'),
    'warn-surface': dual('#FCF2E3', '#2A2113'),
    danger: dual('#C22A2A', '#F26D6D'),
    'danger-surface': dual('#FBEAEA', '#2C1717'),
    info: dual('#1866D1', '#6CA8F5'),
    'info-surface': dual('#E9F1FC', '#14202F'),
  }),

  /**
   * The basis palette (R-UI-002, fixed): teal, blue, violet, slate, amber, magenta, grey, in
   * the Bible's order. Transcribed blue is azure, deliberately apart from cobalt's
   * violet-blue, so an interactive control and a TRANSCRIBED chip never read as one thing.
   */
  basis: Object.freeze({
    measured: dual('#0E7A70', '#34C7B5'),
    transcribed: dual('#1D6FB8', '#55A7F0'),
    derived: dual('#6B3FC9', '#A78BF5'),
    imported: dual('#55617A', '#93A1BC'),
    entered: dual('#9A6200', '#E5B04E'),
    interpreted: dual('#B01E77', '#EE6DB8'),
    defaulted: dual('#6B7280', '#98A0AC'),
  }),

  /** The element classes the viewer paints. */
  element: Object.freeze({
    wall: dual('#3E7CB8', '#6BA6DC'),
    column: dual('#C2492F', '#E07B5F'),
    beam: dual('#B57F16', '#D9A83C'),
    slab: dual('#4F8A5D', '#7FB68A'),
    footing: dual('#7A5CC0', '#A78BE0'),
    opening: dual('#21A0A8', '#4FC4CC'),
    rebar: dual('#B8478F', '#DD7FB4'),
    generic: dual('#6B7280', '#98A0AC'),
  }),

  /**
   * The viewer's own surfaces and marks. Selection repeats cobalt's value on purpose but
   * stays a separate variable: the render manifest resolves canvas colour independently of
   * UI chrome.
   */
  canvas: Object.freeze({
    paper: dual('#FCFCFB', '#14161A'),
    grid: dual('#E9EAE7', '#23262C'),
    ink: dual('#23282F', '#D5D9DF'),
    selection: dual('#2E5CE6', '#5B82F0'),
    hover: dual('rgba(46, 92, 230, 0.20)', 'rgba(91, 130, 240, 0.28)'),
    pulse: dual('#E8930C', '#FFB224'),
    measure: dual('#C13515', '#FF7A4D'),
    snap: dual('#1D7A46', '#4CC38A'),
  }),

  /** The 4-pt grid: `--space-<n>` is n × 4 px, and nothing off the grid has a name. */
  space: Object.freeze({
    '1': '4px',
    '2': '8px',
    '3': '12px',
    '4': '16px',
    '5': '20px',
    '6': '24px',
    '7': '28px',
    '8': '32px',
    '9': '36px',
    '10': '40px',
    '11': '44px',
    '12': '48px',
  }),

  /** Radii, the four the Bible names. */
  radius: Object.freeze({
    '2': '2px',
    '4': '4px',
    '8': '8px',
    '12': '12px',
  }),

  /**
   * "Hairline borders preferred over shadows" — so the hairline is a token, not a habit. The
   * var() reference resolves per theme, which is why the string is identical in both blocks.
   */
  hairline: Object.freeze({
    hairline: '1px solid var(--graphite-200)',
  }),

  /** Families are named here and loaded by the shell increment (R-UI-003). */
  font: Object.freeze({
    ui: "Inter, 'Helvetica Neue', Arial, sans-serif",
    mono: "'JetBrains Mono', 'SF Mono', Consolas, monospace",
    doc: "'Noto Sans', Inter, Arial, sans-serif",
  }),

  /** The type scale (R-UI-003): 12/13/14/16/20/24/32, each token its own px number. */
  text: Object.freeze({
    '12': '12px',
    '13': '13px',
    '14': '14px',
    '16': '16px',
    '20': '20px',
    '24': '24px',
    '32': '32px',
  }),

  /** "14 px base, 13 px in dense tables, 1.45 line height". */
  leading: Object.freeze({
    ui: '1.45',
  }),

  /** "headings weight 600, body 400/500". */
  weight: Object.freeze({
    heading: '600',
    body: '400',
    'body-medium': '500',
  }),

  /**
   * Motion (R-UI-004): state changes inside the 120–200 ms band, panels 240 ms, the viewer
   * fly-to 320 ms. Both easings decelerate; neither overshoots, because "no bounce".
   */
  motion: Object.freeze({
    'state-duration': '160ms',
    'panel-duration': '240ms',
    'flyto-duration': '320ms',
    ease: 'cubic-bezier(0.2, 0, 0, 1)',
    'flyto-ease': 'cubic-bezier(0.45, 0.05, 0.25, 1)',
  }),

  /** Z-layers, exactly four: anything that stacks picks one of them. */
  z: Object.freeze({
    base: '0',
    sticky: '100',
    overlay: '200',
    toast: '300',
  }),

  /** Breakpoints — a drawing workspace earns its widest tier. */
  breakpoint: Object.freeze({
    sm: '640px',
    md: '960px',
    lg: '1280px',
    xl: '1680px',
  }),

  /** The two density modes (R-UI-005): comfortable 36 px rows, compact 28 px. */
  row: Object.freeze({
    comfortable: '36px',
    compact: '28px',
  }),

  /** Four shadows, used sparingly — the hairline comes first (R-UI-001). */
  shadow: Object.freeze({
    '1': dual('0 1px 2px 0 rgba(16, 20, 26, 0.06)', '0 1px 2px 0 rgba(0, 0, 0, 0.40)'),
    '2': dual('0 2px 8px -2px rgba(16, 20, 26, 0.10)', '0 2px 8px -2px rgba(0, 0, 0, 0.50)'),
    '3': dual('0 8px 24px -4px rgba(16, 20, 26, 0.14)', '0 8px 24px -4px rgba(0, 0, 0, 0.55)'),
    '4': dual('0 16px 48px -8px rgba(16, 20, 26, 0.20)', '0 16px 48px -8px rgba(0, 0, 0, 0.60)'),
  }),
});

/**
 * A group and the prefix its keys take. Naming law: every token becomes `--<group>-<key>`,
 * kebab-case; the semantics and the hairline are named by role alone, so their prefix is
 * empty and `--success` stays `--success`.
 */
type TokenGroup = {
  readonly prefix: string;
  readonly entries: Readonly<Record<string, TokenValue>>;
};

/** Emission order, once, for both the flat map and the sheet. */
const GROUPS: readonly TokenGroup[] = [
  { prefix: 'graphite', entries: tokens.graphite },
  { prefix: 'cobalt', entries: tokens.cobalt },
  { prefix: '', entries: tokens.semantic },
  { prefix: 'basis', entries: tokens.basis },
  { prefix: 'element', entries: tokens.element },
  { prefix: 'canvas', entries: tokens.canvas },
  { prefix: 'space', entries: tokens.space },
  { prefix: 'radius', entries: tokens.radius },
  { prefix: '', entries: tokens.hairline },
  { prefix: 'font', entries: tokens.font },
  { prefix: 'text', entries: tokens.text },
  { prefix: 'leading', entries: tokens.leading },
  { prefix: 'weight', entries: tokens.weight },
  { prefix: 'motion', entries: tokens.motion },
  { prefix: 'z', entries: tokens.z },
  { prefix: 'breakpoint', entries: tokens.breakpoint },
  { prefix: 'row', entries: tokens.row },
  { prefix: 'shadow', entries: tokens.shadow },
];

const variableName = (prefix: string, key: string): string =>
  prefix === '' ? `--${key}` : `--${prefix}-${key}`;

const resolve = (value: TokenValue, theme: Theme): string =>
  typeof value === 'string' ? value : value[theme];

/**
 * Every token of one theme, flat: variable name → value. The sheet below is this map
 * printed, so a consumer reading either one is reading the same tokens, and both themes
 * carry identical key sets — a theme flip strands nothing (J-004).
 */
export function cssVariables(theme: Theme): Record<string, string> {
  const variables: Record<string, string> = {};
  for (const group of GROUPS) {
    for (const [key, value] of Object.entries(group.entries)) {
      variables[variableName(group.prefix, key)] = resolve(value, theme);
    }
  }
  return variables;
}

/** The seven basis codes (R-UI-002), fixed. */
export type BasisCode =
  | 'MEASURED'
  | 'TRANSCRIBED'
  | 'DERIVED'
  | 'IMPORTED'
  | 'ENTERED'
  | 'INTERPRETED'
  | 'DEFAULTED';

/** A basis renders as a pair: the glyph that survives greyscale, and the colour token. */
export type BasisEntry = { readonly glyph: string; readonly cssVar: string };

/**
 * The pairing, fixed by R-UI-002: "each basis also has a glyph (◆ ▣ ƒ ⇩ ✎ ▦ ○) so it
 * survives greyscale and colour-blindness". The colour is named, never spelled, so the
 * theme switch reaches every mark.
 */
export const BASIS: Readonly<Record<BasisCode, BasisEntry>> = Object.freeze({
  MEASURED: Object.freeze({ glyph: '◆', cssVar: '--basis-measured' }),
  TRANSCRIBED: Object.freeze({ glyph: '▣', cssVar: '--basis-transcribed' }),
  DERIVED: Object.freeze({ glyph: 'ƒ', cssVar: '--basis-derived' }),
  IMPORTED: Object.freeze({ glyph: '⇩', cssVar: '--basis-imported' }),
  ENTERED: Object.freeze({ glyph: '✎', cssVar: '--basis-entered' }),
  INTERPRETED: Object.freeze({ glyph: '▦', cssVar: '--basis-interpreted' }),
  DEFAULTED: Object.freeze({ glyph: '○', cssVar: '--basis-defaulted' }),
});

const HEADER = '/* Generated by renderTokensCss() — edit src/ui/tokens.ts, never this file. */';

const LIGHT_SELECTOR = ':root, [data-theme="light"]';
const DARK_SELECTOR = '[data-theme="dark"]';
const BOTH_THEMES = `${LIGHT_SELECTOR}, ${DARK_SELECTOR}`;

/** One theme rule: every group, in order, a blank line apart. */
function themeBlock(selector: string, theme: Theme, indent: string): string {
  const groups = GROUPS.map((group) =>
    Object.entries(group.entries)
      .map(([key, value]) => `${indent}  ${variableName(group.prefix, key)}: ${resolve(value, theme)};`)
      .join('\n'),
  );
  return `${indent}${selector} {\n${groups.join('\n\n')}\n${indent}}\n`;
}

/**
 * R-UI-004: "`prefers-reduced-motion` respected everywhere" — every duration inert at the
 * source rather than at each future call site. The selector names both themes so this rule
 * keeps equal specificity with them and, being last in the file, wins either way.
 */
function reducedMotionBlock(): string {
  const zeroed = Object.keys(tokens.motion)
    .filter((key) => key.endsWith('-duration'))
    .map((key) => `    ${variableName('motion', key)}: 0ms;`)
    .join('\n');
  return `@media (prefers-reduced-motion: reduce) {\n  ${BOTH_THEMES} {\n${zeroed}\n  }\n}\n`;
}

/**
 * The sheet, deterministically: a function of the tree and of nothing else. Its output is
 * committed as `src/ui/tokens.css`, and the drift check is what makes "one source" true
 * rather than aspirational.
 */
export function renderTokensCss(): string {
  return [
    `${HEADER}\n`,
    themeBlock(LIGHT_SELECTOR, 'light', ''),
    themeBlock(DARK_SELECTOR, 'dark', ''),
    reducedMotionBlock(),
  ].join('\n');
}

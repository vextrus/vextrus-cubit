/**
 * The Datum token system: the one TypeScript source every design token is emitted from
 * (R-UI-001). `src/ui/tokens.css` beside this file is generated output — `emitTokensCss()`
 * returns its exact content, and the drift test holds the two byte-identical.
 *
 * This file and its generated stylesheet are the only two places a colour literal may exist
 * (R-UI-001, cubit/no-colour-literal). Every other file reads `var(--…)`.
 *
 * Roles are theme-stable and the values flip: graphite 0 is always the app background, 200 the
 * hairline seam, 500 the disabled floor, 600 captions, 700 secondary, 900 primary — consumer
 * code never branches on the theme (R-UI-001).
 */

/** One token: its custom-property name and its light and dark values (R-UI-001). */
type Token = readonly [name: string, light: string, dark: string];

/** A named emission group. R-UI-001 fixes the order the groups appear in. */
type Group = { readonly label: string; readonly tokens: readonly Token[] };

/** A token table keyed by custom-property name; both themes carry identical key sets. */
type TokenTable = Readonly<Record<string, string>>;

const graphite: Group = {
  label: "graphite",
  tokens: [
    ["--graphite-0", "#F4F5F4", "#0C0E11"],
    ["--graphite-50", "#EFF0EF", "#101318"],
    ["--graphite-100", "#E9EBEA", "#12151A"],
    ["--graphite-200", "#DDE0E0", "#22262E"],
    ["--graphite-300", "#C9CDD1", "#333A46"],
    ["--graphite-400", "#B0B6BC", "#414957"],
    ["--graphite-500", "#7F868D", "#66707F"],
    ["--graphite-600", "#5F6772", "#7E8899"],
    ["--graphite-700", "#4A515B", "#9AA3B2"],
    ["--graphite-800", "#363C45", "#C3C9D2"],
    ["--graphite-900", "#262B33", "#E7EAEE"],
    ["--graphite-950", "#191D24", "#F1F4F7"],
    ["--graphite-1000", "#101318", "#FBFCFD"],
  ],
};

/** The one accent: the brand indigo, for everything interactive (R-UI-001). */
const beam: Group = {
  label: "beam",
  tokens: [
    ["--beam-100", "#E8E6F7", "#1A1830"],
    ["--beam-300", "#B7B1E8", "#3B3478"],
    ["--beam-500", "#5A4FB0", "#6E63C8"],
    ["--beam-600", "#473E92", "#8B84E8"],
    ["--beam-700", "#38316F", "#A7A1F0"],
  ],
};

/**
 * The act copper: reserved for act commitment — affirm / sign / issue / confirm-with-consequence
 * — and nothing else. 500 is fills, borders and the 7px dot; 600 is text on act-surface
 * (R-UI-001).
 */
const act: Group = {
  label: "act",
  tokens: [
    ["--act-surface", "#FBEFE4", "#1D1610"],
    ["--act-500", "#A85B28", "#C97F4A"],
    ["--act-600", "#9A5326", "#E29A68"],
  ],
};

const semantic: Group = {
  label: "semantic",
  tokens: [
    ["--success", "#1D7A46", "#4CC38A"],
    ["--success-surface", "#E7F5EC", "#12271C"],
    ["--warn", "#9A5B00", "#E8A33D"],
    ["--warn-surface", "#FCF2E3", "#2A2113"],
    ["--danger", "#C22A2A", "#F26D6D"],
    ["--danger-surface", "#FBEAEA", "#2C1717"],
    ["--info", "#1866D1", "#6CA8F5"],
    ["--info-surface", "#E9F1FC", "#14202F"],
  ],
};

/** The basis palette (R-UI-002): one colour per basis, the colour half of the colour/glyph pair. */
const basis: Group = {
  label: "basis",
  tokens: [
    ["--basis-measured", "#0E7A70", "#34C7B5"],
    ["--basis-transcribed", "#1D6FB8", "#55A7F0"],
    ["--basis-derived", "#6B3FC9", "#A78BF5"],
    ["--basis-imported", "#55617A", "#93A1BC"],
    ["--basis-entered", "#9A6200", "#E5B04E"],
    ["--basis-interpreted", "#B01E77", "#EE6DB8"],
    ["--basis-defaulted", "#6B7280", "#98A0AC"],
  ],
};

/** The element-class palette (R-UI-001). */
const element: Group = {
  label: "element",
  tokens: [
    ["--element-wall", "#3E7CB8", "#6BA6DC"],
    ["--element-column", "#C2492F", "#E07B5F"],
    ["--element-beam", "#B57F16", "#D9A83C"],
    ["--element-slab", "#4F8A5D", "#7FB68A"],
    ["--element-footing", "#7A5CC0", "#A78BE0"],
    ["--element-opening", "#21A0A8", "#4FC4CC"],
    ["--element-rebar", "#B8478F", "#DD7FB4"],
    ["--element-generic", "#6B7280", "#98A0AC"],
  ],
};

/** The canvas palette (R-UI-001). */
const canvas: Group = {
  label: "canvas",
  tokens: [
    ["--canvas-paper", "#FCFCFB", "#101216"],
    ["--canvas-grid", "#E9EAE7", "#1B1F26"],
    ["--canvas-ink", "#23282F", "#D5D9DF"],
    ["--canvas-selection", "#5A4FB0", "#8B84E8"],
    ["--canvas-hover", "rgba(90,79,176,0.18)", "rgba(139,132,232,0.26)"],
    ["--canvas-pulse", "#E8930C", "#FFB224"],
    ["--canvas-measure", "#C13515", "#FF7A4D"],
    ["--canvas-snap", "#1D7A46", "#4CC38A"],
  ],
};

/** A value R-UI-001 states once holds in both themes; it is repeated verbatim in each block. */
const invariant = (name: string, value: string): Token => [name, value, value];

/** Spacing on the 4-pt grid (R-UI-001). */
const space: Group = {
  label: "space",
  tokens: Array.from({ length: 12 }, (_, i) => invariant(`--space-${i + 1}`, `${(i + 1) * 4}px`)),
};

const radius: Group = {
  label: "radius",
  tokens: [2, 4, 8, 12].map((step) => invariant(`--radius-${step}`, `${step}px`)),
};

/** Hairline borders are preferred over shadow weight (R-UI-001). */
const hairline: Group = {
  label: "hairline",
  tokens: [invariant("--hairline", "1px solid var(--graphite-200)")],
};

/** The three families (R-UI-003); the two Spline faces load vendored, from src/ui/fonts. */
const font: Group = {
  label: "font",
  tokens: [
    invariant("--font-ui", "'Spline Sans', 'Helvetica Neue', Arial, sans-serif"),
    invariant("--font-mono", "'Spline Sans Mono', ui-monospace, 'Cascadia Mono', Consolas, monospace"),
    invariant("--font-doc", "'Noto Sans', 'Spline Sans', Arial, sans-serif"),
  ],
};

/** The type scale (R-UI-003). */
const text: Group = {
  label: "text",
  tokens: [12, 13, 14, 16, 20, 24, 32].map((size) => invariant(`--text-${size}`, `${size}px`)),
};

const leading: Group = {
  label: "leading",
  tokens: [invariant("--leading-ui", "1.45")],
};

const weight: Group = {
  label: "weight",
  tokens: [
    invariant("--weight-heading", "600"),
    invariant("--weight-body", "400"),
    invariant("--weight-body-medium", "500"),
  ],
};

/**
 * Durations and easings (R-UI-004). The four durations are the ones reduced motion zeroes at the
 * source; the easings are untouched, since an instant transition has no curve to soften.
 */
const motion: Group = {
  label: "motion",
  tokens: [
    invariant("--motion-state", "160ms"),
    invariant("--motion-panel", "240ms"),
    invariant("--motion-flyto", "320ms"),
    invariant("--motion-reticle", "120ms"),
    invariant("--ease", "cubic-bezier(0.2,0,0,1)"),
    invariant("--ease-flyto", "cubic-bezier(0.45,0.05,0.25,1)"),
  ],
};

/** The four z-layers (R-UI-001). */
const z: Group = {
  label: "z",
  tokens: [
    invariant("--z-base", "0"),
    invariant("--z-sticky", "100"),
    invariant("--z-overlay", "200"),
    invariant("--z-toast", "300"),
  ],
};

const breakpoint: Group = {
  label: "breakpoint",
  tokens: [
    invariant("--breakpoint-sm", "640px"),
    invariant("--breakpoint-md", "960px"),
    invariant("--breakpoint-lg", "1280px"),
    invariant("--breakpoint-xl", "1680px"),
  ],
};

/** The two density row heights (R-UI-001). */
const row: Group = {
  label: "row",
  tokens: [invariant("--row-comfortable", "36px"), invariant("--row-compact", "28px")],
};

const shadow: Group = {
  label: "shadow",
  tokens: [
    ["--shadow-1", "0 1px 2px 0 rgba(16,20,26,0.06)", "0 1px 2px 0 rgba(0,0,0,0.40)"],
    ["--shadow-2", "0 2px 8px -2px rgba(16,20,26,0.10)", "0 2px 8px -2px rgba(0,0,0,0.50)"],
    ["--shadow-3", "0 8px 24px -4px rgba(16,20,26,0.14)", "0 8px 24px -4px rgba(0,0,0,0.55)"],
    ["--shadow-4", "0 16px 48px -8px rgba(16,20,26,0.20)", "0 16px 48px -8px rgba(0,0,0,0.60)"],
  ],
};

/** R-UI-001's emission order, verbatim. Every consumer of the vocabulary reads it from here. */
const GROUPS: readonly Group[] = [
  graphite,
  beam,
  act,
  semantic,
  basis,
  element,
  canvas,
  space,
  radius,
  hairline,
  font,
  text,
  leading,
  weight,
  motion,
  z,
  breakpoint,
  row,
  shadow,
];

/** The durations reduced motion zeroes at the source (R-UI-004). */
const REDUCED_MOTION_ZEROED: readonly string[] = [
  "--motion-state",
  "--motion-panel",
  "--motion-flyto",
  "--motion-reticle",
];

/**
 * Which of a token's two values a theme carries — the one place the theme is chosen (B-17). The
 * table and the emitted stylesheet both ask this, so the two can never disagree about a value.
 */
const themeValue = (token: Token, theme: "light" | "dark"): string => (theme === "light" ? token[1] : token[2]);

const table = (theme: "light" | "dark"): TokenTable =>
  Object.freeze(
    Object.fromEntries(GROUPS.flatMap((group) => group.tokens.map((token) => [token[0], themeValue(token, theme)]))),
  );

/** The light theme, carried by `:root` (R-UI-001). */
export const lightTokens: TokenTable = table("light");

/** The dark theme, carried by `[data-theme="dark"]`; dark mode flips values, never code. */
export const darkTokens: TokenTable = table("dark");

const INDENT = "  ";

function themeBlock(selector: string, theme: "light" | "dark", indent: string): string {
  const lines = [`${indent}${selector} {`];
  for (const group of GROUPS) {
    lines.push(`${indent}${INDENT}/* ${group.label} */`);
    for (const token of group.tokens) {
      lines.push(`${indent}${INDENT}${token[0]}: ${themeValue(token, theme)};`);
    }
  }
  lines.push(`${indent}}`);
  return lines.join("\n");
}

function reducedMotionScope(selector: string): string {
  const lines = [`${INDENT}${selector} {`];
  for (const name of REDUCED_MOTION_ZEROED) lines.push(`${INDENT}${INDENT}${name}: 0ms;`);
  lines.push(`${INDENT}}`);
  return lines.join("\n");
}

/**
 * The exact content of the committed `src/ui/tokens.css`: the light theme on `:root`, the dark
 * theme on `[data-theme="dark"]` with the identical key set, and one reduced-motion block that
 * zeroes the duration tokens in both scopes (R-UI-001, R-UI-004).
 */
export function emitTokensCss(): string {
  const dark = '[data-theme="dark"]';
  return [
    "/* Generated from src/ui/tokens.ts (R-UI-001). Edit the source, never this file. */",
    "",
    themeBlock(":root", "light", ""),
    "",
    themeBlock(dark, "dark", ""),
    "",
    "@media (prefers-reduced-motion: reduce) {",
    reducedMotionScope(":root"),
    "",
    reducedMotionScope(dark),
    "}",
    "",
  ].join("\n");
}

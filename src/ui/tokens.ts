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
    // The step the ramp lacked. R-UI-001 fixes thirteen graphite steps and none of them is REVALUED
    // here; this one is ADDED, because the surface layer ran out of room. §4.1 names five distinct
    // grounds — app, panel, raised, overlay, sunken — and §4.1 also states the caption floor
    // ("--ink-muted … ≥ 4.5:1"). --ink-muted is graphite-600, so a surface that carries a caption may
    // not be darker than L* ≈ .776 in light or lighter than L* ≈ .0152 in dark. Inside those bounds
    // the committed ramp offers exactly THREE steps per theme (0, 50, 100) for five meanings, which
    // is why four of the five collapsed onto one value and the adversary found a menu whose hover
    // had no effect. 150 sits between 100 and 200 — the widest gap at the surface end of both ramps
    // — and carries a caption at 4.60:1 light / 4.67:1 dark.
    ["--graphite-150", "#E4E7E6", "#1A1E25"],
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
    // The two aliases of §4.5. They sit in this group rather than in `semantic-alias` because
    // R-UI-001 fixes emission order by prefix and a `--motion-*` key may not follow a `--shadow-*`
    // one; reduced motion zeroes them for free, through the durations they name.
    invariant("--motion-hover", "var(--motion-state)"),
    invariant("--motion-drawer", "var(--motion-panel)"),
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

/**
 * The semantic alias layer (Design Direction 00 §4.1): the names every component consumes.
 *
 * Nothing in R-UI-001 is renamed or revalued — each alias is a `var()` onto a primitive, emitted
 * into both theme blocks so an alias may flip its *index* between themes (`--ink-inverse` is
 * graphite-0 on light and graphite-1000 on dark) while consumer code never branches on the theme.
 * After this group exists a `--graphite-*` or `--beam-*` reference outside this file and its
 * generated stylesheet is a lint failure (cubit/no-primitive-token); the canvas, basis, element and
 * act palettes are exempt, because those names already say what they mean.
 */
const semanticAlias: Group = {
  label: "semantic-alias",
  tokens: [
    // surfaces
    invariant("--surface-app", "var(--graphite-0)"),
    invariant("--surface-panel", "var(--graphite-50)"),
    // The depth model of §4.1, as VALUES rather than as a table nobody measured. Before this commit
    // raised, overlay, sunken and hover were ONE colour in dark (graphite-100) and raised, overlay
    // and app were one colour in light (graphite-0): a menu's hovered item measured 1.00:1 against
    // the menu it sat in, and a dialog's edge 1.00:1 against the page behind it. Each alias now
    // names a step no other depth alias names, one step further from the app ground than the thing
    // it sits above. In LIGHT the app ground is already the lightest step the ramp has, so every
    // other surface is a darkening of it and the elevation is carried by `--shadow-*` and
    // `--line-raised`; in DARK the ground is the darkest step and elevation reads as lightness.
    ["--surface-raised", "var(--graphite-50)", "var(--graphite-100)"],
    ["--surface-overlay", "var(--graphite-100)", "var(--graphite-150)"],
    // Sunken WAS invariant, and the note that stood here said the dark index belonged to "the
    // increment that re-takes the dark baselines it moves". This is that increment (B-20): a well is
    // now darker than the panel it is cut into in BOTH themes, which in dark means the app ground
    // itself — the ramp has nothing below it, and a well showing the ground through a panel is the
    // depth model rather than a collision. Light is untouched, so no light baseline moves for it.
    ["--surface-sunken", "var(--graphite-150)", "var(--graphite-0)"],
    // Hover and active had to move with them. Hover was graphite-100 in both themes — the same value
    // the overlay painted — so every menu, combobox popover, dropdown and breadcrumb menu in the
    // product gave 1.00:1 of feedback in dark and 1.06:1 in light. It now measures 1.34:1 against the
    // overlay in light and 1.60:1 in dark, and active is one step beyond it, because a pressed row
    // that is LIGHTER than the hovered row it was pressed from says the wrong thing.
    invariant("--surface-hover", "var(--graphite-300)"),
    invariant("--surface-active", "var(--graphite-400)"),
    invariant("--surface-selected", "var(--beam-100)"),
    invariant("--surface-canvas", "var(--canvas-paper)"),
    invariant("--surface-inverse", "var(--graphite-900)"),
    // ink
    invariant("--ink", "var(--graphite-900)"),
    invariant("--ink-secondary", "var(--graphite-700)"),
    invariant("--ink-muted", "var(--graphite-600)"),
    invariant("--ink-disabled", "var(--graphite-500)"),
    // §4.1 asks this one to flip its index — graphite-0 on light, graphite-1000 on dark. It cannot.
    // The dark beam is a mid-tone (#6E63C8): near-white ink on it measures about 3.9:1, and axe
    // called it on both primary buttons of the shell. graphite-0 is "the app's ground" in BOTH
    // themes, which is what inverse ink means — the ground used as ink — and on the dark beam it is
    // near-black and passes. The direction's own contrast floor (§1, "both themes, mechanical")
    // outranks the index in its table, so the token is invariant and this is why.
    invariant("--ink-inverse", "var(--graphite-0)"),
    invariant("--ink-link", "var(--beam-600)"),
    invariant("--ink-act", "var(--act-600)"),
    invariant("--ink-code", "var(--graphite-800)"),
    // lines
    // The hairline an archived card recedes to: graphite-100 in both themes, which is what
    // `.cx-home-card[data-archived="true"]` drew before the alias layer sent it to `--line`
    // (graphite-200) — a darker line in BOTH themes, so the light baseline moved too.
    invariant("--line-quiet", "var(--graphite-100)"),
    invariant("--line", "var(--graphite-200)"),
    invariant("--line-strong", "var(--graphite-300)"),
    invariant("--line-heavy", "var(--graphite-400)"),
    // The boundary of a surface that FLOATS: a card, a menu, a popover, a dialog. `--line` is the
    // seam between two docked surfaces and measures 1.22:1 against the app ground in light — enough
    // to read as a join, not enough to read as an EDGE (SC 1.4.11 asks 3:1 of anything that tells a
    // reader where a component begins). graphite-500 is the ramp's first step that clears it from
    // the app ground in both themes: 3.37:1 light, 3.86:1 dark.
    invariant("--line-raised", "var(--graphite-500)"),
    invariant("--line-accent", "var(--beam-500)"),
    invariant("--line-focus", "var(--beam-500)"),
    invariant("--line-act", "var(--act-500)"),
    // accent
    invariant("--accent", "var(--beam-500)"),
    invariant("--accent-hover", "var(--beam-600)"),
    invariant("--accent-active", "var(--beam-700)"),
    invariant("--accent-subtle", "var(--beam-100)"),
    invariant("--accent-muted", "var(--beam-300)"),
    // The beam fill a control paints INK on, as against the beam mark a control merely draws with.
    // They have to be two names, because in dark they cannot be one value: beam-500 under
    // `--ink-inverse` measures 3.94:1, below R-UI-012's 4.5 floor for normal text, and no ink
    // rescues it — the darkest possible ink on that fill reaches 4.27. beam-600 measures 6.04 with
    // the ink already in use. Nothing in R-UI-001 is renamed or revalued: `--accent` still paints
    // every bar, dot and handle it painted (those carry no text and clear the 3:1 UI floor at
    // 3.94), and a filled control that carries a LABEL reads this alias instead. The light theme
    // keeps beam-500, which measures 6.04 there, so no light baseline moves.
    ["--accent-fill", "var(--beam-500)", "var(--beam-600)"],
    invariant("--act", "var(--act-500)"),
    // state
    invariant("--state-success", "var(--success)"),
    invariant("--state-success-surface", "var(--success-surface)"),
    invariant("--state-warn", "var(--warn)"),
    invariant("--state-warn-surface", "var(--warn-surface)"),
    invariant("--state-danger", "var(--danger)"),
    invariant("--state-danger-surface", "var(--danger-surface)"),
    invariant("--state-info", "var(--info)"),
    invariant("--state-info-surface", "var(--info-surface)"),
    // The coverage ramp: one hue, lightness STEPS, so share-published reads without colour (§4.3).
    // It did not read without colour. beam-100 is lighter than graphite-200 in light and darker in
    // dark, so the ramp rose at cov-0 → cov-1 in light and fell in dark — non-monotonic, and
    // INVERTED between the themes — and the two steps measured 1.08:1 light / 1.14:1 dark, which is
    // no step at all: a cell at 0 % and a cell at 1–25 % were the same cell in greyscale, and
    // greyscale is where the certificate prints (R-UI-060, SC 1.4.1). The ramp now starts at
    // graphite-200 and walks beam 300 → 500 → 600 → 700, dropping the collapsed beam-100 step: five
    // values that fall monotonically in light, rise monotonically in dark, and no adjacent pair
    // closer than 1.29:1 light / 1.37:1 dark.
    invariant("--cov-0", "var(--graphite-200)"),
    invariant("--cov-1", "var(--beam-300)"),
    invariant("--cov-2", "var(--beam-500)"),
    invariant("--cov-3", "var(--beam-600)"),
    invariant("--cov-4", "var(--beam-700)"),
    // glass is a z-overlay privilege; it never appears in a docked region (§1)
    ["--glass-alpha", "0.92", "0.88"],
    invariant("--glass-blur", "12px"),
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
  semanticAlias,
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

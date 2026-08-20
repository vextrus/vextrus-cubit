/**
 * R-UI-001 — Datum tokens. This file is the sole source of every colour, length,
 * shadow, type size, duration, layer and breakpoint in the product. `pnpm
 * gen:tokens` emits it as CSS variables into `src/app/globals.css` for `:root`
 * and `[data-theme="dark"]`; nothing else in the tree may carry a colour literal
 * (cubit/no-colour-literals).
 *
 * Palette values are theme-independent facts. `themes` maps the roles a screen
 * actually names (surface, text, border, accent) onto those facts, once per
 * theme — so a component reads `var(--text)` and never a scale step.
 */

/** Graphite 0–1000: surfaces at the light end, text at the dark end. */
const graphite = {
  0: '#ffffff',
  50: '#f7f8f9',
  100: '#eef0f2',
  200: '#dfe3e7',
  300: '#c7cdd4',
  400: '#a3abb5',
  500: '#7c8592',
  600: '#5c6673',
  700: '#444d59',
  800: '#2f363f',
  900: '#1c2229',
  1000: '#0d1116',
} as const;

/** Cobalt: the one accent. Interactive means cobalt; nothing else does. */
const cobalt = {
  50: '#eaf1fe',
  100: '#d4e2fd',
  200: '#a9c5fb',
  300: '#7ea8f9',
  400: '#4b86f5',
  500: '#1f6feb',
  600: '#0b57d0',
  700: '#0842a0',
  800: '#06316f',
  900: '#04214a',
} as const;

/** Semantic roles. `base` clears 4.5:1 on the light surface; `onDark` on the dark one. */
const semantic = {
  success: { base: '#136c32', onDark: '#5fd88a', surface: '#e6f4ea', surfaceDark: '#0d2b17' },
  warn: { base: '#8a6100', onDark: '#e3b341', surface: '#fdf3d7', surfaceDark: '#2b2110' },
  danger: { base: '#b3261e', onDark: '#ff8a80', surface: '#fdecea', surfaceDark: '#2f1512' },
  info: { base: '#0b57d0', onDark: '#7ea8f9', surface: '#eaf1fe', surfaceDark: '#0a1b33' },
} as const;

/**
 * R-UI-002 — the basis palette is fixed, and every basis carries a glyph so the
 * pair survives greyscale and colour-blindness.
 */
const basis = {
  MEASURED: { colour: '#0f766e', glyph: '◆', label: 'Measured' },
  TRANSCRIBED: { colour: '#1d4ed8', glyph: '▣', label: 'Transcribed' },
  DERIVED: { colour: '#6d28d9', glyph: 'ƒ', label: 'Derived' },
  IMPORTED: { colour: '#475569', glyph: '⇩', label: 'Imported' },
  ENTERED: { colour: '#a16207', glyph: '✎', label: 'Entered' },
  INTERPRETED: { colour: '#a21caf', glyph: '▦', label: 'Interpreted' },
  DEFAULTED: { colour: '#6b7280', glyph: '○', label: 'Defaulted' },
} as const;

/** The drawing viewer's own surface — always dark, never themed. */
const canvas = {
  background: '#101418',
  grid: '#1c2229',
  gridMajor: '#2f363f',
  selection: '#1f6feb',
  snap: '#12b886',
  measure: '#e3b341',
  refusal: '#ff8a80',
} as const;

/** Element classes as they appear on a drawing and in a register. */
const elementClass = {
  column: '#1d4ed8',
  beam: '#0f766e',
  slab: '#6d28d9',
  wall: '#475569',
  foundation: '#a16207',
  opening: '#a21caf',
  rebar: '#b3261e',
  dimension: '#5c6673',
} as const;

/** 4-pt grid. Nothing in the product is spaced off it. */
const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

const radii = { sm: 2, md: 4, lg: 8, xl: 12 } as const;

/** Four shadows; hairline borders are preferred over every one of them. */
const elevation = {
  flat: '0 0 0 1px rgba(13, 17, 22, 0.08)',
  raised: '0 1px 2px rgba(13, 17, 22, 0.10), 0 0 0 1px rgba(13, 17, 22, 0.06)',
  overlay: '0 8px 24px rgba(13, 17, 22, 0.16), 0 0 0 1px rgba(13, 17, 22, 0.06)',
  modal: '0 16px 48px rgba(13, 17, 22, 0.24), 0 0 0 1px rgba(13, 17, 22, 0.08)',
} as const;

/** R-UI-003 — Inter for UI, JetBrains Mono for every number, Noto Sans for documents. */
const type = {
  families: {
    ui: "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    mono: "'JetBrains Mono', ui-monospace, 'SF Mono', 'Cascadia Mono', Menlo, monospace",
    document: "'Noto Sans', 'Inter', ui-sans-serif, system-ui, sans-serif",
  },
  scale: { xs: 12, dense: 13, base: 14, md: 16, lg: 20, xl: 24, display: 32 },
  weight: { regular: 400, medium: 500, semibold: 600 },
  lineHeight: { tight: 1.25, base: 1.45, loose: 1.6 },
} as const;

/** R-UI-004 — 120–200 ms for state changes, 240 ms panels, 320 ms fly-to. No bounce. */
const motion = {
  duration: { instant: 120, base: 160, slow: 200, panel: 240, flyTo: 320 },
  easing: {
    out: 'cubic-bezier(0.16, 1, 0.3, 1)',
    inOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
    linear: 'linear',
  },
} as const;

const z = {
  base: 0,
  raised: 10,
  sticky: 100,
  overlay: 200,
  modal: 300,
  toast: 400,
  tooltip: 500,
} as const;

const breakpoints = { sm: 640, md: 768, lg: 1024, xl: 1280, wide: 1600 } as const;

/**
 * The roles a screen names. Both themes are defined; a component reads the role,
 * never the scale step.
 */
const themes = {
  light: {
    surface: 'var(--graphite-0)',
    'surface-raised': 'var(--graphite-0)',
    'surface-sunken': 'var(--graphite-50)',
    'surface-accent': 'var(--cobalt-50)',
    border: 'var(--graphite-200)',
    // form-control borders clear 3:1 against the surface (R-UI-012)
    'border-strong': 'var(--graphite-500)',
    text: 'var(--graphite-900)',
    'text-muted': 'var(--graphite-600)',
    'text-inverse': 'var(--graphite-0)',
    accent: 'var(--cobalt-600)',
    'accent-hover': 'var(--cobalt-700)',
    'accent-contrast': 'var(--graphite-0)',
    'focus-ring': 'var(--cobalt-500)',
    'danger-text': 'var(--semantic-danger)',
    'danger-surface': 'var(--semantic-danger-surface)',
    'success-text': 'var(--semantic-success)',
    'info-text': 'var(--semantic-info)',
    overlay: 'rgba(13, 17, 22, 0.40)',
  },
  dark: {
    surface: 'var(--graphite-1000)',
    'surface-raised': 'var(--graphite-900)',
    'surface-sunken': 'var(--graphite-1000)',
    'surface-accent': 'var(--cobalt-900)',
    border: 'var(--graphite-800)',
    'border-strong': 'var(--graphite-600)',
    text: 'var(--graphite-50)',
    'text-muted': 'var(--graphite-300)',
    'text-inverse': 'var(--graphite-1000)',
    accent: 'var(--cobalt-300)',
    'accent-hover': 'var(--cobalt-200)',
    'accent-contrast': 'var(--graphite-1000)',
    'focus-ring': 'var(--cobalt-400)',
    'danger-text': 'var(--semantic-danger-on-dark)',
    'danger-surface': 'var(--semantic-danger-surface-dark)',
    'success-text': 'var(--semantic-success-on-dark)',
    'info-text': 'var(--semantic-info-on-dark)',
    overlay: 'rgba(0, 0, 0, 0.60)',
  },
} as const;

export const tokens = {
  graphite,
  cobalt,
  semantic,
  basis,
  canvas,
  elementClass,
  spacing,
  radii,
  elevation,
  type,
  motion,
  z,
  breakpoints,
  themes,
} as const;

export type Tokens = typeof tokens;
export type BasisName = keyof typeof basis;
export type ThemeName = keyof typeof themes;

/** The two themes, as the cookie and the `data-theme` attribute spell them. */
export const THEME_NAMES = ['light', 'dark'] as const;

# Design Decision — primitives-core (the Datum core primitive set)

Not a routed screen: eleven primitives in `src/ui/primitives/core` — Button, Input, Textarea,
Badge, Chip, BasisChip, CoverageChip, UnitBadge, Kbd, Skeleton, Tooltip — plus the focus
reticle's single home. Law: R-UI-001/002/003/004/010/012, B-17, Q-11. Consumers (R-UI-011):
S-Auth (inc-009), the shell (inc-013); BasisChip/CoverageChip/UnitBadge → register (M2),
estimate (M6). No route, no gallery here; the `/design` gallery leaf screenshots these later.

## 0. Interpretations (recorded per the Law section of CLAUDE.md)

- **I-1 — geometry constants are authored in px.** The interfaces line says all
  colour/spacing/motion values are `var(--…)`. R-UI-012 and R-UI-010 also mandate geometry no
  token can express: the 7 px dot, 2 px beam stroke, 8 px arms, 4 px offset, 2 px fallback
  offset, 1 px borders, and the tooltip's 280 px measure. Ruling: *layout* spacing (padding,
  gap, height, radius) uses `var(--space-…)`/`var(--radius-…)`; the mandated constants above
  are px literals. Colour and motion are `var(--…)` without exception.
- **I-2 — no `transparent` keyword.** `cubit/no-colour-literal` bans named colours; where a
  variant needs no fill it uses `background: none`, and where it needs no border it drops the
  border and compensates padding by 1 px so variants keep one geometry.

## 1. Shared anatomy

- Files: components in `src/ui/primitives/core/*.tsx`, one stylesheet
  `src/ui/primitives/core/core.css`, reticle solely in `src/ui/primitives/core/reticle.css`,
  glyph table solely in `src/ui/primitives/core/basis.ts` (B-17). Class prefix `cx-`
  (`cx-btn`, `cx-input`, …); variants select on `data-variant`, never on extra classes.
- Type: controls `var(--font-ui)` `var(--text-14)` `var(--weight-body-medium)`; data chips
  (BasisChip, CoverageChip, UnitBadge) and Kbd `var(--font-mono)` `var(--text-12)` with
  `font-variant-numeric: tabular-nums slashed-zero` (R-UI-003 — bases and units are source
  keys and numbers).
- Heights: controls (Button, Input) `var(--space-8)` (32 px); Chip `var(--space-6)` (24 px);
  Badge, Kbd and the data chips `var(--space-5)` (20 px, table density).
- Radius: `var(--radius-4)` everywhere except Chip, which is a pill at `var(--radius-12)`.
- Primitives never own product copy: every label, placeholder and tooltip string is passed by
  the consumer. The only copy this file fixes is the acceptance sample data (§4).
- ARIA: Input/Textarea require an accessible name (visible `<label>` or `aria-label`) — an
  unnamed instance is a defect. Decorative marks (act dot, basis glyph) are `aria-hidden`.

## 2. The focus reticle (R-UI-012, B-17)

One home: `reticle.css`. No other file in the tree declares focus-indicator styling; every
focusable primitive here (Button, Input, Textarea, interactive Chip, Tooltip trigger) carries
class `cx-reticle`.

- `.cx-reticle` sets `position: relative` so the overlay can anchor.
- `.cx-reticle:focus-visible` suppresses the UA outline and draws `::after`: an absolutely
  positioned overlay inset −4 px (offset 4 px outside the box), `pointer-events: none`,
  radius `var(--radius-4)`, whose background is eight no-repeat `linear-gradient` layers in
  `var(--beam-500)` — per corner one 8 px × 2 px horizontal arm and one 2 px × 8 px vertical
  arm (four corner ticks, 2 px beam stroke, 8 px arms).
- The draw: an entrance animation, opacity 0 → 1 with scale 1.05 → 1, over
  `var(--motion-reticle)` `var(--ease)` (ease-out; 120 ms per the token). Tokens already zero
  durations under reduced motion; reticle.css **still** carries an explicit
  `@media (prefers-reduced-motion: reduce)` branch setting `animation: none` — the draw is
  instant twice over.
- Fallback (documented in reticle.css): `input.cx-reticle:focus-visible,
  textarea.cx-reticle:focus-visible` — replaced elements cannot host `::after` — get
  `outline: 2px solid var(--beam-500); outline-offset: 2px` instead of ticks.
- `var(--beam-500)` clears 3:1 against `var(--graphite-0)` in both themes.

## 3. Components — layout, states, tokens

### Button (`cx-btn cx-reticle`, native `<button type="button">`)
Padding-inline `var(--space-3)`, gap `var(--space-2)`, 1 px border per variant (ghost:
borderless, padding compensated +1 px per I-2). Hover transitions background/border/colour
over `var(--motion-state)` `var(--ease)`.

| variant | rest | hover |
|---|---|---|
| primary | fill+border `var(--beam-700)`, text `var(--graphite-0)` | fill+border `var(--beam-600)` |
| secondary | fill `var(--graphite-0)`, border `var(--graphite-300)`, text `var(--graphite-900)` | fill `var(--graphite-100)` |
| ghost | no fill, no border, text `var(--graphite-700)` | fill `var(--graphite-100)`, text `var(--graphite-900)` |
| danger | fill `var(--danger-surface)`, border+text `var(--danger)` | fill `var(--danger)`, text `var(--graphite-0)` |
| act | fill `var(--act-surface)`, border `var(--act-500)`, text `var(--act-600)` | rest colours + `box-shadow: var(--shadow-1)` |

Primary reads `beam-700` on purpose: its value flips light/dark so the label stays
`graphite-0` in both themes at ≥ 4.5:1 with no theme override (§6). Danger inverts on hover
(quiet at rest, filled to commit) — both legs clear 4.5:1 in both themes. Copper stays
scarce: only act wears it.

- **Act dot**: only the act variant renders `<span class="cx-act-dot" data-testid="act-dot"
  aria-hidden="true">` before the label — a 7 px × 7 px circle, fill `var(--act-500)`, no
  other colour. Act CSS uses only `var(--act-surface)`, `var(--act-500)`, `var(--act-600)`.
- **Active** (all variants): the hover colours with `transform: translateY(1px)`.
- **Loading**: `loading` sets `aria-busy="true"` and `aria-disabled="true"`,
  `data-loading="true"`; the accessible name is unchanged (the label stays rendered); the
  content drops to opacity 0.6; `cursor: progress`; the component does not invoke `onClick`
  on pointer or keyboard activation. Still focusable — focus is never dropped mid-action. No
  spinner (R-UI-004): `aria-busy` is the announcement; tests observe it as role state (Q-11).
- **Disabled** (native `disabled`): every variant collapses to fill `var(--graphite-100)`,
  border `var(--graphite-200)`, text `var(--graphite-500)` (the ≥ 3:1 disabled floor);
  `cursor: not-allowed`. A disabled act button keeps its dot in `var(--act-500)` — the dot is
  identity, not affordance.

### Input (`cx-input cx-reticle`) · Textarea (`cx-textarea cx-reticle`)
Fill `var(--graphite-0)`, border 1 px solid `var(--graphite-300)`, radius `var(--radius-4)`,
text `var(--graphite-900)` at `var(--text-14)`, placeholder `var(--graphite-500)` (a
placeholder is a hint, never a label). Input: height `var(--space-8)`, padding-inline
`var(--space-3)`. Textarea: padding `var(--space-2)` `var(--space-3)`, default `rows={3}`,
`resize: vertical`, line-height `var(--leading-ui)`.
States — hover: border `var(--graphite-400)`. Focus: the reticle fallback only; the border
does not change (one focus indicator, no double signal). Invalid (`aria-invalid="true"`):
border `var(--danger)`. Disabled: fill `var(--graphite-100)`, border `var(--graphite-200)`,
text `var(--graphite-500)`.

### Badge (`cx-badge`, `<span>`) — static, non-interactive
Fill `var(--graphite-100)`, text `var(--graphite-700)`, `var(--text-12)`
`var(--weight-body-medium)`, padding-inline `var(--space-2)`. Neutral graphite only in this
slice; semantic tones arrive with the consumer that needs them (recorded IOU, owner: that
consumer's increment — never a comment in src, Q-17).

### Chip (`cx-chip`) — interactive when `onClick` is passed
With `onClick`: a `<button type="button">` with `cx-reticle`; without: a `<span>`. Pill,
fill `var(--graphite-50)`, border 1 px solid `var(--graphite-200)`, text
`var(--graphite-700)`, padding-inline `var(--space-3)`. Hover (interactive): fill
`var(--graphite-100)`, text `var(--graphite-900)`. `selected` prop → `aria-pressed="true"`,
fill `var(--beam-100)`, border `var(--beam-500)`, text `var(--graphite-900)` (the R-UI-030
selection idiom).

### BasisChip (`cx-basis-chip`, `<span data-testid="basis-chip" data-basis={basis}>`)
Glyph then label, gap `var(--space-1)`, no fill, border 1 px solid the matching
`var(--basis-…)` token, mono `var(--text-12)`. The glyph —
`<span data-testid="basis-glyph" aria-hidden="true">` — is coloured `var(--basis-…)` and its
text comes only from `BASIS_GLYPHS` in `basis.ts` (MEASURED ◆ · TRANSCRIBED ▣ · DERIVED ƒ ·
IMPORTED ⇩ · ENTERED ✎ · INTERPRETED ▦ · DEFAULTED ○) — the single R-UI-002 home (B-17).
The label is the basis name verbatim (it is the enum value, not styled uppercase) in
`var(--graphite-700)` — guaranteed ≥ 4.5:1 in both themes; the basis colour rides the glyph
and border (≥ 3:1 UI), and the glyph pair survives greyscale (R-UI-002). No other colour.

### CoverageChip (`cx-coverage-chip`, `<span data-testid="coverage-chip">`)
Chrome: no fill, border `var(--hairline)`, mono `var(--text-12)`, padding-inline
`var(--space-2)`. Text content — and therefore its accessible text — is the percentage:
clamp value to [0, 1]; render `100%` only when value ≥ 1, else `min(99, floor(value × 100))`
+ `%` — a precision instrument never rounds 0.996 up to done. Text colour bands the value
(redundant to the numeral, never colour-only): v < 0.5 `var(--danger)` · 0.5 ≤ v < 0.9
`var(--warn)` · v ≥ 0.9 `var(--success)`.

### UnitBadge (`cx-unit-badge`, `<span data-testid="unit-badge">`)
The unit string verbatim (SQM, CUM, RFT). No fill, border `var(--hairline)`, text
`var(--graphite-600)` (caption role, ≥ 4.5:1), mono `var(--text-12)`, padding-inline
`var(--space-1)`.

### Kbd (`cx-kbd`, native `<kbd>`)
Keycap: fill `var(--graphite-50)`, border 1 px solid `var(--graphite-300)` with a 2 px
bottom edge, radius `var(--radius-4)`, min-width `var(--space-5)`, centred, text
`var(--graphite-700)` mono `var(--text-12)`.

### Skeleton (`cx-skeleton`, `<div data-testid="skeleton" aria-hidden="true">`)
Keeps layout (R-UI-004): display block, default height `var(--space-4)`, radius
`var(--radius-4)`, sized by the consumer via `style`/`className`. Fill `var(--graphite-100)`
pulsing to `var(--graphite-200)` and back over 1600 ms ease-in-out infinite; under
`prefers-reduced-motion: reduce` the animation is removed and the fill holds at
`var(--graphite-100)`. `aria-hidden` — the owning screen announces loading, not each bone.

### Tooltip (Radix `@radix-ui/react-tooltip`)
`Tooltip` renders its own Provider + Root (`delayDuration` 300, `skipDelayDuration` 300) —
no consumer setup. The single child is the trigger via `asChild`; the trigger must be
focusable and carries `cx-reticle` (our primitives already do). Content
(`data-testid="tooltip-content"`, class `cx-tooltip`): fill `var(--graphite-900)`, text
`var(--graphite-0)` (inverted surface — the roles flip values so it reads in both themes),
`var(--text-12)`, padding `var(--space-1)` `var(--space-2)`, radius `var(--radius-4)`,
`box-shadow: var(--shadow-2)`, `z-index: var(--z-overlay)`, max-width 280 px (I-1), no
arrow. Side top, `sideOffset` 6. Entrance: opacity 0 → 1 and 2 px rise over
`var(--motion-state)` `var(--ease)`; exit instant. Reduced motion: the duration token
zeroes at source. Focus on the trigger opens it (Radix default); Escape closes.

## 4. Copy — the acceptance sample composition, verbatim

The AC-5 composition renders, in this document order (this is also Tab order): Button primary
**Save changes** · secondary **Cancel** · ghost **Duplicate** · danger **Delete line** · act
**Issue certificate** · a loading primary **Save changes** · a disabled secondary **Cancel**;
an Input labelled **Project name** with placeholder **e.g. Riverside Tower**; a Textarea
labelled **Notes** with placeholder **Anything the estimator should know**; Badge **Draft**;
interactive Chip **Layer S-COL**; the seven BasisChips (labels are the basis names);
CoverageChip value 0.82 rendering **82%**; UnitBadge **SQM**; Kbd **K**; Skeleton (default);
Tooltip content **Snap to grid — S** wrapping a ghost Button **Snap**. Voice: labels are
verb-first and plain; no exclamation marks; no internal vocabulary.

## 5. The R-UI-050 matrix, ruled

This is a component set, not a screen; the seven screen states are obligations of the screens
that compose these primitives, each ruled in its own Decision. What this file owes instead is
every *component* state, enumerated in §3: rest, hover, active, focus, disabled, loading
(Button), invalid (Input/Textarea), selected (Chip). Loading's screen-level vocabulary is
Skeleton (never spinners); empty/error/refusal/partial/offline/permission-denied render via
EmptyState/ErrorState/RefusalState, which are out of scope here and owned by later R-UI-010
increments — their consumers' Decisions will name them.

## 6. Motion (R-UI-004) and themes

Motion, complete: reticle draw `var(--motion-reticle)` (§2) · control colour transitions and
tooltip entrance `var(--motion-state)` `var(--ease)` · skeleton pulse 1600 ms (§3) · button
press translate 1 px, no transition, no bounce. Every duration is a token zeroed at source
under reduced motion; reticle.css and the skeleton also carry explicit reduce branches.

Themes: `core.css` and `reticle.css` contain **no** `[data-theme]` selector — every
difference between light and dark arrives through token values (R-UI-001). The one visible
character change: primary Button is deep indigo with near-white text in light and flips to
the light periwinkle beam-700 with near-black text in dark; both read `var(--beam-700)` +
`var(--graphite-0)`. Contrast holds in both themes for every pair ruled in §3 (act-600 on
act-surface and graphite-500/600 floors are R-UI-001 founder facts; the beam/danger pairs
were checked against the founder values).

## 7. Test hooks (closed contract, C-05)

Routes: none — no route ships in this increment. Test ids, exactly these seven, on the
elements ruled in §3: `act-dot` · `basis-chip` · `basis-glyph` · `coverage-chip` ·
`unit-badge` · `tooltip-content` · `skeleton`. Behavioural hooks under test, without new
ids: Button `data-variant`/`data-loading`/`aria-busy`; BasisChip `data-basis`; Chip
`aria-pressed`; Input `aria-invalid`; the `cx-reticle` class on every focusable primitive.
Suites render under jsdom (`@vitest-environment jsdom`) inside a default root and a
`[data-theme="dark"]` ancestor; reticle and dot geometry are asserted as authored CSS text
(jsdom does not lay out), per the increment's risk notes.

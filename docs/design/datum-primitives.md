# Design Decision — datum-primitives

Not a routed screen. This document fixes the anatomy, states, copy, motion and tokens of every
primitive `src/ui/primitives/` ships this increment. It is the contract the components are built
and graded against (AM-03). R-UI-050's screen states (loading/empty/error/refusal/offline/
permission-denied) are owed by the screens that compose these primitives; the states a primitive
itself owns — hover, active, focus, disabled, loading, invalid, open, empty — are fixed per
component below. Token names are the Datum sheet in `docs/design/datum-tokens.md`; no literal
colour anywhere (R-UI-001).

## 1. Shared laws

- **Control metric.** Every field, button, trigger and menu item is 28 px tall (the compact row
  rhythm, R-UI-005), `--text-13`, `--radius-4`, horizontal padding `--space-2` (fields, items)
  or `--space-3` (buttons). Icons inside controls are 16 px, `--graphite-600` — except on a
  filled button (primary, danger), where the icon takes the button's own ink.
- **Focus (R-UI-012).** The focusable element of every interactive primitive carries the class
  `datum-focus-ring`. `src/ui/primitives/primitives.css` defines:
  `.datum-focus-ring:focus-visible { outline: 2px solid var(--cobalt-500); outline-offset: 1px; }`
  — a 2 px cobalt outer ring, never clipped (no `overflow: hidden` on a focusable's box).
- **Names.** Every interactive element has an ARIA name: from its visible text, its `<label>`,
  or a required `label`/`aria-label` prop (IconButton, Slider, Progress, Combobox). No unnamed
  control ships.
- **Overlay surface.** Select content, Popover, menus, Dialog, Sheet and Toast share one
  surface: background `--graphite-0`, hairline border `1px solid var(--graphite-200)`,
  `--radius-8`, shadow per depth (§15 table). Items inside are 28 px, `--radius-4`, highlighted
  with `--graphite-100`; the highlight moves with ArrowUp/ArrowDown, Enter activates, Escape
  closes and returns focus to the trigger.
- **Motion (R-UI-004).** State changes run `--motion-state-duration` (160 ms) with
  `--motion-ease`; panels run `--motion-panel-duration` (240 ms). No bounce anywhere. The
  tokens.css reduced-motion block zeroes every duration; the two keyframe animations this
  increment adds (button spinner §2, skeleton pulse §13) are explicitly stilled by a
  `@media (prefers-reduced-motion: reduce)` rule in primitives.css.
- **Numerals.** Every numeral (NumberInput, Kbd, menu shortcut hints) renders in `--font-mono`
  with `font-variant-numeric: tabular-nums slashed-zero` via the `.numeric` utility (R-UI-003).
- **Themes.** Every rule reads role-stable tokens, so dark mode needs no forked CSS — with one
  exception, the Dialog/Sheet scrim (§11). Differences that follow from token values are §16.

## 2. Button and IconButton

Anatomy: optional 16 px icon slot, then label, gap `--space-2`. Height 28 px, padding
`0 var(--space-3)`, `--radius-4`, `--weight-body-medium`.

| Variant | Rest | Hover | Active | Text |
|---|---|---|---|---|
| primary | `--cobalt-500` | `--cobalt-600` | `--cobalt-700` | `--graphite-0` |
| secondary | `--graphite-0` + border `--graphite-300` | fill `--graphite-100` | fill `--graphite-200` | `--graphite-800` |
| ghost | transparent | `--graphite-100` | `--graphite-200` | `--graphite-700` |
| danger | `--danger` | `--danger` at `opacity: 0.9` | `opacity: 0.8` | `--graphite-0` |

Hover/active fills transition over `--motion-state-duration`. States:

- **Disabled:** background `--graphite-100`, text `--graphite-400`, border none, no pointer
  events; still rendered in the tab order's flow but `disabled` (native).
- **Loading:** `loading` keeps the label and adds a 16 × 4 px bar in `currentColor` after it,
  breathing between 30% and 90% opacity over `--motion-panel-duration`, alternating. It does
  not spin and it does not move: R-UI-004 keeps the layout still while something is in flight,
  and a rotation is a duration outside the motion bands this document is allowed to state.
  Under reduced motion the bar is static (§15). Sets `aria-busy="true"`, blocks activation
  (`onClick` never fires), stays focusable so focus is not stranded. No copy; the label already
  says what is happening.

**IconButton**: 28 × 28 px, ghost styling by default, required `label` prop rendered as
`aria-label`; the icon is `aria-hidden`. Same disabled treatment.

## 3. Input and Textarea

Background `--graphite-0`, border `1px solid var(--graphite-300)`, `--radius-4`, text
`--graphite-900`, placeholder `--graphite-500`, padding `0 var(--space-2)` (Textarea:
`var(--space-2)` all round, minimum three lines, `resize: vertical` only). States:

- **Disabled:** background `--graphite-100`, text and placeholder `--graphite-400`.
- **Invalid:** `aria-invalid="true"` turns the border `--danger`. The message that explains why
  belongs to the composing screen, adjacent to the field — never a toast (R-UI-020).
- **Focus:** the cobalt ring (§1); the border does not change colour under it.

## 4. NumberInput

An Input specialised for decimal strings (B-07): `value: string`, `onValueChange(next: string)`,
`unit?: string`. Anatomy: the field (`data-testid="number-input-field"`, `--font-mono` +
`.numeric`, `inputmode="decimal"`), then, inside the bordered box at the right edge, the unit
suffix (`data-testid="number-input-suffix"`, `--graphite-600`, `--text-13`, `aria-hidden`
markup-wise separate from the value; the input's `aria-describedby` points at it).

- **Alphabet.** Accepted characters are `0–9` and at most one `.`. A keystroke or paste
  containing anything else — letters, a second point, Western-grouped text like `1,234,567` —
  is refused whole: the value is unchanged and `onValueChange` does not fire. The refusal is
  silent; a numeric field that swallows a stray key needs no banner.
- **Display on blur.** A non-empty value splits at the point; the integer part (empty → `0`)
  groups through `formatNumber(whole, 'count')` from `src/core/format.ts` (R-SPINE-061 — the
  one seam; ASCII digits, lakh/crore); a fraction reattaches verbatim; a trailing bare point
  drops from display. So value `1234567.89` displays `12,34,567.89`; `10000000` displays
  `1,00,00,000`; `.5` displays `0.5`; empty displays empty — never `NaN`.
- **Focus restores the raw string** exactly as committed (`10000000`, `.5`); grouping is
  display-only and the committed value is never rewritten by the control.
- Disabled and invalid states as §3.

## 5. Checkbox, Radio/RadioGroup, Switch, Slider

All transition checked-state fills over `--motion-state-duration`; all state their ARIA
(`aria-checked`, `role="radio"` inside a RadioGroup's `role="radiogroup"`, `role="switch"`,
`role="slider"` with `aria-valuenow/min/max`). Two keyboard rules are the library's, not a
library's:

- **Space toggles a Switch**, on the key itself. A browser turns Space on a button into a
  click and the switch would toggle either way; deciding it on the keydown means one press is
  one toggle in any host, and the click the browser sends afterwards is swallowed.
- **A RadioGroup's arrows both move and choose.** The group is one Tab stop; ArrowDown and
  ArrowRight move to the next radio and check it in the same keystroke, ArrowUp and ArrowLeft
  go back, and both wrap. Entering the group with Tab, or clicking into it, chooses nothing.

- **Checkbox:** 16 × 16 px, `--radius-2`. Unchecked: `--graphite-0` fill, border
  `--graphite-300`. Checked: `--cobalt-500` fill, check glyph `--graphite-0`. Indeterminate:
  same fill, horizontal dash, `aria-checked="mixed"`. Disabled: fill `--graphite-100`, border
  `--graphite-200`, glyph `--graphite-400`.
- **Radio:** 16 × 16 px circle, same palette; checked is a `--cobalt-500` ring with a 6 px
  `--cobalt-500` inner dot.
- **Switch:** track 28 × 16 px, full-radius (`--radius-8`); off `--graphite-300`, on
  `--cobalt-500`; thumb 12 px `--graphite-0` circle travelling 12 px over
  `--motion-state-duration`.
- **Slider:** rail 4 px, `--radius-2`, `--graphite-200`; filled range `--cobalt-500`; thumb
  14 px `--graphite-0` circle, border `1px solid var(--cobalt-500)`, `--shadow-1`. ArrowRight
  and ArrowUp raise the value by one `step`, ArrowLeft and ArrowDown lower it, PageUp/PageDown
  move ten steps, Home and End go to the ends; every value is clamped to `[min, max]`, and a
  slider given no value stands at its minimum. The thumb is the control: it takes the focus
  ring, the tab stop and the accessible name (`aria-label` prop). This is the one primitive
  written rather than restyled — Radix's Slider measures its thumb through `ResizeObserver`
  and cannot mount in a DOM with no layout, which is every unit test a consumer will write.

## 6. Select

Trigger: an Input-shaped box (§3) whose right edge holds a chevron (`--graphite-600`); the
chosen option's label sits left; empty shows the consumer's `placeholder` in `--graphite-500`.
Enter, Space or ArrowDown opens. Content: the overlay surface (§1), `--shadow-2`, padding
`--space-1`, entering with a 160 ms fade plus 4 px translate from the trigger. Options are
`role="option"`, 28 px, selected shows a 16 px check glyph in `--cobalt-500` at the left.
ArrowDown/ArrowUp move, Enter selects and closes, Escape closes without selecting; either way
focus returns to the trigger.

## 7. Combobox

Anatomy: an Input (§3) with `role="combobox"`, `aria-expanded`, and `aria-controls` pointing at
the list (`data-testid="combobox-input"`); below it, on the overlay surface, the list
(`role="listbox"`, `data-testid="combobox-list"`) of options (`role="option"`,
`data-testid="combobox-option"`). Typing calls `loadOptions(query)`; results replace the list.

- **Loading:** while the loader is unresolved the list shows one non-interactive row —
  “Searching…” (`primitives.combobox.loading`) in `--graphite-500` — inside an `aria-live="polite"`
  region. Text, not a spinner; the layout does not jump when results land.
- **Empty:** a resolved query with no matches shows `data-testid="combobox-empty"`: “No matches
  for this search.” (`primitives.combobox.empty`), `--graphite-500`, centred, padding
  `--space-3`. The list never renders silently blank (R-UI-020).
- ArrowDown moves highlight into the list, Enter commits the highlighted option into the input
  and closes, Escape closes and keeps the typed text. `aria-selected` marks the highlight.

## 8. Tabs

`role="tablist"` with a full-width hairline (`--graphite-200`) under it. Triggers: 32 px tall,
`--text-13`, `--weight-body-medium`, inactive `--graphite-600`, hover `--graphite-800`, active
`--graphite-900` with a 2 px `--cobalt-500` underline sitting on the hairline. The underline
appears with a 160 ms fade — it does not slide. ArrowRight/ArrowLeft rove focus and activate
(automatic activation); the active trigger has `aria-selected="true"`; each panel is
`role="tabpanel"`, associated via `aria-controls`/`aria-labelledby`, fading in over 160 ms.

## 9. Tooltip and Popover

- **Tooltip:** inverse surface — background `--graphite-950`, text `--graphite-0`, `--text-12`,
  padding `var(--space-1) var(--space-2)`, `--radius-4`, `--shadow-2`. Opens after 200 ms
  pointer hover, immediately on keyboard focus; 160 ms fade; Escape dismisses. Never the only
  home of information a task needs.
- **Popover:** overlay surface, `--shadow-2`, padding `--space-3`, 160 ms fade + 4 px translate.
  Focus moves into the content on open; Escape and outside-click close; focus returns to the
  trigger.

## 10. DropdownMenu and ContextMenu

Both use the Select content surface (§6): `--shadow-2`, padding `--space-1`, items
`role="menuitem"` at 28 px with highlight `--graphite-100`. A destructive item's text is
`--danger`. Separators are §13's hairline with `--space-1` margins. Shortcut hints sit
right-aligned in `--graphite-500` `--font-mono`. DropdownMenu opens from its trigger on Enter,
Space or ArrowDown; ContextMenu opens at the pointer on right-click and via the keyboard's
Menu key or Shift+F10. Arrows move, Enter activates, Escape closes and restores focus.

## 11. Dialog and Sheet

Shared: `role="dialog"`, `aria-modal="true"`, labelled by its Title (`--text-16`,
`--weight-heading`, `--graphite-950`); Description `--text-13` `--graphite-600`. Tab and
Shift+Tab cycle inside while open; Escape closes; focus returns to the trigger. A close
IconButton sits top-right, `aria-label` “Close” (`primitives.dialog.close` /
`primitives.sheet.close`). Both sit at `z-index: var(--z-overlay)` above the scrim.

**Scrim** — the one theme-forked rule in primitives.css, because no single token is dark in
both themes: `background: var(--graphite-1000); opacity: 0.45` in light;
`[data-theme="dark"]` overrides to `background: var(--graphite-0); opacity: 0.6` (near-black in
both). Fades with its overlay's duration.

- **Dialog** (`data-testid="dialog-content"`): centred, width `min(480px, calc(100vw - var(--space-8)))`,
  overlay surface with `--radius-12`, `--shadow-4`, padding `--space-4`. Enters over 160 ms:
  fade + scale 0.98 → 1, `--motion-ease`.
- **Sheet** (`data-testid="sheet-content"`): side panel, default right (`side` prop), 420 px
  wide, full height, `--shadow-3`, hairline on its attached edge, padding `--space-4`. Slides
  from its side over `--motion-panel-duration` (240 ms), fading scrim alongside.

## 12. Toast

`<Toaster />` renders sonner inside a wrapper `div` carrying `data-testid="toast-region"` and
an accessible name “Notifications” (`primitives.toast.region`), fixed bottom-right at
`z-index: var(--z-toast)`, messages announced through an ARIA live region (`role="status"`).
Toast card: overlay surface, `--shadow-2`, width 360 px, `--text-13` `--graphite-900`; a
description line, when given, `--graphite-600`. Auto-dismisses after 5 s; hover pauses. Entry
slide + fade within the 120–200 ms band; reduced motion stills it. A toast is never the only
record of a refusal or an error (R-UI-020) — screens render those in place and may echo here.

## 13. Badge, Tag, Kbd, Progress, Skeleton, Separator

- **Badge:** 20 px tall, `--radius-4`, `--text-12` `--weight-body-medium`, padding
  `0 var(--space-2)`. Variants: neutral (default; fill `--graphite-100`, text `--graphite-700`),
  success/warn/danger/info (fill the `-surface` token, text the matching semantic foreground).
- **Tag:** 20 px, `--radius-4`, `--text-12`, background `--graphite-0`, border hairline
  `--graphite-200`, text `--graphite-700`. Optional `onRemove` renders a 16 px × button whose
  `aria-label` is “Remove” (`primitives.tag.remove`) followed by the tag's label.
- **Kbd:** `--font-mono` `--text-12`, 20 px tall, min-width 20 px, background `--graphite-100`,
  border `1px solid var(--graphite-300)`, `--radius-2`, text `--graphite-700`.
- **Progress:** determinate only (R-UI-010) — the caller states `value` against `max`
  (100 unless it says otherwise) and unknown progress is a Skeleton, never an endless bar.
  There is no indeterminate mode to reach for: a bar given no value stands at 0 and says so,
  and a value outside the bounds is clamped into them, so `role="progressbar"` always carries
  `aria-valuenow` with `aria-valuemin`/`aria-valuemax`. Track 4 px `--graphite-200`
  `--radius-2`; fill `--cobalt-500`, width transitioning over `--motion-state-duration`. A
  required accessible name.
- **Skeleton:** fill `--graphite-100`, `--radius-4`; the caller sizes it to the content it
  stands for, so layout never shifts (R-UI-004). Pulses opacity 1 → 0.55 over
  `--motion-panel-duration`, alternating; static under reduced motion. `aria-hidden` — the
  composing screen announces loading.
- **Separator:** 1 px `--graphite-200`, horizontal or vertical; decorative
  (`role="none"`) unless the consumer passes semantics.

## 14. Copy, verbatim

`src/ui/primitives/strings.ts` exports `PRIMITIVES_STRINGS`, frozen, keyed by id, typed exactly
as `src/ui/strings.ts` types its table (a derived key type; a missing key is a compile error).
Components read only this table; no string literal in JSX except test ids. The whole table:

| Key | Value |
|---|---|
| `primitives.combobox.loading` | Searching… |
| `primitives.combobox.empty` | No matches for this search. |
| `primitives.dialog.close` | Close |
| `primitives.sheet.close` | Close |
| `primitives.tag.remove` | Remove |
| `primitives.toast.region` | Notifications |

Calm, concrete, sentence case, no exclamation marks. Everything else a primitive shows —
labels, options, titles, toast messages — is the composing screen's copy, decided in that
screen's Design Decision.

## 15. Motion summary (R-UI-004)

| Where | Duration | Easing |
|---|---|---|
| Fills, checks, switch travel, tab underline, progress width | `--motion-state-duration` (160 ms) | `--motion-ease` |
| Tooltip, Popover, Select/menu content, Dialog, Toast entry | `--motion-state-duration` (160 ms) | `--motion-ease` |
| Sheet slide + its scrim | `--motion-panel-duration` (240 ms) | `--motion-ease` |
| Button busy bar (opacity, alternating) | `--motion-panel-duration` (240 ms) | `--motion-ease` |
| Skeleton pulse (opacity 1 → 0.55, alternating) | `--motion-panel-duration` (240 ms) | `--motion-ease` |

Every duration in this library is one of those three tokens, and no rule writes a number of its
own: R-UI-004 fixes 120–200 ms for a state change and 240 ms for a panel, so a looping
indicator borrows the panel duration rather than inventing a cadence nobody legislated.

Reduced motion: token durations zero via tokens.css; the two looping animations (busy bar,
Skeleton) and the five arrivals (overlay surface, tooltip, scrim, Dialog/Sheet, tab panel) are
stilled by an explicit primitives.css rule, because a zero-length `infinite` animation still
runs forever.
Nothing bounces; nothing slides further than 4 px except the Sheet.

## 16. Both themes

Every rule reads role-stable tokens, so the theme flip is the token sheet's (§16 of the sheet:
overlay surfaces stay `--graphite-0`, which is white chrome in light and near-black in dark;
hairlines and shadows carry elevation in both). The two deliberate inversions: Tooltip uses
`--graphite-950`/`--graphite-0` so it reads dark-on-light in light theme and light-on-dark in
dark; the scrim forks per §11 so it darkens the page in both themes. Primary/danger button text
`--graphite-0` stays legible in both because the accent values lighten in dark as the token
sheet fixes them.

## 17. Test hooks

No routes. Test ids introduced (the C-05 contract): `number-input-field`,
`number-input-suffix` (§4); `combobox-input`, `combobox-list`, `combobox-option`,
`combobox-empty` (§7); `dialog-content`, `sheet-content` (§11); `toast-region` (§12).

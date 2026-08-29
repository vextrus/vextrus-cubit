# Design Decision — density-and-prefs (the density section of workspace Settings)

Route: `/t/{tenant}/settings` (existing, shell inc-013) gains one section; the frame
(`AppShell`) gains `data-density` on `shell-root`. Increment inc-014-density-prefs. Law:
R-UI-001/003/004/005/012/020/050/060, Q-11, B-17. Every convention of the primitives-core
and shell Decisions binds: `cx-` classes, tokens-only colour and motion, `cx-reticle` solely
from its single home, no `[data-theme]` selector in authored CSS. Interpretations I-1–I-30
of the earlier Decisions remain in force ("workspace" is the user-facing word for tenant,
s-auth I-11). All copy lives in `src/ui/strings/shell.ts` (keys `shell_density_…`); JSX
carries no string literal beyond test ids and fixed attribute values. This file rules the
`cx-density-*` classes and the wiring that makes the stored mode the frame's one source of
truth; the `user_prefs` table and the SEAM-PREFS barrel are the increment's plumbing and
appear here only where they decide what renders.

## 0. Interpretations (recorded per the Law section of CLAUDE.md)

- **I-31 — no Radio primitive ships; DensityToggle is shell chrome with radiogroup
  semantics.** R-UI-010 lists Radio, but no primitives path is owned here and R-UI-011 bars
  an inventory built ahead of its consumer. `DensityToggle` (`src/ui/shell/density-toggle`)
  is therefore a self-contained shell component: a hand-rolled `role="radiogroup"` of two
  `role="radio"` buttons in the segmented-mode idiom ruled in §1. It is not a B-17 copy of
  anything shipped — core's Chip is an `aria-pressed` toggle and announces a press, not
  membership of an exclusive set — and a future form Radio (dot + label, one per line) shares
  neither its anatomy nor its CSS. Recorded IOU, owner: the increment that gives Radio a form
  consumer ships it in `src/ui/primitives/**` with its own Decision entry; nothing here
  migrates to it automatically.
- **I-32 — a section, not a screen.** The density control mounts on the settings screen the
  shell Decision already rules; `SHELL_STATES` (`src/ui/shell/states.ts`) is another node's
  file and its settings row stays true unchanged — the screen still cannot be empty (a
  density always answers: `densityFor` defaults to comfortable when no row exists), loading
  is still the shared `t/[tenant]/loading.tsx`, denial still precedes the frame. §2 rules
  the section's states in place and maps each onto the declared cells; no new row, no new
  enumerable home, no second matrix.
- **I-33 — instant apply, no saved notice.** The toggle is not a form: activating an option
  applies it. The checked option moving IS the answer, and radio semantics announce it
  (`aria-checked` flips on the activated option), so a "saved" sentence would restate what
  the control just reported — the rename form's notice exists because its save is deferred
  behind a submit, which this control does not have. Honesty is kept structurally: the
  toggle's initial `density` is the store's answer read server-side before paint (never a
  default that corrects itself after mount), and a write that fails surfaces the root error
  boundary, so a checked option that did not persist is never left standing.
- **I-34 — the action judges the mode before the seam does.** The server action's `density`
  argument is caller-writable, and the column's CHECK may never be the first judge — a
  forged value reaching it would fault as an unmarked 23514. `saveDensity`
  (`src/server/shell/density.ts`) resolves the signed-in user from the shell's viewer seam,
  refuses a value outside `DENSITIES` by throwing before any write (the root boundary
  answers it — no shipped control can send one, so no refusal surface is owed and none is in
  the contract), and a session that no longer resolves answers the `/sign-in` redirect — the
  same door the `(app)` layout guard uses, since this section has no refusal slot for a
  registered `SIGNED_OUT` rendering.
- **I-35 — one source of truth, converged by revalidation.** The workspace layout
  (`t/[tenant]/layout.tsx`) reads `densityFor(viewer.userId)` server-side and hands the mode
  down (`ShellFrame` → `AppShell` → `data-density` on `shell-root`); consumers never read
  the seam from the client. After `setDensity` succeeds the action revalidates the workspace
  layout, so the frame's `data-density` re-renders from the store in the same round trip.
  The toggle's own optimistic flip (I-33) and the store therefore converge without a reload;
  on this screen no DataTable mounts in M0, so the attribute is the only frame-visible
  change — table-bearing screens read the same stored mode when they arrive.

## 1. Layout and hierarchy

**The frame.** `AppShellProps` gains optional `density?: Density` (default
`'comfortable'`); `shell-root` carries `data-density={density}` — an attribute, no paint of
its own, no other frame change. Rail, top bar, breadcrumb, inspector: untouched.

**Settings page order.** `<h1>` `shell_settings_heading` · `var(--space-5)` · the workspace
name section (shell §1, unchanged — identity first) · `var(--space-6)` · the density
section (preference second). The page passes `density` (the layout's stored answer) and the
`saveDensity` action to `DensityToggle`; nothing else on the page changes.

**DensityToggle** (`src/ui/shell/density-toggle`, exported from the `src/ui/shell` barrel,
client component, props exactly `{ density: Density; action: (density: Density) =>
Promise<void> }`). Renders `<section class="cx-density">`: column flex, max-width 380 px
(the name section's measure — the two settings blocks read as one column), gap
`var(--space-1)`. Inside, in order:

- **Label** — `<span class="cx-density-label" id>` `shell_density_label`, `var(--text-13)`
  `var(--weight-body-medium)` `var(--graphite-700)` (the name label's style).
- **Hint** — `<p class="cx-density-hint" id>` `shell_density_hint`, `var(--text-12)`
  `var(--graphite-600)`, margin 0, `text-wrap: pretty` (the name hint's style).
- **Group** — `<div role="radiogroup" data-testid="density-toggle"
  aria-labelledby={label id} aria-describedby={hint id} class="cx-density-group">`,
  margin-top `var(--space-2)`: inline-flex row, `align-self: start`, padding
  `var(--space-1)`, gap `var(--space-1)`, fill `var(--graphite-0)`, border 1 px solid
  `var(--graphite-300)` (the Input's control border), radius `var(--radius-4)`. The 4 px
  padding is load-bearing: an option's focus reticle draws 4 px outside its box (R-UI-012)
  and lands inside the group's border instead of clipping.
- **Options** — two `<button type="button" role="radio" aria-checked
  data-testid="density-option-comfortable" | "density-option-compact"
  class="cx-density-option cx-reticle">`, labels `shell_density_comfortable` /
  `shell_density_compact`, in that fixed order (comfortable first — the default reads
  first). Height `var(--space-6)`, padding-inline `var(--space-3)`, radius
  `var(--radius-2)`, `var(--text-13)` `var(--weight-body-medium)`, no border of their own.
  Unchecked: no fill, text `var(--graphite-700)`; hover fill `var(--graphite-100)`, text
  `var(--graphite-900)`. Checked (`aria-checked="true"`): fill `var(--beam-100)`, text
  `var(--graphite-900)` at `var(--weight-heading)` — the R-UI-030 selection idiom's fill
  with the weight shift as the non-colour second channel (core Chip's ruling), so the
  checked segment survives greyscale. These are not core Buttons and carry no `cx-btn`
  (no primitive is being restyled and no specificity fight arises).

**Behaviour.** The component mirrors `density` into local state on mount. Activating the
unchecked option (click, or Space/Enter while focused) flips the local state — the checked
fill, weight and `aria-checked` move at once — and calls `action` exactly once with the
newly chosen mode; activating the already-checked option does nothing and calls nothing.
Roving tabindex per the radiogroup pattern: the checked option is the group's one tab stop
(`tabIndex` 0 / −1); ArrowRight/ArrowDown and ArrowLeft/ArrowUp move focus to the other
option and select it (selection follows focus — with two members every arrow lands on the
other one), invoking `action` the same single time. While the action is in flight the group
carries `aria-busy="true"`; the options stay enabled and focusable — a retry is never
disarmed and focus is never dropped (the shell's rename ruling). No spinner, no layout
shift. On success the revalidated frame confirms the same mode (I-35); on failure the root
boundary takes the screen (I-33).

## 2. States (R-UI-050), ruled in place (I-32)

- **Loading** — delegated: the shared `t/[tenant]/loading.tsx` keeps the page's layout in
  `shell-main`, frame intact. The section itself never loads client-side: `densityFor` is
  read in the layout before paint, so the toggle first renders already holding the stored
  mode — no flash of the default, no skeleton of its own. In-flight writes are `aria-busy`
  on the group (§1), never a spinner.
- **Empty** — impossible: a density always answers; `densityFor` resolves `'comfortable'`
  when no `user_prefs` row exists, so there is nothing to teach and no empty surface.
- **Error** — a failed write or a forged mode (I-34) surfaces the root error boundary
  (`src/app/error.tsx`, unowned here); its Decision rules retry and records the report-id
  deferral. No half-state remains on screen (I-33).
- **Refusal** — none is reachable and none renders: the control offers exactly the two
  lawful modes, no `RefusalCode` is registered for this write, and the settings answer
  slot belongs to the rename form alone. The action's judgements are I-34's.
- **Partial** — impossible: no refusable rows; one value, whole.
- **Offline** — a fault of reachability (shell I-20): the action cannot reach the server,
  the error path answers honestly; no invented banner, and the section holds no data that
  ages.
- **Permission-denied** — delegated: `t/[tenant]/layout.tsx` renders the frameless denial
  before this route mounts. Density is per-user, not per-workspace, so no finer permission
  exists to name; a lapsed session mid-action is I-34's `/sign-in` redirect.

## 3. Copy, verbatim (`src/ui/strings/shell.ts`, keys added)

`shell_density_label` **Table density** · `shell_density_comfortable` **Comfortable** ·
`shell_density_compact` **Compact** · `shell_density_hint` **Sets the row height of every
table. Saved to your account, so it applies wherever you sign in.**

Voice: calm, concrete, no exclamation marks, no build vocabulary — the hint says what the
setting does and where it holds, not how it is stored. Option labels are the plain mode
names; the seam values (`comfortable`, `compact`) are never rendered raw.

## 4. Motion (R-UI-004)

Option hover and checked fill/colour transition over `var(--motion-state)` `var(--ease)`;
the weight shift is instant (weight does not tween). The reticle draw belongs to its single
home. The checked state moving between segments is a colour swap, not a sliding thumb —
nothing travels, so nothing needs a reduced-motion variant beyond the tokens zeroing every
duration at source. No entrance for the section; answers arrive instantly.

## 5. Tokens

`--graphite-0/100/300/600/700/900` · `--beam-100` (checked fill; `--beam-500` reaches the
options only through the reticle's single home) · `--space-1/2/3/5/6` · `--radius-2/4` ·
`--text-12/13` · `--weight-body-medium/--weight-heading` · `--motion-state/--ease`. The row
heights themselves — `--row-comfortable` 36 px / `--row-compact` 28 px — are what the
stored mode selects in table consumers (R-UI-005) and paint nothing on this screen. Px
literals, closed set (core I-1's class): the 380 px section measure and the group's 1 px
border. Any other literal is a defect.

## 6. Themes

No `[data-theme]` selector in `shell.css`'s new rules; every light/dark difference arrives
through token values (R-UI-001). Contrast holds on founder facts in both themes:
graphite-700 and 600 on graphite-0 ≥ 4.5:1, graphite-900 on beam-100 ≥ 4.5:1 (the shell's
selection pairing), graphite-300 border and the beam-500 reticle ≥ 3:1 as UI. No basis
colour, no semantic tint, no copper — a preference write is a plain write, not an act.

## 7. Test hooks (closed contract, C-05)

Routes introduced: none — the section mounts on the existing `/t/{tenant}/settings`, and
`/t/{tenant}` carries the frame that publishes the mode. Test ids, exactly the three of the
contract, on the elements ruled in §1: `density-toggle` (the radiogroup) ·
`density-option-comfortable` · `density-option-compact`. `shell-root` and `datatable` exist
already; no other id is added.

Behavioural hooks without new ids: `data-density` on `shell-root` (the frame's published
mode) and on `datatable` (primitives-data's existing contract — asserted in this
increment's jsdom suite with `DENSITIES` members only, no DB from a UI test, and no product
DataTable screen ships); `aria-checked` on each option, `aria-busy` on the in-flight group,
`aria-labelledby`/`aria-describedby` naming the group from the strings table's values
(asserted via the `strings` import, never a spelled literal); the roving `tabIndex` pair;
`cx-reticle` on both options. At compile time the toggle's `Density` prop, the seam's
`Density` and `DataTableDensity` are mutually assignable with no suppression — expressed as
type-level `Expect<Assignable<…>>` pairs in a `.ts` acceptance file, both directions.

Suites: `tests/ui/density-prefs/**` under jsdom (`@testing-library/react` +
`user-event`) cover §1's behaviour — checked rendering, single `action` call with the other
mode, keyboard operation, the no-op on the checked option; `db/__tests__/*density*` proves
the seam's answers through the barrel over a scratch database. No new journey — the
J-000/J-001 roster is frozen, no `toHaveScreenshot` names settings, and the comfortable
default leaves every committed baseline's pixels unchanged; the page object
`tests/e2e/pages/shell.page.ts` may gain a settings-section helper for later journeys.
Axe: the settings checkpoints in the shipped shell spec already run axe on this page, so
the section ships with serious/critical = 0 by construction (Q-11, R-UI-012).

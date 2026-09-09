# Design Decision — S-Viewer's snapping (toolbar, glyph overlay, two status cells)

The fifth region of S-Viewer, not a route of its own: a three-toggle **snap toolbar** on the stage, a
DOM **snap glyph** on the stage's overlay stack, the **pick marks** and band that follow it, and two
new cells in the sheet's readout. Route unchanged
(`/t/{tenant}/p/{project}/viewer/{drawing}/{layout}`, `?v=`, `?s=`); the feed gains
`?part=calibration`. Files: `src/modules/takeoff/viewer-snap/{snap.ts,server.ts,scene.ts,
use-snap.ts,types.ts}` (pure math, the server read, the scene and the hook — no JSX, no copy), the
route's `snap-region.tsx` (this region's whole markup), `viewer-stage.tsx`, `viewer-screen.tsx`,
`status-line.tsx`, `states.ts`, `viewer.css` and the stylesheet `viewer-snap.css` beside it; the
inherited `viewer/hooks/{use-pointer.ts,use-keyboard.ts}`; copy home `src/ui/strings/viewer-snap.ts`.
Increment inc-206-snapping. Law: R-TO-012, R-UI-041, R-UI-032, R-UI-001/003/004/005/012/020/030/
031/050/060, L-REG-04, L-MEA-05, J-020, ARCH-01, B-17, B-19, B-20, C-05, Q-11.

Every convention of the earlier Decisions binds: `cx-` classes, variants on data-attributes,
tokens-only colour and motion, `cx-reticle` solely from `src/ui/primitives/core/reticle.css`, no
`[data-theme]` selector in authored CSS, copy by key from a strings table (s-settings-ruleset I-24),
model values verbatim in mono (I-25), identifiers whole (I-26). `s-viewer.md` rules the canvas, the
layers panel, the readout's other cells and the one refusal; `s-viewer-inspector.md` rules selection,
the marquee and the fly-to; `s-viewer-partition.md` rules the left stack and the overlay canvas.
I-77–I-144 stand. Chrome comes only from shipped primitives — core Button, the one RefusalState —
plus the `cx-viewer-snap-*` classes ruled here. This Decision strikes the **snap** third of
s-viewer.md §8's toolbar IOU and the **snap half** of s-viewer-inspector.md §8's `viewer_canvas_keys`
IOU in the commit that lands it (B-20); select/pan/measure/count/linear/area/split/overlay stand.

## 0. Interpretations (numbering continues the highest recorded, command-palette's I-144; the spec's letters in brackets)

- **I-145 [I-A] — a pick is Alt+click, and Enter is its equal.** A pick is taken by Alt+click on
  `viewer-canvas` or by Enter while the canvas holds focus — two spellings of one gesture, so the
  readout is reachable with no pointer (R-UI-060). Rejected: plain click, Shift+click and the
  marquee, which are selection under J-011 and J-000 and whose behaviour this leaf leaves untouched
  byte for byte. Escape is **one** press doing two things in order: it clears the picks, then lets go
  of the selection exactly as before (AC-3) — a reader who presses Escape wants the canvas quiet, and
  making them press twice to reach a behaviour that already existed would be a regression dressed as
  a feature.
- **I-146 [I-B] — two factors are two factors.** Metres between two picks under a calibration of
  record is `√((Δx·factorX)² + (Δy·factorY)²)`, computed with decimal.js over the stored 12-place
  strings and rendered to 3 decimals. Rejected: averaging the pair, which L-MEA-05 forbids outright.
  The metre figure renders only when **both** picks stand inside one calibrated view's box, beside and
  never instead of the drawing-unit figure (R-UI-041: drawing units always, SI when calibrated). At
  `data-picks` of 0 or 1 the cell reads `data-si="uncalibrated"` — the second point is a hover, not a
  point of record, and naming a factor for a point nobody has placed would publish a measurement
  nobody took.
- **I-147 [I-C] — priority, not proximity.** Within tolerance the winner is the fixed order
  endpoint > intersection > midpoint > perpendicular > grid > nearest; tolerance is
  `SNAP_TOLERANCE_PX` (8) divided by the camera's pixels-per-unit, so it is 8 px of the reader's
  screen expressed in drawing units at every zoom. Rejected: nearest-distance-wins, which at a vertex
  flickers the glyph between endpoint and nearest as the hand trembles — a snap that changes its mind
  is worse than no snap.
- **I-148 [I-D] — snapping starts on; the two constraints are exclusive and answer to pick 1 only.**
  Every mount opens with Snap pressed, Ortho and Angle lock released (persistence is an IOU, §8).
  Ortho and 15° angle lock apply to the hover point relative to pick 1 and to nothing else: with no
  pick standing there is no anchor, so both are inert and say nothing false. Pressing one releases the
  other — two constraints on one segment would be one constraint with a hidden winner.
- **I-149 [I-E] — the grid the screen already holds is the grid it snaps to.** Grid intersections are
  paired from the partition overlay's own `GridAxisRow`s (`position`, `bubbleKey`), every `axis:"x"`
  with every `axis:"y"` **of the same `viewKey`** and never across views, sourced by the two bubble
  keys. No second read of the grid store, and a sheet with no partition simply offers no grid
  candidates — an absence, not a fault.
- **I-150 [I-F] — the calibration arrives as a part of the sheet's own feed.**
  `?part=calibration` mirrors `?part=partition`: asked for once after the head answers so first paint
  is never delayed (R-UI-043), read by `snapCalibrationsOfSheet` from `partitionOverlayOfSheet` +
  `affirmationsOfRecord`, answering exactly the views with a box on this layout **and** an
  affirmation of record, and `null` for a drawing nothing has partitioned. Its 401/403 are the layer
  feed's own, rendered in the one place s-viewer §2 puts them: one door, one session.
- **I-151 [I-G] — the module is math, the route is markup, so nothing is mirrored.** `viewer-snap/**`
  holds no JSX and no sentence; every element and every string of this region lives in the route's
  `snap-region.tsx` and `status-line.tsx`, which may read `src/ui/strings` directly. The copy-mirror
  debt that `viewer-inspector/copy.ts` and `viewer-partition-overlay/copy.ts` carry (I-113) is
  therefore not joined by a third, and `use-snap.ts` answers data the route renders.

**Recorded Objection (ownership).** §3's copy must reach the one string table, so this increment also
needs `src/ui/strings/viewer-snap.ts`, its two import-and-spread lines in `src/ui/strings/index.ts`,
and the one re-worded line of `src/ui/strings/viewer.ts` (`viewer_canvas_keys`, which R-UI-060 makes
the canvas's own description of the keys it answers and which B-20 makes this increment's to
re-baseline). The ownership list names none of the three. Nothing else is claimed; if a hook denies
them the Builder raises this Objection and stops rather than inventing a second string home.

## 1. Layout and hierarchy

The stage still dominates and nothing of the sheet moves: this region adds one small card to the
stage's free corner, marks on the overlay stack, and two cells to a readout that was already there.
Density (R-UI-005) governs rows of data; a three-button card and the fixed-height readout stand at
the same size in both modes (the palette's I-144 class).

```
<div class="cx-viewer-stage">
  <canvas data-testid="viewer-canvas">                       ← s-viewer's, unmoved
  {partition.canvas}                                         ← s-viewer-partition's, unmoved
  <div class="cx-viewer-snap-overlay" aria-hidden="true">     ← pointer-events: none, no test id
      <div data-testid="viewer-snap-pick" data-index="1">     ← 0–2 marks
      <div class="cx-viewer-snap-band">                       ← pick 1 → the live point
      <div data-testid="viewer-snap-glyph">                   ← 0 or exactly 1
  {marquee}  <div class="cx-viewer-controls">                  ← unmoved (stage top-right)
  <div class="cx-viewer-snap-tools" role="group">             ← stage top-left
  <p role="status" aria-live="polite" class="cx-viewer-hidden">← the pick announcement
</div>
```

**Toolbar** (`cx-viewer-snap-tools`) — absolutely positioned at the stage's top-**left**, inset
`var(--space-3)`, row flex `gap: var(--space-2)`, on the zoom controls' card exactly: fill
`var(--graphite-0)`, padding `var(--space-1)`, radius `var(--radius-4)`, border `var(--hairline)`,
`box-shadow: var(--shadow-1)`, `z-index: var(--z-base)`. It is a `role="group"` labelled
`viewer_snap_tools_label`, holding three core **secondary** Buttons, in this document and tab order:

| test id | copy | pressed at mount |
| --- | --- | --- |
| `viewer-snap-toggle` | `viewer_snap_toggle` | `true` |
| `viewer-snap-ortho` | `viewer_snap_ortho` | `false` |
| `viewer-snap-angle` | `viewer_snap_angle` | `false` |

Each is `<button type="button" class="cx-btn cx-reticle" data-variant="secondary" aria-pressed>`
holding a 10 px square swatch (`aria-hidden`, radius `var(--radius-2)`, 1 px `var(--canvas-snap)`
border, **filled** with that colour when pressed and hollow when not — the second, non-colour channel
the partition switches already use) then its visible word; the word is the accessible name, so no
`aria-label` is written (WCAG 2.5.3). Pressed paint is the house selection idiom: fill
`var(--beam-100)`, text `var(--graphite-900)` at `var(--weight-heading)`. `viewer-snap-toggle` also
carries `aria-keyshortcuts` built from `shortcutById("viewer-snap").keys.join(" ")` — the roster's own
spelling, never a second one — and draws no keycap (I-140: a chord is drawn only after a gesture).

**Glyph** — at most one `<div data-testid="viewer-snap-glyph" data-kind data-source data-motion>` in
the overlay, positioned at the snapped point by a `translate` written **straight onto the element** as
the pointer moves (the marquee's precedent: sixty renders a second of panel and readout is what a
hover must not cost, PB-3); its attributes are React state and change only when the resolved snap's
kind or source keys change, so sliding along one edge costs no re-render. The **shape names the kind**
(AC-2, R-UI-060) — a 12 px box with 2 px strokes in `var(--canvas-snap)`, built from the box and its
`::before`/`::after`, each selected by `[data-kind]` in `viewer-snap.css`:

- `endpoint` — a 12 px **square**, 2 px border, no radius.
- `midpoint` — a 14 × 12 px **triangle** pointing up (`clip-path` polygon, 2 px inner cut).
- `intersection` — an **✕**: two 14 × 2 px bars at +45° and −45°.
- `perpendicular` — a **⊥**: a 12 × 2 px base with a 2 × 10 px stem rising from its centre.
- `grid` — a 12 px **circle** (`border-radius: 50%`, 2 px) crossed by an 18 × 2 px horizontal and a
  2 × 18 px vertical tick — the bubble-and-centre-line idiom the sheet's own overlay draws.
- `nearest` — an **hourglass**: two 12 × 6 px triangles meeting apex to apex.

Each carries a 1 px `var(--canvas-paper)` outer halo so it reads over inked geometry in both themes.
`data-source` is the snap's `sourceKeys` joined by one space (two keys for an intersection and for a
grid intersection, one otherwise); `data-motion` is `full` or `reduced` as
`matchMedia("(prefers-reduced-motion: reduce)")` reads at mount and on change.

**Picks and band** — `<div data-testid="viewer-snap-pick" data-index data-source data-key-x
data-key-y>`: a 14 px upright **✛** (a 14 × 2 px and a 2 × 14 px bar) in `var(--canvas-snap)` with the
same 1 px paper halo — a shape no snap kind wears, so a taken pick is never read as a live snap.
While pick 1 stands and the pointer is over the stage, `cx-viewer-snap-band` draws from pick 1 to the
live (constrained) point: a 1 px dashed `var(--canvas-snap)` `border-block-start`, `width` the
length in px, `transform: rotate()` about `0 50%`, untweened, with the live point's own ✛ as its
`::after`. It carries no test id — the contract is closed (the partition answer slot's precedent) —
and it is what makes Ortho and Angle lock visible on the sheet rather than only in the readout.

**Status cells** (`status-line.tsx`, in the existing `cx-viewer-readout-cell` chrome, after
`viewer-status-selection` and before the partial notice, rendered exactly when the other sheet cells
are):

- `<span data-testid="viewer-status-snap" aria-live="off" data-enabled data-kind data-source
  data-key-x data-key-y>` — label `viewer_status_snap` in `var(--graphite-600)`, then the value in
  `var(--graphite-700)`: the kind's own word (`viewer_snap_kind_endpoint` … `_nearest`), then each
  source key **whole** in its own `<span>` at `user-select: all` (I-26), `gap: var(--space-2)`. At
  `data-kind="none"` the value is `viewer_status_snap_none`; with snapping off, `data-enabled="false"`,
  `data-kind="off"`, value `viewer_status_snap_off`, and no glyph mounts at all.
- `<span data-testid="viewer-status-distance" aria-live="off" data-picks data-dx data-dy data-si
  data-view-key>` — label `viewer_status_distance`, then at `data-picks="0"`
  `viewer_status_distance_none`; otherwise `viewer_status_distance_units` filled with
  `formatUserFigure(distanceBetween(…).toFixed(1))`, followed at `data-si="calibrated"` by
  `viewer_status_distance_metres` filled with `formatUserFigure(metresBetween(…))` and at
  `data-si="uncalibrated"` with two picks standing by `viewer_status_distance_uncalibrated` in
  `var(--graphite-600)` — an empty cell would be the silence R-UI-020 forbids. `data-dx`/`data-dy` are
  hover-minus-pick-1 in drawing units at **six** decimals with trailing zeros dropped, so an
  ortho-constrained axis reads exactly `0`; `data-view-key` is present only at `data-si="calibrated"`.
  Six rather than three because these two attributes are the only published reading of the angle
  lock's direction, and AC-3 asks that direction to be a whole number of 15° steps to within 1e-6: at
  the reach the acceptance measures at (r ≈ 67 drawing units) three decimals leaves about 1.6e-5 of a
  step, which would fail a constraint the code applies exactly. Rounding a published figure below the
  precision of the check that reads it is the defect, not the sixth decimal.

Both cells are `aria-live="off"` inside the readout's polite region: a pointer-driven figure would
otherwise be announced sixty times a second. The accessible path to the same facts is the explicit
one — the visually hidden `role="status"` line at the stage's foot speaks `viewer_snap_pick_taken` on
each pick (followed, on the second, by the same distance sentences the cell renders) and
`viewer_snap_picks_cleared` on Escape: at most three utterances per measurement, no test id, found by
role and text.

**Gestures** (inherited hooks). `use-pointer.ts`: a pointer move resolves the snap and writes the
glyph; a `pointerdown` carrying `altKey` takes a pick and returns — it never enters the select, pan or
marquee path, so plain click, Shift+click and the marquee behave exactly as before. `use-keyboard.ts`:
`matchesStep(event, shortcutById("viewer-snap").keys[0])` with the canvas focused and
`isTextField(target)` false flips snapping (the roster's reading of the step is the roster's, Shift
admitted and Alt refused, and is not re-decided here); Enter takes a pick; Escape clears picks then
the selection (I-145). Taking a pick writes nothing to the address: `v` and `s` are untouched.

## 2. States (R-UI-050)

`VIEWER_STATES` in the route's `states.ts` stays the one enumerable home the suite reflects over
(B-17, B-19); this region adds no second matrix, and its cells are declared there as the snap rows.

- **Loading** — no bone of its own. The toolbar is local state rather than data and mounts with the
  stage, operable at once (the partition switches' precedent); while geometry streams the two cells
  stand honestly at `data-kind="none"` and `data-picks="0"` — snapping is on and nothing is in reach
  yet. No spinner anywhere (R-UI-004).
- **Empty** — the sheet's two empty truths (`not-ingested`, `layout-unknown`) mount no stage, so no
  toolbar, no overlay and no snap cells render. Nothing is placeheld (s-viewer's own rule); the action
  is the empty state's existing one.
- **Error** — the root error boundary, for a head that cannot be read. A calibration read that fails
  is the partial cell below, not this one: it costs the reader metres, never the sheet.
- **Refusal** — `?part=calibration`'s `SIGNED_OUT` (401) and `WORKSPACE_PERMISSION_NOT_HELD` (403)
  render through the one RefusalState in the sheet's place, evidence `/sign-in` and the workspace
  home, exactly where the layer feed's do (I-150). No screen-local refusal block exists (R-UI-020,
  B-17), and no new code is minted.
- **Partial** — two, both rendered. A calibration the feed could not answer leaves the drawing-unit
  figure standing, `data-si="uncalibrated"`, and adds `viewer_status_calibration_unread` to the
  distance cell: the readout holds no control, so the sentence names the move. Two picks in different
  views, in a view with no box on this layout, or in a view nothing has affirmed read
  `data-si="uncalibrated"` with `viewer_status_distance_uncalibrated` — shown, not hidden.
- **Offline** — no banner: snapping, picking and both readouts are wholly local and this region writes
  nothing (shell I-20, s-viewer §2). A calibration that never arrives is the partial cell.
- **Permission-denied** — delegated as s-viewer rules it: the workspace guard in
  `t/[tenant]/layout.tsx` before the route mounts. No permission gates snapping or picking on a sheet
  a reader already holds — they originate no row and no quantity — and the feed's 403 renders as above.

## 3. Copy, verbatim (`src/ui/strings/viewer-snap.ts`, registry append)

`viewer_snap_tools_label` **Snapping** · `viewer_snap_toggle` **Snap** · `viewer_snap_ortho`
**Ortho** · `viewer_snap_angle` **Angle lock** · `viewer_snap_kind_endpoint` **Endpoint** ·
`viewer_snap_kind_midpoint` **Midpoint** · `viewer_snap_kind_intersection` **Intersection** ·
`viewer_snap_kind_perpendicular` **Perpendicular** · `viewer_snap_kind_grid` **Grid intersection** ·
`viewer_snap_kind_nearest` **Nearest point** · `viewer_status_snap` **Snap** ·
`viewer_status_snap_none` **Nothing in reach** · `viewer_status_snap_off` **Off** ·
`viewer_status_distance` **Distance** · `viewer_status_distance_none` **No picks** ·
`viewer_status_distance_units` **{distance} drawing units** · `viewer_status_distance_metres`
**{metres} m** · `viewer_status_distance_uncalibrated` **No affirmed scale here** ·
`viewer_status_calibration_unread` **The affirmed scale could not be read; reload the sheet.** ·
`viewer_snap_pick_taken` **Pick {index} at {x}, {y} drawing units.** · `viewer_snap_picks_cleared`
**Picks cleared.**

One line of `src/ui/strings/viewer.ts` was to be re-worded, paying the snap half of the
`viewer_canvas_keys` IOU (B-20): `viewer_canvas_keys` **Drag to pan, scroll to zoom. Plus and minus
zoom, the arrow keys pan, and F fits the sheet. S turns snapping on and off. Hold Alt and click, or
press Enter, to take a pick; Escape clears the picks and the selection.**

**As built, that re-word is refused.** `src/ui/strings/viewer.ts` is another module's table and the
lock does not yield to this increment (R-SPINE-060: a region adds its keys in its own file, never in
its neighbour's). The snap half is therefore carried by this region's own line, appended to the same
`<p id="cx-viewer-keys">` the canvas is described by — one sentence to a reader, one table to each
module: `viewer_snap_canvas_keys` **S turns snapping on and off, Enter takes a pick where the pointer
stands, and Escape lets go of the picks.** The reader hears exactly what §3 promised; the IOU on
`viewer.ts` stands open for whoever owns that table. Recorded as a plan question in the handoff.

The feed's 400 sentence grows to name the new part — *a sheet is asked for as ?part=head,
?part=layer&index=&lt;n&gt;, ?part=partition or ?part=calibration* — which is a caller's answer inside
a JSON body, not reader copy, and so lives in `route.ts` as its siblings do.

Voice: calm, concrete, professional; no exclamation marks; no build vocabulary — "candidate",
"lattice", "quantise", "worker", "feed", "scene" and every clause id appear nowhere a reader can see.
"Snap", "ortho", "angle lock", "endpoint" and "drawing units" are the drawing office's own words and
are used as such. Source keys, figures and view keys are model data and render verbatim in mono as
data, never woven into a sentence.

## 4. Motion (R-UI-004)

The glyph **draws in** over `var(--motion-reticle)` (120 ms) on `var(--ease)` — opacity 0 → 1 and
`scale(0.6)` → 1 — expressed as a transition whose start is an `@starting-style` block, so the element
mounts in its final state and is **present in the frame it is asked for** whatever the duration.
Moving an existing glyph is untweened: it follows the hand. The pick marks and the band are untweened
for the same reason a drawing is — a mark that eases to a point a reader chose would read as doubt
about which point they chose. The toolbar's fill, text and swatch change over `var(--motion-state)`
`var(--ease)`; the reticle draws in its single home. No bounce, no spinner. Every duration is a token
zeroed at source under reduced motion, so `viewer-snap.css` carries no `prefers-reduced-motion`
branch: at 0 the computed `transition-duration` is `0s`, the glyph simply appears, and `data-motion`
publishes the same reading for a journey to grade.

## 5. Tokens

`--canvas-snap` (the glyph, the pick ✛, the band, the toolbar swatch) · `--canvas-paper` (the 1 px
halo under every mark) · `--graphite-0/600/700/900` · `--beam-100` (the pressed toggle; `--beam-500`
reaches this region only through the reticle's single home) · `--hairline` · `--space-1/2/3` ·
`--radius-2/4` · `--text-12` · `--font-mono` · `--weight-heading` · `--motion-reticle` /
`--motion-state` / `--ease` · `--shadow-1` · `--z-base`. Px literals, closed set (core I-1's mandated
class): the 10 px toolbar swatch; the glyph's 12 px box, 2 px strokes, the 14 px ✕ and ✛ spans, the
18 px grid ticks and the 12 × 6 px hourglass halves; the 1 px band and halo. Two numbers are code
constants rather than CSS and are exported by name so no surface transcribes them: `SNAP_TOLERANCE_PX
= 8` and `ANGLE_STEP_DEG = 15`; two more are the lattice's and the readouts' precision — `quantise`'s
own 0.1 drawing unit (consumed from `src/core/identity/keys`, never redefined), 1 decimal for drawing
units, 3 for metres and 6 for `data-dx`/`data-dy` (§ 1's ruling: the offsets carry the angle lock's
direction, which is read back to within 1e-6). Any other literal is a defect. No copper and no
basis colour appears: a snap is a read, and a pick here originates no quantity and no register row.

## 6. Themes

`viewer-snap.css` contains no `[data-theme]` selector; every light/dark difference arrives through
token values (R-UI-001). Because the glyph, the picks and the band are **DOM** nodes rather than paint
(I-G's dividend), `--canvas-snap` `#1D7A46`/`#4CC38A` and `--canvas-paper` flip with the document's
`data-theme` on their own: this region adds nothing to the screen's `MutationObserver` and re-reads no
palette. Contrast on the founder values in both themes: canvas-snap over canvas-paper clears the
3:1 UI floor as a 2 px mark with a paper halo; graphite-600 labels and graphite-700 values on
graphite-0 clear 4.5:1; graphite-900 on the beam-100 pressed toggle clears 4.5:1. Nothing is
colour-only — the kind is a shape **and** a word in the readout, and a pressed toggle is a filled
swatch and a weight shift as well as a fill.

## 7. Test hooks (closed contract, C-05)

Routes: `/t/{tenant}/p/{project}/viewer/{drawing}/{layout}` unchanged, and the feed gains
`/api/viewer/{drawing}/{layout}?tenant={tenant}&part=calibration` → 200
`{ calibration: { ingestId, views: [{ viewKey, box, factorX, factorY }] } | null }`, with
`?part=partition`'s own 401/403. Test ids added, exactly the contract's eight (the last two being
attributes on ids s-viewer already owns): `viewer-snap-toggle` · `viewer-snap-ortho` ·
`viewer-snap-angle` · `viewer-snap-glyph` · `viewer-snap-pick` · `viewer-status-snap` ·
`viewer-status-distance`, inside `viewer-canvas` / `viewer-status` / `viewer-screen`. No other id is
added: the toolbar group, the band, the overlay and the pick announcement are found by role, class and
text.

Behavioural hooks: `aria-pressed` on the three toggles and `aria-keyshortcuts` on `viewer-snap-toggle`;
`data-kind` ∈ `endpoint|midpoint|intersection|perpendicular|grid|nearest`, `data-source` (space-joined
`sourceKeys`) and `data-motion` ∈ `full|reduced` on the glyph; `data-index` ∈ `1|2`, `data-source`,
`data-key-x`, `data-key-y` on each pick; `data-enabled`, `data-kind` (the six, plus `none` and `off`),
`data-source`, `data-key-x`, `data-key-y` on `viewer-status-snap`; `data-picks` ∈ `0|1|2`, `data-dx`,
`data-dy`, `data-si` ∈ `calibrated|uncalibrated`, `data-view-key` on `viewer-status-distance`;
`aria-live="off"` on both cells and `aria-hidden="true"` with computed `pointer-events: none` on the
overlay; `cx-reticle` on all three toggles; and the untouched neighbours — `viewer-status`'s
`data-selection` and `data-scale` and the address's `v` and `s`, read before and after a pick and a
toggle and identical.

Suites: `tests/takeoff/viewer-snap/snap.test.ts` over `snap.ts` (AC-1: the six kinds, the priority
ladder at a shared vertex, tolerance in drawing units, perpendicular only with a first pick, grid
pairing within a `viewKey` and never across, `constrainOrtho`, `constrainAngle`, `distanceBetween`,
`metresBetween`, `keyPoint` through `quantise`) over geometry in
`tests/takeoff/viewer-snap/support/**`; `calibration-door.test.ts` (AC-4, the `test:db` lane, staged
through `tests/takeoff/scale/support/scale-stage.ts`); `snap-readout.test.tsx` (jsdom, a supplied
calibration answer); jsdom mounts of `ViewerScreen` over a supplied head for AC-2/AC-3 in
`tests/takeoff/viewer/viewer-screen.test.tsx`, with `use-pointer` and `use-keyboard` tested beside
themselves. Journey `tests/e2e/journeys/j-020-snapping.spec.ts` (titles carrying **J-020**, page
object `tests/e2e/viewer/s-viewer-snap.page.ts` beside `s-viewer.page.ts`, staged on the synthetic
sheet) at checkpoints **j-020-snap-glyph** and **j-020-snap-readout**, axe serious/critical = 0 at
each, never widened. **No pixel baseline of this region is shipped, and none is promised here.** The
two this section first asked for — `tests/e2e/baselines/design/viewer-snap/toolbar-light.png` and
`toolbar-dark.png`, the `cx-viewer-snap-tools` card alone, DOM and deterministic, never the canvas,
the glyph or the band, because a live sheet is not a pixel baseline (s-viewer §7) — are **owed, not
taken**: a picture exists only where a spec asserts it with `toHaveScreenshot`, as the sibling
region's are by `tests/e2e/viewer-partition.spec.ts`, and `tests/e2e/**` is the Verifier's locked
ground. This increment's ownership grants the directory the two pictures would land in and no spec to
take them, and a build session never writes a picture by hand (the gate takes them, from an assertion
that already stands). So the toolbar's light and dark paint (§6) is ruled here and asserted by nothing
in this branch; that is recorded as an IOU in §8 with its owner rather than left standing as a promise
this Decision cannot keep. A journey checkpoint is not the missing assertion: `checkpoint()` attaches
a screenshot to the report for a reader, and compares it against nothing.
`src/app/api/viewer/__tests__/viewer-route-index.test.ts` is re-baselined for the widened part list in
its own commit naming the run (B-20). The partition baselines capture the left column only and the
toolbar stands in the stage, so `viewer-partition/panel-*.png` do not move and are not re-blessed;
J-000, J-011 and PERF-011 capture no part of this region and are untouched.

## 8. Recorded IOUs (owner named, never a comment in `src/`)

The two toolbar baselines and the spec that would take them — owner: whoever is granted
`tests/e2e/viewer-snap.spec.ts`, which is the Verifier or an increment whose ownership names that
path. Modelled on `tests/e2e/viewer-partition.spec.ts`, it stages the synthetic sheet and asserts the
`cx-viewer-snap-tools` card in both themes; the gate then takes `viewer-snap/toolbar-light.png` and
`toolbar-dark.png` under a `baseline:` commit. Until it exists, §6's contrast readings for this
toolbar stand on this Decision's word and on the tokens themselves, and no picture would notice their
drifting. Persisting Snap, Ortho and Angle lock across mounts — owner: the prefs seam's node
(s-viewer I-84, still unpaid); every mount starts snapping on. The measurement tools themselves — M/C/L/A, the gesture
grammar and the inline measurement card (R-UI-042) — owner: inc-407; the picks here feed the readout
and nothing else. The rest of the viewer toolbar (V select, H pan, the split and overlay controls) and
R-UI-032's remaining letters — owner: the toolbar leaf, whose third this Decision pays. Snapping to
raster sheets, to text records and to derived paint beyond what `recordKey` resolves — owner: the
R-SPINE-022 tier leaf. A snap glyph on the WebGL painter or the partition overlay canvas — not owed:
the glyph is a DOM node by ruling (I-151). The rest of J-020 — proposals, the two-point calibration
act, the scale panel and the hatched unplaceable view — owner: inc-204's screen leaf; this leaf only
reads calibrations of record. The shared `cx-readout` class R-UI-030 names — owner: the `src/ui` node
that ships it.

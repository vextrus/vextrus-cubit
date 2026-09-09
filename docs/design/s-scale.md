# Design Decision — S-Scale (the scale panel, docked as the inspector's second tab)

The sixth region of S-Viewer, and **no route of its own**: the right inspector becomes a two-tab
panel — **Selection** (the untouched `InspectorPanel`) and **Scale** (this Decision). Routes
unchanged: `/t/{tenant}/p/{project}/viewer/{drawing}/{layout}`, `?v=`, `?s=`. Files:
`src/modules/takeoff/scale-ui/{two-point.ts,use-scale.ts,copy.ts}` (math, the hook, the copy — no
JSX), `src/modules/takeoff/sheets/scale-state.ts`, the route's `scale-region.tsx` (this region's
whole markup), `scale-actions.ts`, `viewer-scale.css`, `viewer-stage.tsx`, `viewer-screen.tsx`,
`partition-region.tsx`, `states.ts`, the overlay's `types.ts` / `scene.ts` / `paint.ts` /
`use-partition-overlay.ts`, and on S-Drawings `sheet-card.tsx` with its route-local `strings.ts`.
Increment inc-205-scale-ui. Law: R-TO-020, R-TO-021, L-MEA-05, L-ACT-02, R-UI-021/020/023/041/
001/003/004/005/012/030/031/050/060, J-020, ARCH-01, B-17, B-19, B-20, C-05, Q-11.

Every convention of the earlier Decisions binds: `cx-` classes, variants on data-attributes,
tokens-only colour and motion, `cx-reticle` solely from `src/ui/primitives/core/reticle.css`, no
`[data-theme]` selector in authored CSS, copy by key from a strings table (s-settings-ruleset I-24),
model values verbatim in mono (I-25), identifiers whole (I-26). `s-viewer.md` rules the canvas and
the one refusal, `s-viewer-inspector.md` the aside and selection, `s-viewer-partition.md` the left
stack and the overlay canvas, `s-viewer-snap.md` the picks and the readout; I-77–I-151 stand. Chrome
comes only from shipped primitives — data Tabs, core Button, Checkbox, Input, Badge, Skeleton, the
one RefusalState, the one ConsequenceDialog — plus the `cx-viewer-scale-*` classes ruled here.

## 0. Interpretations (numbering continues the highest recorded, s-viewer-snap's I-151)

- **I-152 — the tab strip stands outside the aside, so the aside is byte-identical.** `Tabs` wraps
  the contents of `viewer-inspector-panel`: the `TabsList` (`viewer-inspector-tabs`) above two
  `TabsContent` panels — the untouched `InspectorPanel` and this section. Rejected: a strip inside
  `viewer-inspector`, which would certainly redraw J-000's `entity-selected.png`. The aside's
  *height* may still shrink under the strip; if that picture differs only by that it is regenerated
  in a `baseline:` commit naming this Decision (B-20), and no other J-000 asset moves.
- **I-153 — one copy home, on owned ground, so nothing is mirrored.** This increment is granted
  `scale-ui/**` and not `src/ui/strings/**`, so the panel's sentences live once in
  `scale-ui/copy.ts` (`SCALE_COPY`), read straight by the route's `scale-region.tsx`. One home
  needs no mirror, so the copy-mirror debt I-113 records is not joined by a third; moving these keys
  into `src/ui/strings/viewer-scale.ts` is an IOU with its owner named (§8), never a second table.
- **I-154 — a view's absence is the registry's own sentence in the row, never a RefusalState.**
  Extending I-111: `SCALE_NO_EVIDENCE` / `SCALE_UNIT_UNMAPPED` are facts about a view, not answers
  to the person who opened the sheet. The row publishes the code in `data-state` and renders
  `REFUSALS[code].message` and `.remedy` as its own lines. The one RefusalState is kept for what is
  refused *of them* — the doors' answers, the session, the permission.
- **I-155 — an observation that is not verified is shown, not refused.** `judgeObservation`
  answering `verified: false` appends a real row reading **Not verified**: the observation was
  taken, and its span and factor are facts. This is the panel's partial cell. Affirming at
  `QS_TWO_POINT` on such an axis is what the door refuses; `SCALE_OBSERVATION_UNVERIFIED` renders in
  the answer slot then, as a `refusal` arm (`_UNCITED`, `_OBLIQUE`) does, appending no row.
- **I-156 — one answer slot, in two places, holding one thing.** `viewer-scale-answer` holds at most
  one RefusalState or one notice: in the body's place when the read was refused or denied, and
  between the two-point tool and the affirm footer when a door was — beside the controls that raised
  it (R-UI-020's "in place"). Two slots would let the panel say two things at once.
- **I-157 — a scale group is chosen, never offered.** L-MEA-05 makes membership positive and puts
  ~6–8 affirmations on a project, so the reader curates the subject set: one Checkbox per row.
  Rejected: `OfferedGroups`, which answers a machine's proposed cohort, not a person's judgement. No
  select-all exists anywhere in `viewer-scale` (R-UI-023), and that absence is asserted. The footer
  offers one **Affirm** button per rank **every** checked member can stand at, in precedence order:
  an act names one rank for all its views, so a rank one member cannot reach is not a button.
- **I-158 — the picks are the snap region's, and Observe consumes them.** `use-scale` reads
  inc-206's two picks and hands them to `observationOf`; no second pick model is built. A successful
  Observe clears them (`viewer-status-distance[data-picks="0"]`), so an observation is never taken
  twice from marks already spent.
- **I-159 — twelve places render whole.** Factors, anisotropy ratios, calibration keys, source keys
  and spans render verbatim in mono, wrapping, `user-select: all`. Rejected: four places behind a
  tooltip — a factor is the evidence, and evidence is never truncated behind an affordance.
- **I-160 — one hatch, one home.** The overlay's `OverlayOutline` gains `scaleRefusal:
  ScaleAbsenceCode | null` and its scene hatches an outline that is untyped **or** scale-refused; no
  second overlay is drawn (B-17). `data-hatched` keeps its J-021 meaning — untyped only — and the
  new count publishes as `data-scale-hatched`. The absence map is threaded from `useScaleRegion`
  into `usePartitionRegion` through `viewer-screen.tsx`, so the two regions read one answer.

## 1. Layout and hierarchy

The stage still dominates; the inspector column keeps its width, fill and seam. The strip is the
only new chrome, and it is one row of a panel that was already there.

```
<ResizablePanel id="viewer-inspector-panel">
  <Tabs defaultValue="selection">                         ← content switch is instant
    <TabsList data-testid="viewer-inspector-tabs" aria-label={tabs_label}>
      <TabsTrigger data-testid="viewer-inspector-tab-selection">Selection
      <TabsTrigger data-testid="viewer-inspector-tab-scale">Scale
    <TabsContent value="selection"><InspectorPanel/>       ← the aside, untouched
    <TabsContent value="scale">
      <section data-testid="viewer-scale" aria-labelledby="cx-viewer-scale-title"
               data-state="loading|ready|failed|refused|denied">
```

`TabsList` wears the layers header's geometry (padding `var(--space-2)` `var(--space-3)`,
`border-block-end: var(--hairline)`, fill `var(--graphite-50)`); the triggers are the shipped Tabs
primitive unrestyled — the active one takes `var(--graphite-900)` text over a 2 px `var(--beam-500)`
underline. `viewer-inspector-tab-selection` is active at every mount (persistence is an IOU, §8).
The section is a column flex, `overflow-y: auto`, `min-width: 0`.

**Head** (`cx-viewer-scale-head`, sticky at the section's top, fill `var(--graphite-50)`,
`z-index: var(--z-base)`) — `<h2 id="cx-viewer-scale-title" tabindex="-1">` `viewer_scale_heading` in
the Inspector header's exact type (`var(--text-13)` `var(--weight-heading)` `var(--graphite-900)`),
so switching tabs shifts nothing; under it `viewer_scale_tolerance_anisotropy` filled with the
edition's anisotropy tolerance, `var(--text-12)` `var(--graphite-600)`, the ratio in mono.

**View rows** — `<ol aria-label={views_list_label}>` of `<li data-testid="viewer-scale-view"
data-view-key data-state data-calibration-key data-rank data-factor-x data-factor-y data-anisotropy
data-placeable>`, one per view the door answered, in its order. Padding `var(--space-2)`
`var(--space-3)`, `min-block-size: var(--row-comfortable)` re-keyed `var(--row-compact)` under an
ancestor `[data-density="compact"]` (R-UI-005), `border-block-end: var(--hairline)`, column flex,
gap `var(--space-1)`. `data-state` is `affirmed` or the absence code verbatim; the four calibration
attributes are present only at `affirmed`.

- **Line one** — the Checkbox `viewer-scale-member[data-view-key]` (visually hidden label
  `viewer_scale_member_label` filled with the key, so N checkboxes are never announced alike), the
  view key whole in `var(--font-mono)` `var(--text-12)` `var(--graphite-900)`, `user-select: all`,
  then the shipped Badge holding the stored view type verbatim in mono.
- **Line two** — the stored caption verbatim, mono `var(--text-12)` `var(--graphite-600)`, one line,
  ellipsised; omitted when the store holds none.
- **Affirmed block** — `viewer_scale_affirmed` filled with the rank's registered word, the
  calibration key whole in mono, `viewer_scale_factor_label` over `viewer_scale_factor_x` /
  `_factor_y` (both 12-place strings verbatim, `tabular-nums slashed-zero`, right-aligned),
  `viewer_scale_anisotropy`, and `viewer_scale_placeable` or `viewer_scale_unplaceable`. Values
  `var(--graphite-900)`, labels `var(--graphite-600)`.
- **Absence block** (I-154) — `REFUSALS[code].message` in `var(--text-12)` `var(--graphite-900)`
  over `.remedy` in `var(--graphite-700)`, `var(--leading-ui)`; then the proposals.
- **Proposals** — `<ol aria-label={proposals_label}>` of `<li data-testid="viewer-scale-proposal"
  data-rank data-factor-x data-factor-y data-anisotropy data-placeable>`, in the order the door
  answered (L-MEA-05 precedence; the panel sorts nothing). Each: the rank's registered word
  (`scale_rank_GRID_SPACING` / `_DIMENSION_RATIO` / `_FILE_UNITS`) at `var(--weight-body-medium)`;
  `viewer_scale_evidence_label` then **every** evidence source key whole in mono, wrapping,
  `user-select: all`; then the factor pair, anisotropy readout and placeable flag exactly as the
  affirmed block renders them — the engine's own values, unrounded (I-159). A view with no proposal
  renders `viewer_scale_no_proposals` instead: silence never happens (R-UI-020).

**Two-point tool** — `<fieldset class="cx-viewer-scale-tool">`, legend `viewer_scale_tool_legend`,
hint `viewer_scale_tool_hint`. Then the standing picks: at none, `viewer_scale_picks_none`
(`var(--graphite-600)`) — the state that teaches the gesture; otherwise one line per pick,
`viewer_scale_pick` filled with the index, then its source key whole and its two lattice coordinates
in mono. Then a two-column grid, gap `var(--space-2)`: core Input `viewer-scale-distance`
(`inputMode="decimal"`, label `viewer_scale_distance_label`) and a native `<select
data-testid="viewer-scale-unit">` in the house field classes (label `viewer_scale_unit_label`) whose
options are `SCALE_UNITS` in roster order, each option's text the unit's own spelling — `mm`, `cm`,
`m`, `inch`, `foot`. Then core secondary Button `viewer-scale-observe`, `viewer_scale_observe`,
natively `disabled` below two picks. Then `<p data-testid="viewer-scale-check-verification">` —
exactly one, always rendered — `viewer_scale_check_verification` filled with the edition's
verification tolerance in mono. Then `<ol aria-label={observations_label}>` of `<li
data-testid="viewer-scale-observation" data-axis data-drawn data-factor data-verified
data-view-key>`: the axis word, the drawn span, the 12-place factor, and `viewer_scale_verified` /
`viewer_scale_unverified` at `var(--weight-body-medium)` (I-155).

**Answer slot** — `<div data-testid="viewer-scale-answer">` per I-156.

**Affirm footer** — `viewer_scale_members_count` through `formatUserFigure`, then one core secondary
Button `viewer-scale-affirm[data-rank]` per offered rank (I-157), text `viewer_scale_affirm` filled
with the rank word, natively `disabled` at zero members. A press judges offline first, then awaits
`previewAffirmScale`; a refusal renders in the answer slot and no dialog opens on nothing. A
consequence opens the one ConsequenceDialog (`actType="AFFIRM_SCALE"`, the SUBJECTS rendering plus
the two effect slots `docs/design/consequence-dialog.md` now rules — one subject row per checked
member, before `none` or the outgoing key, after the incoming one). On `onCommitted` the dialog
closes, focus returns to the pressed door, and the panel re-reads: the row's new `affirmed` state is
the visible answer, no toast.

**Overlay and readout** (I-160) — the overlay hatches every view no act names and publishes
`data-scale-hatched` on `viewer-partition-canvas`. Inside such a view the snap distance cell keeps
standing at `data-si="uncalibrated"` with `viewer_status_distance_uncalibrated` — inc-206's own
behaviour, unchanged: a view with no scale measures nothing (R-TO-021).

**S-Drawings' card** — `sheet-card-scale[data-scale][data-unplaceable]`, filled by `sheetIndexOf`
from `scaleStateOf`: `unaffirmed` and `affirmed` keep their existing sentences; `unplaceable` with a
count reads `drawings_scale_unplaceable_count` filled with count and total; `unplaceable` with no
partition views keeps core's own `drawings_scale_unplaceable` sentence. `data-unplaceable` is the
count, or `""` when null (the `sheet-card-views` precedent).

## 2. States (R-UI-050)

`VIEWER_STATES` in the route's `states.ts` stays the one enumerable home the suite reflects over
(B-17, B-19); this region adds no second matrix, and its cells are declared there as the scale rows.

- **Loading** — `data-state="loading"`, `aria-busy="true"`: the head renders whole; the body holds
  three row-shaped groups of two core Skeletons (12 × 96 over 12 × min(220 px, 100 %)) at the
  density's row height, and a visually hidden `viewer_scale_loading_label`. No spinner (R-UI-004).
- **Empty** — impossible as a blank: a drawing with no ingest, and one with no stored partition, are
  the door's registered `PARTITION_NOT_AVAILABLE`, rendered in the answer slot in the body's place
  with its own message and remedy and evidence `{ href: the project's drawings, label:
  viewer_scale_evidence_drawings }` — the list says why it is empty, and the one action (rebuild the
  partition) lives on that screen.
- **Error** — `data-state="failed"`: `viewer_scale_failed` (`var(--text-13)`
  `var(--graphite-900)`), core secondary Button `viewer-scale-retry` carrying `viewer_scale_retry`
  which re-reads the door in place, and — when the fault answer carried one —
  `viewer_scale_report_id` in mono, `user-select: all`. The sheet is not torn down: a scale that
  cannot be read costs the reader this panel, never the drawing.
- **Refusal** — `data-state="refused"`: the door's `SIGNED_OUT` and `WORKSPACE_PERMISSION_NOT_HELD`,
  and every refusal from `previewAffirmScale` / `commitAffirmScale` and the two-point judgement,
  through the one RefusalState in the answer slot (I-155, I-156). No screen-local refusal block
  exists (R-UI-020, B-17) and no new refusal code is minted.
- **Partial** — two, both rendered. An observation judged `verified: false` keeps its row and says
  so (I-155). A view with no proposal, or placeable at no rank, keeps its row, its absence sentence
  and its checkbox — shown, not hidden; the rows that can be affirmed are unaffected.
- **Offline** — no banner for the read. Picking, entering and judging an observation are wholly
  local and keep working. The one act is guarded: **Affirm** pressed offline opens no dialog and
  renders `viewer_scale_offline` as a `role="alert"` notice in the answer slot, in the house notice
  chrome (`var(--warn-surface)` fill, `var(--hairline)` re-keyed `border-color: var(--warn)`, radius
  `var(--radius-4)`, padding `var(--space-3)`).
- **Permission-denied** — `data-state="denied"`: reading needs workspace membership (the shell's
  guard before the route mounts); affirming needs `MEASURE`. A member without it keeps every row,
  proposal and readout — knowledge is not permission (s-drawings I-90) — while the checkboxes, the
  two-point tool and the affirm footer do not render at all, and the answer slot holds
  `viewer_scale_denied_permission` and `viewer_scale_denied_holder` over one banner RefusalState from
  the registered `PERMISSION_NOT_HELD`, evidence the participants route.

## 3. Copy, verbatim (`src/modules/takeoff/scale-ui/copy.ts`, I-153)

`viewer_scale_tabs_label` **Inspector panels** · `viewer_scale_tab_selection` **Selection** ·
`viewer_scale_tab_scale` **Scale** · `viewer_scale_heading` **Scale** ·
`viewer_scale_tolerance_anisotropy` **X and Y may differ by {tolerance}** ·
`viewer_scale_views_list_label` **Views of this sheet** · `viewer_scale_member_label` **Include
{viewKey} in the affirmation** · `viewer_scale_affirmed` **Affirmed at {rank}** ·
`viewer_scale_calibration_label` **Calibration** · `viewer_scale_factor_label` **Metres per drawing
unit** · `viewer_scale_factor_x` **X {factor}** · `viewer_scale_factor_y` **Y {factor}** ·
`viewer_scale_anisotropy` **Anisotropy {ratio}** · `viewer_scale_placeable` **Placeable** ·
`viewer_scale_unplaceable` **X and Y disagree beyond the tolerance, so this view cannot be placed** ·
`viewer_scale_proposals_label` **Scales read from the drawing** · `viewer_scale_evidence_label` **Read
from** · `viewer_scale_no_proposals` **Nothing in this drawing offers a scale for this view, so only
a two-point calibration can scale it.** · `scale_rank_GRID_SPACING` **Grid spacing** ·
`scale_rank_DIMENSION_RATIO` **Dimension ratio** · `scale_rank_FILE_UNITS` **File units header** ·
`scale_rank_QS_TWO_POINT` **Two-point calibration** · `viewer_scale_tool_legend` **Two-point
calibration** · `viewer_scale_tool_hint` **Take two picks on one view, standing on one axis, then
enter the distance between them.** · `viewer_scale_picks_none` **No picks. Hold Alt and click two
points on the sheet, or press Enter with the sheet focused.** · `viewer_scale_pick` **Pick {index}**
· `viewer_scale_distance_label` **Distance between the picks** · `viewer_scale_unit_label` **Unit** ·
`viewer_scale_observe` **Take observation** · `viewer_scale_observations_label` **Observations taken
here** · `viewer_scale_observation_axis` **Axis {axis}** · `viewer_scale_observation_drawn` **{drawn}
drawing units** · `viewer_scale_verified` **Verified** · `viewer_scale_unverified` **Not verified** ·
`viewer_scale_check_verification` **An observation is verified when the drawing's own evidence agrees
within {tolerance}.** · `viewer_scale_members_count` **{count} of {total} views chosen** ·
`viewer_scale_affirm` **Affirm at {rank}** · `viewer_scale_loading_label` **Reading the scale of each
view.** · `viewer_scale_failed` **The scale of this sheet could not be read.** · `viewer_scale_retry`
**Retry** · `viewer_scale_report_id` **Report id {id}** · `viewer_scale_offline` **Nothing was
previewed: the connection to the product is gone.** · `viewer_scale_denied_permission` **Affirming a
scale needs the MEASURE permission on this project, and your account does not hold it.** ·
`viewer_scale_denied_holder` **This project's principals and measurers hold it; a principal grants it
on the participants screen.** · `viewer_scale_evidence_participants` **Open the project's
participants** · `viewer_scale_evidence_drawings` **Open the project's drawings** ·
`viewer_scale_evidence_reload` **Reload this sheet**.

Route-local, the drawings route's own `strings.ts`: `drawings_scale_unplaceable_count` **{count} of
{total} views have no scale of record**.

No refusal message or remedy is spelled here: `SCALE_NO_EVIDENCE`, `SCALE_UNIT_UNMAPPED`,
`SCALE_OBSERVATION_UNCITED`, `SCALE_OBSERVATION_OBLIQUE`, `SCALE_OBSERVATION_UNVERIFIED`,
`PARTITION_NOT_AVAILABLE`, `PERMISSION_NOT_HELD`, `SIGNED_OUT` and `CONSEQUENCES_NOT_CARRIED` are
registry-owned and render as registered. Voice: calm, concrete, professional; no exclamation marks;
no build vocabulary — "door", "seam", "lattice", "digest computation" and every clause id appear
nowhere a reader can see, while "scale", "calibration", "anisotropy", "observation" and "drawing
units" are the drawing office's own words. View keys, captions, source keys, calibration keys,
factors, ratios, spans and unit spellings are model data and render verbatim in mono as data, never
woven into a sentence.

## 4. Motion (R-UI-004)

The tab switch is instant — a tab change is navigation, not theatre (the Tabs ruling) — and the only
tweened thing in the strip is the trigger's text colour and underline over `var(--motion-state)`
`var(--ease)`. Rows, proposals, observation rows, the answer slot and the hatch land on the next
frame untweened: they are data, and fading them in would read as uncertainty about what the machine
measured. The Checkbox's mark, the Skeleton pulse, the reticle draw and the ConsequenceDialog's
entrance live in their single homes. No bounce, no spinner. Every duration is a token zeroed at
source under reduced motion, so `viewer-scale.css` carries no `prefers-reduced-motion` branch.

## 5. Tokens

`--graphite-0/50/200/600/700/900` · `--beam-500` reaching this region only through the Tabs
primitive's active underline and the reticle's single home · `--warn` / `--warn-surface` (the offline
notice; the overlay's hatch is the partition Decision's own) · `--hairline` · `--space-1/2/3` ·
`--radius-2/4` · `--text-12/13` · `--font-mono` / `--font-ui` · `--weight-body-medium` /
`--weight-heading` · `--leading-ui` · `--row-comfortable` / `--row-compact` · `--motion-state` /
`--ease` · `--z-base`. Px literals, closed set (core I-1's mandated class): the loading bones,
12 × 96 and 12 × min(220 px, 100 %). Any other literal is a defect. No copper appears on the panel —
it lives only on the ConsequenceDialog's confirm, where its own Decision puts it — and no basis
colour appears: a rank is not an R-UI-002 basis, and the one ENTERED value here is a field a person
is filling, not a stored quantity wearing a chip.

## 6. Themes

`viewer-scale.css` contains no `[data-theme]` selector; every light/dark difference arrives through
token values (R-UI-001). The panel is DOM throughout, so it flips with the document root and adds
nothing to the screen's `MutationObserver`; the overlay's new hatch is painted by the partition scene
from the palette that observer already re-reads. Contrast on the founder values in both themes:
graphite-600/700/900 on graphite-50 clear 4.5:1; the active tab's beam-500 underline clears the 3:1
UI floor and never carries the selection alone (the text darkens and `aria-selected` says it); warn
as the notice border clears 3:1. Nothing is colour-only — verified, placeable, affirmed and hatched
are each a word as well as a paint.

## 7. Test hooks (closed contract, C-05)

Routes: none added. Doors: `takeoff.scaleProposals`, `takeoff.previewAffirmScale`,
`takeoff.commitAffirmScale`, and the route actions `readScaleProposals` / `previewAffirmScale` /
`commitAffirmScale` in the `partition-actions.ts` shapes verbatim. Test ids added, exactly the
contract's: `viewer-inspector-tabs` · `viewer-inspector-tab-selection` · `viewer-inspector-tab-scale`
· `viewer-scale` (`data-state`) · `viewer-scale-view` (`data-view-key`, `data-state`,
`data-calibration-key`, `data-rank`, `data-factor-x`, `data-factor-y`, `data-anisotropy`,
`data-placeable`) · `viewer-scale-proposal` (the same five) · `viewer-scale-member`
(`data-view-key`) · `viewer-scale-affirm` (`data-rank`) · `viewer-scale-distance` ·
`viewer-scale-unit` · `viewer-scale-observe` · `viewer-scale-observation` (`data-axis`,
`data-drawn`, `data-factor`, `data-verified`, `data-view-key`) · `viewer-scale-check-verification` ·
`viewer-scale-answer` · `viewer-scale-retry`; plus `data-scale-hatched` on
`viewer-partition-canvas` and `data-unplaceable` on `sheet-card-scale`. No other id is added: the
head, the tool fieldset, the picks, the affirm footer and the notice are found by role, class and
text.

Behavioural hooks without new ids: `role="tablist"` on `viewer-inspector-tabs` with
`aria-selected="true"` on `viewer-inspector-tab-selection` at mount; `aria-busy` while loading;
`cx-reticle` on both triggers, every checkbox, both fields, Observe, Retry and every Affirm; the
asserted absence of any select-all inside `viewer-scale`; and the untouched neighbours — the
`viewer-inspector` aside's markup, `viewer-status`'s `data-selection` and `data-scale`, the address's
`v` and `s`, and `viewer-partition-canvas`'s `data-hatched`, read before and after a tab switch and
identical.

Suites: `tests/takeoff/scale-ui/**` over `two-point.ts` (`observationOf`'s uncited arm,
`judgeObservation`'s axis, span, 12-place factor and verified flag) against fixtures in
`tests/takeoff/scale-ui/support/**`, and a jsdom mount of the region over injected door answers for
all seven states; the drawings `__tests__` over `scaleStateOf` and `sheetIndexOf`'s new fields.
Journey `tests/e2e/journeys/j-020-scale.spec.ts` (every title beginning **J-020**, staged by
`stageScaleSheet`, page object `tests/e2e/pages/s-scale.page.ts`) at `j-020-scale/panel-open`,
`observation`, `affirm-open`, `affirmed` and `sheet-card`, axe serious/critical = 0 at each, never
widened; `j-020-snapping` and J-000 stay green. Pictures: `viewer-scale` alone as
`j-020-scale/panel-light.png` and `panel-dark.png` (`data-theme` flipped, animations disabled,
`maxDiffPixelRatio` 0.002) — DOM and deterministic, never the sheet or the overlay canvas (s-viewer
§7). Re-baselined in their own `baseline:` commits naming this Decision (B-20):
`j-010-sheet-card.png` for the card's new line, and `j-000/entity-selected.png` **only** if it moves
by the aside's height under the strip (I-152). `consequence-dialog-open.png` does not move: its
sample preview carries no `effects`.

## 8. Recorded IOUs (owner named, never a comment in `src/`)

Refreshing the snap calibration feed in place after a commit — owner: the viewer's feed node; today
a fresh calibration reaches the status cell when the sheet is reopened, which is what J-020 walks.
Persisting the inspector's chosen tab across mounts, and the left stack's remembered sizes — owner:
the prefs seam's node (s-viewer I-84, still unpaid). Committing at rank `QS_TWO_POINT` from this
panel end to end, and persisting observations beyond the session — owner: inc-204's seam, whose
acceptance already carries the door's gating. Re-affirmation copy naming outgoing keys and the
signatures a re-affirmation voids, beyond the dialog's Before/After and the two effect slots —
owner: the increment that ships quantity lines and signatures, which is the code path that fills
them. The certificate's declaration of unplaceable views (R-TO-021's last clause) — owner: M7. The
`NumberInput` primitive R-UI-010 names, with its unit suffix and decimal-only entry — owner: the
foundation leaf that mints it; the distance field here is the core Input and the unit a native
`<select>` in the house field classes, replaced when that primitive lands. Moving this panel's keys
into `src/ui/strings/viewer-scale.ts` (I-153) — owner: the node that owns `src/ui/strings` and the
ARCH-01 import matrix.

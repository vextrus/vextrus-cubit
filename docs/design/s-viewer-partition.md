# Design Decision — S-Viewer's views/grid panel and the partition overlay

The fourth region of S-Viewer, not a route of its own: a **Views and grid** panel docked under the
layers panel in the left stack, and a paint-only overlay canvas above the WebGL sheet. Route
unchanged (`/t/{tenant}/p/{project}/viewer/{drawing}/{layout}`, `?v=`, `?s=`); the feed gains
`?part=partition`. Files: `src/modules/takeoff/viewer-partition-overlay/{types.ts,server.ts,scene.ts,
paint.ts,groups.ts,use-partition-overlay.ts,partition-panel.tsx,copy.ts}`, the route's
`viewer-stage.tsx` / `viewer-screen.tsx` / `viewer.css` / `loading.tsx` / `partition-actions.ts`, the
stylesheet `viewer-partition.css` beside the panel, copy home `src/ui/strings/viewer-partition.ts`.
Increment inc-203-views-grid-overlay. Law: R-TO-014, L-CAD-06/07, L-ACT-02, R-UI-020/021/023/
001/003/004/005/012/030/040/043/050/060, J-021, B-17, B-19, B-20, C-05, Q-11.

Every convention of the earlier Decisions binds: `cx-` classes, variants on data-attributes,
tokens-only colour and motion, `cx-reticle` solely from `src/ui/primitives/core/reticle.css`, no
`[data-theme]` selector in authored CSS, copy by key from a strings table (s-settings-ruleset I-24),
model values verbatim in mono (I-25), identifiers whole (I-26). s-viewer.md rules everything this
file does not touch — the canvas, the layers panel, the status line, the one refusal — and s-viewer
I-77–I-84 and s-viewer-inspector I-85–I-88 stand. Chrome comes only from shipped primitives — core
Button, Badge and Skeleton, the one OfferedGroups, the one ConsequenceDialog, the one RefusalState —
plus the `cx-viewer-partition-*` classes this file rules. This Decision strikes the views/grid half
of s-viewer.md §8's first IOU in the commit that lands it (B-20); the toolbar half stands.

## 0. Interpretations (numbering continues the highest recorded, job-timeline's I-109)

- **I-110 — the left stack is one column with two panels, not a second split.** The partition
  section is a sibling below the layers list inside the existing `viewer-layers-panel`: the list
  takes `flex: 1 1 auto` and the section `flex: 0 1 auto` with `max-block-size: 55%`, each with its
  own `overflow-y: auto`, seamed by `border-block-start: var(--hairline)`. Rejected: a nested
  vertical `ResizablePanelGroup` — a second handle inside a 22 % column buys one degree of freedom
  at the price of a control that can crush either list to nothing, and it lands a tab stop between
  the layers panel and this one. A remembered vertical size is an IOU (§8), not a silent skip.
- **I-111 — a stored reason is a fact about a view, never an answer to this reader.** An `UNTYPED`
  view's `reason` renders as `REFUSALS[reason].message` in the row (AC-3) — the registry's own
  sentence, never re-spelled in the strings table — and not as a `RefusalState`: nothing was refused
  of the person who opened the sheet. The one RefusalState is kept for what is refused *of them* —
  the feed's `SIGNED_OUT` / `WORKSPACE_PERMISSION_NOT_HELD`, and the confirm door's answers.
  R-UI-020's "an empty list says why it is empty" is paid by the empty sentence (§2).
- **I-112 — the overlay is a second 2D canvas over the sheet, painted from the sheet's own frame.**
  `viewer-partition-canvas` is `aria-hidden="true"`, absolutely positioned over `viewer-canvas` with
  `pointer-events: none`, backing store `clientWidth/Height × min(devicePixelRatio, 2)` (s-viewer's
  cap), cleared and redrawn from the screen's existing draw callback at every sheet frame. It reads
  nothing of the pointer: no hit-test, no selection, no camera and no address is touched by anything
  in this file. Toggling changes what is painted and the panel's own attributes — nothing else.
- **I-113 — the panel says its sentences from a mirror, as the inspector does.** `PartitionPanel`
  lives in `src/modules`, which under ARCH-01 may not import `src/ui`; the copy home the contract
  names is `src/ui/strings/viewer-partition.ts`. So the module reads
  `viewer-partition-overlay/copy.ts` — the same keys, verbatim — and
  `tests/takeoff/viewer-partition-overlay/copy-mirror.test.ts` fails the build if the two ever
  differ (the `viewer-inspector/copy.ts` precedent, whose IOU this inherits and does not pay).
- **I-114 — the badge is the store's word, before and after a confirmation.** The badge renders the
  stored `type` spelling verbatim in mono; confirming appends a row line (**Confirmed as {type}**)
  and sets `data-confirmed="true"`, and never rewrites the badge — L-ACT-01's confirmation is an
  append, and overwriting the grammar's reading in front of a reader would erase what the machine
  saw. A view carrying a proposal reads **Proposed as {type}** the same way.
- **I-115 — every colour the overlay paints is read from a token at the screen.** `drawOverlayScene`
  takes a resolved palette (`ink`, `warn`, `paper`, `label` colour and the two type sizes) read by
  `getComputedStyle` of the stage, exactly as s-viewer hands the painter its `--canvas-*` values. No
  hex, no `rgb(...)`, no colour name appears in `paint.ts`, `scene.ts` or the panel (AC-3).
- **I-116 — outlines and axes are told apart by line, not by hue.** A typed view outlines in a 1 px
  `[6, 4]` dash; an `UNTYPED` view outlines solid in `--warn` and fills with the 45° `--canvas-ink`
  hatch; a grid axis is the drawing office's centre line, `[12, 3, 2, 3]`. In greyscale, and for a
  reader who cannot separate warn from ink, the three still read apart (R-UI-060).

## 1. Layout and hierarchy

The stage still dominates. The panel recedes exactly as the layers panel does — same fill
(`var(--graphite-50)`), same header geometry, same hairline seams — so the left stack reads as one
column of two lists rather than two competing panels. The section is the scroll container and its
header row is sticky at its top, which keeps the two switches inside the scrollable region: a
scrolled region always holds focusable content, so axe's scrollable-region rule can never fire here.

```
<section class="cx-viewer-partition" data-testid="viewer-partition"
         aria-labelledby="cx-viewer-partition-title"
         data-state="loading|ready|empty|failed" data-views="on|off" data-grid="on|off">
  <div class="cx-viewer-partition-head">          ← position: sticky, inset-block-start: 0
    <h2 id="cx-viewer-partition-title" tabindex="-1">Views and grid</h2>
    <button role="switch" data-testid="viewer-partition-views-toggle" aria-checked class="cx-reticle">
    <button role="switch" data-testid="viewer-partition-grid-toggle"  aria-checked class="cx-reticle">
  </div>
  <ol aria-label={views_list_label}>   <li data-testid="viewer-partition-view">…
  <ol aria-label={grid_list_label}>    <li data-testid="viewer-partition-axis">…
  <ul aria-label={deferrals_list_label}> <li data-testid="viewer-partition-grid-deferral">…
  <div data-testid="viewer-partition-groups">   ← <h3> + the one OfferedGroups, or the denial
</section>
```

**Header** — grid `1fr auto auto`, gap `var(--space-2)`, padding `var(--space-2)` `var(--space-3)`,
`border-block-end: var(--hairline)`, fill `var(--graphite-50)` (the panel's own, so rows pass cleanly
under it), `z-index: var(--z-base)`. `<h2>` `viewer_partition_heading` in the layers header's exact
type (`var(--text-13)` `var(--weight-heading)` `var(--graphite-900)`), `tabindex="-1"` so a journey
and the screen can move focus to the region without adding a tab stop that does nothing.

**Switches** — the layers panel's `role="switch"` idiom, chip-shaped: `<button type="button"
role="switch" aria-checked class="cx-reticle">` holding a 10 px square swatch (`aria-hidden`,
radius `var(--radius-2)`, 1 px `var(--canvas-ink)` border — **filled** with that ink when checked,
hollow when not: the second, non-colour channel) then its visible text, `viewer_partition_views_toggle`
/ `viewer_partition_grid_toggle`, `var(--text-12)`. Checked: fill `var(--beam-100)`, text
`var(--graphite-900)` at `var(--weight-heading)`. Unchecked: fill `var(--graphite-0)`, text
`var(--graphite-700)`. Space and Enter flip them; each flip writes `data-views` / `data-grid` on the
section and repaints on the next frame. Both default to `on` at every mount — nothing is persisted
(§8).

**View rows** — one `<li data-testid="viewer-partition-view" data-view-key data-type data-untyped
data-reason data-on-sheet data-proposed data-confirmed>` per stored view in view-key order.
Min-height `var(--row-comfortable)` re-keyed `var(--row-compact)` under an ancestor
`[data-density="compact"]` (R-UI-005, the dropzone I-75 mechanism); padding `var(--space-2)`
`var(--space-3)`; `border-block-end: var(--hairline)`; column flex, gap `var(--space-1)`.

- **Line one** — the shipped Badge, `data-testid="viewer-partition-view-badge"`, holding the stored
  type spelling verbatim in `var(--font-mono)` `var(--text-12)` `var(--graphite-900)` (I-25); on an
  `UNTYPED` row the badge wears the sheet's own hatch — a 45° `repeating-linear-gradient` of
  `var(--graphite-300)` lines over `var(--warn-surface)`, border re-keyed `var(--warn)` — so panel
  and sheet say the same thing in the same pattern. Then the view key, whole, `user-select: all`,
  `var(--font-mono)` `var(--text-12)` `var(--graphite-700)` (I-26).
- **Line two** — the stored caption verbatim in `var(--font-mono)` `var(--text-12)`
  `var(--graphite-600)`, one line, ellipsised at the panel edge; omitted when the store holds none.
- **Line three** — `viewer_partition_entities` through `formatUserFigure`, `var(--font-mono)`
  `var(--text-12)` `var(--graphite-700)` `tabular-nums slashed-zero`; then, at
  `data-on-sheet="false"`, `viewer_partition_off_sheet` in `var(--font-ui)` `var(--graphite-600)`;
  then `viewer_partition_proposed` or `viewer_partition_confirmed` filled with the proposed or
  confirmed spelling (I-114), `var(--text-12)` `var(--graphite-700)`.
- **Reason** — only at `data-untyped="true"`: `<p data-testid="viewer-partition-view-reason">`
  carrying `REFUSALS[reason].message` (I-111), `var(--text-12)` `var(--graphite-700)`,
  `var(--leading-ui)`, wrapping.

**Axis rows** — one `<li data-testid="viewer-partition-axis" data-view-key data-family data-axis
data-label>` per stored axis in bubble-key order, same row geometry, one line: the label verbatim in
`var(--font-mono)` `var(--text-12)` `var(--graphite-900)`, then the family verbatim
(`var(--graphite-600)`), then the position through `formatUserFigure`
(`var(--graphite-700)` `tabular-nums slashed-zero`, right-aligned). The line carries a visually
hidden `viewer_partition_axis_reading` filled with label, family and position, so three bare tokens
are never announced naked.

**Deferral rows** — one `<li data-testid="viewer-partition-grid-deferral" data-view-key
data-reason>` per stored deferral: the view key in mono, then `REFUSALS[reason].message` — the
registry's `GRID_NO_BUBBLE_EVIDENCE` sentence, `var(--text-12)` `var(--graphite-700)`.

**Groups** — `<div data-testid="viewer-partition-groups">`: `<h3>` `viewer_partition_groups_heading`
(`var(--text-12)` `var(--weight-body-medium)` `var(--graphite-900)`, padding `var(--space-2)`
`var(--space-3)`), then the one `OfferedGroups` holding what `offeredViewGroups(views, drawingId)`
answered, then the region's **answer slot** (no test id; the contract is closed) holding exactly one
RefusalState or the offline notice. No checkbox, no `[role=checkbox]`, no select-all exists anywhere
inside `viewer-partition` — that absence is asserted, not intended (offered-group I-77).
`OfferedGroups` grows one arm for the `PROPOSED_VIEW_TYPE` key, publishing `data-kind`,
`data-drawing` and `data-view-type` on each `offered-group`; `docs/design/offered-group.md` §7 gains
that attribute in the same commit (B-20 — the increment that widens the pattern owns its Decision).

**Confirming** — a press judges offline first (s-drawings I-89), then awaits `previewConfirmViewType`
(the route-local server action). A refusal renders in the answer slot: `GROUP_NOT_OFFERED` evidence
`{ href: the sheet's own address, label: viewer_partition_evidence_reload }`, `PERMISSION_NOT_HELD`
the participants route, `SIGNED_OUT` `{ href: "/sign-in", label: shell_evidence_sign_in }`; no dialog
opens on nothing. A consequence opens the one ConsequenceDialog (`actType="CONFIRM_VIEW_TYPE"`,
rendering through the shipped subjects arm: one row per member view key, before the stored spelling,
after the proposed one). On `onCommitted` the dialog closes, focus returns to the pressed door per
the primitive, the feed is re-read: the emptied group and the rows' new lines are the visible answer,
no toast.

**Overlay** — `<canvas data-testid="viewer-partition-canvas" aria-hidden="true">` in the stage, per
I-112. Paint per frame, in order: for each outline, the rect (typed — 1 px `[6, 4]` dash in
`--canvas-ink`; hatched — 1 px solid `--warn` plus the 45° `--canvas-ink` hatch pattern at 8 px
pitch, both from the resolved palette, I-115/I-116), then its type spelling at the rect's top-left in
a `--canvas-paper` chip with a 1 px `--canvas-ink` hairline, mono at the `--text-12` value, dropped
entirely below that height (s-viewer's LOD, never drawn smaller); then for each axis the centre line
`[12, 3, 2, 3]` in `--canvas-ink` spanning the owning view's box (the sheet's extents when the view
stands on no box) extended 4 % at both ends, then its bubble — a `--canvas-paper` disc with a 1 px
`--canvas-ink` ring at the stored centre and radius, the label centred in mono, the label dropped
when the ring falls below 6 px on screen (the ring still draws: the georeference is the fact).
`overlayScene(overlay, toggles, camera)` is pure and canvas-free: `views: false` answers no outlines,
`grid: false` no axes. After the first frame the canvas publishes `data-outlines`, `data-hatched`,
`data-axes`, `data-bubbles`, rewritten only when a count changes.

## 2. States (R-UI-050)

`VIEWER_STATES` in the route's `states.ts` stays the one enumerable home the suite reflects over
(B-17, B-19); this region adds no second matrix, and its cells are declared there as the partition
rows. `data-state` on the section is the panel's own readout.

- **Loading** — `data-state="loading"`, `aria-busy="true"`: the header renders whole (both switches
  are local state, not data, and they are operable at once), the body holds three core Skeleton bones
  12 × min(180 px, 100 %) at the density's row height, and a visually hidden
  `viewer_partition_loading_label`. `loading.tsx` gains the same shape under its layers column. No
  spinner (R-UI-004). The overlay canvas does not mount until an overlay answers.
- **Empty** — `data-state="empty"`: `viewer_partition_empty` in `var(--text-13)`
  `var(--graphite-600)`, `var(--leading-ui)`, padding `var(--space-3)`; no rows, no groups, no
  overlay canvas. The one action a reader has is on S-Drawings (rebuilding a partition is that
  screen's door, out of scope here), so this state teaches rather than offers: a button that cannot
  act is theatre (participants I-50).
- **Error** — `data-state="failed"`: `viewer_partition_failed` (`var(--text-13)`
  `var(--graphite-900)`), a core secondary Button `viewer-partition-retry` carrying
  `viewer_partition_retry` which re-requests `?part=partition` in place, and — when the fault answer
  carried one — `viewer_partition_report_id` in `var(--font-mono)` `var(--text-12)`
  `var(--graphite-600)`, `user-select: all`. The sheet is not torn down: a partition that cannot be
  read costs the reader the overlay, not the drawing.
- **Refusal** — the feed's `SIGNED_OUT` (401) and `WORKSPACE_PERMISSION_NOT_HELD` (403) render
  through the one RefusalState in the body's place, evidence `/sign-in` and the workspace home
  respectively; the act door's refusals render in the groups' answer slot (§1). No screen-local
  refusal block exists (R-UI-020, B-17).
- **Partial** — two, both rendered. A view whose members stand on no box of this sheet keeps its row
  with `data-on-sheet="false"` and **Not on this sheet**, and paints no outline — shown, not hidden.
  A layout plan that georeferenced as deferred has no axes and one deferral row naming
  `GRID_NO_BUBBLE_EVIDENCE`'s sentence; the grid switch stays on and the other views' axes stay
  painted.
- **Offline** — no banner of its own: reading a partition writes nothing, and the sheet already
  drawn keeps drawing (s-viewer §2). "Read-only" binds the one act: a confirm pressed offline opens
  no dialog and renders `viewer_partition_offline` as a `role="alert"` notice in the answer slot, in
  the house notice chrome (`var(--warn-surface)` fill, `var(--hairline)` re-keyed
  `border-color: var(--warn)`, radius `var(--radius-4)`, padding `var(--space-3)`).
- **Permission-denied** — reading needs workspace membership (the shell's guard before the route
  mounts); confirming needs `MEASURE`. A member without it keeps every row, every axis and the whole
  overlay — knowledge is not permission (s-drawings I-90) — while `viewer-partition-groups` holds
  `viewer_partition_denied_permission` and `viewer_partition_denied_holder` over one banner
  RefusalState from the registered `PERMISSION_NOT_HELD`, evidence the participants route, and no
  `OfferedGroups` and no confirm door render at all.

## 3. Copy, verbatim

`src/ui/strings/viewer-partition.ts` (registry append; mirrored per I-113):

`viewer_partition_heading` **Views and grid** · `viewer_partition_views_toggle` **Views** ·
`viewer_partition_grid_toggle` **Grid** · `viewer_partition_empty` **No partition has been rebuilt
for this drawing yet, so there are no views or grid to show.** · `viewer_partition_failed` **The
partition could not be read.** · `viewer_partition_retry` **Retry** ·
`viewer_partition_report_id` **Report id {id}** · `viewer_partition_groups_heading` **Proposed view
types** · `viewer_partition_group_label` **Views of this drawing whose captions the grammar could not
read, proposed as {type}** · `viewer_partition_group_count_one` **1 view** ·
`viewer_partition_group_count_many` **{count} views** · `viewer_partition_off_sheet` **Not on this
sheet** · `viewer_partition_entities` **{count} entities** · `viewer_partition_proposed` **Proposed
as {type}** · `viewer_partition_confirmed` **Confirmed as {type}** ·
`viewer_partition_views_list_label` **Views of this drawing** · `viewer_partition_grid_list_label`
**Grid axes on this drawing** · `viewer_partition_deferrals_list_label` **Layout plans with no grid
to read** · `viewer_partition_axis_reading` **Grid {label}, {family} family, at {position}** ·
`viewer_partition_loading_label` **Reading the partition.** · `viewer_partition_offline` **Nothing
was previewed: the connection to the product is gone.** · `viewer_partition_denied_permission`
**Confirming a view's type needs the MEASURE permission on this project, and your account does not
hold it.** · `viewer_partition_denied_holder` **This project's principals and measurers hold it; a
principal grants it on the participants screen.** · `viewer_partition_evidence_reload` **Reload this
sheet** · `viewer_partition_evidence_participants` **Open the project's participants**.

No refusal message or remedy is spelled here: `CAPTION_UNCLASSIFIABLE`, `GRID_NO_BUBBLE_EVIDENCE`,
`GROUP_NOT_OFFERED`, `PERMISSION_NOT_HELD` and `SIGNED_OUT` are registry-owned and render as
registered (AC-3). No new refusal code and no new act type is minted. Voice: calm, concrete,
professional; no exclamation marks; no build vocabulary — "partition" and "view" are the product's
own user-facing words (R-TO-014, L-CAD-06), while "manifest", "overlay canvas", "scene", "feed" and
every clause id appear nowhere a reader can see. View keys, captions, type spellings, families,
labels and positions are model data and render verbatim as data, never woven into a sentence.

## 4. Motion (R-UI-004)

The overlay never tweens: a toggle, a camera move and a confirmed view all land on the next sheet
frame, because the outline is data and fading it in would read as uncertainty about what the machine
saw. Rows and groups mount and unmount instantly. The only transitions are the switches' fill, text
and swatch over `var(--motion-state)` `var(--ease)`, the Skeleton pulse and the reticle draw in their
single homes, and the ConsequenceDialog's own entrance. No bounce, no spinner. Every duration is a
token zeroed at source under reduced motion, so `viewer-partition.css` carries no
`prefers-reduced-motion` branch, and the overlay's paint loop is input-driven — it draws when the
sheet draws and never on an idle timer.

## 5. Tokens

`--graphite-0/50/200/300/600/700/900` · `--beam-100` (the checked switch; `--beam-500` reaches this
region only through the reticle's single home) · `--warn` / `--warn-surface` (the hatched badge, the
offline notice, and the overlay's untyped outline) · `--canvas-ink` / `--canvas-paper`, read from
computed style and handed to `drawOverlayScene` (I-115) · `--hairline` · `--space-1/2/3` ·
`--radius-2/4` · `--text-12/13` · `--font-mono` / `--font-ui` · `--weight-body-medium` /
`--weight-heading` · `--leading-ui` · `--row-comfortable` / `--row-compact` · `--motion-state` /
`--ease` · `--z-base`. Px literals, closed set (core I-1's mandated class): the 10 px switch swatch,
the 1 px overlay strokes, the dash arrays `[6, 4]` and `[12, 3, 2, 3]`, the 8 px hatch pitch, the
6 px bubble legibility floor, the ×2 device-pixel cap and the loading bones (12 × 180). Two ratios,
stated as such because no token measures drawing units: an axis spans its view's box extended 4 % at
each end, and the panel's `max-block-size` is 55 % of the left column. Any other literal is a defect.
No copper appears on the panel — it lives only on the ConsequenceDialog's confirm, where its own
Decision puts it — and no basis colour appears at all: a view type is not an R-UI-002 basis
(s-drawings I-83's class).

## 6. Themes

`viewer-partition.css` contains no `[data-theme]` selector; every light/dark difference arrives
through token values (R-UI-001). The overlay is the one surface that cannot inherit a variable: the
screen's existing `MutationObserver` on the document root's `data-theme` re-reads the palette with
the `--canvas-*` values it already re-reads, rebuilds the hatch `CanvasPattern` (a pattern caches the
colour it was built from) and repaints the same scene — no refetch, no camera change. Contrast on
the founder values in both themes: graphite-600/700/900 on graphite-50 clear 4.5:1; graphite-900 on
beam-100 clears 4.5:1; warn as an outline and the hairline seams clear the 3:1 UI floor; canvas-ink
over canvas-paper is the sheet's own ink. Nothing is colour-only: hatch, dash pattern and filled-vs-
hollow swatch carry every distinction the paint draws, and each is repeated as text in the panel.

## 7. Test hooks (closed contract, C-05)

Routes: the feed gains `/api/viewer/{drawing}/{layout}?tenant={tenantId}&part=partition` beside
`&part=head`; the screen routes are unchanged. Test ids added, exactly the contract's:
`viewer-partition` (`data-state`, `data-views`, `data-grid`) · `viewer-partition-views-toggle` ·
`viewer-partition-grid-toggle` · `viewer-partition-view` (`data-view-key`, `data-type`,
`data-untyped`, `data-reason`, `data-on-sheet`, `data-proposed`, `data-confirmed`) ·
`viewer-partition-view-badge` · `viewer-partition-view-reason` · `viewer-partition-axis`
(`data-view-key`, `data-family`, `data-axis`, `data-label`) · `viewer-partition-grid-deferral`
(`data-view-key`, `data-reason`) · `viewer-partition-canvas` (`data-outlines`, `data-hatched`,
`data-axes`, `data-bubbles`) · `viewer-partition-groups` · `viewer-partition-retry`. No others are
added; the mounted patterns keep their own ids (`offered-groups`, `offered-group` — now with
`data-view-type` — `offered-group-count`, `offered-group-confirm`, `consequence-dialog`,
`consequence-subject-row`, `consequence-digest-line`, `consequence-confirm`, `refusal-state`), and
the sub-headings, the notice and the answer slot are found by role and text.

Behavioural hooks without new ids: `role="switch"` with `aria-checked` on both toggles, `"true"` at
mount; `aria-busy` while loading; computed `pointer-events: none` and `aria-hidden="true"` on the
overlay canvas; `cx-reticle` on both toggles, the retry Button and every confirm; the asserted
absence of any checkbox or select-all inside `viewer-partition`; and the untouched neighbours —
`viewer-status`'s `data-scale` and `data-selection` and the address's `v` and `s` are read before and
after a toggle and must be identical.

Suites: `tests/takeoff/viewer-partition-overlay/**` over `server.ts` (AC-1, expectations read from
the lane database by SQL), `scene.ts` (pure, camera-mapped, toggle-gated, `hatched` exactly on
`UNTYPED`), `groups.ts`, `paint.ts` (a stub 2D context recording calls), the copy mirror, and a jsdom
mount of `PartitionPanel` over injected data for the seven states. Journey
`tests/e2e/viewer-partition.spec.ts` (title tagged **J-021**, staged by `stagePartitionedSheet`) at
`j-021/partition-open`, `j-021/partition-toggled`, `j-021/partition-confirm-open`,
`j-021/partition-confirmed`, axe serious/critical = 0 at each, never widened, with the keyboard walk
of AC-5. Two baselines, `tests/e2e/baselines/design/viewer-partition/panel-light.png` and
`panel-dark.png`: the `viewer-partition` region only — DOM, deterministic — never the sheet or the
overlay canvas, because a live sheet is not a pixel baseline (s-viewer §7); animations disabled, mask
on `offered-group-count` alone. J-000, J-011 and PERF-011 capture no part of the left stack and are
not re-baselined.

## 8. Recorded IOUs (owner named, never a comment in `src/`)

A remembered vertical size for the left stack's two panels (I-110) and the two toggles' persistence
across sessions — owner: the prefs seam's node (s-viewer I-84, still unpaid). Selecting a view's
entities, hit-testing an outline or a bubble, and editing or re-drawing an outline or an axis by hand
— owner: the viewer toolbar leaf (R-UI-042) and the placement leaves of J-021, which own the acts
that would write. Requesting a partition rebuild from the viewer — owner: S-Drawings, which holds
`requestPartition` and keeps it. Grid rows for paper layouts — owner: the leaf that teaches the grid
stage to read them; a model-space-only reading is what the store holds today. The copy mirror I-113
stands on: the cure is a copy home both `src/ui` and `src/modules` may read — owner: the node that
owns the ARCH-01 import matrix and `src/ui/strings`.

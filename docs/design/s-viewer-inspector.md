# Design Decision — S-Viewer's inspector (selection, marquee, fly-to, the `s` address)

The third region of S-Viewer, not a route of its own: the right inspector, the selection model and
the Trace target, on the merged viewer of inc-110. Route (unchanged path, widened query)
`/t/{tenant}/p/{project}/viewer/{drawing}/{layout}?v={x},{y},{scale}&s={KEY}[,{KEY}…]`. Files:
`src/modules/takeoff/viewer-inspector/{selection.ts,flyto.ts,inspector-panel.tsx}`, the inherited
`viewer/{painter.ts,spatial.worker.ts}` and the route's `viewer-screen.tsx` / `layers-panel.tsx` /
`status-line.tsx` / `viewer.css`; copy in `src/ui/strings/viewer-inspector.ts` (registry append).
Increment inc-111-viewer-inspector. Law: R-TO-011, R-UI-022 (target half), R-UI-030/031/040/050/
020/012/060, R-UI-001/003/004/005, PB-3, B-17, B-19, B-20, C-05, Q-11, Q-17.

Every convention of the earlier Decisions binds: `cx-` classes, variants on data-attributes,
tokens-only colour and motion, `cx-reticle` solely from `src/ui/primitives/core/reticle.css`, no
`[data-theme]` selector in authored CSS, copy by key from a strings table (s-settings-ruleset I-24),
model values verbatim in mono (I-25), identifiers whole (I-26). s-viewer.md rules everything this
file does not touch — the canvas, the layers panel, the status line's other cells, the one refusal —
and its I-77–I-84 stand, I-83 (fit is instant) narrowed here by I-85. Chrome comes only from shipped
primitives — core Button and Skeleton, the data Resizable trio — plus the `cx-viewer-*` classes
s-viewer already owns and the `cx-viewer-inspector-*` classes this file rules.

## 0. Interpretations

Numbering continues s-viewer.md's I-84 along the viewer chain. (inc-108's s-drawings.md numbers its
own I-83–I-94 in parallel over the same integers; the two chains were drawn at the same time.
References to these four are cited as *s-viewer-inspector I-85…I-88*.)

- **I-85 — deep-link precedence: the stated camera wins.** `s` without `v` selects the named keys
  and then flies to them (`revealInSheet`, the same code path the Reveal door takes). `s` with `v`
  applies the selection and leaves the camera exactly where the address put it — no fly-to, and
  `data-flyto` is never written. Rejected: always flying, which would mean a shared link never shows
  the viewport its author framed. This narrows s-viewer I-83: camera motion is still untweened for
  every gesture of the hand; `var(--motion-flyto)` is spent on exactly one thing, arriving somewhere
  a reader did not steer to.
- **I-86 — selection is over source keys, never over drawn records.** The atoms are the source keys
  L-CAD-03 names (`DXF_HANDLE:HEX`); a derived record resolves to its `src` instance key, so a block
  instance selects, lists and copies as one key however many pieces it paints. Rejected: selecting
  per drawn record, which would put synthesised paint nobody can name into a copyable list.
- **I-87 — the rectangle crosses, and only over what can be seen.** Any entity whose box intersects
  the rectangle is taken; the direction-dependent window/crossing idiom is rejected as undiscoverable
  from the one sentence the panel shows. The rectangle and the layer **Select** answer from the
  drawn, unlocked index, so nothing invisible and nothing locked out of the hit test is ever
  selected — a selection a reader cannot see is a copyable list of ghosts.
- **I-88 — a key this sheet does not hold is a fact, not a refusal.** A link may be older than the
  sheet, and a shape error (`FOO:1`) and a stale handle leave a reader the same move: this address
  named something that is not here. Both land in one partial cell (§2), the keys that were found
  stay selected, no registry code is invented, and `MANIFEST_NOT_RENDERABLE` remains the route's one
  refusal. A second cell for malformed keys would teach a difference nobody can act on.

**Amended by inc-205-scale-ui** (R-TO-020, B-20 — the increment that widens a screen owns its
Decision), with the two Interpretations the scale tab owes this region:

- **s-scale I-152, read against this Decision — the right column becomes a two-tab panel, and the
  aside inside it is untouched.** The Tabs primitive wraps the CONTENTS of
  `viewer-inspector-panel`, outside the `viewer-inspector`
  aside: `<div data-testid="viewer-inspector-tabs">` holds the strip
  (`viewer-inspector-tab-selection`, pressed at mount, then `viewer-inspector-tab-scale`) and two tab
  contents — this Decision's `InspectorPanel`, rendered byte-identically, and S-Scale's section. The
  chosen tab is the route's state handed to the primitive as a controlled value with an explicit
  `onClick` on each trigger: the shipped primitive activates on pointer-down and keyboard alone, and
  a tab must answer a plain click too. Nothing of the choice is persisted across mounts (an IOU of
  s-scale § 8). Rejected: a strip inside the aside, which would redraw the inspector this Decision's
  own baseline pictures; the aside's HEIGHT still shrinks by the strip, which re-baselines
  `j-000/entity-selected.png` and nothing else.
- **I-168 — the column stands whether or not a sheet can be drawn.** (Numbering continues the global
  chain's highest, consequencedialog's I-166 and this increment's I-167.) s-viewer's rule that "an
  inspector beside a sheet that was never drawn is a panel that can never fill" was a fact about the
  selection this Decision rules, not about the column: the scale tab beside it is filled by a door
  and not by the canvas, so a browser with no WebGL context still reads every view's scale, its
  ranked proposals and the absence a view declares (R-TO-020). The group is therefore three panels
  always, and the empty selection tab teaches its own emptiness as it already does. Rejected: keeping
  the two-panel fallback and hiding the scale tab with it, which would make a reading that depends on
  no drawing unreachable for the readers least able to draw one.

## 1. Layout and hierarchy

The stage still dominates; the inspector recedes exactly as the layers panel does — same fill, same
header geometry, same hairline seam — so the sheet reads as framed rather than flanked by two
different panels. The group becomes three panels:

```
<ResizablePanelGroup direction="horizontal" autoSaveId="cubit-viewer-split">
  <ResizablePanel id="viewer-layers-panel"    order={1} defaultSize={22} minSize={14} maxSize={40}>
  <ResizableHandle />
  <ResizablePanel id="viewer-stage-panel"     order={2}>
  <ResizableHandle />
  <ResizablePanel id="viewer-inspector-panel" order={3} defaultSize={22} minSize={14} maxSize={40}>
</ResizablePanelGroup>
```

The `autoSaveId` is unchanged (I-84's IOU stands): every panel carries a stable `id` and `order`, so
a layout stored by inc-110's two-panel build no longer matches this group and is dropped rather than
misapplied — a remembered size is a convenience, and misapplying one would hand a reader a 4 %
canvas on first open.

**The panel** — `<aside class="cx-viewer-inspector" data-testid="viewer-inspector"
aria-labelledby="cx-viewer-inspector-title" data-state="idle|hover|selected" data-count={n}>`: fill
`var(--graphite-50)`, `border-inline-start: var(--hairline)`, column flex, `min-width: 0`.
`data-state` reports the dominant fact — `selected` while `data-count` is above 0, else `hover`
while the pointer holds an entity, else `idle`; `data-count` is always present.

- **Header** — `<h2 id="cx-viewer-inspector-title">` `viewer_inspector_heading`, the layers header's
  geometry exactly: `var(--text-13)` `var(--weight-heading)` `var(--graphite-900)`, padding
  `var(--space-2)` `var(--space-3)`, `border-bottom: var(--hairline)`.
- **Body** — `<div class="cx-viewer-inspector-body">`: column flex, gap `var(--space-3)`, padding
  `var(--space-3)`, `overflow-y: auto`. Regions in document order: hover, selection, missing, idle.

**Hover** (`<dl data-testid="viewer-inspector-hover" data-key={key}>`, present only while an entity
is under the pointer) — three label/value pairs, grid `auto 1fr`, gap `var(--space-1)`
`var(--space-2)`: `<dt>` `viewer_inspector_hover_type` / `_layer` / `_handle` in `var(--text-12)`
`var(--graphite-600)`; `<dd data-testid="viewer-inspector-hover-type|-layer|-handle">` in
`var(--font-mono)` `var(--text-12)` `var(--graphite-900)` `tabular-nums slashed-zero`, ellipsised at
the panel edge. Values verbatim (I-25): the record's type, its layer name, and the hex after
`DXF_HANDLE:` — the handle alone, because the whole key is what the selection rows below publish and
copy. Hover renders **above** a selection and never displaces it: reading under the pointer is not a
change of what you hold.

**Selection** — a sticky summary over the list, because a whole layer selected must never scroll the
Reveal door out of reach: `<div class="cx-viewer-inspector-actions">`, `position: sticky`,
`inset-block-start: 0`, fill `var(--graphite-50)` (the panel's own, so rows pass cleanly under it),
`z-index: var(--z-base)`, padding-block `var(--space-1)`, column flex, gap `var(--space-2)`.

- **Count line** — `viewer_inspector_selected_count` filled through `formatUserFigure`,
  `var(--font-mono)` `var(--text-12)` `var(--graphite-700)` `tabular-nums slashed-zero`. Not a live
  region: the status line already announces the count politely, and two regions saying it twice is
  worse than one saying it once.
- **Doors** — a row, gap `var(--space-2)`, wrapping: core secondary Button `viewer-inspector-reveal`
  with `viewer_inspector_reveal` (native `disabled` at `data-count="0"`), then core ghost Button
  `viewer-inspector-clear` with `viewer_inspector_clear`.

`<ol data-testid="viewer-inspector-selection">` (list-style none, margin 0, padding 0), one
`<li data-testid="viewer-inspector-entity" data-key data-type data-layer data-bbox>` per selected
key in selection order; `data-bbox` is `minx,miny,maxx,maxy` in world units. Row: padding-block
`var(--space-2)` (`var(--space-1)` under an ancestor `[data-density="compact"]`), min-height
`var(--row-comfortable)` re-keyed `var(--row-compact)` the same way (R-UI-005),
`border-bottom: var(--hairline)`, column flex, gap `var(--space-1)`. Line one: type then layer,
`var(--font-mono)` `var(--text-12)` `var(--graphite-700)`, the layer ellipsised. Line two: flex,
`align-items: center`, gap `var(--space-2)` —

- a visually hidden `<span>` carrying `viewer_inspector_key`, so the line is heard as "Source key
  DXF_HANDLE:1A4" and a bare mono string is never announced naked, then
  `<span data-testid="viewer-inspector-key">` the key **whole**, wrapping, `user-select: all`,
  `var(--font-mono)` `var(--text-12)` `var(--graphite-900)` (I-26, S-Audit I-26's class: evidence is
  never truncated behind an ellipsis a reader cannot open);
- core ghost Button `viewer-inspector-copy`, `margin-inline-start: auto`, `var(--text-12)`, visible
  text `viewer_inspector_copy`, `aria-label` = `viewer_inspector_copy_label` filled with the key
  (N rows otherwise offer N buttons announced alike), `data-copied="false"`. On activation it writes
  exactly the key — nothing stripped, nothing trimmed — to `navigator.clipboard`, takes
  `data-copied="true"` and swaps its visible text to `viewer_inspector_copied`. At most one row is
  copied at a time: copying another row returns the first to `false`, and the flag clears when the
  selection changes. Never on a timer — what was copied is a fact, not a flash.

**Missing** (the partial cell, I-88) — `<section>`: `<h3>` `viewer_inspector_missing_heading`
(`var(--text-13)` `var(--weight-body-medium)` `var(--graphite-900)`), body
`viewer_inspector_missing_body` (`var(--text-12)` `var(--graphite-600)`), then
`<ol data-testid="viewer-inspector-missing">` of `<li data-testid="viewer-inspector-missing-key"
data-key>` — the offered key verbatim and whole in `var(--font-mono)` `var(--text-12)`
`var(--graphite-700)`, padding-block `var(--space-1)`.

**Idle** (`class="cx-viewer-inspector-idle"`, no test id — the contract is closed; found by
`viewer-inspector[data-state="idle"]`) — rendered only with no hover and no selection: heading line
`viewer_inspector_idle_heading` (`var(--text-13)` `var(--weight-body-medium)`
`var(--graphite-900)`) over `viewer_inspector_idle_body` (`var(--text-13)` `var(--graphite-600)`,
`var(--leading-ui)`). No button: the next action is a gesture on the canvas and the body names all
three, so a control here could only describe one — and a control that acts on nothing is theatre
(participants I-50).

**Live region** — one `<p role="status" aria-live="polite">` at the panel's foot, visually hidden by
the mechanism `viewer.css` already uses for the screen's `<h1>` and the canvas key list (B-17),
carrying `viewer_inspector_copied` when a key is copied and empty otherwise.

**Canvas gestures** (inherited `viewer-screen.tsx`) — plain drag pans, unchanged. A click of ≤ 3 px
travel selects the topmost hit; Shift+click toggles that key; a click on bare paper clears;
Shift+drag draws the marquee `<div data-testid="viewer-marquee" aria-hidden="true">` — absolutely
positioned in the stage, 1 px border `var(--canvas-selection)`, fill `var(--canvas-hover)`, no
radius, following the pointer untweened — and on release replaces the selection with everything the
rectangle crosses (I-87). Escape with the canvas focused clears. **Keyboard**: the layer row's
Select is the keyboard path to a selection, and Reveal, Clear and Copy are real buttons — the
inspector is fully operable with no pointer (R-UI-060); arrowing entity to entity belongs to the
toolbar leaf (§8).

**Layer row** (inherited `layers-panel.tsx`) — a fourth control after Lock: `<button type="button"
class="cx-reticle" data-testid="viewer-layer-select">`, `var(--text-12)`, text
`viewer_layer_select`, `aria-label` `viewer_layer_select_label` filled with the layer; native
`disabled` while `data-drawn="false"` or `data-locked="true"` (I-87). It follows its two siblings'
reveal exactly — `opacity: 0` at rest, 1 on the row's `:hover`/`:focus-within` — and it **replaces**
the selection with that layer's keys, in the order the index answers them, which is what its own
sentence says it does.

**Status line** (inherited `status-line.tsx`) — one cell added after Entities, before the partial
notice: `<span data-testid="viewer-status-selection">`, label `viewer_status_selection` in
`var(--graphite-600)`, value `viewer_inspector_selected_count` in `var(--graphite-700)`, always
rendered — the zero form reads **0 selected**, a counted empty set, never a hidden cell (R-UI-050).
`viewer-status` gains `data-selection`; `data-drawn-entities` is inc-110's and is unchanged.

**S-Drawings' door** (R-UI-031, paying s-viewer I-77) — every `sheet-card` gains, as its last child,
`<a data-testid="sheet-card-open" class="cx-btn cx-reticle" data-variant="secondary">`: the core
secondary Button as a link, `align-self: start`, text `drawings_open_sheet`, `href` =
`/t/{tenant}/p/{project}/viewer/{drawingId}/{encodeURIComponent(layoutName)}`. The `<article>` takes
`aria-labelledby` pointing at its `sheet-card-title`, so N identical door labels are announced
inside N regions named by their sheet. The route stops being URL-only, and s-viewer.md §8's three
IOUs — the right inspector, the Trace target, visible navigation to a sheet — are struck by the
Builder in the same commit that lands this; s-drawings.md gains the door in its card anatomy and
`drawings_open_sheet` in its copy table (B-20: this increment owns the acceptance it re-baselines).

## 2. States (R-UI-050)

`VIEWER_STATES` in the route's `states.ts` stays the one enumerable home the suite reflects over;
this region adds no second matrix (B-17). Its cells, ruled:

- **Loading** — while the head is in flight the panel renders bones, not the teaching copy (telling
  a reader to hover an entity before any exists is a lie about readiness): a 16 × 96 header bone over
  two 12 × 140 core Skeletons, added to `loading.tsx` as a third column of the same shape. Once the
  head answers the panel goes idle even while geometry streams — hovering an arrived layer works at
  once, and the count is honest at 0.
- **Empty** — the idle block (§1): heading **Nothing selected**, body naming the three gestures. This
  is the state that teaches, and its action lives on the canvas.
- **Error** — the root error boundary (`src/app/error.tsx`), which owns retry and the report id. A
  single index query that rejects does not tear the screen down: the selection is left exactly as it
  was and no address is written, because answering a rectangle with a guess would put entities in a
  copyable list nobody pointed at.
- **Refusal** — unchanged and not re-rendered here: `MANIFEST_NOT_RENDERABLE` and the feed's
  `SIGNED_OUT` / `WORKSPACE_PERMISSION_NOT_HELD` render through the one `RefusalState` in the
  canvas's place (s-viewer §2). The third panel does not mount in the refusal, empty or no-WebGL
  cells and the group falls back to two panels — an inspector beside a sheet that was never drawn is
  a panel that can never fill, and s-viewer's rule holds: nothing is placeheld.
- **Partial** — two, both rendered. A deep link naming keys this sheet does not hold lists them under
  **Not on this sheet** while every key that was found stays selected (I-88, shown not hidden). A
  selected entity whose layer is then hidden, isolated away or failed stays listed and stays in `s`,
  unpainted: the address is the state, and a layer toggle may not silently rewrite a link someone
  shared. Its row still names the layer, which is the fact that explains it.
- **Offline** — no banner: selection, copy and fly-to are wholly local and the viewer writes nothing
  (shell I-20, s-viewer §2). A layer that never arrives is the partial cell above.
- **Permission-denied** — delegated exactly as s-viewer rules it: the workspace guard in
  `t/[tenant]/layout.tsx` before the route mounts, and the feed's 403 in the canvas's place. No
  permission gates reading a sheet you already hold.

## 3. Copy, verbatim

`src/ui/strings/viewer-inspector.ts` (aggregated by `src/ui/strings/index.ts`):

`viewer_inspector_heading` **Inspector** · `viewer_inspector_idle_heading` **Nothing selected** ·
`viewer_inspector_idle_body` **Hover an entity to read it. Click to select; Shift and drag to select
a rectangle; Select on a layer row takes the whole layer.** · `viewer_inspector_hover_type` **Type**
· `viewer_inspector_hover_layer` **Layer** · `viewer_inspector_hover_handle` **Handle** ·
`viewer_inspector_key` **Source key** · `viewer_inspector_copy` **Copy key** ·
`viewer_inspector_copy_label` **Copy {key}** · `viewer_inspector_copied` **Copied** ·
`viewer_inspector_reveal` **Reveal in sheet** · `viewer_inspector_clear` **Clear selection** ·
`viewer_inspector_selected_count` **{count} selected** · `viewer_inspector_missing_heading` **Not on
this sheet** · `viewer_inspector_missing_body` **The link named these keys, and this sheet does not
hold them.** · `viewer_status_selection` **Selection** · `viewer_layer_select` **Select** ·
`viewer_layer_select_label` **Select every entity on {layer}**.

`viewer_inspector_key` is spoken, never seen: it is the visually hidden prefix of each row's key
line (§1), not a visible caption above the list — the row's own two lines are the label.

Route-local, `src/app/(app)/t/[tenant]/p/[project]/drawings/strings.ts`: `drawings_open_sheet`
**Open sheet**.

Voice: calm, concrete, professional; no exclamation marks; no build vocabulary — "manifest",
"tessellate", "worker", "index", "batch" and every clause id appear nowhere a reader can see. Types,
layer names, handles and source keys are model data and render verbatim as data, never woven into a
sentence.

## 4. Motion (R-UI-004)

Hover paint, selection paint, the marquee and every layer toggle are untweened: they land on the
next frame, because a drawing is data and fading it in would read as uncertainty about what is
there. Exactly one thing eases — the fly-to (I-85): the camera travels from its current pose to
`revealCamera(union box)` over `var(--motion-flyto)` (320 ms) on `var(--ease-flyto)`. Both values are
read from the screen's computed style, as s-viewer already reads the `--canvas-*` values, and the
easing token's four control numbers are parsed from the token string — never re-typed as literals;
a token that fails to parse eases linearly over the same duration. `viewer-screen` carries
`data-flyto="flying"` for the travel and `"settled"` when the last frame lands (absent until the
first fly-to ever runs, and never written when the address states `v`).

The pulse follows immediately: the selection is stroked in `var(--canvas-pulse)` cross-fading to
`var(--canvas-selection)` over `var(--motion-flyto)`, once, ending by itself with no further frames.

Reduced motion needs no branch in this code: the duration tokens are zeroed at source, so the read
answers 0, `flyTo(from, to, elapsed, 0)` answers `to` on the next frame, and at 0 no pulse frame is
drawn at all — the selection paints straight in `var(--canvas-selection)` rather than flashing
copper for one frame. The copy button's colour change is `var(--motion-state)` `var(--ease)`; the
reticle draws in its single home.

## 5. Tokens

`--graphite-0/50/100/200/600/700/900` (panel fill `--graphite-50`) · `--canvas-selection` /
`--canvas-hover` / `--canvas-pulse`, read from computed style and handed to the painter — never a
literal, never a hex number in the painter or the worker · `--beam-500` reaching this region only
through the reticle's single home · `--hairline` · `--space-1/2/3` · `--radius-4` (through core's
Button) · `--text-12/13` · `--font-mono` / `--font-ui` · `--weight-body-medium` /
`--weight-heading` · `--leading-ui` · `--row-comfortable` / `--row-compact` · `--motion-flyto` /
`--ease-flyto` / `--motion-state` / `--ease` · `--z-base`.

Px literals, closed set (core I-1's mandated class): the 2 px selection stroke and the 1 px marquee
border on the canvas, the 3 px click-travel threshold that separates a click from a pan, and the
loading bones (16 × 96, 12 × 140). Two world-unit constants, stated as such because no token can
express drawing units: `revealCamera` pads the union box by 12 % of its larger extent (a ratio, so
it holds at any zoom) and gives a degenerate box a minimum extent of 1 drawing unit. Any other
literal is a defect. No copper, no basis colour and no act colour appears: selecting is a read.

## 6. Themes

No `[data-theme]` selector is authored; every difference arrives through token values (R-UI-001).
The three canvas tokens flip by value — selection `#5A4FB0`/`#8B84E8`, hover the two rgba washes,
pulse `#E8930C`/`#FFB224` — and the screen's existing `MutationObserver` on the root's `data-theme`
re-reads them with `--canvas-paper`/`--grid`/`--ink` and repaints the selection, hover and pulse
buffers along with the layers, so no mark is left in the abandoned theme's colours. The panel sits
on `--graphite-50`, the layers panel's own fill, in both themes. Contrast on the founder values:
graphite-600/700/900 on graphite-50 clear 4.5:1 in both themes; canvas-selection clears the 3:1 UI
floor against canvas-paper in both, and selection is never colour-only — a selected entity is a
listed, counted row with its key.

## 7. Test hooks (closed contract, C-05)

Routes: the four query forms of
`/t/{tenant}/p/{project}/viewer/{drawing}/{layout}` (bare, `?v=`, `?s=`, `?v=&s=`),
`/t/{tenant}/p/{project}/drawings`, and the inherited feed `/api/viewer/{drawing}/{layout}?part=
layer&index={n}`. `s` is the selection as comma-joined source keys in selection order, absent at
count 0, written by `history.replaceState` exactly as `v` is (never `pushState`, so Back leaves the
sheet); duplicates collapse to their first occurrence; `v` is written before `s` so the address has
one stable spelling.

Test ids added, exactly the contract's: `viewer-inspector` (`data-state`, `data-count`) ·
`viewer-inspector-hover` (`data-key`) · `viewer-inspector-hover-type` · `-layer` · `-handle` ·
`viewer-inspector-selection` · `viewer-inspector-entity` (`data-key`, `data-type`, `data-layer`,
`data-bbox`) · `viewer-inspector-key` · `viewer-inspector-copy` (`data-copied`) ·
`viewer-inspector-missing` · `viewer-inspector-missing-key` (`data-key`) ·
`viewer-inspector-reveal` · `viewer-inspector-clear` · `viewer-marquee` · `viewer-layer-select` ·
`viewer-status-selection` · `sheet-card-open`. Plus attributes on inherited elements:
`data-flyto` on `viewer-screen`, `data-selection` on `viewer-status`. No other id is added; the
count line, the idle block and the live region are found by state, role and text.

Suites: `tests/takeoff/viewer-inspector/**` over `selection.ts` (`parseSelection`,
`serialiseSelection`, `SELECTION_PARAM`, `unionBox`) and `flyto.ts` (`revealCamera`, `flyTo` — the
0 ms answer, the clamped scale, the degenerate box); a jsdom mount of `InspectorPanel` over a
supplied selection, rendering the same ids and strings with `navigator.clipboard.writeText` stubbed
— it takes `window.location` and never `useRouter`, so it mounts bare. Journeys:
`tests/e2e/journeys/j-011-viewer.spec.ts` at checkpoints `j-011-inspector-hover`,
`-selected`, `j-011-multi-select`, `j-011-deep-link-selection`, `j-011-inspector-dark`, and
`tests/e2e/journeys/j-000-viewer.spec.ts` at `j-000/sheet-open` and `j-000/entity-selected`; axe
serious/critical = 0 at every one, never widened. `tests/e2e/viewer/s-viewer.page.ts` grows the
inspector's locators and the fixed procedures (deep-link-to-key, rectangle-select, layer-select,
copy-key, reveal, theme-flip); `tests/e2e/pages/s-drawings.page.ts` gains `open: "sheet-card-open"`
from its Verifier. One new baseline, `tests/e2e/baselines/design/j-000/entity-selected.png`: a crop
of `viewer-inspector` — DOM, deterministic — never of the canvas, because a live sheet is not a
pixel baseline (s-viewer §7). The two existing J-000 baselines are untouched.

## 8. Recorded IOUs (owner named, never a comment in `src/`)

Lasso selection, R-TO-011's third mode — owner: the viewer toolbar leaf (R-UI-032's V/H/M tool
letters); the marquee here is Shift+drag only and no tool mode ships. The Trace's origins are
**partly paid** by inc-215 (§ 9): the register line's EvidenceLink and the inspector's formula with
live variables ship, and the queue item, the certificate cell and the BOQ line stay unpaid — owner:
those surfaces' own leaves.

**A `layout` column on partition views.** No store ties a partition view to a layout today, so
`sheetOfView(scope, drawingId)` in `src/modules/takeoff/trace` answers the single `layoutName` a
confirmation recorded for that drawing in `sheetDisciplines`, and `"Model"` where none or several
are — which is where a reading with no paper layout was in fact taken. A Trace address is therefore
only as precise as the ingest's record. The cure is a layout carried on the view itself — owner: the
node that owns `src/modules/takeoff/partition` and its store; no migration is made here, and nothing
in `src/` promises one (Q-17). Per-entity keyboard selection, Ctrl/⌘+C on the focused canvas,
zoom-to-selection as a letter, rotate and the minimap — owner: the toolbar leaf. The canvas key list
`viewer_canvas_keys` names neither Escape nor the marquee — owner: the same leaf, which owns
`src/ui/strings/viewer.ts` and R-UI-032's shortcut sheet. A per-user remembered inspector width
through the prefs seam — owner: the prefs seam's node (I-84 unpaid). The shared `cx-readout` class
R-UI-030 names — owner: the `src/ui` node that ships it. Selection over raster tiers — owner: the
R-SPINE-022 tier leaf. The inspector's copy is mirrored rather than read from its home: `InspectorPanel` lives in
`src/modules`, which under ARCH-01 imports core and its own module only, and the registry is
`src/ui/strings` — so the panel says its sentences from
`src/modules/takeoff/viewer-inspector/copy.ts`, verbatim, with
`tests/takeoff/viewer-inspector/copy-mirror.test.ts` failing the build if the two ever differ (the
`src/ui/screen-states/refusal-entries.ts` precedent). The cure is a copy home both layers may read,
which ARCH-01's matrix offers nowhere today — owner: the node that owns the import matrix and
`src/ui/strings`. And a debt against `tests/hotfix-j000`: its freeze reads an unmerged J-000
extender as a trespass; the cure is bounding `FIX_END` at the hotfix's own landing when main does
not yet contain HEAD — owner: the node that owns `tests/hotfix-j000`.

## 9. The Trace block and the Cited-by block (inc-215-trace)

The Trace's target half, amended: the selection tab of the right inspector gains two blocks, and
nothing else about this Decision moves. Route (unchanged path, widened query)
`/t/{tenant}/p/{project}/viewer/{drawing}/{layout}?s={KEY,…}&line={lineId}` — `line` names the
register row the reader came from, and there is still **no `v`**, whose absence is what makes the
address fly (I-85). Files: `src/modules/takeoff/viewer-inspector/{inspector-panel.tsx,copy.ts}`, the
route's `{page.tsx,viewer-screen.tsx,trace-actions.ts,viewer.css,states.ts}`, and
`src/modules/takeoff/viewer/hooks/{use-reveal.ts,use-selection.ts}` with
`src/modules/takeoff/viewer/painter.ts` behind them. Law: R-UI-022, R-TO-011, X-2, J-021, R-UI-002,
R-UI-004, R-UI-050, ARCH-01, ARCH-03, B-17, B-19, C-05. The link itself is ruled by
`docs/design/evidence-link.md` and is never re-implemented here (B-17).

### 9.1 Interpretations (numbering continues s-takeoff-register.md's I-182)

- **I-183 — the two blocks live in the selection tab, not in a tab of their own.** Both are readings
  *of* what is held: a Trace stands beside the selection it flew to and never instead of it, and the
  Cited-by block answers the very keys the list above it names. A third tab would put a reader's own
  selection one click away from what was said about it. Rejected: a Trace tab, which would also make
  the two-tab strip a three-tab strip on every sheet, traced or not.
- **I-184 — the panel is handed the chip and the link, and re-implements neither.** `InspectorPanel`
  is a module and may not import `src/ui` (ARCH-01), so `BasisChip` and `EvidenceLink` arrive as
  `chrome`, exactly as the register workspace's renderers do (s-takeoff I-170, B-17). The panel
  composes no address either: `originAddress` is spelled once in `src/modules/takeoff/trace/address.ts`
  and the screen hands the composed href down.
- **I-185 — the pulse is told a basis, never a colour.** `reveal(keys, basis)` reads
  `var(--basis-<basis lowercased>)` off the stage beside the duration it already reads there, and
  hands the computed value to `Painter.pulse(durationMs, colour)`. One home for token reads, no hex
  in a hook, and reduced motion keeps zeroing `--motion-flyto` at source with no branch anywhere
  (R-UI-001, R-UI-004). A travel that names no basis — the Reveal door's own — keeps the canvas's
  `--canvas-pulse`.
- **I-186 — the travel waits for the basis, and waits for nothing else.** Where the address names a
  `line`, the reading of `s` is applied once the door has answered in any of its three ways, so the
  arrival is struck in the colour the traced number in fact carries rather than in whichever colour
  had arrived first. Where it names none, the reading is applied exactly as it always was. Rejected:
  striking twice — the arrival happens once and a second strike would perform it again.
- **I-187 — a refusal of the read is the sheet's refusal, not the block's.** The Trace block states
  three things and only three (§ 9.3). An ended session and a workspace this reader does not hold are
  answered where the layer feed's own refusals are — the one `RefusalState` in the sheet's place,
  with a remedy (ARCH-03, R-UI-020) — because a reader who cannot read this project cannot read the
  drawing under it either. Rejected: a fourth cell spelling a code inside the inspector, which would
  be a second home for a refusal's words.

### 9.2 Anatomy

Both blocks stand at the foot of the selection tab's body, under a hairline, in the order
Trace → Cited-by. Neither is boxed: each is a reading of the list above it, not a panel beside it.

```
<section data-testid="viewer-inspector-trace" data-line data-basis data-state>
  <h3>Trace</h3>  <BasisChip basis={quantityBasis} />
  <p>Formula</p>  <p data-testid="viewer-inspector-trace-formula">{formula}</p>
  <p>Variables</p>
  <ol>
    <li data-testid="viewer-inspector-trace-variable"
        data-name data-value data-unit data-basis data-source>
      {name} · {value} {unit} · {basis} · {source}
    </li>  … one per binding, in binding order
  </ol>
  <a data-testid="viewer-inspector-trace-origin" href={originAddress}>Back to the register line</a>
</section>

<section data-testid="viewer-inspector-cited" data-state data-count>
  <h3>Cited by</h3>  <p>{count} lines cite this selection</p>
  <li data-testid="viewer-inspector-cited-line" data-line data-basis data-kind>
    {kind} · {value} {unit} · <EvidenceLink href={originAddress} basis label={objectKey} data-line />
  </li>  … one per answered line, in the door's own order
</section>
```

The formula, every reading, every unit, every basis word and every source key is model data rendered
verbatim in mono and never woven into a sentence (I-25, I-26). The basis chip is the shipped one, and
it carries the glyph so the basis survives greyscale (R-UI-002). The origin link is a plain anchor:
following it is a navigation, and Back stays a real history step (evidence-link I-178).

### 9.3 States (R-UI-050) — this section's cells only

`VIEWER_STATES` stays the one enumerable home the suite reflects over; no second matrix is declared.
The Trace block's own `data-state` says which of three things is so, and the read in flight renders
**no block at all** — a block that stated a cell before the door answered would state a fact nobody
had established.

- **ready** — the evidence, as § 9.2 draws it.
- **missing** — the project holds no line by that id: `trace_missing`, no formula, no variables, and
  **the selection the address applied still held and still listed**. A stale address is a fact, not a
  refusal and not an error (I-88's idiom); no registry code is invented for it.
- **failed** — the read faulted: `trace_failed` and `viewer-inspector-trace-retry`, which reads that
  one line again in place. The sheet is not torn down for it and the selection is untouched.
- **refusal / permission-denied** — not this block's (I-187): the sheet's own cells answer them.
- **offline** — unchanged: reading is local and the address is the state; the origin link is never
  disabled, because following it is a read.
- **Cited-by** — `ready` with rows, `ready` with none (`data-count="0"` and `trace_cited_none`,
  counted rather than hidden), and `failed` (`trace_cited_failed`). The whole block is absent where
  nothing is held: the panel's own idle state is what teaches a reader with no selection.

### 9.4 Copy, motion, tokens, themes

Copy: `src/ui/strings/trace.ts` is the home — `trace_heading`, `trace_formula_label`,
`trace_variables_label`, `trace_origin`, `trace_missing`, `trace_failed`, `trace_retry`,
`trace_cited_heading`, `trace_cited_count`, `trace_cited_none`, `trace_cited_failed` — mirrored into
`viewer-inspector/copy.ts` as `TRACE_COPY`, a table SEPARATE from `INSPECTOR_COPY` because the two
mirror two different homes; `tests/takeoff/viewer-inspector/copy-mirror.test.ts` pins both. No build
vocabulary and no clause id is visible anywhere.

Motion: nothing new eases. The fly-to keeps `var(--motion-flyto)` (320 ms) and the strike keeps its
length; the blocks appear with the reading, untweened. Tokens: `--space-1/2/3`, `--text-12/13`,
`--font-mono`, `--graphite-600/700/900`, `--hairline`, and the seven basis colours reached only
through the shipped chip and link — `viewer.css` spells no basis and no hex, and gains no
`[data-theme]` selector (R-UI-001).

### 9.5 Test hooks (closed contract, C-05)

Ids: `viewer-inspector-trace`, `-trace-formula`, `-trace-variable`, `-trace-origin`, `-trace-retry`,
`viewer-inspector-cited`, `-cited-line`, beside the pattern's own `evidence-link` /
`evidence-link-glyph`. Attributes under test: on the block `data-line`, `data-basis`, `data-state`;
on a variable row `data-name`, `data-value`, `data-unit`, `data-basis`, `data-source`; on the
Cited-by block `data-state`, `data-count`; on a cited row `data-line`, `data-basis`, `data-kind`. The
screen publishes `viewer-screen[data-trace-basis]` while a Trace is held, beside the `data-flyto` it
already publishes. Doors: `takeoff.lineEvidence` / `takeoff.linesCiting` on the lane's router, and
`readLineEvidence` / `readLinesCiting` as this route's server actions — one module, two doors, as the
scale already is. Suites: `tests/takeoff/viewer-inspector/**`, `tests/takeoff/trace/**`,
`tests/takeoff/viewer/hooks/use-reveal.test.tsx`; journey
`tests/e2e/journeys/j-021-column-slice.spec.ts` at `j-021-column-slice/traced` and `/cited`, axe
serious/critical = 0 at each, never widened.

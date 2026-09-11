# Design Decision — S-Viewer (the whole viewer, one home)

**v22 d0 documentation move (2026-09-11).** The viewer's five Design Decisions are collected here
verbatim, in build order, so the whole screen can be read in one place (F-uiux §3.7: "nobody can see
the whole viewer's layout in one place — which is exactly why its regions don't fit together"). No
sentence was changed; each part opens with the banner naming the file it came from, and its
Interpretation numbering, states, copy, tokens and test hooks stand exactly as recorded. Citations in
`src/` and `tests/` to the former paths (`s-viewer.md`, `s-viewer-inspector.md`,
`s-viewer-partition.md`, `s-viewer-snap.md`, `s-scale.md`) resolve to the part named below; U1 updates
those strings when it next touches the file that carries them. The v22 composition this screen is
rebuilt to — the 48 px rail, the ≥ 70 % canvas, the 32 px toolbar, the shell-hosted inspector, the
24 px status readout — is ruled in `docs/design/00-direction.md` §3.1; where a part below and the
direction disagree on geometry, the direction wins and U2 amends the part in place.

| Part | Former file | What it rules |
|---|---|---|
| 1 | `s-viewer.md` | the sheet renderer: stage, layers panel, status readout, zoom, states |
| 2 | `s-viewer-inspector.md` | selection, marquee, fly-to, the `s` address; the Trace and Cited-by blocks |
| 3 | `s-viewer-partition.md` | the views/grid panel and the partition overlay |
| 4 | `s-viewer-snap.md` | snapping: toolbar, glyph overlay, two status cells |
| 5 | `s-scale.md` | the scale panel, docked as the inspector's second tab |

---

<!-- PART 1 — merged verbatim from docs/design/s-viewer.md -->

# Design Decision — S-Viewer (the sheet renderer)

Route: `/t/{tenant}/p/{project}/viewer/{drawing}/{layout}` (+ `?v={x},{y},{scale}`) under
`src/app/(app)/t/[tenant]/p/[project]/viewer/[drawing]/[layout]/**`, inside the shell frame and
behind the membership guard in `t/[tenant]/layout.tsx`. Increment inc-110-viewer-core. Law:
R-TO-010, R-UI-040/043, PB-2, PB-3, R-UI-001/003/004/005/012/020/030/031/050/060, L-CAD-05,
ARCH-01, B-17, Q-11, Q-17. Every convention of the primitives-core Decision binds: `cx-` classes,
variants on data-attributes, tokens-only colour and motion, `cx-reticle` solely from
`src/ui/primitives/core/reticle.css`, no `[data-theme]` selector in authored CSS. Interpretations
I-1–I-76 of the earlier Decisions remain in force ("workspace" is the user-facing word for tenant,
s-auth I-11; copy lives in a strings table read by key, s-settings-ruleset I-24; model values render
verbatim in mono, I-25). Chrome comes only from shipped primitives — core Button and Skeleton, the
data Resizable trio, the one RefusalState — plus the `cx-viewer-*` classes this file rules.

This slice ships the renderer and the layers panel. S-Viewer's other regions — the views and grid
panels, the right inspector, the toolbar (select/pan/measure/snap/split/overlay), the Trace target,
the minimap and rotate — are **not placeheld**: nothing is drawn for them, and each is a recorded
IOU in §8 with its owning clause. A grey box promising a panel is a lie about what shipped.

## 0. Interpretations (recorded per the Law section of CLAUDE.md; numbering continues dropzone.md's)

- **I-77 — the address is the tree's own, and the sheet is not yet linked to.** The route is spelled
  in the shipped convention `/t/{tenant}/p/{project}/viewer/{drawing}/{layout}`, the address every
  in-frame screen already uses; the URL is the whole viewer state (drawing, sheet, and `v` = world
  centre + pixels-per-unit), so back and forward move the camera like any other navigation
  (R-UI-031). Recorded IOU with a named owner: visible navigation to a sheet is owed by the
  sheet-index leaf that lists a drawing's layouts; until it ships the route is journey- and
  URL-reachable, and that debt is recorded here, never silently absorbed.
- **I-78 — full-bleed means the frame's main area, not the window.** The rail, top bar and
  breadcrumb stay: a sheet is a place inside a workspace and a reader must be able to leave it. The
  screen therefore bleeds `shell-main`'s `var(--space-6)` padding away with a negative margin of the
  same token and takes that box whole (`overflow: hidden` — the sheet scrolls by camera, never by
  scrollbar). `shell-main` is a definite-height flex child, so the bleed is exact.
- **I-79 — pure white and pure black resolve to the canvas ink.** L-CAD-05 resolves colour
  server-side; CAD colour 7 arrives as white or black and would be invisible on one of the two
  papers. Ruling, applied in the painter and nowhere else: a record whose channels are **all ≥ 250
  or all ≤ 5** paints in `var(--canvas-ink)`; every other rgb paints exactly as the artifact
  resolved it. This is the ink token's purpose, it is what a drawing office expects of colour 7,
  and it keeps both themes legible without a second manifest.
- **I-80 — the fidelity facts are four named facts with English labels.** `IngestFacts` is a closed
  shape (`insunits`, `layouts`, `dropped_layouts`, `counters`), so the refusal's evidence is four
  labelled rows (§3), not a dump of field names. Numbers inside those rows are model data and render
  through `formatUserFigure` in mono; layout names render verbatim in mono (I-25). A reader learns
  what the reading recovered even though the sheet cannot be drawn.
- **I-81 — partial is reachable and is rendered.** The head carries the whole layer roster before
  any geometry arrives, so a layer whose records fail to load is a known row with missing geometry:
  it stays listed with `data-failed="true"` and its own **Retry layer** button, and the status line
  says some layers did not load (R-UI-050: shown, not hidden). Only a failing *head* takes the
  screen — there is nothing to show — and it does so through the root error boundary.
- **I-82 — no WebGL is a capability, not a refusal.** `createPainter` answering null means the
  browser offers no context; nothing was refused, no register code applies, and inventing one would
  put a taxonomy code on a fact about the reader's machine. It renders in place as plain copy (§2)
  with `data-renderer="unavailable"` on the status line, which reds the perf journey honestly.
- **I-83 — fit is instant; the fly-to token is not spent here.** `var(--motion-flyto)` belongs to
  R-UI-022's Trace fly-to (a later leaf). Fit, zoom and pan are one camera write followed by one
  frame: a viewer that eases its own zoom fights the hand on the trackpad.
- **I-84 — the split remembers itself locally until the prefs seam takes it.** R-UI-005 binds
  resizable panels with remembered sizes to the viewer. The shipped `ResizablePanelGroup` persists
  through `autoSaveId="cubit-viewer-split"`; `src/server/**` and the prefs seam are another node's,
  so a per-user stored size is a recorded IOU (§8), not a silently skipped clause.

## 1. Layout and hierarchy

Files in the route directory: `page.tsx` (thin server component — reads the four segments and `v`,
renders `ViewerScreen`), `viewer-screen.tsx` (the client screen; props
`{ tenantId, projectId, drawingId, layoutName, initialViewport, head? }`), `layers-panel.tsx`,
`status-line.tsx`, `loading.tsx`, `states.ts` (`VIEWER_STATES`), `viewer.css`. Copy is
`src/ui/strings/viewer.ts` (keys `viewer_…`); JSX carries no string literal beyond test ids and
fixed attribute values. The manifest never travels as a server→client prop: the client fetches
`?part=head`, then one `?part=layer&index=n` per layer in roster order, so first paint is the first
layer (R-UI-043).

```
<div class="cx-viewer" data-testid="viewer-screen">          ← bleeds shell-main (I-78)
  <ResizablePanelGroup direction="horizontal" autoSaveId="cubit-viewer-split">
    <ResizablePanel defaultSize={22} minSize={14} maxSize={40}>  ← <section data-testid="viewer-layers">
    <ResizableHandle />                                          ← shipped separator, keyboard-driven
    <ResizablePanel>                                             ← the stage: canvas + zoom controls
  </ResizablePanelGroup>
  <div data-testid="viewer-status">                          ← the mono readout, full width
</div>
```

Grid rows `1fr auto`: the work area dominates, the status line is `var(--space-8)` tall. The canvas
is the screen — everything else is a hairline-seamed edge around it. The screen names itself once,
as its siblings do: a visually hidden `<h1>` carrying `viewer_canvas_label` opens the document, so
heading navigation lands on the sheet a reader opened; the panel's **Layers** is the `<h2>` under
it. Nothing of the sheet is drawn as a heading — a canvas has no text to promote.

**Layers panel** (`cx-viewer-layers`, fill `var(--graphite-50)`, border-inline-end `var(--hairline)`,
column flex, `min-width: 0`). Header row: `<h2>` `viewer_layers_heading` — `var(--text-13)`
`var(--weight-heading)` `var(--graphite-900)`, padding `var(--space-2)` `var(--space-3)`,
border-bottom `var(--hairline)`. Then `<ol>` (list-style none, margin 0, padding 0,
`overflow-y: auto`), one `<li data-testid="viewer-layer-row" data-layer data-visible data-drawn
data-locked data-isolated data-failed>` per manifest layer, in the manifest's own order. Row height
`var(--row-comfortable)`, and `var(--row-compact)` under `[data-density="compact"]` on `shell-root`
(R-UI-005); border-bottom `var(--hairline)`; padding-inline `var(--space-2)`; flex, `align-items:
center`, `gap: var(--space-2)`. Contents in order:

- **Visibility switch** — `<button role="switch" aria-checked={visible} data-testid=
  "viewer-layer-visible" class="cx-reticle" aria-label={fill(viewer_layer_visible_label, {layer})}>`
  holding the swatch as its whole visible content: `<span data-testid="viewer-layer-swatch"
  aria-hidden="true" style={{ background, borderColor }}>` — 10 px square, radius `var(--radius-2)`,
  both style values `rgb(r g b)` from the layer's manifest colour (never a token, never a literal:
  it is artifact data). Hidden (`aria-checked="false"`): `background: none`, the border colour
  kept — filled versus hollow is the second, non-colour channel, so visibility survives greyscale
  (R-UI-002's discipline).
- **Name** — the layer name verbatim (I-25), `var(--font-mono)` `var(--text-12)`
  `var(--graphite-900)`, `flex: 1`, `min-width: 0`, ellipsised; `var(--graphite-600)` while hidden
  or locked.
- **Count** — `<span data-testid="viewer-layer-count">`, `formatUserFigure(String(entityCount))`,
  `var(--font-mono)` `var(--text-12)` `var(--graphite-700)` `tabular-nums slashed-zero`,
  right-aligned (R-UI-005), with `aria-label={fill(viewer_layer_count_label, {count, layer})}` so
  the bare numeral is never announced naked. It stands on every row, a failed one included: the
  partial cell adds the Retry offer beside the count rather than in its place, because how much is
  missing is the fact a reader needs (R-UI-050).
- **Isolate** and **Lock** — two `<button type="button" class="cx-reticle" aria-pressed>` at
  `var(--text-12)`, labels `viewer_layer_isolate` / `viewer_layer_lock`, test ids
  `viewer-layer-isolate` / `viewer-layer-lock`, each carrying the layer it acts on as its accessible
  name — `viewer_layer_isolate_label` / `viewer_layer_lock_label` — because a sheet of N layers
  otherwise presents 2N buttons announced alike. At rest on an untouched row they sit at
  `opacity: 0`; the row's `:hover` and `:focus-within` and any pressed state bring them to 1 — they
  are always in the DOM and always tab-reachable, so a keyboard reader focusing one always sees it
  (R-UI-012). Pressed paint is the selection idiom: fill `var(--beam-100)`, text
  `var(--graphite-900)` at `var(--weight-heading)`. Isolating a layer draws only it and leaves every
  other layer's own `data-visible` untouched (`data-drawn="false"`); pressing the isolated row's
  Isolate again clears isolation. Lock leaves the layer drawn and takes it out of the hit-test index
  — `data-locked="true"`, `data-drawn` unchanged.

**Stage** (`cx-viewer-stage`, `position: relative`, fill `var(--canvas-paper)`):
`<canvas data-testid="viewer-canvas" role="application" tabindex="0" class="cx-reticle"
aria-label={fill(viewer_canvas_label, {layout})} aria-describedby="cx-viewer-keys">` filling the
panel, with the key set it answers named in a visually hidden `viewer_canvas_keys` beside it: the
sheet is driven from the keyboard, so it is not announced as a picture that offers nothing. A canvas is a replaced element
and hosts no `::after`, so focus draws the documented reticle *fallback* (2 px `var(--beam-500)`
outline at 2 px offset), inset so it is not clipped by the panel edge. Backing store =
`clientWidth/Height × min(devicePixelRatio, 2)`, resized from a `ResizeObserver`; the cap holds the
frame budget on HiDPI. The painter clears to `var(--canvas-paper)`, strokes the manifest's extents
as a 1 px `var(--canvas-grid)` rectangle so a fitted sheet reads as a sheet, then paints the layers
in roster order; no other grid is drawn (the grid panel is a later leaf). Text records below
`LEGIBLE_TEXT_PX` at the current scale are not drawn at all (R-UI-040's LOD) — never drawn smaller
and never faked as a smudge. Pointer: drag pans (`cursor: grab` / `grabbing`), wheel and pinch zoom at the
cursor. Keyboard: `+`/`=` and `-` zoom about the centre, arrows pan 48 px, `F` fits — the whole set
this leaf claims (R-UI-032's tool letters belong to the toolbar leaf). Every camera write replaces
the URL's `v` (`history.replaceState`, so back leaves the sheet rather than unwinding a pan).

**Zoom controls** — `<div class="cx-viewer-controls">` absolutely positioned at the stage's
top-right, inset `var(--space-3)`, column flex `gap: var(--space-2)`, on a `var(--graphite-0)` card:
padding `var(--space-1)`, radius `var(--radius-4)`, border `var(--hairline)`,
`box-shadow: var(--shadow-1)`, `z-index: var(--z-base)`. Three core secondary Buttons with visible
text: `viewer_fit` (`viewer-fit`), `viewer_zoom_in` (`viewer-zoom-in`), `viewer_zoom_out`
(`viewer-zoom-out`) — text, not glyphs: no icon set ships and a guessed glyph is worse than a word.

**Status line** (`cx-viewer-readout`, `<div data-testid="viewer-status" role="status"
aria-live="polite">`): full width, height `var(--space-8)`, border-top `var(--hairline)`, fill
`var(--graphite-0)`, padding-inline `var(--space-4)`, flex `align-items: center`
`gap: var(--space-5)`, `var(--font-mono)` `var(--text-12)` `tabular-nums slashed-zero`. Cells, in
order: the sheet name verbatim (`var(--graphite-900)`); then three label/value pairs — labels
`viewer_status_scale` / `viewer_status_layers` / `viewer_status_entities` in `var(--graphite-600)`,
values in `var(--graphite-700)`, filled from `viewer_status_scale_value` (the camera's clamped
pixels-per-unit as `formatUserFigure(scale.toFixed(3))`), `viewer_status_layers_value` and
`viewer_status_entities_value`; then, only while any layer failed, `viewer_status_partial`. The
camera clamps scale into a finite positive range, so the readout always has a decimal to render and
never reaches the format seam with something it must refuse. This is R-UI-030's mono readout; when
the shared readout class lands in `src/ui`, `cx-viewer-readout` is replaced by it (§8).

## 2. States (R-UI-050), ruled cell by cell

Declared in `states.ts` as `VIEWER_STATES` (the route's enumerable home) and mirrored into
`src/ui/screen-states/matrix.tsx` as the route's seven cells, which the merged suite reflects over.

- **Loading** — two surfaces, both bones, never a spinner (R-UI-004). `loading.tsx` holds the
  route's first paint: the panel's header bone (16 × 96) over six row bones at the density's row
  height × 100 %, and one stage bone filling the rest. Inside the client, while the head is in
  flight, `<div data-testid="viewer-loading">` renders the same shape in place with a visually
  hidden `viewer_loading_label` announced by the status line. Once the head answers, rows and status
  render complete (counts come with the head) and geometry streams: progress is the status line's
  `viewer_status_layers_value` — "3 of 7" — not a bar and not a per-row spinner.
- **Empty** — `<div data-testid="viewer-empty">` in the stage's place, centred column,
  `gap: var(--space-2)`, max-width 420 px: heading `var(--text-16)` `var(--weight-heading)`
  `var(--graphite-900)`, body `var(--text-13)` `var(--graphite-600)`, then one action — a core
  secondary Button-as-link to the project home, `viewer_evidence_project`. Three truths, by
  `head.reason`, published on the cell as `data-reason`: `not-ingested` →
  `viewer_empty_unread_heading` / `_body`; `drawing-unknown` → `trace_drawing_unknown_heading` /
  `_body`; `layout-unknown` → `viewer_empty_sheet_heading` / `_body`. The middle one is the address
  that names a drawing this project does not hold — a hand-carried Trace URL reaches it as easily as
  the first — and it is kept apart because "has not been read yet" reports a reading that nothing
  has started, which R-UI-050 separates from empty as not-found. No canvas mounts in any of them.
- **Error** — the root error boundary (`src/app/error.tsx`, its own Decision: retry, and the
  report-id deferral it records). Reached when the head cannot be read at all (I-81); a lost layer
  is the partial cell, not this one.
- **Refusal** — `kind: "refusal"`: the one `RefusalState` (surface `banner`, severity `error`,
  `MANIFEST_NOT_RENDERABLE`) centred in the work area, in the canvas's place, with the fidelity
  facts below it (§3), both capped at 640 px, and the evidence link to the project home — the
  refusal owns the box the sheet would have had rather than leaving an undesigned slab under it. The
  status line under it names the sheet asked for and reports nothing else: with no camera and no
  layers there is no scale to publish, and a readout of zeroes reads as a measurement. No canvas
  mounts. Both
  ways the reading fails to yield a sheet reach this one cell: bytes the mirror cannot parse, and an
  artifact address the store no longer answers — the reader's move is the same (re-read the drawing),
  so neither is dressed as an outage the reader can do nothing with. The
  mid-session refusals the layer feed can answer — `SIGNED_OUT` (401) and
  `WORKSPACE_PERMISSION_NOT_HELD` (403) — render through the same one renderer in the same place,
  evidence `/sign-in` and the workspace home (`/t/{tenant}`, the address the label promises)
  respectively. A drawing this workspace does not hold is *not* one of them: the feed is asked with
  the workspace the address names, so a member of that workspace opening an unknown drawing is told
  the absence (404, `kind: "absent"`) and only a caller who does not hold the named workspace is
  refused — existence and membership stay one answer to everybody else (Q-12).
- **Partial** — rendered, per I-81: failed rows stay listed with `data-failed="true"`, their count
  cell joined by a ghost Button `viewer_layer_retry` that re-requests that one layer, and
  `viewer_status_partial` stands in the status line. The drawn sheet is not withdrawn because part
  of it is missing.
- **Offline** — no invented banner: the viewer writes nothing, so there is no read-only degradation
  to announce (shell I-20). Losing the network mid-load is the partial cell; losing it before the
  head is the error cell; already-painted geometry keeps painting because it is in the GPU buffers.
- **Permission-denied** — delegated: `t/[tenant]/layout.tsx` renders the shell's frameless denial
  (`WORKSPACE_PERMISSION_NOT_HELD`) before this route mounts, and an unauthenticated visitor is the
  `/sign-in` redirect. The route handler answers the same two codes to the layer feed, rendered as
  above.

Outside the seven, one capability truth (I-82): `data-renderer="unavailable"` renders
`viewer_no_webgl_heading` / `viewer_no_webgl_body` in the stage's place, in the empty state's
geometry, with no action link — the remedy is a browser setting, and a link would pretend otherwise.

## 3. Copy, verbatim

`src/ui/strings/viewer.ts` (aggregated by `src/ui/strings/index.ts`):

`viewer_layers_heading` **Layers** · `viewer_layer_visible_label` **Show {layer}** ·
`viewer_layer_count_label` **{count} entities on {layer}** · `viewer_layer_isolate` **Isolate** ·
`viewer_layer_isolate_label` **Isolate {layer}** · `viewer_layer_lock` **Lock** ·
`viewer_layer_lock_label` **Lock {layer}** · `viewer_layer_retry` **Retry layer** ·
`viewer_canvas_label` **Sheet {layout}** · `viewer_canvas_keys` **Drag to pan, scroll to zoom. Plus
and minus zoom, the arrow keys pan, and F fits the sheet.** · `viewer_fit` **Fit** · `viewer_zoom_in` **Zoom in** · `viewer_zoom_out` **Zoom out** ·
`viewer_status_scale` **Scale** · `viewer_status_scale_value` **{scale} px per drawing unit** ·
`viewer_status_layers` **Layers** · `viewer_status_layers_value` **{loaded} of {total}** ·
`viewer_status_entities` **Entities** · `viewer_status_entities_value` **{drawn} of {total}** ·
`viewer_status_partial` **Some layers did not load.** · `viewer_loading_label` **Opening the
sheet.** · `viewer_empty_unread_heading` **This drawing has not been read yet** ·
`viewer_empty_unread_body` **A sheet appears here once the drawing has been read. Reading starts
when the drawing is uploaded and finishes on its own.** · `viewer_empty_sheet_heading` **This
drawing holds no sheet by that name** · `viewer_empty_sheet_body` **The address names a sheet the
drawing does not carry. Open the drawing to pick one of the sheets it holds.** ·
`viewer_evidence_project` **Go to the project** · `viewer_no_webgl_heading` **This browser cannot
draw the sheet** · `viewer_no_webgl_body` **Drawing a sheet needs WebGL, which this browser does not
offer or has turned off. Turn on hardware acceleration, or open this address in another browser.**

The fidelity facts (I-80), each a `<div data-testid="viewer-fidelity-fact" data-fact="…">` holding a
`<dt>` label in `var(--text-12)` `var(--graphite-600)` and a `<dd>` value in mono
`var(--graphite-900)`, under `<dl data-testid="viewer-fidelity-facts">` with the heading
`viewer_fidelity_heading` **What the reading recorded**:

`insunits` — **Drawing units** · value: the mapped unit verbatim, or `viewer_fact_units_unmapped`
**The drawing named no unit the reading recognised.** · `layouts` — **Sheets read** ·
`viewer_fact_layouts_value` **{sheets} read, {strays} entities set aside as strays** ·
`dropped_layouts` — **Sheets dropped** · `viewer_fact_dropped_value` **{dropped} held no content**,
followed by the dropped names verbatim in mono · `counters` — **Limits reached while reading** ·
`viewer_fact_counters_value` **{truncated} sheets stopped early, {capped} curves flattened to the
point limit**.

Registry copy, `src/core/errors.ts` (severity `error`, surface `banner`), under refusal-state.md's
copy rules — one sentence each, verb-first remedy, the code never in the text:
**MANIFEST_NOT_RENDERABLE** · message **The reading of this drawing is damaged, so the sheet cannot
be drawn.** · remedy **Upload the drawing again to have it read afresh.**

Voice: calm and concrete, no exclamation marks, no build vocabulary — "manifest", "tessellate",
"batch", "worker" and every Bible clause id appear nowhere a reader can see. Layer names, sheet
names and units are model data and render verbatim as data, never woven into a sentence.

## 4. Motion (R-UI-004)

Camera motion is direct and untweened (I-83): pan follows the pointer, wheel zoom applies on the
event, `Fit` is one write. Layer visibility, isolate and lock repaint on the next frame with no
transition — a drawing is data, and fading geometry in would read as uncertainty about what is
there. The transitions that exist are all `var(--motion-state)` `var(--ease)`: the row controls'
opacity reveal, swatch fill, button and switch colour. The resize handle follows the pointer with no
transition. The reticle draws in its single home; Skeleton pulses in its own. Every duration is a
token zeroed at source under reduced motion, and the painter's own loop is input-driven — it renders
on camera change and on layer arrival, never on an idle timer, so a still sheet costs zero frames.

## 5. Tokens

`--graphite-0/50/100/200/300/600/700/900` · `--beam-100` (pressed control fill; `--beam-500` reaches
the canvas and the controls only through the reticle's single home) · `--canvas-paper` /
`--canvas-grid` (the 1 px extents frame) / `--canvas-ink` (I-79), read by the screen from
`getComputedStyle` of the stage and handed to `createPainter` — never a literal, never a hex number
in the painter or the worker · `--danger` / `--danger-surface` through RefusalState's own chrome ·
`--hairline` · `--space-1/2/3/4/5/6/8` · `--radius-2/4` · `--text-12/13/16` · `--font-mono` /
`--font-ui` · `--weight-body-medium` / `--weight-heading` · `--leading-ui` ·
`--row-comfortable` / `--row-compact` (R-UI-005) · `--motion-state` / `--ease` · `--shadow-1` ·
`--z-base`. Entity colour is artifact data as `rgb(r g b)` in an inline style. Px literals, closed
set (core I-1's class): the 10 px swatch, the 1 px extents frame, the 420 px empty-state measure,
the 48 px keyboard pan step, the ×2 device-pixel cap, and the loading bones (16 × 96 and the row
heights). Any other literal is a defect.

## 6. Themes

`viewer.css` contains no `[data-theme]` selector; every light/dark difference arrives through token
values (R-UI-001). The canvas is the one surface that cannot inherit a variable, so the screen
re-reads the three `--canvas-*` values whenever the document root's `data-theme` changes (a
`MutationObserver` on that one attribute) and repaints the same manifest — no refetch, no camera
change. Repainting means re-lettering: a record that resolved to the theme's own ink has that ink
written into its vertices at upload, so the painter tessellates the layers it holds again against
the new palette — and the extents frame with them — rather than repainting only the paper and
leaving the geometry in the abandoned theme's colours. Paper is `#FCFCFB` light and `#101216` dark
by token, so a corner pixel is lighter in light
by construction; ink flips with it, and I-79 keeps colour-7 geometry legible on both. Contrast holds
on founder facts in both themes: graphite-600/700/900 on graphite-0 and graphite-50 ≥ 4.5:1,
graphite-900 on beam-100 ≥ 4.5:1, the beam-500 reticle and the hairline seams ≥ 3:1 as UI. No basis
colour and no copper appears anywhere on this screen — drawing a sheet is a read, never an act.

## 7. Test hooks (closed contract, C-05)

Routes introduced: `/t/{tenant}/p/{project}/viewer/{drawing}/{layout}`, the same with
`?v={x},{y},{scale}`, and the feed `/api/viewer/{drawing}/{layout}` (`?part=head` ·
`?part=layer&index={n}`). Test ids, exactly the contract's, on the elements ruled in §1–§2:
`viewer-screen` · `viewer-canvas` · `viewer-status` · `viewer-layers` · `viewer-layer-row` ·
`viewer-layer-swatch` · `viewer-layer-count` · `viewer-layer-visible` · `viewer-layer-isolate` ·
`viewer-layer-lock` · `viewer-fit` · `viewer-zoom-in` · `viewer-zoom-out` · `viewer-empty` ·
`viewer-loading` · `viewer-fidelity-facts` · `viewer-fidelity-fact`; plus the shipped
`refusal-state` / `refusal-message` / `refusal-remedy` / `refusal-evidence-link` and `screen-state`,
which are other files' ids and are not redefined here. `resizable-handle` and `skeleton` arrive with
their primitives. No other id is added.

Behavioural hooks without new ids: on `viewer-status` — `data-first-paint`, `data-renderer`
(`webgl` | `unavailable`), `data-loaded-layers`, `data-total-layers`, `data-entity-count`,
`data-drawn-entities`, `data-scale`, `data-frame-median-ms`, `data-frame-p95-ms` (the painter's rAF
ledger over the last 120 frames, written each frame) and `data-hit-ms` / `data-hit-keys` (the last
answer the index in its worker gave: its round trip against PB-3's 16 ms, and how many keys lay
under the point — written the same way, so asking costs no render); on each row — `data-layer`, `data-visible`,
`data-drawn`, `data-locked`, `data-isolated`, `data-failed`; `role="switch"` + `aria-checked` on the
visibility control and `aria-pressed` on Isolate and Lock; `data-code="MANIFEST_NOT_RENDERABLE"` and
`data-surface="banner"` on the refusal, with a non-empty evidence `href`; `cx-reticle` on the
canvas, both panel controls, the zoom buttons and the handle. Swatch colour is graded by resolving
the row's inline style, layer counts by the string `formatUserFigure` renders.

Suites: `tests/takeoff/viewer/**` (manifest, camera, index, LOD) and jsdom mounts of `ViewerScreen`
over a supplied `head`; `tests/e2e/viewer-perf.spec.ts` tagged **PERF-011** (V-PERF: `pnpm test:perf`, never the J-011 gate lane — v17.1) with page object
`tests/e2e/viewer/s-viewer.page.ts` (`S_VIEWER.route(tenantId, projectId, drawingId, layoutName)`),
checkpoints `j-011-sheet-open`, `j-011-layers`, `j-011-zoom-pan-fit`, `j-011-deep-link`,
`j-011-dark`, each passing axe at serious/critical = 0, never widened. Under headless software GL
the p95 budget is 33 ms (two vsyncs) while the median holds PB-3's 16.7 — recorded here as the
reading the journey grades against. No `toHaveScreenshot` names this screen: a live 100k sheet is
not a pixel baseline, and the dark/light proof is the canvas corner pixel (§6). J-000 is untouched.

## 8. Recorded IOUs (owner named, never a comment in `src/`)

Views and grid panels and the toolbar (select/pan/measure/snap/split/overlay) — S-Viewer's remaining
regions, owner: the later viewer leaves of R-TO-011, R-UI-042. The views/grid half is **struck**
(paid by inc-203-views-grid-overlay, docs/design/s-viewer-partition.md): the panel docked under the
layers list, the paint-only overlay canvas over the sheet, and `CONFIRM_VIEW_TYPE` offered by group
there; the toolbar half stands. **Struck** (paid by
inc-111-viewer-inspector, docs/design/s-viewer-inspector.md): the right inspector and its selection
model, the Trace target (`?s=` + reveal-in-sheet + pulse), and visible navigation into a sheet from
the sheet card's own door (I-77, R-UI-031). Minimap, rotate in 90° steps, zoom-to-selection and a
rotation component in `v` — R-TO-010's remaining gestures, owner: the same toolbar leaf. Raster
sheets as tiled backgrounds under vector traces — R-UI-040's raster clause, owner: the R-SPINE-022
tier leaf. A per-user remembered split size — R-UI-005, owner:
the prefs seam's node (I-84). The shared `cx-readout` class R-UI-030 names — owner: the `src/ui`
node that ships it. Manifest durability across a server restart — owner: a later leaf, if PB-2 cold
ever demands more than the content-keyed process memo.


---

<!-- PART 2 — merged verbatim from docs/design/s-viewer-inspector.md -->

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


---

<!-- PART 3 — merged verbatim from docs/design/s-viewer-partition.md -->

# Design Decision — S-Viewer's views/grid panel and the partition overlay

The fourth region of S-Viewer, not a route of its own: a **Views and grid** panel docked under the
layers panel in the left stack, and a paint-only overlay canvas above the WebGL sheet. Route
unchanged (`/t/{tenant}/p/{project}/viewer/{drawing}/{layout}`, `?v=`, `?s=`); the feed gains
`?part=partition`. Files: `src/modules/takeoff/viewer-partition-overlay/{types.ts,server.ts,scene.ts,
paint.ts,groups.ts,use-partition-overlay.ts,partition-panel.tsx,copy.ts}`, the route's
`viewer-stage.tsx` / `viewer-screen.tsx` / `viewer.css` / `loading.tsx` / `partition-actions.ts` /
`partition-region.tsx` — the last being the region's own composition, which holds everything the
module may not reach under ARCH-01 (the one OfferedGroups, RefusalState and ConsequenceDialog, the
string table, and the addresses a refusal's evidence promises) and keeps `viewer-screen.tsx` the
composition of hooks its own acceptance caps it at — the
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

**Amended by inc-205-scale-ui** (R-TO-021, B-20), with the one hatch this overlay now paints for a
second reason, ruled by s-scale I-160 and recorded here in the overlay's own terms:

- **s-scale I-160, read against this Decision — one hatch, two reasons, and two counts.**
  R-TO-021 says a view no affirmation act names is hatched and measures nothing, and B-17 says a
  hatch has one home: `OverlayOutline` gains `scaleRefusal: string | null` (a plain string, not
  core's `ScaleAbsenceCode` — this module may not value-import `@/core/scale`, which would drag
  `node:crypto` into the browser bundle for a value only ever published as an attribute; the scale
  region supplies the codes verbatim), `overlayScene` takes the absence map as its fourth argument,
  and `paint.ts` lays the same 45° hatch under an outline that is untyped OR scale-refused. The two
  facts stay countable apart: `SceneCounts.scaleHatched` counts the scale-refused and is published as
  `data-scale-hatched` on `viewer-partition-canvas`, while `data-hatched` keeps meaning untyped-only,
  so J-021 reads exactly what it always read. The map is threaded by `viewer-screen.tsx`, which
  composes the scale region ahead of this one: the store is read once, by the door that owns it.

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


---

<!-- PART 4 — merged verbatim from docs/design/s-viewer-snap.md -->

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


---

<!-- PART 5 — merged verbatim from docs/design/s-scale.md -->

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
  offers one **Affirm** button per MACHINE rank **every** checked member can stand at, in precedence
  order: an act names one rank for all its views, so a machine rank one member cannot reach is not a
  button. `QS_TWO_POINT` is not a machine rank and is ruled by I-169.
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
- **I-169 — the two-point door always stands, disabled until its evidence does.** A machine rank is
  something the drawing either offers for these views or does not (I-157), but `QS_TWO_POINT` is
  what the tool in this panel *makes*: its door is therefore always rendered, and what it wants
  gates it through native `disabled` — a rank a reader can reach by working is never hidden from
  them, and a promise that a control will appear later teaches nothing while it is absent. Its
  evidence is one **verified** observation on each of x and y (a scale of record is a factor pair,
  and one axis is half of one); the request still carries only the observations of the checked
  members, and which observation may carry which view stays the seam's judgement (L-MEA-05) — this
  door is coarse on purpose, and the seam refuses precisely. Rejected: gating by presence, which
  makes the strongest rank of the precedence the only one a reader never sees before earning it.
  The same guard stands in `pressAffirm`, so what the control refuses to do is decided once and not
  only by the attribute drawn on it.

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
Button `viewer-scale-affirm[data-rank]` per standing door (I-157, I-169), text `viewer_scale_affirm`
filled with the rank word, natively `disabled` at zero members and — at `QS_TWO_POINT` — until one
verified observation stands on each of x and y. A press judges offline first, then awaits
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

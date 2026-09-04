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
is the screen — everything else is a hairline-seamed edge around it.

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
  the bare numeral is never announced naked.
- **Isolate** and **Lock** — two `<button type="button" class="cx-reticle" aria-pressed>` at
  `var(--text-12)`, labels `viewer_layer_isolate` / `viewer_layer_lock`, test ids
  `viewer-layer-isolate` / `viewer-layer-lock`. At rest on an untouched row they sit at
  `opacity: 0`; the row's `:hover` and `:focus-within` and any pressed state bring them to 1 — they
  are always in the DOM and always tab-reachable, so a keyboard reader focusing one always sees it
  (R-UI-012). Pressed paint is the selection idiom: fill `var(--beam-100)`, text
  `var(--graphite-900)` at `var(--weight-heading)`. Isolating a layer draws only it and leaves every
  other layer's own `data-visible` untouched (`data-drawn="false"`); pressing the isolated row's
  Isolate again clears isolation. Lock leaves the layer drawn and takes it out of the hit-test index
  — `data-locked="true"`, `data-drawn` unchanged.

**Stage** (`cx-viewer-stage`, `position: relative`, fill `var(--canvas-paper)`):
`<canvas data-testid="viewer-canvas" role="img" tabindex="0" class="cx-reticle"
aria-label={fill(viewer_canvas_label, {layout})}>` filling the panel. A canvas is a replaced element
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
  secondary Button-as-link to the project home, `viewer_evidence_project`. Two truths, by
  `head.reason`: `not-ingested` → `viewer_empty_unread_heading` / `_body`; `layout-unknown` →
  `viewer_empty_sheet_heading` / `_body`. No canvas mounts in either.
- **Error** — the root error boundary (`src/app/error.tsx`, its own Decision: retry, and the
  report-id deferral it records). Reached when the head cannot be read at all (I-81); a lost layer
  is the partial cell, not this one.
- **Refusal** — `kind: "refusal"`: the one `RefusalState` (surface `banner`, severity `error`,
  `MANIFEST_NOT_RENDERABLE`) pinned across the top of the work area, in the canvas's place, with the
  fidelity facts below it (§3) and the evidence link to the project home. No canvas mounts. Both
  ways the reading fails to yield a sheet reach this one cell: bytes the mirror cannot parse, and an
  artifact address the store no longer answers — the reader's move is the same (re-read the drawing),
  so neither is dressed as an outage the reader can do nothing with. The
  mid-session refusals the layer feed can answer — `SIGNED_OUT` (401) and
  `WORKSPACE_PERMISSION_NOT_HELD` (403) — render through the same one renderer in the same place,
  evidence `/sign-in` and the workspace home respectively.
- **Partial** — rendered, per I-81: failed rows stay listed with `data-failed="true"`, their count
  cell replaced by a ghost Button `viewer_layer_retry` that re-requests that one layer, and
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
`viewer_layer_lock` **Lock** · `viewer_layer_retry` **Retry layer** · `viewer_canvas_label` **Sheet
{layout}** · `viewer_fit` **Fit** · `viewer_zoom_in` **Zoom in** · `viewer_zoom_out` **Zoom out** ·
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
change. Paper is `#FCFCFB` light and `#101216` dark by token, so a corner pixel is lighter in light
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
ledger over the last 120 frames, written each frame); on each row — `data-layer`, `data-visible`,
`data-drawn`, `data-locked`, `data-isolated`, `data-failed`; `role="switch"` + `aria-checked` on the
visibility control and `aria-pressed` on Isolate and Lock; `data-code="MANIFEST_NOT_RENDERABLE"` and
`data-surface="banner"` on the refusal, with a non-empty evidence `href`; `cx-reticle` on the
canvas, both panel controls, the zoom buttons and the handle. Swatch colour is graded by resolving
the row's inline style, layer counts by the string `formatUserFigure` renders.

Suites: `tests/takeoff/viewer/**` (manifest, camera, index, LOD) and jsdom mounts of `ViewerScreen`
over a supplied `head`; `tests/e2e/viewer-perf.spec.ts` tagged **J-011** with page object
`tests/e2e/viewer/s-viewer.page.ts` (`S_VIEWER.route(tenantId, projectId, drawingId, layoutName)`),
checkpoints `j-011-sheet-open`, `j-011-layers`, `j-011-zoom-pan-fit`, `j-011-deep-link`,
`j-011-dark`, each passing axe at serious/critical = 0, never widened. Under headless software GL
the p95 budget is 33 ms (two vsyncs) while the median holds PB-3's 16.7 — recorded here as the
reading the journey grades against. No `toHaveScreenshot` names this screen: a live 100k sheet is
not a pixel baseline, and the dark/light proof is the canvas corner pixel (§6). J-000 is untouched.

## 8. Recorded IOUs (owner named, never a comment in `src/`)

Views and grid panels, the right inspector, the toolbar (select/pan/measure/snap/split/overlay) and
the Trace target — S-Viewer's remaining regions, owner: the later viewer leaves of R-TO-011,
R-UI-022, R-UI-042. Minimap, rotate in 90° steps, zoom-to-selection and a rotation component in `v`
— R-TO-010's remaining gestures, owner: the same. Raster sheets as tiled backgrounds under vector
traces — R-UI-040's raster clause, owner: the R-SPINE-022 tier leaf. Visible navigation into a sheet
— R-UI-031, owner: the sheet-index leaf (I-77). A per-user remembered split size — R-UI-005, owner:
the prefs seam's node (I-84). The shared `cx-readout` class R-UI-030 names — owner: the `src/ui`
node that ships it. Manifest durability across a server restart — owner: a later leaf, if PB-2 cold
ever demands more than the content-keyed process memo.

# Design Decision — primitives-data (the Datum overlay and data primitive sets)

Not a routed screen: the overlay set in `src/ui/primitives/overlay` — Dialog, Sheet, Popover,
DropdownMenu, ContextMenu, Toast (a themed sonner Toaster plus re-exported `toast`) — and the
data set in `src/ui/primitives/data` — Tabs, Tree, ScrollArea, Resizable panels, DataTable.
Law: R-UI-001/003/004/005/010/012, B-17, Q-11. Consumers (R-UI-011): S-Settings/S-Audit
tables (inc-010/inc-016), the register workspace (M2); the `/design` gallery leaf derives its
completeness from these barrels later. Every convention of the primitives-core Decision holds
here unchanged: class prefix `cx-`, variants on data-attributes, colour and motion tokens-only,
I-1 (mandated geometry in px, layout spacing in tokens), I-2 (no `transparent` keyword —
`background: none`), the reticle solely from `src/ui/primitives/core/reticle.css`, and
primitives own no product copy — the only fixed copy is the acceptance sample data in §4.

## 0. Interpretations (recorded per the Law section of CLAUDE.md)

- **I-3 — the modal scrim rides the graphite pole.** No Datum token names a scrim and no
  colour literal may exist. Ruling: the Dialog/Sheet overlay is
  `background: var(--graphite-1000); opacity: 0.4`. In light the pole is near-black ink and
  dims the page down; in dark it is near-white and fogs the page out. Both directions mute
  the page behind the modal, both are pure token, and no `[data-theme]` selector is needed.
- **I-4 — sonner's internal inline styles are geometry, not colour.** Sonner positions and
  animates its stack with inline transforms/offsets it owns. Ruling: we style only through
  the class hooks it exposes (`cx-toaster`, `cx-toast`); every colour sonner's DOM shows
  comes from our CSS in tokens; its geometry styles are accepted as-is.

## 1. Shared anatomy

- Files: components in `src/ui/primitives/overlay/*.tsx` + one stylesheet
  `src/ui/primitives/overlay/overlay.css`; `src/ui/primitives/data/*.tsx` + one stylesheet
  `src/ui/primitives/data/data.css`. Barrels per the interfaces. Neither stylesheet contains
  a `[data-theme]` selector — themes arrive through token values only (R-UI-001).
- Every overlay Content (Dialog, Sheet, Popover, DropdownMenu, ContextMenu) portals to
  `document.body`, so `[data-theme]` at the document root themes it (the core Tooltip
  precedent). Popup chrome is one family: fill `var(--graphite-0)`, border 1 px solid
  `var(--graphite-200)`, radius `var(--radius-8)`, `z-index: var(--z-overlay)`.
- Every focusable element this file introduces carries `cx-reticle` (B-17): the triggers,
  DialogClose, TabsTrigger, TabsContent, Tree items, ResizableHandle, the DataTable sort
  buttons, filter inputs, editable-cell triggers and cell editor.
- ARIA: DialogContent takes its name from DialogTitle or `aria-label`; SheetContent (which
  exports no Title part) requires `aria-label`. An unnamed instance is a defect.

## 2. The overlay set — layout, states, tokens

### Dialog (`cx-dialog-content`, `data-testid="dialog-content"`, role dialog, aria-modal)
Scrim per I-3, `z-index: var(--z-overlay)`. Content: popup chrome with
`box-shadow: var(--shadow-4)`, width `min(480px, calc(100vw - var(--space-8)))`, padding
`var(--space-6)`, centred. DialogTitle (`cx-dialog-title`): `var(--text-16)`
`var(--weight-heading)` `var(--graphite-900)`, margin-bottom `var(--space-4)`. DialogClose
(`cx-dialog-close cx-reticle`): renders the consumer's child; no default glyph, no default
copy. States: open (focus moves inside, Radix traps it), closed; Escape and scrim click
close and return focus to the trigger (AC-2). Entrance: scrim and content fade opacity
0 → 1, content scales 0.98 → 1, over `var(--motion-panel)` `var(--ease)`; exit instant.

### Sheet (`cx-sheet-content`, `data-testid="sheet-content"`, role dialog, aria-modal)
Built on Radix Dialog. Scrim per I-3. Content: fixed full-height panel on `data-side`
("right" default | "left"), width `min(400px, 100vw)`, fill `var(--graphite-0)`, inner-edge
border 1 px solid `var(--graphite-200)`, `box-shadow: var(--shadow-3)`, padding
`var(--space-6)`, `z-index: var(--z-overlay)`. States and focus behaviour as Dialog.
Entrance: slides from its side, translateX 100 % (or −100 %) → 0, over
`var(--motion-panel)` `var(--ease)`; exit instant.

### Popover (`cx-popover`, `data-testid="popover-content"`)
Popup chrome, `box-shadow: var(--shadow-3)`, padding `var(--space-4)`, max-width 320 px
(I-1), side bottom, `sideOffset` 6. Trigger activation toggles it; Escape and outside click
close it; focus moves into content on open and returns on close (AC-3). Entrance: opacity
0 → 1 with a 2 px rise over `var(--motion-state)` `var(--ease)`; exit instant.

### DropdownMenu (`data-testid="dropdown-content"`) · ContextMenu (`data-testid="contextmenu-content"`)
One shared chrome, class `cx-menu`, role menu (Radix): popup chrome,
`box-shadow: var(--shadow-3)`, padding `var(--space-1)`, min-width 180 px (I-1). Item
(`cx-menu-item`, role menuitem): height `var(--space-8)`, padding-inline `var(--space-3)`,
radius `var(--radius-4)`, text `var(--text-14)` `var(--graphite-900)`. Highlighted
(`data-highlighted`): fill `var(--beam-100)` — the R-UI-030 selection fill; the roving
highlight is the focus indicator here (Radix keeps DOM focus on the menu), so items do not
carry `cx-reticle`. Disabled item (`data-disabled`): text `var(--graphite-600)`, no
highlight. Keyboard: ArrowDown/ArrowUp move the highlight, Enter invokes `onSelect` exactly
once and closes with focus returned to the trigger; DropdownMenu opens from its trigger's
keyboard activation, ContextMenu from a `contextmenu` event on its trigger (AC-3).
Entrance: opacity 0 → 1 with a 2 px rise over `var(--motion-state)` `var(--ease)`; exit
instant.

### Toast (`Toaster` = themed sonner, class `cx-toaster`; `toast` re-exported)
Position bottom-right, `z-index: var(--z-toast)`. Card (`cx-toast`): inverted surface —
fill `var(--graphite-900)`, text `var(--graphite-0)` (the core Tooltip precedent; the roles
flip so it reads in both themes), `var(--font-ui)` `var(--text-13)`, padding
`var(--space-3)` `var(--space-4)`, radius `var(--radius-8)`,
`box-shadow: var(--shadow-3)`, max-width 360 px (I-1), default duration 4000 ms. Motion:
sonner's own enter/exit slide-and-fade, which honours `prefers-reduced-motion` natively
(I-4). Law note (R-UI-020): a toast is a status echo only — a refusal is never a toast
alone; refusals render in place via RefusalState (a later-owned primitive), and no consumer
may route one here.

## 3. The data set — layout, states, tokens

### Tabs (`cx-tabs`)
TabsList (`cx-tabs-list`, role tablist): a row, gap `var(--space-4)`, border-bottom
`var(--hairline)`. TabsTrigger (`cx-tabs-trigger cx-reticle`, role tab): height
`var(--space-9)`, `var(--text-14)` `var(--weight-body-medium)`; rest text
`var(--graphite-600)`, hover `var(--graphite-900)`; active (`data-state="active"`): text
`var(--graphite-900)` plus a 2 px underline bar in `var(--beam-500)` sitting on the list's
hairline (the R-UI-030 beam-bar idiom, horizontal). Colour changes transition over
`var(--motion-state)` `var(--ease)`; the underline does not slide (no measured indicator in
this slice). TabsContent (`cx-tabs-content cx-reticle`, role tabpanel, Radix makes it
focusable): padding-top `var(--space-4)`.

### Tree (`cx-tree`, `data-testid="tree"`, role tree — hand-rolled)
Item row (`cx-tree-item`, `data-testid="tree-item"`, role treeitem, `cx-reticle`): height
`var(--space-7)` (28 px), padding-inline `var(--space-2)`, radius `var(--radius-4)`, text
`var(--text-13)` `var(--graphite-700)`, indent `var(--space-4)` per depth. Branch rows
carry `aria-expanded`; every row carries `aria-selected`; one row holds `tabindex="0"`
(roving), the rest −1. Caret: an inline 12 × 12 SVG chevron, `stroke: var(--graphite-600)`,
`aria-hidden` (an SVG, deliberately — the vendored fonts' glyph-coverage IOU recorded in
the primitives-core Decision is not re-incurred), rotating 0° → 90° on expand over
`var(--motion-state)` `var(--ease)`; children appear without height animation. States —
hover: fill `var(--graphite-100)`, text `var(--graphite-900)`. Selected: 3 px inset beam
bar `var(--beam-500)` + fill `var(--beam-100)`, text `var(--graphite-900)` (R-UI-030,
verbatim). Keyboard: ArrowDown/ArrowUp move focus through visible rows; ArrowRight expands
a closed branch, else moves to first child; ArrowLeft collapses an open branch, else moves
to the parent; Home/End jump to first/last visible; Enter or Space selects and fires
`onSelect(id)`.

### ScrollArea (Radix, `cx-scrollarea`; viewport `data-testid="scrollarea-viewport"`)
Type hover. Scrollbar: 10 px hit area, track `background: none` (I-2); thumb
(`cx-scrollarea-thumb`): fill `var(--graphite-400)`, radius `var(--radius-12)`, hover
`var(--graphite-500)`. Bars fade in/out over `var(--motion-state)` `var(--ease)`.

### Resizable panels (react-resizable-panels; handle `data-testid="resizable-handle"`)
ResizablePanelGroup/ResizablePanel unstyled beyond `min-width: 0`. ResizableHandle
(`cx-resizable-handle cx-reticle`, role separator with `aria-valuenow`, arrow-key
operable): an 8 px hit area (I-1) painting a centred 1 px line `var(--graphite-200)`;
hover, drag and focus thicken it to 2 px `var(--beam-500)`, transitioning over
`var(--motion-state)` `var(--ease)`. Remembered sizes are out of scope (they bind to the
viewer, M1, per R-UI-005).

### DataTable (TanStack; root `cx-datatable`, `data-testid="datatable"`)
Root reflects `data-density` ("comfortable" default | "compact"). Inside it, in order:
- **Viewport** (`data-testid="datatable-viewport"`): the scroll container,
  `overflow: auto`, hairline border, radius `var(--radius-8)`. Virtualisation via
  @tanstack/react-virtual: a total-size spacer spans all rows; only rows near the viewport
  render, absolutely positioned.
- **Header** (`data-testid="datatable-header"`, role row of role columnheader cells):
  `position: sticky; top: 0; z-index: var(--z-sticky)`, fill `var(--graphite-50)`,
  border-bottom `var(--hairline)`, text `var(--text-12)` `var(--weight-body-medium)`
  `var(--graphite-600)`. A sortable column's header label is a button
  (`cx-datatable-sort cx-reticle`) cycling `aria-sort` ascending → descending → none on the
  columnheader; the direction arrow is a 12 px `aria-hidden` SVG, `stroke:
  var(--graphite-600)`, rendered only while sorted. A `meta.filterable` column renders the
  core Input (B-17 — never re-styled) with `data-testid="datatable-filter-{columnId}"` and
  `aria-label` "Filter " + the column header, beneath the label; typing narrows the rows.
- **Rows** (`data-testid="datatable-row"`, role row): height `var(--row-comfortable)` /
  `var(--row-compact)` by density, border-bottom 1 px solid `var(--graphite-200)` (hairline
  dividers, R-UI-005), fill `var(--graphite-0)`; hover fill `var(--graphite-50)`.
- **Cells** (`data-testid="datatable-cell"`, role cell): padding-inline `var(--space-3)`,
  `var(--text-13)` `var(--graphite-900)` (dense-table size, R-UI-003). `meta.align:
  'right'` → `data-align="right"`: text-align right in `var(--font-mono)` with
  `font-variant-numeric: tabular-nums slashed-zero` (right-aligned numerals, R-UI-005;
  every number mono, R-UI-003). Pinned cells (`data-pinned="left"|"right"`):
  `position: sticky` at their offset, opaque fill inherited from the row, a hairline seam
  on the scroll-facing edge, z above scrolling cells.
- **Inline edit** (`meta.editable`): the cell value renders as a button
  (`cx-datatable-cell-trigger cx-reticle`); Enter (or double-click) swaps it in place for
  an input `data-testid="datatable-cell-editor"` (core Input chrome, borderless fill
  `var(--graphite-0)`) pre-filled with the value; Enter commits — one
  `onCellEdit(rowId, columnId, value)` call — Escape cancels; either way focus returns to
  the cell trigger and layout never shifts.
- **Zero rows**: header renders above an empty viewport; the owning screen supplies the
  EmptyState — silence-never (R-UI-020) is the screen's obligation, since DataTable owns no
  copy. Loading likewise: skeleton rows from the consumer, never a spinner (R-UI-004).

## 4. Copy — the acceptance sample data, verbatim

DataTable columns: **Item** (`item`) · **Description** (`description`, filterable) ·
**Qty** (`qty`, align right, editable) · **Unit** (`unit`) · **Rate** (`rate`, align
right) · **Amount** (`amount`, align right). Rows, in order (amounts in lakh/crore
grouping per R-UI-010's number idiom):
`C-01 · Excavation in foundation · 240.00 · CUM · 185.00 · 44,400.00` ·
`C-02 · Sand filling under floor · 96.50 · CUM · 210.00 · 20,265.00` ·
`C-03 · Brick flat soling · 310.00 · SQM · 95.00 · 29,450.00` ·
`C-04 · RCC (1:1.5:3) in column · 18.75 · CUM · 7,850.00 · 1,47,187.50`.
The virtualisation set is generated: ids `R-1` … `R-1000`, description `Generated row {n}`,
declared once in the support roster (B-19). Dialog: title **Rename project**, an Input
labelled **Project name** with value **Riverside Tower**, secondary **Cancel**, primary
**Save changes**. Sheet: `aria-label` **Line details**, heading **Line details**, side
right. Popover: trigger ghost Button **Filters**, content text **Showing all 24 sheets.**
DropdownMenu: trigger secondary Button **Actions**; items **Rename** · **Duplicate** ·
**Delete line**. ContextMenu: items **Copy value** · **Pin column** · **Reset width**.
Toast: `toast('Export complete')`. Tabs: **Sheets** · **Disciplines** · **History**;
panels **24 sheets uploaded.** · **Structural, Architectural, Plumbing.** · **No changes
in the last 7 days.** Tree: **Structural** → **S-101 Foundation plan**, **S-201 Column
layout**, **S-301 Beam details**; **Architectural** → **A-101 Ground floor plan**,
**A-201 Elevations**. Voice: calm, concrete, no exclamation marks, no build vocabulary.

## 5. The R-UI-050 matrix, ruled

As primitives-core §5: a component set owes component states, not screen states. Every
component state is enumerated in §2–§3 — open/closed and focus-return for every overlay;
highlighted/disabled menu items; active/rest tabs; hover/selected/expanded/collapsed tree
rows; hover/drag/focus handle; and the DataTable's density, sort, filter, hover, pinned,
editing and zero-row states. The seven screen states belong to the composing screens'
Decisions; this file rules only that toasts never carry refusals and tables never spin.

## 6. Motion (R-UI-004) and themes

Complete list: Dialog/Sheet entrance `var(--motion-panel)` `var(--ease)` · Popover/menu
entrance, tab and tree colour changes, caret rotation, scrollbar fade, handle thicken
`var(--motion-state)` `var(--ease)` · every exit instant · sonner's own stack motion (I-4)
· reticle draw `var(--motion-reticle)` via core. No bounce anywhere. Every duration is a
token zeroed at source under reduced motion; sonner honours the media query itself.

Themes: no `[data-theme]` selector in either stylesheet; every light/dark difference rides
token values through the portal (the root attribute themes portalled content). Character
notes: the toast is the inverted surface in both themes; the scrim inks down in light and
fogs up in dark (I-3); everything else is the popup family on `var(--graphite-0)` with
hairline seams, identical in structure across themes.

## 7. Test hooks (closed contract, C-05)

Routes: none — no route ships in this increment. Test ids, exactly these sixteen, on the
elements ruled above: `dialog-content` · `sheet-content` · `popover-content` ·
`dropdown-content` · `contextmenu-content` · `datatable` · `datatable-header` ·
`datatable-viewport` · `datatable-row` · `datatable-cell` · `datatable-cell-editor` ·
`datatable-filter-{columnId}` · `tree` · `tree-item` · `scrollarea-viewport` ·
`resizable-handle`. Behavioural hooks without new ids: SheetContent `data-side`; DataTable
root `data-density`, cells `data-align`/`data-pinned`, columnheaders `aria-sort`; Tree
`aria-expanded`/`aria-selected`/roving tabindex; ResizableHandle role separator +
`aria-valuenow`; menus role menu/menuitem. Suites live under
`tests/ui/primitives-overlay-data/` with the `@vitest-environment jsdom` docblock, mount
under document-root `data-theme` light and dark, and gate axe at exactly serious/critical
= 0 (Q-11); stylesheet-derived facts (row heights, sticky, hairlines, contrast) are graded
by the gallery leaf's J-004 baselines.

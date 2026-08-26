# Design Decision — primitives-data (the overlay and data primitive sets)

Not a routed screen: the overlay set in `src/ui/primitives/overlay` — Dialog, Sheet, Popover,
DropdownMenu, ContextMenu, Toast (sonner) — and the data set in `src/ui/primitives/data` —
Tabs, Tree, ScrollArea, Resizable panels, DataTable. Law: R-UI-001/003/004/005/010/012, B-17,
B-19, Q-11. Consumers (R-UI-011): S-Settings and S-Audit tables (inc-010/inc-016), the
register workspace (M2); the `/design` gallery leaf later derives completeness from these two
barrels. Every convention of the primitives-core Decision binds here: `cx-` classes, variants
on data-attributes, tokens-only colour and motion, `cx-reticle` from the reticle's single home
`src/ui/primitives/core/reticle.css`, primitives own no product copy. Core's Interpretations
I-1 (geometry constants in px) and I-2 (no `transparent` keyword) remain in force.

## 0. Interpretations (recorded per the Law section of CLAUDE.md)

- **I-3 — the scrim is the app ground at 60 % opacity.** No token names a scrim colour, and
  I-2 bans `transparent`. Ruling: the Dialog/Sheet overlay is `background: var(--graphite-0)`
  with `opacity: 0.6` — the page recedes into its own background. Because graphite-0 is the
  theme-stable app-ground role, the veil is light in light and dark in dark with no
  `[data-theme]` selector.
- **I-4 — sonner's internal motion is library-owned.** Every duration in CSS this increment
  authors is a token. Sonner's enter/exit transforms live in its own runtime styles;
  re-keyframing them would fork the library (the B-17 smell). Ruling: sonner's built-in
  motion is accepted as-is; it honours `prefers-reduced-motion` natively. Colour, type,
  radius, border and shadow of every toast are ours, via tokens (§2).
- **I-5 — in-table inputs are the core Input.** The DataTable's filter fields and inline
  cell editor render the shipped core `Input` (`cx-input cx-reticle`) unchanged — a table
  that re-implements an input's chrome is exactly what B-17 blocks. Core's 32 px control
  height stands in the header filter row and the editor regardless of density.
- **I-6 — a filtered-to-empty table stays silent; the screen speaks.** Primitives own no
  product copy, and the DataTable prop set is closed. With zero visible rows the table
  renders header (and filter row) over an empty viewport; the owning screen's R-UI-050
  empty/partial states owe the explanation (R-UI-020). A message invented here would be
  copy no consumer wrote.

## 1. Shared anatomy

- Files: components in `src/ui/primitives/overlay/*.tsx` + one stylesheet
  `src/ui/primitives/overlay/overlay.css`; `src/ui/primitives/data/*.tsx` +
  `src/ui/primitives/data/data.css`. Neither file contains a `[data-theme]` selector or a
  focus-indicator rule — the reticle has one home (B-17).
- Every overlay Content (Dialog, Sheet, Popover, DropdownMenu, ContextMenu, sonner's
  toaster) portals to `document.body`, so `[data-theme]` at the document root themes it and
  no ancestor `overflow` or stacking context can clip or out-rank it (the core Tooltip
  ruling). Z-layers: overlay content `var(--z-overlay)`, toasts `var(--z-toast)`, the
  DataTable's sticky header `var(--z-sticky)`.
- Overlay card chrome, shared: fill `var(--graphite-0)`, border `var(--hairline)`, radius
  `var(--radius-8)`. Elevation grades by weight: menus and Popover `var(--shadow-2)`,
  Dialog and Toast `var(--shadow-3)`, Sheet `var(--shadow-4)`.
- Type: control and body text `var(--font-ui)` `var(--text-13)` (dense-surface base,
  R-UI-003); titles `var(--text-16)` `var(--weight-heading)` `var(--graphite-900)`;
  captions `var(--text-12)` `var(--graphite-600)`. Every numeral in the DataTable renders
  `var(--font-mono)` with `font-variant-numeric: tabular-nums slashed-zero`.
- Every focusable element — triggers, close buttons, menu items, tab triggers, tree items,
  resize handles, sort buttons, cell-edit targets — carries `cx-reticle`.
- ARIA: DialogContent requires an accessible name (a `DialogTitle` or `aria-label`);
  SheetContent, which exports no title part, requires `aria-label`. An unnamed instance is
  a defect. Decorative marks (chevrons, sort arrows, close glyphs) are `aria-hidden`.

## 2. The overlay set — layout, states, tokens

### Dialog (`cx-dialog`, Radix Dialog, modal)
Scrim per I-3, `position: fixed; inset: 0`. Content: portalled, centred, width
`min(480px, calc(100vw - var(--space-8)))`, max-height `calc(100dvh - var(--space-12))`
with `overflow: auto`, padding `var(--space-5)`, card chrome + `var(--shadow-3)`,
`role="dialog"` `aria-modal="true"`. `DialogTitle` renders the title style (§1).
`DialogClose`: a `var(--space-6)` square ghost button, top-right inset `var(--space-3)`,
✕ glyph (`aria-hidden`, drawn as text) in `var(--graphite-600)`; hover fill
`var(--graphite-100)`, glyph `var(--graphite-900)`; requires `aria-label`. Open: focus
moves into the content; Escape and the scrim close; focus returns to the trigger.
Entrance: scrim and content fade opacity 0 → 1, content scale 0.98 → 1, over
`var(--motion-state)` `var(--ease)`; exit instant (the core convention).

### Sheet (`cx-sheet`, side panel on Radix Dialog, modal)
Scrim per I-3. Content: portalled, fixed full-height at the `side` edge (`"right"` default
| `"left"`, reflected as `data-side`), width `min(420px, calc(100vw - var(--space-10)))`,
padding `var(--space-5)`, `overflow: auto`, fill `var(--graphite-0)`, `var(--shadow-4)`,
radius 0, and a `var(--hairline)` border on the inner edge only (left border when
`data-side="right"`, right border when `"left"`). `role="dialog"` `aria-modal="true"`,
`aria-label` required. Entrance: slides from its edge (translateX 100 % / −100 % → 0) over
`var(--motion-panel)` `var(--ease)` while the scrim fades over `var(--motion-state)`; exit
instant. Escape closes; focus returns to the trigger.

### Popover (`cx-popover`, Radix Popover, non-modal)
Content: portalled, card chrome + `var(--shadow-2)`, padding `var(--space-4)`, max-width
280 px (core's tooltip measure, I-1), side bottom, `sideOffset` 6, text `var(--text-13)`
`var(--graphite-900)`. Trigger activation toggles it; Escape and outside-click close;
focus returns to the trigger. Entrance: opacity 0 → 1 with a 2 px rise over
`var(--motion-state)` `var(--ease)`; exit instant.

### DropdownMenu · ContextMenu (`cx-menu`, one chrome, Radix)
Content: portalled, `role="menu"`, card chrome + `var(--shadow-2)`, padding
`var(--space-1)`, min-width 180 px (I-1). DropdownMenu opens on trigger activation, side
bottom, `sideOffset` 6; ContextMenu opens at the pointer on a `contextmenu` event on its
trigger. Item (`cx-menu-item`, `role="menuitem"`): height `var(--space-7)`, padding-inline
`var(--space-2)`, radius `var(--radius-4)`, text `var(--text-13)` `var(--graphite-900)`.
States — highlighted (`[data-highlighted]`, pointer and keyboard unified by Radix): fill
`var(--beam-100)`. Danger (`data-variant="danger"`): text `var(--danger)`; highlighted:
fill `var(--danger-surface)`. Disabled (`[data-disabled]`): text `var(--graphite-600)`,
`cursor: not-allowed` (core's no-carve-out ruling). ArrowDown/ArrowUp move the highlight;
Enter invokes the item's `onSelect` exactly once and closes the menu; Escape closes
without invoking; both return focus to the trigger. Entrance: opacity 0 → 1 with a 2 px
rise over `var(--motion-state)` `var(--ease)`; exit instant.

### Toast (`Toaster` + re-exported `toast`, sonner)
Toaster: `position="bottom-right"`, portalled by sonner to `document.body`,
`z-index: var(--z-toast)`. Toast card, styled via sonner's class hooks in tokens only:
fill `var(--graphite-0)`, border `var(--hairline)`, `var(--shadow-3)`, radius
`var(--radius-8)`, padding `var(--space-3)` `var(--space-4)`; title `var(--text-13)`
`var(--weight-body-medium)` `var(--graphite-900)`; description `var(--text-12)`
`var(--graphite-600)`. Motion per I-4. Duration sonner default; toasts are additive
status, never the sole carrier of a refusal (R-UI-020 — the screen renders that in place).

## 3. The data set — layout, states, tokens

### Tabs (`cx-tabs`, Radix Tabs)
TabsList: a row, gap `var(--space-1)`, border-bottom `var(--hairline)`. TabsTrigger
(`cx-reticle`): height `var(--space-8)`, padding-inline `var(--space-3)`, `var(--text-13)`
`var(--weight-body-medium)`, text `var(--graphite-600)`; hover `var(--graphite-900)`;
active (`data-state="active"`): text `var(--graphite-900)` with a 2 px underline in
`var(--beam-500)` flush to the list's hairline — selection rides the beam plus the text
shift, a second channel. Disabled (`[data-disabled]`): text `var(--graphite-600)`,
`cursor: not-allowed` (core's no-carve-out ruling). Content switch is instant — a
tab change is navigation, not theatre. TabsContent: padding-top `var(--space-4)`, no
chrome, focusable per Radix default.

### Tree (`cx-tree`, hand-rolled, `role="tree"`)
Rows (`cx-tree-item`, `role="treeitem"`, `cx-reticle`): height `var(--space-7)`,
padding-left `calc(var(--space-2) + depth × var(--space-4))`, radius `var(--radius-4)`,
text `var(--text-13)` `var(--graphite-900)`. A parent renders `aria-expanded` and an
inline-SVG chevron (`aria-hidden`, 12 px, stroke `var(--graphite-600)` at 2 px per I-1)
rotating 90° when expanded over `var(--motion-state)` `var(--ease)`; a leaf renders a
spacer, never `aria-expanded`. States — hover: fill `var(--graphite-100)`. Selected
(`aria-selected="true"`): fill `var(--beam-100)`, `var(--weight-heading)` (the non-colour
second channel, as core's Chip). Roving tabindex: exactly one item is tabbable — the item the
arrows last landed on, so Tab leaves the tree and Shift+Tab returns to where the keyboard
was; before any focus it is the selected item, else the first. Keyboard: ArrowDown/ArrowUp move focus; ArrowRight
expands or enters children; ArrowLeft collapses or moves to the parent; Home/End jump;
Enter/Space select and invoke `onSelect`. Expand/collapse is instant; only the chevron
turns.

### ScrollArea (`cx-scrollarea`, Radix ScrollArea, `type="hover"`)
Viewport: the consumer's box, no chrome of its own; it is itself a tab stop
(`tabindex="0"`, `cx-reticle`) so a region that scrolls can be scrolled from the keyboard
and shows the reticle while it is (R-UI-012). Scrollbar: an 8 px strip (I-1), no
track fill; thumb fill `var(--graphite-300)`, radius `var(--radius-4)`, hover
`var(--graphite-400)`. Bars fade in on hover/scroll and out after 600 ms, opacity over
`var(--motion-state)` `var(--ease)`.

### Resizable panels (`cx-resizable`, react-resizable-panels)
Handle (`cx-resizable-handle`, `role="separator"` with `aria-valuenow`, `cx-reticle`): an
8 px hit strip (I-1) carrying a centred 1 px line in `var(--graphite-200)`; hover: line
`var(--graphite-400)`; dragging (`[data-resize-handle-active]`): line 2 px in
`var(--beam-500)`. Line colour/width transition over `var(--motion-state)` `var(--ease)`;
the panels themselves move with the pointer, untweened. Arrow keys resize from the
keyboard (library behaviour). Remembered sizes are not wired here (they bind to the
viewer, M1, per R-UI-005).

### DataTable (`cx-table`, TanStack Table + TanStack Virtual)
Root: `role="table"`, `aria-rowcount` = data length + 1, `data-density` reflecting the
prop (`"comfortable"` default | `"compact"`). Scroll container `cx-table-viewport`
(`overflow: auto`) holds a sticky header and the virtualiser's total-size element with
absolutely positioned rows — a plain scroll div, not ScrollArea (the virtualiser owns the
measurements).
- **Header** (sticky top 0, `z-index: var(--z-sticky)`, fill `var(--graphite-0)`,
  border-bottom `var(--hairline)`): cells `role="columnheader"`, `var(--text-12)`
  `var(--weight-body-medium)` `var(--graphite-600)`, padding-inline `var(--space-3)`. A
  sortable column wraps its label in a ghost sort button (`cx-reticle`) cycling the
  header's `aria-sort` ascending → descending → none; while sorted the label reads
  `var(--graphite-900)` with an ↑/↓ glyph (`aria-hidden`) in `var(--beam-600)`. When any
  column has `meta.filterable`, a second header row renders the core Input (I-5) per
  filterable column, `aria-label` = `Filter` + the column header; typing narrows rows.
- **Rows** (`role="row"`, `aria-rowindex`): height `var(--row-comfortable)` /
  `var(--row-compact)` by `[data-density]` (R-UI-005), border-bottom `var(--hairline)`,
  hover fill `var(--graphite-50)`.
- **Cells** (`role="cell"`): padding-inline `var(--space-3)` (compact: `var(--space-2)`),
  `var(--text-13)` `var(--graphite-900)`. `meta.align: 'right'` → `data-align="right"`,
  right-aligned, `var(--font-mono)` tabular-nums slashed-zero (numerals, R-UI-005/003).
- **Pinning**: cells of a pinned column carry `data-pinned="left"|"right"`, `position:
  sticky` at the computed offset, opaque fill `var(--graphite-0)` (row hover fill wins on
  hover), and a `var(--hairline)` seam on the inner edge.
- **Inline edit** (`meta.editable` + `onCellEdit`): the cell's value renders inside a
  full-cell ghost button (`cx-reticle`); Enter/Space or double-click swaps it for the core
  Input (I-5), value prefilled, `aria-label` = the column header, focused on mount. Enter
  or blur commits — one `onCellEdit(rowId, columnId, value)` call; Escape cancels; either
  way focus returns to the cell button. No optimistic styling: the consumer re-renders
  the committed value.
- **Empty after filter**: per I-6. Loading: the owning screen keeps layout with Skeleton
  rows — never a spinner on a table (R-UI-004).

## 4. Copy — the acceptance sample data, verbatim (the roster's canonical states)

- Dialog: trigger **Rename project** · title **Rename project** · body **The new name
  appears on every export and drawing sheet.** · core Input labelled **Project name**
  value **Riverside Tower** · close `aria-label` **Close** · footer secondary **Cancel**,
  primary **Save changes**.
- Sheet (side right): trigger **Line details** · `aria-label` **Line details** · heading
  **Line 4 — Footing F-8** · body **Basis and quantity for the selected register line.**
- Popover: trigger (ghost) **Column options** · content **Sort, filter and pin from the
  column header.**
- DropdownMenu: trigger **Row actions** · items **Duplicate line** · **Copy quantity** ·
  **Delete line** (danger).
- ContextMenu: trigger surface **Right-click for drawing actions** · items **Open in
  viewer** · **Rename** · **Remove from project** (danger).
- Toast: title **Quantity updated** · description **Line 4 — 7.25 CUM saved to the
  register.**
- Tabs: triggers **Overview** · **Quantities** · **History**; panels, in order:
  **Everything the project knows about this sheet.** · **Quantities grouped by element
  class.** · **Every change, newest first.**
- Tree: **Riverside Tower** › **Structural** › **S-101 — Column layout**, **S-102 —
  Ground beams**; **Architectural** › **A-201 — Level 1 plan**. Default expanded:
  Riverside Tower, Structural; selected: **S-101 — Column layout**.
- ScrollArea: forty lines reading **Sheet 1 of 40** … **Sheet 40 of 40**.
- Resizable: two panels **Sheet list** (30) and **Viewer** (70); handle `aria-label`
  **Resize panels**.
- DataTable columns: **Item** (id `item`, filterable, pinned left in the pinning state) ·
  **Element** · **Qty** (align right, sortable, editable) · **Unit** · **Basis**. Rows:
  **Line 1** Column C-12 4.80 CUM MEASURED · **Line 2** Beam GB-3 12.60 CUM DERIVED ·
  **Line 3** Slab S-2 96.00 SQM TRANSCRIBED · **Line 4** Footing F-8 7.25 CUM INTERPRETED
  · **Line 5** Column C-4 3.10 CUM ENTERED. The virtualisation set is generated: rows
  n = 1…1000 with item **Line {n}**, element cycling **Column, Beam, Slab, Footing**, qty
  **{n}.00**, unit **CUM**, basis cycling the seven basis names.

Voice: labels verb-first and plain; no exclamation marks; no build vocabulary.

## 5. The R-UI-050 matrix, ruled

A component set, not a screen: the seven screen states belong to the composing screens'
Decisions (core's §5 ruling stands). What this file owes is every component state,
enumerated in §2–3: open/closed and side for overlays; highlighted/danger/disabled for
menu items; active/disabled for tabs; expanded/collapsed/selected/hover for tree items;
sort direction, filtered, editing, pinned, density and hover for the DataTable; dragging
for the resize handle. Loading vocabulary is Skeleton rows in place (§3); empty is I-6.

## 6. Motion (R-UI-004) and themes

Motion, complete: dialog/popover/menu entrance and the scrim fade `var(--motion-state)`
`var(--ease)` · sheet slide `var(--motion-panel)` `var(--ease)` · chevron turn, scrollbar
fade, handle and hover colour transitions `var(--motion-state)` `var(--ease)` · toast per
I-4 · tab switch, tree expand and virtualised scrolling instant · all exits instant · no
bounce. Every authored duration is a token zeroed at source under reduced motion; the
reticle's explicit reduce branch lives in its single home.

Themes: `overlay.css` and `data.css` contain no `[data-theme]` selector — every light/dark
difference arrives through token values (R-UI-001). The scrim flips with graphite-0 (I-3);
shadows deepen in dark per the shadow tokens; beam, danger and graphite pairs hold the
R-UI-012 floors on the founder values as ruled in core §6. Portalling to `document.body`
is what keeps overlays themed: the root `[data-theme]` is always their ancestor.

## 7. Test hooks (closed contract, C-05)

Routes: none. Test ids, exactly these, on the elements ruled above: `dialog-content` ·
`sheet-content` · `popover-content` · `dropdown-content` · `contextmenu-content` ·
`datatable` (root) · `datatable-header` · `datatable-viewport` · `datatable-row` ·
`datatable-cell` · `datatable-cell-editor` · `datatable-filter-{columnId}` (e.g.
`datatable-filter-item`) · `tree` · `tree-item` · `scrollarea-viewport` ·
`resizable-handle`. Behavioural hooks without new ids: `data-side` on sheet-content;
`data-density` on datatable; `data-align`/`data-pinned` on cells; `aria-sort` on column
headers; `role="dialog"`/`aria-modal`, `role="menu"`/`role="menuitem"`,
`role="tree"`/`role="treeitem"` with `aria-expanded`/`aria-selected`; Radix `data-state`;
`aria-valuenow` on the separator; `cx-reticle` on every focusable element. Suites run
under jsdom in both root themes; stylesheet facts (36/28 px rows, hairlines, sticky,
contrast) are graded by the gallery leaf's J-004 baselines, per the increment's risk
notes.

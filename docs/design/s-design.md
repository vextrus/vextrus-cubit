# Design Decision — S-Design (/design)

The living gallery (R-UI-011): every component the three Datum barrels export, rendered in every
state this document names, with sample data, in both themes. It is gate evidence (AM-03 (4)):
the J-004 baselines `gallery-light` and `gallery-dark` are screenshots of exactly this page.
Component anatomy is fixed by `docs/design/datum-primitives.md` and
`docs/design/datum-patterns.md`; this document decides only what the page shows and says. No
colour literal anywhere (R-UI-001); every string a reader sees comes from the typed table in §6.

**Amendment (inc-007, settled reading on §2 vs §9 / R-UI-012 / Q-11).** The state-name label is
`--graphite-600`, not the `--graphite-500` §2 and §8 first named. `--graphite-500` on this
page's `--graphite-50` measures 3.01:1 at 12 px — 43 serious axe violations on both
checkpoints, and §9 of this same document promises these labels hold at least 4.5:1. The
contrast floor outranks the shade, so the shade moves and the document says so here rather
than leaving the built page and the committed decision to disagree (AM-03: this file, not a
comment in a stylesheet, is what the build is graded against). §2 and §8 below carry the
corrected token.

## 1. Route and theme

- `GET /design`. `?theme=dark` sets `data-theme="dark"` on `<html>`; `?theme=light`, an unknown
  value, or no query sets `data-theme="light"`. `<html>` carries `lang="en"`. Document title:
  `design.docTitle`.
- The page is statically renderable: no fetch, no auth, no live data. First paint is the content.

## 2. Layout and hierarchy

- Page background `--graphite-50`; one centred column, max-width `--breakpoint-lg` (1280 px),
  padding `--space-8`, `--font-ui`, base `--text-14`, `--leading-ui`. No sticky chrome — the
  full-page screenshot must stitch cleanly.
- Root is `<main data-testid="design-gallery">`.
- **Header:** `<h1>` `design.title`, `--text-24` `--weight-heading` `--graphite-950`; under it
  the lede `design.lede`, `--text-13` `--graphite-600`; then a `<nav>` named `design.theme.label`
  holding two links — `design.theme.light` → `/design?theme=light`, `design.theme.dark` →
  `/design?theme=dark` — `--text-13`, styled as EvidenceLink (cobalt, underlined); the current
  theme's link carries `aria-current="page"` and renders `--graphite-900` `--weight-body-medium`,
  not underlined.
- **Groups:** three sections headed `<h2>` `design.group.primitives` / `.patterns` / `.data`,
  `--text-20` `--weight-heading` `--graphite-950`, `--space-8` above each. An entry belongs to
  the barrel that exports its first `covers` name; entries keep registry order, which is barrel
  order (§3).
- **Entry:** `<section data-testid="gallery-entry-<slug>">`, `--space-6` below the group head.
  `<h3>`: the entry's `covers` names joined with ` · `, `--font-mono` `--text-14`
  `--weight-heading` `--graphite-900` — export identifiers are data, not copy.
- **State block:** inside each entry, one block per state, laid out in a wrapping row, gap
  `--space-4`. A block is a `<div data-gallery-state="<state name>">`: the state name as a label,
  `--font-mono` `--text-12` `--graphite-600`, above a specimen card — background `--graphite-0`,
  hairline border `--graphite-200`, `--radius-8`, padding `--space-4`, min-width 240 px.
  DataTable and ConsequenceDialog blocks span the full column width.
- One `<Toaster />` mounts once at page root (its region is a fixed singleton at `--z-toast`);
  the toast entry's trigger feeds it.
- Dominance: the specimens dominate; page chrome (labels, headings) recedes into small grey
  mono. The page is an instrument for comparing components, not a document about them.

## 3. The entry roster

`src/app/design/registry.tsx` exports `galleryEntries` in exactly this order. `covers` lists the
barrel exports demonstrated (AC-2's union must equal the barrels' capitalised value exports —
`toast` is lowercase and needs no entry). State names below are the verbatim
`data-gallery-state` values. Sample copy keys are §6; bare values shown here (marks, numbers,
identifiers) are sample data rendered verbatim from the registry, not copy.

| slug | covers | states | specimen |
|---|---|---|---|
| button | Button, IconButton | primary · secondary · ghost · danger · disabled · loading · icon-button | labels: save / duplicate / dismiss / deleteRow; disabled + loading reuse save; IconButton: × glyph (16 px inline SVG, `aria-hidden`), label close |
| input | Input, Textarea | default · disabled · invalid · textarea | label projectName, placeholder untitledProject; invalid: label storeyHeight, value `three`, adjacent message storeyHeightMsg in `--danger` `--text-12`; textarea: label notes, value notesValue |
| number-input | NumberInput | default · disabled · invalid | label concreteVolume, unit `m³`; default value `1234567.895` (blurred → displays `12,34,567.895`); disabled value `250`; invalid value `0` with `aria-invalid` |
| checkbox | Checkbox | unchecked · checked · indeterminate · disabled | each labelled includeOpenings |
| radio-group | RadioGroup, Radio | default · disabled | group labelled rowDensity, options comfortable (chosen) and compact |
| switch | Switch | off · on · disabled | labelled snapToGrid |
| slider | Slider | single · range | single: label sheetOpacity, 0–100, value 60; range: label storeyRange, 1–40, values 3 and 12 |
| select | Select, SelectTrigger, SelectValue, SelectContent, SelectItem | placeholder · selected · disabled | label elementClass, placeholder elementPlaceholder, options wall/column/beam/slab; selected shows column. Closed; opening is interaction |
| combobox | Combobox | default · disabled | label condition, placeholder conditionPlaceholder; loader resolves conditionC25Columns/C25Walls/Formwork for any query, nothing for a query containing `z` — so options, loading and empty list states are all reachable by typing (they open on interaction; a listbox cannot sit open in a static page) |
| tabs | Tabs, TabsList, TabsTrigger, TabsContent | default | triggers tabQuantities (active) / tabSources / tabHistory; panels tabQuantitiesBody / tabSourcesBody / tabHistoryBody |
| tooltip | Tooltip, TooltipTrigger, TooltipContent | trigger | ghost button measuredBasis; content measuredTooltip (opens on hover/focus) |
| popover | Popover, PopoverTrigger, PopoverContent | trigger | secondary button columnRef; content columnDetail |
| dropdown-menu | DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem | trigger | secondary button actions; items duplicate, rename, delete (destructive) |
| context-menu | ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger | trigger | a hairline-bordered 240 px region reading contextTarget in `--graphite-600`; items copyValue, traceToDrawing, clearCell |
| dialog | Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription, DialogClose | trigger | **the contractual interactive Dialog.** Secondary trigger renameSheet; Title renameSheet, Description renameSheetBody, an Input labelled sheetName with value `S-201 Column layout`; footer: DialogClose secondary cancel, primary saveShort (also closes — the sample commits nothing) |
| sheet | Sheet, SheetTrigger, SheetContent, SheetTitle, SheetClose | trigger | secondary trigger openInspector; Title inspector, body line inspectorEmpty, SheetClose secondary button close |
| toast | Toaster | trigger | secondary button showNotification fires `toast(estimateSaved)` |
| badge | Badge | neutral · success · warn · danger · info | labels draft / signed / stale / voided / importedBadge |
| tag | Tag | default · removable | label level3; removable passes `onRemove` |
| kbd | Kbd | default | two Kbd caps: `⌘` `K` |
| progress | Progress | zero · midway · complete | named importProgress; values 0 / 64 / 100 of 100 |
| skeleton | Skeleton | default | three bars sized like two text lines (16 px) over a 36 px row — layout-keeping shapes |
| separator | Separator | horizontal · vertical | between two `--text-13` lines reusing tabQuantities / tabSources |
| empty-state | EmptyState | with-action · without-action | noDrawingsTitle + noDrawingsTeach + action uploadDrawing (R-UI-033's teaching example); noSignaturesTitle + noSignaturesTeach |
| error-state | ErrorState | default | report id `RPT-3F82C1`, `onRetry` no-op |
| partial-notice | PartialNotice | default | refused count 3 |
| offline-banner | OfflineBanner | default | — |
| permission-denied | PermissionDenied | default | permission `estimate.sign`, holder holder |
| refusal-state | RefusalState, EvidenceLink | default | code `PRECISION_NOT_APPLIED` (message and remedy come from the REFUSALS register); evidence link labelled viewSheet, href `#` |
| evidence-link | EvidenceLink | default · labelled | default label from the patterns table; labelled viewSheet; both href `#` |
| consequence-dialog | ConsequenceDialog | trigger | primary trigger voidSignature; title voidTitle; lines voidSignatures 1 · voidUnfrozen 214 · voidSuperseded 3; confirm resolves `{ ok: true }` |
| data-table | DataTable | default · selected · grouped · empty · loading | §4 |
| basis-chip | BasisChip | measured · transcribed · derived · imported · entered · interpreted · defaulted | one chip per code — the full R-UI-002 palette and glyph set on one screen |
| coverage-chip | CoverageChip | default | covered 12, total 14 → `12 of 14` |
| unit-badge | UnitBadge | units | all five units side by side: m, m², m³, kg, nos |

## 4. DataTable specimen

Columns: colMark (`mark`, sortable, 96 px), colElement (`element`), colQuantity (`quantity`,
`meta.numeric`, sortable), colBasis (`basis`, cell renders a BasisChip). Eight rows, height 280,
`estimateRowHeight` 36 (comfortable, R-UI-005), sorted ascending by mark, footer: total left,
`96.510` right-aligned `.numeric`:

C-01 Wall 12.400 MEASURED · C-02 Column 3.240 MEASURED · C-03 Beam 5.130 TRANSCRIBED ·
C-04 Slab 48.600 DERIVED · C-05 Wall 9.860 IMPORTED · C-06 Column 3.240 ENTERED ·
C-07 Beam 4.480 INTERPRETED · C-08 Slab 9.560 DEFAULTED

- **default**: as above. **selected**: same, `enableRowSelection`, row C-02 selected (checked
  box + `--cobalt-100` tint). **grouped**: same data, `grouping: ['element']`, groups expanded.
  **empty**: no rows, `emptyReason` tableEmpty — the header still teaches the shape.
  **loading**: the composing-screen recipe from datum-patterns §4 — four Skeleton bars, 36 px
  tall, full width, `--space-1` gaps, in place of the table. No spinner exists on this page.

## 5. Screen states (R-UI-050)

/design is a static instrument: no fetch, no act, no permission gate, no live rows. Each
R-UI-050 state is decided, and each is *demonstrated* by its pattern entry even where the screen
itself cannot enter it:

- **Loading:** none — the page is statically rendered; there is no interval between mount and
  content, so a skeleton would be theatre. Demonstrated by `skeleton` and `data-table` loading.
- **Empty:** if `galleryEntries` is empty the page renders EmptyState with `design.empty.title`
  and `design.empty.teach` (no action button). Unreachable while AC-2's completeness test is
  green, but the page never renders silently blank (R-UI-020).
- **Error:** no error boundary, deliberately. A specimen that throws must fail J-004 loudly —
  gate evidence that self-heals is not evidence. ErrorState is demonstrated by its entry.
- **Refusal / partial / permission-denied:** nothing here refuses, partially loads, or is
  gated; each is demonstrated by its entry (`refusal-state`, `partial-notice`,
  `permission-denied`).
- **Offline:** the page holds no live data and performs no writes; offline changes nothing
  after load. OfflineBanner is demonstrated by its entry.

## 6. Copy, verbatim

`src/app/design/strings.ts` exports `DESIGN_STRINGS`, frozen, typed as the other module tables
are (derived key type; a missing key is a compile error). The page and registry read only this
table; identifiers and numerals (marks, quantities, `RPT-3F82C1`, `estimate.sign`,
`S-201 Column layout`, `three`, `⌘`, `K`, unit codes, refusal codes) are sample data, rendered
verbatim from the registry. Keys below drop the `design.sample.` prefix where shown bare in §3.

Label keys, verbatim, as `key` → value runs (page keys first, then `design.sample.*` bare):

- `design.docTitle` → Datum gallery · `design.title` → Datum · `design.theme.label` → Theme ·
  `design.theme.light` → Light · `design.theme.dark` → Dark ·
  `design.group.primitives` → Primitives · `design.group.patterns` → Patterns ·
  `design.group.data` → Data
- `save` → Save estimate · `duplicate` → Duplicate · `dismiss` → Dismiss ·
  `deleteRow` → Delete row · `close` → Close · `projectName` → Project name ·
  `untitledProject` → Untitled project · `storeyHeight` → Storey height (m) · `notes` → Notes ·
  `concreteVolume` → Concrete volume · `includeOpenings` → Include openings deduction
- `rowDensity` → Row density · `comfortable` → Comfortable · `compact` → Compact ·
  `snapToGrid` → Snap to grid · `sheetOpacity` → Sheet opacity · `storeyRange` → Storey range ·
  `elementClass` → Element class · `elementPlaceholder` → Choose an element class ·
  `wall` → Wall · `column` → Column · `beam` → Beam · `slab` → Slab
- `condition` → Condition · `conditionPlaceholder` → Search conditions ·
  `conditionC25Columns` → C25 concrete, columns · `conditionC25Walls` → C25 concrete, walls ·
  `conditionFormwork` → Formwork, columns · `tabQuantities` → Quantities ·
  `tabSources` → Sources · `tabHistory` → History · `measuredBasis` → Measured basis ·
  `columnRef` → Column C-14
- `actions` → Actions · `rename` → Rename · `contextTarget` → Right-click for row actions ·
  `copyValue` → Copy value · `traceToDrawing` → Trace to drawing · `clearCell` → Clear cell ·
  `renameSheet` → Rename sheet · `sheetName` → Sheet name · `cancel` → Cancel ·
  `saveShort` → Save · `openInspector` → Open inspector · `inspector` → Inspector ·
  `showNotification` → Show a notification · `estimateSaved` → Estimate saved.
- `draft` → Draft · `signed` → Signed · `stale` → Stale · `voided` → Void ·
  `importedBadge` → Imported · `level3` → Level 3 · `importProgress` → Import progress ·
  `uploadDrawing` → Upload a drawing · `viewSheet` → View sheet S-201 ·
  `voidSignature` → Void a signature · `voidSignatures` → Signatures voided ·
  `voidUnfrozen` → Quantities unfrozen · `voidSuperseded` → Documents marked superseded ·
  `colMark` → Mark · `colElement` → Element · `colQuantity` → Quantity (m³) ·
  `colBasis` → Basis · `total` → Total · `holder` → Ayesha Rahman, the project owner

Sentence copy:

| Key | Value |
|---|---|
| `design.lede` | Every Datum component in every state it defines, with sample data, in both themes. What this page shows is what ships. |
| `design.empty.title` | The gallery has no entries. |
| `design.empty.teach` | Register each component in the gallery registry to render it here. |
| `design.sample.storeyHeightMsg` | Enter a number in metres. |
| `design.sample.notesValue` | North wing columns re-measured after revision B. |
| `design.sample.tabQuantitiesBody` | Quantities are grouped by element class and carry their basis. |
| `design.sample.tabSourcesBody` | Each quantity names the sheet and the entities it was measured from. |
| `design.sample.tabHistoryBody` | Every change keeps its author, time and reason. |
| `design.sample.measuredTooltip` | Taken from the drawing with the measure tools. |
| `design.sample.columnDetail` | Marked C-14 · Level 3 · 400 × 600 mm. |
| `design.sample.renameSheetBody` | The new name appears in the register and on printed documents. |
| `design.sample.inspectorEmpty` | Nothing is selected. Choose an entity on the sheet to inspect it. |
| `design.sample.noDrawingsTitle` | No drawings yet. |
| `design.sample.noDrawingsTeach` | Upload a drawing to start measuring quantities. |
| `design.sample.noSignaturesTitle` | No signatures yet. |
| `design.sample.noSignaturesTeach` | Sign the estimate to freeze its quantities. |
| `design.sample.voidTitle` | Void the signature on Estimate 4? |
| `design.sample.tableEmpty` | No items measured yet. Measure a condition on the sheet to add rows. |

Calm, concrete, sentence case, no exclamation marks. The refusal message/remedy come from the
REFUSALS register; the patterns' own copy (error title, offline line, permission body, stale and
failed notices) comes from `PATTERNS_STRINGS` — this table never restates either.

## 7. Motion (R-UI-004)

The page adds no motion of its own: no entry transitions, no scroll effects. All motion on this
screen is the components' (their tables in the primitives/patterns decisions). The two loops
that would run at rest — the loading Button's busy bar and the Skeleton pulse — are stilled
under `prefers-reduced-motion` by primitives.css, and J-004 captures with animations disabled,
so the baselines are deterministic either way.

## 8. Tokens

Page chrome uses only: `--graphite-50` (page), `--graphite-0` (specimen cards),
`--graphite-200` (hairlines), `--graphite-600/900/950` (labels, lede, headings),
`--cobalt-500/600` (theme links, via the EvidenceLink treatment), `--space-1/2/4/6/8`,
`--radius-8`, `--text-12/13/14/20/24`, `--font-ui`, `--font-mono`, `--weight-heading`,
`--weight-body-medium`, `--leading-ui`, `--breakpoint-lg`, `--danger` (the field-message
specimen's error text), `--z-toast` (via Toaster).

> Amended (inc-007, on a review finding): `--space-2` and `--danger` were spent by the built
> stylesheet but missing from this list. `--space-2` is the tight rhythm inside a specimen —
> the gap between a choice control and its label, between key caps, between stacked
> separators, in a dialog or table footer — a step the coarser `--space-4` cannot carry
> without the specimens reading as separate blocks; `--danger` is the one token that can
> paint an error message, and §3 requires the Field error state to be shown. The list is
> corrected rather than the stylesheet, the way §2's label shade was.
Fonts are the token stacks only — nothing is loaded that the repo does not ship (an unshipped
font is a recorded design-finding class).

## 9. Both themes

Everything reads role-stable tokens, so `?theme=dark` flips the whole page through the token
sheet: page `--graphite-50` goes near-black, cards stay `--graphite-0` surfaces, hairlines and
text hold their contrast ratios (≥ 4.5:1, R-UI-012). The entry set, order and copy are byte-
identical across themes — the two baselines differ only in paint. The theme nav's
`aria-current` moves to the link matching the rendered theme.

## 10. Test hooks (C-05)

- Routes: `/design`, `/design?theme=light`, `/design?theme=dark`.
- `data-testid="design-gallery"` on the page root.
- `data-testid="gallery-entry-<slug>"` on each entry section — the slugs are exactly §3's roster
  (button, input, number-input, checkbox, radio-group, switch, slider, select, combobox, tabs,
  tooltip, popover, dropdown-menu, context-menu, dialog, sheet, toast, badge, tag, kbd,
  progress, skeleton, separator, empty-state, error-state, partial-notice, offline-banner,
  permission-denied, refusal-state, evidence-link, consequence-dialog, data-table, basis-chip,
  coverage-chip, unit-badge).
- `data-gallery-state="<state name>"` on each state block; values are §3's state names verbatim.
- All component-level testids (dialog-content, datatable, refusal-state, …) are the earlier
  decisions' contracts, reachable on this page.

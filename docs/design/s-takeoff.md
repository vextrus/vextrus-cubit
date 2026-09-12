# Design Decision — S-Takeoff (the register workspace)

## The template, as it is built (Design Direction 00 §3.2)

This screen IS the grid workspace template — what S-BOQ, S-BBS, S-Levels and S-Schedules are cut
from in M3. Grid first: inside `shell-main` exactly two things stand above the lines table, the
36 px filter bar and nothing else, because the tabs row is the frame's own tool track and the
inspector is the frame's one right column.

```
┌R─┬──────────────────────────────────────────────────────────────┬─ I ─────┐
│  │ ws › Trace Survey ▾ › Takeoff › Register             ⌘K ⟳ ✉ ◉ │(on sel) │
│  ├──────────────────────────────────────────────────────────────┤ rcc.co… │
│  │ Register · Coverage                    rev a3f9c2 ⎘  ● Measure │ 0.405 m³│
│  ├───────────────────────────────────────────────────────────────┤ ▣ T / D │
│  │ Class·All ▾ Kind·All ▾ Level·All ▾ Basis·All ▾ Cov·All ▾  3 of 3 │ ■ 100 %│
│  ├──────┬────────────────────────────────────────────────────────┤ Formula │
│  │ tree │ Kind ▸ │ Value ▸│Unit│ Bases │ Cov │Formula│Var│Cal│Eng│Src│ live   │
│  │ ▾STR │ ▾ GF · column (4)                          1.620 m³    │ vars     │
│  │  ▾GF │ rcc.concrete  0.405  m³  ▣ T ■100 % H×(…) S-101·C1·#1F │ ─────── │
│  │   col│ rcc.concrete  0.405  m³  ▣ T ■100 % H×(…) S-101·C2·#2A │ Trace ↗ │
│  │   C1 │ …                                                      │ ▸Technical│
│  │──────│ 28 px rows · 13 px · frozen Kind · sticky header        │         │
│  │ 0 rep│                                                        │         │
│  │──────│                                                        │         │
│  │ refus│                                                        │         │
│  │ offers├───────────────────────────────────────────────────────┤         │
│  │      │ (sticky footer)                            1.620 m³    │         │
└──┴──────┴────────────────────────────────────────────────────────┴─────────┘
```

| Region | Purpose | Size | Empty | Error | Loading |
|---|---|---|---|---|---|
| tabs row (frame's tool track) | Register · Coverage area tabs + right: pinned revision `IdChip` + the ONE primary (Measure) | 100 % × `--toolbar-h` 32, **above `shell-main`** | the revision pair is absent with no campaign; the primary stands | — | — |
| filter bar | five chips, each `Label · Value ▾` (Combobox), then the live count | 100 % × 36 | a chip whose column produced nothing offers its all-option alone | — | five 28 px chip bones |
| index rail | the object tree (discipline › level › class › object), the struck count, every sighting that produced no line, and the level-stack offers | 240 (min 160, max 320), scrolls on its own | the tree is empty and the two sections state their own zero | `RefusalState` per sighting | one rail bone |
| grid (primary) | the shipped `DataTable`: 28 px rows, sticky header, frozen Kind, group rows with per-unit subtotals, sticky totals footer | flex; ≥ 60 % of `shell-main` at both viewports | `EmptyState` in the grid's own place — no campaign, nothing registered, or nothing matching the filters | the read's fault is the screen's error cell (`register-empty`, with the report id and the retry) | the header is real, the body is bones |
| footer | the visible set's totals, exactly and per unit (B-07) | 100 % × 28, sticky | no footer cell where the set adds to nothing | — | — |
| job strip | the shipped `JobTimeline`, **present only while a run is being watched** (R-UI-080) | 100 % × the pattern's own | absent — never an empty "Measure runs" block | the step carries its own refusal | the pattern's own |
| inspector (frame's one slot) | the selected LINE (kind, value, bases, coverage, source chips, the formula expanded with its live variables, the Trace, the Technical disclosure) or the selected OBJECT (basis, role, corroboration, Technical, Repudiate, the attributes and their two doors) | `--inspector-w` 320 (280–480) | **absent — width 0**, never a sentence saying nothing is selected | `RefusalState` in the answer slot | — |

Above the fold at 1440×900 and at 1280×800: the grid's first row is 88 px below the top of main
(24 px of the frame's padding, the 36 px bar, the 28 px header) — inside §3.2's hard rule of 240 and
inside §7 C2's own 120.

---

Routes: `/t/{tenant}/p/{project}/takeoff` (redirect) and `/t/{tenant}/p/{project}/takeoff/register`
under `src/app/(app)/t/[tenant]/p/[project]/takeoff/**`, inside the shell frame and behind the
membership guard in `t/[tenant]/layout.tsx`. Increment inc-214-register-workspace. Law: R-TO-050,
R-TO-051, L-ACT-01, L-ACT-02, R-UI-001/002/003/004/005/010/012/020/021/023/024/030/031/050/060,
S-Takeoff, J-021, B-17, B-19, B-20, Q-11, Q-17, ARCH-01. Files: `takeoff/layout.tsx`,
`takeoff/page.tsx`, `takeoff/nav.tsx`, `takeoff/register/{page.tsx,loading.tsx,register-screen.tsx,
route-address.ts,states.ts,register.css}`; the reading and the presentational
`RegisterWorkspace` in `src/modules/takeoff/register-ui/**` with its mirrored `copy.ts`; copy at
`src/ui/strings/takeoff.ts`. Every convention of the earlier Decisions binds: `cx-` classes,
variants on data-attributes, tokens-only colour and motion, `cx-reticle` solely from its single
home, no `[data-theme]` selector in authored CSS, model values verbatim in mono (ruleset I-25),
identifiers whole (I-26). Interpretations I-1–I-169 remain in force. Chrome comes only from shipped
primitives and patterns — core Button, Input, Skeleton, BasisChip, CoverageChip; data Tree and
DataTable; the one RefusalState, OfferedGroups, ConsequenceDialog and JobTimeline — plus the
`cx-register-*` classes this file rules.

## 0. Interpretations (numbering continues the global chain's highest, s-scale's I-169)

- **I-170 — the workspace is a module component and its shipped chrome is injected.** ARCH-01 bars
  `src/modules` from importing `src/ui`, and B-17 bars a screen from re-implementing a shipped
  primitive. `RegisterWorkspace` therefore takes its renderers: props are exactly
  `{ view, density, permitted, offline, chrome, doors }`, where `chrome` is
  `{ Tree, DataTable, RefusalState, OfferedGroups, ConsequenceDialog, JobTimeline, Skeleton,
  BasisChip, CoverageChip }` and `doors` the six procedures plus `refusalOf`. `register-screen.tsx`
  — app layer, which may reach both — binds them once. The jsdom acceptance binds the same shipped
  components, so what a test mounts is what the route renders. Rejected: hand-rolling a tree, a
  table or a refusal card inside the module (the B-17 defect the clause calls review-blocking), and
  rejected: moving the workspace into `src/ui`, which may not name `RegisterView` at all.
- **I-171 — a screen id that must name a shipped root rides a `display: contents` wrapper.** `Tree`
  and `DataTable` fix `data-testid="tree"` / `"datatable"` after their spread, so a caller cannot
  re-id them (s-project I-134's case, and its cure): `register-tree` and `register-lines` sit on
  `<div class="cx-register-mount">` (`display: contents`) wrapping exactly one primitive, adding no
  box and no line of layout. The `role="tree"` and `role="table"` those ids name are the primitive's
  own, found inside the wrapper — one element deeper, never a second one.
- **I-172 — the five filters are the screen's, not the table's.** Class and level narrow the tree
  and the lines together; a DataTable column filter cannot reach the tree, and two filter surfaces
  disagreeing about what is shown is worse than one. All five are native `<select>` controls in the
  S-Audit I-31 idiom, above the body, filtering the rows before the table is handed its `data` —
  so `register-lines-count` reads what the virtualiser was given. Options derive from the rows the
  view holds, plus one all-option each; a filter offering values the campaign cannot produce offers
  only emptiness.
- **I-173 — a repudiated object keeps its place in the tree and its lines leave the table.**
  REPUDIATE says a person judges the object to be nothing, not that the machine never read it
  (L-ACT-01: nothing is deleted, and the register still answers with the object). The object stays a
  treeitem and stays selectable; its inspector reads `register-object-corroboration
  data-standing="REPUDIATED"` and states `takeoff_register_repudiated_note` in place of the two act
  doors, because a struck object is neither corroborated nor struck a second time. Every line
  measured off it stays on record — the reading marks it `repudiated` — and is withheld from
  `register-lines`, so nothing is priced off an object the register itself says is nothing; the tree
  panel's foot counts both the objects struck and the lines withheld. Rejected: dropping the object
  from the tree, which reads as the deletion L-ACT-01 forbids and leaves a reader no way to see what
  was struck. Rejected: keeping its lines in the table, which shows quantities standing on an object
  a person has judged to be nothing.
- **I-174 — SUSPENDED is a reading of the attribute, and it is shown as one.** R-TO-051 says
  disagreements suspend and show as such. An attribute whose standing is SUSPENDED renders no value
  at all — a value beside the word would be the very claim the suspension denies — and lists every
  competing reading with its basis, precedence and source key, under one sentence naming the way out
  (a reading at a precedence that settles it). AGREED, NONE and REPUDIATED render the enum verbatim
  in mono beside the standing value where one exists.
- **I-175 — the acts are doors on the object in the inspector, one object and one attribute at a
  time.** CORROBORATE is offered on the attribute row it would speak about, because a reading that
  does not name its attribute is not a reading; REPUDIATE is offered on the object header, because
  it speaks about the whole object. Neither is a row action on the lines table: a line is a record,
  and a correction is an observation on the object (the increment's own scope). Both open the one
  ConsequenceDialog; neither commits anything itself.

### 0.1 The v22 rebuild (Design Direction 00 §3.2, §5, §6, §8's "Register (1.5)")

Numbered in a block above the chain's high-water mark, because three rebuild leaves were writing
Decisions on the same day and two of them taking the next number would be one number meaning two
things. Everything in §0 above stands except where an Interpretation here says otherwise.

- **I-230 — the tabs row is the frame's tool track, not a strip this screen draws.** §3.2 puts the
  area tabs, the pinned revision and the one primary in a single row above the filter bar. A row
  drawn inside `shell-main` would be height taken from the work surface — and `shell-main` carries
  24 px of padding besides, which would put the grid's first row 128 px below the top of main and
  break §3.2's own hard rule (§7 C2). The lane therefore mounts the row into the frame's second
  track (`useShellToolbar`, `src/ui/shell/slots.tsx`), where it is 32 px of chrome above main rather
  than 40 px of the grid's own field, and the grid's first row sits 88 px down at both viewports.
  The row is the LANE's (`takeoff/nav.tsx`, drawn above every takeoff surface) and its right-hand
  half is the SURFACE's, so the row publishes a slot of its own — `useTakeoffTabsAside` — in exactly
  the shape the frame's three slots settled: the register mounts the revision chip and the Measure
  door into it, and a surface that mounts nothing leaves it empty rather than absent-looking.
  Rejected: passing the revision down as a prop, which a layout three levels above the screen cannot
  receive; rejected: a second tabs row per surface, which is tabs of tabs (§1).
- **I-231 — the inspector is the frame's ONE right column, and it is ABSENT until something is
  selected.** R-UI-080 and §3.1: "the slot is absent — width 0, not a placeholder sentence". The
  workspace no longer renders an `<aside>` of its own and no longer selects the first object at
  mount: with nothing selected there is no column at all, and `takeoff_register_inspector_idle_*`
  are no longer rendered anywhere (they stay in the table, unspent — a string is deleted by the node
  that owns `src/ui/strings`, never by a screen). Two things can fill it: a ROW selected in the grid
  states the line, and an OBJECT chosen in the tree states the object and carries this screen's two
  act doors. The last thing selected wins, because a right column showing two subjects at once is
  two inspectors. A module may not call `useInspector` (ARCH-01), so the mount is chrome like every
  renderer (I-170), and what it is handed is memoised on what it shows — a slot is state in the
  frame, and a node with a new identity every render would set it on every render.
- **I-232 — the five filters are chips, and the bar is one line.** I-172's ruling stands in
  substance — the filters are the SCREEN's, they narrow the tree and the lines together, and they
  filter the rows before the table is handed its `data` — and its native `<select>` is withdrawn:
  §1's "no native `select`" and §3.2's "filters are chips (`Class · All ▾`) not labelled dropdown
  rows" replace the S-Audit I-31 idiom with the shipped `Combobox` in its `chip` skin. The label
  rides inside the control, so five narrowings and the count fit one 36 px row at 1280.
- **I-233 — the campaign's index stands BESIDE the grid, never under it.** The tree, the struck
  count, the sightings that produced no line and the level-stack offers were four full-width blocks
  stacked down the page; every one of them was height the grid paid for, and the refusals and the
  offers pushed the table off the fold. They are one 240 px rail in the grid's own row now — the
  region §3.2 calls `tree`, holding everything about the campaign that is not a line — each section
  scrolling inside it. Nothing is hidden and nothing is behind a disclosure: R-UI-020's rows render
  exactly as they did, in a column instead of a band.
- **I-234 — a cited key is read as chips, and the machine's own names live in Technical.** §6: "Source
  keys render as chips `S-101 · C1 · #…`" and "people see labels, never machine identifiers". The
  `source` cell and the inspector therefore state the sheet the line stands on, the mark it was read
  for and the extractor's handle; the key itself is whole in the address the link carries and whole
  inside the inspector's `<details>` disclosure, where `register-object-key` and `register-source-key`
  stand under `data-technical` (§7 C6's own sanctioned home). A key of no known grammar
  (`parseSourceKey` answers null) is not abbreviated into one: it stands whole in the chips (I-26).
  Every other SCREAMING value a cell held — the selecting basis, the coverage, the engine, the
  object's role and corroboration, an attribute's standing, the discipline on a tree item — is said
  in words by `EnumLabel` (or, for the Tree, which takes a string, by the rule EnumLabel says one
  by), which keeps the raw value in the DOM under `data-technical`. The one SCREAMING word left on
  the face of this screen is `BasisChip`'s own, which is R-UI-002's single home and is not this
  screen's to re-word (B-17) — recorded in §8 with its owner.
- **I-235 — the grid is DataTable v2, with its own furniture.** §5: the key column is frozen, the
  header is sticky, the rows are `--row-h` from the ROOT's density, group rows (`▾ GF · column (4)`)
  carry a subtotal per unit, the sticky footer carries the visible set's totals, no cell wraps, every
  figure is mono tabular right-aligned and grouped as the document groups one (L-FMT-01 through
  `QuantityText`), the unit is a muted `UnitBadge` in its own narrow column, and a clipped cell earns
  the table's own Tooltip. The column order is §3.2's: kind · value · unit · bases · coverage ·
  formula · variables · calibration · engine · source. The formula is ONE LINE and is expanded in the
  inspector beside the variables it was read with — never a taller row (§5 rule 2).
- **I-236 — a row is selected with the keyboard by the grid, and with the pointer by the screen.**
  §5 rule 10 sends a selection to the shell inspector, and the shipped grid raises its own
  (`onRowSelect`: Space takes a row, ⇧ extends) — but a CLICK moves its cell cursor and takes no row,
  so a reader with a pointer could never open the line inspector. Every row publishes the line it
  stands for through the table's own `rowDataOf` seam, and a click on the grid reads that attribute
  off the row it landed on. This reaches nothing of the primitive's insides: it reads an attribute
  this screen itself put there. The row a pointer took also publishes that it is taken, and is
  painted from `--surface-selected` — the same alias the grid paints its own selection with, so the
  two read as one thing. Both halves are owed to the primitive and recorded in §8.

## 1. Layout and hierarchy

`takeoff/layout.tsx` renders `<TakeoffTabs>` around `{children}`: the lane's 40 px-of-content tabs
row, mounted into the frame's 32 px tool track (I-230), and the surface itself below it in
`shell-main`. The row is `<div class="cx-takeoff-tabs">` holding `<nav data-testid="takeoff-nav"
aria-label={takeoff_nav_label}>` — one `next/link` per surface, today `takeoff-nav-register` and
`takeoff-nav-coverage`, each 13 px `var(--weight-body-medium)` `--ink-secondary`, `cx-reticle`, the
entry for the address in the browser carrying `aria-current="page"`, `--ink` and a 2 px
`--line-accent` underline (the Tabs idiom in a nav of links, s-project I-125) — and, right-aligned,
`cx-takeoff-tabs-aside`, which is what the surface standing in the row has mounted. The register
mounts two things there and nothing else: `takeoff_register_campaign_label` over the pinned
`setRevisionId` as an `IdChip` (`data-testid="register-campaign"`, R-UI-082 — short on screen, whole
in `data-value`, one press from the clipboard), and the ONE primary this screen holds,
`<button data-testid="register-measure">` `takeoff_register_measure`, whose hint
(`takeoff_register_measure_hint`) is its Tooltip and no longer a sentence under it (§6's copy diet).
Not the act variant: enqueueing a job is not an act (offered-group I-81's reading of the copper
scarcity). `takeoff/page.tsx` is a redirect and renders nothing.

The register page renders in `shell-main` as `<div class="cx-register"
data-testid="register-workspace" data-state={…} data-campaign={campaignId}>`, a column flex of
`height: 100%` — the field is the frame's track, so the body below takes what the bar above it
leaves rather than growing the page. Its `<h1>` is `takeoff_register_heading` clipped out of sight
(`cx-register-title`, out of flow, `clip-path: inset(50%)`, no width/height/negative-margin literal):
the breadcrumb and the current tab both say *Register* where a reader can see it, and §1 forbids a
heading with a sentence under it over a work surface. `takeoff_register_caption` is therefore no
longer rendered anywhere (I-231's note on unspent strings applies to it too).

**Answer slot** — `<div data-testid="register-answer" aria-live="polite">` under the h1, empty until
a door is refused, `display: none` while it is empty. It holds exactly one RefusalState, no chrome
around it (R-UI-020): `CAMPAIGN_NOT_FOUND` from the Measure door, `READING_NOT_NUMERIC` or
`ACT_CHANGES_NOTHING` from a preview, `PERMISSION_NOT_HELD` while `permitted` is false. A preview
rejection is answered here and **no dialog opens** — a dialog that opens on nothing is a consequence
of nothing. The offline banner is its sibling, above it.

**Job strip** — `<section data-testid="register-timeline">` holding the shipped `JobTimeline`,
rendered **only while this screen is watching a run** and absent otherwise (I-230's companion rule,
R-UI-080): the "Measure runs" block that stood empty over the grid is exactly the height §8 took
this screen's first point for. One tracked job per measure run the door answered, the job pattern
rendered where the operation was started (R-UI-024).

**Filter bar** (I-232) — `<div class="cx-register-filters">`: one row, `height: 36px`, `overflow:
hidden`, never wrapping. Five shipped `Combobox`es in the `chip` skin, in this order, each labelled
by its own word and placeheld by its all-option: `register-filter-class`, `register-filter-kind`,
`register-filter-level`, `register-filter-basis`, `register-filter-coverage`. Options derive from the
rows the view holds (the basis chip from the roster's own order, narrowed to what the campaign
published), plus one all-option each; a filter offering values the campaign cannot produce offers
only emptiness. Then `margin-left: auto`, `<p data-testid="register-lines-count" role="status">` —
`takeoff_register_lines_count` filled through `formatUserFigure`, 12 px `--ink-muted`, tabular,
mounted from first paint. That count line is the ONE helper line this screen spends in main (§7 C7).

**Body** — `<div class="cx-register-body">`, a flex row of `gap: var(--gap-section)` and
`min-height: 0`, taking the rest of the field; one column below `min-width: 960px` (the md token's
value, the one lawful literal in a media query — S-Audit's ruling).

- **Index rail** (I-233) — `<section class="cx-register-panel cx-register-index">`, `flex: 0 0 240px`
  (min 160, max 320), scrolling on its own. `<h2>` `takeoff_register_tree_label`, then the I-171
  wrapper `data-testid="register-tree"` around the shipped `Tree`: items nested discipline → level →
  class → object, every discipline and level expanded by default, the discipline said in words and
  the level, class and mark verbatim (`GF`, `column`, `C1`), **no default selection** (I-231).
  `onSelect` of an object node fills the inspector and clears any selected row; a branch node selects
  and expands and changes nothing else. Under it `<div data-testid="register-repudiated-count">`
  `takeoff_register_repudiated_count` in mono 12 px — always rendered, the zero form being a counted
  empty set, never a hidden cell (I-173). Then the two sections that were bands across the page:
  `<section data-testid="register-refusals" data-count={n}>`, whose `<h2>`
  `takeoff_register_refusals_heading` carries `takeoff_register_refusals_hint` as its Tooltip rather
  than as a sentence beneath it (§6), and one `<div data-testid="register-refusal" data-code
  data-object data-kind>` per queue item and refused sighting, in the order the view answers them,
  each stating the object key and kind in mono under their labels and then **exactly one**
  RefusalState from the registered entry (`INTERPRETED_UNCORROBORATED`, `DUPLICATE_IDENTITY`) with
  evidence `{ href: …/drawings, label: takeoff_register_evidence }`; and, while `permitted`,
  `<section data-testid="register-level-stack">` with the same heading-and-Tooltip shape over the
  shipped `OfferedGroups` — one item per drawing of the pinned revision with a non-null proposal,
  `key` the `PROPOSED_LEVEL_STACK` key verbatim. Confirming opens the one ConsequenceDialog at
  `actType` `INSERT_LEVEL` with the offer's levels verbatim. There is no `input[type=checkbox]`, no
  `[role=checkbox]` and no select-all anywhere under `register-workspace` — the asserted absence is
  the substance of R-UI-023 (offered-group I-77). No code, message or remedy is spelled anywhere else
  on the screen: outside a `refusal-state` no text node under `register-workspace` spells a refusal
  code (R-UI-020, B-17).
- **Lines** (I-235) — the I-171 wrapper `data-testid="register-lines"` around the shipped
  `DataTable`, taking the rest of the row. `tableId` `takeoff-register-lines` (the drawer the
  reader's column furniture is remembered in), `getRowId` the `lineId`, `freezeKeyColumn`,
  `group` by `level|class` labelled `GF · column` with a per-unit subtotal, `totals` the visible
  set's own sums (`subtotalsByUnit`, the grid's own exact addition — B-07), `rowDataOf` publishing
  `data-line` and, on the row a pointer took, `data-line-selected` (I-236), `scrollToRowId` the
  origin (I-182), `aria-label` the screen's own word. Columns in §3.2's order, headers from the copy
  table, at the widths they are read at: `kind` 148 · `value` 116 (`meta.align: "right"`) · `unit` 64
  · `bases` 160 · `coverage` 128 · `formula` 180 · `variables` 180 · `calibration` 120 · `engine` 104
  · `source` 180. The six that hold one scalar — `kind`, `value`, `unit`, `coverage`, `engine`,
  `source` — carry `enableSorting` with the value they order by: the sort control is also the
  keyboard way into a virtualised scroll box, which R-UI-012 requires and axe checks. Cells: the kind
  verbatim in mono; the SI value through `QuantityText` (grouped as the document groups a figure,
  exact in `data-value`, nothing where the coverage is not COMPLETE — L-QTY-02); the unit through
  `UnitBadge`; the quantity basis as a `BasisChip` beside the selecting basis as an `EnumLabel`; the
  coverage as a `CoverageChip` beside its `EnumLabel`; the formula verbatim, one line, ellipsised,
  with the table's own Tooltip and the inspector's expansion; variables as `name=value unit` pairs
  read from `bindings`; the calibration keys joined, whole; the engine as an `EnumLabel`; and the
  cited key as the Trace's own link over its source chips (I-234, and `docs/design/
  s-takeoff-register.md` I-179–I-182, which rule the cell). A line the reading marks `repudiated` is
  not a row here at all: it is withheld and counted at the rail's foot, and `register-lines-count`
  counts the lines the table may show (I-173). No `meta.editable` anywhere, and no checkbox column.
- **The grid's own empty cell** — where the campaign is absent, where it has registered nothing, and
  where the filters match nothing, the shipped `EmptyState` stands **in the grid's place** and the
  rail beside it is untouched (§3.2's region table). The first two carry `data-testid="register-empty"`
  and, with no campaign, the one action.

**Inspector** (I-231) — the node this screen mounts into the frame's slot, `<div
data-testid="register-inspector" data-object={objectKey}>` (a `<div>`, not an `<aside>`: the frame's
slot is already the landmark, and two nested asides would read as two right columns to §7 C3). With
a ROW selected, `data-line={lineId}` and: the kind as the title; a `<dl>` of `_col_value` →
`QuantityText` with its `UnitBadge`, `_col_bases` → the chip and the label, `_col_coverage` → the
chip and the label, `_col_source` → the source chips; then `<h3>` `_col_formula` over the formula
whole (the expansion §5 rule 2 owes the ellipsised cell) and a `<dl>` of its variables; then the
Trace's own `EvidenceLink`; then `<details>` (the platform's own disclosure — there is no shipped one, and its `<summary>` wears
the reticle from its single home) titled `takeoff_register_object_key_label`, holding
`register-object-key` and, under `takeoff_register_source_label`, `register-source-key`, both
`data-technical`. With an OBJECT selected: the mark as the title; a `<dl>` of
`takeoff_register_basis_label` → `<dd data-testid="register-object-basis" data-basis>` a BasisChip,
`_role_label` → `<dd data-testid="register-object-role" data-role>` an `EnumLabel`,
`_corroboration_label` → `<dd data-testid="register-object-corroboration" data-standing>` an
`EnumLabel`; the same `<details>`; then, on a struck object, `takeoff_register_repudiated_note`, and
otherwise the core **secondary** Button `takeoff_register_repudiate` (I-175) — a door in the
inspector, never the full-width bar §8 marked — absent also while `permitted` is false.
**Attributes** — `<h3>` `takeoff_register_attributes_label`, then one `<section
data-testid="register-attribute" data-attribute data-standing>` per attribute: the attribute name,
the standing as an `EnumLabel`, the standing value where one exists as `<p
data-testid="register-reading" data-role="standing">` through `QuantityText`; under
`takeoff_register_competing_label` and `takeoff_register_overruled_label` the same `register-reading`
row shape at `data-role="competing"` / `"overruled"`; a SUSPENDED attribute renders no standing row
and carries `takeoff_register_suspended_note` above its competing list (I-174); an attribute with
nothing recorded says `takeoff_register_no_readings`. Last in the row, the core ghost Button
`takeoff_register_corroborate`, which toggles a small form in place: core Inputs labelled
`takeoff_register_corroborate_value`, `_unit` and `_precedence` (the last described by
`takeoff_register_corroborate_precedence_hint`, defaulting to `0`), and a core secondary Button
`takeoff_register_corroborate_preview` which opens the ConsequenceDialog with `actType`
`CORROBORATE`, `sourceKey` carried from the object verbatim and never typed.

## 2. States (R-UI-050), ruled cell by cell

Declared in `takeoff/register/states.ts` (`REGISTER_STATES`) and in `src/ui/screen-states/matrix.tsx`
under `/t/[tenant]/p/[project]/takeoff/register`; the redirect route
`/t/[tenant]/p/[project]/takeoff` declares all seven **delegated** to the register route, naming it
and the redirect as the reason — a route that renders nothing has no state of its own to invent.
`register-workspace[data-state]` is derived in this order, the first that holds winning: `loading` ·
`denied` · `offline` · `error` · `refused` · `empty` · `partial` · `ready`.

- **Loading** — `loading.tsx`, frame and tabs row intact, core Skeletons keeping the layout the
  screen in fact has, never a spinner and never one on the table (R-UI-004): a 36 px bar of five
  28 × 128 chip bones with a 28 × 96 count bone at its end, then the body — a 240-wide rail bone
  beside a full bone for the grid. No bone stands for a region that is absent at rest: the tabs row
  is the frame's own track and the inspector is absent until something is selected (R-UI-080).
- **Empty** — the shipped `EmptyState` **in the grid's own place**, the rail beside it untouched,
  each of two truths saying why (R-UI-020). No campaign pinned: `takeoff_register_empty_heading` /
  `_body` and the one action, a core secondary link to `…/drawings/sets`,
  `takeoff_register_empty_action`. A campaign with nothing registered:
  `takeoff_register_empty_campaign_heading` / `_body`, no second action — `register-measure` already
  stands in the tabs row, and a duplicate door teaches a second way to do one thing. Both carry
  `data-testid="register-empty"`. A filtered-to-nothing table is not this cell: it is the same
  primitive stating `takeoff_register_lines_none`, carrying no state id, with the rail untouched.
- **Error** — `register-screen.tsx`'s own cell, which is the read's and not the register's:
  `takeoff_register_error_heading` / `_body`, the report id through an `IdChip` under
  `takeoff_register_report_label` (R-UI-082 — a fault id is read aloud to support, which is what the
  chip exists for), and the core secondary Button `<button data-testid="register-retry">`
  `takeoff_register_retry`, which re-runs `takeoff.register` in place. It keeps its own id rather
  than taking the shipped `ErrorState`'s, because `register-retry` is in the frozen registry and the
  primitive publishes ids of its own (C-05). A render fault of the surrounding screen is the root
  error boundary's, unchanged.
- **Refusal** — the one RefusalState, in `register-answer` for a door's rejection and inside each
  `register-refusal` row for a sighting's. Never a toast, never a screen-local block.
- **Partial** — rendered, never hidden: published lines, queue items and refused sightings stand
  together, and `data-state="partial"` while `register-refusals[data-count]` is above zero and the
  view otherwise answered. A struck object stands in the tree with its lines withheld and counted,
  which is a statement of what a person did rather than a cell of this state (I-173).
- **Offline** — a banner above the answer slot, `<p role="status">` `takeoff_register_offline`,
  house notice chrome (`var(--info-surface)` fill,
  `var(--info)` border, radius `var(--radius-4)`); the three act doors and the offered-group confirm
  render `disabled` while it stands. The register reads on; a read that is honest about its age is
  not a broken screen.
- **Permission-denied** — `permitted` is the viewer's MEASURE on this project, read server-side.
  Without it `data-state="denied"`, the three act doors and the group confirm do not render at all
  (a door that answers only a refusal is theatre — participants I-50), and `register-answer` holds
  a standing `takeoff_register_denied_permission` / `_holder` pair over one RefusalState from the
  registered `PERMISSION_NOT_HELD` entry, evidence the project's participants screen. Reading the
  register needs no permission beyond membership, which the shell guard settles before this route
  mounts.

## 3. Copy, verbatim (`src/ui/strings/takeoff.ts`, mirrored to the module's `copy.ts`)

`takeoff_nav_label` **Takeoff** · `takeoff_nav_register` **Register** ·
`takeoff_register_heading` **Register** · `takeoff_register_caption` **Every object this campaign
registered, the quantity lines measured from it, and what each one rests on.** ·
`takeoff_register_campaign_label` **Pinned revision** · `takeoff_register_measure` **Measure this
campaign** · `takeoff_register_measure_hint` **Queues a measure run over the pinned revision. Lines
appear as each rail publishes them.** · `takeoff_register_timeline_heading` **Measure runs** ·
`takeoff_register_filter_class` **Class** · `takeoff_register_filter_kind` **Kind** ·
`takeoff_register_filter_level` **Level** · `takeoff_register_filter_basis` **Basis** ·
`takeoff_register_filter_coverage` **Coverage** · `takeoff_register_filter_any_class` **All
classes** · `_any_kind` **All kinds** · `_any_level` **All levels** · `_any_basis` **All bases** ·
`_any_coverage` **All coverages** · `takeoff_register_lines_count` **{shown} of {total} lines** ·
`takeoff_register_tree_label` **Objects by discipline, level and class** ·
`takeoff_register_repudiated_count` **{count} objects repudiated, {lines} lines withheld** ·
`takeoff_register_col_kind`
**Kind** · `_col_value` **Value** · `_col_unit` **Unit** · `_col_formula` **Formula** ·
`_col_variables` **Variables** · `_col_bases` **Bases** · `_col_coverage` **Coverage** ·
`_col_calibration` **Calibration** · `_col_engine` **Engine** · `_col_source` **Source** ·
`takeoff_register_repudiated_note` **A person judged this object to be nothing. Nothing was deleted:
every reading and every line measured from it stays on record, and its lines are withheld from the
table.** · `takeoff_register_lines_none` **No line matches
these filters. Every line stays registered — clear a filter to see the rest.** ·
`takeoff_register_object_key_label` **Object key** · `takeoff_register_basis_label` **Basis** ·
`takeoff_register_role_label` **Role** · `takeoff_register_corroboration_label` **Corroboration** ·
`takeoff_register_source_label` **Read from** · `takeoff_register_attributes_label` **Attributes** ·
`takeoff_register_competing_label` **Competing readings** · `takeoff_register_overruled_label`
**Overruled readings** · `takeoff_register_no_readings` **No reading has been recorded for this
attribute.** · `takeoff_register_suspended_note` **These readings disagree, so this attribute has no
standing value. Record a reading at a precedence that settles it.** ·
`takeoff_register_inspector_idle_heading` **No object selected** ·
`takeoff_register_inspector_idle_body` **Choose an object in the tree to read its basis, its role
and the readings recorded against it.** · `takeoff_register_corroborate` **Record a reading** ·
`takeoff_register_corroborate_value` **Value** · `_unit` **Unit** · `_precedence` **Precedence** ·
`takeoff_register_corroborate_precedence_hint` **Lower numbers rank first. A reading at the same
precedence as another suspends the attribute.** · `takeoff_register_corroborate_preview` **Preview
this reading** · `takeoff_register_repudiate` **Repudiate this object** ·
`takeoff_register_refusals_heading` **Deferred and refused** · `takeoff_register_refusals_hint`
**These sightings produced no line. Each says why, and where to resolve it.** ·
`takeoff_register_refusal_object_label` **Object** · `takeoff_register_refusal_kind_label` **Kind** ·
`takeoff_register_evidence` **Open the source drawings** ·
`takeoff_register_level_stack_heading` **Level stacks read from the drawings** ·
`takeoff_register_level_stack_hint` **Confirming inserts every level in the offer as one act.
Nothing is chosen row by row.** · `takeoff_register_level_stack_label` **Level stack proposed from
{drawing}** · `takeoff_register_level_stack_count` **{count} levels** ·
`takeoff_register_empty_heading` **No campaign is open on this project** ·
`takeoff_register_empty_body` **A register fills once a drawing set revision is pinned. Pin one, and
every sighting it produces appears here.** · `takeoff_register_empty_action` **Browse drawing
sets** · `takeoff_register_empty_campaign_heading` **This campaign has registered nothing yet** ·
`takeoff_register_empty_campaign_body` **Queue a measure run above, and every object the rails
register appears here as they publish.** · `takeoff_register_error_heading` **The register could not
be read** · `takeoff_register_error_body` **Nothing was changed. Try again, and quote the report id
if it keeps happening.** · `takeoff_register_report_label` **Report id** ·
`takeoff_register_retry` **Try again** · `takeoff_register_offline` **You are offline. The register
reads as it stood when this page loaded, and nothing can be committed until the connection
returns.** · `takeoff_register_denied_permission` **Recording a reading, repudiating an object and
queueing a measure run each need the MEASURE permission on this project.** ·
`takeoff_register_denied_holder` **A project principal can grant it on the participants screen.**

**Where each of these now stands (v22).** The table is unchanged — a screen does not edit
`src/ui/strings` — but three of its lines are no longer text a reader meets on the face of the
screen, and that is a composition ruling, not a deletion: `takeoff_register_caption` (§1 — never a
heading with a sentence under it over a work surface; the one helper line this screen spends is the
count), `takeoff_register_measure_hint` (the Measure door's Tooltip, §6's "(i) popover" rule), and
`takeoff_register_inspector_idle_heading` / `_body` (I-231 — the frame's right column is ABSENT with
nothing selected, so there is nothing for an idle sentence to stand in). `_refusals_hint` and
`_level_stack_hint` are their sections' heading Tooltips for the same reason. A string the product
no longer renders is struck by the node that owns the registry, named here so the debt is visible
(§8). One string this screen WOULD spend and cannot: the filter bar's free-text search (§3.2's `⌕`)
needs a `takeoff_register_search` label, and no existing key names a search over these lines
honestly — the bar ships with its five chips and the count, and the search is recorded in §8.

Voice: calm, concrete, professional; no exclamation marks; no build vocabulary — "campaign", "rail",
"gate", "seam", "ingest" and every clause id appear nowhere a reader can see (the word *campaign*
survives only where it names the product's own pinned run, which the caption defines). Object keys,
source keys, marks, disciplines, classes, kinds, units, bases, coverages, engines, corroboration
states, act types, level ids, job ids and report ids are model data and render verbatim as data in
mono, never woven into a sentence (I-25). Registry messages and remedies are never paraphrased.

## 4. Motion (R-UI-004)

Nothing on this screen eases in. Filtering, selecting an object, expanding a branch, a row's arrival
and the refusal rows are instant — an answer that performs before it is read is theatre, and a table
that fades while scrolling lies about what is settled. The only transitions are inherited from
single homes: the tree chevron's 90° turn, the select and Button hover colours, and the nav link's
colour, each `var(--motion-state)` `var(--ease)`; the reticle draw in `reticle.css`; the Skeleton
pulse while `loading.tsx` holds the route or the timeline waits on a number; the ConsequenceDialog's
own entrance. Virtualised scrolling is untweened by the primitive. Every duration is a token zeroed
at source under reduced motion, so `register.css` carries no `prefers-reduced-motion` branch.

## 5. Tokens

Only §4.1's aliases and §4.2's density/layout tokens are consumed — a `--graphite-*` or `--beam-*`
reference outside `tokens.ts` is a lint failure since U1 (Direction §4). This screen spends:
`--surface-app` / `--surface-panel` / `--surface-sunken` / `--surface-selected` · `--ink` /
`--ink-secondary` / `--ink-muted` / `--ink-code` · `--line-accent` · `--accent-subtle` ·
`--state-info` / `--state-info-surface` · the basis palette and the coverage bands, reached only
through BasisChip, CoverageChip and EvidenceLink · `--hairline` · `--space-1/2/3/4` ·
`--gap-section` · `--radius-2/4/8` · `--text-body` / `--text-caption` / `--text-20` ·
`--font-ui` / `--font-mono` · `--leading-ui` · `--weight-body-medium` / `--weight-heading` ·
`--row-h`, `--control-h` and `--toolbar-h` through the primitives that read them (the per-screen
`[data-density]` override is deleted — density is the root's, §4.2) · `--motion-state` / `--ease`.
Px literals, closed set: the index rail's 240 and its 160/320 bounds, the filter bar's 36, the tabs
row's current-underline 2, the origin mark's 2 px inset bar, the ten column widths (`size`s, the
class their own Decision §1 lists), the md media-query value, and the loading bones' 28/96/128/240.
Any other literal is a defect. No copper appears anywhere except on the ConsequenceDialog's confirm,
which is the primitive's own — the workspace commits nothing itself.

## 6. Themes

`register.css` contains no `[data-theme]` selector; every light/dark difference arrives through
token values (R-UI-001). Contrast holds on the founder values in both themes: graphite-600/700/900
on graphite-0 and on the panels' graphite-50 clear 4.5:1; beam-600 link text clears 4.5:1 and the
beam-500 current-underline clears the 3:1 UI floor; the seven basis colours and the three coverage
bands are redundant to a glyph and a word in both themes, so nothing is lost in greyscale
(R-UI-002, R-UI-060). The panels stand one step off the graphite-0 field, seamed by hairlines, in
both themes; the lines table keeps the field's own fill so the numbers read on the brightest ground.

## 7. Test hooks (closed contract, C-05)

Routes introduced: `/t/{tenant}/p/{project}/takeoff` (redirecting) and
`/t/{tenant}/p/{project}/takeoff/register` (`registerRoute`, `takeoffRoute`). Routes linked, all
shipped: `…/drawings` (the refusal evidence), `…/drawings/sets` (the empty state's action),
`…/settings/participants` (the denial's evidence). Test ids, exactly the contract's, on the elements
ruled in §1: `takeoff-nav` · `takeoff-nav-register` · `register-workspace` (`data-state`,
`data-campaign`) · `register-tree` · `register-inspector` (`data-object`) · `register-object-key` ·
`register-object-basis` (`data-basis`) · `register-object-role` (`data-role`) ·
`register-object-corroboration` (`data-standing`) · `register-source-key` · `register-attribute`
(`data-attribute`, `data-standing`) · `register-reading` (`data-role`, `data-basis`,
`data-precedence`) · `register-lines` · `register-lines-count` · `register-repudiated-count` ·
`register-filter-class` · `-kind` · `-level` · `-basis` · `-coverage` · `register-refusals`
(`data-count`) · `register-refusal` (`data-code`, `data-object`, `data-kind`) · `register-answer` ·
`register-empty` · `register-retry` · `register-level-stack` · `register-measure` ·
`register-timeline`, and the two masking ids §7's picture paragraph names (`register-campaign`,
`register-refusal-object`). `project-tab`, `offered-groups`, `offered-group`, `offered-group-count`,
`offered-group-confirm`, `refusal-state`, `refusal-message`, `refusal-remedy`,
`refusal-evidence-link`, `job-timeline`, `job-timeline-step`, `consequence-dialog`, `tree`,
`tree-item`, `datatable`, `datatable-row`, `datatable-cell`, `basis-chip`, `coverage-chip`,
`unit-badge`, `skeleton` and `screen-state` are other files' ids, used and never redefined. No
others are added: the Corroborate, Repudiate, Preview and empty-state doors, the headings and the
count line are found by role and name.

**No test id is added by the v22 rebuild, and none is renamed.** Every region it moved answers to
the id it already published: `register-measure` and `register-campaign` are found on the page rather
than under the workspace, because the tabs row is the frame's track (I-230); `register-inspector`
and everything under it likewise, because the inspector is the frame's slot (I-231);
`register-object-key` and `register-source-key` stand inside the Technical disclosure, closed at
rest, so they are text a suite reads and a picture cannot freeze (I-234); `register-empty` is the
shipped `EmptyState`'s own box; `register-timeline` exists only while a run is watched. What the
rows publish is new and is the screen's own, not the primitive's: `data-line` on every row through
`rowDataOf`, and `data-line-selected="true"` on the row a pointer took (I-236).

Behavioural hooks without new ids: `aria-current="page"` on the nav's current entry;
`role="status"` on the count line and the offline banner; `aria-live="polite"` on `register-answer`;
`role="tree"`/`role="treeitem"` and `role="table"`/`role="row"`/`role="columnheader"` inside the two
I-171 wrappers; `data-standing="REPUDIATED"` on a struck object's corroboration cell;
`data-kind="PROPOSED_LEVEL_STACK"`
and `data-drawing` on each offered group; `cx-reticle` on every focusable element; and the asserted
absences — no `input[type=checkbox]`, no `[role=checkbox]`, no select-all, no `EvidenceLink` and no
refusal code in any text node outside a `refusal-state`. Suites: `tests/ui/takeoff-register/**`
(jsdom mounts of `RegisterWorkspace` over `registerFixture()`, `linesFixture(n)`,
`refusalsFixture()`, `levelStackFixture()`, chrome bound to the shipped components per I-170 — and,
since v22, the two mounts bound to stand-ins that render in place, because there is no frame in
jsdom: what a suite reads under `register-workspace` is the node the route hands the frame).
`inspector-slot.test.ts` holds the rebuild's own properties to account: no right column at rest, a
row taken with the pointer stating its line, an object stating its doors, one column for one subject,
and a job strip that exists only while a run is watched (I-230–I-236),
`tests/takeoff/register-ui/**` (the reading, the doors and the two acts through
`stageRegisterCampaign()`), and `tests/takeoff/register-ui/copy-mirror.test.ts`, which fails the
build if the module's `copy.ts` and `src/ui/strings/takeoff.ts` ever differ (the viewer-inspector
§8 precedent; its IOU — a copy home both layers may read — is re-recorded here unpaid). Journey:
`tests/e2e/register.spec.ts`, titles carrying J-021, page object
`tests/e2e/pages/s-takeoff.page.ts`; checkpoints `s-takeoff/register` and `s-takeoff/measure-queued`,
axe serious/critical = 0 at each, never widened, `masks()` over the shell breadcrumb, `shell-user`,
`shell-tenant-switcher` (the staged workspace's own name), `register-timeline` (which masks nothing
while no run is watched), `register-campaign` (the pinned revision, now the short form its `IdChip`
shows) and `register-refusal-object` (the object key repeated on each refusal row). The inspector's
`register-object-key` and `register-source-key` LEAVE that list in v22: they stand inside the
Technical disclosure, which is closed at rest, so they are no longer ink a picture could freeze —
and the inspector itself is absent until something is selected. Re-baselined under B-20:
`tests/e2e/baselines/design/s-project/home.png` (the Takeoff tab becomes a link) and
`j-003/project-edited.png` only if its bytes move.

## 8. Recorded IOUs (owner named, never a comment in `src/`)

The Trace from a line to its entities and back (R-UI-022) is **paid**: inc-215 makes the `source`
cell an `EvidenceLink` under `docs/design/s-takeoff-register.md`, and the cited key is no longer
plain text. EvidenceLinks on queue items, refusal rows and the object inspector's readings stay
unpaid — owner: those surfaces' own leaves. Bulk corroboration of INTERPRETED sightings as an
offered group (J-040) — owner: M4. Resizable, remembered widths for the index rail (R-UI-005) —
owner: the prefs seam's node, which holds the same debt for the viewer; the inspector's own width is
now the frame's and IS remembered. A CORROBORATE that names more than one attribute, and an inline
correction on a line — deliberately absent: a line is a record.

Opened by the v22 rebuild, each with the node that owns the fix:

- **A row taken with the pointer.** `DataTable` raises a selection from the keyboard (`onRowSelect`:
  Space, ⇧-range) and a click only moves its cell cursor, so §5 rule 10's "row selection → the shell
  inspector" is keyboard-only in the primitive. This screen reads the row a click landed on off its
  own `data-line` and paints it from its own `data-line-selected` (I-236). Owner: the node that owns
  `src/ui/primitives/data` — a click that takes a row, and `aria-selected` with it.
- **`BasisChip` says its value in SCREAMING.** R-UI-002's chip renders `MEASURED` beside its glyph,
  so every basis cell of every grid in the product is a §7 C6 finding that no screen can clear: the
  chip is the glyph table's single home and re-wording it at a call site is the B-17 defect. Owner:
  the node that owns `src/ui/primitives/core` — the chip should read its value the way `EnumLabel`
  does (words on the face, the raw value under `data-technical`), and §3.2's wireframe already
  writes it short (`▣ T`).
- **A search over the lines.** §3.2's filter bar carries a `⌕` beside its chips; no key in
  `src/ui/strings/takeoff.ts` names a search over these rows, and a screen may not add one. Owner:
  the node that owns `src/ui/strings` — `takeoff_register_search`, at which point the bar gains the
  field and this Decision's §1 gains a sentence.
- **Four strings the product no longer renders** (§3's note): `takeoff_register_caption`,
  `takeoff_register_inspector_idle_heading` / `_body`, and — as visible text — the three hints that
  became Tooltips. Owner: the node that owns `src/ui/strings`, to strike what the rebuild retired.
- **A column chooser default.** §5 rule 3 asks for "≤ 8 visible columns at 1280"; the shipped table
  restores the reader's own furniture but takes no default hidden set, so this register shows all
  ten and scrolls inside its own container (which C10 permits). Owner: the node that owns
  `src/ui/primitives/data` — a `defaultHidden` the table honours before anything is remembered.
- **`FigureProvider` at the frame.** `QuantityText` needs SEAM-FORMAT's conventions and `src/ui` may
  not call the seam; the tenant frame installs none today, so this screen hands the format down from
  the module (which may read core). Owner: the node that owns the tenant frame — one provider, and
  the `format` prop disappears from every call site.
- **A copy home both layers may read**, so `src/modules/takeoff/register-ui/copy.ts` need not mirror
  `src/ui/strings/takeoff.ts` — re-recorded unpaid (the viewer-inspector §8 precedent).

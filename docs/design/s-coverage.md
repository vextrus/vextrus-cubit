# Design Decision — S-Coverage (the coverage grid)

Route `/t/{tenant}/p/{project}/takeoff/coverage`, widened by `?cell={kind}:{class}:{levelId}`, under
`src/app/(app)/t/[tenant]/p/[project]/takeoff/coverage/**`, inside the takeoff nav, the shell frame
and the membership guard. Increment inc-216-coverage-grid. Law: X-3, R-TO-052, L-QTY-05, L-QTY-07,
L-ACT-02, L-ACT-03, R-UI-001/002/003/004/005/010/012/020/021/030/031/032/050/060, J-022, J-000,
B-17, B-19, B-20, Q-11, ARCH-01, C-05. Files: `takeoff/layout.tsx` (one nav entry added),
`takeoff/coverage/{page.tsx,loading.tsx,coverage-screen.tsx,route-address.ts,states.ts,coverage.css}`
and the reading, the presentational `CoverageWorkspace`, the DOM heat grid (`grid.tsx`), the mark and
ramp vocabulary (`heat.ts`), the glyph map and `copy.ts` in `src/modules/takeoff/coverage/**`. Every
convention of the earlier Decisions binds: `cx-` classes, variants on data-attributes, tokens-only
colour and motion, no `[data-theme]` selector in authored CSS, model values verbatim in mono (I-25)
and whole (I-26), the module takes its shipped chrome as injected renderers (I-170) on a
`display: contents` mount where a shipped root fixes its own id (I-171). Interpretations I-1–I-187
remain in force. Chrome comes only from shipped primitives and patterns — core Button, Skeleton,
EmptyState, ErrorState, IdChip, EnumLabel, Tooltip; the one RefusalState; the one ConsequenceDialog;
the frame's own ShellToolbar and its three slots — plus the matrix this file rules and the
`cx-coverage-*` classes beside it.

**REBUILT under Design Direction 00 (v22 U2), which outranks this file where the two disagree (§3.5,
§4.3, §7, §8's "Coverage (2.3)").** The before-score was 2.3, and its three named fixes are what
changed: a real heat grid with sticky headers, a ramp and a hatch; the 540 px legend as one 28 px key
line with the meanings on hover; the cell's cause and remedy in the shell's ONE inspector, the three
UUIDs through `IdChip` and the SCREAMING enums through `EnumLabel`. What did not change is the law:
the residue arms, the axis rule, the act doors, the seven states and the two boundary statements are
all exactly where they stood.

## The screen at a glance — wireframe and regions (Direction §3.5)

```
┌R─┬──────────────────────────────────────────────────────────────┬─ I ─────┐
│  │ ws › Trace Survey ▾ › Takeoff › Coverage              ⌘K ⟳ ✉ ◉ │(on sel) │
│  ├──────────────────────────────────────────────────────────────┤ rcc.con.│
│  │ Pinned revision a3f9c2 ⎘            [ Hide certificate ]      │ column·L1│
│  ├──────────────────────────────────────────────────────────────┤ ⊖ Held  │
│  │ ● Published ◐ Partial ○ Absent ⊘ Out of scope ⊖ Held ⋯ No class│ A person│
│  ├──────────┬──────┬──────┬──────┬──────┬──────┬──────┬────────────┤ held…   │
│  │ Kind     │ column      │ beam        │ slab        │ …          │ act 8e8d│
│  │          │ GF │ L1 │ L2 │ GF │ L1 │ GF │ L1 │                   │ Remedy: │
│  │▍rcc.conc │ ●  │ ⊖▨ │ ○  │ ●  │ ◐▧ │ ●  │ ○  │                   │ Measure │
│  │▍rebar    │ ●  │ ●  │ ○  │ ○  │ ◐▧ │ ⊘▩ │ ○  │                   │ [Open   │
│  │▍formwork │ ●  │ ●  │ ●  │ ●  │ ●  │ ●  │ ●  │                   │  the    │
│  │ 28 px cells · sticky kind column · sticky class/level header      │ register]│
│  ├──────────┴────────────────────────────────────────────────────┤ Sighted │
│  │ 42 cells · 31 published · 6 absent · 3 held · 2 partial          │ in ▸    │
│  ├──────────────────────────────────────────────────────────────┤ [Hold]  │
│  │ Certificate preview — measurement boundary · bill boundary      │ [Scope] │
└──┴──────────────────────────────────────────────────────────────┴─────────┘
```

| Region | Purpose | Size | Empty | Error | Loading |
|---|---|---|---|---|---|
| tool row (shell slot) | the pinned revision as `IdChip`, and the one control that shuts the certificate | 100 % × 32, the frame's own track | — | absent — nothing to act on | — |
| key line | one horizontal key, 7 glyph+word pairs; hover and focus → the registry's one-sentence meaning | 100 % × `--row-h` (28 compact / 36 comfortable) | — | — | one bone of the same height |
| heat grid (primary) | kinds × (class · level) matrix; one cell per residue cell, each a glyph + the ramp fill by share published + the §4.3 hatch for its mark | flex, takes what main has left; ≥ 55 % of `shell-main` | `EmptyState`: the reason it is empty + the one action | `ErrorState`: the sentence, the report id as `IdChip`, the retry | a bone that keeps the height |
| tally (footer) | counts by mark — "42 cells · 31 published · 6 absent" | 100 % × `--row-h` | — | — | one bone of the same height |
| certificate preview | the two boundary statements as they will print, never merged | 100 % × ≤ 192, its own scroll; `display: none` when shut | its own "none" sentence per statement | absent — a statement over a read that failed is a claim nobody made | one bone |
| inspector (shell slot) | the cell: kind · class · level, the mark and its cause sentence, the act `IdChip`, the remedy as one sentence and one button, the Sighted-in table, the observations, the two doors | 320, the frame's own, resizable | absent at width 0 — no selection, no column | — | — |
| answer slot | one `RefusalState` for a door's rejection, and the standing denial of SET_BILL_BOUNDARY | 100 % × auto; `:empty` collapses to nothing | — | — | — |

## 0. Interpretations (numbering continues the global chain's highest, s-viewer-inspector's I-187)

- **I-188 — the fill is the ramp; the mark is the cause.** *(Amended by Direction §4.3, which
  outranks this file.)* The cell's FILL is now the coverage ramp — `--cov-0..4` by share published,
  off `data-cov` — and not the registry's severity tint. The severity tints said "needs attention" in
  four colours; the ramp says *how much of this is measured* in one hue, which is the question a QS
  opens this screen with, and it is colour-blind safe by construction (one hue, lightness steps
  ≥ 12 L\*). The CAUSE is still the mark, and the mark is now three things at once — a glyph, a
  pattern and a colour (I-211) — so nothing is carried by colour alone (R-UI-060) and no second table
  of cause colours exists to drift from the registry.
- **I-189 — one cell, two axes, two marks.** L-QTY-05's axes are orthogonal, so a cell may be both
  unmeasured and held out of the bill and must say both. The measurement axis is the centred glyph;
  the bill axis is the §4.3 hatch over the whole cell plus a second, smaller glyph in the lower-right
  corner. The hatch is now `--pattern-hatch` on the cell's own `::after` in `currentColor` rather than
  an SVG `<defs>` pattern — same 45°, same pitch, one home, and it prints in the certificate's
  greyscale (R-UI-060). Exactly ONE of the two marks carries `data-testid="coverage-cell-glyph"` with
  `data-code`: the axis the cell is READ under (I-198). Rejected: a single glyph showing whichever
  axis lost, which would hide a measurement cause behind a bill decision.
- **I-190 — RETIRED: the grid is DOM, so its focus reticle is the tree's own.** The drawn reticle
  existed because `cx-reticle` renders through `::after` and an SVG `<g>` hosts no pseudo-element.
  The matrix is now boxes, every cell hosts one, and every cell wears `cx-reticle` from the single
  CSS home (B-17, R-UI-012). `coverage-reticle.tsx` is deleted with the reason it existed. Three
  properties came with the move and none of them could be had in a viewBox: `position: sticky` for
  the frozen kind column and the frozen class/level header, the §4.3 `--pattern-*` hatches in
  `currentColor`, and text that ellipsises. That is why the grid is no longer drawn.
- **I-191 — a cause is a reading of the project, not a refusal of a request.** The inspector states the
  cause and its remedy as its own two lines, `coverage-inspector-cause` and
  `coverage-inspector-remedy`, taking their words verbatim from the registry entry — one home for the
  words (R-SPINE-062), never paraphrased. `RefusalState` stays the one renderer of refusals *of a
  request*: a refused door in `coverage-answer`, a refused preview or commit inside the dialog's own
  slot. No code is rendered as text and no card chrome is imitated, so this is not the screen-local
  refusal block B-17 forbids.
- **I-192 — arm order governs both axes, and a beaten declaration is marked, not hidden.** A
  declaration that a cell is absent, over a cell that now bears published lines, is beaten on its own
  axis: the cell reads `data-measurement="QUANTITY_BEARING"` (or `data-bill="IN_BILL"`) and
  `data-contradicted="true"`, the inspector states it in a sentence, and both statements omit the
  cell — a certificate never prints a boundary the lines deny. The row stays; nothing is withdrawn.
- **I-193 — a cell replaces the address, never pushes it.** Selecting a cell `history.replaceState`s
  `?cell={kind}:{class}:{levelId}`, so the address is shareable and Back leaves the screen instead of
  walking a reader backwards through fifty clicks. On mount the named cell is selected and holds the
  grid's one tab stop; a `cell` this residue does not hold selects nothing and says nothing — no code
  is invented for a stale address (s-takeoff-register I-182's idiom).
- **I-194 — a door stands only where it could be carried.** Both doors are absent — not disabled — on
  a cell whose axis already reads QUANTITY_BEARING, on a cell whose declaration of that cause is
  already in force (a second one refuses `ACT_CHANGES_NOTHING`), on a kind-grain row, and while the
  permission is not held: a door that can answer only a refusal is theatre (participants I-50). They
  render `disabled` while offline, which is a connection, not a judgement.
- **I-195 — the key line names meanings, never codes.** *(Amended by Direction §3.5 and §8: the
  legend was 540 px tall and is now ONE 28 px line.)* Codes are machine-readable only (refusal-state
  §7), so a key entry renders the mark and the WORD it is read by — Published, Partial, Absent, Out of
  scope, Held, No class, Catalogue only — while the registry's whole sentence rides on `data-meaning`
  and is rendered by the shipped `Tooltip` on hover AND on focus, which is why the entry is a tab
  stop. Seven entries, the one measured reading first and then the closed cause set in the law's own
  order: the measured reading is no longer lifted out onto a line of its own, because on one line
  there is no "above". The remedies are gone from the key and stand in the inspector, where the cell
  that needs one is.
- **I-196 — a kind with no cell is a row, and the screen is `partial` while one stands.** A work item
  no class bears, and a borne kind no sighted class bears, cannot be celled out — they are rendered
  at the head of the grid as kind-grain rows spanning the class-and-level extent, with
  `data-grain="KIND"` and `data-class=""` `data-level=""`, and the screen reads `partial`. Shown,
  never hidden (R-UI-050).
- **I-209 — a module reaches the frame's slots through injected mounts.** `useInspector`,
  `useShellToolbar` and `useShellStatus` live in `@/ui/shell` and ARCH-01 bars a module from importing
  them — but the inspector and the tool row are the frame's regions and a screen that drew its own
  would spend the work surface's height on chrome (Direction §1). So the workspace writes both nodes
  and hands them to `chrome.InspectorMount` and `chrome.ToolbarMount`, two more injected renderers
  (I-170); `coverage-screen.tsx`, the one file that may reach both trees, is where the hooks are
  called, and the tool row's STRIP is the shipped `ShellToolbar` so the 32 px is the frame's arithmetic
  and not a second copy of it. A mount nobody hands over renders the nodes in place, so the module is
  a whole screen on its own and a suite mounts what a reader meets. Rejected: the workspace publishing
  a selected-cell callback and the binding file re-rendering the inspector, which would put this
  screen's composition in two files.
- **I-210 — "share published" is a fact the residue already holds.** The ramp needs a number per cell
  (§4.3) and the residue is not a percentage, so the number is defined and never invented: a cell
  bearing published quantity is 1; a cell standing under any other cause has published nothing and is
  0; and the one reading between them — `INGESTION_TRUNCATED`, a cell whose sheet was read only in
  part — is the share of ITS OWN sightings that stand on sheets the reading does not list as
  truncated. The kind row's own header carries the row's share, published cells over borne cells,
  which is §4.3's "project-level heat" at the grain a reader scans by. Steps: 0 % → `--cov-0`, then
  1–25, 26–50, 51–75, 76–100. Nothing rounds up into "measured" (`heat.ts`, and the CoverageChip's own
  law).
- **I-211 — a mark is a glyph AND a pattern AND a colour, and the map is total.** §4.3 names seven
  marks; `MARK_OF` maps every reading a cell can hold onto exactly one of them, keyed by the union
  itself, so a reading with no mark is a compile error — the same totality `CAUSE_GLYPHS` and the act
  map already keep. The cell publishes `data-mark`, and the stylesheet reads that ONE attribute for
  the pattern and the colour; the module states no colour and the sheet computes no share. Published
  ● solid, partial ◐ dots, absent ○ hairline + danger, out of scope ⊘ cross, held ⊖ hatch, no class
  sighted ⋯ dotted hairline, catalogue-only ▫ plain.
- **I-212 — the certificate is a document, and a document is not the work surface.** The two boundary
  statements are law (L-QTY-07) and are never unmounted, but they are prose under a grid that must
  hold ≥ 55 % of main (§7 C1). So the section keeps its place beneath the tally, capped at 192 px with
  its own scroll, and the tool row carries the one control that shuts it — open by default, because a
  boundary statement nobody can see is a statement nobody reads. Rejected: a modal preview, which
  would put a certificate behind a door on the screen that exists to state it.
- **I-213 — an identifier on this screen is a chip, and an enum is a word.** The pinned revision, an
  act id and a sighting's source key are opaque values a person copies, never reads: each renders
  through `IdChip` (short on screen, whole in `data-value`, one press from the clipboard, R-UI-082),
  keeping this screen's own class for the picture mask. `REGISTER`, `PARTITION`, `LAYOUT`,
  `DECLARATION` and a rail's reason render through `EnumLabel`, which leaves the SCREAMING form inside
  `[data-technical]` for the engineer and the suite. The drawing id column is gone: a uuid that
  duplicates the sheet's own name earned no column (§6, §7 C6).
- **I-197 — coverage's copy is the coverage module's own.** `src/ui/strings/takeoff.ts` is another
  node's file and is not touched: every key here, the nav entry's included, lives in
  `src/modules/takeoff/coverage/copy.ts` and is read by the app layer, which may reach both. Rejected:
  appending to the register's string table.

## 1. Layout and hierarchy

**Nav.** `takeoff/layout.tsx` gains a second `next/link`, `<a data-testid="takeoff-nav-coverage">`
`takeoff_nav_coverage`, after `takeoff-nav-register`; every attribute of the entry — height, padding,
type, `aria-current="page"`, the 2 px `--beam-500` underline — is the register entry's, unchanged
(s-takeoff §1). This pays that Decision's §8 IOU.

The page renders in `shell-main` as `<div class="cx-coverage" data-testid="coverage-screen"
data-state={…} data-density={…} data-campaign={campaignId}>`, column flex, `gap: var(--space-2)`,
`height: 100%` — the screen fills main and hands what is left to the grid (§7 C1). There is no `<h1>`
and no caption: the breadcrumb names the page (§3.2, §7 C3) and a heading with a sentence under it is
the composition §1 refuses. The two px literals this screen states are held as custom properties on
this root: the kind column's 200 and the certificate's 192.

**Tool row (the frame's 32 px slot, I-209)** — `ShellToolbar` labelled `takeoff_coverage_tools_label`,
holding `takeoff_coverage_revision_label` beside the `setRevisionId` as an `IdChip` (class
`cx-coverage-revision`, §7's mask), and one core secondary Button, `takeoff_coverage_certificate_hide`
/ `_show`, which shuts and opens the certificate (I-212). Controls in the row are `calc(var(--toolbar-h)
- var(--space-1))` = 28 px, the frame's own arithmetic.

**Answer slot** — `<div data-testid="coverage-answer" aria-live="polite">`, empty until a door is
refused, then exactly one RefusalState and no chrome around it (R-UI-020); `:empty` collapses it.

**Work surface** — `<section class="cx-coverage-work" aria-label={takeoff_coverage_grid_label}>`,
column flex, `flex: 1`, holding the key line, the matrix and the tally. The section is labelled rather
than headed: a heading that exists only to be an `aria-labelledby` target is a heading nobody wanted
to read.

**The key line (I-195)** — `<div data-testid="coverage-legend" role="list">`, one row `var(--row-h)`
high on `--surface-panel`, seven `<span data-testid="coverage-legend-entry" data-code data-mark
data-meaning role="listitem" tabindex="0">`, each the mark at `--icon-md` beside its word, wrapped in
the shipped `Tooltip` whose content is the registry's sentence. The mark is coloured exactly as the
grid colours the cell that wears it.

**The matrix** — `<div data-testid="coverage-grid" role="grid" aria-label aria-colcount aria-rowcount
data-density>`, `flex: 1`, `overflow: auto`, hairline, radius 4. It is the ONE scroll container: the
box scrolls both ways and the page never does (§7 C10). Every row is
`grid-template-columns: var(--cx-coverage-kind-w) repeat(var(--cx-coverage-columns), var(--row-h))`,
`width: max-content`, `min-width: 100%` — the column count is the only number the component states and
it rides as a custom property, so the stylesheet keeps every measure (ARCH-01).

- Two sticky header rows in one `role="rowgroup"` pinned `top: 0`: the class band
  (`role="columnheader"`, the class verbatim, spanning its levels) over the level row (the level's
  `label` verbatim, mono 12, centred, `aria-label` = `takeoff_coverage_column_label` so a reader who
  hears one column hears both axes). The corner cell is `takeoff_coverage_kind_column`, sticky on both.
- One `<div data-testid="coverage-kind-row" role="row" data-kind>` per kind — kind-grain rows (I-196)
  first, then the borne kinds in `compareCanonical` order — opening with a sticky
  `role="rowheader"` kind cell: a 4 px ramp bar (`data-cov`, I-210) beside the kind verbatim in mono
  12, ellipsised, `aria-label` naming the row's share measured. The name is text on the panel and is
  never tinted: text keeps its contrast (R-UI-002).
- Each cell is `<div data-testid="coverage-cell" role="gridcell" class="cx-coverage-cell cx-reticle"
  data-kind data-class data-level data-grain data-measurement data-bill data-contradicted data-code
  data-mark data-cov tabindex={active ? 0 : -1} aria-selected aria-label>`, `var(--row-h)` square,
  seamed by hairlines, filled from the ramp by `data-cov` and patterned by `data-mark` on its own
  `::after` (I-211). A kind-grain row's one cell spans `2 / -1`. The centred glyph is the measurement
  reading at half the cell; when the cell is held out of the bill a second glyph stands at a quarter
  of the cell in the lower-right corner (I-189). `data-contradicted="true"` draws a 1 px inset danger
  edge, which the aria-label and the inspector also state in words. Selection is a 2 px inset
  `--line-accent`; hover a 1 px inset `--accent`; focus is `cx-reticle`, from its one home (I-190).

The glyphs are unchanged and still drawn geometry, never font characters, from one total map over the
reading union — a reading without a mark is a compile error — on a 16 px viewBox, 1.5 px stroke,
`currentColor`:

| reading | mark | §4.3 mark | pattern | colour |
|---|---|---|---|---|
| QUANTITY_BEARING | filled disc, r 4 | published ● | `--pattern-solid` | `--cov-4` fill, inverse ink |
| INGESTION_TRUNCATED | open ring with a 90° gap at the upper right | partial ◐ | `--pattern-dots` | the ramp step of its own share (I-210) |
| NOT_ESTABLISHED | open ring, r 4 | absent ○ | `--pattern-none` + hairline | `--state-danger` |
| NOT_IN_PROJECT_SCOPE | open ring struck by a diagonal bar | declared out of scope ⊘ | `--pattern-cross` | `--ink-disabled` |
| NOT_IN_THIS_BILL | open ring crossed by a horizontal bar | held ⊖ | `--pattern-hatch` | `--state-warn` |
| NO_BEARER_SIGHTED | open ring, dashed 2/2 | no class sighted ⋯ | `--pattern-none`, dotted hairline | `--ink-disabled` |
| KIND_NOT_YET_SEEDED | three dots in a row | catalogue-only ▫ | `--pattern-none`, no edge | `--ink-disabled` |

Keyboard (R-UI-032): the grid takes one tab stop on the active cell; arrows move focus, Home/End to
the row's ends, Enter or Space selects — arrowing never fills the inspector, because selection that
follows focus rewrites the address on every keystroke. No tooltip on a cell: the mark's words are in
the key line and the inspector, and a tooltip would be a third home.

**The tally (§3.5's footer)** — `<div class="cx-coverage-tally">`, one row `var(--row-h)` high, mono
12: `takeoff_coverage_footer_cells` then one `takeoff_coverage_footer_tally` per mark that stands in
this reading, in the marks' own order, with the marks nothing wears left out — a footer printing
"0 held" would say something about a boundary nobody moved.

**Inspector (the frame's ONE right column, I-209)** — `<aside data-testid="coverage-inspector"
data-cell="{kind}:{class}:{levelId}" data-kind data-class data-level>`, mounted through `useInspector`
and rendered ONLY while a cell is selected, so with no selection the column is absent at width 0
(R-UI-080, §7 C3). In order: one fact line, kind · class · level verbatim in mono (a kind-grain row
reads `takeoff_coverage_kind_grain_label` in place of class and level); `<h3>`
`takeoff_coverage_cause_heading` over `<p data-testid="coverage-inspector-cause" data-code data-cause
data-act>` — the mark and its word, then the registered message (I-191); the act as an `IdChip` under
`takeoff_coverage_declared_label` where a declaration is in force (I-213); `<div
data-testid="coverage-inspector-remedy">`, the registered remedy as ONE sentence and ONE button —
`takeoff_coverage_remedy_ruleset` to the rule set for `KIND_NOT_YET_SEEDED`, `_empty_campaign_action`
to the register for every other cause, so a refusal always carries a remedy AND a link (R-UI-020);
`takeoff_coverage_contradicted_note` on a contradicted cell (I-192). Then `<h3>`
`takeoff_coverage_sightings_heading` over a compact table — header row `_channel_label` / `_view_label`
/ `_source_label`, then one `<tr data-testid="coverage-inspector-sighting" data-channel data-source>`
per Sighting: the channel as an `EnumLabel`, the view verbatim, the source key as an `IdChip` (class
`cx-coverage-source-key`) — with each in-force declaration standing in the same table under channel
`DECLARATION`, its act as an `IdChip` (class `cx-coverage-act-id`); or
`takeoff_coverage_sightings_none`. Rows are `var(--row-h)`, nothing wraps, everything ellipsises (§5).
Then `<h3>` `takeoff_coverage_observations_heading` and one `<div
data-testid="coverage-inspector-observation" data-rail data-reason>` per rail observation — the rail
verbatim in mono, the reason as an `EnumLabel` — or `takeoff_coverage_observations_none`. Foot
(I-194): core secondary Buttons `<button data-testid="coverage-hold-out">` and `<button
data-testid="coverage-declare-out-of-scope">`, each opening the shipped ConsequenceDialog at `actType`
`HOLD_OUT_OF_BILL` / `DECLARE_NOT_IN_PROJECT_SCOPE`, `container` the screen root (I-167). Neither
commits anything itself. There is no idle panel and no idle sentence: an absent column says it.

**Certificate preview (I-212)** — `<section data-testid="coverage-certificate-preview" data-open>`
beneath the tally, `max-height: 192px` with its own scroll, `display: none` when shut: `<h2>`
`takeoff_coverage_certificate_heading`, then exactly two `<section data-testid="coverage-statement"
data-axis>` in this order and never merged — `MEASUREMENT` then `BILL`, each with its own title and
never a shared cause column (L-QTY-07). Each holds a `<ul>` of `<li
data-testid="coverage-statement-row" data-kind data-class data-level data-levels data-code>` in
`compareCanonical` order over (kind, class, level): the three model values verbatim in mono, then the
registered message as prose, on one `var(--row-h)` line that never wraps. An empty statement renders
`<p data-testid="coverage-statement-none" data-code="NONE">` with its own sentence. The statements
print in `var(--font-doc)` at `var(--text-13)` on `--surface-panel` inside a hairline border — this is
document text previewed as document text. No count appears anywhere in this section (L-QTY-07),
asserted as an absence. The two hints it used to carry are gone: §6 allows one helper line in main and
this screen spends it on none.

## 2. States (R-UI-050), ruled cell by cell

Declared in `takeoff/coverage/states.ts` (`COVERAGE_STATES`) and appended to
`src/ui/screen-states/matrix.tsx` under `/t/[tenant]/p/[project]/takeoff/coverage`.
`coverage-screen[data-state]` derives in this order, first holding wins: `loading` · `denied` ·
`offline` · `error` · `refused` · `empty` · `partial` · `ready`.

- **Loading** — `loading.tsx`, frame and nav intact, core Skeletons keeping the layout, never a
  spinner: one bone `var(--row-h)` high for the key line, one filling the work surface for the matrix,
  one `var(--row-h)` for the tally and one `var(--cx-coverage-doc-h)` for the preview. The bones are
  the regions, so the screen does not jump when the reading lands.
- **Empty** — the shipped `EmptyState` (glyph, title, one sentence, one primary) carrying
  `data-testid="coverage-empty"` in the work surface's place, two truths, each saying why. No campaign
  pinned: `takeoff_coverage_empty_heading` / `_body` and one action, a core secondary Button worn as a
  link to `…/drawings/sets`, `_empty_action`. A campaign that has sighted nothing:
  `_empty_campaign_heading` / `_body` and one action to the register, `_empty_campaign_action`.
- **Error** — the shipped `ErrorState`, also under `data-testid="coverage-empty"` (the two never stand
  at once): `takeoff_coverage_error_heading` / `_body`, the report id as an `IdChip` — short on screen,
  whole in the DOM, one press from the clipboard, which is what a person reading it out to support
  needs — and its retry, `takeoff_coverage_retry`, re-running `takeoff.coverage` in place. The retry's
  id is the pattern's own `error-state-retry`; `coverage-retry` survives only in the module's house
  markup, where no chrome is injected.
- **Refusal** — the one RefusalState in `coverage-answer` for a door's rejection, and the dialog's own
  slot for a preview or commit refused while it holds focus. Never a toast, never a local block.
- **Partial** — the kind-grain rows (I-196), rendered at the head of the grid with their causes. Rows
  are shown, never dropped. The note that used to stand under the grid heading is gone with the
  heading: each of those rows already states its own cause in its mark, its key word and its
  accessible name, and §6 allows this screen one helper line in main — which it now spends on none.
- **Offline** — a `<p role="status">` banner at the head of the screen, `takeoff_coverage_offline`, house
  notice chrome (`--info-surface` fill, `--info` border, `var(--radius-4)`); both doors `disabled`.
  The grid reads on: a read honest about its age is not a broken screen.
- **Permission-denied** — `permitted` is the viewer's SET_BILL_BOUNDARY on this project, read
  server-side. Without it `data-state="denied"`, both doors do not render at all, and
  `coverage-answer` holds `takeoff_coverage_denied_permission` over one RefusalState from the
  registered `PERMISSION_NOT_HELD` entry, whose evidence link is the participants screen labelled
  `_denied_holder` — the sentence that used to stand beside it was the same fact said twice.
  Reading coverage needs membership only, which the shell guard settled before the route mounted.

## 3. Copy, verbatim

### 3.1 The six registry entries (`REFUSALS`, `src/core/errors.ts`), surface `inline`

- **NOT_ESTABLISHED** · warning · **No line has been published for this kind on this class and level,
  and nothing explains the absence.** · **Measure this kind on this class and level, or declare it out
  of the project scope so the certificate can state why it is unmeasured.**
- **INGESTION_TRUNCATED** · error · **Every sighting of this cell stands on a sheet that was read only
  in part, so nothing can be measured from it.** · **Upload the sheet again from its source file, then
  measure the campaign once it has been read whole.**
- **NOT_IN_PROJECT_SCOPE** · info · **A person declared this kind out of the project scope on this
  class and level.** · **Measure this kind to bring it back: published lines take precedence, and the
  declaration is then shown as contradicted.**
- **NO_BEARER_SIGHTED** · warning · **No class sighted in this campaign bears this kind, so the
  residue holds no cell for it.** · **Pin a revision whose drawings show a class that bears this kind,
  then measure the campaign.**
- **KIND_NOT_YET_SEEDED** · info · **This work item is in the catalogue, but no class has been recorded
  as bearing it.** · **Record the class that bears this work item in the ruleset, then measure the
  campaign.**
- **NOT_IN_THIS_BILL** · info · **A person held this kind out of this bill on this class and level.** ·
  **Measure this kind to bring it back into the bill: published lines take precedence, and the hold is
  then shown as contradicted.**

### 3.2 The screen (`src/modules/takeoff/coverage/copy.ts`, keys `takeoff_coverage_*`)

`takeoff_nav_coverage` **Coverage** · `takeoff_coverage_heading` **Coverage** (the document title; the
screen itself is named by the breadcrumb) · `_revision_label` **Pinned revision** · `_grid_label`
**Kinds by class and level** (the work surface's accessible name) · `_kind_column` **Kind** ·
`_column_label` **{class} · {level}** · `_kind_share` **{count} of {total} measured** ·
`_measured_note` **A filled mark is a cell with published quantity.** · `_legend_heading` **What each
mark means** (the key line's accessible name).

The seven marks, as the key line says them: `_mark_published` **Published** · `_mark_partial`
**Partial** · `_mark_absent` **Absent** · `_mark_out_of_scope` **Out of scope** · `_mark_held` **Held**
· `_mark_no_class` **No class** · `_mark_catalogue` **Catalogue only**. The same seven as the tally
counts them, mid-sentence: `_tally_published` **published** · `_tally_partial` **partial** ·
`_tally_absent` **absent** · `_tally_out_of_scope` **out of scope** · `_tally_held` **held** ·
`_tally_no_class` **no class** · `_tally_catalogue` **catalogue only**. The tally itself:
`_footer_label` **Counts by mark** · `_footer_cells_one` **{count} cell** · `_footer_cells_other`
**{count} cells** · `_footer_tally` **{count} {mark}** — the count picks its own form through
`countCoverageCopy`, so "1 cells" cannot be written here (§6).

The tool row: `_tools_label` **Coverage tools** · `_certificate_show` **Preview certificate** ·
`_certificate_hide` **Hide certificate**.

The inspector: `_level_label` **Level** · `_kind_grain_label` **Every class and level** ·
`_cause_heading` **Why this cell reads as it does** · `_declared_label` **Declared by act** ·
`_contradicted_note` **Lines have been published for this cell since this declaration was made, so the
published quantity stands and the declaration is not printed on the certificate.** ·
`_remedy_ruleset` **Open the rule set** · `_sightings_heading` **Sighted in** · `_channel_label`
**Channel** · `_view_label` **View** · `_source_label` **Read at** · `_sightings_none` **No channel
sighted this class on this level.** · `_observations_heading` **What the rails observed** ·
`_observations_none` **Nothing was observed for this cell.** · `_hold_out` **Hold out of this bill** ·
`_declare_out_of_scope` **Declare out of project scope**.

The certificate: `_certificate_heading` **Certificate preview** · `_statement_measurement_title`
**Statement of the measurement boundary** · `_statement_measurement_none` **This campaign measured
every kind borne by every class it sighted, on every level.** · `_statement_bill_title` **Statement of
the bill boundary** · `_statement_bill_none` **Nothing has been held out of this bill.** ·
`_statement_measurement_none_unpinned` **No campaign is open, so there is no measurement boundary to
state yet.** · `_statement_bill_none_unpinned` **No campaign is open, so there is no bill to hold
anything out of yet.**

The cell's name: `_cell_label` **{kind} on {class}, {level}: {cause}** · `_cell_label_kind_grain`
**{kind}, every class and level: {cause}** · `_cell_label_measured` **Quantity is published for this
cell.** · `_cell_label_held` **Held out of this bill.** · `_cell_label_contradicted` **A declaration
over this cell is contradicted by published lines.**

The states: `_empty_heading` **No campaign is open on this project** · `_empty_body` **Coverage is read
from a pinned drawing set revision. Pin one, and every cell it bears appears here.** · `_empty_action`
**Browse drawing sets** · `_empty_campaign_heading` **This campaign has sighted nothing yet** ·
`_empty_campaign_body` **No class has been sighted in the pinned revision, so the grid bears no cell.
Run a measure run from the register, and the cells appear as the rails publish.** ·
`_empty_campaign_action` **Open the register** · `_loading` **Reading what this campaign measured, and
what it did not.** · `_error_heading` **Coverage could not be read** · `_error_body` **Nothing was
changed. Try again, and quote the report id if it keeps happening.** · `_report_label` **Report id** ·
`_retry` **Try again** · `_offline` **You are offline. Coverage reads as it stood when this page
loaded, and nothing can be committed until the connection returns.** · `_denied_permission` **Holding
a kind out of this bill and declaring one out of the project scope each need the SET_BILL_BOUNDARY
permission on this project.** · `_denied_holder` **A project principal can grant it on the participants
screen.**

RETIRED by the rebuild, and deleted rather than left to rot (B-19): `_caption` and `_partial_note`
(§6 allows one helper line in main and this screen spends none), `_certificate_hint`,
`_statement_measurement_hint`, `_statement_bill_hint`, `_observations_hint` and `_doors_hint` (four
sentences explaining sections that now say what they are), `_inspector_idle_heading` / `_idle_body`
(an absent column is the idle state, R-UI-080), `_kind_label` / `_class_label` (the fact line is three
model values, not three labelled fields) and `_drawing_label` (I-213).

The cell's accessible name is `_cell_label` (or `_cell_label_kind_grain`) filled with the kind, class
and level verbatim and `{cause}` filled with the registered message, or with `_cell_label_measured`;
`_cell_label_held` and `_cell_label_contradicted` are appended, in that order, where they hold — so
the name says the kind, the class, the level and the cause in words, and never a code (AC-5, I-195).
Voice: calm, concrete, professional; no exclamation marks; no build vocabulary — "rail" survives only
where the product already names its own publishers (s-takeoff §3), and "seam", "ingest", "manifest",
"residue" and every clause id appear nowhere a reader can see. Kinds, classes, levels, channels,
drawings, views, source keys, act ids, permission names and report ids are model data, rendered
verbatim in mono, never woven into a sentence (I-25). Registry messages and remedies are never
paraphrased.

## 4. Motion (R-UI-004)

Nothing on this screen eases in. The grid paints at once, the inspector's content swaps instantly when
a cell is selected — a panel that slides while a reader is comparing cells is theatre in front of a
fact — and the statements arrive untweened. The only transitions: a cell's hover stroke and the nav
link's colour over `var(--motion-state)` `var(--ease)`; the shipped reticle's own, from its one home (I-190); the
shipped Tooltip's own delay on the key line; the Skeleton pulse while `loading.tsx` holds the route;
the ConsequenceDialog's own entrance. Horizontal scrolling of the grid box is the browser's, never
`behavior: "smooth"`. Every duration is a token zeroed at source under reduced motion, so
`coverage.css` carries no `prefers-reduced-motion` branch.

## 5. Tokens

Surfaces and ink: `--surface-app`/`--surface-panel` · `--ink`/`--ink-secondary`/`--ink-muted`/
`--ink-disabled`/`--ink-inverse` · `--line`/`--line-accent` · `--accent` · `--hairline`. The coverage
ramp: `--cov-0/1/2/3/4` (§4.3, I-210). The mark colours: `--state-danger` · `--state-warn` ·
`--danger` · `--info`/`--info-surface` (the offline notice). The hatches: `--pattern-none`/
`--pattern-solid`/`--pattern-dots`/`--pattern-hatch`/`--pattern-cross` and `--pattern-pitch` (§4.3,
I-211). Geometry: `--space-1/2/3/4` · `--radius-4/8` · `--text-12/13` · `--row-h` (the cell's side and
every row on this screen, R-UI-005) · `--toolbar-h` · `--icon-md` · `--z-sticky` · `--font-ui`/
`--font-mono`/`--font-doc` · `--leading-ui` · `--weight-body-medium`/`--weight-heading` ·
`--motion-state`/`--ease`.

Px literals, closed set (core I-1's mandated class): the kind column's 200 and the certificate's 192,
both stated once as custom properties on `.cx-coverage`; the 1 px and 2 px of an inset edge; the
glyph viewBox's 16 and its 1.5 px stroke, inside the drawn marks. Any other literal is a defect. No
`[data-theme]` selector, no colour, no primitive ramp position (`--graphite-N`, `--beam-N`) appears in
`coverage.css`; the mechanical half of §7's C8 reads this file and scores it. No copper appears
anywhere except on the ConsequenceDialog's confirm, which is the pattern's own — the grid commits
nothing itself, and a cause is never an act.

## 6. Themes

`coverage.css` contains no `[data-theme]` selector; every light/dark difference arrives through token
values (R-UI-001). The one reading this screen makes for itself is that the ramp's two dark steps take
`--ink-inverse` for their mark, whatever colour the mark asked for — `--cov-3` and `--cov-4` are dark
in light and light in dark, and a mark nobody can see is not a mark. Everything else inherits:
`currentColor` carries the glyph, the hatch and the pattern together, so the three of them can never
disagree about a colour. Contrast holds on the founder values in both themes: ink-muted, ink-secondary
and ink on `--surface-app` and on `--surface-panel` clear 4.5:1; the danger, warn and disabled marks
clear the 3:1 UI floor on the ramp steps they can actually stand on (0, 1 and 2 — a held or absent cell
has published nothing, so it is never painted at step 3 or 4, I-210). In greyscale the ramp collapses
and nothing is lost: the glyph, the pattern and the accessible name each say the whole reading
(R-UI-060), which is also how the certificate prints it.

## 7. Test hooks (closed contract, C-05)

Routes introduced: `/t/{tenant}/p/{project}/takeoff/coverage` (`coverageRoute`) and its widened form
`…/takeoff/coverage?cell={kind}:{class}:{levelId}` (`CELL_PARAM = "cell"`, a kind-grain row addressed
as `{kind}::`). Routes linked, all shipped: `…/takeoff/register`, `…/drawings/sets`,
`…/settings/participants` (the denial's evidence), `…/settings/ruleset` (KIND_NOT_YET_SEEDED's).

Test ids, exactly the contract's, on the elements ruled in §1 — **the rebuild added none: the registry
is closed and every new region is found by its class, its role or its name (AM-09 §1)**.
`takeoff-nav-coverage` · `coverage-screen` (`data-state`, `data-density`, `data-campaign`) ·
`coverage-grid` · `coverage-kind-row` (`data-kind`) · `coverage-cell` (`data-kind`, `data-class`,
`data-level`, `data-grain`, `data-measurement`, `data-bill`, `data-contradicted`, `data-code`,
`data-mark`, `data-cov`) · `coverage-cell-glyph` (`data-code`, on the axis the cell is READ under and
on that one only, I-198) · `coverage-legend` · `coverage-legend-entry` (`data-code`, `data-mark`,
`data-meaning`) · `coverage-inspector` (`data-cell`, `data-kind`, `data-class`, `data-level`) ·
`coverage-inspector-cause` (`data-code`, `data-cause`, `data-act`) · `coverage-inspector-remedy` ·
`coverage-inspector-sighting` (`data-channel`, `data-source`) · `coverage-inspector-observation`
(`data-rail`, `data-reason`) · `coverage-hold-out` · `coverage-declare-out-of-scope` ·
`coverage-answer` · `coverage-empty` (the EmptyState, and the ErrorState in its place) ·
`coverage-retry` (the house error cell only; the shipped one carries `error-state-retry`) ·
`coverage-certificate-preview` (`data-open`) · `coverage-statement` (`data-axis`) ·
`coverage-statement-row` (`data-kind`, `data-class`, `data-level`, `data-levels`, `data-code`) ·
`coverage-statement-none` (`data-code="NONE"`). `takeoff-nav`, `takeoff-nav-register`, `shell-toolbar`,
`empty-state`, `error-state-retry`, `error-state-report`, `id-chip`, `tooltip-content`,
`refusal-state`, `refusal-message`, `refusal-remedy`, `refusal-evidence-link`, `consequence-dialog`,
`consequence-confirm`, `consequence-digest-line`, `skeleton` and `screen-state` are other files' ids,
used and never redefined. The regions with no id of their own — the tool row's contents, the tally —
are reached by class (`.cx-coverage-tools`, `.cx-coverage-tally`) exactly as the picture masks are.

Behavioural hooks without new ids: `role="grid"`/`rowgroup`/`row`/`columnheader`/`rowheader`/
`gridcell` with `aria-label`, `aria-colcount` and `aria-rowcount` on the matrix; `aria-selected="true"`
on exactly the selected cell and `tabindex="0"` on exactly one cell; `role="list"`/`listitem` on the
key line, each entry a tab stop so its meaning is reachable without a pointer; `aria-current="page"` on
the nav's current entry; `role="toolbar"` on the frame's strip; `role="status"` on the offline banner;
`aria-live="polite"` on `coverage-answer`; `--row-h` re-keying the cell side from the reader's own
density. Asserted absences: no `NOT EXISTS` reaches the screen's words and no refusal code appears in
any text node under `coverage-screen` outside `[data-technical]`; no UUID, digest or SCREAMING enum in
a text node outside `IdChip`, `EnumLabel` or `[data-technical]` (§7 C6, I-213); no count of any kind
inside `coverage-certificate-preview`; **no `coverage-inspector` at all while nothing is selected**
(R-UI-080, §7 C3); no `coverage-hold-out` or `coverage-declare-out-of-scope` on a QUANTITY_BEARING
cell, on a kind-grain row, on a cell naming no level, or while `data-state="denied"` (I-194); no
statement row for a cell reading `data-contradicted="true"` (I-192); no `<title>`/tooltip on a cell;
**no horizontal scroll on `html`, `body` or `shell-main` at 1280×800** — the matrix is the one scroll
container (§7 C10).

Suites: `tests/takeoff/coverage/**` — jsdom mounts of `CoverageWorkspace` over
`coverageFixture()`/`residueFixture()` with chrome bound to the shipped components (I-170) for the
grid, the two glyphs, the key line's seven entries, the inspector, the doors, the address and the seven
state cells; and the reading and the two acts through the router. Each of the six causes is exercised
by name. Journeys: `tests/e2e/journeys/j-022-coverage.spec.ts` through
`tests/e2e/pages/s-coverage.page.ts`, staged by `tests/e2e/takeoff/coverage-stage.ts`, checkpoints
`j-022-coverage/{grid,held-out,certificate}`; `tests/e2e/journeys/j-000-coverage.spec.ts`, checkpoints
`j-000/{column-lines,coverage-grid}`. axe serious/critical = 0 at each, never widened. `masks()`
covers the shell breadcrumb, `shell-user`, `shell-tenant-switcher` and this screen's three per-run
texts by class — `.cx-coverage-revision`, `.cx-coverage-act-id`, `.cx-coverage-source-key`, each now
the class handed to the `IdChip` that renders it — which exist for that masking and are not ids,
because the contract is closed. Re-baselined under B-20, in
its own `baseline:` commit naming the nav entry as the proof: `s-takeoff/register.png`,
`s-takeoff/measure-queued.png` and the j-021 pictures that show `takeoff-nav`, whose bytes move only
because the nav gains a second entry.

## 8. Recorded IOUs (owner named, never a comment in `src/`)

Withdrawing or superseding a scope declaration, and the REPIN consequence over one — owner: the act's
own later leaf; `in_force` is written true here and never flipped, and the screen offers no door that
would. The Part A declared-disagreement row a contradicted cell owes (L-QTY-09) — owner: M7's review
queue; here the cell is marked and omitted from the statements, and no queue row is written. An
`EvidenceLink` from a sighting row to the sheet it was sighted on — owner: a later leaf, once the
pattern admits a sighting, which carries no basis to colour it by. *(PAID by this rebuild: the frozen
kind column and the sticky class/level header, an IOU here and Direction §3.5's law — I-190.)* The
class-grain appendix (a sighted class bearing no kind), the
sheet-grain fidelity block, and the certificate document itself — owner: M7, per L-QTY-07. Bulk
declarations as an offered group (R-UI-023) — deliberately absent: a declaration is one act over one
cell. Folding `takeoff_nav_coverage` into `src/ui/strings/takeoff.ts` beside its sibling — owner: that
file's node, when it next opens (I-197).

Opened by the v22 rebuild. **The 24 px readout (`useShellStatus`) stands unused on this screen** —
§3.5's template gives coverage a 28 px tally of its own in main and no readout line, so nothing is
mounted there rather than a second copy of the tally; owner: a later leaf, if a coverage fact is ever
found that belongs to the frame rather than to the grid. **Virtualisation past 200 rows** (§5's rule
10) — owner: a later leaf; the matrix renders every row today, and a catalogue that outgrows that will
be felt before it is measured. **A column chooser and per-user column state** (§5's rule 3) — owner: a
later leaf; the matrix' columns are the residue's own sightings and a reader cannot yet hide one.
**The design baselines under `tests/e2e/baselines/design/j-022-coverage/`** — owner: the gate, in its
own `baseline:` commit (B-20): every pixel of this screen moved.

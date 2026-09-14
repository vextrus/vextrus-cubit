# Design Decision — S-Levels (the level-stack editor)

Route `/t/{tenant}/p/{project}/takeoff/levels` — the third tab of the takeoff lane, under
`src/app/(app)/t/[tenant]/p/[project]/takeoff/levels/**`, inside the shell frame and behind the
membership guard. Increment inc-302-levels-editor. Law: R-TO-033, L-MEA-07, L-ACT-02, L-QTY-02,
R-UI-001/002/003/004/005/010/012/020/021/030/031/050/060/080/081/082/083/084/086, S-Levels, J-031,
B-17, B-19, B-20, C-05, ARCH-01.

This screen is **cut from the grid workspace template** (Direction §3.2, `s-takeoff.md`) and
re-decides nothing it settled: the tabs row is the frame's tool track (I-230), the inspector is the
frame's ONE right column and is absent until a row is selected (I-231), the campaign's index stands
BESIDE the grid as a 240 px rail (I-233), the grid is DataTable v2 with its own furniture (I-235),
and a pointer takes a row through the table's own `rowDataOf` seam (I-236). Files:
`takeoff/layout.tsx` (one nav entry added), `takeoff/levels/{page.tsx,
levels-screen.tsx,route-address.ts,states.ts,levels.css}`; the reading and the presentational
`LevelsWorkspace` in `src/modules/takeoff/levels-ui/**` with its mirrored `copy.ts`; copy at
`src/ui/strings/levels.ts`. Chrome comes only from shipped primitives and patterns — core Button,
Input, NumberInput, Select, Skeleton, IdChip, EnumLabel, EmptyState, BasisChip, CoverageChip,
QuantityText, UnitBadge; data DataTable; the one RefusalState and the one ConsequenceDialog — plus
the `cx-levels-*` classes this file rules.

## 0. Interpretations (numbered above the chain's high-water mark, s-takeoff's I-236)

- **I-240 — the stack is the work surface; the ranges are the index beside it.** The levels grid is
  the primary region and nothing stands above it inside `shell-main` — no filter bar, no heading,
  no caption. The partition's views whose typical range is unstated are the campaign's index for
  this screen and live in the 240 px rail (I-233), because a view with no range is a fact ABOUT the
  stack, not a level in it. Rejected: a second table under the grid, which is height the stack pays
  for and pushes the fold past §7 C2.
- **I-241 — a roll-up is read, never re-derived.** Each `levels-rollup` cell states the stored
  quantity lines of the register objects standing on that level: the count, the sum of the COMPLETE
  values at full precision, the weakest coverage and its code, exactly as `levelsViewOf` answered
  them. The screen computes no figure and derives no coverage from the standing (B-17, the risk
  note's second rejection): a contested height reaches a line only through the gate, so a level may
  read SUSPENDED while its roll-up still reads COMPLETE until the next campaign, and that is the
  truth of the record, not a defect. A PARTIAL_DECLARED roll-up renders **no value** — L-QTY-02's
  rule, the register's own (I-235) — and renders the code beside the chip.
- **I-242 — a SUSPENDED level shows no metres.** Disagreeing readings suspend (L-MEA-07), and a
  figure printed beside the word *suspended* is the very claim the suspension denies (the register's
  I-174, applied to height). `data-metres` is empty unless the standing is AGREED; the cell states
  the standing through `EnumLabel` and the inspector lists every competing reading under the note
  that names the way out — a further reading under the same key, never precedence.
- **I-243 — the two forms are in place, and only the preview button is a door.** The insert form
  (label, ordinal) opens from `levels-insert` as a Popover anchored on it; the height form and the
  range form stand open in the inspector and in the rail's range row. Typing changes nothing: the
  three doors (`levels-insert-confirm`, `levels-author-height`, `levels-author-range`) each call
  `preview…` and open the one ConsequenceDialog, which commits with the digest. No field on this
  screen is an inline edit and no cell is `meta.editable`: editing a level's label or ordinal in
  place is not an act that exists (L-MEA-07 — insert and repudiate only).
- **I-244 — the basis roster on this screen is exactly three.** `levels-height-basis` offers
  TRANSCRIBED, DERIVED and ENTERED through `EnumLabel`'s words and never DEFAULTED: L-MEA-07 bars
  it, and a control that offers a value the seam must refuse teaches a lie. Rejected: offering it
  disabled with a reason — the roster is the law's, not a preference.
- **I-245 — a preview that moves nothing is answered in place, and no dialog opens.** A level
  already repudiated is refused `ACT_CHANGES_NOTHING` by the seam; the screen renders that entry as
  one RefusalState in the answer slot and the dialog stays shut (the register's I-231 answer-slot
  rule). A dialog that opens on nothing is a consequence of nothing.
- **I-246 — the one primary stands where the reader is looking.** `levels-insert` renders in the
  tabs-row aside while at least one live level exists, and INSIDE `levels-empty` while none does —
  one element, one id, exactly one instance in the DOM at any time. Rejected: a second door in the
  empty state, which teaches two ways to do one thing (the register's empty-state ruling).
- **I-247 — a door whose permission the reader lacks renders, disabled, naming it.** Unlike the
  register's three acts, these doors are the only way to read what the permission is FOR: each
  renders `aria-disabled="true"` with `data-permission` naming the permission and a Tooltip
  carrying the denial pair, while the grid reads on in full. The screen's `data-state` is `denied`
  only when every door on it is shut.

## 1. Layout and hierarchy (1440 × 900)

```
┌R─┬────────────────────────────────────────────────────────────────┬─ I ─────┐
│▲ │ ws › Trace Survey ▾ › Takeoff › Levels               ⌘K ⟳ ✉ ◉ │(on sel) │
│  ├────────────────────────────────────────────────────────────────┤ GF      │
│▦ │ Register · Coverage · Levels                   ● Insert a level │ ordinal 0│
│▤ ├──────────┬─────────────────────────────────────────────────────┤ SUSPENDED│
│⚙ │ Views    │ Level ▸│Ordinal│ Storey height │rcc.concrete│formwork│ ──────── │
│  │ with no  │ GF     │    0  │ Suspended  —  │ 4 · ◐ part │ 2 · ● 1│ Height   │
│  │ typical  │ MEZZ   │    1  │ Agreed 3.048  │ — · —      │ — · —  │ readings │
│  │ range    │ L1     │    2  │ Unstated   —  │ 6 · ● 2.43 │ 3 · ● 1│ ▣ 3048mm │
│  │ ──────── │ L2     │    3  │ Agreed 3.048  │ 6 · ● 2.43 │ 3 · ● 1│  S-102·GF│
│  │ B-2 typ. │        │       │               │            │        │ ✎ 3.2 m  │
│  │ from[ ]  │  28 px rows · 13 px · frozen Level · sticky header   │  (this   │
│  │ to  [ ]  │                                                      │   reader)│
│  │ ● Preview│                                                      │ ──────── │
│  │ ──────── │                                                      │ Height[ ]│
│  │ B-3 typ. │                                                      │ Unit  ▾  │
│  │ …        │                                                      │ Basis ▾  │
│  │          │                                                      │ Source[ ]│
│  │          │                                                      │ ● Preview│
│  │  240 px  │                                                      │ Repudiate│
└──┴──────────┴─────────────────────────────────────────────────────┴─────────┘
```

Above the fold at 1440×900 and 1280×800: the grid's first row is **52 px** below the top of main
(24 px of the frame's padding, the 28 px sticky header) — inside §3.2's hard 240 and inside §7 C2's
own 120. Work-surface share: with nothing selected the grid is 1136 × 756 of main's 1392 × 804 =
77 %; with the inspector mounted 816 × 756 = 55 %. At 1280×800 the rail takes its 160 min while the
inspector stands (736 × 756 of 1232 × 804 = 56 %), and the grid scrolls inside its own container —
never the page (§7 C10).

| Region | What it holds | Width / height rule | Tokens | Empty |
|---|---|---|---|---|
| tabs row (frame's track) | `takeoff-nav-register` · `takeoff-nav-coverage` · `takeoff-nav-levels` (`aria-current="page"` here), and in `useTakeoffTabsAside` the ONE primary `levels-insert` | 100 % × `--toolbar-h` 32 | `--ink-secondary`, `--ink`, `--line-accent`, `--surface-panel` | the aside is empty while the stack is empty (I-246) |
| answer slot | one RefusalState from a refused door; the offline banner above it | 100 % × auto, `display:none` while empty | `--state-info(-surface)`, `--radius-4`, `--hairline` | absent (no box) |
| index rail (`levels-ranges`) | the views whose typical range is unstated: caption, drawing `IdChip`, `levels-range-from` / `-to` Selects over the live stack, valued by level and read in ordinal order, and the `levels-author-range` door, one `levels-range-row[data-view]` each | `flex: 0 0 240px` (min 160, max 320), scrolls alone; rows auto | `--surface-panel`, `--hairline`, `--ink-muted`, `--text-caption` | the section stands and states `levels_ranges_none` |
| grid (primary) | the shipped DataTable: `levels-row` per LIVE level in ordinal order; columns Level (frozen) · Ordinal · Storey height · one roll-up per kind | flex, ≥ 55 % of main; rows `--row-h` 28, header 28 sticky | `--surface-app`, `--surface-selected`, `--ink-code`, `--font-mono`, `--cell-px/py` | `levels-empty` in the grid's own place, rail untouched |
| inspector (frame's one slot) | `levels-inspector[data-level]`: the label, ordinal, standing; `levels-reading` per reading; the height form; `levels-repudiate` | `--inspector-w` 320 (280–480) | `--surface-panel`, `--hairline`, basis palette through BasisChip | **absent — width 0**, never a sentence |

**Grid cells.** Level: the label in 13 px `--weight-body-medium` beside its `levelId` as an `IdChip`
(R-UI-082). Ordinal: mono, right-aligned, tabular. Storey height: the standing through `EnumLabel`
(*Agreed* / *Suspended* / *Not stated*) beside `QuantityText` of `canonicalMetres` with a metre
`UnitBadge` — nothing where the standing is not AGREED (I-242), and the `code` beside it as an
`EnumLabel` where one stands. Roll-up: `{count} lines` in mono, then `QuantityText` + `UnitBadge`
(absent when PARTIAL_DECLARED), then the `CoverageChip` and, where a code stands, its `EnumLabel`.
A level bearing no line of that kind renders `—` in both halves and carries `data-lines="0"`.
No cell wraps; a clipped cell earns the table's own Tooltip (§5 rule 2).

## 2. States (R-UI-050), ruled cell by cell

Declared in `takeoff/levels/states.ts` (`LEVELS_STATES`) and appended to
`src/ui/screen-states/matrix.tsx` under `/t/[tenant]/p/[project]/takeoff/levels`, so
`missingStates()` is empty. `levels-screen[data-state]` derives in this order, first holding wins:
`loading` · `denied` · `offline` · `error` · `refused` · `empty` · `partial` · `ready`.

- **Loading** — the workspace's own root wearing `data-state="loading"`, frame and tabs row intact,
  core Skeletons keeping the layout the screen in fact has: a 240-wide rail bone beside a grid whose
  header is real and whose body is six 28 px row bones. Never a spinner on a table (R-UI-004). No
  bone stands for the inspector — it is absent at rest (R-UI-080). The leg is the SCREEN's and not a
  route `loading.tsx`: a segment file of that name makes the route its own streaming boundary, and a
  hard load of a stack heavy enough to suspend then holds the screen TWICE — the server's copy parked
  in React's hidden reveal container while the client renders its own into the fallback's place — so
  a read of `levels-screen` resolves to two elements and the one-root contract of §7 breaks.
- **Empty** — no LIVE level: the shipped `EmptyState` `data-testid="levels-empty"` in the grid's
  own place, rail untouched, carrying `levels_empty_heading`, `levels_empty_body` and, as its one
  action, the `levels-insert` door itself (I-246).
- **Partial** — rendered, never hidden. `data-state="partial"` while any live level carries a
  `code` or any roll-up reads PARTIAL_DECLARED: those rows and cells stand in the grid with their
  code beside the chip, and every other row reads as it stands. A repudiated level is not a row
  here at all — L-MEA-07 deletes nothing, and the inspector of a level repudiated while it was
  selected states `levels_repudiated_note` in place of its two doors.
- **Error** — `levels-screen.tsx`'s own cell: `levels_error_heading` / `_body`, the report id
  through an `IdChip` under `levels_report_label`, and a core secondary Button `levels_retry`
  (found by role and name) re-running `takeoff.levels` in place.
- **Refusal** — the one RefusalState in the answer slot for a door's rejection
  (`ACT_CHANGES_NOTHING`, `REQUEST_MALFORMED`, `LEVEL_ORDINAL_UNMAPPED`), and inside the
  ConsequenceDialog's own slot for anything refused while it holds focus. Never a toast, never a
  screen-local block (R-UI-020, B-17). No refusal code is spelled in any text node outside a
  `refusal-state` or a `[data-technical]` element.
- **Offline** — a `<p role="status">` banner above the answer slot carrying `levels_offline`, house
  notice chrome; every door renders `aria-disabled="true"` while it stands. The stack reads on.
- **Permission-denied** — each door renders, `aria-disabled="true"`, with `data-permission`:
  `levels-insert` → `AUTHOR_LEVEL_STACK`, `levels-author-height` → `AUTHOR_PROJECT_FACT`,
  `levels-author-range` → `MEASURE`; `levels-repudiate` carries `AUTHOR_LEVEL_STACK` (I-247). Its
  Tooltip and, when no door is open to the reader, the answer slot carry the denial pair — the
  permission (`levels_denied_stack` / `_height` / `_range`) and its holder (`levels_denied_holder`)
  — over one RefusalState from the registered `PERMISSION_NOT_HELD` entry, evidence the project's
  participants screen. The grid reads in full either way.

## 3. Copy, verbatim (`src/ui/strings/levels.ts`, mirrored to the module's `copy.ts`)

`takeoff_nav_levels` **Levels** (existing registry, `takeoff.ts`) · `levels_grid_label` **Level
stack** · `levels_col_level` **Level** · `levels_col_ordinal` **Ordinal** · `levels_col_standing`
**Storey height** · `levels_rollup_lines` **{count} lines** · `levels_insert` **Insert a level** ·
`levels_insert_label_field` **Label** · `levels_insert_ordinal_field` **Ordinal** ·
`levels_insert_hint` **The new level takes this ordinal. Every live level at or above it moves up
one, and nothing is re-keyed.** · `levels_insert_confirm` **Preview this insert** ·
`levels_empty_heading` **No level stands on this project** · `levels_empty_body` **A level carries
the storey height every vertical quantity is measured through. Insert the lowest one, and the rest
stack above it.** · `levels_readings_heading` **Height readings** · `levels_reading_basis_label`
**Basis** · `levels_reading_source_label` **Read from** · `levels_reading_written_label` **As
written** · `levels_reading_metres_label` **Metres** · `levels_reading_superseded` **Superseded by a
later reading under the same source.** · `levels_no_readings` **No height has been read for this
level. Every quantity measured through it is published as partial until one is.** ·
`levels_suspended_note` **These readings disagree, so this level has no standing height. Read the
figure again to settle it — precedence never clears a suspension.** · `levels_height_value_label`
**Height** · `levels_height_unit_label` **Unit** · `levels_height_basis_label` **Basis** ·
`levels_height_source_label` **Source key** · `levels_height_source_hint` **The evidence this figure
was read from. A later reading under the same source and basis supersedes the earlier one.** ·
`levels_author_height` **Preview this height** · `levels_repudiate` **Repudiate this level** ·
`levels_repudiated_note` **A person judged this level to be nothing. Nothing was deleted: every
reading stays on record, and the lines measured through it re-derive at the next campaign.** ·
`levels_ranges_heading` **Views with no typical range** · `levels_ranges_hint` **A view that stands
for a range of floors states it once. Until it does, nothing it holds expands.** ·
`levels_ranges_none` **Every view states the floors it stands for.** · `levels_range_from_label`
**From level** · `levels_range_to_label` **To level** · `levels_author_range` **Preview this
range** · `levels_error_heading` **The level stack could not be read** · `levels_error_body`
**Nothing was changed. Try again, and quote the report id if it keeps happening.** ·
`levels_report_label` **Report id** · `levels_retry` **Try again** · `levels_offline` **You are
offline. The stack reads as it stood when this page loaded, and nothing can be committed until the
connection returns.** · `levels_denied_stack` **Inserting and repudiating a level need the
AUTHOR_LEVEL_STACK permission on this project.** · `levels_denied_height` **Recording a storey
height needs the AUTHOR_PROJECT_FACT permission on this project.** · `levels_denied_range`
**Stating a view's typical range needs the MEASURE permission on this project.** ·
`levels_denied_holder` **A project principal can grant it on the participants screen.**

Voice: calm, concrete, professional; no exclamation marks; no build vocabulary — "seam", "door",
"rail", "gate", "ingest" and every clause id appear nowhere a reader can see. Level ids, source
keys, values as written, units, ordinals, kinds and report ids are model data and render verbatim in
mono or through `IdChip`, never woven into a sentence (I-25/I-26). Standings, codes, bases,
coverages and act types render as words through `EnumLabel`, the raw value under `data-technical`.
Registry messages and remedies are never paraphrased. The permission names inside the three denial
lines are the product's own law, quoted as the seam quotes them.

## 4. Motion (R-UI-004)

Nothing on this screen eases in. Selecting a row, mounting the inspector, a reading's arrival, a
roll-up's change after a commit and the refusal rows are instant — an answer that performs before it
is read is theatre. The only transitions are inherited from single homes: the inspector slot's
240 ms panel slide (`--motion-panel` `--ease`, the frame's own), the insert Popover's entrance and
the ConsequenceDialog's (the primitives' own, `--motion-state` `--ease`), Button and Select hover
colours and the nav link's colour at `--motion-state`, the reticle draw at `--motion-reticle` from
`reticle.css`, and the Skeleton pulse while the screen stands in its `loading` state. Every duration is a token
zeroed at source under `prefers-reduced-motion`, so `levels.css` carries no reduced-motion branch.

## 5. Tokens

Only the semantic alias group and the density/layout tokens (Direction §4.1, §4.2) — a
`--graphite-*` or `--beam-*` reference outside `tokens.ts` is a lint failure (R-UI-086). This screen
spends: `--surface-app` / `--surface-panel` / `--surface-sunken` / `--surface-selected` · `--ink` /
`--ink-secondary` / `--ink-muted` / `--ink-code` · `--line-accent` · `--accent-subtle` ·
`--state-info` / `--state-info-surface` · the basis palette and the coverage bands, reached only
through BasisChip and CoverageChip · `--hairline` · `--space-1/2/3/4` · `--gap-section` ·
`--radius-2/4/8` · `--text-body` / `--text-caption` · `--font-ui` / `--font-mono` · `--leading-ui` ·
`--weight-body-medium` / `--weight-heading` · `--row-h`, `--control-h`, `--cell-px`, `--cell-py`,
`--toolbar-h`, `--inspector-w` through the primitives that read them · `--motion-state` /
`--motion-panel` / `--ease`. Px literals, closed set: the index rail's 240 and its 160/320 bounds,
the tabs-row current underline's 2, the column widths (Level 180 · Ordinal 80 · Storey height 288 ·
each roll-up 160), the lg media-query value, and the loading bones' 28/240. Any other literal is a
defect. The standing column is 288 and not the 200 this table first fixed: a standing says two
things — the word the height stands at and, where it stands at none, the code a line reports the
absence under — and 200 cut the second one mid-glyph. 288 holds both, and stops short of the width
at which the last column's resize grip would stand under the table's own tools (R-UI-012). No copper appears anywhere except the ConsequenceDialog's confirm, which is the primitive's
own — this screen commits nothing itself.

## 6. Themes

`levels.css` contains no `[data-theme]` selector; every light/dark difference arrives through token
values (R-UI-001). Dark is the default and light is complete; both are baselined. Contrast holds on
the founder values in both themes: graphite-600/700/900 on graphite-0 and on the rail's and
inspector's graphite-50 clear 4.5:1; the beam-500 current-tab underline clears the 3:1 UI floor. The
three standings, the two coverages and the seven bases are each redundant to a word and, for the
bases, a glyph (R-UI-002), so nothing is lost in greyscale or to colour blindness. The rail and the
inspector stand one step off the field, seamed by hairlines; the grid keeps the field's own fill so
the numbers read on the brightest ground.

## 7. Test hooks (closed contract, C-05)

Routes: `/t/{tenant}/p/{project}/takeoff/levels` (`levelsRoute`, crumbs in `routes.ts`:
workspace › project › Takeoff › Levels); the file route
`/t/[tenant]/p/[project]/takeoff/levels`. Routes linked, all shipped: `…/takeoff/register`,
`…/takeoff/coverage`, `…/settings/participants` (the denial's evidence), `…/drawings` (a range
row's drawing). Procedures: `takeoff.levels`, `takeoff.previewInsertLevel`,
`takeoff.commitInsertLevel`, `takeoff.previewRepudiateLevel`, `takeoff.commitRepudiateLevel`,
`takeoff.previewAuthorStoreyHeight`, `takeoff.commitAuthorStoreyHeight`,
`takeoff.previewAuthorTypicalRange`, `takeoff.commitAuthorTypicalRange`.

Test ids, exactly the registry's, on the elements ruled in §1: `takeoff-nav-register` ·
`takeoff-nav-coverage` · `takeoff-nav-levels` · `levels-screen` (`data-state`) · `levels-grid`
(`data-rows-rendered`) · `levels-row` (`data-level`, `data-ordinal`, `data-standing`, `data-code`,
`data-metres`) · `levels-rollup` (`data-kind`, `data-lines`, `data-coverage`, `data-code`) ·
`levels-empty` · `levels-insert` (`data-permission`) · `levels-insert-label` ·
`levels-insert-ordinal` · `levels-insert-confirm` · `levels-inspector` (`data-level`) ·
`levels-reading` (`data-basis`, `data-source`, `data-metres`, `data-superseded`) ·
`levels-height-value` · `levels-height-unit` · `levels-height-basis` · `levels-height-source` ·
`levels-author-height` (`data-permission`) · `levels-repudiate` (`data-permission`) ·
`levels-ranges` · `levels-range-row` (`data-view`) · `levels-range-from` · `levels-range-to` ·
`levels-author-range` (`data-permission`). The dialog's six — `consequence-dialog`
(`data-act-type`), `consequence-subject-row`, `consequence-effect-lines`,
`consequence-effect-signatures`, `consequence-digest-line`, `consequence-confirm` (`data-digest`) —
are the pattern's own, used and never redefined, as are `refusal-state`, `refusal-message`,
`refusal-remedy`, `refusal-evidence-link`, `datatable`, `datatable-row`, `datatable-cell`,
`basis-chip`, `coverage-chip`, `unit-badge`, `id-chip`, `skeleton` and `screen-state`. No id is
added: the retry, the headings, the rail's section title and the range and height field labels are
found by role and name. Every id is spelled once, in `src/ui/testids.ts`, and published by the
module through `RegisterChrome.testIds`.

Behavioural hooks without new ids: `aria-current="page"` on `takeoff-nav-levels` at this address;
`aria-disabled="true"` on any door whose permission the reader lacks or while offline;
`role="status"` on the offline banner and `aria-live="polite"` on the answer slot; `role="table"` /
`role="row"` / `role="columnheader"` inside the `levels-grid` wrapper; `data-technical` on every raw
enum value and level id kept beside its `EnumLabel` or `IdChip`; `cx-reticle` on every focusable.
Asserted absences: no `levels-inspector` in the DOM while nothing is selected (R-UI-080, §7 C3); no
second right column; no native `select` or `input[type=date]` (R-UI-083); no `DEFAULTED` option
under `levels-height-basis` (I-244); no `consequence-dialog` after a preview refused
`ACT_CHANGES_NOTHING` (I-245); no more than one `levels-insert` element (I-246); no `data-metres`
value on a row whose `data-standing` is not `AGREED` (I-242); no value text in a `levels-rollup`
whose `data-coverage` is `PARTIAL_DECLARED` (I-241).

Suites: `tests/takeoff/levels-ui/effects.test.ts` (the three acts' `effects`),
`tests/takeoff/levels-ui/doors.test.ts` (the nine procedures, each refusing by name),
`tests/takeoff/levels-ui/**` jsdom mounts of `LevelsWorkspace` over the fixtures at
`tests/takeoff/levels-ui/support/**`, and the copy-mirror test that fails the build if the module's
`copy.ts` and `src/ui/strings/levels.ts` ever differ. Journey: `tests/e2e/journeys/j-031-levels.spec.ts`
over `tests/e2e/takeoff/levels-stage.ts`, page objects `tests/e2e/pages/s-levels.page.ts` and
`s-takeoff.page.ts`; checkpoints `stack`, `contested`, `reaffirmed` under
`tests/e2e/baselines/design-dark/j-031-levels/**` (light under `design-light/` when the lane asks),
axe serious/critical = 0 at each, `masks()` over the shell breadcrumb, `shell-user`,
`shell-tenant-switcher` and `consequence-digest-line`. Re-baselined under B-20, in a `baseline:`
commit naming the proof: `design-dark/s-takeoff/**`, `design-dark/j-021-column-slice/**` and
`design-dark/j-022-coverage/**` — the third tab moved the takeoff tabs row on every picture that
shows it — and `tests/takeoff/levels/**` where a deep-equal froze a Consequence without `effects`.

## 8. Recorded IOUs (owner named, never a comment in `src/`)

- **Roll-ups that re-derive in place.** A reading changes and the stored lines do not: the gate
  writes `onConflictDoNothing`, so a roll-up keeps its figure until the next campaign. The screen
  NAMES the lines as re-deriving (the dialog's `consequence-effect-lines`) and rewrites nothing.
  Owner: the campaign node that re-runs the gate.
- **`signaturesVoiding` is always `[]`.** The slot renders **none** as the pattern requires
  (I-162). Owner: the signature increment.
- **The floor-multiplier scheme.** `LEVEL_ORDINAL_UNMAPPED` is renderable as a refusal here but no
  screen states which ordinals a tenant's scheme maps. Owner: the pricing node.
- **A per-level EvidenceLink from a reading to its drawing** (R-UI-022) — a TRANSCRIBED reading
  names a source key and cannot yet be traced to the sheet. Owner: the Trace node.
- **A copy home both layers may read**, so the module's `copy.ts` need not mirror
  `src/ui/strings/levels.ts` — re-recorded unpaid (the register's §8 precedent).

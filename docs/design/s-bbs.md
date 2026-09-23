# Design Decision — S-BBS (the bill of bars, by member and mark)

Route `/t/{tenant}/p/{project}/takeoff/bbs` — the **sixth** tab of the takeoff lane, under
`src/app/(app)/t/[tenant]/p/[project]/takeoff/bbs/**`, inside the shell frame and behind
`authorizePage({ tenant, project })`. Increment inc-310-bbs-view. Law: R-TO-054, A-BBS-PDF, S-BBS,
J-030, J-032, AM-01, AM-03, AM-05, AM-08, AM-18, L-FRM-05, L-BD-02, SEAM-DOC, V-DOCS, R-UI-002/003/
004/005/010/012/020/030/031/050/060/080/081/082/083/084/085/086, B-17, B-19, B-20, C-05, C-13.

Cut from the **grid workspace template** (Direction §3.2) exactly as S-BOQ is, and re-deciding nothing
it settled: the tabs row is the frame's tool track, the grid is DataTable v2 with its own furniture,
the one RefusalState, EmptyState and ErrorState are the shipped patterns. The template's tree and
inspector are **absent by scope** — the schedule is read whole and nothing on it is selectable, so the
shell's one inspector slot stays at width 0 (R-UI-080). Files: `takeoff/layout.tsx` (one nav entry);
`takeoff/bbs/{page.tsx,bbs-screen.tsx,route-address.ts,demonstration.ts,bbs.css}`;
`src/modules/takeoff/bbs-ui/{server.ts,present.ts,states.ts,emission.ts}`; copy at
`src/ui/strings/bbs.ts`. No pattern is invented, so no gallery entry is added.

## 0. Interpretations

- **I-bbs-1 — denied is the reader without MEASURE, and the denial is the whole screen.** The bill of
  bars is the measurement's own working paper, so its read is gated exactly as the lane's measured
  surfaces are (s-boq §2's settled denial table). `bbsStateOf` puts `denied` second, after `loading`
  and before everything else: the grid, the summary, the revision chip and the stock chip all do not
  render, and `bbs-answer` carries the one registered `PERMISSION_NOT_HELD` entry naming MEASURE and
  the principal who grants it. Rejected: rendering the schedule to a reader who cannot measure it.
- **I-bbs-2 — this screen computes nothing, so it prints no figure the door did not answer.** Every
  number on it is a stored string of `bbsOf`'s `BbsDocument`, printed through `formatUserFigure` and
  carried verbatim on the row's `data-*`. Consequently the member group row carries **no subtotal**:
  the domain's totals are per diameter and per mark, and a per-member mass would be a second home for
  a sum nobody stores (B-17). The totals the domain does have stand in the summary beneath the grid.
- **I-bbs-3 — a lap is a row, never a column and never a percentage.** AM-03(a) and L-BD-02: `bbs-lap`
  stands immediately beneath its `bbs-row`, sharing its `data-bar-key`, carrying `data-component="LAP"`
  with `data-lap-mm`, `data-laps` and `data-kg = kgLap`, and rendering only where `lapsPerBar > 0`.
  Its Mark cell reads **Lap**, its lap length and count sit in the Dimensions and Bars cells, and its
  three cutting-length cells read `—`: a lap has no cutting length of its own, and printing the bar's
  there would double the only surface BS 8666 rounds.
- **I-bbs-4 — the three lengths stand side by side, and only one of them is rounded.** Raw, rounded
  and IS-additive are three columns in that order (AM-01, AM-03(c)). The raw figure prints as stored,
  to its full stated precision; the rounded figure is the door's one rounded surface; the IS figure is
  printed beside and billed by nothing. The screen never restates the divergence as an equality and
  never offers the IS figure as the Mass column's basis.
- **I-bbs-5 — cutting stock is informational, and the screen says so once, in a popover.** Stock bars,
  pieces and offcut are the site's cutting, not the bill (AM-03(e)). The section heading carries an
  `(i)` popover with that sentence, so the screen keeps its one helper line for coverage (Direction
  §6, §7 C7) and the disclosure is still in place rather than in a footnote nobody opens.
- **I-bbs-6 — a shape code prints as its code, in a technical cell.** `11`, `51`, `SP` are BS 8666's
  own names for the shapes, not enum keys standing in for words, so R-UI-082's SCREAMING-enum rule is
  met by rendering them inside `data-technical` mono rather than by inventing English for them. The
  PDF draws the same codes as Typst vector sketches; no raster image is ever emitted (A-BBS-PDF).

- **I-bbs-8 — exporting is a keyed job, not an act (session 4, 2026-09-21; the draft's I-270, one
  door over).** A schedule is unsigned by definition (AM-05), so there is no consequence to preview
  and no copper on this screen: `bbs-export` runs `takeoffBbs.exportSchedule` (permission MEASURE),
  which enqueues a `bbs-render` under `bbsRenderJobKey` and files the issue in Documents under the
  `bbs` kind. While the job is watched the inline `bbs-jobs` timeline stands between the answer
  slot and the grid (R-UI-024); when it succeeds the link to the issue appears beside it and no
  reload happens. The door stands only for a permitted reader with bars to render — a reader without
  MEASURE is denied the whole screen (I-bbs-1), and an empty campaign has nothing to export — and it
  is absent, never disabled, on any other evidence. This pays §7's first IOU; AM-17's M3 segment
  "emit the unpriced BOQ and the BBS as DRAFT UNSIGNED" is walked through it by J-000.
- **I-bbs-7 — the screen's one helper line stands inside the answer slot, and is named for what it
  says.** A reading that is partly declared is something this screen ANSWERS about itself, so the
  sentence stands in the same polite live region as a refusal and a denial rather than in a second
  region beside it: a reader using a screen reader hears one place speak, and `bbs-answer` is that
  place (R-UI-020, R-UI-060). The two sentences are keyed `bbs_partial` and `bbs_complete` — the
  state they belong to, named as the state is. Rejected: a status line outside the answer slot under
  `bbs_coverage_*` keys, which gave the screen two live regions saying two halves of one answer.
- **I-289 — the screen's own name is a size this Decision places, on the type scale, and it paints
  nothing (session 4, 2026-09-22).** `.cx-bbs-name` is the visually-hidden `<h1>` of I-bbs-7's
  neighbour rule (R-UI-012): absolutely positioned, 1 px wide, `clip-path: inset(50%)`. Left with no
  `font-size`, it wears the user agent's `h1` default of 2em — 28 px against the 14 px body — and
  28 is not on R-UI-003's scale {10, 12, 13, 14, 16, 20, 24, 32}, so the rubric's C11 reads an
  off-scale size on a screen that never drew one. The sheet states `font-size: var(--text-body)`,
  which is the size this screen's own prose already stands at and is already among §5's spent
  tokens: the closed px-literal set does not grow, and no pixel moves, because the element is
  clipped to 1 px and outside flow. Rejected: hiding the heading from the reading (it is the page's
  name for a reader arriving without the crumb), re-tagging it as a `<p>` with `role="heading"`
  (the rubric counts exactly one `h1`, and a real heading is the honest markup), and leaving the
  UA's 28 in place with a human note lowering C11 — a human may only LOWER a computed score, never
  excuse one.
- **I-307 — the run a vertical's bars are cut to is the canon's conversion of the level's height, in
  whatever unit the drawing stated it (session 7, 2026-09-23).** L-FRM-06 — "one factor per unit
  (`toCanonical`); every pair derives as a quotient … a conversion literal outside the canon is a lint
  failure" — bans a conversion LITERAL outside `src/core/units/canon.ts`; it does not ban asking the
  canon to convert. `storeyRunOf` (`src/modules/takeoff/rebar/bars.ts`) read "a rail converts nothing"
  into that clause and refused every height not written in `mm`, and F-RCC6-BNBC's section states its
  storeys in metres off its `EL` marks (3.353 m, 3.048 m; since D-001 GF also as 132 in), which the
  levels law holds AGREED and cited — so all 189 column `rcc.rebar` lines of session 7's J-000 run stood
  PARTIAL_DECLARED under REBAR_STOREY_RUN_UNSTATED with no bar rows. The run is now `heightOf`'s reading
  (the one reading every vertical class asks of a level; the rail's own unit check was a second spelling
  of it), carried to millimetres by `convert(value, unitNamed(unit), "mm")`, exact and never rounded
  (3.048 m → 3048; 11 ft → 3352.8), because it is a leg of BS 8666's raw cutting length (AM-01). Every
  refusal — no height, not AGREED, no citation, a spelling the canon does not name, a unit that is not a
  length — stays this leaf's REBAR_STOREY_RUN_UNSTATED, asked of the canon's recogniser first because
  `toCanonical` throws and a rail that throws loses the whole campaign (L-QTY-02). Rejected: a literal
  factor in the rail (the L-FRM-06 breach itself); a levels store holding millimetres (it keeps the unit
  as written, L-REG-01); the STOREY_HEIGHT_* codes here (what is missing on this line is a length of
  bar, L-MEA-08).

- **I-bbs-9 — the craft look of session 7 (2026-09-23): one grid, figures as the page prints them,
  and a partial total that says what it leaves out.** Four findings of the vision review are ruled
  here, against R-UI-080..086 (AM-08), and the Decision is amended in place to match:
  (a) *One grid.* The screen had drawn one DataTable per member, each with its own two-line header
  and an `h2`, so 70 % of the grid's height was repeated headers and six bars stood in view. §1
  always read ONE `bbs-grid` with `bbs-member` group rows; it is now built so. The member's group row
  is a ROW of that one table (`rowDataOf` publishes `bbs-member` with `data-member`, `data-mark`,
  `data-class`, `data-level`), not the primitive's `datatable-group-row`, because the primitive's
  group row carries neither this screen's id nor its attributes and adds a parenthesised count §1
  never drew. Its words stand in the frozen key cell and read on across the empty cells of the row;
  it carries no figure (I-bbs-2).
  (b) *Widths that fit.* A right-aligned header is set in the figure face by the primitive, and in
  that face `Diameter (mm)`, `Cutting length (mm)` and `IS additive (mm)` do not fit 88 / 128 / 112,
  so they wrapped (R-UI-084); and a Dimensions column hard-sized at 400 pushed Bars and Mass off a
  1280 screen (R-UI-080). The fixed nine are now 104 · 88 · 72 · 112 · 160 · 104 · 136 · 72 · 112
  (960) and Dimensions takes the measured remainder on the 4 px grid, never under 200 — 208 at
  1280 × 800, 368 at 1440 × 900.
  (c) *A mass is printed as the document prints it.* The PDF states every mass at
  `BBS_PLACES.mass` = 3 through `statedAt` (`emission.ts`); the screen printed the store's full
  fraction (`2,379.4443648`), two spellings of one figure (B-17). Every Mass cell, every summary mass
  and the total are now `formatUserFigure(statedAt(kg, BBS_PLACES.mass))` — digits carried half-up on
  the text, never through a float — and every `data-kg` still carries the stored decimal.
  (d) *A partial total names what it leaves out.* A partly declared campaign printed `Total mass`
  over main bars alone, and a reader takes that for the column steel. In `partial` the total row
  carries `bbs_summary_total_measured` beside the figure, muted, in the first of the three cells the
  total row otherwise leaves empty (the label cell keeps `bbs_summary_total`: the 112 px Diameter
  column cannot hold a longer label without wrapping), and beneath the status line, inside the same answer slot,
  `bbs_partial_omitted` leads the registry's own message for each code the partly declared
  `rcc.rebar` lines state in `omitted` — each once, in the order the lines first state it
  (`BbsView.omitted`, read by `bbsViewOf` off the published lines, never defaulted). Rejected: one
  RefusalState per code (two framed cards eat the grid's height for what is one disclosure), and
  printing the omitted variable's key (machine vocabulary, R-UI-082).
  The `(i)` trigger is the shipped Popover's ghost trigger around the shipped info glyph, square at
  `--control-h`, rather than a bare letter.

- **I-354 — the schedule reads from the ground up, a partial schedule says WHAT it leaves out and
  where that is settled, and only figures are mono (session 7, 2026-09-23; the vision re-look of the
  M3 project).** The re-look put the screen at the bar by score and not fit to show (themes and
  states looked 4); three of its findings are ruled here, two are recorded for their owners, and the
  Decision is amended in place to match:
  (a) *The one order a bill is read in.* `bbsOf` sorted its rows by the bar's KEY, which is opaque, so
  F-RCC6-BNBC's members came out 5F, 2F, 1F, 3F, GF, 6F, 4F … and a reader could not find a column's
  bars. The door now answers in the order a bar schedule is read (`readingOrder`,
  `src/modules/takeoff/rebar/store.ts`), reading the project's LIVE level stack in the same
  transaction as the rows for that one question: a member on no level of the stack (its register
  object in a lawful-null slot — the foundation's; a bar row states no slot, so an UNRESOLVED one
  stands there too rather than have its key read apart) first; then the levels by the stack's ORDINAL, which is
  physical (L-MEA-07) — never by label, where `GF` sorts after `5F` and `10F` before `2F`; then a label
  the stack no longer holds, last; within a level the class in the catalogue's roster order
  (`ELEMENT_TYPES`), the mark in natural order (`MARK_ORDER`, the lane's one spelling, s-schedules
  I-353 — C2 before C10), then the member's own object key, compared whole and never read apart
  (L-REG-02); inside a member the role in BS 8666's roster order (`BAR_ROLES` — main bars before
  ties), the diameter as the number it is, the bar mark in natural order, and last the bar key, so the
  order is total and two reads of one bill are one document (L-REG-04). No figure moves and no row is
  added or taken away: `present.ts` groups `document.rows` by member in the order the document names
  them, exactly as before, and the member group rows now fall in storey order because the door's do.
  The export's payload is `document.rows` in the same order, so an issued schedule reads the same
  way; the committed V-DOCS golden (`tests/docs/bbs/{payload.json,golden.pdf}`) is a fixture payload
  read in the golden's own file order and does not move.
  (b) *What is left out, why, and where it is settled.* The `bbs_partial_omitted` list printed the
  registry's messages bare: `Two readings of this note disagree, so no figure stands.` is why no LAP
  row stands anywhere on the schedule and never said "laps", and neither line said where a reader
  acts (R-UI-020). `BbsView.omitted` now carries, for each code, the COMPONENTS of the line it was
  declared for — the rail's own variable names (`net`, `lap`, `ties`), each once, read by `bbsViewOf`
  off the same published `omitted` entries it already read the codes from. Each line now leads with
  those components in words through `EnumLabel` (**Bars**, **Laps**, **Ties**; the raw name under
  `data-technical`, never printed — I-bbs-9(d)'s rule stands), then the registry's message verbatim,
  then a link to where the omission is settled with the registry's remedy as its Tooltip: the
  Schedules screen for `NOTE_READING_CONTESTED`, `REBAR_TIE_ZONE_UNSTATED`, `REBAR_SCHEDULE_UNREAD` and
  `DETAILING_ROW_NOT_IN_EDITION` (the sheets' schedules and notes are read there), the Levels screen
  for `REBAR_STOREY_RUN_UNSTATED`; a code this table does not place is said without a link rather
  than sent somewhere it is not settled. The link goes to the screen, not a sheet: the published line
  names no sheet, and a sheet guessed here would be a trace nobody recorded (R-UI-022).
  (c) *Only the figures are mono.* The stock readout set its words in mono (`Stock bar 12,000 mm ·
  rounded 25 mm`) beside `Pinned revision` in the interface's face. The words and units now stand in
  the interface's face and only the two figures in the figure face, tabular (R-UI-085).
  Recorded, not done here — each needs another owner: (d) *one group per mark and level, with its
  number of members* — identical members of one mark on one floor are listed separately, so half the
  grid is group rows and eight bars stand above the fold at 1440, where BS 8666 states a mark once
  with its No. of members. Counting members and multiplying their masses is a figure, so it is the
  DOOR's (I-bbs-2): `bbsOf` would group members of one (level, class, mark) whose bar sets are
  identical into one entry with a member count and exact, unrounded mass products; the payload and
  its template would state the count; this grid would add a `No. of members` column and one group
  row per (level, mark); and J-032's "one group row per member" read (`data-member` = `objectKey`)
  would be amended with it. That changes the bill's shape, which is the owner's call (the rebar
  door, `src/modules/takeoff/rebar/**`, and the document kind). (e) *a placement label on each
  member row* — members of one mark and floor still read `5F · Column · C1` alike, told apart only by
  order; a grid intersection (`B-3`) is the partition's reading of the member's placement against the
  drawing's axes and would ride a bar row from the rebar rail (`bars.ts`, a `bar_rows` column and a
  migration) — the rail's, the partition's and `db/**`'s, all held elsewhere.

## 1. Layout and hierarchy (1440 × 900)

```
┌R─┬──────────────────────────────────────────────────────────────────────────────┐
│▲ │ ws › Sattva Court ▾ › Takeoff › Bar schedule                    ⌘K ⟳ ✉ ◉ │ 40
│  ├──────────────────────────────────────────────────────────────────────────────┤
│▦ │ Register · Coverage · Levels · Schedules · Draft BOQ · Bar schedule           │ 32
│▤ │                       rev a3f9c2 ⎘ · Stock bar 12,000 mm · rounded 25 mm      │
│⚙ ├──────────────────────────────────────────────────────────────────────────────┤
│  │ Some rebar lines are partly declared, so their bars stand here as they read.  │ 28
│  ├────────┬──────┬────┬─────┬──────────────┬─────────┬───────┬───────┬────┬─────┤
│  │Bar mark│ Role │Shp │ Dia │ Dimensions   │ Cutting │Rounded│IS add.│Bars│Mass │ sticky
│  │ ▾ GF · Column · C1                                                           │ group
│  │ C1v    │ Main │ 00 │  20 │ A 3 450      │ 3450.000│   3450│3450.00│  6 │ 51.0│ 28 NET
│  │ ↳ Lap  │  —   │ —  │  20 │ Lap 1 000 mm │    —    │   —   │   —   │  6 │ 14.8│ 28 LAP
│  │ C1t    │ Tie  │ 51 │   8 │ A 300 · B 450│ 1638.400│   1650│1672.00│ 42 │  4.1│
│  │ ▾ GF · Column · C2                                                           │
│  │ C2v    │ Main │ 00 │  16 │ A 3 450      │ 3450.000│   3450│3450.00│  8 │ 43.6│
│  │ ↳ Lap  │  —   │ —  │  16 │ Lap  800 mm  │    —    │   —   │   —   │  8 │ 10.1│
│  │        rows at `--row-h` · 13 px · frozen Bar mark · scrolls inside the grid  │
│  ├──────────────────────────────────────────────────────────────────────────────┤
│  │ Cutting stock by diameter (i)                                                │ 28
│  ├──────────┬──────────┬─────────────┬────────┬──────────────────────────────────┤
│  │ Diameter │     Mass │ Stock bars  │ Pieces │ Offcut                          │ 28
│  │        8 │  412.900 │         37  │    148 │  1 240                          │ 28
│  │       16 │ 2 106.440│        112  │    336 │  4 880                          │
│  │       20 │ 3 980.767│        204  │    408 │  9 100                          │
│  │ Total mass                                              1,66,626.107 kg      │ 28
│  └──────────┴──────────┴─────────────┴────────┴──────────────────────────────────┘
└──┴──────────────────────────────────────────────────────────────────────────────┘
        (no right column: nothing here is selectable — R-UI-080, scope)
```

Above the fold: the grid's sticky header stands 24 (the frame's padding on `shell-main`) + 28 (the
status line) + 4 = **56 px** below the top of main, its first row at **84 px**, at 1440 × 900 and at
1280 × 800 alike — inside §7 C2's 120. Work-surface share: the summary region is capped at 224, so the
grid is 1344 × 524 of main's 1392 × 804 = **63 %**; at 1280 × 800, 1184 × 424 of 1232 × 704 = **58 %**
(R-UI-080's 55 %). Both the grid and the summary scroll inside their own boxes with their first column
frozen; the page never scrolls sideways (§7 C10).

| Region | What it holds | Width / height rule | Tokens | State when empty |
|---|---|---|---|---|
| tabs row (frame's track) | the five shipped entries then `takeoff-nav-bbs` (`aria-current="page"` here); in `useTakeoffTabsAside`: `bbs-revision` (IdChip, `data-value` the whole `setRevisionId`), `bbs-stock` (`data-stock-mm`, `data-rounding-mm`; its words in the interface's face and only its two figures in mono, I-354) and the ONE primary `bbs-export` (I-bbs-8), present only for a permitted reader with bars to render | 100 % × `--toolbar-h` 32; the primary at `--control-h` | `--surface-panel`, `--ink`, `--ink-secondary`, `--ink-muted`, `--line-accent`, `--font-mono`, `--accent` through the Button | the aside carries the tabs alone while no campaign is pinned; the primary is absent, never disabled, while nothing is scheduled |
| answer slot (`bbs-answer`) | one RefusalState from a refused or denied door (`REQUEST_MALFORMED`, `PERMISSION_NOT_HELD`, `BBS_NO_CAMPAIGN`); the offline banner above it; and, beneath them, the status line — everything this screen ANSWERS about its own reading stands in the one polite live region | 100 % × auto; `display:none` while empty | `--state-info(-surface)`, `--state-warn(-surface)` through RefusalState, `--radius-4`, `--hairline` | absent (no box) |
| job strip (`bbs-jobs`) | the shipped `JobTimeline` for the render job, present only while a run is watched; `bbs-document-link` follows a success (I-bbs-8) | 100 % × the pattern's own, between the answer slot and the grid | the pattern's own; `--accent` as the link's text | absent — never an empty box |
| status line | the ONE helper line, `<p role="status">` inside the answer slot: `bbs_partial` or `bbs_complete`; in `partial`, beneath it, `bbs_partial_omitted` and one list line per code the partly declared lines left out: the line's components in words through `EnumLabel`, the registry's own message, and a link to where it is settled with the registry's remedy as its Tooltip (I-bbs-9, I-354) | 100 % × 28, plus one caption line per code | `--ink`, `--ink-muted`, `--ink-secondary`, `--ink-link`, `--weight-body-medium`, `--text-body`, `--text-caption` | absent with the grid |
| grid (primary) | `bbs-grid` (DataTable v2, `tableId` `s-bbs-bars`, `aria-label` `bbs_grid_label`, `data-rows-rendered`): one `bbs-member` group row per distinct `objectKey` in `document.rows` order — the door's reading order, from the ground up (I-354) — then its `bbs-row` (NET) rows each optionally followed by one `bbs-lap` | `flex: 1 1 auto`; ≥ 55 % of main; header and rows at `--row-h` (28 compact / 36 comfortable, revalued at the ROOT by `[data-density]`, never here); first column frozen; no wrapping cell | `--surface-app`, `--surface-sunken` (sticky header, group rows), `--ink`, `--ink-code`, `--font-mono`, `--cell-px`, `--cell-py`, `--hairline` | not rendered at all: `bbs-empty` stands in its place |
| summary (`bbs-summary`) | the heading, its `(i)` popover, and a 5-column table: one `bbs-summary-row` per key of `perDiameterKg` in ascending numeric diameter, closed by the sticky total row carrying `grandTotalKg`; `data-kg` on the region is that grand total | 100 % × 28 heading + 28 header + rows + 28 total, **max 224**, body scrolls inside | `--surface-sunken` (header and total row), `--ink`, `--ink-code`, `--font-mono`, `--hairline` | absent with the grid |
| empty (in the grid's place) | the shipped `EmptyState` `bbs-empty`: heading, one sentence, one action to `…/takeoff/register` | max-width 520, centred in the grid's box | `--ink`, `--ink-muted`, `--accent` through Button | this IS the empty state |
| error (in the grid's place) | `error-state`: heading, one sentence, `error-state-report` (the fault id through IdChip under the primitive's own report label), `error-state-retry` | 100 % × auto, max-width 520 | `--ink`, `--ink-muted`, `--hairline`, `--radius-4` | — |
| inspector (frame's one slot) | nothing ever mounts it here | **absent — width 0** | — | absent |

**Columns**, left to right, widths multiples of 4, every figure right-aligned tabular mono with
lakh/crore grouping through `formatUserFigure`:

| # | Header key | Width | Cell |
|---|---|---|---|
| 1 | `bbs_col_mark` | 104, **frozen** | `barMark` in mono; on a LAP row, `bbs_lap_label` in sans with the `bbs_lap_tooltip` Tooltip |
| 2 | `bbs_col_role` | 88 | one `EnumLabel` (**Main**, **Tie**); `—` on a LAP row; the raw role on `data-role` |
| 3 | `bbs_col_shape` | 72 | the BS 8666 code inside `data-technical` mono (I-bbs-6); `—` on a LAP row |
| 4 | `bbs_col_diameter` | 112, right | `diameterMm` |
| 5 | `bbs_col_dims` | remainder (measured, on the 4 px grid), min 200 | `A 3 450 · B 300` from `dimsMm`, ellipsis + Tooltip; on a LAP row, the lap length in mm |
| 6 | `bbs_col_cutting_raw` | 160, right | `cuttingRawMm` as stored, never re-rounded (I-bbs-4) |
| 7 | `bbs_col_cutting_rounded` | 104, right | `cuttingRoundedMm` |
| 8 | `bbs_col_cutting_is` | 136, right | `cuttingIsAdditiveMm` |
| 9 | `bbs_col_bars` | 72, right | `bars`; on a LAP row, `lapsPerBar` |
| 10 | `bbs_col_kg` | 112, right | `kg` (= `kgNet`, which never includes its lap); on a LAP row, `kgLap`; printed at `BBS_PLACES.mass` through `statedAt` (I-bbs-9) |

A `bbs-member` group row is a row of the one grid and reads `GF · Column · C1` — the level label, the
class through `EnumLabel`, the member mark in mono — from its frozen key cell across the row's empty
cells, on `--surface-sunken` at the body-medium weight, carrying `data-member`, `data-mark`,
`data-class`, `data-level` and no figure at all (I-bbs-2, I-bbs-9). Summary columns:
`bbs_summary_col_diameter` 112 frozen · `bbs_summary_col_kg` 160 right · `bbs_summary_col_stock_bars`
128 right · `bbs_summary_col_pieces` 112 right · `bbs_summary_col_offcut` 160 right; every mass at
`BBS_PLACES.mass`; the total row reads `bbs_summary_total` with the figure in the Mass column and,
while the screen stands `partial`, `bbs_summary_total_measured` muted in the Stock bars cell.

## 2. States (R-UI-050), ruled cell by cell

`BBS_STATES` in `src/modules/takeoff/bbs-ui/states.ts` = `["loading","denied","offline","error",
"refused","empty","partial","ready"]`; `bbs-screen[data-state]` derives through `bbsStateOf(standing)`
in that order, first holding wins, beside `data-campaign` and `data-rows` = `document.rows.length`.
The seven R-UI-050 cells are declared in `src/ui/screen-states/matrix.tsx` under the file route
`/t/[tenant]/p/[project]/takeoff/bbs`, and `…/takeoff/bbs?__state=<cell>` stands the screen in each —
by the screen's own name or by the matrix's (`refusal` → `refused`, `permission-denied` → `denied`) —
through `./demonstration`, exactly as `takeoff/boq/demonstration.ts` does.

- **Loading** — `data-state="loading"`, frame, tabs row and status line intact: DataTable v2 in its
  `loading` posture over the same columns — header real, body two group-row bones each over eight row
  bones at `--row-h`; the summary shows its header over three row bones. The aside's two chips render
  as 28 × 96 bones. Never a spinner on a table (R-UI-004).
- **Denied** — the reader holds no MEASURE on this project (I-bbs-1). `data-state="denied"`; the grid,
  the summary, the status line and both aside chips do not render; `bbs-answer` carries the one
  registered `PERMISSION_NOT_HELD` entry, its evidence the project's participants screen, with
  `bbs_denied_body` naming the permission and `bbs_denied_holder` naming who grants it.
- **Offline** — a `<p role="status">` banner above the answer slot carrying `bbs_offline`; the
  schedule and the summary read on as they stood, read-only, nothing else changes.
- **Error** — the read threw. `page.tsx` reports it once and hands the `faultId` down; `error-state`
  stands in the grid's place with `bbs_error_heading`, `bbs_error_body`, the id through
  `error-state-report` under the primitive's own report label, and `error-state-retry` re-reading the
  route in place. The summary does not render beside a failed read.
- **Refused** — the one `RefusalState` in `bbs-answer` for a refused door (`REQUEST_MALFORMED`,
  `PERMISSION_NOT_HELD`). This increment registers **no new refusal code**: the document seam's
  `DOCUMENT_PAYLOAD_MALFORMED`, `DOCUMENT_KIND_UNKNOWN` and `DOCUMENT_NOT_RENDERED` serve the `bbs`
  kind, and they are refusals of a render, never of this screen. Never a toast, never a screen-local
  block (R-UI-020).
- **Empty** — no campaign is pinned, or the campaign holds no bar row. `bbs-empty` fills the grid's
  place; the grid, the summary and the status line do not render; the one action is
  `bbs_empty_action` → `/t/{tenant}/p/{project}/takeoff/register`, the same word and the same address
  the lane's other empty states offer.
- **Partial** — rendered, never hidden. `data-state="partial"` while any `rcc.rebar` line of the
  campaign carries coverage `PARTIAL_DECLARED` (a tie zone unread, `REBAR_TIE_ZONE_UNSTATED`): every
  member, bar, lap and stock row stands in full, and the status line reads `bbs_partial`.
- **Ready** — `data-state="ready"`; the status line reads `bbs_complete`.

## 3. Copy, verbatim (`src/ui/strings/bbs.ts`, aggregated by `index.ts`)

`takeoff_nav_bbs` **Bar schedule** (the sixth tab and `shell-crumb-page`) · `bbs_revision_label`
**Pinned revision** · `bbs_stock_label` **Stock bar** · `bbs_stock_rounding_label` **rounded** ·
`bbs_unit_mm` **mm** (the unit every millimetre figure on this screen is printed with) ·
`bbs_grid_label` **Bars by member and mark** · `bbs_col_mark` **Bar mark** · `bbs_col_role` **Role** ·
`bbs_col_shape` **Shape** · `bbs_col_diameter` **Diameter (mm)** · `bbs_col_dims` **Dimensions** ·
`bbs_col_cutting_raw` **Cutting length (mm)** · `bbs_col_cutting_rounded` **Rounded (mm)** ·
`bbs_col_cutting_is` **IS additive (mm)** · `bbs_col_bars` **Bars** · `bbs_col_kg` **Mass (kg)** ·
`bbs_lap_label` **Lap** · `bbs_lap_tooltip` **A lap is scheduled as its own row beside the net bar,
never as a percentage of it.** · `bbs_summary_heading` **Cutting stock by diameter** ·
`bbs_stock_note_label` **About cutting stock** (the `(i)` trigger's accessible name) · `bbs_stock_note`
**Stock bars, pieces and offcut describe what a site cuts from a stock bar. They are informational and
are never billed.** · `bbs_summary_col_diameter` **Diameter (mm)** · `bbs_summary_col_kg` **Mass (kg)**
· `bbs_summary_col_stock_bars` **Stock bars** · `bbs_summary_col_pieces` **Pieces** ·
`bbs_summary_col_offcut` **Offcut (mm)** · `bbs_summary_total` **Total mass** ·
`bbs_summary_total_measured` **Measured scope only** (I-bbs-9) ·
`bbs_partial` **Some rebar lines are partly declared, so their bars stand here as they read.** ·
`bbs_partial_omitted` **Left out of this schedule:** (I-bbs-9)
· `bbs_complete` **Every bar of the pinned campaign is scheduled, with laps as their own
rows.** · `bbs_empty_heading` **No bars scheduled yet** · `bbs_empty_body` **A bar schedule lists every
bar of the pinned campaign by member and mark, with its shape, its cutting lengths and its mass.
Measure the campaign from the takeoff register and the schedule appears here.** · `bbs_empty_action`
**Go to the takeoff register** · `bbs_error_heading` **The bar schedule could not be read** ·
`bbs_error_body` **Nothing was changed. Try again, and quote the report id if it keeps happening.** ·
`bbs_retry` **Try again** · `bbs_offline` **You are offline. The schedule reads as it stood when this
page loaded.** · `bbs_denied_body` **Reading the bar schedule needs the MEASURE permission on this
project.** · `bbs_denied_holder` **Open the participants screen** (the refusal's evidence link — a
destination, never a third telling of the remedy the banner already gives) · `bbs_export` **Export
the schedule** · `bbs_jobs_heading` **Rendering the schedule** · `bbs_document_link` **Open the
issued schedule** · the job pattern's word for the render kind, `job_step_bbs-render` **Render the
bar schedule** · and, on S-Documents, the one kind label `documents_kind_bbs` **Bar schedule**
(s-documents I-260; the draft's `documents_kind_boq_draft` precedent).

The components of a rebar line render as words through `EnumLabel` on the omitted list, the raw
name beside each under `data-technical` (I-354): net **Bars** · lap **Laps** · ties **Ties**. Each
omitted line's link says where its code is settled, in words stated here in their own column rather
than by key (s-schedules' `Open the sheet` precedent):

| code | settled on | link |
|---|---|---|
| `NOTE_READING_CONTESTED`, `REBAR_TIE_ZONE_UNSTATED`, `REBAR_SCHEDULE_UNREAD`, `DETAILING_ROW_NOT_IN_EDITION` | `…/takeoff/schedules` | **Open the schedules** |
| `REBAR_STOREY_RUN_UNSTATED` | `…/takeoff/levels` | **Open the levels** |
| any other code | — | no link: the line says its message and nothing more |

Registry entries this door adds to `src/core/errors/rebar.ts` (refusal-state §3's copy rules bind;
the code is never rendered as text):

| code | severity | surface | message | remedy |
|---|---|---|---|---|
| `BBS_NO_CAMPAIGN` | info | inline | **No campaign is open on this project, so there is no bill of bars to schedule.** | **Pin a drawing set revision and measure the campaign, then export the schedule.** |
| `BBS_NO_BAR_ROW` | info | inline | **This campaign has scheduled no bar to render.** | **Measure the campaign from the takeoff register — a schedule states the bars the measurement wrote and assumes nothing.** |

Voice: calm, concrete, professional; no exclamation marks; no build vocabulary — "seam", "rail",
"door", "job kind" and every clause id appear nowhere a reader can see. Marks, diameters, lengths and
masses are model data and render verbatim in mono; the campaign id and the set revision render only
through `IdChip`; roles and classes render as words through `EnumLabel` with the raw key on the row's
attributes; shape codes render inside `data-technical` (I-bbs-6). `MEASURE` inside the denial line is
the product's law, quoted as the seam quotes it. The rendered PDF's own words are the document kind's,
held to AM-05: **DRAFT — UNSIGNED** on every page, `BBS_TITLE` **Bar bending schedule**, a `LAP` line
beneath every row that laps, one cutting-stock line per diameter, and no surveyor, credential or
certificate anywhere.

## 4. Motion (R-UI-004)

Nothing on this screen eases in: it is a read, and the schedule arrives complete. The only transitions
are inherited from single homes — row hover fill, the IdChip's copy state and the nav link's colour
over `var(--motion-state)` `var(--ease)`; the Tooltip's and the Popover's own entrances over
`var(--motion-state)` / `var(--motion-panel)`; the reticle draw at `var(--motion-reticle)` from
`reticle.css`; the Skeleton pulse in `loading`. No entrance on the grid, the summary, the status line,
the empty state or the error block; no bounce, no spinner, no shimmer beyond one skeleton cycle. Every
duration is a token zeroed at source under `prefers-reduced-motion`, so `bbs.css` carries no
reduced-motion branch.

## 5. Tokens and themes

Only the semantic alias group and the density/layout tokens (Direction §4.1, §4.2); a `--graphite-*`
or `--beam-*` reference outside `tokens.ts` is a lint failure (R-UI-086). This screen spends:
`--surface-app` · `--surface-panel` · `--surface-sunken` · `--surface-hover` · `--ink` ·
`--ink-secondary` · `--ink-muted` · `--ink-code` · `--ink-link` (the omitted list's links, I-354) ·
`--line` · `--line-accent` · `--hairline` ·
`--accent` (only through the empty state's Button) · `--state-info(-surface)` and
`--state-warn(-surface)` reached only through RefusalState · `--space-1/2/3/4` · `--gap-section` ·
`--radius-2/4` · `--text-body` · `--text-caption` · `--text-12` · `--font-ui` · `--font-mono` ·
`--leading-ui` · `--weight-body-medium` / `--weight-heading` · `--motion-state` / `--motion-panel` /
`--motion-reticle` / `--ease`; and, read by the primitives rather than stated here, `--row-h`,
`--cell-px`, `--cell-py`, `--control-h`, `--toolbar-h`. Px literals, closed set: the status line's and
the summary heading's 28, the summary's 224 cap, the 520 the empty state and the error block stand at,
the nine fixed grid column widths and the remainder's floor (104/88/72/112/200/160/104/136/72/112,
I-bbs-9), the scroller allowance of 16 the remainder is measured less, the five summary widths
(112/160/128/112/160), the current-tab underline's 2, and the loading leg's bones (28/96). Any other
literal is a defect. **Every size on this screen is stated, the hidden one included**: `.cx-bbs-name`,
the visually-hidden `<h1>`, reads `--text-body` like the prose beside it, so no element is left to
the user agent's own `h1` size and the screen declares nothing off R-UI-003's scale (I-289). This
adds no token and no literal — `--text-body` is already spent above. **No copper anywhere**: this screen commits nothing (R-UI-021 has no subject here).

`bbs.css` contains no `[data-theme]` selector; every light/dark difference arrives through token
values (R-UI-001). Dark is the default and light is complete; both are captured, the light picture by
`emulateTheme(page, "light")` inside the dark lane, then `restoreLaneTheme`. Contrast holds on the
founder values in both: `--ink` and `--ink-code` on `--surface-app` and on the sticky header's and
group rows' `--surface-sunken` clear 4.5:1; `--ink-muted` clears 4.5:1 as the status line, the `—`
cells and the summary's captions; the beam-500 current-tab underline clears the 3:1 UI floor. Nothing
carries meaning by colour alone: a role is a word, a lap is a labelled row, a shape is a code, a total
is a label — all survive greyscale (R-UI-060).

## 6. Test hooks (closed contract, C-05)

The registry is complete for this screen; no hook is introduced under a spelling of my own, and there
is no `## Additional test hooks` section.

Routes: `/t/{tenant}/p/{project}/takeoff/bbs` (`bbsRoute(tenantId, projectId)` in
`takeoff/bbs/route-address.ts`, the one spelling; crumbs in `routes.ts`, `shell-crumb-page` reads
**Bar schedule**) and the file route `/t/[tenant]/p/[project]/takeoff/bbs` (the matrix key). Linked:
`…/takeoff/register` (the empty state's action) and `…/settings/participants` (the denial's evidence);
`…/takeoff/schedules` is J-032's first leg, read through inc-303's page object and never edited.
Reads: `bbsViewOf`, `bbsOf` (inc-309's door — read, never re-implemented), `bbsRowsOf`,
`bbsSummaryOf`, `bbsStateOf`, `bbsPayloadOf`, `renderDocument("bbs", …)`.

Test ids, exactly the registry's spellings, on the elements ruled in §1: `bbs-screen` (`data-state` ∈
`BBS_STATES`, `data-campaign`, `data-rows`) · `bbs-answer` · `bbs-revision` (an IdChip, `data-value`
the whole `setRevisionId`) · `bbs-stock` (`data-stock-mm`, `data-rounding-mm`) · `bbs-grid`
(`data-rows-rendered`) · `bbs-member` (`data-member` = `objectKey`, `data-mark`, `data-class`,
`data-level`) · `bbs-row` (`data-bar-key`, `data-bar-mark`, `data-role`, `data-diameter`,
`data-shape`, `data-dims` = JSON of `dimsMm`, `data-cutting-raw`, `data-cutting-rounded`,
`data-cutting-is`, `data-pieces`, `data-bars`, `data-lap-mm`, `data-laps`, `data-kg`,
`data-component="NET"`) · `bbs-lap` (`data-bar-key`, `data-component="LAP"`, `data-lap-mm`,
`data-laps`, `data-kg` = `kgLap`; rendered only where `lapsPerBar > 0` — I-bbs-3) · `bbs-summary`
(`data-kg` = `grandTotalKg`) · `bbs-summary-row` (`data-diameter`, `data-kg`, `data-stock-bars`,
`data-pieces`, `data-offcut-mm`) · `bbs-empty` · `bbs-export` (`data-permission="MEASURE"`,
`data-job` while a render is watched, `aria-disabled="true"` while offline or watched) · `bbs-jobs`
(`data-job`) · `bbs-document-link` (`data-document`) — the last three added by I-bbs-8. Used and
never redefined, other files' ids:
`takeoff-nav-bbs` (`aria-current="page"` here) beside `takeoff-nav-boq` and its three elders,
`error-state-report`, `error-state-retry`, `shell-crumb-page`, `shell-main`, `shell-tenant-switcher`,
`shell-user`, and the primitives' own (`datatable-header`, `datatable-row`, `datatable-group-row`,
`id-chip`, `enum-label`, `empty-state`, `error-state`, `refusal-state`, `skeleton`). `boq-draft` is
S-BOQ's id and the document lane's fixture root (`tests/docs/boq-draft/golden.pdf`, byte-unchanged
here); it appears in no DOM of this screen. `data-standing` is read on S-Schedules in J-032's first
leg (`standing(LAP)` = `AGREED`) and is carried by no element of this screen.

Behavioural hooks without new ids: `[data-density]` at the ROOT, the one switch the grid reads
`--row-h` from · `data-technical` on the shape code and on every raw enum kept beside its `EnumLabel`
· `role="status"` on the status line and the offline banner · `aria-live="polite"` on `bbs-answer` ·
`aria-label` = `bbs_grid_label` on the grid · `cx-reticle` on every focusable. Asserted absences: no
inspector and no second right column (R-UI-080); no native `select` or `input[type=date]` (R-UI-083);
no `bbs-lap` without a `bbs-row` of the same `data-bar-key` above it; no `bbs-grid` while `bbs-empty`
stands; no `bbs-summary` while the grid does not render; no wrapping cell; no uuid, digest or
`setRevisionId` as a text node outside an IdChip.

Evidence. Unit: `tests/takeoff/bbs-ui/present.test.ts` over all 4,127 rows of `bbs.golden.json`
through `goldenBbsDocument()` — never a frozen list, and no duration asserted (AM-10 §3);
`tests/takeoff/bbs-ui/reading-order.test.ts` (I-354(a), the door's comparator over keys the product's
own grammar mints) and `tests/takeoff/bbs-ui/partial-omitted.test.tsx` (I-354(b)(c), the workspace
mounted over the real refusal registry, and the sheet's stock rules read). Docs:
`tests/docs/bbs/{payload.json,golden.pdf,render.test.ts}` under `pnpm test:docs` (AM-18). Journey
`tests/e2e/journeys/j-032-schedules-notes.spec.ts`, every title carrying **J-032**, staged by
`tests/e2e/takeoff/bbs-stage.ts` over `signInAsSeededTenant`; page object
`tests/e2e/pages/s-bbs.page.ts`; checkpoints **s-bbs/schedule** (dark), **s-bbs/schedule-light** and
**s-bbs/empty**, each at moderate axe budget 0 with serious/critical 0, never widened; baselines
`tests/e2e/baselines/design-dark/s-bbs/{schedule,schedule-light,empty}.png`, `masks()` over the shell
breadcrumb, `shell-user`, `shell-tenant-switcher` and `bbs-revision`. Because the sixth tab moves every
takeoff-lane picture, `design-dark/{s-takeoff,j-021-column-slice,j-022-coverage,j-031-levels,
s-schedules,s-boq}/**` are re-taken under B-20 in their own `baseline:`-subject commit naming the sixth
tab as the proof.

## 7. Recorded IOUs (owner named, never a comment in `src/`)

- **The export primary, its `bbs-render` job kind and the S-Documents row.** *(PAID by I-bbs-8,
  session 4: `takeoffBbs.exportSchedule`, the `bbs-render` kind under `src/core/jobs/kinds/rebar.ts`,
  `runBbsRenderJob`, the worker handler, and the `bbs` row on S-Documents. Live proof:
  `tests/takeoff/bbs-ui/export-door.db.test.ts`; the walk: J-000's `m3-bill-and-schedules`.)*
- **A-BBS-XLSX.** No workbook of the schedule at M3. Owner: the export-channel leaf.
- **The d²/162 check column.** AM-03(b) makes it informational with a stated tolerance; neither the
  screen nor the PDF prints it today. Owner: the disclosure leaf that adds it to both faces at once.
- **A bar's Trace.** Every figure here came from a drawing, and R-UI-022 will want an EvidenceLink on
  the Mass cell with an inspector behind it; the register carries the Trace meanwhile. Owner: the M4
  rebar leaf.
- **Members beyond columns and shear walls.** `READ_CLASSES` reads two classes, so beams and slabs
  schedule no bars yet and their members never group here. Owner: inc-309's successors.
- **A mark stated once with its number of members** (I-354(d)). Identical members of one mark on one
  floor group at the DOOR — `bbsOf` answering a member count and exact mass products — then the
  payload, a `No. of members` column here, and J-032's one-group-per-member read with it. Owner: the
  rebar door and the document kind; a bill-shape change, so the owner's call.
- **A placement label on each member row** (I-354(e)). The grid intersection a member stands at,
  read by the partition against the drawing's axes and carried on a bar row. Owner: the rebar rail
  (`bars.ts`), `db/**` (a `bar_rows` column) and the partition's placement reader.

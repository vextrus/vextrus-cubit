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
| tabs row (frame's track) | the five shipped entries then `takeoff-nav-bbs` (`aria-current="page"` here); in `useTakeoffTabsAside`: `bbs-revision` (IdChip, `data-value` the whole `setRevisionId`) and `bbs-stock` (`data-stock-mm`, `data-rounding-mm`). **No primary** — nothing on this screen commits (export is owed at the door) | 100 % × `--toolbar-h` 32 | `--surface-panel`, `--ink`, `--ink-secondary`, `--ink-muted`, `--line-accent`, `--font-mono` | the aside carries the tabs alone while no campaign is pinned |
| answer slot (`bbs-answer`) | one RefusalState from a refused or denied door; the offline banner above it | 100 % × auto; `display:none` while empty | `--state-info(-surface)`, `--state-warn(-surface)` through RefusalState, `--radius-4`, `--hairline` | absent (no box) |
| status line | the ONE helper line, `<p role="status">`: `bbs_coverage_partial` or `bbs_coverage_complete` | 100 % × 28 | `--ink-muted`, `--text-body` | absent with the grid |
| grid (primary) | `bbs-grid` (DataTable v2, `tableId` `s-bbs-bars`, `aria-label` `bbs_grid_label`, `data-rows-rendered`): one `bbs-member` group row per distinct `objectKey` in `document.rows` order, then its `bbs-row` (NET) rows each optionally followed by one `bbs-lap` | `flex: 1 1 auto`; ≥ 55 % of main; header and rows at `--row-h` (28 compact / 36 comfortable, revalued at the ROOT by `[data-density]`, never here); first column frozen; no wrapping cell | `--surface-app`, `--surface-sunken` (sticky header, group rows), `--ink`, `--ink-code`, `--font-mono`, `--cell-px`, `--cell-py`, `--hairline` | not rendered at all: `bbs-empty` stands in its place |
| summary (`bbs-summary`) | the heading, its `(i)` popover, and a 5-column table: one `bbs-summary-row` per key of `perDiameterKg` in ascending numeric diameter, closed by the sticky total row carrying `grandTotalKg`; `data-kg` on the region is that grand total | 100 % × 28 heading + 28 header + rows + 28 total, **max 224**, body scrolls inside | `--surface-sunken` (header and total row), `--ink`, `--ink-code`, `--font-mono`, `--hairline` | absent with the grid |
| empty (in the grid's place) | the shipped `EmptyState` `bbs-empty`: heading, one sentence, one action to `…/takeoff/register` | max-width 520, centred in the grid's box | `--ink`, `--ink-muted`, `--accent` through Button | this IS the empty state |
| error (in the grid's place) | `error-state`: heading, one sentence, `error-state-report` (the fault id through IdChip under the primitive's own report label), `error-state-retry` | 100 % × auto, max-width 520 | `--ink`, `--ink-muted`, `--hairline`, `--radius-4` | — |
| inspector (frame's one slot) | nothing ever mounts it here | **absent — width 0** | — | absent |

**Columns**, left to right, widths multiples of 4, every figure right-aligned tabular mono with
lakh/crore grouping through `formatUserFigure`:

| # | Header key | Width | Cell |
|---|---|---|---|
| 1 | `bbs_col_mark` | 112, **frozen** | `barMark` in mono; on a LAP row, `bbs_lap_label` in sans with the `bbs_lap_tooltip` Tooltip |
| 2 | `bbs_col_role` | 96 | one `EnumLabel` (**Main**, **Tie**); `—` on a LAP row; the raw role on `data-role` |
| 3 | `bbs_col_shape` | 72 | the BS 8666 code inside `data-technical` mono (I-bbs-6); `—` on a LAP row |
| 4 | `bbs_col_diameter` | 88, right | `diameterMm` |
| 5 | `bbs_col_dims` | remainder, min 200 | `A 3 450 · B 300` from `dimsMm`, ellipsis + Tooltip; on a LAP row, the lap length in mm |
| 6 | `bbs_col_cutting_raw` | 128, right | `cuttingRawMm` as stored, never re-rounded (I-bbs-4) |
| 7 | `bbs_col_cutting_rounded` | 104, right | `cuttingRoundedMm` |
| 8 | `bbs_col_cutting_is` | 112, right | `cuttingIsAdditiveMm` |
| 9 | `bbs_col_bars` | 88, right | `bars`; on a LAP row, `lapsPerBar` |
| 10 | `bbs_col_kg` | 112, right | `kg` (= `kgNet`, which never includes its lap); on a LAP row, `kgLap` |

A `bbs-member` group row spans the table and reads `GF · Column · C1` — the level label, the class
through `EnumLabel`, the member mark in mono — carrying `data-member`, `data-mark`, `data-class`,
`data-level` and no figure at all (I-bbs-2). Summary columns: `bbs_summary_col_diameter` 112 frozen ·
`bbs_summary_col_kg` 160 right · `bbs_summary_col_stock_bars` 128 right · `bbs_summary_col_pieces` 112
right · `bbs_summary_col_offcut` 160 right; the total row reads `bbs_summary_total` with the figure in
the Mass column.

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
  member, bar, lap and stock row stands in full, and the status line reads `bbs_coverage_partial`.
- **Ready** — `data-state="ready"`; the status line reads `bbs_coverage_complete`.

## 3. Copy, verbatim (`src/ui/strings/bbs.ts`, aggregated by `index.ts`)

`takeoff_nav_bbs` **Bar schedule** (the sixth tab and `shell-crumb-page`) · `bbs_revision_label`
**Pinned revision** · `bbs_stock_label` **Stock bar** · `bbs_stock_rounding_label` **rounded** ·
`bbs_grid_label` **Bars by member and mark** · `bbs_col_mark` **Bar mark** · `bbs_col_role` **Role** ·
`bbs_col_shape` **Shape** · `bbs_col_diameter` **Diameter (mm)** · `bbs_col_dims` **Dimensions** ·
`bbs_col_cutting_raw` **Cutting length (mm)** · `bbs_col_cutting_rounded` **Rounded (mm)** ·
`bbs_col_cutting_is` **IS additive (mm)** · `bbs_col_bars` **Bars** · `bbs_col_kg` **Mass (kg)** ·
`bbs_lap_label` **Lap** · `bbs_lap_tooltip` **A lap is scheduled as its own row beside the net bar,
never as a percentage of it.** · `bbs_summary_heading` **Cutting stock by diameter** · `bbs_stock_note`
**Stock bars, pieces and offcut describe what a site cuts from a stock bar. They are informational and
are never billed.** · `bbs_summary_col_diameter` **Diameter (mm)** · `bbs_summary_col_kg` **Mass (kg)**
· `bbs_summary_col_stock_bars` **Stock bars** · `bbs_summary_col_pieces` **Pieces** ·
`bbs_summary_col_offcut` **Offcut (mm)** · `bbs_summary_total` **Total mass** ·
`bbs_coverage_partial` **Some rebar lines are partly declared, so their bars stand here as they read.**
· `bbs_coverage_complete` **Every bar of the pinned campaign is scheduled, with laps as their own
rows.** · `bbs_empty_heading` **No bars scheduled yet** · `bbs_empty_body` **A bar schedule lists every
bar of the pinned campaign by member and mark, with its shape, its cutting lengths and its mass.
Measure the campaign from the takeoff register and the schedule appears here.** · `bbs_empty_action`
**Go to the takeoff register** · `bbs_error_heading` **The bar schedule could not be read** ·
`bbs_error_body` **Nothing was changed. Try again, and quote the report id if it keeps happening.** ·
`bbs_retry` **Try again** · `bbs_offline` **You are offline. The schedule reads as it stood when this
page loaded.** · `bbs_denied_body` **Reading the bar schedule needs the MEASURE permission on this
project.** · `bbs_denied_holder` **A project principal can grant it on the participants screen.**

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
`--ink-secondary` · `--ink-muted` · `--ink-code` · `--line` · `--line-accent` · `--hairline` ·
`--accent` (only through the empty state's Button) · `--state-info(-surface)` and
`--state-warn(-surface)` reached only through RefusalState · `--space-1/2/3/4` · `--gap-section` ·
`--radius-2/4` · `--text-body` · `--text-caption` · `--text-12` · `--font-ui` · `--font-mono` ·
`--leading-ui` · `--weight-body-medium` / `--weight-heading` · `--motion-state` / `--motion-panel` /
`--motion-reticle` / `--ease`; and, read by the primitives rather than stated here, `--row-h`,
`--cell-px`, `--cell-py`, `--control-h`, `--toolbar-h`. Px literals, closed set: the status line's and
the summary heading's 28, the summary's 224 cap, the 520 the empty state and the error block stand at,
the ten grid column widths (112/96/72/88/200/128/104/112/88/112), the five summary widths
(112/160/128/112/160), the current-tab underline's 2, and the loading leg's bones (28/96). Any other
literal is a defect. **No copper anywhere**: this screen commits nothing (R-UI-021 has no subject here).

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
`data-pieces`, `data-offcut-mm`) · `bbs-empty`. Used and never redefined, other files' ids:
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
through `goldenBbsDocument()` — never a frozen list, and no duration asserted (AM-10 §3). Docs:
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

- **The export primary, its `bbs-render` job kind and the S-Documents row.** R-TO-054's export is
  satisfied at the seam here (`renderDocument("bbs")`) and owed at the door; when it lands, the aside
  gains this screen's one primary and the job strip stands between the status line and the grid,
  exactly as S-BOQ's does. Owner: the follow-on BBS door leaf.
- **A-BBS-XLSX.** No workbook of the schedule at M3. Owner: the export-channel leaf.
- **The d²/162 check column.** AM-03(b) makes it informational with a stated tolerance; neither the
  screen nor the PDF prints it today. Owner: the disclosure leaf that adds it to both faces at once.
- **A bar's Trace.** Every figure here came from a drawing, and R-UI-022 will want an EvidenceLink on
  the Mass cell with an inspector behind it; the register carries the Trace meanwhile. Owner: the M4
  rebar leaf.
- **Members beyond columns and shear walls.** `READ_CLASSES` reads two classes, so beams and slabs
  schedule no bars yet and their members never group here. Owner: inc-309's successors.

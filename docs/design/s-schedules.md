# Design Decision — S-Schedules (reconstructed schedules, the member-type registry, sheet notes)

Route `/t/{tenant}/p/{project}/takeoff/schedules` — the **fourth** tab of the takeoff lane, under
`src/app/(app)/t/[tenant]/p/[project]/takeoff/schedules/**`, inside the shell frame and behind the
membership guard. Increment inc-303-schedules-notes-ui. Law: R-TO-034, L-CAD-08, L-ACT-02, L-ACT-03,
L-QTY-01, AM-03(h), R-UI-002/003/004/005/010/012/020/021/022/030/031/050/060/080/081/082/083/084/
085/086, S-Schedules, J-032, B-17, B-19, B-20, C-05.

Cut from the **grid workspace template** (Direction §3.2) and re-deciding nothing it settled: the
tabs row is the frame's tool track (I-230), the inspector is the frame's ONE right column and is
absent until something is selected (I-231), the campaign's index stands BESIDE the work surface as a
left rail (I-233), the grid is DataTable v2 with its own furniture (I-235). Files: `takeoff/layout.tsx`
(one nav entry), `takeoff/schedules/{page.tsx,schedules-screen.tsx,route-address.ts,states.ts,
schedules.css}`; the presentational `SchedulesWorkspace` in `src/modules/takeoff/schedules-ui/**`
with its mirrored `copy.ts`; copy at `src/ui/strings/schedules.ts`. Chrome is shipped primitives
only — Button, NumberInput, Skeleton, IdChip, EnumLabel, EmptyState, Tooltip, DataTable v2, the one
RefusalState, the one ConsequenceDialog, the one EvidenceLink — plus the `cx-schedules-*` classes
this file rules. No gallery entry is added (nothing new is invented here).

## 0. Interpretations (continuing the chain above s-levels' I-247)

- **I-248 — the sheet is the subject; main renders what that sheet holds.** The rail selects a
  sheet of the pinned revision; `shell-main`'s work column then renders, top to bottom and only
  where the sheet has them: its reconstructed schedules, the member types those schedules named, its
  general notes, its deferral. A sheet that holds a schedule and a note holds both sections; a sheet
  that holds neither is not a row in the rail at all. Rejected: tabs inside main for *Schedules /
  Registry / Notes*, which hides two-thirds of one sheet's transcription behind a click and makes
  the fold check meaningless.
- **I-249 — the registry pane yields its height to the inspector.** The member-type registry is a
  240 px bottom pane of the work column (200 below the `lg` breakpoint) that scrolls alone. When a
  cell or a reading is selected and the shell mounts the inspector, the pane **collapses to its
  28 px header**, because the inspector is already showing that selection's family, variant and
  zones — a docked registry beside it says the same thing twice while the schedule, the thing being
  read, loses a quarter of its width. Its header stays a disclosure the reader can re-open. This is
  the viewer's layers-drawer precedent (Direction §3.1) applied to a horizontal split.
- **I-250 — the table is rendered exactly as it was stored, and the screen counts nothing.**
  Columns come from the stored table's columns (L-CAD-08's header centres); the stored header row is
  the DataTable's sticky header and its cells are `schedules-cell` like any other, citing their own
  source keys; the mark/name column is the frozen first column. `data-rows-rendered` is
  `String(table.rows.length)` as the stored table answers it — if the stored shape carries the header
  row inside `rows`, it is counted; if beside them, it is not. A screen that re-counts a reconstructed
  fact has performed a second reconstruction (B-17).
- **I-251 — no element on this screen renders a member count.** L-CAD-08 forbids it, so the family
  group rows here are the one exception to §5 rule 4's `▾ GF · column (4)` furniture: the family row
  carries its mark text and its evidence, and no parenthesised number. A schedule states how many
  members exist only where a schedule column states it, and then it is that column's cell text,
  verbatim, not a count the screen took.
- **I-252 — every cell is a trace and nothing else.** A `schedules-cell` holds exactly one
  `EvidenceLink` whose label is the cell's text verbatim — two joined texts keep their `+` (L-CAD-08)
  — basis TRANSCRIBED, href `selectionAddress(tenant, project, { drawingId, layoutName, sourceKeys })`.
  The cell adds no chip, no tooltip of its own, no second colour: R-UI-022 says the cell *carries* the
  link, and a cell that is a link and also something else is two affordances in 28 px. A cell whose
  stored text is empty renders `—` in `--ink-muted` and **no anchor** (evidence-link I-178/§2 — a
  link without a place is not withheld chrome, it is an honest absence).
- **I-253 — a standing is the answer; a reading is the record; a proposal is the offer.** The notes
  panel is three sections in that order: **Applied values** (one `schedules-standing` per kind the
  sheet speaks to), **Readings on this sheet** (every actor's committed readings, superseded ones
  muted), **Read from this sheet** (the grammar's proposals and the one act door). A SUSPENDED
  standing renders **no figure** — s-levels' I-242 applied to a note: a number printed beside the
  word *suspended* is the claim the suspension denies — and the row expands to hold exactly one
  RefusalState with `NOTE_READING_CONTESTED`, the partial-row pattern of Direction §3.6.
- **I-254 — typing changes nothing; only the door is a door.** Each proposal's
  `schedules-proposal-value` is a NumberInput pre-filled with the grammar's canonical, its
  `unitAsWritten` as the muted suffix; editing it moves no record. `schedules-transcribe` calls
  `previewTranscribeSheetNotes` and opens the one ConsequenceDialog, which commits with the digest.
  No cell on this screen is `meta.editable`, and the screen never decides ACCEPTED vs EDITED: the
  seam re-runs the grammar and judges it (AC-2), so the reading rows report a verdict they were
  given.
- **I-255 — a preview that moves nothing is answered in place.** Proposals that already stand at
  the same canonical and unit are refused `ACT_CHANGES_NOTHING` by the seam; the screen renders that
  entry as one RefusalState in the answer slot and **no dialog opens** (s-levels I-245), and each
  such proposal row already carried `schedules_proposal_already_read` in its trailing cell so the
  reader saw the reason before pressing.
- **I-256 — the door renders, disabled, naming its permission.** A reader without MEASURE sees
  `schedules-transcribe` with `aria-disabled="true"`, `data-permission="MEASURE"` and a Tooltip
  carrying the denial pair; every table, registry and reading reads on in full (s-levels I-247). The
  screen's `data-state` is `denied` only when every door on it is shut.

## 1. Layout and hierarchy (1440 × 900)

A schedule sheet selected, nothing selected inside it:

```
┌R─┬────────────────────────────────────────────────────────────────┬─ I ─────┐
│▲ │ ws › Trace Survey ▾ › Takeoff › Schedules            ⌘K ⟳ ✉ ◉ │(on sel) │
│  ├────────────────────────────────────────────────────────────────┤         │
│▦ │ Register · Coverage · Levels · Schedules                       │ absent  │
│▤ ├────────┬───────────────────────────────────────────────────────┤ width 0 │
│⚙ │ Sheets │ Reconstructed schedules                               │         │
│  │ S-02   │ COLUMN SCHEDULE                     8 rows            │         │
│  │ Sched. │ ▣ MARK │▣ SIZE  │▣ MAIN BARS │▣ TIES      │▣ REMARKS  │         │
│  │ ◂S-03  │ ▣ C1   │▣ 300x450│▣ 8-T20     │▣ T10@150 c/c│▣ TYP.    │         │
│  │ Sched. │ ▣ C2   │▣ 300x600│▣ 6-T25+2-T20│▣ T10@100 c/c│▣ —      │         │
│  │ Notes  │ ▣ C3   │▣ 250x250│▣ 4-T16     │▣ T8@150 c/c │▣ PILE CAP│         │
│  │ S-04   │      28 px rows · 13 px · frozen MARK · sticky header │         │
│  │ Defer. │                                                       │         │
│  │        ├───────────────────────────────────────────────────────┤         │
│  │        │ Member types            Mark │ Band │ Section │ Zone  │         │
│  │        │ ▾ C1                    ▣ C1 │      │         │       │         │
│  │        │    GF–L3                     │ GF–L3│ 300x450 │       │         │
│  │        │      main  8-T20 · ties  T10@150 c/c · ties-end T10@100│         │
│  │  200px │ ▾ C2 …                                     240 px     │         │
│  └────────┴───────────────────────────────────────────────────────┘         │
└──┴────────────────────────────────────────────────────────────────┴─────────┘
```

The same screen with the notes sheet selected, after the act (the `transcribed` checkpoint):

```
│  │ Sheets │ General notes                                         │ Note    │
│  │ S-02   │ Applied values                                        │ reading │
│  │ ◂S-03  │  Reinforcement grade   Agreed     500 MPa             │ LAP     │
│  │ Notes  │  Concrete strength     Agreed    3500 psi             │ ─────── │
│  │ S-04   │  Tension lap           Suspended        —             │ Read    │
│  │        │   ┌ Two readings of this note disagree, so no …     ┐ │ from    │
│  │        │   │ Read the figure again from the sheet to settle …│ │ [S-03·  │
│  │        │   │ Open the sheet                                  │ │  #4122] │
│  │        │   └─────────────────────────────────────────────────┘ │ Basis   │
│  │        │ Readings on this sheet                                │ ▣ Trans.│
│  │        │  Tension lap      50 d  Accepted as proposed ▣ S-03·#4│ Accepted│
│  │        │  Minimum hook    100 mm Edited               ▣ S-03·#4│ as      │
│  │        │ Read from this sheet                                  │ proposed│
│  │        │  Tension lap   as written  50d      [  50  ] d        │         │
│  │        │  Minimum hook  as written  75 mm    [ 100  ] mm       │         │
│  │        │                              ● Preview these readings │         │
```

Above the fold at both viewports: the first schedule row stands **60 px** below the top of main (the
32 px tabs row, the 28 px sticky header) — inside §3.2's 240 and inside §7 C2's 120. Work-surface
share, primary = the schedules region: 1192 × 532 of main's 1392 × 804 = **57 %**; with the
inspector mounted the registry pane collapses (I-249) and it is 872 × 744 = **58 %**. At 1280 × 800
the rail takes its 160 min and the registry pane its 200: 1072 × 472 of 1232 × 704 = **58 %**, and
with the inspector 752 × 644 = **56 %**. Every region scrolls inside itself; the page never scrolls
sideways (§7 C10).

| Region | What it holds | Width / height rule | Tokens | Empty |
|---|---|---|---|---|
| tabs row (frame's track) | `takeoff-nav-register` · `-coverage` · `-levels` · `takeoff-nav-schedules` (`aria-current="page"` here). No aside: this screen's one primary lives in the notes panel | 100 % × `--toolbar-h` 32 | `--ink-secondary`, `--ink`, `--line-accent`, `--surface-panel` | — |
| answer slot | one RefusalState from a refused door; the offline banner above it | 100 % × auto; `display:none` while empty | `--state-info(-surface)`, `--radius-4`, `--hairline` | absent (no box) |
| sheet rail (`schedules-sheets`) | one `schedules-sheet-row[data-drawing][data-layout]` per sheet of the pinned revision holding a schedule, a deferral or a note text: sheet name in 13 px, drawing `IdChip`, and what it holds as muted words | `flex: 0 0 var(--drawer-w)` 200 (min 160, max 320); rows `--row-h` 28 | `--surface-panel`, `--hairline`, `--ink-muted`, `--text-caption`, `--surface-selected` | the rail is absent only in `empty`; otherwise it always has a row |
| schedules region (primary) | `schedules-table[data-schedule][data-rows-rendered]`, one per stored schedule, stacked with `--gap-section`; each a DataTable v2 titled by its stored title. Or `schedules-deferral`. Or `schedules-notes` on a notes-only sheet | `flex: 1 1 auto`, min 320; ≥ 55 % of main; rows `--row-h` 28, header 28 sticky, first column frozen | `--surface-app`, `--surface-sunken` (header), `--ink-code`, `--font-mono`, `--cell-px/py`, `--basis-transcribed` through EvidenceLink | never silent: a deferral or `NOTES_NONE_PROPOSED` stands in its place |
| registry pane (`schedules-registry`) | `schedules-family[data-family]` group rows, `schedules-variant[data-variant]` beneath, `schedules-zone[data-zone]` per rebar zone; all text verbatim; no count (I-251) | `flex: 0 0 240` (200 below `lg`); collapses to 28 with the inspector (I-249); scrolls alone | `--surface-panel`, `--surface-sunken`, `--hairline`, `--ink`, `--font-mono` | the pane stands and states `schedules_registry_none` |
| notes panel (`schedules-notes`) | the three sections of I-253 and the one `schedules-transcribe` | inside the schedules region; sections separated by `--gap-section`; rows `--row-h` 28 | `--surface-app`, `--hairline`, `--ink-code`, `--warn-surface` through RefusalState | one RefusalState, `NOTES_NONE_PROPOSED`, and no act door |
| inspector (frame's one slot) | `schedules-inspector`: the selection's heading, its source keys as `IdChip`s under `schedules_inspector_sources_label`, its kind / basis / acceptance as `EnumLabel`s, and its one EvidenceLink | `--inspector-w` 320 (280–480) | `--surface-panel`, `--hairline`, basis palette through EvidenceLink | **absent — width 0**, never a sentence |

**Cells.** Schedule cell: one EvidenceLink, 12 px mono, TRANSCRIBED blue rule and ▣ glyph, label
verbatim, no wrap, ellipsis plus the table's own Tooltip (§5 rule 2). Standing row: the kind through
`EnumLabel`, the standing through `EnumLabel` (*Agreed* / *Suspended* / *Not read*), the canonical
right-aligned mono with its unit as a muted `UnitBadge` — empty unless AGREED (I-253). Reading row:
kind, canonical + unit, the acceptance word, one EvidenceLink on `data-source`; `data-superseded`
rows ride `--ink-muted` with `schedules_reading_superseded` as their Tooltip. Proposal row: kind,
`schedules_proposal_written_label` then `valueAsWritten` verbatim in mono with its EvidenceLink, then
the NumberInput.

## 2. States (R-UI-050), ruled cell by cell

`SCHEDULES_STATES` in `takeoff/schedules/states.ts` = `["loading","denied","offline","error",
"refused","empty","partial","ready"]`, declared in `src/ui/screen-states/matrix.tsx` under
`/t/[tenant]/p/[project]/takeoff/schedules`. `schedules-screen[data-state]` derives in that order,
first holding wins.

- **Loading** — the workspace root at `data-state="loading"`, frame and tabs row intact, core
  Skeletons keeping the layout the screen in fact has: a 200-wide rail bone of six 28 px rows beside
  a table whose header is real and whose body is eight 28 px row bones, and a 240 bone for the
  registry pane. No bone stands for the inspector — it is absent at rest. Never a spinner on a table
  (R-UI-004). The leg is the screen's own; no route `loading.tsx` (s-levels' two-roots ruling).
- **Empty** — no partitioned drawing in the pinned revision: the shipped `EmptyState`
  `data-testid="schedules-empty"` fills the work column, rail absent, carrying
  `schedules_empty_heading`, `schedules_empty_body` and, as its one action,
  `schedules_empty_action` linking to `…/drawings`.
- **Partial** — rendered, never hidden. `data-state="partial"` while any sheet carries a deferral,
  any standing reads SUSPENDED, or any sheet proposes nothing: those rows and sections stand where
  they belong with their RefusalState, and everything that stands reads as it stands. The J-032
  `transcribed` checkpoint is this state.
- **Error** — `schedules-screen.tsx`'s own cell: `schedules_error_heading` / `_body`, the report id
  through an `IdChip` under `schedules_report_label`, and a secondary Button `schedules_retry`
  (found by role and name) re-running `takeoffSchedules.schedules` in place.
- **Refusal** — the one RefusalState in the answer slot for a refused door
  (`ACT_CHANGES_NOTHING`, `REQUEST_MALFORMED`, `NOTE_SOURCE_NOT_ON_SHEET`,
  `CONSEQUENCES_NOT_CARRIED`), and inside the ConsequenceDialog's own slot for anything refused
  while it holds focus. Never a toast, never a screen-local block (R-UI-020, B-17). No refusal code
  is spelled in any text node outside a `refusal-state` or a `[data-technical]` element.
- **Offline** — a `<p role="status">` banner above the answer slot carrying `schedules_offline`;
  `schedules-transcribe` renders `aria-disabled="true"` while it stands. The sheets read on.
- **Permission-denied** — `schedules-transcribe` renders, `aria-disabled="true"`,
  `data-permission="MEASURE"`, its Tooltip and (when it is the only door) the answer slot carrying
  the denial pair `schedules_denied_transcribe` / `schedules_denied_holder` over one RefusalState
  from the registered `PERMISSION_NOT_HELD` entry, evidence the project's participants screen
  (I-256). Tables, registry and readings read in full.

## 3. Copy, verbatim (`src/ui/strings/schedules.ts`, mirrored to the module's `copy.ts`)

`takeoff_nav_schedules` **Schedules** · `schedules_sheets_heading` **Sheets** ·
`schedules_sheet_holds_schedule` **Schedule** · `schedules_sheet_holds_notes` **Notes** ·
`schedules_sheet_holds_deferral` **Deferred** · `schedules_tables_heading` **Reconstructed
schedules** · `schedules_table_rows` **{count} rows** · `schedules_registry_heading` **Member
types** · `schedules_registry_mark` **Mark** · `schedules_registry_band` **Band** ·
`schedules_registry_section` **Section** · `schedules_registry_zone` **Zone** ·
`schedules_registry_none` **No mark family was named by this sheet's schedules.** ·
`schedules_notes_heading` **General notes** · `schedules_standing_heading` **Applied values** ·
`schedules_readings_heading` **Readings on this sheet** · `schedules_proposals_heading` **Read from
this sheet** · `schedules_proposal_written_label` **As written** · `schedules_proposal_value_label`
**Value** · `schedules_proposal_already_read` **Already read at this figure.** ·
`schedules_transcribe` **Preview these readings** · `schedules_reading_accepted` **Accepted as
proposed** · `schedules_reading_edited` **Edited** · `schedules_reading_superseded` **Superseded by
a later reading under the same source.** · `schedules_inspector_cell_heading` **Schedule cell** ·
`schedules_inspector_reading_heading` **Note reading** · `schedules_inspector_sources_label` **Read
from** · `schedules_empty_heading` **No drawing has been read yet** · `schedules_empty_body` **A
schedule and its general notes are reconstructed from a sheet's own text once its drawing is
partitioned. Add a structural drawing, and its sheets appear here.** · `schedules_empty_action` **Go
to drawings** · `schedules_error_heading` **The schedules could not be read** · `schedules_error_body`
**Nothing was changed. Try again, and quote the report id if it keeps happening.** ·
`schedules_report_label` **Report id** · `schedules_retry` **Try again** · `schedules_offline` **You
are offline. The sheets read as they stood when this page loaded, and nothing can be committed until
the connection returns.** · `schedules_denied_transcribe` **Recording a note reading needs the
MEASURE permission on this project.** · `schedules_denied_holder` **A project principal can grant it
on the participants screen.**

The five note kinds render as words through `EnumLabel` (the vocabulary line `note kinds (R-TO-034)`):
FY **Reinforcement grade** · FC **Concrete strength** · LAP **Tension lap** · HOOK **Hook extension**
· HOOK_MIN **Minimum hook length**. The three standings render *Agreed* / *Suspended* / *Not read*;
the basis renders *Transcribed* with its ▣ glyph.

Registry entries this increment adds to `src/core/errors/takeoff-schedules.ts` (refusal-state §3's
copy rules bind; the code is never rendered as text):

| code | severity | surface | message | remedy | evidence label |
|---|---|---|---|---|---|
| `SCHEDULE_NONE_RECONSTRUCTED` | warning | inline | **No schedule table could be reconstructed from this sheet.** | **Open the sheet and check that the schedule's title and header row carry text — a table drawn as an image is read as linework, never as rows.** | **Open the sheet** |
| `SCHEDULE_VIEW_CONTRIBUTED_NOTHING` | warning | inline | **This schedule view contributed no rows.** | **Open the sheet and check the rows beneath the header — rows set more than three and a half line pitches apart are read as a different table.** | **Open the sheet** |
| `NOTES_NONE_PROPOSED` | info | inline | **No reinforcement figure was read from this sheet's notes.** | **Open the sheet and read the figure from a note that states one — nothing is assumed where a note is silent.** | **Open the sheet** |
| `NOTE_READING_CONTESTED` | warning | inline | **Two readings of this note disagree, so no figure stands.** | **Read the figure again from the sheet to settle it — a later reading under the same source supersedes the earlier one, and precedence never clears a disagreement.** | **Open the sheet** |
| `NOTE_SOURCE_NOT_ON_SHEET` | error | inline | **That reading cites text that is not on this sheet.** | **Read the figure again from a note on this sheet — a reading is kept only where its evidence is.** | **Open the sheet** |

Voice: calm, concrete, professional; no exclamation marks; no build vocabulary — "seam", "door",
"rail", "gate", "grammar", "ingest" and every clause id appear nowhere a reader can see. Cell texts,
values as written, units, marks, bands, sections, source keys and report ids are model data and
render verbatim in mono or through `IdChip`, never woven into a sentence (I-25/I-26). Kinds,
standings, bases, acceptances and act types render as words through `EnumLabel`, the raw value under
`data-technical`. Registry messages and remedies are never paraphrased. `MEASURE` inside the denial
line is the product's own law, quoted as the seam quotes it.

## 4. Motion (R-UI-004)

Nothing on this screen eases in. Selecting a sheet, selecting a cell, the arrival of readings after a
commit, a standing flipping to SUSPENDED and every refusal are instant — an answer that performs
before it is read is theatre. The only transitions are inherited from single homes: the inspector
slot's 240 ms panel slide (`--motion-panel` `--ease`, the frame's), the registry pane's collapse and
re-open over `--motion-drawer` (= `--motion-panel`), the ConsequenceDialog's entrance (the
primitive's own, `--motion-state` `--ease`), the EvidenceLink's colour and underline thickness over
`--motion-state`, Button and NumberInput hover colours and the nav link's colour at `--motion-state`,
the reticle draw at `--motion-reticle` from `reticle.css`, and the Skeleton pulse in `loading`. Every
duration is a token zeroed at source under `prefers-reduced-motion`, so `schedules.css` carries no
reduced-motion branch.

## 5. Tokens

Only the semantic alias group and the density/layout tokens (Direction §4.1, §4.2); a `--graphite-*`
or `--beam-*` reference outside `tokens.ts` is a lint failure (R-UI-086). This screen spends:
`--surface-app` / `--surface-panel` / `--surface-sunken` / `--surface-selected` / `--surface-hover` ·
`--ink` / `--ink-secondary` / `--ink-muted` / `--ink-code` · `--line` / `--line-accent` ·
`--accent-subtle` · `--state-info(-surface)` and `--state-warn(-surface)` reached only through
RefusalState · `--basis-transcribed` reached only through EvidenceLink and EnumLabel's basis pair ·
`--hairline` · `--space-1/2/3/4` · `--gap-section` · `--radius-2/4/8` · `--text-body` /
`--text-caption` / `--text-12` · `--font-ui` / `--font-mono` · `--leading-ui` ·
`--weight-body-medium` / `--weight-heading` · `--row-h`, `--control-h`, `--cell-px`, `--cell-py`,
`--drawer-w` (and its 160/320 bounds), `--toolbar-h`, `--inspector-w` through the primitives that
read them · `--motion-state` / `--motion-panel` / `--ease`. Px literals, closed set: the registry
pane's 240 and its 200 below `lg`, the collapsed 28, the schedules region's 320 min, the tabs-row
current underline's 2, the `lg` media-query value, and the loading bones' 28/200/240. Any other
literal is a defect. Column widths are the stored table's own business — the DataTable sizes the
frozen mark column to its widest stored cell within 120–280 and divides the rest evenly, because a
reconstructed schedule's columns are not known to this file. **No copper appears anywhere** except
the ConsequenceDialog's confirm, which is the primitive's own; this screen commits nothing itself.

## 6. Themes

`schedules.css` contains no `[data-theme]` selector; every light/dark difference arrives through
token values (R-UI-001). Dark is the default, light is complete, and both are captured — the light
picture by `emulateTheme(page, "light")` inside the dark lane. Contrast holds on the founder values
in both themes: graphite-600/700/900 on graphite-0 and on the rail's and inspector's graphite-50
clear 4.5:1; the beam-500 current-tab underline clears the 3:1 UI floor; `--basis-transcribed`
measures 4.76:1 light and better in dark on graphite-0, and per evidence-link I-176 it is spent on
the glyph and the rule while the cell text itself rides graphite-900 — so a schedule densely full of
links is still a table of readable words. The five kinds, the three standings, the two acceptances
and the one basis are each redundant to a word (and, for the basis, the ▣ glyph), so nothing is lost
in greyscale or to colour blindness. The rail and the registry pane stand one step off the field,
seamed by hairlines; the tables keep the field's own fill so the transcribed text reads on the
brightest ground.

## 7. Test hooks (closed contract, C-05)

Routes: `/t/{tenant}/p/{project}/takeoff/schedules` (`schedulesRoute`, crumbs in `routes.ts`:
workspace › project › Takeoff › Schedules; `shell-crumb-page` reads **Schedules**). Routes linked,
all shipped: `/t/{tenant}/p/{project}/viewer/{drawingId}/{layoutName}?s={sourceKeys}` (every
EvidenceLink and every refusal's evidence, composed only by `selectionAddress` — no `line` param),
`…/takeoff/register`, `…/takeoff/coverage`, `…/takeoff/levels`, `…/drawings` (the empty state's
action), `…/settings/participants` (the denial's evidence). Procedures:
`takeoffSchedules.schedules`, `takeoffSchedules.previewTranscribeSheetNotes`,
`takeoffSchedules.commitTranscribeSheetNotes`.

Test ids, exactly the registry's, on the elements ruled in §1 — every key of `TESTIDS.schedules`:
`schedules-screen` (`data-state`: loading|denied|offline|error|refused|empty|partial|ready) ·
`schedules-sheets` · `schedules-sheet-row` (`data-drawing`, `data-layout`) · `schedules-table`
(`data-schedule`, `data-rows-rendered`) · `schedules-cell` (`data-row`, `data-column`) ·
`schedules-registry` · `schedules-family` (`data-family`) · `schedules-variant` (`data-variant`) ·
`schedules-zone` (`data-zone`: main|ties|ties-end|ties-mid) · `schedules-deferral` (`data-code`) ·
`schedules-notes` · `schedules-standing` (`data-kind`, `data-standing`, `data-code`) ·
`schedules-reading` (`data-kind`, `data-acceptance`, `data-basis`, `data-source`) ·
`schedules-proposal` (`data-kind`) · `schedules-proposal-value` · `schedules-transcribe`
(`data-permission`) · `schedules-inspector` · `schedules-empty`; plus
`TESTIDS.takeoff.navSchedules` → `takeoff-nav-schedules` (`aria-current="page"` here) and
`shell-crumb-page`. Used and never redefined: `evidence-link` (`data-basis="TRANSCRIBED"`),
`refusal-state` (`data-code`), `refusal-evidence-link`, `datatable-row`, `consequence-dialog`,
`consequence-subject-row`, `consequence-confirm`. Every id is spelled once in `src/ui/testids.ts`
and published by the module through `RegisterChrome.testIds`; no literal id appears in `src/`, so the
`cubit/no-literal-testid` frozen count does not rise.

Behavioural hooks without new ids: `aria-disabled="true"` on `schedules-transcribe` while offline or
unpermitted; `role="status"` on the offline banner and `aria-live="polite"` on the answer slot;
`role="table"` / `role="row"` / `role="columnheader"` inside each `schedules-table`;
`data-technical` on every raw enum value and key kept beside its `EnumLabel` or `IdChip`;
`cx-reticle` on every focusable. Asserted absences: no `schedules-inspector` while nothing is
selected (R-UI-080, §7 C3); no second right column; no native `select` or `input[type=date]`
(R-UI-083); no member count anywhere on the screen (I-251); no `schedules-cell` holding more or
fewer than one `evidence-link` unless its stored text is empty (I-252); no figure in a
`schedules-standing` whose `data-standing` is not `AGREED` (I-253); no `schedules-transcribe` inside
a `schedules-notes` whose only child is the `NOTES_NONE_PROPOSED` refusal; no `consequence-dialog`
after a preview refused `ACT_CHANGES_NOTHING` (I-255); no `line` param in any composed viewer
address.

Suites: `tests/takeoff/notes/**` (the grammar, the act pair, `noteStanding`,
`appliedDetailingValuesOf`, the doors each refusing by name, and `copy-mirror.test.ts` failing the
build if the module's `copy.ts` and `src/ui/strings/schedules.ts` ever differ),
`db/__tests__/notes-readings.migration.test.ts`, `tests/ui/craft/mechanical.test.ts` over
`schedules.css`. Journey: `tests/e2e/schedules.spec.ts` (describe title carrying `J-032`) over
`tests/e2e/takeoff/schedules-stage.ts`, page object `tests/e2e/pages/s-schedules.page.ts`;
checkpoints `s-schedules/tables` and `s-schedules/transcribed`, axe serious/critical = 0 at each,
baselines `tests/e2e/baselines/design-dark/s-schedules/{tables,tables-light,transcribed}.png`,
`masks()` over the shell breadcrumb, `shell-user`, `shell-tenant-switcher` and
`consequence-digest-line`. Re-baselined under B-20 in a `baseline:`-subject commit naming the proof:
`design-dark/s-takeoff/**`, `design-dark/j-031-levels/**`, `design-dark/j-022-coverage/**` and
`design-dark/j-021-column-slice/**` — the fourth tab moves the takeoff tabs row on every picture
that shows it.

## Additional test hooks

`data-superseded` (`schedules-reading`, value `"true"`) is required by the contract's attribute
sentence and by I-253's muted superseded rows, but it is **not** in the closed attribute registry
this increment was handed. It is recorded here under its contract spelling; the registry is short one
row and that is a plan defect, not a licence to invent a second name.

## 8. Recorded IOUs (owner named, never a comment in `src/`)

- **Rebar lines re-deriving from a note.** A LAP of 50d changes what a bill should carry, and this
  Consequence names no line: `effects.linesRederiving` is `[]` because no rebar rail exists yet.
  Owner: inc-309-rebar-engine, which reads `appliedDetailingValuesOf` and re-presents the lines.
- **fy and f'c in one unit.** The door answers values as written with their unit, so a sheet stating
  psi and a sheet stating MPa stand as two readings and suspend. Owner: inc-309 (AM-03(f)'s
  conversion and the ld-table lookup).
- **A drawing's own lap table outranking its general note** (AM-03(f)). Only general-note sentences
  are read here. Owner: the node that reconstructs S-02's development-length table.
- **Editing a stored schedule cell and `RENAME_MARK`.** The registry and the tables are read-only on
  this screen. Owner: the mark-authoring leaf.
- **A copy home both layers may read**, so the module's `copy.ts` need not mirror
  `src/ui/strings/schedules.ts` — re-recorded unpaid (s-levels §8, the register's precedent).

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
demonstration.ts,schedules.css}`; the presentational `SchedulesWorkspace` in `src/modules/takeoff/schedules-ui/**`
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
  RefusalState with `NOTE_READING_CONTESTED`, the partial-row pattern of Direction §3.6. The card
  spans the row from a slot this screen owns (`cx-schedules-standing-refusal`): the pattern's own
  class is dressed in the pattern's own stylesheet and nowhere else (ARCH-02, B-17).
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
- **I-257 — the reading's own state is the CHOSEN sheet's state.** `empty`, `partial` and `ready`
  are read off the sheet the rail has selected, never off the revision's whole list: the sheet is
  the subject (I-248), so what a reader is looking at is what the screen is in the state of, and a
  view that deferred on another sheet is that sheet's word to say when it is chosen. A sheet reads
  `partial` where it carries a deferral or a SUSPENDED standing, `empty` where nothing it holds
  stands at all, and `ready` otherwise. Silence is a statement, not a deferral: a sheet whose texts
  propose no figure says `NOTES_NONE_PROPOSED` through the one RefusalState and offers no door, and
  that alone never makes the screen partial — a sheet holding committed readings and no proposal
  reads `ready`, and one holding neither a table nor a reading reads `empty`. Rejected: deriving the
  state over every sheet at once, which paints a screen partial on a sheet where everything stands
  and can never reach the empty cell while any sheet exists.
- **I-288 — the schedules region is the primary the rubric measures, by the id it carries.** §1 names
  the *schedules region* — the stacked tables, the deferrals and the notes panel, scrolling as one —
  the primary work surface, and states its share at 57 %. The craft instrument (AM-08 Part 2) reads
  that share off the DOM, at the largest OUTERMOST candidate inside `shell-main`; the region's
  scrolling frame carried no id a candidate is known by, so the instrument fell through to ONE
  `schedules-table` (28 % of main) and graded the screen on a quarter of the surface a reader in fact
  reads. The frame therefore carries `schedules-grid`, and with it the rendered contract every
  primary region publishes: `data-rows-rendered` is the **sum of the chosen sheet's stored tables'
  band counts**, added and never re-counted (I-250) — each `schedules-table` goes on stating what IT
  drew — and a notes-only sheet publishes `0`, which is the honest count of a sheet that holds no
  table rather than a region that failed to paint. A customer sees no change: no class, no geometry,
  no copy and no pixel moves, and nothing is rendered that was not rendered before. The registry pane
  and the sheet rail are **not** wrapped and stay regions of their own — the rail stands BESIDE the
  work surface (I-233) and the pane yields its height to the inspector (I-249), so a frame drawn
  around either would publish a surface this Decision never named.

- **I-296 — the grammar speaks first, and a model may only name a clause the grammar had no word
  for.** R-TO-034's grammar reads a sheet's notes ENTITY by entity; a general-notes MTEXT is many
  clauses in one entity (`clausesOf`, the font, underline and alignment codes stripped and `\P` the
  break), and a clause standing on an entity the grammar attributed no kind to is a clause nobody
  has read. Where such a clause states a figure IN A SENTENCE — four words, one of them four letters
  long, on a PAPER layout — and only there, its CLASS — never its
  figure — is put to a model as one closed choice over `NOTE_KINDS` with the no-match outcome
  `NONE_OF_THESE`, in the partition job and never at render time (L-AI-01: a question asked when a
  page is looked at makes a ledger row and a tenant's money out of a page view). The FIGURE is
  always the grammar's own reader run over that clause (`readFigure`), so a model cannot move a
  digit (L-AI-03); a class whose reader reads nothing is stored with **no figure at all**, offers
  nothing, and silence stays silence (L-MEA-01, R-UI-050). The no-match outcome comes back as a
  class of **null** and is not a refusal: L-AI-02 makes abstention the caller's decision, and on
  F-RCC6-BNBC's S-01 the four clear-cover clauses have no class to be read into at all, because the
  roster is closed at five and carries no COVER — adding one is the owner's amendment, never this
  screen's. An offer that DOES carry a figure is one more row of *Read from this sheet*, with
  `data-proposed-by="model"`, its own line of copy, the same NumberInput and the same one door
  (I-254); it is judged by the seam like any other reading — kept as offered it is ACCEPTED and the
  call it came from is CONFIRMED, kept at another figure it is EDITED and the call is OVERRULED. A
  reader who reads the clause under a DIFFERENT class judges no call and the offer stays AWAITING:
  a reading cites the ENTITY and not the clause (`noteReadingKey`), and one entity may carry several
  offers, so "which call did they overrule" has no answer a record could stand on. Nothing on this
  screen turns an offer down, so REPUDIATED and AFFIRMED are **declared unwritten** here (I-37).
  Beside the lap, one muted line states what a model was asked about the contested 50d note
  (T-NOTE-OVERRIDE, AM-03(e)): that this clause states the tension lap that governs over the sheet's
  ℓd table, with the probability it gave in mono. It is a proposition presented, not a standing: it
  moves no figure, enters no `AppliedDetailingValues`, and a SUSPENDED lap still renders no figure at
  all (I-253). Rejected: letting the model pick the figure from the clause's own candidates — lawful
  at the seam, but a lap is billed and this product will not put a billed number, even a copied one,
  behind a judgment. Rejected also: refusing the no-match answer as MALFORMED (the caption path's
  shape), which would throw away exactly the calibration evidence this question is worth asking for.
  The sentence rule is a COST decision and says so: without it F-RCC6-BNBC's S-16 alone would put
  113 bar calls to a model, and with it the whole drawing's printed words ask 148 clauses, 38 of
  them on the two sheets that carry general notes. It is tested sheet by sheet against the fixture's
  own corpus and is cheap to move; it is not a reading of the law.
- **I-300 — a class the grammar's readers can already reach is a class the model is never asked
  for, so today a model offer carries no figure and keeps no row.** Each of the five kinds is read
  by a pattern run over the WHOLE entity, so a pattern that matches one clause matches the entity it
  stands in: an entity the grammar was silent on cannot hold a clause whose figure those same
  readers would read. It follows that a class a model proposes for a silent clause stores `kind`
  with a null figure — every time, on this fixture and on any sheet — and therefore renders no
  proposal row, is kept by nobody, and answers its call with AWAITING. That is **the honest state of
  the question today**, not a defect of this screen: what the pass buys now is the calibration line
  (does the model abstain where the law has no class? does it fall into the 2D-stirrup trap session
  4's fix removed?) and the Noul beside the lap. The CONFIRMED/OVERRULED path stands in the act and
  in the store's CHECKs, closed and tested, and becomes reachable the day the law gains a kind whose
  reader is clause-scoped — an owner's amendment, named here rather than half-built.
- **I-301 — a contested schedule cell is put to a model over the grammar's own readings, and what
  comes back is judged, never written into the table (Jev logic-point 2; R-TO-031, L-CAD-08,
  L-AI-01, L-AI-02, L-AI-03).** A cell is CONTESTED where the deterministic path is silent or split
  about it: its column is headed by no role the notation vocabulary knows and the table resolves
  that column as neither its sections nor its levels, or the grammar reads more than one attribute
  in the cell's own words. Such a row is put to the one seam as `schedule-cell`: one Choice per
  contested cell over exactly the candidates the grammar itself found in that cell's words (each
  carrying its own sentence for what it would state), plus the no-match outcome `NOT_STATED`, and
  one Noul over the same state asking whether the row heads or annotates the table rather than
  stating a member — asked together as one request. CODE decides which rows are contested and
  which candidates exist; the model chooses among them and nothing else (a criterion is a span of
  the cell's own text, never a figure the model supplies). The reading is a Proposal its caller
  holds: nothing writes it into `schedule_cells`, `member_types` or a variant, and the table a
  reader sees is the reconstructor's alone. A person judges it through the disposition door
  (`judgeCellReading`, under MEASURE through the one `authorize()`), which records CONFIRMED,
  OVERRULED or REPUDIATED against the call in `model_call_outcomes` and nothing else. Two things
  are deliberately not here yet: no pass asks the question in the product (the natural caller is
  the partition rebuild's proposal pass beside the view-caption one) and no inspector surface
  offers it — so the corpus is recorded from the identical request the recorder composes, and the
  calibration line reads zero until the pass lands; `HEADER_SHOWN_AT` (0.5, a presentational
  threshold the surface will read, never on the write path) is declared and read by nothing. On
  F-RCC6-BNBC the recorder finds 80 contested rows of 87 across five tables; S-25's lintel
  schedule is an ATTRIB-block table the reconstructor cannot reach, which is the reconstructor's
  own debt and not the model's.
- **I-320 — a schedule whose caption is a paper-layout text reads its own model texts top-down
  (session 7, 2026-09-23; L-CAD-08, L-CAD-06, I-290).** A SCHEDULE view captioned by a text on a paper
  layout has no model-space band to read DOWN from, and the reader required the caption among the view's
  own texts — so F-RCC6-BNBC's S-05 PILE SCHEDULE (200A) and S-06 PILE CAP SCHEDULE (202D), whose tables
  stand ABOVE their paper captions, deferred SCHEDULE_NONE_RECONSTRUCTED and every pile stood
  MEMBER_TYPE_UNKNOWN. Such a view's table is its own model texts read top-down from the first band
  holding a mark header; the paper caption stays the title and the schedule's key. A model-space caption
  keeps the read-down rule, and a model caption the view does not hold still anchors nothing. 202D still
  defers (its header is MTEXT 639; its footer 658 reads as a header with nothing beneath) — the cap slice's.
- **I-321 — a mark cell that is exactly a class prefix is a family, and it types that class's numbered
  placements only where the schedule corroborates them (session 7; R-TO-031, L-CAD-07, L-QTY-01,
  T-SCHED-NORULES).** S-05's one row is `P | 500 | 21336 | … | 89` and the plan numbers its 89 rings
  `P1`..`P89`. `P` is a family; it names the family of the placed `P<n>` — which keep `P<n>` as their
  identity — ONLY when it is the sole registered family of its class, its NOS equals the placements of
  that class, and its DIA equals every ring's longest side at the drawn scale within half a unit of the
  printed figure. Otherwise MEMBER_TYPE_UNKNOWN stands. NOS is corroboration only: never stored, never a
  count that bills. A row stating no DIA types nothing, so only round members are typed this way today.
- **I-322 — a schedule's dimension columns are read per class, only where the class's methods use them
  (session 7; AM-06(2), R-TO-032, L-QTY-03, I-302).** For piles: DIA and LENGTH. A header is read whole,
  so `CUT LENGTH` (a bar's), `PILE LENGTH` and a bar schedule's DIA read nothing; the unit comes from the
  cell, then the header's `(mm)`, then the drawing's declared unit, which is cited where it answered.
  Stored in `member_type_dimensions` (0058) with the value as written and its citation, and bound as
  TRANSCRIBED measures cited to the cell — so a pile's `d` is the schedule's 500, never the tessellated
  ring (whose area would put the BNBC pile concrete over the golden). DEPTH waits for the cap slice
  (reading it now would bill F-RCC6's byte-frozen FOOTING SCHEDULE and BNBC cap rectangles before the
  outline governs); TOP is not a dimension word, because beam schedules head their top bars `TOP`.

- **I-sch-1 — the craft look of session 7 (2026-09-23): the drawing's words as the drawing shows
  them, a rail that names its sheets, and a registry that reads as rows.** The vision review found
  the screen at the bar by score and not fit to show (identifierExposure 3, tokensAndGrid 3); its
  findings are ruled here against R-UI-082/084 and the Decision amended in place:
  (a) *Control codes are resolved where a reader reads.* A DXF text writes the diameter sign as
  `%%C`, and every bar cell, every zone line and the inspector printed `2-16%%C` — a machine escape
  in the most-read cells, which a QS reads as corrupt data. What a reader SEES of a cell, a table
  title, a band, a section, a mark spelling and a zone is now the text with L-CAD-02's control codes
  resolved by their one table (`normaliseNotation`, `src/core/entitygraph/notation.ts` — `%%C` → Ø,
  `%%D` → °, `%%P` → ±, the toggles dropped). I-252's "label verbatim" is read as *as the drawing
  shows it*: the store, every key and every attribute keep the text byte for byte, and no control
  code table is spelled a second time (B-17).
  (b) *The rail names its sheets.* The same drawing chip on every one of ~25 rows took the width the
  names need (`S-0…`) and, on the chosen row, `Schedule · Notes · Deferred` could not shrink and
  painted over it. Where every sheet of the rail is a sheet of ONE drawing, that drawing's `IdChip`
  stands once beside the rail's heading; across two or more drawings each row keeps its own. A row's
  holdings yield their width first and ellipsise; the name keeps at least its sheet number (`6ch`).
  (c) *The registry reads as rows.* Mark, Band, Section and each Zone run along one `--row-h` row per
  variant (a family of several variants gives each its own row under its mark), where they stood as
  three stacked lines and two marks filled the pane. A variant whose schedule states no band of
  floors (a beam schedule, whose store files the section column's header as the band text) says
  its Band is `—` rather than `SIZE`: a Band is a band of floors (`VariantView.banded`, read off the
  registry's `bandFrom`). A zone is said through `EnumLabel` — **Main**, **Ties**, **End ties**,
  **Mid ties**, only words its own value holds — with the raw zone under `data-technical`, where it
  was the raw enum in mono. Marks stand in natural order (RB1, RB2 … RB10).
  (d) *Figures read down their right edge.* A stored column every non-empty data cell of which is a
  bare figure (`SPAN (mm)`) is right-aligned, header and cells, as every figure column is (R-UI-084);
  the frozen mark column never is.
  (e) *One h1.* The page had none. `.cx-schedules-name` is the visually-hidden `<h1>` of s-bbs I-289
  at `--text-body`, reading `takeoff_nav_schedules`.
  Owed elsewhere and recorded, not done here: the EvidenceLink's quiet presentation (a glyph and a
  rule on every one of 100 cells, headers included) is the pattern's (`src/ui/patterns/evidence-link`);
  the top and bottom main bars missing from a beam variant's zones are the partition registry's
  (`src/modules/takeoff/partition/schedules/registry.ts`); the status bar's CAD readouts on a
  non-drawing screen are the frame's.

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
| sheet rail (`schedules-sheets`) | one `schedules-sheet-row[data-drawing][data-layout]` per sheet of the pinned revision holding a schedule, a deferral or a note text: sheet name in 13 px (min `6ch`, ellipsis), and what it holds as muted words that yield first; the drawing `IdChip` once beside the heading where every sheet is one drawing's, else on each row (I-sch-1) | `flex: 0 0 var(--drawer-w)` 200 (min 160, max 320); rows `--row-h` 28 | `--surface-panel`, `--hairline`, `--ink-muted`, `--text-caption`, `--surface-selected` | the rail is absent only in `empty`; otherwise it always has a row |
| schedules region (primary) | the one scrolling frame `schedules-grid[data-rows-rendered]` (I-288), holding `schedules-table[data-schedule][data-rows-rendered]`, one per stored schedule, stacked with `--gap-section`; each a DataTable v2 titled by its stored title. Or `schedules-deferral`. Or `schedules-notes` on a notes-only sheet | `flex: 1 1 auto`, min 320; ≥ 55 % of main; rows `--row-h` 28, header 28 sticky, first column frozen | `--surface-app`, `--surface-sunken` (header), `--ink-code`, `--font-mono`, `--cell-px/py`, `--basis-transcribed` through EvidenceLink | never silent: a deferral or `NOTES_NONE_PROPOSED` stands in its place |
| registry pane (`schedules-registry`) | `schedules-family[data-family]` group rows, `schedules-variant[data-variant]` beneath, `schedules-zone[data-zone]` per rebar zone — Mark, Band, Section and Zones along one `--row-h` row per variant; all text as the drawing shows it (I-sch-1); an unbanded variant's Band `—`; zones through `EnumLabel`; marks in natural order; no count (I-251) | `flex: 0 0 240` (200 below `lg`); collapses to 28 with the inspector (I-249); scrolls alone | `--surface-panel`, `--surface-sunken`, `--hairline`, `--ink`, `--font-mono` | the pane stands and states `schedules_registry_none` |
| notes panel (`schedules-notes`) | the three sections of I-253 and the one `schedules-transcribe`. A proposal row carries `data-proposed-by`; a model's (I-296) leads with `schedules_proposal_proposed_by_model` and a row a model judged the lap's standing on trails with `schedules_proposal_lap_governs` and its probability in mono | inside the schedules region; sections separated by `--gap-section`; rows `--row-h` 28, a model's caption and the governs line `--text-caption` inside the same row | `--surface-app`, `--hairline`, `--ink-code`, `--ink-muted` (`cx-schedules-proposed-by`, `cx-schedules-governs`), `--warn-surface` through RefusalState | one RefusalState, `NOTES_NONE_PROPOSED`, and no act door |
| inspector (frame's one slot) | `schedules-inspector`: the selection's heading, its source keys as `IdChip`s under `schedules_inspector_sources_label`, its kind / basis / acceptance as `EnumLabel`s, and its one EvidenceLink | `--inspector-w` 320 (280–480) | `--surface-panel`, `--hairline`, basis palette through EvidenceLink | **absent — width 0**, never a sentence |

**Cells.** Schedule cell: one EvidenceLink, 12 px mono, TRANSCRIBED blue rule and ▣ glyph, label
verbatim as the drawing shows it (control codes resolved, I-sch-1), no wrap, ellipsis plus the
table's own Tooltip (§5 rule 2); a column of bare figures right-aligned. Standing row: the kind through
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

Every one of the eight is a cell a person can OPEN: where the installation arms the evidence
instrument (`uiInstrumentArmed`), `…/takeoff/schedules?__state=<one of the eight>` stands THIS screen
in that state — the same workspace and the same renderers, driven by `./demonstration`'s reading and
flags, never a stand-in drawn beside it. Five are reached the way the product reaches them (the
reading it is handed and the flags it is handed with it); only `loading` and `error` are stated
outright, being facts about a read in flight rather than about any sheet. A `__state` naming nothing
this screen declares is answered `REQUEST_MALFORMED` through the one RefusalState, so an instrument
that did not understand the address says so instead of painting the ordinary read.

- **Loading** — the workspace root at `data-state="loading"`, frame and tabs row intact, core
  Skeletons keeping the layout the screen in fact has: a 200-wide rail bone of six 28 px rows beside
  a table whose header is real and whose body is eight 28 px row bones, and a 240 bone for the
  registry pane. No bone stands for the inspector — it is absent at rest. Never a spinner on a table
  (R-UI-004). The leg is the screen's own; no route `loading.tsx` (s-levels' two-roots ruling).
- **Empty** — nothing stands to be read. Either the pinned revision holds no partitioned drawing at
  all — the shipped `EmptyState` `data-testid="schedules-empty"` fills the work column, rail absent,
  carrying `schedules_empty_heading`, `schedules_empty_body` and, as its one action,
  `schedules_empty_action` linking to `…/drawings` — or the CHOSEN sheet holds no table, no
  deferral, no member type, no proposal and no reading, in which case the rail and the sheet's own
  sections stand and say so in place (I-257), and only `data-state` reads `empty`.
- **Partial** — rendered, never hidden. `data-state="partial"` while the CHOSEN sheet carries a
  deferral or a standing that reads SUSPENDED: those rows and sections stand where they belong with
  their RefusalState, and everything that stands reads as it stands. A sheet whose texts propose
  nothing is not partial by that alone — the notes panel states it under `NOTES_NONE_PROPOSED` and
  the sheet reads as what it otherwise holds (I-257). The J-032 `transcribed` checkpoint is this
  state, and so is the `tables` checkpoint (that sheet carries a deferral beside its table).
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
`schedules_proposal_proposed_by_model` **Proposed by a model from this clause — check it against the
sheet.** · `schedules_proposal_lap_governs` **Proposed: this note states the tension lap that governs
over the sheet's table.** ·
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
· HOOK_MIN **Minimum hook length**. The four rebar zones render as words the same way (I-sch-1):
main **Main** · ties **Ties** · ties-end **End ties** · ties-mid **Mid ties**. The three standings render *Agreed* / *Suspended* / *Not read*;
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
`schedules-sheets` · `schedules-sheet-row` (`data-drawing`, `data-layout`) · `schedules-grid`
(`data-rows-rendered`, the sum of the chosen sheet's stored band counts — the schedules region's own
scrolling frame, the primary §1 measures, I-288) · `schedules-table`
(`data-schedule`, `data-rows-rendered`) · `schedules-cell` (`data-row`, `data-column`) ·
`schedules-registry` · `schedules-family` (`data-family`) · `schedules-variant` (`data-variant`) ·
`schedules-zone` (`data-zone`: main|ties|ties-end|ties-mid) · `schedules-deferral` (`data-code`) ·
`schedules-notes` · `schedules-standing` (`data-kind`, `data-standing`, `data-code`) ·
`schedules-reading` (`data-kind`, `data-acceptance`, `data-basis`, `data-source`) ·
`schedules-proposal` (`data-kind`, `data-proposed-by`: grammar|model — I-296) · `schedules-proposal-value` · `schedules-transcribe`
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
a `schedules-notes` that states `NOTES_NONE_PROPOSED` — whatever record stands beside it (I-257);
no `consequence-dialog`
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

The governs line of I-296 renders inside `schedules-proposal` with **no id of its own**: the id it
wants is `TESTIDS.schedules.proposalGoverns` → `schedules-proposal-governs`, and
`src/ui/testids.ts` is the registry's one home and was not this increment's to edit. Until that key
is added the line is asserted through its row's `data-proposed-by` and its copy, and J-032's leg over
the lap's Noul is owed that id. Named here rather than spelled a second time in `src/`
(`cubit/no-literal-testid`: the frozen count does not rise).

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

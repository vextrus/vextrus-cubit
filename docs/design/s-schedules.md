# Design Decision — S-Schedules (reconstructed schedules, the member-type registry, sheet notes)

Route `/t/{tenant}/p/{project}/takeoff/schedules` — the **fourth** tab of the takeoff lane, under
`src/app/(app)/t/[tenant]/p/[project]/takeoff/schedules/**`, inside the shell frame and behind the
membership guard. Increment inc-303-schedules-notes-ui. Law: R-TO-034, L-CAD-08, L-ACT-02, L-ACT-03,
L-QTY-01, AM-03(h), R-UI-002/003/004/005/010/012/020/021/022/030/031/050/060/080/081/082/083/084/
085/086, S-Schedules, J-032, B-17, B-19, B-20, C-05; and, for an architect's schedules (session 8,
ARCH-3), L-MEA-02, L-CAD-05, L-CAD-06, L-CAD-07.

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
- **I-330 — an MTEXT is read as its lines, and an un-ruled header takes its columns from where the
  rows stand (session 7, FND-2; T-MTEXT-CODES, L-CAD-03/05/08).** A text carrying an MTEXT inline code
  is split at `\P` into lines with its codes taken away by the one reader, `mtextLines`
  (`src/core/entitygraph/notation.ts` — the note clauses read through it too). Each line keeps the
  block's key and stands 5/3 of its height beneath the line before, the DXF default spacing, because the
  artifact states no factor. A header that is ONE text naming two or more columns takes its columns from
  where the rows' texts stand, named in the header's word order. That holds only where the rows (bands of
  two or more texts, within the 3.5× gap) cluster into exactly as many columns as the header names, and
  every row has a cell under MARK; otherwise the old reading stands. A single-text band ends the table
  (BNBC's footer `658`), and S-25's lintel schedule keeps its one-column reading.
- **I-331 — a bar schedule mints no family, and a family two schedules name binds nothing (session 7,
  FND-2).** A table with a BAR MARK column is a schedule of bars: its table is stored and it contributes
  no family (SCHEDULE_VIEW_CONTRIBUTED_NOTHING). A family named by more than one schedule of the same
  record binds no variant (its members stand MEMBER_TYPE_UNKNOWN), because a silent overwrite would bill
  whichever schedule was read last. Neither fixture triggers it now.
- **I-332 — a pile cap's DEPTH is read, only from a schedule whose rows are all one class (session 7,
  FND-2; AM-06(2)).** F-RCC6's FOOTING SCHEDULE also holds PC1/PC2 rows, and reading their depth there
  would bill F-RCC6's four caps (23.328 m³, exactly its golden) and move F-RCC6's byte-frozen families
  digest. Lifting the restriction is a `baseline:` commit and the owner's call. Footing DEPTH stays
  deferred, as does any dimension in a mixed-class schedule.
- **I-333 — a mark inside closed rings names the smallest ring its schedule's size fits, and each placed
  ring's plan is stored (session 7, FND-2; L-CAD-06/07, L-FRM-01/02; migration 0059).** A mark inside
  closed rings names the smallest ring whose longest side fits its schedule's size at the drawn scale,
  within the footprint band, and only that ring. A ring that holds no mark and lies wholly inside a named
  ring belongs to no mark, and no note can mint it. Two marks naming one ring name nothing. The scale for
  this gate is read over one candidate per mark (the ring nearest each), while the footprint median and
  the final scale are read over what survives. Reading the median over one candidate per mark as well
  would place four C4 columns on F-RCC6's ROOF PLAN that it does not place today (233 → 237, measured):
  recorded, not taken. Nearest-anchor is unchanged everywhere else. Each placed ring's plan is stored in
  `placement_outlines`: a rectangle (four right angles, any orientation) by its own sides, else a polygon
  by shoelace, with its perimeter. Units come from the drawing's header, or from the declared unit where
  the header is unitless and the drawn scale is 1 within 1e-3, citing the declaration. On BNBC that is
  S-01's `1F3E`.
- **I-334 — the plan's SHAPE is the drawing's, and its SIZE the schedule's where the two agree (session
  7, FND-2; I-304, L-QTY-01).** A polygon ring is measured by its own area (MEASURED, on the view's
  calibration). A rectangle ring binds the schedule's section (TRANSCRIBED) where the section matches the
  ring's own sides in either order and the same unit, within half a unit of the printed figure;
  otherwise it binds the ring's own sides. With no ring, the schedule's section stands as before. The
  plan is never a bounding box, and never the schedule's rectangle for a polygon. Corroboration never
  defers: a rectangle that disagrees with its schedule is measured by its own sides.
- **I-340 — a run is read in the drawing's one unit, and a support is addressed off each axis by the
  axis's own orientation (session 7, FRM-1; L-MEA-09, L-CAD-02, I-302, I-333, L-QTY-03/06).** Two
  statements, both about reading BNBC's plane as it is drawn. (a) *The unit.* A run's clear was read in
  the header's `$INSUNITS` alone, and BNBC's header is unitless, so every BNBC clear would have been
  `null` (RUN_UNREAD). The unit the placement stage reads geometry in is now ONE reading
  (`drawnUnitIn`, `placement/detect.ts`), shared by a ring's plan and a run's clear: the header's where
  it names one the canon carries, else the unit the drawing's own notes declare where the drawn scale is
  1 within 1e-3. On BNBC that is S-01's `1F3E` ("ALL DIMENSIONS ARE IN MILLIMETRES"), and a clear read
  in it cites `1F3E` after its edge lines and supports. F-RCC6 (header mm) cites nothing more.
  (b) *The orientation.* `addressOf`/`faceAt` (`placement/runs.ts`) took a support's x offset off "the
  letter axis" and its y offset off "the numeral axis". That is right for F-RCC6, which letters its grid
  along x, and wrong for BNBC, which letters along y and numbers along x. Every support S-10 places
  (20B6) was then a stranger at its own grid reference, every beam end fell through to the crossing
  beam's edges, and each clear came out OVER by the two column half-widths (S-14's B6 4297, B7 4017.2,
  B1 4297). Each offset is now taken off whichever axis the grid stage read standing ACROSS that
  direction (`GridAxisRow.axis`), and the face is set back off the same axis. Measured with the pairing
  band widened to 0.2 (the band itself is FRM-2's): B6 4097, B7 3817.2 and B1 4222, the golden model's
  own clears, each cut at the faces of the columns S-10 places at its two ends. F-RCC6's stage digest
  (`a3c0c6e0…`) and BNBC's piles, caps and columns are byte-identical.
- **I-341 — the framed prefixes a floor-by-floor set writes are beams, by exact prefix, and a storey
  digit keys a beam to its floor (session 7, FRM-1; L-CAD-07, L-MEA-09, L-QTY-04/06).** The class map
  (`CLASS_OF_PREFIX`, `placement/law.ts`) held only `B` and `TB` of the framed prefixes. The notation
  grammar already reads `RB`, `REB`, `CB`, `EB`, `LB`, `PB`, `TG` and `SB-R` (compared as `SBR`) as marks.
  Each is now a beam: a roof beam, a roof-edge beam, a cantilever, an edge beam, a landing beam, a porch
  beam, a transfer girder and a stair-roof beam all span between the faces of what carries them and
  under the slab they carry. The lookup stays exact, so `L` (a lintel), `S` (a slab), `P` (a pile) and
  `PC` (a pile cap) keep their own classes. A mark written as one storey digit and then a beam mark
  (`1B12`, `1CB3`, `1EB2`) is that floor's beam, and the digit is the level. Only a beam is keyed this
  way: a digit before any other class is a count or a code (`8T16` is eight bars). `GB` is held back: a
  grade beam is a tie beam, and a tie beam is cut at the foundation members its own plan places. S-08
  draws its 27 caps as unmarked rings, so a grade beam read now would be cut at the columns a storey up
  and measure about two-thirds over (GB1-1: +67 %). It waits for the caps to stand on S-08. The roof
  schedule's families (`RB*`, `REB2`, `SBR*`) now name a class, but no dimension is read for a beam
  (`DIMENSIONS_READ`), so the registry's output is byte-identical.
- **I-342 — a bound xref's layers are another drawing's background, and no member is read off them
  (session 7, FRM-1; T-XREF-BOUND, L-CAD-07, L-QTY-04/06).** S-13 carries the architect's plan bound in
  as background: `ARCH-PLAN$0$WALL`, `…$WINDOW` and `…$DOOR`, with the walls and windows drawn as eight
  congruent pairs 125 apart. That is inside the edition's pairing band (195.1), so once I-341 made the
  `1B` marks beams, the run reader placed eight beams on them, 9000 and 1800 long and carried at
  neither end, where no beam was drawn. An entity on a layer named with a CAD program's binding infix
  (`<xref>$<n>$<layer>`) now stands in no population of the placement stage, for the outline reader and
  the run reader alike. This reads a layer's NAME for the one part no draughtsman typed. What the name
  says (`Beam Line`, `Column`, `S-BEAM`) is still never read. An attached, unbound xref spells its layers
  `XREF|LAYER`; neither fixture draws one, and none is read. F-RCC6 has no such layer, and no BNBC
  pile, cap or column stands on one.
- **I-343 — a long-section strip's label is a member type, banded by its sheet's title (session 7,
  FRM-2; R-TO-031, L-FRM-02, I-302, T-SCHED-CONTD).** BNBC states no beam schedule for its floors. S-17
  (view 218E) details the typical floors' 53 beams as strips, and S-16 (2173) the first floor's 53. Each
  strip is labelled with its mark and, on the same baseline 1500 to the right, its section (`B1` ·
  `300x600`, `1B1` · `300x600`, `TG1` · `400x900`). Each sheet's title states the floors:
  `TYPICAL FLOOR BEAM LONG SECTIONS (2ND TO 6TH FLOOR)` (1718) and `1ST FLOOR BEAM LONG SECTIONS - …`
  (13F7). The schedules stage now reads such labels (`schedules/strips.ts`, joined to the registry by the
  rebuild). It reads every view that is neither a SCHEDULE nor a layout plan. A label is a text that is
  exactly a framed mark, and the nearest text to its right on its baseline (within half the mark's
  height) must be exactly a section. Each label is one family (keyed by the view's anchor), with one
  variant: the label's section, in the label's unit or else the declared one (1F3E), cited to the size
  text, the title and the declaration. The band runs from the first to the last level word of the
  sheet's non-label texts and its caption. They must agree (`sameStorey`). A sheet stating none is
  unbanded; a sheet stating two different bands contributes nothing (SCHEDULE_VIEW_CONTRIBUTED_NOTHING).
  A mark labelled twice is read once, so T-SCHED-CONTD's `B9` (S-17's `CONTD. ON S-18`) is one family.
  Bars are not read here (L-FRM-05). The roof schedule's `SPAN (mm)` is a centre-to-centre figure and is
  never read as a clear. F-RCC6 carries no strip label, and its families are byte-identical.
  *Recorded, not taken:* the roof schedule's variants keep `bandText` `SIZE` (the section column's head
  as its band text). The fix is general — a header word is no band — and it would move F-RCC6's
  byte-frozen FOOTING SCHEDULE variants (`L x B (mm)`) and the stage digest `a3c0c6e0…`. That is a
  `baseline:` commit and the owner's call. No measurement reads it: the rails read `bandFrom`/`bandTo`,
  and the screen already says `—` (I-sch-1(c)).
- **I-344 — a pair wider than the pairing band is a member only where its gap is its naming mark's
  stated width (session 7, FRM-2; L-MEA-01, L-MEA-09, L-CAD-03, L-QTY-06, T-TEXT-ROTATED).** The edition's
  pairing band (`containmentMerge × spacing`, 195.1 on BNBC) pairs none of BNBC's 250, 300 and 400 beams.
  Widening the band pairs whatever else a plan draws alike and names each pair by the nearest mark.
  Measured that way, EB1's four 250 × 300 spans were named `B2`…`B5` (300 × 600), two cantilevers `B3`,
  `TG1` a 250 beam, and `LB1` and `B31` each other: every one billed at a section that is not its own.
  The band is unchanged. A pair beyond it (`statedPairsIn`, `placement/runs.ts`) is a member only where
  all of these hold:
  (a) its gap equals the width (`b`) its naming mark's family states, at the drawn scale, within half the
  printed unit;
  (b) the naming mark is the pair's own lettering where it has one — a mark turned to run along the one
  pair it stands on (I-460, below) — and otherwise the one `markedIn` would choose, from the labels
  that stand on no drawn pair. A mark standing between a pair's edge lines names no OTHER pair, however
  it is written; where a pair's own lettering and the label beside it disagree, nothing names it;
  (c) the mark stands nearer this pair than any other drawn pair it stands beside;
  (d) the pair runs along an axis of the plane. A slanted pair is measured by its projection and probed
  square to the wrong direction; S-13's `PB4`/`PB5` then read no slab either side and published COMPLETE
  concrete 15 % over the golden's own figure. A slanted pair waits for D13.
  The mark that admitted the pair is the one that names it. On BNBC at the edition's own band this places
  148 beams (session 8, FRM-3; 72 before it): S-14 52, S-13 50, S-15 46 — the 25, 23 and 24 their
  labels beside them name, and the 27, 27 and 22 lettered turned on their own axes (I-460). Each is
  typed by its own family and stands on the golden model's member of its mark. None is named by a
  neighbour. TG1 (lettered at 0° inside its own pair and turned across it) and the slanted members stay
  unplaced: under, never over. No beam layout states a slab thickness, and no run reads both of its
  sides, so every beam line is PARTIAL_DECLARED (SLAB_THICKNESS_UNSTATED) and none is COMPLETE. F-RCC6's
  pairs are all inside the band and its texts all at 0°; its stage digest `a3c0c6e0…` is byte-identical.
  *Recorded for FRM-4 (re-graded over all 148 runs, session 8,
  `tests/takeoff/partition/placement/bnbc-beam-sections.test.ts`):* no clear is OVER the golden model's.
  The 17 this list held OVER while only 72 were placed — B12/B14/B17/B18 and their 1F twins +125,
  B13/1B11 +250, RB12/14/17/18 +50 and RB13 +200, cut past the lift core; EB1 and 1EB1 +250, cut at no
  end — are each cut now at the face of the vertical beam or cantilever FRM-3 placed across its end: the
  twelve on S-14 and S-13 at the golden's own figure, the five roof runs under it. 43 are UNDER, each owed
  to FRM-4 before a slab thickness makes any beam line COMPLETE:
  - CB1/CB2 and 1CB1/1CB2, −125 each. EB1 is cut at the cantilevers' faces and each cantilever at EB1's,
    so the corner between them has no owning member (L-MEA-09: exactly one). The golden runs the
    cantilever to its tip and EB1 between the cantilevers' faces; FRM-4 gives the corner to one of them.
  - B34/B37 and 1B32, −125: cut at the crossing beam's face where the golden cuts at the lift core's wall,
    which is not yet a placed support (WLS-1).
  - 1B34 −25 and 1B35 −150: they end on TG1, which stays unplaced, and are cut at the B4 column's face.
  - 34 roof runs, −50 to −275: cut at the faces of the columns S-10 draws, where the golden cuts at the
    roof storey's own (support faces per storey).
- **I-460 — a mark turned to run along the one drawn pair it stands on names that pair (session 8,
  FRM-3; L-CAD-05 read through I-415, L-CAD-03, L-MEA-09, L-QTY-04, L-QTY-06, T-TEXT-ROTATED).** A
  structural plan letters a beam running up the sheet ON its axis, turned to run along it. v2 stated no
  rotation, so I-344(b) set every mark standing on a pair aside, and every such beam went unplaced: on
  BNBC, 77 of them. L-CAD-05 asks the artifact to carry the drawing's rendering and geometry facts, and v3
  states each text's world rotation (I-415). The placement stage reads it for one question only: is a
  mark standing on a pair that pair's own lettering? It is (`ownLettering`, `placement/runs.ts`) where
  three things hold:
  (a) it stands on exactly ONE drawn pair — the band's or a stated width's. A mark standing where two
  pairs cross, or on two readings of one pair of lines, letters neither;
  (b) its baseline runs ALONG that pair: carried the member's own length from where it stands, it stays
  within half the member's width of the axis;
  (c) it is TURNED — not written the way the sheet reads. Judged the same way: carried the member's
  length, the baseline leaves a line drawn across the sheet by more than half the member's width.
  Both tolerances are the member's own geometry (L-MEA-01); nothing spells an angle.
  (c) is what makes this a reading and not a guess. A mark at 0° on exactly one pair across the sheet,
  running along it, is written the way every label on the sheet is, wherever it falls. F-RCC6's trimmer
  lettering `40B` stands exactly so on a pair that is NOT its own, so a rotation-blind rule would name
  that pair `B5`. S-13's `TG1` is lettered `D74` in that same geometry on its OWN 400 pair, and `D75`
  turned ACROSS it. The drawing gives no way to tell `D74` from `40B`, so both name nothing: TG1 stays
  unplaced, under.
  The pair's own lettering is the naming mark of I-344(b), and every other fence stands. The pair's gap
  must be its mark's stated width (I-344(a)), and it must run square to the plane (I-344(d)). Two
  different marks lettering one pair, or its lettering against a label beside it that names another
  member, are two readings, so nothing names it (L-QTY-04). A mark on a pair names no other pair, so `LB1` and `B31` on
  S-14 are each named by their own. That holds whichever pairing drew the pair it stands on: a mark on
  one of the band's pairs is no label beside a stated-width pair either. This is read only inside the
  stated-width pairing (`statedPairsIn`), so the band's own members — F-RCC6's byte-frozen reading — are
  untouched. "The way the sheet reads" is model x, which holds for every plan of both fixtures; a plan
  drawn turned in model space behind a twisted viewport would need its twist subtracted first, and
  nothing reads that twist yet.
  - **What an artifact at the v2 floor reads.** It states no rotation, and no mark is turned: the
    drawing places exactly what it placed. A drawing stored before v3 keeps reading at v2 until a
    declared re-ingest (`pipeline.ts`), so an existing project gains its vertical beams only then.
  - **On F-RCC6-BNBC.** 76 of the 77 are placed: S-14 +27 (B25–B46, CB1–4, LB1), S-13 +27 (1B23–1B44,
    1CB1–4, LB1), S-15 +22 (RB25–RB46). The 77th, `SB-R3`, stands on the stair-roof view, which the
    grid stage did not georeference, so nothing there is paired. Walked through J-000's order of acts
    (`tests/takeoff/partition/expansion/bnbc-placeholder-carry.test.ts`), the register holds 1F 49,
    2F–6F 52 each and ROOF 46 = 355 beam objects on the stack. It also holds one placeholder: S-13's LB1,
    under `@unregistered:1ST` from the pin. S-16 details no LB1 and S-17 bands it `2ND TO 6TH`, so the
    resolver stands it on no level of the stack (L-FRM-02), and the rebuild does not carry it (I-367).
    That makes 356 objects. The beam rails report the placeholder and never size it (I-461,
    `s-levels.md`): `variantCovering`'s level-less arm would have handed it S-17's one row, banded off
    its storey. So a J-000 campaign publishes no line on its key, and the read-back's
    `placeholder_lines` stays 0. The Measure run records one `SECTION_BAND_UNCOVERED` observation on it
    for each beam kind. That is read from the code and the walked register; J-000's read-back is its
    proof.
  - **What moves.** Each new member is a face a run ending on it is cut at, so the 17 clears I-344 held
    OVER are no longer over (its FRM-4 list, re-graded above). Every beam line is still PARTIAL, so no
    billed figure moves. The joint seam (`measure/joints.ts`, I-413) reads placed framing, so its lower
    bound now sees the vertical beams, the cantilevers and LB1. TG1 stays unread, as do its two GF joints.
- **I-337 — a foundation is formed along its SIDES only, over the one plan its concrete is measured
  over (session 7, FND-3; L-FRM-03, I-334, L-QTY-02/03/04; edition IS1200_IN @ 2027.04, migration
  0061).** L-FRM-03 states the figure twice — "Foundation `count × 2(L+B) × depth`" and "Polygonal
  foundation/cap: side faces only, `perimeter × depth`" — so there are two methods, the formwork twins
  of the two prisms: `rcc.foundation.formwork_rect@1` = `count × 2 × (L + B) × D` and
  `rcc.foundation.formwork_poly@1` = `count × P × D`, in a new method file so no standing pair's
  closure moves. One reader, `foundationFormworkRail` (footing and pile cap; a pile is bored, not
  formed), is composed into the frame's `rcc.formwork` line after the beam, tie beam and lintel. It picks
  the rule by `planOf` — the plan the concrete binds — so the two kinds never disagree about a plan: a
  rectangle binds the very L and B its concrete binds (the schedule's print where the ring corroborates
  it, else the ring's sides), and a polygon binds `P`, its ring's own boundary as `placement_outlines`
  stores it, MEASURED on the view's calibration and cited to the ring. The schedule's rectangle never
  stands for a polygon: a chamfered PC2 runs 6960.1 mm where 2100 × 1750 would say 7700 (+10.6 % on that
  cap, over). Neither method declares a variable a soffit or a top could be bound through. A polygon
  whose boundary was not read (a hand-staged plan) omits `P`, and a plan nobody stated omits `L` and `B`,
  under `FOUNDATION_PLAN_UNSTATED`; an unscheduled depth omits `D` under `FOUNDATION_DEPTH_UNSTATED` — so
  F-RCC6's footings and caps, whose mixed FOOTING SCHEDULE states no depth (I-332), publish formwork
  rows PARTIAL_DECLARED and bill nothing, exactly as their concrete does. On F-RCC6-BNBC the 26 caps
  publish COMPLETE: 12 rectangles along 98.8 m and 14 PC2 along 97.4414 m, Σ 196.2414 m × 1.295 m =
  **254.132613 m²** against the golden's 254.211 (−0.031 %, the golden's 1295.4 mm depth printed 1295 by
  the schedule), inside [246.584, 254.2115]. BNBC places no footing (its F1 is the unmarked ring 638), so
  no footing formwork is published there.

- **I-544 — a pile cap is its prism less the heads of the piles it stands on; a cap whose heads
  nothing places keeps its row and bills nothing (session 8, FND-OWN; L-MEA-09, L-QTY-02/04, AM-02;
  R0-0's refuter).** L-MEA-09 puts the pile first — "pile › pile cap" — and the pile rail bills every
  pile from cut-off to toe (`rcc.pile.concrete`, 21.336 m on BNBC). A pile is cut off ABOVE the cap's
  soffit, so its head stands inside the cap and is the pile's. BNBC cuts its 89 piles off at EL −1.829
  (S-05 `4DA`) under a soffit at −1.9046 (the neck's 0.6096 below GF plus the schedule's 1.295): 75.6 mm
  of every head, 1.321 m³ that `rcc.foundation.prism_*` billed a second time. The cap's own sentence now
  says it: `rcc.pile_cap.prism_rect@1` = `count × (L × B × D − n × π × d × d × e ÷ 4)` and
  `rcc.pile_cap.prism_poly@1` over `A × D` — `n` the piles held (I-547), `d` their schedule's DIA,
  `e` the height their heads stand above the soffit. They are RULES of their own and not second versions
  of the prisms, because a footing shares those and has no pile, diameter or head to name; a version in
  force for every offer under one rule id would ask it for them. They are in a new method file
  (`owned.ts`), so no standing pair's closure moves, and the next platform edition cites them (OPEN-3);
  under an edition that cites none of them the gate refuses a cap `METHOD_NOT_IN_EDITION`, by name. The
  rail offers EVERY pile cap under the owned rule, and binds what the setup READ: a cap whose piles
  nobody read — no pile plan in the revision, none its plan can be laid over, or no ring read for it —
  KEEPS its one line, PARTIAL, `n`, `d` and `e` omitted under `CAP_PILES_UNREAD`, and never falls back
  to the prism (the FND-OWN review, CONFIRMED: the fallback published the whole prism over heads the
  pile rail bills — shifting S-04's grid one metre left 0 relations and 26 COMPLETE prisms, 128.781275
  m³, the +1.321 m³ back); one whose piles were read and where nothing states `e` KEEPS its line,
  PARTIAL, `e` omitted under `PILE_HEAD_UNSTATED` — its whole prism would read over, and
  over-measurement is a hard block. A head the drawing only bounds is deducted at the bound and the row
  says `JUNCTION_DEFERRED`; a cap the plans hold no pile under omits `d` and `e` under
  `CAP_HOLDS_NO_PILE`. A FOOTING stands on the ground and keeps L-FRM-02's prism. Pile concrete does not
  move: the pile owns its head. **Cost, said plainly:** no reader of the set carries a head height into
  a store today, and none can off BNBC as drawn without a further reading nobody has ruled on. Measured
  over the stages' own read: S-06's PILE CAP SCHEDULE heads `MARK SIZE DEPTH PILES BOTTOM MESH TOP
  MESH` — no TOP column — so PC1..PC5 register `depth` 1295 and no `top`; no text or attribute of the
  set states a cap's top or soffit level; S-07's cap sections draw the pile stubs ending AT the soffit;
  and the one cut-off statement, `EL -1.829` (S-05 `4DA`, the LEVEL_MARK on the untyped PILE
  CURTAILMENT & SPIRAL ZONES view), stands on that view's own datum, while the level store keeps
  storey HEIGHTS, not elevations, and the cap's top exists only as the FDN neck a person ENTERS
  (I-339). Relating the two would take an Interpretation that every EL mark of a set shares GF's datum
  — which the levels stage refuses for sections ("the views are drawn from their own datums") — and
  that the neck's foot is every cap's top. So on BNBC the 26 cap concrete lines publish PARTIAL with no
  figure until the set states the head (the embedment note R0's Rev C S-05 prints, read as `e`), or the
  owner rules the datum reading. With the head
  stated at 75.6 mm and PC5's recess (I-546), the 26 publish COMPLETE at **122.475 m³** (proved
  over the stages' own read and through the gate, `tests/takeoff/rails/foundations/cap-junctions-*`),
  inside the band of the regenerated golden's 122.500 (R0, K17/K18); at 76.2 mm, 122.464.
- **I-545 — L-MEA-09 governs L-FRM-04's blinding: under a cap, the blinding is net of the piles
  that pass through it (session 8, FND-OWN; L-FRM-04, L-MEA-09).** L-FRM-04 states the blinding as
  `(L + 2p)(B + 2p)t` and names no deduction. A pile a cap stands on reaches the cap — it is cut off at or
  above the soffit, or it bears nothing — so every one runs through the blinding the cap is cast on, and
  the blinding is the cap's: the pile's precedence over the cap governs it too. This needs no head
  height: the section is taken whole whatever `e` is. A cap whose piles nobody read keeps its blinding
  row with `n` and `d` omitted under `CAP_PILES_UNREAD` (I-547), never the whole slab.
  `pcc.blinding_rect_piled@1` = `count × ((L + 2 × p) × (B + 2 × p) − n × π × d × d ÷ 4) × t`. A pile
  section is a JUNCTION its owner takes, not an opening, so no opening threshold partitions it — the
  same way a column is taken out of a slab whatever its size (BNBC's 0.196 m² sections stand above IS
  1200's 0.1 m² either way). It needs no head height, so on BNBC the 12 rectangular caps' blinding
  publishes COMPLETE at **3.989 m³** where it stood at 4.692 (47 sections × 0.0762 m = 0.703 m³, R0-0's
  refuter); the 14 PC2 still defer by their plan (L-FRM-04, R0-D1).
- **I-546 — a recess cast into a pile cap is its void: deducted from its concrete, its four sides
  formed, its floor not (session 8, FND-OWN; L-MEA-09, L-FRM-03; R0 GC-5/K18).** BNBC's lift pit is a
  recess inside PC5 (S-08's pit ring inside PC5's; R0-0's refuter, CONFIRMED). `rcc.pile_cap.prism_*
  _recess@1` take `Lr × Br × Dr` off the owned prism, and `rcc.pile_cap.formwork_*_recess@1` add
  `2 × (Lr + Br) × Dr` to the cap's sides; the recess's floor is the cap's own top surface, cast
  against nothing. A cap no reader states a recess for is offered as before. **Cost:** no reader states
  a recess yet — R0's Rev C draws it on S-07 ("PC5 WITH LIFT PIT RECESS", 2493 × 2188 × 914) and the
  reader of that view lands with it; a head-height reader must not land before it on BNBC, or PC5
  would publish over by the recess. Staged at those figures, PC5's formwork adds 8.557 m² and the caps
  form **262.689 m²**, inside the band of R0's 262.773.
- **I-547 — which piles a cap stands on is read over the whole pinned revision, by laying the pile
  plan over the cap plan through the grid both draw, and asking the cap's own ring (session 8, FND-OWN
  and its review; L-CAD-07, I-292, I-333, L-REG-04, L-MEA-09, L-QTY-04).** No stored reading states it:
  S-04 places the piles and S-06 the caps, each in its own region of model space — and a set routinely
  draws the two on two FILES. The measure setup (`src/modules/takeoff/measure/cap-junctions.ts`,
  `pilesHeldOverRevision`) gathers every drawing's placements, grid and cap rings first, keeping each
  drawing's view keys and handles apart (two files may spell one), and only then reads the relation:
  it takes each pile's centre off the pile plan's axes and puts it back on the cap plan's same-named
  axes, then asks the cap's ring — read back out of its own drawing's artifact by the key the placement
  stage named it by, never its bounding box — which centres it holds. A view is always its own frame, so
  a cap and piles drawn on one view need no grid. Two plans are one frame only where every axis label
  they share stands at one offset on the placement lattice, with at least two labels per world axis;
  plans at two scales, turned, or sharing too few labels are no frame. A cap any pile view cannot be
  laid under has no entry — never a count that skipped that view's piles, which would net fewer heads
  than it holds and publish over — and the rails keep its rows naming `CAP_PILES_UNREAD`; a cap on a
  view every pile plan CAN be laid under is read as ever. The
  count is MEASURED, cited to the cap's placement. On BNBC every cap holds exactly the PILES figure S-06's
  own schedule prints for its type (2, 3, 4, 5, 9) and every one of the 89 piles is held once, the PC1
  turned 45° by its own ring. The schedule's PILES column stays unread (I-322): the plans are the
  reading, and the column is what this proof holds them to.

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
  *Amended in session 8 (C6a), the code returning to this rule:* the name was `flex: 1 1 auto` beside
  holdings at `0 4 auto`, and flex shrink is weighted by basis, so a long holdings string still took a
  share out of the name — the chosen model row read `Model sp…` beside `Schedule · Notes · Deferred`.
  The name is now `flex: 0 1 auto` (it asks for its own width and never grows) and the holdings
  `flex: 1 1 0` with `min-width: 0` and `text-align: end` (they ask for nothing, take only what the name
  leaves, stand at the row's end, and ellipsise). A name longer than the row takes the row down to its
  `6ch`, and the holdings are then nothing.
  (c) *The registry reads as rows.* Mark, Band, Section and each Zone run along one `--row-h` row per
  variant (a family of several variants gives each its own row beside its mark — one grid headed
  once, I-353(b)), where they stood as three stacked lines and two marks filled the pane. A variant whose schedule states no band of
  floors (a beam schedule, whose store files the section column's header as the band text) says
  its Band is `—` rather than `SIZE`: a Band is a band of floors (`VariantView.banded`, read off the
  registry's `bandFrom`). A zone is said through `EnumLabel` — **Main**, **Ties**, **End ties**,
  **Mid ties**, only words its own value holds — with the raw zone under `data-technical`, where it
  was the raw enum in mono. Marks stand in natural order (RB1, RB2 … RB10).
  (d) *Figures read down their right edge.* A stored column every non-empty data cell of which is a
  bare figure (`SPAN (mm)`) is right-aligned, header and cells, as every figure column is (R-UI-083);
  the frozen mark column never is.
  (e) *One h1.* The page had none. `.cx-schedules-name` is the visually-hidden `<h1>` of s-bbs I-289
  at `--text-body`, reading `takeoff_nav_schedules`.
  Owed elsewhere and recorded, not done here: the EvidenceLink's quiet presentation (a glyph and a
  rule on every one of 100 cells, headers included) is the pattern's (`src/ui/patterns/evidence-link`);
  the top and bottom main bars missing from a beam variant's zones are the partition registry's
  (`src/modules/takeoff/partition/schedules/registry.ts`); the status bar's CAD readouts on a
  non-drawing screen are the frame's.

- **I-353 — the registry is a registry: bands from the ground up, one grid headed once, and the
  model space said in words (session 7, 2026-09-23; the vision re-look of the M3 project).** The
  re-look put the screen at the bar by score and not fit to show (tokensAndGrid looked 3,
  identifierExposure looked 4); four of its findings are ruled here against I-sch-1(c), R-UI-082 and
  R-UI-083 (the grid law, cited as R-UI-084 — the breadcrumb's — until session 8), and the Decision is
  amended in place to match:
  (a) *Bands from the ground up.* The store keeps a family's variants in the order its keys sort, so
  F-RCC6-BNBC's C1 read `3RD & 4TH`, `5TH TO 6TH`, `GF TO 2ND`, `ROOF-SRR` — the ground floor third,
  where a quantity surveyor reads a column schedule from GF upwards. `schedulesViewOf` now hands a
  family's variants in storey order (`variantsInStoreyOrder`, `src/modules/takeoff/schedules-ui/
  order.ts`): by where the band STARTS, then where it ends, then its words in natural order; a variant
  whose schedule states no band of floors (a beam schedule's) after every banded one, in the store's
  order. The rank reads the ends exactly as the notation grammar spells them once it has read a band
  (`FDN` < `BSMT` < `GF` < `MEZZ` < the counted floors, `3RD` = `3F` < `ROOF` < a building's own label
  such as `SRR`); it places nothing on the building — where a band's floors physically stand is the
  level stack's answer (L-MEA-07) — and it is only the order the drawing's own words are listed in.
  The same file is now the lane's one spelling of natural mark order (`MARK_ORDER`, RB2 before RB10),
  which this screen's reading had spelled inline; the bar schedule's door reads it too (s-bbs I-354).
  (b) *One grid, headed once.* A variant ran as a wrapping flex row, so at 1280 its third zone fell
  to a second line and a four-band family took eight; and `Band`, `Section` and `Zone` were printed
  inline on every row where §1 draws one heading row. The registry is now ONE CSS grid of named
  tracks — `[mark] [band] [section] [main] [ties] [ties-end] [ties-mid] [rest]` — with
  `schedules_registry_mark` · `_band` · `_section` · `_zone` said once in a heading row pinned to the
  pane's top (the Zone heading only where a zone stands, spanning the zone tracks). A family and a
  variant are SUBGRIDS of it: the family's mark stands in the Mark track of its first row and its
  variants run one `--row-h` row each down the tracks beside it, so a family of four bands is four
  rows. Each zone stands in its OWN track by its `data-zone`, so an End ties cell stands under every
  other End ties cell; a zone keeps its word through `EnumLabel` (I-sch-1(c)) at the row's caption
  size, sharing one baseline with the mono text beside it — the body-size word sat visibly above the
  mono. Nothing on a row wraps: a cell that is too long ellipsises, and the Section — the longest
  thing on the row while the registry files a joined cell there — carries its whole text in the
  shipped Tooltip (§1's cell rule). What the tracks leave over stands at the END of the row (`rest`),
  never as a gulf between a section and its bars. Rejected: a real `<table>` (a family's mark would
  have to stand inside its first variant's row, and J-032 reads each variant row as saying its own
  band and section and nothing else — AC-7's per-row vocabulary); a heading row per zone kind (it
  drops the zone word from the cell, which the re-look asked to keep).
  (c) *The model space in words.* The rail's first sheet read `model` — the DXF's word for the space,
  which names no sheet a reader ever opened — where every other row reads its title. `SheetView.kind`
  now carries the extractor's word for the space (L-CAD-05), and a sheet whose kind is `model` says
  **Model space** through `EnumLabel` at the name's own face and size, with `model` under
  `data-technical`, on `data-layout` and in the name's tooltip. A sheet whose kind was not asked keeps
  its layout name.
  No test id, attribute or copy key is added — the heading row speaks the four registry keys §3
  already rules — so J-032's registry walk is untouched: every variant row still says its own band and
  section and nothing else, and every zone row its own text and zone word. Owed elsewhere and
  recorded, not done here (wave-3's held rows): the Section column still prints the whole joined cell
  (`350x350+8-16Ø+10Ø@100/150 (TIES)`) and End ties and Mid ties the same `100/150` text until the
  partition registry splits a `+`-joined column cell into section, main and ties
  (`src/modules/takeoff/partition/schedules/registry.ts`); when it does, this grid needs no change.

- **I-436 — a Band says a band of floors: as written where the text is one, by its ends where the
  band was read off a sheet's title (session 8, C6a; I-sch-1(c), I-343, I-251, L-CAD-08, R-UI-082/083).**
  The strip stage stores a long-section family's band text as the whole title of the sheet its strips
  stand on, because that is the text the band was read AT (I-343): F-RCC6-BNBC's S-16 and S-17 file
  `1ST FLOOR BEAM LONG SECTIONS - TOP, BOTTOM AND EXTRA BARS` and `TYPICAL FLOOR BEAM LONG SECTIONS
  (2ND TO 6TH FLOOR)` under 53 families each, and the Band cell printed that title, clipped, on all
  106 rows. The screen's reading now hands each variant a **band face** (`VariantView.bandFace`,
  composed by `familyViewOf` in `src/modules/takeoff/schedules-ui/family-view.ts`): where the notation's
  own band reader reads the stored text as a band (`parseFloorZone` — `GF TO 2ND`, `3RD & 4TH`,
  `ROOF-SRR`, `FDN`) the cell says that text verbatim; otherwise it says the band's two ends as the
  store holds them (`bandFrom`/`bandTo`, the grammar's own spelling), one end once where they are one
  floor (`1ST`), and two joined by `schedules_registry_band_span` (**{from} TO {to}** → `2ND TO 6TH`),
  the convention the drawing's own bands are written in. The stored title keeps every byte, stands
  in the cell's shipped Tooltip as the drawing shows it, and is where the band came from. A variant
  whose schedule states no band of floors has no face and says `—` (I-sch-1(c)). The fix is UI-side
  only, and deliberately: L-CAD-08 keeps raw cell text verbatim, the placement stage reads a variant's
  band text for its level words (`partition/placement/runs.ts`), and `strips.test.ts` pins the stored
  title, so no stored text, placement or quantity moves; the J-000 read-back of beams is unchanged by
  construction. No second level-word classifier is written (B-17): which text is a band is
  `parseFloorZone`'s answer. Rejected: storing the band phrase alone in `strips.ts` (rewrites stored
  band text and re-keys the strip stage for a presentational defect); printing the title's first
  level word only (loses the typical floors' upper end).
- **I-437 — a committed reading says its figure once and its unit once (session 8, C6a; §1's reading
  row, R-UI-082, LAW-FMT).** §1 rules the reading row as "canonical + unit"; the row and the reading's
  inspector printed `valueAsWritten` and then `unitAsWritten`. A reading kept as proposed stores the
  grammar's value as written, which is the note's own words WITH their unit (`500 MPa`, `50d`,
  `75 mm` — `src/core/notes/grammar.ts`), so every accepted reading on every project said its unit
  twice: `500 MPa MPa`, `50d d`. The row and the inspector now say the canonical figure through the
  format seam (`formatUserFigure`) and the unit once — `500 MPa`, `50 d`, `1,250 mm`; a canonical the
  seam does not read as a decimal (a value that stated no figure canonicalises to its own words) is
  said as the reader wrote it rather than taking the screen down. The value as written stays in the
  store and on the proposal row's *As written* trace, where the drawing's own words belong. The
  demonstration's datum (`demonstration.ts`) was never wrong — it is the grammar's own shape — and
  now says so; it also stands a strip family beside the column family, so the evidence instrument
  shows both band faces.
- **I-458 — one MTEXT stripper, in core, keeps a stacked fraction; every reader of a drawing's words
  reads through it (session 8, REAL-1; L-CAD-02, L-CAD-03, B-17, T-NOT-FTIN-STACK, T-MTEXT-CODES; I-330,
  I-410).** The codes an MTEXT is drawn with had two homes that disagreed. Core's `mtextLines` deleted a
  stacked fraction outright, so `3'-6\S1/2;"` read `3'-6"` and a ties cell `10%%C @ 5{\H0.7x;\S1/2;}" c/c`
  read 5" centres — one tie in eleven the drawing never drew, on every column beneath it. The grammar's
  own table kept the fraction, but read `\P` as a `\p…;` setting wherever a semicolon stood later and
  deleted every word between them. `normaliseNotation`, the marks, the band and header readers and the
  note grammar stripped no MTEXT code at all, so a font-wrapped label `{\fSwis721 Cn BT|b0|i0|c0|p34;C-1}`
  closed up into one word and named no member — on the dissected real sets, one of the two reasons all
  222 member labels read as no mark (the other, a size written into the label, is the label reader's
  own work still to come) — and a paragraph code glued to `fy` or `LAP` hid the word. There is now ONE stripper, `withoutMtextCodes`
  (`src/core/entitygraph/notation.ts`), read in one pass so an escaped `\\`, `\{`, `\}` is the
  character itself and never a second code:
  (a) *A stacked fraction is a number.* `\Sa/b;` and `\Sa#b;` read `a/b`, set a space apart from a
  figure the reading before them ends in — after any code or brace between them is gone — so
  `3'-6\S1/2;"` is 3'-6 1/2" = 1079.5 mm and `5{\H0.7x;\S1/2;}"` is 5 1/2"; a fraction standing first
  (`{\H0.7x;\S5#8;}"`) reads `5/8"`. A tolerance stack `\Sa^b;` (and a raised or lowered figure,
  `\S2^;`, `\S^2;`) is not a fraction and is never read as one: it reads as its parts a space apart,
  set apart from a figure before it the same way — `150\S+5^-0;` is `150 +5 -0`, never 150 5, and
  `kN/m\S2^;` is `kN/m2`, as the sheet shows it. This is the ONE reading of a stack, for what a drawing
  means and for what it shows (the viewer's display reading, `src/core/entitygraph/text.ts` where it
  stands, reads its stacks, escapes and breaks here and keeps no table of its own); it amends this
  interpretation's first reading, which kept the caret (` a^b`) and set every stack apart with a
  space, because the sheet shows no caret and a leading space before a fraction that stands first
  is a space nobody drew. No real set dissected so far draws a tolerance stack.
  (b) *What says how a text is drawn goes; every word it says is kept.* Font (`\f…;`, `\F…;`), height,
  width, tracking, slant, colour (`\C…;`, `\c…;`), alignment (`\A…;`), paragraph settings (`\p…;`), the
  underline, overline and strike toggles, and the braces of a formatted group. A parameterised code
  crosses no backslash, brace or semicolon, so `\LSECTION A-A; SEE S-12` keeps its words. `\P`, `\N`
  and `\X` are line breaks; `\~` a space.
  (c) *A text with no backslash carries no code* and is read exactly as drawn, braces and all (I-330).
  An unclosed or unknown code (`\S1/2` with no semicolon) is kept as drawn: measure less, never a
  guess. A code point `\U+2212` is the character it names, read in the same pass, so a brace spelled
  `\U+007b` is a brace and never a group (the ingest's recover mode already decodes these; a raw
  reader does not); one that names no character (`\U+D800`) is kept as drawn. The `%%` control codes
  stay `resolveControlCodes`'s, after the stripper — the `%%nnn` character code among them
  (`%%176` is °, `%%216` Ø), which is a control code and so has its one home there too.
  (d) *Each text is read once.* A reader that wants a text's lines cuts the one reading at its breaks
  (`notationLines`); it never strips a stripped text again, where an escaped `\\` before a `P` would
  become a paragraph break the draughtsman never drew. The note clauses and the level words of I-410
  read that way.
  (e) *A mixed number's bar is no zone separator.* A two-zone ties call with a stacked half inch,
  `10%%C @ 4{\H0.7x;\S1/2;}"/6" c/c`, is 4 1/2" at the ends and 6" in the middle; read at the
  fraction's slash the cell was three parts and read nothing. A lone stacked fraction as a spacing
  (`@\S1/2;"`) is still split as a pair: it is the same shape as `@4/6"`, which this grammar reads
  as two zones, and nothing in the text says which the draughtsman meant.
  Every reader goes through it: `normaliseNotation` (so `normaliseMark`, the notation barrel's parsers,
  the levels proposal, the note grammar, and what this screen shows of a cell, a title, a band or a
  mark), `notationLines` (the note clauses, the level words of I-410), `mtextLines` (the schedule's
  lines, and what the viewer shows) and the grammar's `plainly`. The grammar's second table of MTEXT
  codes, control codes and diameter glyphs is deleted, and a source test holds the codes — a `%%`
  class or character code, a stack, a font code, a break or a code point — to one file. F-RCC6-BNBC's
  figures do not move: its six coded strings are three notes blocks, the S-06 header and footer
  (already cut into lines before any reader saw them) and the S-22 flight width — none a mark, a
  band, a schedule cell or a note figure. A probe of every reader over both fixtures' corpora moved
  answers on coded strings only: those six (their stripped text and lines; the flight width keeps its
  half inch), and F-ARCH's 38 coded room, level and opening labels, whose wrapped `W\PX H` opening
  sizes now read as the pair they state; the amendments in (a), (c), (d) and (e) and I-459's move
  no answer of any of 31 readers over either fixture's corpus. A stored cell, title or key made from a
  coded text reads its words rather than its codes on the next re-derivation (L-REG-04).
- **I-459 — a note is read after its codes; a figure is read in what the note states of it,
  never from under a fraction's bar (session 8, REAL-1; R-TO-034, L-MEA-01).** The note grammar reads
  each sentence through `normaliseNotation`, so `\Pfy = 415 MPa` proposes FY and `\PLAP 50d IN TENSION`
  a lap; the sentence a proposal cites stays verbatim. Reading the codes made three kinds of text
  readable that the grammar then misread, and each is closed:
  (a) *A figure never starts under a bar or inside a number.* A stacked fraction reads `a/b`, so no
  strength or multiple of d is read at a figure that follows a figure and a slash — the lower half of
  a fraction or a ratio — nor at a digit inside a number: `f'c = 4\S1/2; ksi`, `f'c = 4\S1/12; ksi`
  and `f'c = \S1/2; ksi` propose nothing, never 2 ksi, and `fy = 415/500 MPa` (two grades) proposes
  nothing rather than choosing 500 (it did before this slice; no fixture writes it). A figure after a
  slash that follows a word still reads (`60 ksi/415 MPa`, `50d/40d`).
  (b) *The lap's clauses.* The paragraph break the stripper leaves is a clause boundary for the lap
  (`LAP_CLAUSES`), as `\P` was, so a stirrup zone's `2d` on the next paragraph is never a lap. A slash
  between two figures is no clause boundary — it is a fraction's bar — so `LAP 40\S1/2;d IN TENSION`
  keeps its `40 1/2d` whole and proposes nothing, never 2d; a slash after a word still cuts
  (`40d IN COMPRESSION / 50d IN TENSION` reads 50d).
  (c) *A strength is read in what the note states of it.* FY and FC are read in each paragraph that
  names them, from the name to where the paragraph names the other strength: `NOTES:\Pf'c = 3,500
  psi\Pfy = 60,000 psi` proposes fy 60,000 psi, never the 3,500 psi before it, and `(fy=60 ksi,
  f'c=4.5 ksi)` proposes f'c 4.5 ksi, never 60. AM-03(f)'s preferences (fy in MPa where fy's statement
  restates it, f'c in psi) hold inside that statement. A paragraph naming fy with no figure of its own
  proposes no grade. On the dissected real sets this corrects four proposals (one a coded block this
  slice made readable, three a comma-joined pair the grammar already misread); F-RCC6-BNBC's note
  proposals are unchanged.
  Reading the mixed number as 4.5 is the note reader's to add with its clause binding (N1), not this
  reading's to guess.

The architect's schedules (session 8, ARCH-3). F-ARCH's door and window, wall-type and room-finish
schedules read nothing at HEAD: the three SCHEDULE views deferred SCHEDULE_NONE_RECONSTRUCTED and
WALL TYPES was UNTYPED. The nine readings below make all four tables stand, every cell cited, while
every stored table, family and deferral of F-RCC6 and F-RCC6-BNBC stays byte-identical (pinned in
`tests/takeoff/partition/arch-schedules.test.ts`; their placements, fed by those families, measured
byte-identical too).

- **I-502 — a key of types is a schedule (L-CAD-06, L-CAD-08, T-WALL-TYPES-CAPTION).** F-ARCH
  captions its wall-type table `WALL TYPES`, with no SCHEDULE, LEGEND or PLAN word, and the caption
  grammar answered UNTYPED, so the table never reached the reconstructor. Checked against the Edison
  convention before choosing: the owner's architectural set draws no wall-type table at all (its
  thicknesses are dimensioned on the plans, `0'-5"`, `0'-10"`), so recaptioning the fixture
  `WALL TYPE SCHEDULE` would have fitted the drawing to the product. The grammar learns the word
  instead: a caption saying `TYPES` and naming no projection (PLAN, LAYOUT, SECTION(S),
  ELEVATION(S), DETAIL(S)) is a SCHEDULE, read after the SCHEDULE word and before LEGEND. Only the
  plural: `TYPE` alone captions a unit type's plan as often as a table. F-ARCH's manifest now expects
  SCHEDULE for that view (a `baseline:` commit). Neither structural fixture captions a view TYPES.
- **I-503 — an architect's schedule heads its key column with what its rows are, and that word
  heads a column only beside another (L-CAD-08, AC-1).** `isMarkHeader` read MARK, MEMBER,
  DESIGNATION or a qualified member word, and every real opening schedule failed it: a door and
  window schedule heads each typed sub-table's mark column with the TYPE it lists (`MAIN DOOR`,
  `FLUSH DOOR`, `WINDOW WITH SUNSHADE`, `VENTILATOR`, `LOUVRE`, `GLASS DOOR`), a finish schedule its
  key column `ROOM`, a key `SYMBOL`. Those words — the kinds of opening (DOOR, WINDOW, VENTILATOR,
  LOUVRE/LOUVER, GLASS), ROOM and SYMBOL, singular or plural — now head the key column. `OPENING` is
  deliberately not one: F-RCC6-BNBC's lintel schedule writes it in a head and in its rows. Alone on its
  line the same word titles a group (`DOOR`, `WINDOW & VENTILATOR`) or the table (`ROOM FINISH
  SCHEDULE`), so a band whose ONE text names the key column by a key word alone and names one column
  is no header; a band stating another column beside it is (`SL. | MAIN DOOR | SIZE (W x H) |
  QUANTITY`). A band holding any such head — a sub-table's repeated header, a group's title — is a row
  of its own and is never claimed as a line of the nearest mark's row (the stacked reading, I-294):
  claimed, FD-1's row read `FIRE DOOR+FD-1` as its mark. MARK heads its column wherever it stands.
- **I-504 — an MTEXT stands where its attachment puts it, and the lines of one text in one cell
  are one statement (T-MTEXT-CODES, L-CAD-05, L-CAD-03).** I-330 hung every MTEXT's lines from its
  insertion point. An architect centres each cell's MTEXT in its cell (attachment 5), so a size
  wrapped over two lines — `4'-0"` over `X 7'-0"` — dropped its second line 200 below the row into a
  band of its own. The lines now stand where the attachment puts the block (EntityGraph v3 carries
  it): hanging from a top attachment as before, centred on a middle one, standing on a bottom one; a
  text stating none hangs, as every v2 artifact did. Lines of ONE text that land in one cell are run
  on with a space and cited once (`4'-0" X 7'-0"`, cited `6AD`); two TEXTS in one cell still join with
  `+` (AC-2). So do the lines of one text that are STACKED statements — each line alone a statement
  of the notation and the lines together not one: a structural MTEXT putting `4-20Ø` over `2-16Ø` in
  one rebar cell reads `4-20Ø+2-16Ø`, both groups, as before (run on it read as nothing), while the
  wrapped size's `X 7'-0"`, a length alone, runs on because together the lines read as the size, and
  a line of prose reads as nothing alone and runs on. Both structural fixtures' MTEXT schedule blocks
  are top-attached and do not move.
- **I-505 — the openings are marks; their class is placement's (L-CAD-07, T-MARK-SPELLING).** The
  notation roster gains the opening families D, W, V, SD, FD and GD and the word mark LD (the lift's
  landing door), as a closed opening subset. `D` stops being read as a detail bubble's series letter:
  the roster is the evidence, and a door schedule's `D-2` and the plan's circled `D2` are one door. A
  word mark names an opening only where the roster says so, so `LD` names nothing structural. The
  registry mints each opening row as a family; D/W/V → the opening CLASS is ARCH-4's (placement), so
  no opening is placed, measured or billed by this, and no quantity line moves. Zero-padded marks
  (`W-01`) read as W1 in the grammar table; the registry's comparison form (`normaliseMark`) does not
  fold them yet — neither fixture writes one, and that function is the MTEXT stripper's this wave.
- **I-506 — an opening schedule's rows claim the floors its caption states, and carry their size
  as the section pair (L-MEA-02's floor-group scope, I-409, L-FRM-02).** An opening schedule (its key
  column headed by an opening type, or headed `MARK` over rows every one of which names an opening —
  one structural mark among them and the table is a member schedule) states its floors in its caption: `DOOR & WINDOW SCHEDULE (1ST TO
  6TH FLOOR)`. The caption is read by the one home of a caption's level set (`levelRunsOf`, I-409),
  and each run is a variant of every row — `1ST-6TH`, `GF-GF` — its band text the title (the Band cell
  says `1ST TO 6TH`, I-436), the caption cited beside the size cell. A caption stating no floors
  leaves the row read as before. The size is the SIZE (W x H) cell read as a pair, first side the
  width and second the height as the head names them (D-1: 48 × 84 in). LD's `900 X 2100` states no
  unit and nothing on the sheet states one — the drawing's header unit is its geometry's, never a
  text's — so it stands 900 × 2100 with no unit, and a rail binding it must refuse it by name. A SILL
  column (`SILL`, `SILL HT.`, `SILL HEIGHT`, `SILL LEVEL`) is read as the `sill` dimension in a
  schedule of openings; F-ARCH prints none. The ground floor's and the typical floors' schedules both
  name D2: the family keeps a variant under each schedule, each on its own floors. I-331's "a family
  two schedules name binds nothing" was written for one member stated twice; placement (ARCH-4) must
  read an opening family's variants across schedules whose floors do not overlap before it binds one.
- **I-507 — the printed quantity is a cited reading, and a disagreement with the plan is DECLARED
  (L-MEA-02, L-CAD-08, T-OPENING-NOS).** An opening schedule's QUANTITY column (`QUANTITY`, `QTY`,
  `NOS`) prints `08 NOS`. It is read as what the schedule SAYS — never a member count, and never in
  the member-type registry: `schedule_printed_quantities` holds the cell, the number, its basis and
  the check, beside the variant it was printed for, and nothing bills it. The basis first: a caption
  naming one floor states it (per floor and per group are one statement), else a text of the table
  stating `PER FLOOR` does (`NOTE: QUANTITY PER FLOOR.`, cited); a schedule stating neither — over
  several floors, or under a caption naming no floors at all — is declared
  `OPENING_QUANTITY_BASIS_UNSTATED` and compared with nothing, its message claiming no floors the
  drawing did not state. Then the
  check — the plan is L-MEA-02's declared cross-check and the schedule the authority: where exactly
  one layout plan of the same drawing states the same floors, its tags of the mark (in the comparison
  form, so `D2` meets `D-2`) are set against the printed number. Equal, and the reading stands;
  unequal, and the row is declared `OPENING_QUANTITY_DISAGREES`, the cell and every tag cited, and
  neither figure taken — which is right is a person's statement, and nothing is measured off the mark
  until one is made (the act, and the block on the faces it opens onto, are the opening lane's). No
  plan of those floors, or two, and the reading stands unchecked with no plan cited. On F-ARCH the
  typical schedule prints D-2 `08 NOS` against nine D2 tags on the typical plan — declared; every
  other row of both schedules agrees with its plan.
- **I-508 — a thickness is read, and a bracketed restatement settles a bare figure's unit
  (L-MEA-01, I-302).** A THICKNESS (or THK) column states the thickness of each row's member, read in
  any schedule as the `thickness` dimension — stored, and bound by nothing until a method declares
  one (I-322). F-ARCH writes `250 (0'-10")`: a figure and its conversion to the lettering's
  feet-inches. The figure before the bracket GOVERNS — the bracket is rounded, and 10" is 254 mm where
  the wall is 250 — and the bracket settles its unit: of the schedule's units (in, mm) exactly one
  makes the figure round to the restatement (250 mm is 9.84" → 10"; 250" is not), so BW250 is
  250 mm and BW125 125 mm, cited to the cell. Two units fitting, or none, settle nothing: the figure
  keeps no unit and stores no row. `RCC | SEE STR.` states no thickness and names no family.
- **I-509 — a ROOM-keyed schedule is a schedule of rooms.** F-ARCH's ROOM FINISH SCHEDULE is
  reconstructed and stored cell by cell, every cell cited (`ROOM | FLOOR | SKIRTING | WALL | DADO |
  CEILING`, six room groups; its two notes stand as the table's unplaced texts). It names no member
  type, and that is its reading rather than a view that contributed nothing: it defers nothing.
  Which face bears which finish, to what height, is read off these stored cells by the finishes lane
  when it binds them, never restated beside them (B-17).
- **I-510 — a declared quantity check stands beneath the tables it was read off (R-UI-050,
  R-UI-020, I-251).** On the sheet holding an opening schedule, each row whose printed quantity is
  declared stands beneath the reconstructed tables, after the deferrals: the mark and the printed
  cell as the schedule shows them, in mono, then the one RefusalState with its registered message and
  remedy, its evidence **Open the plan** selecting the cell and the plan's tags of that mark in the
  viewer (**Open the sheet** where no plan was checked). The sheet reads `partial` while one stands.
  Nothing is counted on the screen: the number is the schedule's own cell, verbatim, and the tags are
  evidence behind the link, never a figure beside it. In the registry pane a mark two schedules name
  — D2 in the ground floor's door schedule and in the typical floors' — is said ONCE, its bands from
  the ground up (`GF`, `1ST TO 6TH`) as a column family's are (I-353(a); `familiesViewOf`): two `D2`
  rows would read as two door types and stood two families under one key. Grouping only — every
  variant is the store's; neither structural fixture names a mark twice, so their panes do not move.
- **I-550 — a schedule stands on the sheet that shows it (session 9, C6b; L-CAD-05, L-CAD-06,
  I-248, R-UI-022).** Walk-0 and walk-1 found the screen opening on **Model space** with all seven of
  F-RCC6-BNBC's schedules stacked there, ROOF BEAM SCHEDULE first, while the row a QS clicks for the
  column schedule — S-11 COLUMN SCHEDULE — said only that its notes read no figure. A schedule is cut
  out of model space (L-CAD-06), but a reader reads it on the sheet that prints it. Each stored table
  now stands on the sheet its TITLE stands on where that is a paper sheet, else on the sheet the
  caption its view was anchored on stands on, else on model space where it was drawn — and "which
  sheet a key stands on" is core's one reading (`sheetOfKey`, `src/core/sheets/frames.ts`): a key drawn
  on paper stands on its paper, a key drawn in model space on the ONE sheet whose windows frame it
  (VD-1). A deferral stands where its view does; a mark family with the table that named it; a
  long-section strip family (I-343) on the sheet its strip's title stands on. The reading is taken over
  the record the schedules were read on (`sheetsOfReading`, `src/modules/takeoff/schedules-ui/attach.ts`).
  On BNBC that is seven schedules on six sheets — S-05 PILE, S-06 PILE CAP, S-11 COLUMN, S-18 the two
  ROOF BEAM, S-25 LINTEL & SUNSHADE (deferred), S-26 the sample BAR BENDING (deferred) — and none on
  model space; the families stand on S-05, S-06, S-11, S-16, S-17 and S-18. A cell's trace now opens
  the sheet the table stands on, where the viewer selects the model entities that sheet's window
  frames (viewer I-290). **I-248's rail rule is read by what the screen can show**: a sheet is a row
  where it holds a schedule, a deferral, a mark family, a figure its words propose or a committed
  reading. A title block is words, but none of them is anything this screen reads, so the 28 rows
  that listed every layout of BNBC are twelve: S-01, S-02, S-03 (notes), S-05, S-06, S-11, S-16, S-17,
  S-18, S-25, S-26 and model space (its own words propose four figures). Rejected: moving the store's
  rows onto paper layouts (L-CAD-06 cuts views out of model space, and the store is the partition's);
  a text-on-paper reading of captions (it misses every schedule captioned in model space, which is
  five of BNBC's seven).
- **I-551 — the order a QS reads in: paper by number, model space last, a sheet's schedules
  foundation-first, and the page opens on the first schedule (session 9, C6b; I-248).** The rail keeps
  the record's own order for its paper sheets — the order the set numbers them — and puts model space
  after them: it is the draughtsman's workspace, no sheet a reader opens, and the row a reader should
  come to last. On one sheet the schedules stack in the order a quantity surveyor takes a structure
  off: the foundations from the bottom up (pile, pile cap, footing, grade beam), then columns and
  walls, then beams, slabs, stairs, lintels, masonry, openings and surfaces, by the first class the
  title names (`classesDeclaredBy`, `src/core/residue/declared.ts` — the one closed word table); two of
  one class keep the store's order, and a title naming no class stands last. Until a reader chooses a
  row, the page stands on the first sheet holding a schedule — what a reader came to this screen for —
  and on the rail's first row where no sheet holds one. Presentation only: no stored row, key or
  figure moves.

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
│  │        │ Member types           one grid · rows at --row-h     │         │
│  │        │ Mark  Band     Section   Zone                         │         │
│  │        │ ▣ C1  GF–L3    300x450   Main 8-T20  Ties T10@150 c/c │         │
│  │        │       L4–ROOF  300x300   Main 6-T16  Ties T10@150 c/c │         │
│  │  200px │ ▣ C2  GF–L3    300x600   Main 6-T25+2-T20 …   240 px  │         │
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
| sheet rail (`schedules-sheets`) | one `schedules-sheet-row[data-drawing][data-layout]` per sheet of the pinned revision holding a schedule, a deferral, a mark family, a proposed figure or a reading — each schedule on the sheet that shows it, paper sheets in the record's order and model space last, the first sheet holding a schedule chosen until a reader chooses (I-550, I-551): sheet name in 13 px (min `6ch`, ellipsis) — the model space said **Model space** through `EnumLabel`, its layout name on `data-layout` and the tooltip (I-353) — and what it holds as muted words that yield first (the name `flex: 0 1 auto`, the holdings `flex: 1 1 0`, end-aligned, I-sch-1(b) as amended); the drawing `IdChip` once beside the heading where every sheet is one drawing's, else on each row (I-sch-1) | `flex: 0 0 var(--drawer-w)` 200 (min 160, max 320); rows `--row-h` 28 | `--surface-panel`, `--hairline`, `--ink-muted`, `--text-caption`, `--surface-selected` | the rail is absent only in `empty`; otherwise it always has a row |
| schedules region (primary) | the one scrolling frame `schedules-grid[data-rows-rendered]` (I-288), holding `schedules-table[data-schedule][data-rows-rendered]`, one per stored schedule, stacked with `--gap-section`; each a DataTable v2 titled by its stored title. Or `schedules-deferral`. Beneath the tables and deferrals, one `schedules-quantity-check[data-family][data-variant][data-code]` per opening row whose printed quantity is declared: its mark and printed cell in mono, then the one RefusalState (I-510). Or `schedules-notes` on a notes-only sheet | `flex: 1 1 auto`, min 320; ≥ 55 % of main; rows `--row-h` 28, header 28 sticky, first column frozen | `--surface-app`, `--surface-sunken` (header), `--ink-code`, `--font-mono`, `--cell-px/py`, `--basis-transcribed` through EvidenceLink | never silent: a deferral or `NOTES_NONE_PROPOSED` stands in its place |
| registry pane (`schedules-registry`) | ONE grid of named tracks — Mark, Band, Section, one per rebar zone, then the rest — headed once by `schedules_registry_mark` · `_band` · `_section` · `_zone` in a row pinned to the pane's top (I-353); `schedules-family[data-family]` a subgrid whose mark stands in the Mark track of its first row, `schedules-variant[data-variant]` one `--row-h` row each beside it, `schedules-zone[data-zone]` in its zone's own track; nothing wraps, a long cell ellipsises and the Section carries its Tooltip; all text as the drawing shows it (I-sch-1); a Band says its band face — the band as written, or its ends (`1ST`, `2ND TO 6TH`) with the sheet title it was read off in its Tooltip (I-436); an unbanded variant's Band `—`; zones through `EnumLabel` on the mono text's baseline; marks in natural order, bands from the ground up (I-353); no count (I-251) | `flex: 0 0 240` (200 below `lg`); collapses to 28 with the inspector (I-249); scrolls alone | `--surface-panel`, `--surface-sunken`, `--hairline`, `--ink`, `--ink-secondary`, `--ink-muted`, `--font-mono` | the pane stands and states `schedules_registry_none` |
| notes panel (`schedules-notes`) | the three sections of I-253 and the one `schedules-transcribe`. A proposal row carries `data-proposed-by`; a model's (I-296) leads with `schedules_proposal_proposed_by_model` and a row a model judged the lap's standing on trails with `schedules_proposal_lap_governs` and its probability in mono | inside the schedules region; sections separated by `--gap-section`; rows `--row-h` 28, a model's caption and the governs line `--text-caption` inside the same row | `--surface-app`, `--hairline`, `--ink-code`, `--ink-muted` (`cx-schedules-proposed-by`, `cx-schedules-governs`), `--warn-surface` through RefusalState | one RefusalState, `NOTES_NONE_PROPOSED`, and no act door |
| inspector (frame's one slot) | `schedules-inspector`: the selection's heading, its source keys as `IdChip`s under `schedules_inspector_sources_label`, its kind / basis / acceptance as `EnumLabel`s, and its one EvidenceLink | `--inspector-w` 320 (280–480) | `--surface-panel`, `--hairline`, basis palette through EvidenceLink | **absent — width 0**, never a sentence |

**Cells.** Schedule cell: one EvidenceLink, 12 px mono, TRANSCRIBED blue rule and ▣ glyph, label
verbatim as the drawing shows it (control codes resolved, I-sch-1), no wrap, ellipsis plus the
table's own Tooltip (§5 rule 2); a column of bare figures right-aligned. Standing row: the kind through
`EnumLabel`, the standing through `EnumLabel` (*Agreed* / *Suspended* / *Not read*), the canonical
right-aligned mono with its unit as a muted `UnitBadge` — empty unless AGREED (I-253). Reading row:
kind, canonical (through the format seam) + unit, the unit said once (I-437), the acceptance word, one EvidenceLink on `data-source`; `data-superseded`
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
  deferral, a declared quantity check (I-510) or a standing that reads SUSPENDED: those rows and sections stand where they belong with
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
types** · `schedules_registry_mark` **Mark** · `schedules_registry_band` **Band** · `schedules_registry_band_span` **{from} TO {to}** ·
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
main **Main** · ties **Ties** · ties-end **End ties** · ties-mid **Mid ties**. The model space renders
as words the same way in the sheet rail (I-353): model **Model space**. The three standings render *Agreed* / *Suspended* / *Not read*;
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
| `OPENING_QUANTITY_DISAGREES` | warning | inline | **The schedule prints a different quantity of this opening than its plan tags, so neither figure stands.** | **Open the plan and check its tags for this mark against the schedule's row — a person states which is right, and no quantity is taken from either until then.** | **Open the plan** |
| `OPENING_QUANTITY_BASIS_UNSTATED` | warning | inline | **This schedule does not say whether its quantities count one floor or every floor it applies to.** | **Read the sheet's notes for the basis of its quantity column — a quantity whose basis is unstated is never multiplied by the floors or compared with the plan.** | **Open the sheet** |

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
reconstructed schedule's columns are not known to this file. The rail row's two texts share its
width by flex alone and no literal: the name `0 1 auto` (floor `6ch`), the holdings `1 1 0` (floor
0, `text-align: end`), so the holdings yield first (I-sch-1(b) as amended). **No copper appears anywhere** except
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
(`data-permission`) · `schedules-inspector` · `schedules-empty` · `schedules-quantity-check`
(`data-family`, `data-variant`, `data-code`: a code of `PRINTED_QUANTITY_REFUSAL_CODES` — I-510); plus
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

Suites: `tests/takeoff/partition/arch-schedules.test.ts` (I-502…h over F-ARCH's own drawing,
read by the shipped CLI: every schedule row of the generator's model read with its cited cells,
T-OPENING-NOS declared, and the schedules stage of F-RCC6 and F-RCC6-BNBC byte-identical; on
hand-built tables, a stacked structural MTEXT read by the sign, a MARK-headed schedule of openings,
and a caption naming no floors declared), `tests/takeoff/partition/notation/grammar.test.ts` (the
quantity column read as the grammar's count form, one reading),
`tests/takeoff/partition/schedules/arch-schedule-store.db.test.ts` and
`db/__tests__/schedule-printed-quantities.migration.test.ts` (the same reading through the store,
and migration 0063 judged by what it does), `tests/takeoff/notation/corpus.test.ts` (F-ARCH's 454
strings in the notation ratchet), `tests/ui/takeoff-schedules/quantity-check.test.ts` (I-510: the
shipped workspace mounted over a declared row), `tests/takeoff/notes/**` (the grammar, the act pair, `noteStanding`,
`appliedDetailingValuesOf`, the doors each refusing by name, and `copy-mirror.test.ts` failing the
build if the module's `copy.ts` and `src/ui/strings/schedules.ts` ever differ),
`db/__tests__/notes-readings.migration.test.ts`, `tests/ui/craft/mechanical.test.ts` over
`schedules.css`, `tests/ui/takeoff-schedules/band-order.test.ts` (I-353(a), over the grammar's own
band readings), `tests/ui/takeoff-schedules/band-face.test.ts` (I-436, over the band texts the
registry stores and the readers that banded them) and `tests/ui/takeoff-schedules/registry-rows.test.ts`
(I-353(b)(c), I-436/b and I-sch-1(b) as amended: the shipped workspace mounted, the sheet's registry
and rail rules read, the rail row's flex rule resolved over widths; I-551: the page opens on the first
schedule sheet), `tests/ui/takeoff-schedules/sheet-attach.test.ts` (I-550/b over F-RCC6-BNBC read by the
shipped CLI and the partition's pure stages: seven schedules on six sheets, the twelve-row rail, the QS stack). Journey: `tests/e2e/schedules.spec.ts` (describe title carrying `J-032`) over
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

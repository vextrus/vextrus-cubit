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
  number of members* (PAID by I-534, session 8, the owner's ruling Q3) — identical members of one mark on one floor are listed separately, so half the
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

- **I-413 — a column's top joint is read as a LOWER BOUND off the framing the partition placed,
  never as the joint (session 8, 2026-09-23; R6b-1, the owner's ruling A′ on the ties).** BNBC 2020
  §6.4.9.2 carries the column's ties through the joint "for a depth not less than that of the deepest
  connection", and no schedule states that depth. The store already holds the association:
  a beam's run is cut clear at the faces of the members carrying its ends and cites each one's outline,
  stored whole as `placement_runs.clear_source_keys` (`supportedSpan`). So the joint seam
  (`src/modules/takeoff/measure/joints.ts`, pure, no migration) reads a column at level L's top joint off
  the framing members (beam, tie beam) registered on the NEXT level up the stack by ordinal (L-MEA-07),
  never by label, whose run's WHOLE citation list names the column placement's `outline_key`. It is
  never the first atom only: `RunSetup.clear.source` is a run's own edge line and never names a column.
  And a run's citations are local to its drawing: a run cites the keys of the one artifact its plans
  were read from (`detectRuns`), and an outline key is a bare DXF handle, unique inside one drawing and
  nowhere else. So a framing member frames a column only where both were placed off the same record
  (`ingestId`), and a member the setup holds no placement for names no drawing and frames nothing. The
  adversarial review of R6b-1 found this: a probe with two ingests sharing the handle `DXF_HANDLE:984`
  read a foreign 900 girder where 450 was true, which would put the bound OVER the joint. Stored data
  already carries such collisions: in the two-drawing project 0e76f5a5, 240 run citations of each
  drawing equal the other's column outline keys. The two drawings are copies of each other, so no
  over-read has happened yet. The check keeps each drawing's own 240 there and drops the other's 240,
  and it loses no match on J-000's project: all 119 of fe67f2bc's citation hits are same-record.
  Each member's depth is its schedule's section depth at the framing's own level, through core's
  `variantCovering` and never through the frame rail's `sectionOf` (L-MEA-08). It is carried as written
  (TRANSCRIBED, cited to the cell) beside the canon's millimetres, and the deepest is compared on the
  millimetres. A member whose depth refuses is listed with the frame rail's own code for the same absence
  and leaves the bound standing. The standing is **BOUNDED** (D_lo, the deepest read) and never
  RESOLVED: the store holds the members the partition PLACED, not every member the drawing frames a joint
  with. TG1, the axis-y beams and CB1–4 wait on FRM-3; EB2 and PB wait on D13. The true depth is
  therefore at least D_lo and nothing says it is no more. RESOLVED waits on a framing census (after
  FRM-3), and "no framing seen" is never that census. Proved on F-RCC6-BNBC against an oracle derived
  from `fixtures/rcc6-bnbc/model.json` (the model's own `storey` and `supports`). No bound is ever over
  the model's deepest member. B3 at GF reads 450 under TG1's 900, less and said so. Staging the placed
  subset reproduces session 8's stored read-back: 24 bounded at GF and 25 at each of 1F–6F, C1/C2 600,
  C3–C5 450, every column 400 under the roof, A1 at GF bounded by 1B1 at 600. Recall is bounded too:
  a column is matched only where a beam's run cites the very placement its register row points at.
  `faceAt` prefers the supports the beam's own plan drew, so on a drawing whose framing plans draw and
  place their own column outlines the runs cite those outlines, and the joints read UNREAD FRAMING. That
  is under and never over. R6b may widen the match to the grid address inside one drawing. The depth
  read repeats the frame rail's `sectionOf` step for step: the family, its variants, `variantCovering`,
  the first cell, the unit. That is a second copy of one reading (B-17). R6b retires it by moving one
  `sectionAt` into `core/offers/contract` for both to call. Until then there is one difference: a joint's
  depth does not refuse where only the width is unstated. Rejected: RESOLVED on what was placed (N(D)
  is not monotonic, so a joint read too shallow can over-count ties); the frame rail's `sectionOf`
  (rails share only setup); widening `RunSetup` here (R6b binds the seam into the setup, and
  `contract.ts`/`setup.ts` have one writer in sequence).
- **I-414 — an unread joint names what was not read, for what is true of the drawing, and never
  says the joint is unframed (session 8, 2026-09-23; L-QTY-04).** A joint with no bound stands UNREAD
  and names what was not read in one word (`unread`). These are the seam's own words and not refusal
  codes: the rail that binds the joint registers the code it omits under (R6b), and a
  SCREAMING_SNAKE word would be a code Q-07 does not hold. **LEVEL**: the stack holds no level above
  the column's. The roof stubs C4 at C2/D2 are framed on the stair-room roof, which is no level until
  LEV-2 (the model frames them at 375). That reading is proved on the model-staged register only. The
  product's register holds no roof stub today: fe67f2bc reads 208 columns, FDN to 6F, 26 a storey. So in
  the product, LEVEL answers only for a column topping the stack or standing on no live level.
  **OUTLINE**: no outline is held for the column, so no run can be found citing it. **FRAMING**: the
  level above stands and nothing placed on it off the column's own drawing cites the column. The
  FDN necks are framed by grade beams carried on the caps; C6 is framed only by the slanted EB2/REB2;
  C7 by the porch beams. **DEPTH**: members cite the column and none of their depths could be read,
  each listed with its code. Rejected: "absent", "none" or "unframed". Each would state a fact about the
  building that nobody read, and a later reader would take it for a free-standing post.

- **I-534 — a mark is stated once per floor with its number of members, and the door counts them
  from the members the register placed (session 8, 2026-09-24; the owner's ruling Q3, BS 8666; pays
  I-354(d)).** A bar schedule states a mark once, with its number of members and the bars in each.
  This screen listed every member of a mark as its own group, so F-RCC6-BNBC's C2 at 1F stood as eight
  identical groups over one bar each, and the J-000 campaign's 208 columns made a grid past the
  DataTable's 200-row virtualisation threshold (`data-table.tsx`), which is what blocked a whole-schedule
  read. It is ruled here, and the Decision is amended in place to match:
  (a) *The door counts, and it counts at the member.* `scheduleOf` (`src/modules/takeoff/rebar/
  store.ts`), which `bbsOf` answers its lines through, puts the members of one (level, class, mark)
  whose BAR SETS are identical into one entry, and states each bar of that set as one line. A bar set is
  everything each bar is, is cut to and weighs: its mark, role, diameter and shape, its legs, its three
  lengths, its split and laps, the count one member takes, its rate and its masses. It is also what the
  bar was READ from: the schedule cells, the storey height, the detailing notes and the edition. It is
  never which member the bar belongs to. The evidence is in it because a merged line would cite one
  reading for bars another stated, and a line cites what it was read from (L-QTY-03). Two readings are
  therefore two entries of one mark: longer, never wrong. A line's `parentCount` is the members'
  counts summed (the rail writes one per member, so it is the number of members). Its `bars`, `kgNet`,
  `kgLap` and `kg` are the members' own stored figures summed exactly, never rounded (L-QTY-05, B-07).
  Its identity (`barKey`, `objectKey`, `semantic`, the source keys) is its first member's in reading
  order, and `members` names every member it counts, the first one first, so no member is lost from
  the record (L-REG-02). A member alone in its entry is its stored rows verbatim. This is computed from
  the PLACED members one by one, so it infers nothing about a member nobody placed (L-CAD-08).
  (b) *No total moves.* `perDiameterKg`, `perMarkKg`, the grand total and the cutting stock are still
  taken off the stored rows, member by member. An exact sum grouped is the same exact sum.
  (c) *What the stored ground groups to.* In J-000's stored campaign (cubit_e2e, project 5d236653,
  read back by `db_read`), every one of the 48 (level, mark) pairs of its 208 column members holds one
  bar set under this identity, so the schedule states 48 entries. Examples: C2 × 8 and C4 × 7 on every
  storey, C1 × 3 from FDN to 6F. The grid then stands at three rows an entry at most (group, bar,
  lap), under the 200-row threshold. In the rebar stage of the database suites every staged member
  reads its own cells (`#<member>.main`), so nothing merges there, and the grouping is graded over the
  golden roster and synthetic members instead (`tests/takeoff/bbs-ui/schedule-lines.test.ts`).
  (d) *The screen says the count once, where the entry is named.* The group row is one per ENTRY and
  reads `1F · Column · C2 · 8 members` (`bbs_members_one`, `bbs_members_many`, the figure through
  `formatUserFigure`). It carries `data-member` = the entry's first member and `data-members` = the
  count, still with no mass (I-bbs-2). The Bars cell states the TOTAL a site cuts. On a line counting
  more than one member, what one member takes is a Tooltip on it (`bbs_bars_each`, BS 8666's "No. in
  each"). Rejected: the `No. of members` column I-354(d) planned. Ten columns already fill the 1280
  band to Dimensions' floor (§1: 960 fixed plus a remainder of at least 200 in 1,184), and an eleventh
  would push Mass off it (R-UI-080). The count is one figure per entry, and the group row is where an
  entry is named.
  (e) *J-032 is amended with it.* Its "one group row per member" read is now one group row per entry,
  and the counts the group rows state sum to the members the door's lines name.
  Rejected: counting in the presenter (a count is a figure, and a figure is the door's, I-bbs-2);
  grouping on the bars alone (it merges two readings under one citation); and a grid address on each
  entry, which is I-354(e)'s, still held by the rail, the partition and `db/**`.

- **I-535 — the issued schedule is a document a site can sign: written in words, sized by what it
  holds, and set out as BS 8666 sets one out (session 8, 2026-09-24; walk-0's BLOCKS_DEMO B17,
  A-BBS-PDF, AM-05, R-UI-082, L-FMT-01).** Walk-0 read the 42-page PDF of J-000's campaign. Every member
  heading printed its raw register key after a lowercase enum (`C1 column FDN v:LAYOUT_PLAN:
  DXF_HANDLE:…|C1|…@22e5d87d-…`). The header block printed a campaign uuid and a revision uuid. The
  column heads were shouted (`upper`) and set into fixed widths too narrow for them, so two ran together
  (`CUTTINGROUNDED`). The Rounded and IS figures overprinted (`3,050` and `3,048.000` read as
  `3,050,048.000`). The stock bar and its rounding carried no unit. The kind and its template are now
  re-cut, and the document is amended in place to match:
  (a) *Entries, not members.* The payload is `schedule`: one entry per mark on a floor, as the door
  counted it (I-534), each with `members` and its `bars`. Each bar states BS 8666's "No. in each"
  (`barsPerUnit`) and "Total no." (`bars`). The page heads an entry `C2 · Column · 1F`, with
  `8 members` beside it. It is a table SUBHEADER (`table.header(level: 2)`): an entry that runs onto
  the next page is headed there again, and a heading is never left alone at the foot of a page.
  (b) *Words, never keys.* The payload carries no campaign id, revision id or register key, and the
  strict schema refuses one. `present()` says a class and a role through the draft's own one rule
  (`inWords`, `boq-draft-law.ts`: `shear_wall` → `Shear wall`, `MAIN` → `Main`), and a lap line reads
  `Lap`, not `LAP`. The shape codes stay as codes (I-bbs-6), and the floors' labels are model data.
  (c) *The particulars, in words.* Beneath the title stand the project (with its code), the client
  and the site as the project records them, or `Not recorded`. Beside them stand the drawings, the
  day of issue and what the bars are cut from. The drawings read as the set's own name, WHICH of its
  pins the campaign measured (counted from the first in the store's write order, `appendSeq`) and the
  day it was pinned: `Structural drawings, revision 2, pinned 22 Sep 2026`. The cut-from line reads
  `Stock bars of 12,000 mm; each length rounded once, up to the next 25 mm`. Every day is written by
  the format seam's `formatDate` from wall-clock parts the job read (`bbsParticularsOf`,
  `src/modules/takeoff/bbs-ui/server.ts`). The template asks no clock (R-SPINE-040). Every page's
  footer names `<project> · Bar bending schedule`, so a leaf separated from the rest still says
  whose it is.
  (d) *Widths from what the columns hold.* The schedule is ONE table on an A4 leaf turned landscape,
  its column band repeated on every page. Every column but the legs is `auto`, as wide as its widest
  cell, header or figure. The legs take the `1fr` slack and are the one cell that may wrap. No figure
  is ever set into a column narrower than itself. The heads read as written, units in lower case:
  `Bar mark · Role · Dia (mm) · Shape · Dimensions (mm) · Cutting length (mm) · Rounded (mm) · IS
  additive (mm) · In each · Total · Mass (kg)`.
  (e) *A sign-off the site completes by hand.* The last page carries `Prepared by` and `Checked by`
  boxes, each with Name, Signature and Date lines, and the sentence `Completed by hand. This schedule
  is a draft: it names no surveyor and certifies no quantity.` The product fills none of it. It names
  nobody, states no credential and claims no certificate, so AM-05's draft stands. `DRAFT — UNSIGNED`
  still heads every page.
  (f) *The shared chrome is the frame's.* `documents/base/frame.typ` gains two partials,
  `particulars-block` and `sign-off-block`, and two parameters of `document-frame`, `landscape` and
  `running-title`. All four are additive, and every default is what the frame did before. The draft
  BOQ's and the proof's goldens are byte-unchanged (V-DOCS), and the draft's front page may call the
  same partials. The file a reader downloads is named in words too (s-documents I-537).
  Rejected: a grid address in each heading (`C1 · Column · FDN (grid A/1)`). An entry counts several
  members, which stand at several intersections, and the intersection is I-354(e)'s placement label,
  which no bar row carries. Also rejected: fixed column widths re-tuned wider (the next longer figure
  overprints again); per-entry tables with their own heads (the repetition I-bbs-9(a) removed from
  the screen); dropping the watermark (the frame's, shared with the draft BOQ; the schedule's figures
  read through its veil); and filling `Prepared by` with the exporter's name (a person named on a
  draft is the responsible surveyor AM-05 bars).
- **I-536 — the issued schedule says what it leaves out, as the screen does (session 8,
  2026-09-24; L-QTY-02, L-QTY-07, walk-0's "the BBS PDF states no omission at all").** Where any
  `rcc.rebar` line under the campaign stands partly declared, the payload's `partial` is true and its
  `leftOut` carries each omitted code once. It carries the components in the copy table's words
  (`BBS_COMPONENT_SAID`, the same words the screen's `Left out of this schedule:` list says) and the
  refusal register's own message. The page closes with a `Left out of this schedule` block, and the
  cutting stock's total carries `Measured scope only` beside it. A code the register does not hold is
  left off exactly as the screen leaves it off. A whole schedule says neither. Rejected: a caveat on
  every page (the banner is the one running statement), and the codes themselves (R-UI-082).

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
│  │ ▾ GF · Column · C1 · 3 members                                               │ group
│  │ C1v    │ Main │ 00 │  20 │ A 3 450      │ 3450.000│   3450│3450.00│  6 │ 51.0│ 28 NET
│  │ ↳ Lap  │  —   │ —  │  20 │ Lap 1 000 mm │    —    │   —   │   —   │  6 │ 14.8│ 28 LAP
│  │ C1t    │ Tie  │ 51 │   8 │ A 300 · B 450│ 1638.400│   1650│1672.00│ 42 │  4.1│
│  │ ▾ GF · Column · C2 · 8 members                                               │
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
| grid (primary) | `bbs-grid` (DataTable v2, `tableId` `s-bbs-bars`, `aria-label` `bbs_grid_label`, `data-rows-rendered`): one `bbs-member` group row per ENTRY — one mark on one floor, named by its first member's `objectKey` and stating its number of members (I-534) — in `document.rows` order, the door's reading order from the ground up (I-354), then its `bbs-row` (NET) rows each optionally followed by one `bbs-lap` | `flex: 1 1 auto`; ≥ 55 % of main; header and rows at `--row-h` (28 compact / 36 comfortable, revalued at the ROOT by `[data-density]`, never here); first column frozen; no wrapping cell | `--surface-app`, `--surface-sunken` (sticky header, group rows), `--ink`, `--ink-code`, `--font-mono`, `--cell-px`, `--cell-py`, `--hairline` | not rendered at all: `bbs-empty` stands in its place |
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
| 9 | `bbs_col_bars` | 72, right | `bars` — the total over the entry's members; on a line counting more than one member, `bbs_bars_each` as its Tooltip (I-534); on a LAP row, `lapsPerBar` |
| 10 | `bbs_col_kg` | 112, right | `kg` (= `kgNet`, which never includes its lap); on a LAP row, `kgLap`; printed at `BBS_PLACES.mass` through `statedAt` (I-bbs-9) |

A `bbs-member` group row is a row of the one grid and reads `GF · Column · C1 · 3 members` — the level
label, the class through `EnumLabel`, the member mark in mono, and the entry's number of members in
the secondary ink at the body weight (`bbs_members_one` / `bbs_members_many`, I-534) — from its frozen
key cell across the row's empty cells, on `--surface-sunken` at the body-medium weight, carrying
`data-member` (the entry's first member), `data-members`, `data-mark`, `data-class`, `data-level` and
no mass at all (I-bbs-2, I-bbs-9). Summary columns:
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
`bbs_members_one` **1 member** · `bbs_members_many` **{count} members** · `bbs_bars_each` **{each} in
each of {count} members** (I-534) · `bbs_component_net` **Bars** · `bbs_component_lap` **Laps** ·
`bbs_component_ties` **Ties** (the components of a rebar line in words, I-354; read by the issued
schedule's left-out list too, I-536) ·
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
held to AM-05: **DRAFT — UNSIGNED** on every page, `BBS_TITLE` **Bar bending schedule**, the
particulars in words, each entry headed `C2 · Column · 1F` with its `8 members`, a **Lap** line
beneath every bar that laps, one cutting-stock line per diameter, **Measured scope only** and **Left
out of this schedule** where the lines are partly declared, a blank **Prepared by** / **Checked by**
box the site completes by hand, and no surveyor, credential, certificate, id, key or enum word
anywhere (I-535, I-536).

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
(`data-rows-rendered`) · `bbs-member` (`data-member` = the entry's first member's `objectKey`,
`data-members` = the number of members the entry counts, `data-mark`, `data-class`, `data-level`;
I-534) · `bbs-row` (`data-bar-key`, `data-bar-mark`, `data-role`, `data-diameter`,
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

Evidence. Unit: `tests/takeoff/bbs-ui/schedule-lines.test.ts` (I-534: the door's `scheduleOf`
over the whole golden roster and the cases it cannot reach), `tests/takeoff/bbs-ui/member-count.test.tsx`
(I-534 (d): the group row's count and the in-each Tooltip, the workspace mounted over the door's own
grouping), `tests/takeoff/bbs-ui/copy-mirror.test.ts` (the module's copy is the registry's);
`tests/takeoff/bbs-ui/present.test.ts` over all 4,127 rows of `bbs.golden.json`
through `goldenBbsDocument()` — never a frozen list, and no duration asserted (AM-10 §3);
`tests/takeoff/bbs-ui/reading-order.test.ts` (I-354(a), the door's comparator over keys the product's
own grammar mints) and `tests/takeoff/bbs-ui/partial-omitted.test.tsx` (I-354(b)(c), the workspace
mounted over the real refusal registry, and the sheet's stock rules read). Live:
`tests/takeoff/bbs-ui/view.db.test.ts`'s issue case reads the presented page on its way to the renderer
(I-535: particulars in words, no uuid or register key; I-536: the partly declared campaign's
`Ties` left out). Docs: `tests/docs/bbs/{payload.json,golden.pdf}` and `tests/docs/bbs-render.test.ts`
under `pnpm test:docs` (AM-18). The committed payload is the product's own emission of the golden's
columns and shear walls at FDN, GF and 1F (`tests/docs/support/bbs-golden.ts`: `bbsDocumentOf`, then
`bbsPayloadOf`), 24 entries over 51 bars on 6 landscape pages. Journey
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
- **A mark stated once with its number of members** (I-354(d)). *(PAID by I-534, session 8, on the
  owner's ruling Q3: `scheduleOf` at the door, the count on the group row, the issued schedule's
  entries, and J-032's per-entry read.)*
- **A placement label on each member row** (I-354(e)). The grid intersection a member stands at,
  read by the partition against the drawing's axes and carried on a bar row. Owner: the rebar rail
  (`bars.ts`), `db/**` (a `bar_rows` column) and the partition's placement reader.

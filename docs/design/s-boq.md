# Design Decision — S-BOQ (the unpriced draft, by taxonomy section)

Route `/t/{tenant}/p/{project}/takeoff/boq` — the **fifth** tab of the takeoff lane, under
`src/app/(app)/t/[tenant]/p/[project]/takeoff/boq/**`, inside the shell frame and behind
`authorizePage({ tenant, project })`. Increment inc-311a-taxonomy-boq. Law: L-BD-08, AM-14, AM-16,
AM-05, L-QTY-07, R-TO-053, R-TO-070, A-BOQ-PDF, A-BOQ-XLSX, L-FMT-01, R-SPINE-021, R-SPINE-041,
S-BOQ, J-030, J-033, R-UI-002/003/004/005/010/012/020/024/030/031/
050/060/080/081/082/083/084/085/086, B-17, B-19, B-20, C-05, C-13.

Cut from the **grid workspace template** (Direction §3.2) and re-deciding nothing it settled: the
tabs row is the frame's tool track (s-takeoff I-230), the grid is DataTable v2 with its own furniture
(I-235), the one RefusalState and the one JobTimeline are the shipped patterns. The template's tree
and inspector are **absent by scope**: the draft is read whole, nothing on it is selectable, and the
Trace lives on the register (out of scope by name). Files: `takeoff/layout.tsx` (one nav entry);
`takeoff/boq/{page.tsx,boq-screen.tsx,actions.ts,route-address.ts,states.ts,demonstration.ts,boq.css}`;
the quantities composer at `src/modules/takeoff/export/boq-xlsx/**`; copy at `src/ui/strings/boq.ts`
and, for the module that renders it, `src/modules/takeoff/boq/copy.ts`. Chrome is shipped primitives only — DataTable v2, IdChip, EnumLabel,
BasisChip, CoverageChip, UnitBadge, EmptyState, Button, Skeleton, Tooltip, the one RefusalState, the
one JobTimeline — plus the `cx-boq-*` classes this file rules. No pattern is invented, so no gallery
entry is added.

## 0. Interpretations (continuing the chain above s-documents' I-264)

- **I-265 — the screen says *sections*, never the other word.** AM-05 forbids calling an unsigned
  draft by the name of the signed thing, in the UI and in file names alike. Every heading, label and
  sentence on this screen and in the rendered PDF says **section**, **draft** or **line**; the word
  the law reserves appears in no text node, no string key and no class name. `data-bill` keeps it,
  because an attribute is machine vocabulary and never reaches a reader.
- **I-266 — the six sections are the order, and Unclassified stands after them.** `BILLS` order is
  the render order and a section holding no line is not rendered (scope). `UNCLASSIFIED` is not a
  seventh section and never sorts among the six: it stands last, labelled, each of its rows stating
  its reason (`NO_TAXONOMY_ROW`, `LEVEL_NOT_IN_STACK`) as words. It is kept and visible, which is
  L-BD-08's whole point, and it is not a place a failed mapping can hide.
- **I-267 — an item number belongs to a numbered line, so an unclassified row carries none.** S.G.I is
  derived from the section's ordinal in `BILLS`; a row outside `BILLS` has no S and may not be given
  one. Its row carries NO `data-item` at all, and its item cell holds the reason in words instead.
  What it does carry is this screen's line identity: a kept line is a published, measured line
  (L-BD-08), so it is a `boq-line` under `boq-bill[data-bill="UNCLASSIFIED"]` with `data-reason`, and
  a reader — or a suite — that asks a section for its lines is answered by every line standing in it.
  Rejected: numbering Unclassified 7.x.y (a seventh section by the back door); `data-item=""` (a
  machine hook spelling an empty identity — job-timeline I-112); and withholding the `boq-line` name
  from the kept rows, which made the block visible to a reader and invisible to every lookup.
- **I-268 — no grand total, and the absence is stated once in words.** Under incomplete coverage
  L-QTY-07 allows only a labelled measured-scope subtotal. Each section ends in one subtotal row per
  unit, labelled **Measured-scope subtotal**; the screen carries no footer that adds sections
  together, and one status line above the grid says why. Silence about a missing figure would be the
  silence R-UI-020 forbids; a hidden figure would be a claim the coverage does not support. (Amended
  by I-529: no section states a foot at all — its groups hold unlike descriptions — and the
  item is the only figure.)
- **I-269 — the item number is derived on both faces by one function.** The screen and the document
  both call `numberItems` over the same payload order, so a number a reader sees and a number the PDF
  prints cannot differ. Nothing stores it; a register that changes renumbers freely. (Since
  I-528 the number belongs to an ITEM, and a member line carries none.)
- **I-270 — exporting is a keyed job, not an act.** A draft is unsigned by definition, so there is no
  consequence to preview and no copper on this screen: `boq-export` runs `takeoffBoq.exportDraft`
  (permission MEASURE), which enqueues under `boqDraftJobKey` and files the issue in Documents. While
  the job is watched the inline `boq-jobs` timeline stands where the button was pressed (R-UI-024);
  when it succeeds the link to the issue appears beside it and no reload happens.
- **I-271 — the quantity a reader sees is the quantity the document prints.** Every figure on this
  screen is the register's value rounded half-even at the kind's `documentPrecision`, right-aligned
  tabular mono with lakh/crore grouping. The register keeps full precision and is reached from the
  register screen, not re-derived here: the draft reads lines and never re-measures. (Since
  I-528 the figure is an item's: its members' register values added exactly, rounded once.)

### 0.1 inc-312 — the quantities export

- **I-272 — the quantities are a synchronous door answering a signed link, not a job.** A workbook is
  EVIDENCE addressed by its own bytes (R-SPINE-021), not a document of the kinds barrel: there is
  nothing to file in Documents, no consequence to preview and no act to commit.
  `takeoffBoq.exportQuantities` (permission MEASURE) builds through the one export seam, stores the
  bytes and answers `{ url, sha256, kind }`; the shipped `GET /api/exports/[id]` serves them. Rejected:
  a second keyed job filing an issue — a build is a pure function of its spec, so two presses of one
  unchanged campaign answer one address and there is nothing for a timeline to watch.
- **I-273 — A-BOQ-XLSX's "bill sheets" are SECTION sheets, named `<S> <label>`.** The ordinal is the
  section's among L-BD-08's six (AM-16 §1), so `1 Substructure` reads the same across two projects.
  The reserved word appears in no sheet name, no header and no cell (AM-05, I-265); the file itself is
  named by its address, `<sha256>.<kind>`, and by nothing a person chose. The line's formula string,
  drawing and source sheet are JOINED from the register by `lineId`, never carried on the draft
  payload, whose schema is strict and whose subject is what a document prints.
- **I-274 — unpriced means the Rate is empty and the Amount is `IF(F="","",E*F)`.** The formula is
  live, so a reader who prices a sheet sees the bill compute; until they do, the Amount states
  nothing. Rejected: `E*F` alone, which would put `0.00` in every Amount of an unpriced draft — a
  figure nobody stated, on a document that says it has no prices (B-21). *(Amended by
  I-570: the Amount is `IF(AND(ISNUMBER(E),ISNUMBER(F)),E*F,"")`.)*
- **I-275 — a column carries one precision: the widest `placesOf` among the kinds standing in it.** The
  cell holds the payload's already-rounded string, written as a number Excel can total and never
  re-rounded here (L-FMT-02, I-271); the lakh/crore number format is the seam's, from `BD_DOCUMENT`
  (L-FMT-01). A section that mixes kinds therefore never quietly loses a digit.
- **I-276 — Resources and Assumptions/Exclusions are not written.** Their sources are the resource
  outputs (M6) and the certificate (M7), and neither exists; an empty sheet under either name would be
  a claim this product cannot support (A-BOQ-XLSX, AM-05). They arrive with their sources. (Amended
  by I-451: a **Not measured** sheet — the measurement statement, not either of these — follows
  Quantities wherever the draft left anything out.)

### 0.2 The item description (the Jev programme's logic-point 5)

- **I-298 — the item description is the method of measurement, so it is CHOSEN from the closed
  catalogue, never written, and it is chosen where the draft is ISSUED.** L-BD-01 makes the item
  description the method of measurement and L-AI-03 lets a model "propose item mappings" and nothing
  more. Where the law divides a group's (class · kind) into more than one description — brickwork at
  a nominal declared thickness (L-BD-04's 250/375, AM-16 §4's 125), a foundation pit in L-BD-04's
  depth band — the closed list is found by code (`candidateItemsFor`,
  `src/core/catalogue/item-descriptions.ts`, every row citing the clause that states its axis) and
  one model selects one of it against what the drawings state, or answers `NONE_OF_THESE`. A
  description is never composed, edited or generated: what is not chosen is the plain `Class · Kind`
  the emission has always written (`descriptionOf`), and a pair the catalogue holds ONE description
  for is never asked at all — a selection with nothing to select. The answer cites the register's own
  source keys, the handles the stated attributes were read from, because a catalogue row is not a
  thing a drawing carries and `src/core/sources.ts` closes the scheme set at DXF_HANDLE · PDF_OBJECT
  · RASTER_TRACE; which taxonomy row placed the group (AM-14, AM-16) travels beside the proposal as
  fact, never as a citation. **The question is put by the ISSUE**, not by every page read:
  `runBoqDraftJob` hands `boqViewOf` a call context, so one draft read by ten people spends one call
  and a sentence reaches a reader in the document it was chosen for (R-AI-005's spend, L-AI-01's
  ledger row). A refusal — no recorded answer, an uncited or unreadable one — leaves the plain
  description standing and the draft reads on, because abstention is the caller's (L-AI-02).
  Rejected: citing the catalogue row as `CATALOGUE:<id>` (a fourth scheme invented for one screen's
  convenience); letting the model write the description (the sentence a bill is priced from would
  then have no author); and asking on every screen read (a live call per group per page load, for a
  reading nothing yet acts on).
- **I-298 (cont.) — a proposed description wears the basis it has, and the issue is what judges it.**
  Every `boq-line` carries `data-description-basis` — `INTERPRETED` where a model's choice stands for
  its group, `DEFAULTED` where the plain description does — so a reader and a suite ask the same row
  the same question; the words themselves stay the group row's, which reads the chosen sentence
  because the emission and the PDF read ONE description (I-269, I-271). Nothing on this screen writes
  an outcome (s-audit I-37): the person who presses Export issues the draft carrying that sentence,
  and `confirmIssuedDescriptions` records **CONFIRMED** against the call it came from, inside the very
  transaction that files the document — `act_id` null, because a draft is not an act (AM-05, I-270)
  and the actor is the person who asked for the render. Nothing is written where the answer was
  `NONE_OF_THESE` and the plain description stood: the call waits on the calibration line, which is
  the honest reading. No person can choose a different description in this product today, so
  OVERRULED and REPUDIATED are unwritable here and `boq-line-description`'s calibration line shows no
  mean confidence where a person disagreed; **no threshold acts on this question** until a
  description-override act exists and the line carries both means, evaluated on the recorded corpus.
  Rejected: a new chip vocabulary for "proposed" (R-UI-002's basis palette already says where a
  reading came from) and printing the basis into the PDF (it would move A-BOQ-PDF's bytes and its
  golden for a mark that belongs beside a reader's cursor, and every page already carries
  DRAFT — UNSIGNED under AM-05).

### 0.3 The craft look of session 7 (2026-09-23)

- **I-boq-1 — the draft a reader meets says which member a line is, why a line has no figure, and
  fits its tabs row at 1280.** The vision review put this screen below the bar (chromeGeometry 2,
  states 3); five of its findings are ruled here against R-UI-020/080/082/084 and the Decision is
  amended in place to match:
  (a) *The tabs row keeps one line at both viewports.* The six tabs beside the aside's every word do
  not fit the 1232 px track at 1280 × 800, and every label and all three buttons wrapped and clipped
  inside the 32 px row (R-UI-080). The aside now holds one line at its own width (`flex: none`,
  `nowrap`); the two quantity channels are ONE name in two words — `boq_export_quantities` then the
  format, `boq_export_format_xlsx` / `boq_export_format_csv` — and below 1536 the shared noun stands
  visually hidden, below 1440 the two chips' captions (`boq_revision_label`, `boq_taxonomy_label`)
  too. Hidden is not removed: each stays in its control's accessible name, and each chip's whole
  value stays its tooltip. Rejected: folding the channels into a menu (it moves J-033's and J-000's
  presses, which click `boq-export-xlsx` by id) and dropping the standing word (AM-05 keeps it).
  (b) *A line with no figure says so, and why.* A PARTIAL_DECLARED line states no quantity (L-QTY-02),
  and the screen left the cell blank beside a red `0%`: sixty silent pile-cap lines opened the draft
  (R-UI-020). Its Quantity cell now reads `boq_quantity_unmeasured` muted, with the registry's own
  message for every code the line's `omitted` states a hover away (`BoqView.omissions`, read by
  `boqViewOf` off the published lines — never a code as text). Its Coverage cell reads
  `boq_coverage_partial` through `EnumLabel`, the raw coverage under `data-technical`: a partly
  declared line has no measured fraction anybody stated, and a `0%` chip was a figure the screen
  invented (L-QTY-07, I-271). A COMPLETE line keeps its one `coverage-chip` at 100 %.
  (c) *A line is findable.* Twenty lines of one group all read `Pile cap · Concrete` over a blank
  Level, so an item number pointed at nothing a reader could find (L-BD-08). The Description cell now
  closes with the member's MARK, mono and muted, and a line standing on no level of the stack shows
  the lawful-null slot its member stands in (`FOUNDATION`) through `EnumLabel` — both read off the
  register by object key (`BoqView.lineFacts`), never parsed out of a key and never written into the
  document's payload, whose bytes and golden do not move. (Amended by I-528: a row is an
  item now, and the members' marks stand in its details of measurement, on the PDF and the workbook.)
  (d) *One h1.* The page had none (hierarchy 3). `.cx-boq-name` is the visually-hidden `<h1>` of
  s-bbs I-289, at `--text-body`, reading `takeoff_nav_boq`; the section headings stay `h2`.
  Owed elsewhere and recorded, not done here: the group row's `(20)` and a group that holds no figure
  opening collapsed are the DataTable primitive's (`src/ui/primitives/data`), and the tabs' own
  `nowrap` is the lane's `takeoff.css`.
- **I-355 — the taxonomy is named by its edition, a lawful-null level is a word, and a member's mark
  is muted (session 7, 2026-09-23; the vision re-look of the M3 project).** The re-look put the
  screen at the bar (tokensAndGrid and identifierExposure looked 4); three of its findings are ruled
  here against R-UI-082/085 and I-boq-1, and the Decision is amended in place to match:
  (a) *The taxonomy chip says its edition.* `IdChip` shows the first seven characters of an opaque
  value, and `bill-taxonomy/2026-09-16` became `bill-ta` — neither a usable id nor a word; at 1280,
  where the chips' captions stand visually hidden (I-boq-1(a)), the aside showed two opaque chips.
  A taxonomy version is a family and an edition date, and the EDITION is what tells one taxonomy from
  the next, so the chip's short form is the part after the family's last `/` (`2026-09-16`, §1's
  `taxonomy 2026-09-16`); the whole version stays the chip's `data-value`, its tooltip and its copy,
  and a version written without a family keeps the chip's own short form. The chip is three mono
  characters wider; the re-look's 1280 capture leaves about 150 px of the tabs track free beside the
  aside, so it still holds one line (I-boq-1(a)) — the gate's own picture is what proves it.
  (b) *A slot is a word.* The `Foundation` slot reused `.cx-boq-level`, which sets the level label's
  mono face, so an enum said in words stood in the figure face (R-UI-085). The slot now stands under
  its own class, `cx-boq-slot`, in `EnumLabel`'s own face and size, taking only the level column's
  muted ink; a level LABEL is model data and keeps the mono.
  (c) *The mark is muted.* I-boq-1(c) rules the member's mark "mono, muted", and the sheet set it in
  `--ink-code` — the description's own weight, so `PC1` competed with `Pile cap · Concrete`. It is now
  `--ink-muted`, still mono.
  Recorded, not done here (wave-3's held rows): the group row's subtotal drawn at the far end of one
  spanning cell rather than in the Quantity and Unit cells is the DataTable primitive's
  (`src/ui/primitives/data`); twenty-six numbered items for one description — a member per line,
  where a bill states one item per description with its total — is a bill-shape question for the
  owner (numbering and emission, I-269), not this screen's.

### 0.4 BOQ-1 — the draft stops lying by zero and by repudiation (session 8, 2026-09-23)

Walk-0's QS read of the issued BNBC draft (26 pp.) found it printing `Column · Rebar 0.000 kg`,
`Beam · Concrete 0.000 m3` and section feet of `0.000 kg` / `0.00 m2` over groups that measured
nothing; 592 of its 1,131 items blank with no reason; nothing on paper saying what the draft leaves
out; and the m4-measure map's critic found every bill reader still reading the lines of objects a
person had struck. Three Interpretations rule it; the item shape (a member per line, I-355) is the
owner's pending question and is untouched.

- **I-449 — a struck object bills nothing: every bill reader reads past its lines, and nothing is
  deleted.** I-173 withholds a repudiated object's lines from the register's table "so nothing is
  priced off an object the register itself says is nothing", and `repudiate.ts` keeps them in the
  store (L-ACT-01). The draft did not honour it: `linesOfCampaign` read every line of the campaign,
  and `bbsOf` every bar row. Now `boqViewOf` asks the register's own reader (`repudiatedObjectsOf`,
  the campaign's revision) which objects stand struck and reads past their lines, so the screen, the
  PDF and the workbook — all three read this one reading — list none of them; and `bbsOf` asks
  `repudiatedObjectsIn` for each revision its rows were measured under, in the transaction it reads
  the rows in, so no schedule, total or cutting list carries a struck member's bars. Deleting a
  measurement (REPUDIATE) removes it from the draft and the schedule; the lines and bar rows stand in
  the store untouched. A campaign whose every line is struck reads as the empty draft. Rejected: a
  `not exists` join in each reader's SQL (a second answer to "which objects stand struck" beside the
  register's, B-17) and deleting the rows (L-ACT-01).
- **I-450 — where nothing was measured the draft says so and why, and never prints a zero.** A
  sum over no figure is not a quantity anybody measured: `Column · Rebar 0.000 kg` reads as "no steel
  in the columns" (L-QTY-04, R-UI-020). So:
  (a) *The emission states no figure over nothing.* A group none of whose lines states a figure
  carries NO subtotal, and a section's foot states no unit none of its lines states a figure in —
  where each wrote `0.000` before. A line with no figure carries the registered codes it gave for
  what it could not measure (`omitted`, each once, in its order; L-QTY-02) — the payload's one new
  line key, optional and absent on a line that states a figure. This revises I-boq-1(b)'s "the
  document's payload is untouched": the PDF must now say why, so the codes it says it from travel
  in the payload, and `BoqView.omissions` is the same computation read once in `boqViewOf`.
  (b) *The page says `Not measured`, and why, in words.* The Quantity cell of a line with no figure,
  of a group with none and of a foot over a unit with none reads **Not measured**, in the quiet ink.
  The line's reasons stand on its own row, in the quiet ink, in parentheses after its description —
  the registry's codes said in words by `inWords`' rule (`SLAB_THICKNESS_UNSTATED` → *slab thickness
  unstated*), each once, joined by `; `. They stand beside the description rather than inside the
  Quantity cell because the 28 mm figure column wrapped `Not measured — note reading contested;
  rebar tie zone unstated` over three lines, and the render was looked at: the wide column holds a
  line's reasons on one line. The registry's own sentence for each reason stands once, in the
  closing block (I-451).
  (c) *A partly measured group prints its figure qualified.* Under its description, on the row that
  carries its figure: `(12 of 26 measured; 14 not measured — blinding plan deferred)`; a group of
  which no line states one reads `(None of 208 measured — note reading contested; rebar tie zone
  unstated)` beside `Not measured`. Counts go through the format seam. These counts are about a
  group's own lines on the draft's face, not the coverage statement's enumeration, which AM-05(1)
  scopes L-QTY-07's "no cardinalities" to.
  (d) *Words are content, not marks.* L-QTY-07's "the bill's face carries no per-row marks" is read
  as barring symbols, flags and footnote marks a reader must decode elsewhere; words that state
  what a row holds are the row's content. Whether a group or foot states a figure is read off its
  LINES, so a payload that still carried a `0.000` subtotal over nothing prints the words too.
  (e) *The workbook says the same.* The section sheets' and the Quantities sheet's Quantity cell of
  a line with no figure holds `Not measured — <reasons in words>` (a text cell in a number column,
  which a SUMIF reads past); a section foot over a unit with no figure holds `Not measured` rather
  than a SUMIF that comes to zero. Every Amount keeps its live formula (I-274). *(Amended by
  I-570: the words moved to a Remarks column, and the Quantity cell holds a number or
  nothing.)*
- **I-451 — the draft closes on what it did not measure.** A buyer's QS handed piles, caps and
  columns assumes that is the structure; the draft carried half the RCC concrete and none of the
  slabs, walls, stairs or rebar, and said only `Coverage INCOMPLETE`. L-QTY-04 makes known scope
  not measured a DECLARED exclusion, so the draft now carries the residue's measurement statement
  (`measurementStatementOf`, the rows the Coverage screen and — at M7 — the certificate read) as the
  payload's `notMeasured`, and closes on **Not measured in this draft**: first **Scope no line was
  published for** — Description (class · kind in words, the kind alone for a kind no class bears),
  Levels (the statement's collapsed run) and Why (the cause in the registry's own sentence) — then
  **Why a line states no figure**: each reason a line above gives, once, in words beside the
  registry's sentence. The block is absent where both are empty. The workbook carries the same as a
  **Not measured** sheet after Quantities (Part · Description · Levels · Why), written only where the
  draft left anything out. This is not the certificate AM-05(2) keeps off a draft and it claims none:
  it names no instrument, actor, concentration, sample or signature, is not titled or bound as one,
  prints no count and no money, and is suppressed when empty — it is L-QTY-04's declared exclusions
  surfaced on the paper that leaves the office. The bill-boundary statement (a kind a person held out
  of this draft) is not printed yet (§8). It amends I-276: Resources and Assumptions/Exclusions are
  still not written; the **Not measured** sheet is neither. If the owner reads the block as claiming
  a certificate, that is the owner's call on AM-05(2), and the block comes off in one commit.

### 0.5 BOQ-SHAPE — the bill in its ruled shape (session 8, 2026-09-24)

The owner ruled the bill's shape (session 8, Q3, recommended answer taken): "one item per description —
a section plus a full description (grade, diameter, member; the level where PWD's floor rate
applies), rounded once from the register sum; the per-member lines in a 'Details of measurement'
appendix; the draft states what it leaves out." Walk-0 found the draft a list of 1,131 members, each
rounded before summing (column concrete 93.904 on the page against 93.892896 in the register), with
UUIDs, a taxonomy id and `INCOMPLETE` on its front page and `509.358 m3` added across piles, caps,
columns and blinding. Five Interpretations apply the ruling; I-355's recorded owner question is
answered by it.

- **I-528 — an item is one description at one level band, its figure the register's sum of its
  member lines rounded ONCE; the member lines are its details of measurement.**
  (a) *The item.* Lines of one section, one (class · kind), one set of stated attributes and one band
  are one item (`itemKeyOf`, `src/modules/takeoff/boq/items.ts`). Its figure is `itemQuantityOf`: the
  members' REGISTER values added exactly, then rounded half-even once to the kind's places — so it
  ties to the Trace to the last printed place (the BNBC column concrete states 93.893, the suite's
  proof). A member line keeps its own figure, its register value rounded once. No figure on the page
  is a sum of other printed figures; the Details of measurement say so in one sentence
  (`ROUNDING_NOTE`). This reverses the emission's old "a subtotal adds what the page shows": a
  pencil sum of the member lines may differ from the item in the last place, and the register is
  what both are held to (L-QTY-07's "round before extension", L-FMT-02).
  (b) *The band.* The level is part of the item where PWD's floor rate applies — above the plinth,
  where the extra-floor added rate bills as its own line against each floor's quantity (L-BD-04,
  L-FRM-07): `FLOOR_RATED_SECTIONS` = Superstructure, Finishes, Electrical, Plumbing. Below the plinth
  (Substructure) and on the site (External) an item is one band whatever storey its members stand
  on, and its Level cell names the storeys (or the slot, in words) they stand on.
  (c) *The description.* The group's sentence — the work-item catalogue's (L-MEA-04) or the one a
  model chose from the closed catalogue (I-298) — then the member in words and what the register
  states that selects the item, each as written through the format seam: every selecting attribute
  the rail carried (`selectors`, L-MEA-06: a pile's diameter today, the grade once N1 scopes the notes'
  grades) and, for a kind a rate book prices by thickness, the binding that states it (blinding's
  `t`, said with where it came from when no sheet states it — I-533). `Reinforced cement concrete cast in place, measured net of its reinforcement — piles,
  diameter 500 mm`. Two members that state different attributes are two items. Nothing is composed
  that the register does not state, and nothing is banded (L-MEA-06). This amends I-298: where
  nothing was chosen the group's sentence is the catalogue's, where it was the bare `Class · Kind`,
  which now stands only as the group's trade heading.
  (d) *The number.* AM-14 §2's `S.G.I` numbers ITEMS: `I` is the item's ordinal in its group, read up
  the building (the foundation slot first) and, on one storey, in the canonical order of the item's
  key (`compareItems`, one comparator for the emission and `numberItems`). A member line is numbered
  by nothing. I-269 stands: one derivation, two readers, stored nowhere.
  (e) *The details.* Each member line carries its mark (the register's), its grid (the partition's
  nearest-axis reading off the plan's own grid, `C/2`; absent where the plan's grid gives none), its
  nos (the formula's `count`), its dimensions (the formula's variables in the order the formula names
  them, in the canon's units, `t not stated` for a variable the drawing did not state), its basis in
  words and the sheet its evidence stands on (the Trace's own sheet number, I-179). The PDF prints
  them as the `Details of measurement` appendix, item by item; the workbook's Quantities sheet
  carries them as columns, each row naming the item it is summed into. The grid and the sheet are
  both read off the PINNED record by placement key — the ingest of the bytes the line was measured
  on, never the drawing's current one (I-422): a later upload that moves a member moves nothing a
  standing line's details say (`tests/takeoff/boq/details-grid.db.test.ts`).
  Rejected: an item per member (the walk's 1,131 items, which no rate book prices); an item per
  (class · kind) with no band (it loses the floor rate the owner named); rounding each line and adding
  (a page that disagrees with the Trace); a description written by a model (L-AI-03: it proposes from
  a closed list).
- **I-529 — no quantity subtotal crosses descriptions.** A group row names its trade and
  states NO figure (a group may hold several descriptions and bands); a section closes on NO
  quantity foot (its groups are unlike: walk-0's `509.358 m3` was the volume of nothing). The item is
  the only figure. This amends I-268 and I-450(a): L-QTY-07's "a labelled measured-scope subtotal
  only" is read as the most a draft may state under incomplete coverage, not a figure it must add;
  `Measured-scope subtotal` is printed nowhere. Money is commensurable, so the workbook's Summary
  still sums each section's live Amounts (I-274) — nothing until priced. The payload's schema has no
  subtotal key at group or section, and refuses one handed in.
- **I-530 — the draft's paper says what it is in words.** The front page states the project
  block — project, client and site as the project holds them (`Not stated` where it holds none), the
  pinned drawing set as its own name, its revision's ordinal and the day it was pinned
  (`setRevisionInWords`), the drawings it pins, the day the issue went out, the sections' taxonomy by
  its edition in words (`By the taxonomy of 16 Sep 2026`) and the measurement in words
  (`Incomplete: what this draft leaves out is listed under Not measured in this draft`). No surrogate
  id, no taxonomy id and no raw enum stands anywhere a reader reads; a lawful-null slot is a word in
  the body face. Every page's foot names the project, the draft and the issue day in place of the
  product's name, and the draft's pages carry no watermark — both through two optional parameters of
  `documents/base/frame.typ` (`footer-note`, `watermarked`) that every other kind leaves at their
  defaults, so no other document moves. L-BD-08's "the taxonomy version stamps every document" is
  read as its EDITION stamped in words: the edition is what tells one version from the next (I-355),
  and the family is this product's one taxonomy. The issue day is stamped by the ISSUE
  (`runBoqDraftJob`, through the format seam in the document zone); a reading is not an issue and
  states none — the `Issued` row is absent rather than `Not stated`, and the foot then names the
  project and the draft alone — and the template reads no clock (R-SPINE-040). The workbook's Summary
  states the same facts, in the same words; a workbook is a working export, so it carries no
  `Issued` row.
- **I-531 — the checking record is blank, names nobody and signs nothing.** The front page
  carries two ruled boxes, `Prepared by` and `Checked by`, each with a Name and a Date line a person
  fills by hand — the record a Dhaka draft circulates with. AM-05(2) binds: the draft names no
  responsible surveyor and no credential, carries no certificate and claims none, and says DRAFT —
  UNSIGNED on every page; a blank box names nobody and a handwritten check on paper is not the
  product's signature, which M7 owns. The slice's "signature box" is read as this checking record
  and not as a signature field, which AM-05(2) would forbid.
- **I-532 — the screen closes on what the draft does not measure, and its empty state leads
  where the reader is.** (a) After its sections the screen states the measurement statement the
  document closes on — each row what (`notMeasuredAbout`, the document's own rule), over which
  levels, and why in the registry's own sentence — as a statement list under **Not measured in this
  draft** (`boq-not-measured`), absent where the draft left nothing out. It is an ENUMERATION, never
  a percentage or a count (L-QTY-07, AM-05(1)); I-451's reading of AM-05(2) covers it. In the PDF the
  same block now stands on a page of its own, after the sections and before the Details of
  measurement appendix. (b) A project with no campaign pinned is taught to pin a set (the drawing
  sets, as before); a pinned campaign that published no line is taught where Measure said why — the
  register's Deferred and refused list, which MEASURE-REFUSE fills with each sheet that has no scale
  of record and each storey that has no height, each with its door — under **Nothing measured yet**.
  Walk-0 met the old copy telling a reader to pin a set already pinned.
- **I-570 — a workbook row with no figure leaves its Quantity empty and says why in Remarks,
  and its Amount multiplies only numbers (session 9, 2026-09-24; walk-1's qs-critic §2 item 2;
  A-BOQ-XLSX, I-274, I-450(e)).** Walk-1 priced the XLSX as a QS does, typing a rate down the Rate
  column. Every not-measured row held `Not measured — <reasons>` as TEXT in its Quantity cell, so
  `IF(F5="","",E5*F5)` gave `#VALUE!`, and the Summary's `SUM('1 Substructure'!G2:G19)` turned
  `#VALUE!` for the whole section. A section sheet now carries an eighth column, **Remarks**, after
  Amount, so the seven keep their letters and the Summary's G ranges stand. An item with no figure
  leaves Quantity empty and says `Not measured — <reasons in words>` in Remarks. The Quantities
  sheet leaves Quantity empty too and says the same words in its Reason column, after the unplaced
  line's taxonomy reason where there is one. The Amount is
  `IF(AND(ISNUMBER(E<row>),ISNUMBER(F<row>)),E<row>*F<row>,"")`. It stays empty until somebody
  prices a measured item, and it stays empty rather than erring where a rate is typed against
  nothing. Evidence: `tests/takeoff/boq/not-measured.test.ts` evaluates the written formulas with
  every item row priced, and the section's sum stays a number. Rejected: a zero in the Quantity cell
  (a quantity nobody measured, I-450), and `IFERROR` around the Amount (it would hide a real error
  in a measured row).
- **I-571 — the coverage cell says `Not measured` where no member states a figure (session 9,
  2026-09-24; walk-1 §2 item 5; R-UI-020).** An item whose qualifier read `None of 26 measured`
  still wore **Partly declared** in its Coverage cell. The badge now reads `boq_coverage_unmeasured`
  **Not measured** where the item states no quantity, and **Partly declared** only where some
  member states one. The raw coverage stays `PARTIAL_DECLARED` on `data-coverage` and under
  `EnumLabel`'s value: the store's standing is unchanged, and only the words are truer.
- **I-572 — the details of measurement state each dimension at its unit's places, and a line
  that counts no members states Nos 1 (session 9, 2026-09-24; walk-1 §2 item 3; L-FMT-02, L-MEA-05).**
  `dimensionsOf` printed the canon's raw fraction (`net 7.7004672 kg`, `clear 3.6624 m`,
  `H 0.6096 m`). A dimension is now rounded once, half to even, to three places for every canonical
  length, area, volume and mass (the millimetre and the gramme), and whole for a count:
  `net 7.700 kg`, `clear 3.662 m`, `H 0.610 m`. The register keeps the full figure, and the item's
  and the line's quantities are unchanged (they round from the register, I-528). A line whose formula
  has no `count` (a rebar line's mass) is published once per register object, so it is ONE member:
  `nosOf` answers `1` rather than a blank Nos. A line with no bindings at all still states nothing.
  Rejected: the line kind's `documentPrecision` (formwork's two places would print a 0.61 m
  height), and leaving Nos blank on rebar (a blank reads as a count nobody took).
- **I-533 — a description states bare only what the drawings state.** A binding a description
  names (blinding's `t`, I-528 (c)) is written bare only where its basis is MEASURED or
  TRANSCRIBED, the two a sheet states; any other says where it came from, in words, after the figure:
  `thickness 3 in (rule-set default, not on the drawings)` where it is cited at an edition's parameter
  (`edition:<digest>#<parameter>`, L-MEA-01), `(interpreted, not on the drawings)` for any other basis
  in words, and `(not on the drawings)` where the reading names no basis. The note is part of the
  description, so it is part of the item's key: a drawn 3 in and a rule set's 3 in are two items,
  because they are two descriptions. Evidence: on the BNBC campaign (J-000's read-back, db_read) all 26
  blinding lines bind `t` = 3 in as DERIVED at the pinned edition's parameter, and the draft printed
  `pile caps, thickness 3 in` as though a sheet said so. A selecting attribute (a pile's diameter)
  is the rail's reading of the drawing and stays bare. Tests: `tests/takeoff/boq/items.test.ts`.

## 1. Layout and hierarchy (1440 × 900)

```
┌R─┬──────────────────────────────────────────────────────────────────────────────┐
│▲ │ ws › Sattva Court ▾ › Takeoff › Draft BOQ                      ⌘K ⟳ ✉ ◉ │ 40
│  ├──────────────────────────────────────────────────────────────────────────────┤
│▦ │ Register · Coverage · Levels · Schedules · Draft BOQ                         │ 32
│▤ │            rev a3f9c2 ⎘ · taxonomy 2026-09-16 ⎘ · Draft — unsigned  ● Export │
│⚙ ├──────────────────────────────────────────────────────────────────────────────┤
│  │ Each item is the register's sum for its description, rounded once. Cover…    │ 28
│  │ 1 Substructure                                                               │ 28
│  ├───────┬────────────────────────────────────┬──────────┬──────────┬────┬───────┤
│  │ Item  │ Description (takes the slack)      │ Level    │ Quantity │Unit│ Basis…│ sticky
│  │ ▾ Column · Concrete                                                           │ group: no figure
│  │ 1.1.1 │ Reinforced cement concrete … — columns │ FDN  │    3.060 │ m³ │◆ M ▣ T│ 28 item
│  │ ▾ Pile cap · Blinding                                                         │
│  │ 1.5.1 │ Plain cement concrete blinding … — pile caps, thickness 3 in (12 of 26 measured; │
│  │       │   14 not measured — blinding plan deferred)   Foundation │ 4.692 │ m³ │◆ D ▣ T│
│  │ ▾ Pile · Concrete                                                             │
│  │ 1.7.1 │ Reinforced cement concrete … — piles, diameter 500 mm │ Foundation│ 372.849 │ m³ │
│  │ 2 Superstructure                                  (no section foot)           │
│  ├───────┬────────────────────────────────────┬──────────┬──────────┬────┬───────┤
│  │ 2.1.1 │ Reinforced cement concrete … — columns │ GF   │   16.828 │ m³ │◆ M ▣ T│
│  │ 2.1.2 │ Reinforced cement concrete … — columns │ 1F   │   15.225 │ m³ │◆ M ▣ T│
│  │ Not measured in this draft                                                   │ statement
│  │ Slab · Concrete   GF–6F   No line has been published for this kind on …      │
│  └───────┴──────────────────────────────────────────────────────────────────────┘
└──┴──────────────────────────────────────────────────────────────────────────────┘
        (no right column: nothing here is selectable — R-UI-080, scope)
```

Above the fold: the grid's sticky header stands 24 (the frame's padding on `shell-main`) + 28 (the
status line) + 4 = **56 px** below the top of main and its first row at **84 px**, at 1440 × 900 and
at 1280 × 800 alike — inside §7 C2's 120. Work-surface share: the grid is 1344 × 748 of main's
1392 × 804 = **90 %**; at 1280 × 800, 1184 × 648 of 1232 × 704 = **88 %**. The grid scrolls inside
its own viewport with the Item column frozen; the page never scrolls sideways (§7 C10).

| Region | What it holds | Width / height rule | Tokens | State when empty |
|---|---|---|---|---|
| tabs row (frame's track) | `takeoff-nav-register` · `-coverage` · `-levels` · `-schedules` · `takeoff-nav-boq` (`aria-current="page"` here); in `useTakeoffTabsAside`: `boq-revision` and `boq-taxonomy-version` as `IdChip`s — the taxonomy's short form its edition, `2026-09-16`, the whole version its value (I-355) — `boq-draft` as the standing word, the ONE primary `boq-export`, then the two secondary channels `boq-export-xlsx` and `boq-export-csv` and, after a press answers, the `boq-export-link` anchor | 100 % × `--toolbar-h` 32; each control at `--control-h`, the link too; one line at its own width, nothing wrapping — below 1536 the channels' noun, below 1440 the chips' captions stand visually hidden and stay in the accessible names (I-boq-1) | `--ink-secondary`, `--ink`, `--ink-muted`, `--line-accent`, `--surface-panel`, `--surface-hover`, `--accent` through Button and through the link | the aside carries the tabs alone while no campaign is pinned; neither the primary nor the two channels render, and the link stands only after a press |
| answer slot (`boq-answer`) | one RefusalState from a refused door; the offline banner above it; the denial pair | 100 % × auto; `display:none` while empty | `--state-info(-surface)`, `--state-warn(-surface)` through RefusalState, `--radius-4`, `--hairline` | absent (no box) |
| status line | the ONE helper line, `<p role="status">`, `boq_coverage_incomplete` or `boq_coverage_complete` | 100 % × 28 | `--ink-muted`, `--text-body` | absent with the grid |
| job strip (`boq-jobs`) | the shipped `JobTimeline` for the render job, present only while a run is watched; `boq-render-draft` is its step; `boq-document-link` follows a success | 100 % × the pattern's own, between the status line and the grid | the pattern's own | absent — never an empty box |
| grid (primary) | `boq-grid`: one DataTable v2 per section (`tableId` `s-boq-<bill>`), one `boq-bill` per section holding a line (`BILLS` order, then `UNCLASSIFIED`), each carrying its OWN sticky `datatable-header` over its frozen first column and its own `data-rows-rendered`; `datatable-group-row` per (class · kind) group naming the trade and stating NO figure (its `datatable-group-subtotal` holds nothing, I-529), then one `boq-line` row per ITEM (I-528); no section foot; after the sections the closing `boq-not-measured` statement list (I-532) | `flex: 1 1 auto`; ≥ 55 % of main; rows and header at `--row-h` — 28 compact, 36 comfortable, revalued at the ROOT by `[data-density]` and never by this screen (R-UI-005, `DEFAULT_DENSITY`) — first column frozen, no wrapping cell | `--surface-app`, `--surface-sunken` (header, group and subtotal rows), `--ink`, `--ink-code`, `--font-mono`, `--cell-px`, `--cell-py`, `--hairline`, basis palette through BasisChip | not rendered at all: `boq-empty` stands in its place |
| empty (in the grid's place) | the shipped `EmptyState` `boq-empty`: heading, one sentence, one action — to the drawing sets where no campaign is pinned, to the takeoff register where a pinned campaign published nothing (I-532) | max-width 520, centred in the grid's box | `--ink`, `--ink-muted`, `--accent` through Button | this IS the empty state |
| error (in the grid's place) | `error-state`: heading, one sentence, `error-state-report` (`IdChip` under the primitive's own report label), `error-state-retry` | 100 % × auto, max-width 520 | `--ink`, `--ink-muted`, `--hairline`, `--radius-4` | — |
| inspector (frame's one slot) | nothing ever mounts it here | **absent — width 0** | — | absent |

**Columns**, left to right, widths multiples of 4:

| # | Header | Width | Cell |
|---|---|---|---|
| 1 | `boq_col_item` | 96, **frozen**, `meta.align: 'right'` | the S.G.I string in `--font-mono` tabular; on an unclassified row, the reason in words (I-267) |
| 2 | `boq_col_description` | the REMAINDER the grid's measured band leaves after the six fixed columns, on the 4 px grid, min 320 (C9's BOQ half, measured the s-bbs way) | the item's full description (I-528) — its group's sentence, the member and what selects it — then, where not every member line states a figure, the qualification in the quiet ink, `(12 of 26 measured; 14 not measured — blinding plan deferred)` (I-450); the shipped cell's tooltip carries the whole where the column clips it; raw keys on `data-class` / `data-kind`; `data-description-basis` on the row and mirrored on this cell — `INTERPRETED` where the group's sentence was chosen from the work-item catalogue, `DEFAULTED` where the catalogue's own stands (I-298). The trade heading (`Column · Concrete`) reads on the `datatable-group-row` above |
| 3 | `boq_col_level` | 120 | the storey the item is priced at, verbatim, mono and muted; an item with no band names the storeys its members stand on, and where they stand on no level the register's lawful-null slot through `EnumLabel` in the interface's face, muted (I-boq-1, I-355, I-528); `data-level` and `data-ordinal` on the row |
| 4 | `boq_col_quantity` | 140, `meta.align: 'right'` | the item's figure — its members' register sum rounded once — `--font-mono` tabular slashed-zero, lakh/crore grouped (I-271, I-528); on an item none of whose members states one, `boq_quantity_unmeasured` muted with the registry's messages for its members' omitted codes as its Tooltip (I-boq-1) |
| 5 | `boq_col_unit` | 80 | one `unit-badge` |
| 6 | `boq_col_basis` | 240 — the PAIR at its longest (`Measured` beside `Transcribed`) reads in full, because §6 promises a glyph and a word | exactly two `basis-chip`s — the quantity basis then the selection basis, each the weakest over the item's members (L-QTY-01), in that order |
| 7 | `boq_col_coverage` | 112, `meta.align: 'right'` | one `coverage-chip` on an item every member of which is COMPLETE; on an item with a partly declared member `boq_coverage_partial` through `EnumLabel` and no chip (I-boq-1), or `boq_coverage_unmeasured` where no member states a figure (I-571) |

**One grid per section, not one grid with section rows.** Each section is its own DataTable v2 under
its own heading, because a reader of a bill reads a section at a time and the lane's own contract
reads each section's header, its frozen key column and its `data-rows-rendered` from the section
itself (`tests/e2e/pages/s-boq.page.ts` `header(bill)`, exercised per section in `tests/e2e/
boq.spec.ts`). A single table holding every section could publish neither a header nor a rendered
count per section, so the sticky header and the frozen first column are per section too.

A section header row carries the ordinal and the label (`1 Substructure`). A group row carries the
class · kind words — the trade its items stand under — and NO figure and no parenthesised count: a
group may hold several descriptions and bands, and no quantity subtotal crosses descriptions
(I-529). An item row is one description at one band (I-528). No subtotal row closes a
section. After the sections (and the kept Unclassified block) the **Not measured in this draft**
section (`boq-not-measured`, an `h2` over a statement list, one `li` per statement row: what in the
body ink, the levels in mono and muted, why in the quiet caption ink) states what the draft leaves
out, and is absent where it leaves nothing out (I-532). A provisional sum, when an act exists
to author one, is the last `boq-line` of its section, labelled `boq_provisional_sum`,
`data-scope="PROVISIONAL"` — data only at M3.

## 2. States (R-UI-050), ruled cell by cell

`BOQ_STATES` in `takeoff/boq/states.ts` = `["loading","denied","offline","error","refused","empty",
"partial","ready"]`; `boq-screen[data-state]` derives in that order, first holding wins. A watched
render is NOT a state of the screen: the job strip stands beside a grid that reads on in full, so the
draft a reader is looking at never stops being ready, partial or refused while bytes are made. The
seven R-UI-050 cells are declared in `src/ui/screen-states/matrix.tsx` under
`/t/[tenant]/p/[project]/takeoff/boq`, and `…/takeoff/boq?__state=<name>` stands this screen in each —
by the screen's own name or by the matrix's (`refusal` opens `refused`, `permission-denied` opens
`denied`) — through `./demonstration` where the evidence instrument is armed; a name neither roster
declares is answered `REQUEST_MALFORMED` through the one RefusalState.

- **Loading** — root at `data-state="loading"`, frame, tabs row and status line intact: the DataTable
  in its `loading` posture over the same `BOQ_COLUMNS` — the header real, the body two section-header
  bones each over eight row bones at `--row-h`. The aside's two chips render as 28 × 96 bones;
  the primary does not render. Never a spinner on a table (R-UI-004).
- **Empty** — the project has no published line on its pinned campaign, or no campaign is pinned.
  `boq-empty` fills the grid's place, the grid and the status line do not render, and it teaches from
  where the reader is (I-532). With NO campaign pinned: `boq_empty_heading`, `boq_empty_body`
  and the one action `boq_empty_action` → `/t/{tenant}/p/{project}/drawings/sets` — the chain a draft
  is read through starts at the drawing sets, and the takeoff lane already offers that step under one
  word on two screens (`takeoff_register_empty_action`, `takeoff_coverage_empty_action`). With a
  campaign pinned that published NOTHING: `boq_empty_unmeasured_heading`,
  `boq_empty_unmeasured_body` and the one action `boq_register_link` →
  `/t/{tenant}/p/{project}/takeoff/register`, where Measure's Deferred and refused list names each
  sheet with no scale of record and each storey with no height, with its door (MEASURE-REFUSE) —
  never back to the drawing sets a reader has already pinned. `boq_register_link` is the one sentence
  that leads to the register, from this cell and from a refused draft alike.
- **Partial** — rendered, never hidden. `data-state="partial"` and `data-coverage="INCOMPLETE"` while
  the coverage statement holds an entry or any line reads `PARTIAL_DECLARED`: every section stands
  with its items, an item with a partly declared member says so in words and qualifies its figure,
  the closing section states what the draft leaves out, and the status line states the rule. An unclassified row makes the screen partial too — a line the taxonomy
  could not place is a gap in the draft, said in words.
- **A watched render** — not a cell of its own (see the roster above). `boq-jobs` stands between the
  status line and the grid, `boq-export` renders `aria-disabled="true"` with `data-job` beside it, and
  every section reads on in full under its own `data-state`. A second press enqueues nothing: the key
  is the campaign's. It is reached by pressing the primary, which is where a reader meets it.
- **Error** — the read threw. `page.tsx` reports it once and hands the `faultId` down; `error-state`
  stands in the grid's place with `boq_error_heading`, `boq_error_body`, the id through
  `error-state-report` under the label the shipped error state says a report id by
  (`primitive_error_report` — one sentence, one home, so every fault on this product is quoted the
  same way), and `error-state-retry` re-running the read in place.
- **Refusal** — the one RefusalState in `boq-answer` for a refused door (`REQUEST_MALFORMED`,
  `PERMISSION_NOT_HELD`, `BOQ_NO_PUBLISHED_LINE`, `BOQ_TAXONOMY_VERSION_MOVED`), and inside the job
  timeline's own step for a refused render. Never a toast, never a screen-local block (R-UI-020).
- **Offline** — a `<p role="status">` banner above the answer slot carrying `boq_offline`;
  `boq-export` renders `aria-disabled="true"` while it stands. The sections read on.
- **Permission-denied** — `boq-export` does NOT render: a denial is the state, and a screen standing
  in it keeps no door open on other evidence (I-194's precedent). The answer slot carries the denial
  over the one registered `PERMISSION_NOT_HELD` entry, evidence the project's participants screen,
  with `boq_denied_export` beneath it naming the permission the absent door would need. Every section,
  line and subtotal reads in full — reading the draft needs membership and nothing more.
- **Ready** — `data-state="ready"`, `data-coverage="COMPLETE"` only where the measurement statement
  is empty and no line reads `PARTIAL_DECLARED`; even then no element carries `data-scope="GRAND"`.

## 3. Copy, verbatim (`src/ui/strings/boq.ts`, keys `boq_…`)

`takeoff_nav_boq` **Draft BOQ** (the fifth tab and `shell-crumb-page`) · `boq_revision_label`
**Pinned revision** · `boq_taxonomy_label` **Taxonomy** · `boq_draft_standing` **Draft — unsigned** ·
`boq_export` **Export the draft** · the two channels, each ONE name in two words (I-boq-1):
`boq_export_quantities` **Quantities** then `boq_export_format_xlsx` **XLSX** / `boq_export_format_csv`
**CSV** · `boq_quantity_unmeasured` **Not measured** · `boq_coverage_partial` **Partly declared** ·
`boq_coverage_unmeasured` **Not measured** (the Coverage cell of an item none of whose members states a
figure, I-571) ·
`boq_export_xlsx_hint` **Download the items, and every line behind them with its bases and
formula, as a workbook with live formulas.** · `boq_export_csv_hint` **Download the Quantities sheet
as CSV.** · `boq_export_link` **Save the file** · `boq_coverage_incomplete` **Each item is the
register's sum for its description, rounded once. Coverage is incomplete: what this draft does not
measure is listed where it closes, and no figure is stated for the project.** ·
`boq_coverage_complete` **Each item is the register's sum for its description, rounded once.** ·
`boq_grid_label` **Draft items by section** · `boq_col_item` **Item** ·
`boq_col_description` **Description** · `boq_col_level` **Level** · `boq_col_quantity` **Quantity** ·
`boq_col_unit` **Unit** · `boq_col_basis` **Basis** · `boq_col_coverage` **Coverage** ·
`boq_section_substructure` **Substructure** · `boq_section_superstructure` **Superstructure** ·
`boq_section_finishes` **Finishes** · `boq_section_electrical` **Electrical** ·
`boq_section_plumbing` **Plumbing** · `boq_section_external` **External** ·
`boq_section_unclassified` **Unclassified** · `boq_not_measured_heading` **Not measured in this
draft** ·
`boq_provisional_sum` **Provisional sum** · `boq_reason_no_taxonomy_row` **No taxonomy row places
this kind.** · `boq_reason_level_not_in_stack` **This line's level is not in the level stack.** ·
`boq_jobs_heading` **Rendering the draft** · `boq_document_link` **Open the issued draft** ·
`boq_empty_heading` **Nothing published yet** · `boq_empty_body` **A draft lists every published line
of the pinned campaign, grouped into sections by the project's taxonomy. Pin a drawing set revision,
measure from the takeoff register, and the sections appear here.** · `boq_empty_action` **Browse
drawing sets** · `boq_empty_unmeasured_heading` **Nothing measured yet** · `boq_empty_unmeasured_body`
**Measure has published no line for the pinned campaign. The takeoff register lists what it deferred
and why — a sheet with no scale of record, a storey with no height — and links to each fix.** ·
`boq_register_link` **Go to the takeoff register** · `boq_error_heading` **The draft could not be read** · `boq_error_body` **Nothing was changed. Try
again, and quote the report id if it keeps happening.** ·
`boq_retry` **Try again** · `boq_offline` **You are offline. The sections read as they stood when
this page loaded, and nothing can be exported until the connection returns.** · `boq_denied_export`
**Exporting the draft needs the MEASURE permission on this project.** · `boq_denied_holder` **A
project principal can grant it on the participants screen.**

Registry entries this increment adds to `src/core/errors/boq.ts` (refusal-state §3's copy rules bind;
the code is never rendered as text):

| code | severity | surface | message | remedy | evidence label |
|---|---|---|---|---|---|
| `BOQ_NO_PUBLISHED_LINE` | info | inline | **This campaign has published no line to draft.** | **Measure and publish from the takeoff register — a draft states what was published and assumes nothing.** | **Go to the takeoff register** |
| `BOQ_TAXONOMY_VERSION_MOVED` | warning | inline | **The taxonomy has changed since this draft was issued.** | **Export the draft again — an issued document states the taxonomy it was drafted under and never follows a later one.** | **Open the documents list** |

Voice: calm, concrete, professional; no exclamation marks; no build vocabulary — "seam", "rail",
"gate", "resolver", "job kind" and every clause id appear nowhere a reader can see. Levels, marks,
units and item numbers are model data and render verbatim in mono; digests, campaign ids and document
ids render only through `IdChip`; classes, kinds, bases and reasons render as words through
`EnumLabel`, the raw key kept on the row's attributes and in the technical disclosure (R-UI-082).
`MEASURE` inside the denial line is the product's law, quoted as the seam quotes it. The rendered
PDF's own words are the document kind's, held to AM-05: **DRAFT — UNSIGNED** on every page, the
section labels, and no surveyor, credential or certificate anywhere. Its front page and foot, in words
(I-530, `boq-draft-law.ts`): the labels **Project**, **Client**, **Site**, **Drawing set**,
**Drawings**, **Issued**, **Sections**, **Measurement**; `NOT_STATED` **Not stated**; the taxonomy
**By the taxonomy of <DD MMM YYYY>**; the set **<name>, revision <n>, pinned <DD MMM YYYY>**; the
measurement **Complete: every class the drawings show was measured** or **Incomplete: what this
draft leaves out is listed under Not measured in this draft**; the checking record's boxes **Prepared
by** and **Checked by**, each with **Name** and **Date** (I-531); the foot **<project> ·
Draft BOQ — unpriced · issued <DD MMM YYYY>**. The appendix (I-528): `DETAILS_HEADING`
**Details of measurement**, its note `ROUNDING_NOTE` **Each item states the register's sum of its
members, rounded once to the places its kind is written to. Each member line below states its own
register figure, rounded once the same way.** and its heads **Mark**, **Grid**, **Level**, **Nos**,
**Dimensions**, **Quantity**, **Unit**, **Basis**, **Sheet**; a variable the drawing did not state,
**<name> not stated**. An item's description **<the group's sentence> — <members>, <attribute> <value>
<unit>, …** and, in the workbook, **…, at <level>**. Where no figure stands (I-450, I-451):
`NOT_MEASURED` **Not measured** · a line's reasons **(<code in words>; …)** · an item's qualifier
**(<m> of <n> measured; <n−m> not measured — <reasons>)** or **(None of <n> measured — <reasons>)** ·
`NOT_MEASURED_HEADING` **Not measured in this draft** · `NOT_MEASURED_SCOPE_HEADING` **Scope no line
was published for** · `LINE_REASONS_HEADING` **Why a line states no figure** · the block's column
heads **Description**, **Levels**, **Why**, **Reason**, **What it means** · the workbook's
**Not measured** sheet, and, on a section sheet, the **Remarks** column's **Not measured — <reasons in
words>** beside an empty Quantity (the Quantities sheet says it in **Reason**, I-570).

## 4. Motion (R-UI-004)

Nothing on this screen eases in: it is a read, and every section arrives complete. The only
transitions are inherited from single homes — row hover fill, the chip's copy state, the Button's and
the nav link's colour over `var(--motion-state)` `var(--ease)`; the Tooltip's own entrance; the job
strip's arrival and its step rows over `var(--motion-state)` from the pattern's own stylesheet; the
reticle draw at `var(--motion-reticle)` from `reticle.css`; the Skeleton pulse in `loading`. No
entrance on the grid, the status line, the empty state or the error block; no bounce, no spinner, no
shimmer beyond one skeleton cycle. Every duration is a token zeroed at source under
`prefers-reduced-motion`, so `boq.css` carries no reduced-motion branch.

## 5. Tokens

Only the semantic alias group and the density/layout tokens (Direction §4.1, §4.2); a `--graphite-*`
or `--beam-*` reference outside `tokens.ts` is a lint failure (R-UI-086). This screen spends:
`--surface-app` · `--surface-panel` · `--surface-sunken` · `--surface-hover` · `--ink` ·
`--ink-secondary` · `--ink-muted` · `--ink-code` · `--line` · `--line-accent` · `--hairline` ·
`--accent` (only through the Button in the aside and in the empty state, and as the aside's
`boq-export-link` text) · `--state-info(-surface)`
and `--state-warn(-surface)` reached only through RefusalState · the basis palette reached only
through `BasisChip` · `--state-danger` / `--state-warn` / `--state-success` reached only through
`CoverageChip`'s own banding · `--space-1/2/3/4` · `--gap-section` · `--radius-2/4` · `--text-20` ·
`--text-body` · `--text-caption` · `--text-12` · `--font-ui` · `--font-mono` · `--leading-ui` ·
`--weight-body-medium` / `--weight-heading` · `--motion-state` / `--motion-reticle` / `--ease`; and,
read by the primitives rather than stated here, `--row-h`, `--cell-px`, `--cell-py`, `--control-h`,
`--toolbar-h`. Px literals, closed set: the status line's 28, the 520 measure the empty state and the
error block both stand at, the seven column widths (96/320/120/140/80/184/112), the tabs-row current
underline's 2, the loading leg's bones (28/96), the two media-query widths below which the aside
hides its channel noun and its chip captions (1535/1439, I-boq-1), and the visually-hidden `h1`'s
and captions' 1. Any other literal is a defect. **No copper
anywhere**: a draft commits nothing and signs nothing (I-270).

## 6. Themes

`boq.css` contains no `[data-theme]` selector; every light/dark difference arrives through token
values (R-UI-001). Dark is the default and light is complete; both are captured, the light picture by
`emulateTheme(page, "light")` inside the dark lane. Contrast holds on the founder values in both:
`--ink` and `--ink-secondary` on `--surface-app` and on the sticky header's and subtotal rows'
`--surface-sunken` clear 4.5:1; `--ink-muted` (graphite-600) clears 4.5:1 as the status line, the
Level cell and the standing word; the beam-500 current-tab underline clears the 3:1 UI floor; each
basis colour rides the chip's glyph and border at ≥ 3:1 while the chip's label rides graphite-700, so
a section dense with chips is still a table of readable words. Nothing carries meaning by colour
alone: a basis is a glyph and a word (R-UI-002), coverage is a numeral, a section is a heading, and a
subtotal is a label — all survive greyscale (R-UI-060).

## 7. Test hooks (closed contract, C-05)

Routes: `/t/{tenant}/p/{project}/takeoff/boq` (`boqRoute`, the one spelling; crumbs in `routes.ts`,
`shell-crumb-page` reads **Draft BOQ**) and the file route
`/t/[tenant]/p/[project]/takeoff/boq` (the matrix key). Linked, all shipped:
`/t/{tenant}/p/{project}/documents` (the issue, and `BOQ_TAXONOMY_VERSION_MOVED`'s evidence),
`…/takeoff/register` (the empty state's action and `BOQ_NO_PUBLISHED_LINE`'s evidence),
`…/settings/participants` (the denial's evidence) and the signed
`/api/exports/{sha256}?tenant=…&kind={xlsx|csv}&expires=…&signature=…` the quantities link addresses.
Procedures: `takeoffBoq.exportDraft`, `takeoffBoq.exportQuantities`. Reads: `boqViewOf`,
`boqDraftPayloadOf`, `resolveBill`, `plinthBoundaryOf`, `numberItems`, `listDocuments`,
`boqExportReadingOf`, `boqWorkbookSpecOf`, `boqQuantitiesSheetOf`, `candidateItemsFor`,
`groupAsksOf`, `describeGroups` and `confirmIssuedDescriptions` (I-298); the item law's
`itemQuantityOf`, `itemKeyOf`, `itemDescriptionOf`, `statedAttributesOf`, `dimensionsOf`,
`bandOf` and `compareItems` (I-528).

Test ids, exactly the registry's spellings, on the elements ruled in §1: `boq-screen` (`data-state`,
`data-campaign`, `data-coverage`, `data-taxonomy-version`) · `boq-answer` · `boq-revision`
(an `id-chip`, `data-value` the whole revision) · `boq-taxonomy-version` (an `id-chip`, `data-value`
the whole `BILL_TAXONOMY.version`) · `boq-draft` (the standing word, `data-state="UNSIGNED"`) ·
`boq-export` (`data-permission`, `data-job`) · `boq-export-xlsx` and `boq-export-csv` (each
`data-permission="MEASURE"`, `data-kind="xlsx"`/`"csv"`, `aria-disabled="true"` and no press while the
connection is gone) · `boq-export-link` (`data-kind`, `data-sha256`, `href` the signed address,
`download`; present only after a press answered) · `boq-jobs` (`data-job`) · `boq-render-draft` (the job's
step, `data-kind="boq-draft"`, `data-state`) · `boq-document-link` (`data-document`) · `boq-grid`
(`data-rows-rendered`: items and kept lines) · `boq-bill` (`data-bill`, `data-ordinal`,
`data-rows-rendered`) · `boq-line` — a row of the draft: an ITEM in a section, a kept line in the
Unclassified block (I-528) — (`data-item`, `data-members` (how many member lines stand
behind it), `data-bill`, `data-group`, `data-class`, `data-kind`, `data-level`, `data-ordinal`,
`data-quantity` (only where it states a figure), `data-unit`, `data-quantity-basis`,
`data-selection-basis`, `data-coverage`, `data-decided-by`, `data-description-basis` (`INTERPRETED` |
`DEFAULTED`, I-298), `data-scope` only on a provisional line; `data-item` on a numbered row and
`data-reason` with `data-line` on a kept one, never both — I-267; an item names no single
`data-line`) · `boq-not-measured` (the closing statement section, I-532) · `boq-empty`.
`boq-subtotal` stays in the registry and is rendered by nothing: the section foot it named is gone
(I-529), and a suite asserts it absent. Used and never
redefined, other files' ids: `takeoff-nav`, `takeoff-nav-boq` (`aria-current="page"` here),
`datatable-header`, `datatable-row` (the primitive's own name, which `rowTestId` replaces on every row
this screen renders — placed and kept alike, I-267), `datatable-group-row` (`data-group`),
`datatable-group-subtotal` (holding no figure here, I-529), `basis-chip` (`data-basis`), `basis-glyph`, `coverage-chip`, `unit-badge`,
`id-chip` (`data-value`), `enum-label`, `empty-state`, `error-state`, `error-state-report`,
`error-state-retry`, `refusal-state`, `skeleton`, `shell-crumb-page`, `shell-main`,
`shell-tenant-switcher`, `shell-user`, `documents-row` (`data-kind="boq-draft"` on S-Documents, whose
only change here is the one kind label `documents_kind_boq_draft` **Draft BOQ**). `boq-draft` also
names the document kind's own fixture root; `draft-every-page` is the document lane's hook on the
frame that prints the banner (`documents/base/frame.typ`), read by `tests/docs/boq-draft/**` through
`tests/docs/support/seam.ts`, and it appears in no DOM.

Behavioural hooks without new ids: `[data-density]` at the ROOT, the one switch the grid reads
`--row-h` from · `data-technical` on every raw enum, taxonomy key and `decidedBy.key` kept beside its
`EnumLabel` · `role="status"` on the status line and the offline banner · `aria-live="polite"` on
`boq-answer` · `aria-label` `boq_grid_label` on the grid · `aria-disabled="true"` on `boq-export`
while a render is watched or the connection is gone (unpermitted renders no primary at all) · the two
quantity channels, offline, stand as the frame's own unavailable affordance — `cx-btn` chrome,
`role="button"`, in the tab order, `aria-disabled="true"`, no press — because the shipped Button
reports `aria-disabled` for busy and for nothing else (I-247's precedent, R-UI-010) ·
`cx-reticle` on every focusable. Asserted absences: no element
with `data-scope="GRAND"` anywhere (I-268); no `boq-subtotal` and no figure on a group row
(I-529); no inspector and no second right column (R-UI-080); no
native `select` or `input[type=date]` (R-UI-083); no `data-item` that is not `^[1-9]\d*\.[1-9]\d*\.[1-9]\d*$`
(a kept line carries none at all — I-267); no NUMBERED `boq-line` carrying other than exactly two `basis-chip`s and — on a
COMPLETE line — one `coverage-chip` (a PARTIAL_DECLARED line states its coverage in words, I-boq-1); no `boq-bill` for a section holding no line; no `boq-grid` while `boq-empty` stands;
no `boq-jobs` at rest; no wrapping cell; no uuid or digest as a text node outside an `IdChip`.

Suites and evidence. Unit: `tests/takeoff/boq/taxonomy.test.ts`, `…/numbering.test.ts` (items),
`…/items.test.ts` (I-528/b: the BNBC campaign's 208 column-concrete figures round ONCE to
93.893 where rounded-then-added they came to 93.904; bands, descriptions, details, no foot, the
front page in words), `…/issue-stamp.test.ts` (I-530: the issue's day in the document's
zone), `…/workspace-items.test.tsx` (I-528/b/e: rows are items, the group sums nothing, the closing
section, the two empty states), `…/workspace-identity-cells.test.tsx` (I-355: the workspace mounted
over a draft the product's own emission composes, and the sheet's slot and qualifier rules read),
`…/not-measured.test.ts` (I-450/c:
the emission, the presenter and the workbook over a reading of rebar measured nowhere, blinding
measured for one cap of two and the statement), the database lane's
`…/repudiated-withheld.db.test.ts` (I-449: a struck column leaves no draft line and no bar row,
and its line stays in the store),
`tests/takeoff/boq/support/**` and the quantities export's own `tests/takeoff/boq-xlsx/**` — the
workbook composed over the F-RCC6-BNBC roster and read back with exceljs, and the aside that presses
the door — with `tests/takeoff/boq-xlsx/export-door.db.test.ts` on the database lane (no duration is
asserted in any of them — AM-10 §3). Docs:
`tests/docs/boq-draft/{payload.json,golden.pdf,render.test.ts}` under `pnpm test:docs`. Perf:
`tests/e2e/boq-draft-perf.spec.ts`, titles carrying **PERF-311**, collected only by `pnpm test:perf`.
Journey `tests/e2e/boq.spec.ts`, every title carrying **J-033**, staged by
`tests/e2e/takeoff/boq-stage.ts` (`stageBoq`, `stageBareProject`) over `signInAsSeededTenant`; page
objects `tests/e2e/pages/s-boq.page.ts` and `tests/e2e/pages/s-documents.page.ts`; checkpoints
**s-boq/sections** (dark), **s-boq/sections-light** (by `emulateTheme`) and **s-boq/empty**, axe
serious/critical = 0 at each, never widened; baselines
`tests/e2e/baselines/design-dark/s-boq/{sections,sections-light,empty}.png`, `masks()` over the shell
breadcrumb, `shell-user` and `shell-tenant-switcher` — every other text is staged and fixed.
Re-baselined under B-20 in its own `baseline:`-subject commit naming the fifth tab as the proof:
`design-dark/{s-takeoff,j-021-column-slice,j-022-coverage,j-031-levels,s-schedules}/**`.

## 8. Recorded IOUs (owner named, never a comment in `src/`)

- **A line's Trace on this screen.** Every figure here came from a drawing, and R-UI-022 will want an
  EvidenceLink on the Quantity cell and an inspector behind it. Out of scope by name; the register
  carries the Trace meanwhile. Owner: the M4 BOQ leaf.
- **The Resources and Assumptions/Exclusions sheets, and a priced workbook.** A-BOQ-XLSX's two
  remaining sheets wait on the resource outputs and the certificate, and the Rate column waits on
  pricing (I-276). Owners: M6 for the resources and the priced BOQ, M7 for the certificate.
- **Electrical, Plumbing, External and provisional sums.** Their taxonomy rows exist and no rail
  publishes into them, so those sections never render today and no act authors a provisional sum.
  Owners: the network rail's node and the provisional-sum authoring leaf.
- **The certificate, the signature and the closing of the draft path.** AM-05 keeps the draft lawful
  only while unsigned; the moment a signature exists this path closes for that campaign. Owner: M7.
- **Rebar and BBS lines in the draft.** Not until the rebar kind is in `KINDS`. Owner: inc-309.
- **The screen's own `Not measured` foot (BOQ-1's residue).** Closed by I-529: no section
  states a foot at all, and an item with no figure says **Not measured** in its own Quantity cell.
- **The member lines on the screen.** The screen states items; their member lines — the details of
  measurement — are the PDF's appendix and the workbook's Quantities sheet, and a reader reaches a
  member's Trace through the register. A drill-down from an item to its members, and from a member
  to its Trace, is the M4 BOQ leaf's (walk-0 F19).
- **A drawing register on the front page.** The front page names the pinned set, its revision and the
  drawings it pins by the names they were uploaded under; the sheet-by-sheet register (number,
  title, revision letter, date) waits on a title-block reading the draft can cite (walk-0 B18).
  Owner: the sheet-understanding leaf.
- **A group heading at a page's foot.** Closed: the trade row is the bill table's level-2 header,
  which the pinned Typst never leaves alone at a page's foot and repeats over a group that runs onto
  the next page; the section and appendix headings are sticky blocks. The docs lane holds every page
  to ending on no group heading (`boq-draft-render.test.ts`), over a golden whose page 2 opens on a
  carried heading.
- **An appendix item running onto the next page.** Closed: the item's number and description are
  its member table's own header, so a member list that crosses a page opens the next under them
  again, beside the column heads (the BNBC read-back's render showed bare column heads from page 7;
  it now runs to 36 pages, from 35). The docs lane lengthens one item to 120 members and holds every
  page that lists them to naming the item.
- **The grade in the description.** The concrete grade stands in an item's description the day N1
  carries the notes' grades onto the lines as selecting attributes; until then the member, the pile
  diameter and the blinding thickness are what the register states. Owner: BOQ-DESC (wave 5).
- **The bill-boundary statement on the draft.** A kind a person held out of this draft
  (`NOT_IN_THIS_BILL`, `billStatementOf`) is not yet printed in the closing block (I-451); its
  registry sentence names the reserved word, so it needs its own draft wording. Owner: M4 BOQ leaf.
- **A struck object in the residue and the schedule's PARTIAL flag.** The residue still counts a
  struck object's lines as bearing its cell, so a cell whose only lines are struck is neither in the
  draft nor in its statement; and `bbsViewOf`'s PARTIAL flag still reads a struck member's rebar line.
  Both over-disclose or under-state nothing priced, and both belong to their own owners (the residue,
  `src/core/residue`; S-BBS, `bbs-ui/server.ts`). Owner: S7 of the M4 map (edit and delete by acts).

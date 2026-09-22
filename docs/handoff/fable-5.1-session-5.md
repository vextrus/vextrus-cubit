# Fable 5.1 — session 5 handoff (orchestrator edition)

Branch `dev-lane-and-jev`, from `42d2141e` (main `8cf9f11f`, never touched). One orchestrator (this
model) holding the plan, the law, the tree and the gate; Opus 5 workers through dynamic workflows and
single agents, none of which ran a db, e2e, gate, probe or corpus lane or committed. The session's
ledger is `docs/handoff/fable-5.1-session-5-ledger.md` (every run, its runId, what each agent
returned, what I did with it); the workflow scripts are under `docs/handoff/workflows/session-5/`
(saved as `.js.txt` because `eslint .` refuses a top-level `return`; runnable copies were made
under `~/.claude/workflows/session-5/`). Three Claude Code process restarts interrupted the session
(16:38, 17:29, 18:10); every interrupted workflow was resumed with `resumeFromRunId` and its partial
edits told to stand.

`TYPESAFE_API_KEY` stood in my shell and was never printed, written or committed. Every Jev call this
session is billed under the pinned Claude id `claude-sonnet-5` — Jev is not among AS-05's closed
model ids and no rate exists for it — and every cost line below says so.

## 1. What was proved, per journey

- **J-000 M3, leg 1 (`m3-levels-and-notes`)**: GREEN on runs 3, 4, 5 and 6 of the session's M3 runs
  (3.4–3.6 s on the staged run): the proposed level stack is offered whole and confirmed (8 levels,
  GF..6F and ROOF, off the section's `EL` marks), and the general notes of S-01/S-02 are
  transcribed. It leaves the fixme roster in this session's `journeys(j-000)` commit.
- **J-000 M3, leg 2 (`m3-measure-and-register`, split out of the bill leg so the roster can hold a
  walking leg beside a named door)**: GREEN on runs 10, 11 and 12 (2.2–2.3 min) and on the final
  run of the committed layout (§5): Measure pressed, the column layout plan's range GF–6F stated on
  the levels rail, the campaign measured again, the register reviewed — the run's database holds
  204 placements, 77 grid axes, the stack of 8, one AFFIRM_SCALE act naming ten views, 26 columns on
  each of GF..6F and `column · rcc.concrete · COMPLETE · 182 lines · 92.21 m³`; the column filter
  counts them; the coverage grid and the measurement boundary print.
- **J-000 M3, leg 3 (`m3-bill-and-schedules`, the BOQ and the bar schedule read against the
  golden)**: stands as two `MISSING DOOR:` fixmes on the roster, because the golden band (L-QTY-06:
  3 % under, 0 % over) refuses seven column cells — GF +0.87 %, 1F/2F +1.37 %, 3F/4F +1.72 %, 5F/6F
  +2.11 % — for two reasons read off the drawing after the run: C7 is "%%C450 PORCH COLUMN", a
  circular section the product measures as a 450 × 450 prism (+0.146 m³ on GF), and a plan member's
  own storey range ("C5 FLOATING COLUMN OVER TG1 (STARTS AT 1F)"; the porch column on GF alone) is
  not a reading the expansion makes, so C7 is carried over every storey and C5 over none (+0.206 m³
  on each of 1F..6F — exactly the difference measured). The BOQ draft itself is emitted and its
  `j-000/boq-draft` checkpoint is axe-clean once the document link wore link ink (run 11).
- **The rest of J-000 and the regression sweep**: §5 — not run at the session's end.

## 2. What was fixed (commit · clause · test)

The A slice (the viewport-caption door and what stood behind it), the C slice (six screens under the
craft bar), the B0 seam and the D2 cad slice landed in the first half; the spine found and fixed six
more defects on the road to the M3 leg. One line each; the ledger holds the measurements.

- `12761617` partition(views) — a paper sheet's window is a region of model space and the text under
  its frame captions it (L-CAD-06; I-290/291). BNBC 54 views (53 framed), F-RCC6 9 → 8 views under
  AM-01 (the 29 pointless dimensions land in their plans). `regions.test.ts`, `viewport-regions`
  (db), the caption corpus 5 → 11.
- `6e166680` partition(grid) — a bubble drawn as one block is read structurally (I-292): BNBC 77 axes
  over seven plan windows × 11; S-15's 215C and S-23's 224C deferred GRID_NO_BUBBLE_EVIDENCE.
- `0e2474d6` partition(notation, schedules) — EL is a storey word; a schedule's row is delimited by
  its mark cells (I-293/294): BNBC's stack 0 → 8, S-11 27 rows → 11 (C1..C7 × four bands).
- `65feb156` scale — a dimension whose text states its own unit is evidence on a unitless header,
  measured between its definition points; an override is an observation (I-295/295b): BNBC 0 → 10
  views proposing at exactly 0.001 m/unit; F-RCC6's rank-3 factors 0.0961… → 0.1.
- `7dee95ad`, `86888a70`, `ff6a0571`, `a0f7f0e8` craft — sets index and set browser as DataTable v2
  grids; the register's view key in words with IdChips on refusal rows; the schedules grid id on the
  scrolling frame; the hidden screen name on the type scale (I-285…I-289).
- `f9d119b8`, `820d0e99` toolchain — the craft walk rests the pointer off the frame and prints the
  rail's state; the gate's logs survive its own e2e lanes; a bare `pnpm e2e` is the regression
  sweep with J-000 left to the `e2e-j000` lane.
- `4e86367f` model(seam) — the adapter and the recorder enumerate per-question arms (AM-11);
  eight questions named.
- `85fdcae3` cad — a per-class conversion shortfall is a named loss on the artifact and the CLI;
  a handle stated twice for drawing content refuses HANDLES_NOT_UNIQUE across ENTITIES and BLOCKS.
- The six Jev points and the six corpora — §3.1.
- **Found by the spine, fixed in the spine:**
  - `outlineEvidenceOf` compared the grid's partition view key with the placement rows' identity
    key and found no plan spacing for any outline — F-RCC6 listed 0 subjects; `partitionViewKey`
    is now the one spelling (views/law.ts) and the evidence builds it from the row's own view
    (in the corroboration commit; F-RCC6 lists 72).
  - The levels rail captioned an unstated range by its raw address (`v:LAYOUT_PLAN:DXF_HANDLE:20B6`)
    because `unstatedRangesOf` keyed its captions by the partition's key; now by `viewAddressOf`
    (takeoff(levels) commit).
  - A band written in ordinal words ("3RD & 4TH") never covered the stack's floor labels ("3F"):
    `sameStorey` in the grammar, registered with core's placement (partition(notation), core(offers)
    commit) — 182 columns went from SECTION_BAND_UNCOVERED to a covering band.
  - S-11's sections stated no unit and the file's $INSUNITS is 0, so every column variant stored
    `section_unit` null and the frame rail refused SECTION_UNIT_UNSTATED: the drawing's own
    declaration ("ALL DIMENSIONS ARE IN MILLIMETRES UNLESS FIGURED IN FEET AND INCHES", S-01) is now
    a convention of the drawing and the last word on a unitless pair, cited (I-302; 79 of 81 BNBC
    variants mm, F-RCC6 byte-identical).
  - The probe script made `--out` a directory in signin mode; the README's `pnpm probe --` reaches
    pnpm 10 as a mode (toolchain(probe) commit).
  - The register's Measure door and revision chip vanished on a customer's second visit: the lane's
    tabs aside was a slot filled by an effect, and the register hydrates through a ~100 ms window in
    which two of it stand; the aside is now drawn in place through a portal (takeoff(nav) commit,
    with the frame's own slots recorded as the next of that class).
  - The BOQ's issued-document link wore the accent as text ink (3.94:1, axe serious at the
    `j-000/boq-draft` checkpoint); it wears `--ink-link` (craft(boq) commit).
  - The M3 staging: a two-second wait per refused scale row on every sheet (1,368 of 1,800 s), the
    ranges authored before the first Measure (the levels rail is the campaign's index), a swallowed
    press waiting its whole budget, actions with no timeout — all in the journeys(j-000) commit.
  - Two of p4's db-lane cases read the guard's sentence for its code and took the same cell twice;
    the corpus acceptance case asked over a state the corpus now replays (in the p4 commit).

## 3. What was built

### 3.1 The Jev programme — logic-points 2 to 7, on the point-1 pattern

One arm per question in `src/core/model/typesafe-arms/` enumerated by a registry, one recorder per
question in `scripts/model-corpus/` enumerated by a registry, instructions naming the state by
backticked field path and offering the no-match outcome, the judgment read as the contract spells
it, the corpus recorded by the orchestrator alone and filed into `fixtures/model` (10 → 240
fixtures). `/typesafe:typesafe-ai` was invoked before the design fan-out; the choice, noul and score
pages were read.

| point | question | arm | corpus | what the answers say |
|---|---|---|---|---|
| 2 | schedule-cell | a Choice per contested cell over the grammar's own candidates + NOT_STATED; a Noul on the row's standing; judged through `judgeCellReading` | 80 contested rows of BNBC's five schedules; 138,532 input tokens; provider's documented 0.005818344 USD | cells choose plausibly; every call's confidence is the row-header Noul's probability (0.01–0.18) — a seam defect (`answerJudgmentOf`) to fix before any threshold |
| 3 | note-clause | a Choice over NOTE_KINDS + NONE_OF_THESE; a Noul "the lap governs the table"; the offer STORED (migration 0055) and judged by TRANSCRIBE_SHEET_NOTES | 38 clauses of S-01/S-02; 34,272 tokens; 0.001439424 USD | 37 of 38 NONE_OF_THESE (governs ≤ 0.12); the one LAP (governs 0.79) is S-02's "LAP 50d TENSION / 40d COMPRESSION U.N.O." — the drawing's own T-NOTE-OVERRIDE sentence, unread by the grammar |
| 4 | coverage-cause | a Choice over SCOPE_DECLARATION_CAUSES + NOTHING_TO_DECLARE, gated and floored (0.80, a placeholder) by code; judged by the two boundary acts | nine hand-authored states; 7,302 tokens; 0.000306684 USD | all nine NOTHING_TO_DECLARE (0.75–1.00) — the corpus never exercises a declarable cause |
| 5 | boq-line-description | a Choice over the closed item-description catalogue + NONE_OF_THESE; a Noul on whether the attributes separate; confirmed at the draft's issue | four line states; 4,715 tokens; 0.00019803 USD | brickwork 250/125 at 0.96; the two excavation states at 0.34/0.36 (no selecting attribute) |
| 6 | outline-corroboration | a criteria-less Noul over the numbers code finds; the acts name the call they judged | F-RCC6's 72 mark-anchored outlines; 59,462 tokens; 0.002497404 USD | probabilities 0.54–0.76 (mean 0.61): the 0.30/0.70 band separates nothing on a clean drawing |
| 7 | sheet-revision-recency (part a) | a Choice for the evidence + a five-level Score | BNBC's 27 sheets; 107,028 tokens; 0.004495176 USD | 27 of 27 at level 4 — every sheet REV B; the top of the spectrum only |

What is deliberately NOT wired, one line each: no pass asks schedule-cell (the rebuild's proposal
pass beside view-caption) and no inspector offers it; `runNoteClausePass` exists and is unwired
(the `notes` stage in rebuild.ts), and the governs line has no test id; coverage-cause is asked on
every inspector open and stored nowhere; the BOQ screen asks nothing (the page door hands no call
context; the job asks at issue); the corroboration proposal has no store, so the server composes
none; part (b) of point 7 (CONFIRM_DISCIPLINE, the stored reading) is deferred whole. Every one is
recorded in its Decision (I-296…I-301) and in §7.

### 3.2 The M3 door, measured on the product

Read off the golden run's own database after each run (psql, read-only): placements 204, grid 77
axes, the stack 8 levels, register objects 204 → after the authored range 26 columns on each of GF..6F
(182), one AFFIRM_SCALE act naming ten views at DIMENSION_RATIO, five schedules, 60 member types,
nine notes readings, the campaign's first run publishing 60 lines (pile caps, PARTIAL_DECLARED) —
and the column lines gated by the storey-spelling seam (fixed) and by the section's unit (fixed:
the drawing's declared unit, I-302). What the rails say after both is §1's verdict.

### 3.3 The craft debt

Six screens under the bar were read by seven proposers and taken by five implementers (sets index and
set browser as grids; register key words and IdChips; the schedules grid id; the hidden `<h1>` on the
type scale; documents and BBS graded on the M3 project, which holds an issued document); the rail's
hover hold that put 27 of 72 captures at width 220 is the probe's to rest, and it does.

### 3.4 How the session was orchestrated

Eight workflow runs and four single agents, all Opus 5, none of which ran a lane beyond the unit
lane or committed (the ledger names each run, its runId, its agents and its tokens). The shapes:

- **Read-only fan-outs before any design** (six readers over the two entity graphs; seven proposers
  over the six screens; six designers with WebFetch to docs.typesafe.ai): cheap, parallel, and the
  briefs that followed quoted their measurements. Worth keeping.
- **A design panel with the precedence question at its centre** (five agents) settled the
  viewport-caption door's law before an implementer touched a file. Worth keeping.
- **Implementers on disjoint files, resumed by `resumeFromRunId` after each process restart** with
  a paragraph telling the re-run slice that its partial edits stand: three restarts, no work lost.
- **What went wrong and what it cost**: two implementers touched one shared file
  (`transport-vocabulary.ts`, then the db barrel), found by reading the diff; two Interpretations
  were numbered I-297 by two workers (renumbered I-300); one worker's unit test staged both sides
  of a seam with the same spelling and proved nothing about it (the corroboration evidence);
  the M3 leg's staging cost three runs (a 30-minute timeout, a swallowed press, a wrong order)
  before its product doors were even reached. Size the next session's briefs with the seam's two
  spellings and the customer's order in them (session-6 prompt §3).
- **The spine was serial and was the wall-clock**: db lane 80 s, an M3 run 2.4–12 min, the probes
  ~10 min, six corpora ~15 min serial. The fan-outs filled the gaps until the spine started; from
  then on the orchestrator worked alone with one worker in flight.

## 4. The craft table

NOT WALKED at the session's end: the owner stopped the session after the final M3 run, before the
probe server, the craft walk and the re-take could run. The C slice's six screens landed with the
mechanical criteria their proposers measured (sets index and set browser as DataTable v2 grids —
rowHeight 3 → a grid the rubric can read; the register's key words and IdChips; the schedules grid
id and `data-rows-rendered` on the scrolling frame; the hidden `<h1>` on the type scale in bbs,
register and viewer; the probe resting the pointer off the frame so the rail reads 48/collapsed) and
without the walk that grades them. Session 4's table stands as the last graded one. The pictures a
lawful change moved (`s-takeoff/register.png` at least) were NOT re-taken; `pnpm e2e:retake` (dry,
then `-- --write`) and a `baseline:` commit are session 6's first hour.

## 5. The gate, verbatim

`pnpm gate` was NOT run at the session's end (the owner stopped the session after the final M3
run). What was run over the whole committed tree, each lane by shell, with the last verdict:

- `pnpm test` (19:47, after every door): `Test Files 502 passed (502) / Tests 3242 passed (3242)`.
- `pnpm test:db` (19:46, no product served): `Test Files 231 passed (231) / Tests 1369 passed (1369)`,
  wall-time 114.23 s.
- `pnpm lint`: `0 errors, 161 warnings` (pre-existing jsx-a11y; `src/ui` at zero).
- `npx tsc --noEmit`: clean.
- `pnpm db:drift --scratch`: exit 0 (migration 0055).
- `ruff check cad`: "All checks passed!"; `uv run --project cad pytest cad`: "473 passed" (the D2
  worker's lane, quoted in `85fdcae3`); `pnpm vitest run tests/cad`: 9 files / 43 tests.
- `pnpm e2e --journeys J-000 --workers 1 <the three M3 leg files>` (the final run, §8): the M3
  verdicts of §1.
- `pnpm test:golden`, `pnpm e2e` (the dark sweep), `pnpm test:perf`, `pnpm checkup`, `pnpm verify`:
  not run this session. The corpus grew by 230 fixtures and six arms landed; the golden lane and the
  sweep are the first thing session 6 runs.

## 6. Declined by law

- ARCHITECTURE.dwg: the refusal stands (HANDLES_NOT_UNIQUE, 10 handles, first 65A4) — LibreDWG
  0.13.3's decode of this AC1021 file's page map truncates handles to 16 bits (max stated 0xFFFF,
  wrapping six times against $HANDSEED 37,641), so no key can name one entity (L-CAD-02) and no
  L-CAD-09 count can be defended; a re-save from a seat writing AC1032, or a LibreDWG that decodes
  the page map (a toolchain increment). General Note_Edison Lavinia.dwg now refuses by the same name
  (16 handles, first B07B) where it once ingested with 16 originals silently dropped.
- J-011's fly-to leg: not in reach as a product change — `preserveDrawingBuffer: true` stands under
  PB-3, a `data-pulse` hook amends the viewer's §7 contract; the free diagnosis (a MutationObserver
  over the status line's per-frame attributes after `data-flyto=settled`) is the owner's to read.
- A third migration: none taken beyond 0055 (0053, 0054 were on the branch); schedule-cell, the
  corroboration store and part (b) of point 7 each wanted one and were built without it, saying so.
- NOTE_KINDS is closed (cover is not a kind; a unit is a convention, not a note kind).
- Never `--update-snapshots`; never a landed migration edited; never `test.skip`.

## 7. What remains, and who owns it

1. **The storey-word seam, twice more**: `bandFrom`/`bandTo` are stored as the drawing spells them and
   every reader now bridges through `sameStorey`; the levels proposal's labels and the expansion's
   authored ranges are the stack's own. The two homes of STOREY_WORDS (notation/index.ts and
   grammar.ts) remain a B-17 debt.
2. **schedule-cell's asker and surface** (five test ids, a proposals table, the rebuild's pass);
   **`answerJudgmentOf` reads a Noul's probability as its confidence** — fix before reading any
   threshold off the schedule-cell or note-clause lines.
3. **note-clause**: wire the `notes` stage into `runPartitionJob`; `schedules.proposalGoverns` id; the
   grammar does not read "LAP 50d TENSION / 40d COMPRESSION U.N.O." (BNBC's own T-NOTE-OVERRIDE) —
   a LAP reader gap the corpus exposed.
4. **coverage-cause**: a corpus state that really places a class outside the project; the stored
   proposal keyed by cell; `ResidueObservation.code` beside `reason`; the J-022 stage's lawful source
   key; the floor read off the corpus.
5. **boq-line-description**: the page door's call context (R-AI-005 spend); the earthwork rail's
   selecting attribute; bears vs the rails (slab|shear_wall|stair × concrete/formwork).
6. **outline-corroboration**: the store, the server read, the measure-pass caller, the tighter
   binding; a criteria'd Noul is a new request hash (second recording); BNBC's anomalies to
   calibrate NO on; `SHARE_PARAMETER` spelled twice; `outlineEvidenceOf` re-reads what detect.ts
   computes privately.
7. **sheet-revision-recency part (b)**: the stored reading, the ingest pass, PROPOSAL_BASES gaining
   MODEL, the card's basis; a second drawing whose set disagrees with itself.
8. **The M3 leg's doors after the columns**: MEMBER_TYPE_UNKNOWN on pile/pile_cap (the pile schedule
   is not a read the reconstructor makes); REBAR_SCHEDULE_UNREAD on columns; LINTEL_SOURCE_ABSENT;
   S-25's ATTRIB-block lintel schedule (T-SCHED-ATTRIB) reaches no band; "SLAB REINFORCEMENT PLAN"
   classifies DETAIL; 215C/224C ungridded; S-05/S-06 SCHEDULE_NONE_RECONSTRUCTED; conventions.resolve's
   version question.
9. **The viewer on a 100k-entity sheet in software GL**: ELECTRICAL.dwg's model layout crashes the
   tab; PLUMBING (103,583 entities) and the Structural drawing (61,460) paint whole at frame medians
   of 41 and 80 ms against the 16.7 ms budget — the card's to meet, and a probe that opens a page per
   file.
10. **The `register-workspace` element resolves twice** on `/takeoff/register` in an unscoped read
    (one under `shell-main`); the page objects scope to the frame, so nothing reads it wrong today.
11. **The owner's untracked leavings** (`.agents/`, `.idea/`, `.junie/plans/`, `AGENTS.md`) stand
    untracked; nothing here touched or committed them.
12. **The AS-05 amendment** (`docs/decisions/as-05-jev-amendment.md` §3.1 lists what this session
    built without it).

## 8. Reproducing each proof

- The M3 legs: `pnpm e2e --journeys J-000 --workers 1 tests/e2e/journeys/j-000/m3-bill-and-schedules.spec.ts tests/e2e/journeys/j-000/m3-levels-and-notes.spec.ts`; the run's database is
  `postgres://cubit_app:cubit_app@127.0.0.1:5544/cubit_e2e`, read with `set cubit.system_reason='…'`
  first (the craft walk's own pattern), never while the db lane runs.
- The corpora: `node --import tsx scripts/model-corpus.ts record --question <q> … --out <scratch>`
  then `file --from <scratch>`; the whole-name `--layouts` for note-clause; `--limit 0` lists.
- The probes: `pnpm probe:server`; `pnpm probe signin tenant-w0@seeded.cubit.test seeded-worker-tenant-password --out test-results/probe/d/cookies.json`;
  `pnpm probe run <script> --cookies … --out test-results/probe/d` for `http-tamper.mjs`,
  `bnbc-viewports.mjs`, `reference-sheets.mjs` (`PROBE_REFERENCE_ONLY=<file>` walks one); the
  scripts stand in the session scratch and the ledger says where.
- The craft table: `bash scripts/probe/craft-walk.sh test-results/j-000-golden-run.dark.w0.json test-results/probe/craft [bnbc]`.
- The gate: `pnpm gate` (stdout redirected), logs under `node_modules/.cache/cubit/gate/`.

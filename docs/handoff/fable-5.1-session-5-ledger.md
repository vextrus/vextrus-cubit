# Fable 5.1 — session 5 orchestration ledger

Branch `dev-lane-and-jev`, started at `42d2141e` (2026-09-22). One entry per workflow run: its name,
the runId, the agents it spawned, what each returned in one line, what the orchestrator did with it.
Lanes run **by shell**: `mcp__builder__check` and `mcp__builder__scratch_dir` are absent in this
session (ToolSearch found neither). Scratch: the session scratchpad
(`/tmp/claude-1000/-home-riz-vextrus-cubit/<session>/scratchpad`). `TYPESAFE_API_KEY` stands in the
shell (present, never printed); `CUBIT_MODEL_FIXTURE_ROOT` unset.

## Environment read before the first run

- HEAD `42d2141e`; main `8cf9f11f`; tree clean but for the owner's untracked `.agents/`, `.idea/`,
  `.junie/plans/`, `AGENTS.md` (handoff §7 item 7).
- Node 24.19.0, pnpm 10.34.5, 24 cores, 26 GB.
- `~/.claude/settings.json` carries the subagent model `claude-opus-5`, spawn depth 1, teams off,
  `ultracode: true`, `workflowSizeGuideline: large`.
- The BNBC artifact for reading: `uv run --project cad vextrus-cad ingest fixtures/rcc6-bnbc/rcc6-bnbc.dxf --out <scratch>/bnbc/bnbc.entitygraph.json` (1.6 s, 20 MB).

## Runs

### 1. `a-understand-viewport-caption-door` — runId `wf_325c66b9-8b2` (launched 15:37)
Script: `docs/handoff/workflows/session-5/a-understand-viewport-caption-door.js`. Six readers at
`medium`, read-only, over the BNBC and F-RCC6 artifacts in scratch: `read:assign`, `read:artifact`,
`read:grid`, `read:levels`, `read:legs`, `read:surfaces`. Facts I measured before briefing them:
model space's tallest text is 400 so the 0.8 share admits 16 captions (COLUMN SCHEDULE, S-12's six
detail marks C1–C6 at 320, the two S-14 texts 600 units apart, ROOF BEAM LAYOUT, two ROOF BEAM
SCHEDULE, TYPICAL SLAB REINFORCEMENT PLAN, LINTEL & SUNSHADE SCHEDULE, SECTION A-A, BAR BENDING
SCHEDULE); S-10's window holds no caption (tallest inside is a 240 note) and its title is the
paper text `COLUMN LAYOUT PLAN  SCALE 1:100` (DXF_HANDLE:20B6) under viewport 20BA; an INSERT
original carries no points (its ring is `derived[].src`, its label `block_attributes[].src`), so
block-drawn grid bubbles are invisible to `grid/detect.ts`; F-RCC6 has no viewports at all (its
captions stand in model space at height 600, its paper layouts hold four title-block entities
each), so the door cannot move it. Results: (pending).

**Results (15:47; 6/6 returned, 669,351 subagent tokens, 284 tool uses, 10.7 min).** Flattened to
scratch `a-understand.md`. What each proved, one line: `read:assign` — the S-10 window's 71 entities
ALL land in SCHEDULE:9C6 today (COLUMN SCHEDULE's reach is 206,989 units); the 53 viewport windows
are pairwise disjoint and own all 5,084 placed model originals exactly once; a paper TEXT is an
original entity and `LAYOUT_PLAN:DXF_HANDLE:20B6` a lawful key; F-RCC6's partition is 9 views / 29
UNASSIGNED with zero viewports. `read:artifact` — the title rule (paper text at x∈[left,right],
y∈[bottom−8,bottom], h≥3.5) is exactly one on 53/53 viewports, zero on the model-frames twin,
unreachable on F-RCC6; 110 GRID_BUBBLE INSERTs, ring in `derived` (area 785601), label in
`block_attributes`; `viewer/projection.ts` already ships `windowOf`/`projectable`. `read:grid` —
three independent filters each give "axes 0" (census gives an INSERT no kind so "Grid Circle" carries
no role; centreOf(INSERT) null; bubblesAmong reads entities only); with window regions each of the 10
plan viewports reads 11 bubbles at minSpacing 2438.4; T-KEYPLAN is paper-space derived paint with
derived TEXT labels, excluded by construction if a label must be an ATTRIB of the same INSERT.
`read:levels` — adding "EL" to STOREY_WORDS (duplicated in notation/index.ts:211 and grammar.ts:196)
makes exactly 8 marks read with labels the drawing's own ("1F"), unit null (B-07), 0 of 1,077 fixture
texts change, F-RCC6 untouched. `read:legs` — after the door the leg still needs TWO more doors:
S-11's three-physical-rows-per-mark schedule (every C family gets a null section →
SECTION_UNIT_UNSTATED; only 2 of 4 band headers read) and scale proposals on a unitless header
(T-INSUNITS-0 → `proposalsFor` answers [] for every view → VIEW_SCALE_UNAFFIRMED). `read:surfaces` —
sheetOfView already files a paper-anchored view on its paper sheet; reconstruct.tableOf needs the
anchor among the view's assigned model texts (so schedule captions must stay model-anchored); the
scale panel lists the whole record's views on every sheet (copy says "Views of this sheet").
What I did: convened the design panel (run 4) with the precedence question as its centre.

### 2. `c-understand-six-screens` — runId `wf_08c66f64-6a2` (launched 15:41)
Seven proposers at `medium`, read-only: `propose:sets-index`, `propose:set-browser`,
`propose:documents`, `propose:bbs`, `propose:register`, `propose:schedules`, `propose:sidebar`.
Results: (pending).

**Results (15:50; 7/7 returned, 802,831 tokens, 365 tool uses, 9.0 min).** Flattened to scratch
`c-proposals.md`. One line each: `propose:sets-index` — the `<ul>` is no rubric candidate
(workSurface 0, aboveTheFold 0, rowHeight 3 = 43/12 = 3.58 exactly); a DataTable v2 grid inside the
existing `sets-index` region, every id reused. `propose:set-browser` — the same for `set-drawings`,
with the membership toggle in a control-well cell and the pinned revisions kept as a list; the two
screens share sets.css, strings.ts and the Decision, so ONE worker takes both. `propose:documents` —
no code change: the screen reads 5.00 on a project holding an issue; the walk's project is the cure
(the run file's `bnbc.projectId`). `propose:bbs` — the same, plus the hidden `<h1>` at the UA's 28 px
(hierarchy 4): one `font-size: var(--text-body)`; the same UA-size reading stands in register.css:40
and viewer.css:216. `propose:register` — every published line's sourceKey is its VIEW key and
`parseSourceKey` refuses it, so the whole key stands in the label; the refusal rows print placement
keys as mono text; the class in words + `data-key` on the anchor + IdChip on the refusal rows.
`propose:schedules` — the scroll frame carries no candidate id; giving it `schedules-grid` +
`data-rows-rendered` (the S-Levels precedent) measures the Decision's own primary (≈ 50 % → 4).
`propose:sidebar` — MEASURED from the session-4 JSON: 27 of 72 captures read rail 220 across 12 of
18 routes (thirteen published rows carry the pointer in them); the cause is Chromium's pointer at
(0,0) inside the rail's box and shell-rail's hover hold; the probe should rest the pointer off the
frame and print the rail's state. What I did: launched run 5 (six implementers).

### 3. `b-design-jev-questions` — runId `wf_64eb517e-665` (launched 15:44)
Six designers at `medium`, read-only, with WebFetch to docs.typesafe.ai (reachable this session —
the index at /llms.txt answered): `design:p2-schedule-cell`, `design:p3-notes-clause`,
`design:p4-coverage-cause`, `design:p5-boq-description`, `design:p6-corroboration`,
`design:p7-beyond-m3`. The `/typesafe:typesafe-ai` skill was invoked before this run; I read the
choice, noul and score pages myself (choice: up to 255 options, `confidence` from the spread;
noul: a probability of yes with no confidence field, one condition per question; score: 2–10
ordered levels describing situations, `score` the probability-weighted position).
**Results (15:56; 6/6 returned, 1,061,854 tokens, 353 tool uses, 11.8 min).** Summarised to scratch
`b-designs-summary.txt`. One line each: `p2-schedule-cell` — a Choice per CONTESTED cell over
code-found candidates (spans × notation readings → attribute, NOT_STATED the no-match) plus a Noul
"row is a header"; no act exists on a schedule, so the outcome is the cell's disposition
(recordDisposition's precedent); corpus 34 from BNBC's five schedules through the reconstructor, no
database. `p3-note-clause` — a Choice over R-TO-034's closed NOTE_KINDS + NONE_OF_THESE with the
figure code-extracted after the class, plus a Noul "this clause's tension lap governs over the
table"; outcome by TRANSCRIBE_SHEET_NOTES (CONFIRMED kept-as-offered, OVERRULED edited); the largest
point — the offer must be STORED for the act to judge it (a table; the session's one admitted
migration if nothing existing can hold it); corpus 35 clauses from S-01/S-02. `p4-coverage-cause` —
a Choice over SCOPE_DECLARATION_CAUSES (two) + NOTHING_TO_DECLARE over the cell, its sightings and
the rails' observations; the citable key recovered from the view key's embedded anchor; outcome
carried on BoundaryInput.proposal into DECLARE_NOT_IN_PROJECT_SCOPE / HOLD_OUT_OF_BILL in the act's
own transaction; corpus 9 hand-authored state fixtures (Q-08). `p5-boq-line-description` — a Choice
over catalogue item descriptions per (class, kind) + NONE_OF_THESE and a Noul "the attributes tell the
options apart"; needs a closed `item-descriptions` roster beside the catalogue (the register states
almost nothing that separates candidates today, so most calls will abstain — a finding); outcome at
the draft's issue (a job, not an act). `p6-outline-corroboration` — a Noul over numeric evidence
(outline box, stated section, plan median, near-anchor distance, the edition's bands), acts
CORROBORATE/REPUDIATE, a 0.30–0.70 band writing no outcome; corpus from F-RCC6's 76 anchored
outlines. `p7` — (b) the discipline outcome writer needs the model's reading STORED (table +
migration + ingest pass); (a) the revision-recency Score has no act at M3. What I decided: run one
prerequisite worker (B0) that splits the adapter into per-question arms enumerated by a registry
(AM-11), then six implementers on disjoint modules; p3 owns the session's one migration if it
cannot stand without one; p2 must reuse the disposition shape without a migration; p7 is scoped to
its seam and corpus with (b) deferred by the designer's own reasoning; I add the registry lines and
record every corpus myself.

### 4. `a-design-panel-viewport-door` — runId `wf_1c1ce2e2-7bb` (launched 16:04, done 16:16; 5 agents, 388,606 tokens, 104 tool uses)
Script: `docs/handoff/workflows/session-5/a-design-panel-viewport-door.js`. Three designs at `medium`
(viewport-first, caption-grammar-first, placement-first), two judges at `high` (law-and-fixtures,
downstream-and-leg). Both judges named placement-first the winner with caption-grammar-first's file
shape and viewport-first's two grafts; both REFUTED, by measurement, claims in every design: S-25
carries two viewports (two views on every design); viewport-first's re-find of a schedule's title
picks the stray "P" on S-05; 10 of the 53 paper titles classify UNTYPED under the shipped grammar
(S-16, S-17, S-04's set-out table … 2,071 entities) so "UNTYPED never anchors" would hand them back
to COLUMN SCHEDULE's reach; under the paint-CENTROID rule UNASSIGNED is 4 (68F), under the paint
BOX centre 3; two title-anchored SCHEDULE views (S-05 PILE, S-06 PILE CAP) reconstruct nothing —
honest deferrals neither of which reconstructs today; nine model-anchored region views would stand
on the MODEL sheet under sheet-views.ts as written; 21CF/21EF classify DETAIL and 2210 STAIR_PLAN so
33 bubbles are read by nobody and 215C has none. **My ruling (the Interpretation to record):** per
titled projectable viewport, a typed model caption inside the window anchors (key unmoved, 9 keys),
else the title anchors, typed or honestly UNTYPED (one answer to L-CAD-06's sentence, the same as
today's code); an untyped model caption inside a titled region is content; a pointless entity
stands at its paint's BOX centre (3 UNASSIGNED); overlap → smallest window then lower handle; the
residue keeps today's competition; the caption is the anchor's own words verbatim; the sheet a
view stands on is the sheet whose frame shows its anchor (sheet-views.ts amended, pure, no
migration); reconstruct.tableOf unchanged (S-05/S-06 defer honestly); the job event gains
`framed`; the scale panel stays per-drawing (a per-sheet filter would leave model-anchored views
affirmable nowhere). Follow-ups recorded for the handoff: the conventions profile's version
question; "SLAB REINFORCEMENT PLAN" classifying DETAIL; 215C ungridded.

### 5. `c-implement-six-screens` — runId `wf_3a291d04-4c2` (launched 16:12)
Script: `docs/handoff/workflows/session-5/c-implement-six-screens.js`. Six implementers at `xhigh`,
unit lane only, disjoint files: `implement:sets-grids` (both sets screens, one Decision, I-285/286),
`implement:register-labels` (I-287), `implement:schedules-primary` (I-288; the one editor of
`testids.ts`), `implement:bbs-heading` (I-289), `implement:probe-rail-and-project` (toolchain),
`implement:gate-e2e-toolchain` (toolchain; handoff §7 items 6 and 8).
**Results (16:35; 6/6 returned, 808,340 tokens, 451 tool uses, 23.0 min).** Summarised to scratch
`c-reports.txt`; every claim checked against the diff. `sets-grids` — both lists are DataTable v2
grids inside the regions the contract already names (`sets-index`, `set-drawings`), the browser's
frame eighteen rows deep, the pinned revisions a list, I-285/I-286 recorded; its `screens.test.ts`
is db lane (I ran it: see the spine). `register-labels` — a view key reads as its class in words
(`Layout plan`), the key whole on the anchor's `data-key`, the refusal rows' placement keys through
IdChip; it touched two files outside its list, both forced by the acceptance and lawful: the route's
chrome hand-down (`register-screen.tsx`, one id) and the literal-testid ratchet 70 → 69. `schedules-primary`
— the scroll frame carries `schedules-grid` + `data-rows-rendered` (the sum of stored band counts),
one id added to `testids.ts`; it states that retrying reads inside the notes rows now resolve to the
frame's contract. `bbs-heading` — one declaration, I-289, four tests. `probe-rail-and-project` —
the pointer rests off the frame twice per check, the verdict line prints `rail=…`, the walk takes a
third argument (`bnbc` resolves the run file's `bnbc.projectId`) and its table gains a project
column; measured over session 4's readings: 45 collapsed / 27 expanded. `gate-e2e-toolchain` — the
gate's logs default to `node_modules/.cache/cubit/gate`; a bare `pnpm e2e` inverts `PERF-` and
`J-000` as whole tokens and says so on its line. My verification on the whole tree at 16:40:
`pnpm vitest run` over the model seam and every C suite — `Test Files 43 passed (43)`, `Tests 248
passed (248)`; eslint over every changed file — `0 errors, 38 warnings` (pre-existing jsx-a11y
warnings; the literal-testid ratchet test holds at 69); `npx tsc --noEmit` — no errors.

### 6. B0 — the adapter's per-question arms (single agent, launched 16:20, done 16:38; 174,693 tokens, 84 tool uses)
One `general-purpose` agent at the session's effort: split `src/core/model/typesafe.ts` into
per-question arms enumerated by a registry with a pairwise-distinct key-set test, the corpus
recorder likewise, bodies pinned byte-identical (the two request hashes `50f7c938…` and
`20850cd2…` unchanged; "BODIES AND HASHES IDENTICAL: true"; 16 files / 89 tests green). Its one
follow-up — `typesafe.ts` beside a `typesafe/` directory makes an extensionless absolute import
ambiguous under tsx — I took inline: the directory is `typesafe-arms/`. I then named the six
questions in `questions.ts` and wrote a STUB arm and a STUB recorder for each (so the registries
compile and each implementer owns one file per side), grew the one assertion that listed two
names to the eight, and re-ran the seam: green.

### Commits landed at 16:55 (after the C spine's unit lane, lint and typecheck)
`7dee95ad` craft(sets) · `86888a70` craft(register) · `ff6a0571` craft(schedules) · `a0f7f0e8`
craft(bbs, register, viewer — the hidden headings' size, the register's and viewer's declarations
inline by me with a §5 line in each Decision) · `f9d119b8` toolchain(probe) · `820d0e99`
toolchain(gate, e2e) · `4e86367f` model(seam). The db-lane suites the sets slice touched:
`pnpm vitest run --config db/__tests__/vitest.config.ts tests/takeoff/sets` → 4 files passed;
`tests/takeoff/sheets/route-render.test.ts` RED on its own `next build` ("an input is newer than
the build's start") — the tree is mid-edit by A's workers, so it is re-run in A's spine, not a
sets defect (the slice touched no drawings route). The journeys (J-012, register.spec,
schedules.spec, J-032) and the craft walk run in the spine once A lands.

### D0 — the probe scripts (single agent, launched 16:32, done 17:02)
One `general-purpose` agent wrote, and did not run, three probe run-scripts and a runbook under
scratch `d/`: `http-tamper.mjs` (the three upload routes by hand; one byte flipped mid-file →
expects 409 `DIGEST_MISMATCH`; a second session with the true bytes → complete), `bnbc-viewports.mjs`
(the 27/53 roster from the manifest; S-10/S-12/S-15/S-25 painted; per sheet the rendered facts,
first paint, the partition panel's on-sheet rows, and the windows-with-paint read off the viewer
feed's `via`), `reference-sheets.mjs` (each reference DWG through S-Home and the Dropzone, the
ingest watched, the refusal read by both names off the job's events, up to six sheets painted with
`data-frame-median-ms`/`p95` plus an independent rAF count, the General Note's texts dumped in feed
order). Facts it found: the product publishes a frame reading every frame on `viewer-status`; an
upload through the API alone is never ingested (the screen asks); the cad refusal code reaches only
the job event's `detail.cause`; S-Schedules answers the pinned revision, so a freshly uploaded
General Note lists no notes there. J-011's fly-to leg: NOT in reach as a product change (the two
candidates — `preserveDrawingBuffer: true`, which stands under PB-3, or a `data-pulse` hook, which
amends the viewer's §7 contract); a free diagnosis exists (a MutationObserver over the status
line's per-frame attributes after `data-flyto=settled`) and is recorded for the owner. What I did:
started the cad-lane half now (the five DWGs through `vextrus-cad ingest` into scratch, read-only);
the served-product half runs after A's spine.
**The cad-lane half, measured at 16:32–16:36** (`uv run --project cad vextrus-cad ingest <dwg>
--out <scratch>`, read-only): General Note_Edison Lavinia.dwg 2.1 s → 3,310 entities (428 texts,
tallest 337.5, inch), 1 content-less paper layout dropped, no explode loss, no flatten cap; the 428
texts dumped in artifact order to scratch `d/cad/general-note.texts.txt` (sha256 of the joined
texts `4a9b4aa8…`) for the probe to compare against the product's feed order. Structural Working
Drawing_Edison Lavinia_Final.dwg 18.9 s → 21,889 entities (2,816 texts), 39,571 derived, no loss.
PLUMBING.dwg 15.4 s → 22,934 entities (model 22,719 + Layout1 215, 18 viewports), 80,884 derived.
ELECTRICAL.dwg 21.1 s → 10,583 entities (18 viewports), 122,285 derived. ARCHITECTURE.dwg refuses
by name, exit 2: `vextrus-cad: cannot ingest …/ARCHITECTURE.dwg: HANDLES_NOT_UNIQUE: 10 handle(s)
are stated more than once, first 65A4`; `dwg2dxf -m -o <scratch>` twice is byte-identical (sha256
`a16d4200…`, 876,670 bytes). A cad worker (D1) is reading whether a lawful heal exists under
L-CAD-02/04/09 or the refusal stands.
**D1's verdict (done 16:58, interrupted once by the restart and resumed; ≈115k tokens): (b) the
refusal stands, nothing changed, cad/ clean.** Measured: the census pass holds 116,103 records but
only 55,352 distinct handles (35,892 stated more than once, up to five records of different classes
each); the maximum stated handle is 0xFFFF exactly and the stated handle wraps 0xFFFF → 0x0 six
times over the object map, while the drawing's own `$HANDSEED` is 0x9309 = 37,641 — LibreDWG
0.13.3's decode of this AC1021 file's page map (`ERROR: Invalid num_pages 0`, 16,593 "Object handle
not found") truncates handles to 16 bits; the AC1032 reference (Structural) decodes 64,381 records
with 64,381 distinct handles up to 0x126952, so the toolchain does state wide handles where it
decodes. Handles aside, the whole-form DXF is truncated (`missing EOF tag`) and the `-m` fallback
carries 2,139 of 42,216 census entities with 29 classes refused SHORTFALL on 3 spaces — no sheet
could be published (L-CAD-04); no L-CAD-09 count could be defended (L-CAD-09). A person would
re-save the drawing from a seat writing AC1032/AC1027, or the lane moves to a LibreDWG that decodes
the page map (a `toolchain` increment). The lane: `ruff check cad` "All checks passed!"; `uv run
--project cad pytest cad` "463 passed in 129.88s"; `cad/tests/dwg` "50 passed". Two follow-ups it
found: (1) `cli.py` drops `DwgConversion.refused`, so per-class SHORTFALL refusals reach neither
stderr nor the artifact (L-CAD-04 says they refuse the class by name); (2) `report.duplicate_handles`
sees only the ENTITIES section, so General Note_Edison Lavinia.dwg ingests exit 0 while ezdxf's audit
prints 17 non-unique-handle lines — keys minted twice silently — and that audit chatter lands on the
one-shot CLI's stdout unheld. What I did: a second cad worker (D2) owns both fixes with synthetic
canaries.

### 8. `b-implement-jev-points` — runId `wf_60216fce-a0d` (launched 17:00)
Script: `docs/handoff/workflows/session-5/b-implement-jev-points.js`. Six implementers at `xhigh`
on disjoint modules, each filling its stub arm and stub recorder: `p2-schedule-cell` (no
migration; the disposition shape reused; returns its Interpretation for s-schedules.md),
`p3-note-clause` (owns s-schedules.md and the session's one admitted migration 0055 if the offer
cannot be stored in an existing table), `p4-coverage-cause` (states under
`scripts/model-corpus/coverage-cause-states/`), `p5-boq-description` (the closed
item-descriptions roster cited to the clauses; abstentions expected), `p6-corroboration`
(`placement/evidence.ts` one home for the numbers), `p7-revision-recency` (scoped to the seam and
the corpus as a held classification; (b) deferred).
**Interrupted at ~16:38 by the process restart with all six started and none complete; resumed at
16:40 (partial edits on disk, told to stand). Results (17:17; 6/6, 1,783,307 tokens over the run,
1,001 tool uses, 37 min).** One line each, checked against the tree: `p2-schedule-cell` — arm, the
code-side candidate finder (two defects of the inherited pass fixed: a size pair is a candidate; a
compound span offers no whole-span reading), request builder, disposition door
(`judgeCellReading`, authorize() + zod), recorder; NO migration and NO surface (a proposal made at
rebuild time has no store; the asker in rebuild.ts is A's file) — the surface increment named.
`p3-note-clause` — the largest: the clause reading in core, the offer STORED in a new table
(migration 0055, the session's one admitted, hand-written and PROVED by `pnpm db:drift --scratch`
exit 0), judged by TRANSCRIBE_SHEET_NOTES in its own transaction, the notes panel rendering the
offer's origin and the lap's Noul, I-296/I-297 in s-schedules.md; the pass (`runNoteClausePass`)
exists and is UNWIRED (the `notes` stage in rebuild.ts is A's file) — 38 subjects (S-01 30, S-02
8). `p4-coverage-cause` — arm, gate, confidence floor 0.80 (placeholder, to be read off the corpus),
tRPC door, inspector region, outcome on BoundaryInput.proposal, nine committed hand-authored states,
I-297 in s-coverage.md. `p5-boq-description` — the closed item-descriptions roster cited to the
clauses (brickwork 125/250/375, excavation depth bands; concrete carries ONE candidate because the
grade set is not closed by law — never asked), the draft's issue asking and writing CONFIRMED, four
states, I-298 in s-boq.md; the screen asks nothing (the page door hands no call context —
deliberate, R-AI-005). `p6-corroboration` — `placement/evidence.ts` one home, the Noul arm, the
band 0.30/0.70, `proposalCallId` on both acts and zod schemas, the inspector's proposal line,
I-299 in s-takeoff.md; the server read composes no proposal yet (no store; the migration withheld).
`p7-revision-recency` — the arm (a Choice for the source + a five-level Score), the module
`src/modules/ai/sheet-revision`, the recorder (27 subjects, all REV B — the corpus calibrates the
top of the spectrum only); (b) deferred. Integration by me: the db barrel published a name of its
own invention (`modelJudgmentOf`, refused by `tests/core-db-split/barrel.test.ts`) — its consumer
now imports the module; `NOT_STATED` and `DIMENSION_OVERRIDE` declared in
`transport-vocabulary.ts` (Q-07's orphan scan); the seven saved workflow scripts renamed `.js.txt`
(eslint parses every `.js` in the tree and a workflow's top-level return is a syntax error; an
ignore line is a config change) with runnable copies under `~/.claude/workflows/session-5/`.
**Whole-tree lanes at 17:30:** `pnpm test` `Test Files 500 passed (500) / Tests 3220 passed
(3220)` 57 s; `pnpm lint` `0 errors, 161 warnings` (pre-existing jsx-a11y; `src/ui` at zero);
`npx tsc --noEmit` 0 errors; `pnpm db:drift --scratch` exit 0; `pnpm test:db` `Test Files 2 failed
| 229 passed (231) / Tests 2 failed | 1367 passed (1369)`, wall-time 88.57 s — the two reds are
p4's own db-lane suites (`tests/server/takeoff-coverage-cause-door.test.ts`: the door refuses an
ESTIMATOR with the act seam's "needs SET_BILL_BOUNDARY" sentence, not `PERMISSION_NOT_HELD` through
authorize(); `tests/takeoff/coverage/cause-outcome.db.test.ts`: the staged HOLD_OUT_OF_BILL changes
nothing, so no act is recorded), sent back to their implementer once.

### 7. `a-implement-viewport-door` — runId `wf_062cb684-b42` (launched 16:26)
Script: `docs/handoff/workflows/session-5/a-implement-viewport-door.js`. Four implementers at
`xhigh`, unit lane only: `implement:regions` (regions.ts, assign.ts, rebuild.ts's line,
sheet-views.ts, the caption corpus, I-290/291), `implement:grid-bubble` (census.ts, grid/detect.ts,
I-292), `implement:levels-and-schedule` (EL in both rosters, floor-zone ratchet +2, the stacked
S-11 rows and the four band headers, I-293/294), `implement:scale-unitless` (feet-inches dimensions
as unit-bearing evidence on a unitless header, I-295).
**Interrupted at ~16:38 by a Claude Code process restart** (with run 8 and the D1 cad worker):
three of four had completed and are cached in the journal; `levels-and-schedule` had not, its
partial edits on disk. Resumed at 16:40 with `resumeFromRunId` and a paragraph telling the
re-run slice that its own partial edits stand. **The three cached results, verified against the
tree:** `regions` — BNBC 54 views (53 framed + UNASSIGNED), 5,334 of 5,334 assigned, UNASSIGNED 3
(13F8, 13FA, 19DE — no paint at all), the 9 model-anchored keys unmoved, S-10's 71 pointed
entities → `LAYOUT_PLAN:DXF_HANDLE:20B6` (93 with the paint-boxed ones), S-13's 274 →
`LAYOUT_PLAN:DXF_HANDLE:2116`, S-14's 253 whole under `F31`; the title histogram {1: 53}; the twin
yields no title (its one paper text at h 3, re-measured); F-RCC6 deep-equal before/after (9 views,
1,073 assignments); all 53 region views stand on paper sheets; the caption corpus grows 5 → 11;
17 unit cases + 7 sheet-views cases; a db-lane `viewport-regions.test.ts` written. `grid-bubble`
— census reads an instance as what it painted; a structural bubble (one painted round ring + one
attribute row the family grammar accepts, keyed by the instance); BNBC over simulated regions:
9 layout-plan views → 77 axes, seven plan windows × 11 (A–E, 1–6) at minSpacing 2438.4, S-15's
215C and S-23's 224C deferred honestly, 33 bubbles in DETAIL/STAIR_PLAN windows read by nobody;
F-RCC6 census/profile/grid byte-identical (digests quoted); 13 unit cases; a db-lane
`block-bubbles.test.ts` written. `scale-unitless` — feet-inches dimension texts cross the seam
parsed to metres (the notation grammar's one home; core parses nothing), DIMENSION_RATIO and
GRID_SPACING proposable on a unitless header, FILE_UNITS absent, 8 unit cases; MEASURED WALL: BNBC
still proposes 0 of 54 because `span` is the raw extent of the dimension's paint, which overshoots
the measured length by a constant 132 units (extension lines), so one axis's readings disagree by
1.8–2.6 % against the 1 % tolerance and fail closed; reading the span off the dimension's own
definition points (Defpoints POINT records, all 125 present) lands every feet-inches plan at exactly
0.001 m/unit but MOVES F-RCC6's rank-3 factors on three views (0.0961… → 0.1) — its own
`baseline:` increment; the act seam `affirm-scale.ts` gathers evidence itself and would refuse what
the panel offers; S-10's x readings disagree by 1.19 % because of T-DIM-OVERRIDE (14'-2" printed
over 4267.2) — the override must be an observation, not a refusal of the axis. My verification:
unit `Test Files 37 passed (37) / Tests 213 passed (213)` over views, conventions, grid, sheets,
core/scale; db lane over viewport-regions, block-bubbles, grid-backbone, caption-anchor, rebuild,
rcc6-frame-placement, sheet-index → `1 failed | 6 passed`: block-bubbles' two cases stage block
bubbles on a MODEL-captioned plan with no viewport and the regions slice left the residue's
competition reading own points only, so the five instances land in UNASSIGNED. **My ruling:** the
paint-box stand applies to the caption competition too (L-CAD-03, L-CAD-06); F-RCC6's 29 pointless
dimensions then stand in their plans' views rather than UNASSIGNED — the one lawful movement AM-01
admits (the fixture is byte-frozen; its partition is what the law derives). A fix worker (A-fix)
owns assign.ts and regions.test.ts for it.
**A-fix (done 16:52; 123,041 tokens, 65 tool uses):** `nearestAnchor` judges an entity at
`standsAt(entity, painted)`; an original with neither points nor paint stays UNASSIGNED. Measured:
F-RCC6 9 views → 8 (the 8 anchored keys, captions, classes unmoved; the 29 pointless DIMENSIONs land
10 in FOUNDATION PLAN, 10 in TYPICAL FLOOR PLAN, 2 in ROOF PLAN, 7 in SECTION A-A; "entities whose
view moved: 29; of them pointed: 0"); BNBC byte-identical (54 views, 3 UNASSIGNED). The AM-01 unit
case became three (views and every pointed entity unmoved; the movement stated exactly; the box
centre beats the vertex mean on a hand-built instance). The scale seam is unaffected (its pointless
dimensions go through `nearestViewOf`, not the assignment — two answers to one question, a
follow-up). It named a red not its own: `partition/placement/evidence.test.ts:44` (B's p6 worker)
spells "LAYOUT_PLAN" as a literal, which the view-type literal scan refuses — owed through VIEW_TYPE.
**S4b** (scale follow-up: the dimension span from its definition points, the act's evidence, the
override as an observation) is with its own worker.
**`levels-and-schedule` (resumed; done 16:55; 4/4 of run 7 then complete, 313,065 tokens over the
run, 121 tool uses):** the resumed worker found the interrupted run's edits complete and correct,
kept them, and proved them by a before/after harness with the partition frozen: BNBC's stack 0 → 8
levels (GF, 1F..6F, ROOF at 0 … 21.641, heights null, keys 1D4A..1D58); S-11's table 27 rows → 11,
C1..C7 each with four banded variants carrying a section, main bars and two tie zones (28 variants,
84 zones); `3RD & 4TH` and `ROOF-SRR` read as bands; the floor-zone corpus 12 → 17; F-RCC6 identical
line for line; the six db-lane stage scenarios unmoved (171 lines, 0 moved); unit `11 files / 179
tests` green. Two homes for the storey roster recorded as debt; S-11's variants still carry no
section UNIT (the schedule writes none) — the column rail may still answer
SECTION_UNIT_UNSTATED, a question for the spine's M3 run. What I did: ran the db-lane suites it
named, wrote I-290…I-295 into `docs/design/viewer.md` (§0 of the partition panel; I-295 in the
S-Scale §0). **The db lane over every partition, sheets, scale and scale-ui suite (17:05, no
product served): `Test Files 40 passed (40)` (41 with the one red) / `Tests 307 passed (307)`;
the red is `tests/takeoff/sheets/route-render.test.ts`, whose own `next build` fails while S4b and
B's workers still edit the tree (tsc: 3 in proposals.ts in flight, 2 in B's files) — re-run in the
spine.** Commits (17:08): `12761617` partition(views) — the door, the sheet a view stands on, the
corpus, I-290/291 (+ the viewer.md text of I-292…I-295 for the commits that follow); `6e166680`
partition(grid) — I-292; `0e2474d6` partition(notation, schedules) — I-293/294. The scale slice's
code (S4 + S4b) is committed when S4b lands.
**S4b (done 17:10; 273,341 tokens, 143 tool uses):** all three parts landed — the span between the
dimension's definition points (paint only where the drawing carries none), the act's evidence from
the module's reader registered at the module's import (`useStatedLengths`, the job seam's shape;
the router untouched because the panel's door is a server action, not the router), and the
`DIMENSION_OVERRIDE` observation (one reading stands; ≥ 2 by a strict majority; no majority →
absent). Measured: BNBC 0 → 10 views at exactly 0.001 m/unit incl. S-10 with `DXF_HANDLE:926
"14'-2""` named overridden; F-RCC6's three plans' rank-3 factors 0.0961… → 0.1 (drawn at 1:100),
five views identical; the M2 golden path affirms FILE_UNITS on F-RCC6, whose factor does not move
— no quantity, no picture moves (J-020 stages a dimensionless sheet). Its grid.ts read "axes 0" on
both fixtures because it ran detectGrid without the conventions profile — the rebuild runs
conventions first; the M3 run's job events are the fact. My verification: unit `8 files / 50 tests`;
db lane over scale, scale-ui, rails, rcc6-frame-placement and measure `Test Files 25 passed (25) /
Tests 183 passed (183)`; eslint clean. Commit `scale:` (below). I-295b recorded in viewer.md's
S-Scale §0.

## The spine (from 17:29, after the third process restart)
- **D2 committed** `85fdcae3` `cad:` (13 files; the proof lines quoted in the message from the
  worker's report; orchestrator `pnpm vitest run tests/cad` 9 files / 43 tests green).
- **M3 legs, run 1 (`scratchpad/m3/run1.log`): inconclusive, killed by the restart.** The trace
  of `m3-bill-and-schedules` leg 1 shows the prologue walked (sign-up 0.0 s, BNBC dropped 6.4 s,
  its jobs done 9.9 s, STRUCTURAL and OTHER confirmed, the set pinned 16.4 s) and
  `affirmScalesOnEverySheet` on the first card — the Model layout, 52 `viewer-scale-view` rows —
  reading each row; the `BrowserContext.pageClosed` event lands at 17:29:07, the log's last write
  and the moment the session's process died; no `Test timeout` error stands in the report and the
  levels leg's trace is empty (it never started). The "no rendered contract on
  `viewer-scale-view`.nth(N) (`data-state`)" lines are `heldAttribute` warnings (the list publishes
  no rendered contract, so three agreeing readings are taken), not failures. CORRECTED at 18:30
  after run 3: a row's `data-state` is the absence code whenever no scale of record stands on it —
  `refusal: standing === null ? absence : null` in `scale/index.ts` — so a proposing, unaffirmed
  row carries the absence code too, exactly as viewer.md "View rows" says; the Decision and the
  DOM agree, and my first reading (an absent state ⇔ a proposal) was wrong.
  Cost of the loop as written: `appears(proposal)` waits 2 s on every row without a proposal, so the
  Model layout alone costs ~2 min of the leg's budget.
- **Run 2 launched 17:31** (`scratchpad/m3/run2.log`; same two specs, `--workers 1`, bill first
  by file order).
- **p4's two db-lane reds, read and fixed in the tests** (the door is lawful): the guard's refusal
  carries `PERMISSION_NOT_HELD` as its REGISTERED code on the marker while its sentence says
  "<act> needs SET_BILL_BOUNDARY, which the actor's roles on this project do not bundle" —
  `toThrow("PERMISSION_NOT_HELD")` matched the sentence; the case now reads the code through
  `refusalCodeOf` (the cell-disposition suite's pattern). `unmeasuredCell` returned `open[0]`
  every time, so the third case's HOLD_OUT_OF_BILL fell on the cell the first case had already held
  out → `ACT_CHANGES_NOTHING`; it now takes a cell no boundary yet stands on (`measurementActId`
  and `billActId` null) — the stage holds 8 such. eslint clean; the db lane runs when the e2e
  server is down.
- **Corpora (serial, the key in my shell only; ledger costs printed under `claude-sonnet-5`, the
  pinned id — AS-05 note):** `coverage-cause` 9 fixtures recorded (7,302 input tokens; provider's
  documented total 0.000306684 USD); `boq-line-description` 4 recorded (4,715 input tokens;
  0.00019803 USD). Listings with `--limit 0`: `schedule-cell` on BNBC "7 schedule view(s), 5
  table(s), 87 data row(s), 80 contested row(s) to ask" (200A and 202D refuse
  SCHEDULE_NONE_RECONSTRUCTED); `note-clause` with `--layouts S-01,S-02` found 0 paper layouts —
  the flag matches the layout's whole name; `outline-corroboration` on F-RCC6 "233 placements, 0
  mark-anchored outlines to ask about" — being read.
- **All six corpora recorded and filed (17:38–17:52; `fixtures/model` 10 → 240 fixtures).**
  `note-clause` 38 (34,272 input tokens; provider's documented total 0.001439424 USD) with the two
  sheets' whole names; `schedule-cell` 80 (138,532; 0.005818344 USD); `sheet-revision-recency` 27
  (107,028; 0.004495176 USD); `outline-corroboration` 72 on F-RCC6 (59,462 input tokens) after the
  seam fix below. What the answers say (for the handoff, one line each): coverage-cause — all nine
  hand-authored states answer NOTHING_TO_DECLARE (confidence 0.75–1.00, mean 0.93), so the corpus
  never exercises the two declarable causes and the 0.80 floor stays a placeholder; boq —
  brickwork 250/125 chosen at 0.96, the two excavation states at 0.34/0.36 (no selecting attribute,
  as p5 said); note-clause — 37 of 38 silent clauses are NONE_OF_THESE with governs ≤ 0.12, and the
  one that is not is S-02's "LAP 50d TENSION / 40d COMPRESSION U.N.O." (DXF_HANDLE:1F76#1): kind LAP,
  governs 0.79 — a clause the GRAMMAR read nothing in, i.e. the drawing's own T-NOTE-OVERRIDE
  sentence is unread by the deterministic reader today (handoff finding); schedule-cell — the cells
  choose plausibly (mark L1/L2/LS1/BW250, section 12" x 24", main 20%%C…) while every call's
  confidence is 0.01–0.18 because `answerJudgmentOf` takes the row-header Noul's PROBABILITY as its
  confidence and the call's confidence is the weakest answer's (p2's own warning — a seam defect to
  fix before any threshold is read off this line); outline-corroboration — 72 probabilities in
  0.54–0.76 (mean 0.61; 59 inside the 0.30/0.70 band, 13 at or above 0.70, none below 0.30): the
  band does not separate F-RCC6's clean outlines, the Noul without criteria bunches near 0.6, and a
  criteria'd Noul is a new request hash and a second recording (p6's own reading, confirmed);
  sheet-revision-recency — 27 of 27 at level 4 (score 3.47–3.89, confidence 0.40–0.56), evidence
  "REV B" or the printed row, the top of the spectrum only.
- **Seam defect found by the recorder, fixed (p6's slice):** the grid keys axes by the partition's
  view key (`LAYOUT_PLAN:DXF_HANDLE:241`), a placement row by L-REG-04's identity key
  (`v:LAYOUT_PLAN:…`); `outlineEvidenceOf` compared them → 0 subjects on both drawings. Now
  `partitionViewKey(type, anchorKey)` in `views/law.ts` is the one spelling (regions.ts and
  assign.ts used it inline four times), the evidence builds the key from the row's own view, and the
  unit test stages the two keys apart with a guard case. `pnpm vitest run` over placement + views
  "4 files / 36 tests", evidence.test.ts "9 passed"; eslint clean; F-RCC6 lists 72 outlines.
- **I-numbers:** p3 wrote I-296 and I-297 in s-schedules.md while p4 wrote I-297 in s-coverage.md;
  p3's second is renumbered I-300, and p2's Interpretation (returned in its report, not written) is
  recorded as I-301 in s-schedules.md §0 by me. p7's text is carried in the handoff (no screen).
- **Corpus acceptance case:** `tests/ai/coverage-cause.acceptance.test.ts` "no recording and no
  key means FIXTURE_MISSING" asked over the corpus's first committed state, which replays now; it
  asks over a storey the nine states never name. The corpus unit suites: "Test Files 3 passed (3) /
  Tests 13 passed (13)"; the wider run over tests/ai, src/core/model, notes, coverage, boq,
  catalogue, cell-reading, refusal-register, core-db-split: "45 files / 332 tests" green after it.
- **Staging cost (golden-run.ts):** `affirmScalesOnEverySheet` read every row's proposal with a 2 s
  `appears` wait; it now skips rows whose `data-state` is rendered (affirmed or an absence code) and
  reads a proposal only where the state is absent — the row that proposes. Proved by the next run.
- **M3 run 2 (`scratchpad/m3/run2.log`, 17:31–18:03): the bill leg TIMED OUT at 30.0 min inside
  that loop.** Its trace (4,482 actions over 1,799 s): 16 sheets opened, first paint ≤ 0.4 s each,
  and 1,368 s in `waitForSelector viewer-scale-view >> nth=N >> viewer-scale-proposal` — the 2 s
  wait, once per refused row, on every sheet, because the scale panel lists the whole record's 54
  views on every sheet and only 10 of them propose (S4b's own count). I stopped the run at 18:03
  rather than let the levels leg walk the same staging; the stop closed its page at 1.3 min. The
  loop now reads every row's `data-state` in ONE settled reading (`everyAttribute`, the support's
  own bulk read) and reads a proposal only where the state is empty; eslint and tsc clean. Run 3
  launched 18:13 (`scratchpad/m3/run3.log`).
- **The db lane over the whole tree (18:04–18:13, no product served): `Test Files 1 failed | 230
  passed (231) / Tests 3 failed | 1366 passed (1369)`, wall-time 79.92 s.** The door test is green
  (the marker read). The three reds are all `cause-outcome.db.test.ts` and all mine: the stage
  "coverage-cause-outcome" is a REAL staged campaign holding exactly two CELL-grain cells
  (rcc.concrete and rcc.rebar on the registered column's GF), so "a cell with both axes open" ran
  out at the third case and the calibration case counted no awaiting proposal. `unmeasuredCell` now
  takes the AXIS the case's act moves (`"bill"` for HOLD_OUT_OF_BILL, `"measurement"` for
  DECLARE_NOT_IN_PROJECT_SCOPE) and filters on that act id alone — a cell held out of the bill can
  still be declared out of scope, which is the second case's own intent. Re-run after run 3.
- **M3 run 3 (`scratchpad/m3/run3.log`, 18:13–18:25, wall-time 726 s): the levels-and-notes leg
  is GREEN (✓ 3.4 s on the staged run — the proposed stack was offered and confirmed whole, the
  notes transcribed); the bill leg reached Measure in under three minutes, the measure run
  SUCCEEDED, and the register counted "0 of 0 lines" for its 600 s wait.** The run's database
  says why (read-only psql of `cubit_e2e`, nothing served): placements 204, grids 77 axes (two
  deferrals GRID_NO_BUBBLE_EVIDENCE on 2157 and 2247 — S-15's 215C and S-23's 224C, as A
  measured), levels 8, register_objects 204, schedules 5, member_types 60, notes_readings 9,
  quantity_lines 0, rail_observations 588 — VIEW_SCALE_UNAFFIRMED on pile, pile_cap and column
  for every kind (89 each on the piles, 26 on the columns), REBAR_SCHEDULE_UNREAD on column
  rcc.rebar (26), LINTEL_SOURCE_ABSENT (2) — and scale_affirmations 0: my first bulk-read loop
  clicked nothing (trace: 28 sheets opened, 0 proposal reads, 0 member clicks, 0 affirms), because
  an unaffirmed row carries the absence code (above). The loop now takes three settled readings
  per sheet (states, view keys, and the keys of the rows holding a proposal — each proposal's own
  ancestor row) and clicks a row that is unaffirmed AND proposes. eslint and tsc clean. So the
  door's own facts are already in the database: the columns are placed (204) and registered,
  the grid is read (77 axes), the stack stands (8); what the rails wait for is the affirmation act.
- **M3 run 4 (`scratchpad/m3/run4.log`, 18:29–18:32, 2.4 min): the levels leg green again (3.6 s);
  one AFFIRM_SCALE act naming ten views at DIMENSION_RATIO (the seven layout plans 10C1, 1FEB, 202C,
  2073, 20B6, 2116, F31, two details, one stair plan); the measure run published 60 lines** —
  pile_cap × {earthwork.excavation, pcc.blinding, rcc.concrete}, 20 each, PARTIAL_DECLARED with no
  value — and the rails observed MEMBER_TYPE_UNKNOWN on pile/pile_cap (the pile schedule is not a
  read the reconstructor makes), SECTION_BAND_UNCOVERED and REBAR_SCHEDULE_UNREAD on the 26 columns,
  LINTEL_SOURCE_ABSENT ×2. Every registered object stands on NO level (`level_label` empty, the
  columns `@UNRESOLVED`, the piles `@FOUNDATION`): the column layout plan's expansion is deferred
  TYPICAL_RANGE_UNSTATED (20B6), and the staging's `authorTypicalRanges` found no row to author —
  the levels rail is the CAMPAIGN's index by Decision (s-levels I-240; `levelsViewOf` lists unstated
  ranges only under an open campaign), and the staging authored them before the first Measure. The
  leg itself failed earlier than that on its own locator: `levelStack.or(tree)` resolved to two
  elements under strict mode → `.first()`. Staging reordered as a customer walks it: press Measure,
  state the ranges the run deferred on the levels rail, press Measure again (`pressMeasure`,
  `authorTypicalRanges` answering its count); eslint and tsc clean. Run 5 launched 18:38.
- **M3 run 5 (18:38–18:41): the levels leg green (3.6 s); the bill leg past the register count (60
  lines) and red on its column filter, "0 of 60 lines" — the range was still not authored.** The
  run-4 trace's captured DOM of the levels screen shows the rail DID list one row, captioned
  `v:LAYOUT_PLAN:DXF_HANDLE:20B6` beside the drawing's IdChip: `unstatedRangesOf` keyed the captions
  map by the partition's view key while an expansion deferral names its view by L-REG-04's ADDRESS
  (`v:`-prefixed) — the same two-spellings seam as `evidence.ts`, a third instance this session. The
  captions are now keyed by `viewAddressOf(view)` (`@/core/views`, the one function deriving the
  address). eslint and tsc clean; the db-lane door test asserts only code and key on ranges (its
  stage defers none), so the journey is the proof. Run 6 launched 18:46.
- **M3 run 6 (18:46–19:08, stopped by me): the range WAS found and authored (typical_ranges 1);
  the second Measure press created no job** (pg-boss: the last measure job 18:41:47 — the first
  press) and the leg spent its two 600 s waits on a run nobody started. Reproduced on the served
  product with the run's own cookies (probe server on 3211, scratch `probe/register-load.mjs` and
  `probe/measure-press.mjs`): the register renders ready in 0.7 s with 60 lines and an enabled
  door; a press by the probe DID start a run (19:10:54, completed) — so the leg's press was
  swallowed, most likely landing before hydration. `pressMeasure` now settles the screen before
  the press and asserts within 30 s that the tracked timeline holds the press's own step (the
  timeline follows only the runs the screen session started), so a swallowed press is red in
  seconds. Noted: `register-workspace` resolved to TWO elements on `/takeoff/register` in an
  unscoped read (one under `shell-main`); the page object scopes to the frame.
- **What the second run published (19:10): still 60 lines, all pile_cap PARTIAL_DECLARED; every one
  of the 182 expanded columns (26 × GF..6F, ordinals 0–6 — the expansion over the authored range
  stands) observes SECTION_BAND_UNCOVERED and REBAR_SCHEDULE_UNREAD.** Cause, read in the code:
  `placedBy` (core/offers/contract.ts) places a band's end by label EQUALITY against the stack, and
  S-11's bands are ordinal words ("GF TO 2ND", "3RD & 4TH", "5TH TO 6TH", "ROOF-SRR" — the fixture's
  own trap T-NOT-RANGE-GF3) while the stack the section proposed is labelled "GF, 1F..6F, ROOF";
  `normaliseMark("3RD") ≠ normaliseMark("3F")`, and the expansion's `levelLabelled` compared the
  same way. **Fixed as one reading, one home:** `sameStorey(a, b)` in the notation grammar (the named
  levels, or equal ordinal counts — 3RD = 3F; a word the grammar cannot read meets only itself, so
  "SRR" places nowhere), registered with core's placement at the grammar's load through
  `useStoreyEquivalence` (the I-295b seam pattern — core parses nothing, rails import nothing of the
  partition under `cubit/boundaries`), `placedBy` trying the label verbatim then the reading, the
  expansion's `levelLabelled` reading through `sameStorey`, and `measure/setup.ts` loading the
  grammar so every measuring process has it. Tests: `tests/takeoff/partition/notation/same-storey.test.ts`
  (the reading and core's placement through it) and a case in `tests/takeoff/sweep/variant-covering.test.ts`
  ("3RD & 4TH" covers 3F and 4F; ROOF-SRR judges nothing). Unit: notation + sweep "3 files / 101
  tests"; rails, rebar, expansion, measure, offers "16 files / 100 tests"; eslint and tsc clean.
- **The door after that one — the section's UNIT.** S-11 states none on the pair ("400x400") or any
  header, so `registry.ts:426` stores `section_unit` null and the frame rail will answer
  SECTION_UNIT_UNSTATED. The drawing declares it: S-01 clause 4 "ALL DIMENSIONS ARE IN MILLIMETRES
  UNLESS FIGURED IN FEET AND INCHES" (DXF_HANDLE:1F3E), and twelve headers carry "(mm)"; the
  manifest records the COLUMN SCHEDULE view's unit as mm. Delegated at 19:24 to an Opus worker
  (B8) as a CONVENTION of the drawing (L-CAD-08): census counts the declaration, the resolver
  carries `dimensionUnit` with its source key (seed corroborates, never adds), the registry takes it
  as the last fallback for a unitless pair citing the declaration, F-RCC6 byte-identical, I-302 in
  viewer.md; no lane, no commit. **Done 19:45 (253,686 tokens, 158 tool uses, 21 min):** census
  counts `ALL DIMENSIONS [ARE|SHALL BE|TO BE] IN <unit>` over model AND paper texts through
  `clausesOf`; `dimensionUnit` on the profile (null on disagreement; seed invariant kept; stored
  profiles without it still read back); `unitOf` in the registry (cell → head → declaration),
  the declaration's key cited on the variant only where it answered; rebuild hands the profile to
  `registerMemberTypes`; the outline recorder too; `reconstructSchedules` takes none (nothing in it
  reads a unit). Measured: BNBC dimensionUnit mm ← DXF_HANDLE:1F3E; 79 of 81 variants null → mm
  (PC3 and S3 have blank SECTION cells); C1/GF-2ND cites 9DC, 9DD, 9DE, 1F3E; no variant reads inches;
  F-RCC6 dimensionUnit mm ← 671 and its 18 families byte-identical (digest 6eb675d4… both sides).
  Unit: "19 files / 211 tests", "122 / 784", "102 / 651", tsc clean, eslint clean; three db-lane
  suites re-written to the new fact (schedules.test.ts ×3, resolve.test.ts). It warns the BNBC
  column rails' db-lane suites (`rcc6-bnbc-column-band`, `column-concrete-offer`, …) and the golden
  lane may move figures now that columns publish — the door's point, read in the db lane next.
- **Whole-tree lanes with every door in place (19:46):** `pnpm test:db` "Test Files 231 passed
  (231) / Tests 1369 passed (1369)", wall-time 114.23 s (no BNBC rail suite moved); `pnpm test`
  "502 files / 3242 tests"; `pnpm lint` 0 errors / 161 warnings; `npx tsc --noEmit` clean.
- **Commits 19:47–19:52 (sixteen):** `e1da70df` p2, `dd203d29` p3, `75dbdb91` p4, `47328831` p5,
  `9ff88c46` p6, `5f68e6c1` p7; the six `baseline(corpus):` commits `df4bbfc6` (schedule-cell),
  `512c8a66` (note-clause), `0a707229` (coverage-cause), `5d113f6c` (boq), `6feb7964`
  (outline-corroboration), `86b4710f` (sheet-revision-recency), each with a roster holding only
  the questions committed so far (scratch `corpus-commit.mjs` split the roster; the last equals
  the filed roster byte for byte); `0769ef26` takeoff(levels); `8332c81f` the storey bridge;
  `42a5ad5b` the declared unit; `de58f872` toolchain(probe).
- **M3 run 7 (19:41–19:52, stopped by me): the same shape as run 6** — first Measure 19:44:20
  (60 lines), AUTHOR_TYPICAL_RANGE 19:44:21, 182 columns on seven storeys, both "nothing to author"
  lines by 19:44:32, then nothing: no second measure job by 19:52, no failure. The served pages
  answered curl in 0.10 s (register, 730 KB) and 0.05 s (levels); a fresh browser walked levels →
  takeoff → register with rAF and timers answering in milliseconds (scratch
  `probe/levels-then-register.mjs`). So the leg's own tab stops answering after the range act, and
  `@playwright/test` sets NO action or navigation timeout by default — a blocked tab holds a step
  for the leg's whole budget with nothing named (this is also run 6's twenty-five minutes). Fix in
  the staging: `capActions(page)` — `setDefaultTimeout` and `setDefaultNavigationTimeout` at 60 s
  for the M3 staging (an expectation that lawfully waits longer states its own) — so a hang is red
  in a minute with the action's name. Run 8 launched 19:55 with `CUBIT_E2E_TRACE=on`, so the
  blocked action is read off the trace rather than guessed.
- **M3 run 8 (19:55–19:58, 3.2 min): the levels leg green (3.8 s); the bill leg RED in 3.0 min with
  the action named — `locator.click: Timeout 60000ms exceeded — waiting for
  getByTestId('register-measure')`.** The failure screenshot shows the register fully rendered (60
  lines, ready) with NO Measure door and NO revision chip in the tabs row. Reproduced on the served
  product with the run's cookies (scratch `probe/takeoff-aside.mjs`, `aside-storage.mjs`,
  `aside-mutations.mjs`): the FIRST visit of a browser context renders the aside ("Pinned revision
  4f6fdbd · Measure this campaign"); every later visit — direct, through /takeoff, in a new page of
  the same context — renders none; clearing localStorage brings it back; a new context has it once.
  The key is `cubit.datatable.v1:takeoff-register-lines` (the grid's remembered furniture). A
  MutationObserver from document start: on both visits the register stands TWICE for ~100 ms
  during hydration (`workspaces=2 states=ready/ready` at 163–230 ms, one at 337–387 ms); on the
  first visit the aside receives its content at 387 ms after the duplicate is gone; on the second
  it never does. The tabs slot (`useTakeoffTabsAside`) was one value — set on mount, null on
  unmount — so the transient mount's cleanup emptied what the live mount had set once the stored
  furniture moved the order. A customer's second visit to the register had no Measure door.
  **Fixed:** the slot is a registry of live mounts keyed by `useId()` (mount/unmount; the newest
  live contribution shows; leaving the surface still empties it); eslint and tsc clean. The
  frame's own slots (`useShellToolbar`, `useShellStatus`, `useInspector` in `src/ui/shell/slots.tsx`)
  carry the same one-value shape and are recorded as the next defect of this class (the tabs row
  itself survived both visits, so nothing is moved there blind). Not a hydration error: no console
  error or warning on either visit; the duplicate is the streamed boundary's swap.
- **M3 run 9 (20:25–20:29, 3.2 min) with the registry slot: the same red** ("waiting for
  getByTestId('register-measure')"), on a build that carried the registry (the e2e server reused
  the probe server's build of 84 s before). So a registry keyed by mount does not reach the cause,
  and the effect-driven handover itself is what the hydration window defeats. **Second fix, the
  one that holds by construction: the aside is DRAWN IN PLACE** — `useTakeoffTabsAside(node)` now
  answers a portal into the host element the lane's own row renders for it (`TabsHostContext`, the
  host set by the aside element's ref), and the six surfaces render what the hook answers
  (register, schedules, coverage, bbs, levels, boq screens: `return useTakeoffTabsAside(…)`); the
  row no longer re-makes itself on a surface's change. Unit: `tests/ui/takeoff-register/tabs-aside-registry.test.tsx`
  "1 file / 4 tests" (a surface draws and leaves; two standing surfaces and the first leaving; the
  newest leaving; a node that changes is replaced, never doubled); eslint clean; tsc clean. Run 10
  launched 20:36 with tracing on.
- **M3 run 10 (20:15–20:19, 3.0 min): THE FIRST BILL LEG IS GREEN** — "✓ J-000 m3-bill-and-schedules:
  the structural campaign is measured on F-RCC6-BNBC and the register is reviewed (2.3m)" beside the
  levels leg (4.6 s). The run's database: two measure runs (20:17:41, 20:17:55), and
  `column | rcc.concrete | COMPLETE | 182 lines | 92.21 m³` — the drawing's columns placed, expanded
  over GF..6F, banded by S-11's ordinal words, sized in the millimetres S-01 declares, and measured;
  `column | rcc.rebar | PARTIAL_DECLARED | 182` (REBAR_SCHEDULE_UNREAD stands), the pile caps
  PARTIAL_DECLARED as before. **The second leg (the BOQ draft emitted, the XLSX opened, the golden
  read) failed in 16 s at its `j-000/boq-draft` checkpoint's axe run:** "serious color-contrast …
  .cx-boq-document-link … insufficient color contrast of 3.94 (foreground #6e63c8, background
  #0c0e11)" — the issued document's link wore `var(--accent)` (the beam mid-tone) as text ink;
  it now wears `--ink-link`, the alias layer's readable link ink (`src/ui/tokens.ts`). Eight other
  stylesheets colour a text with the accent and are recorded for the next craft read, not moved
  blind. Run 11 launched 20:43.
- **M3 run 11 (20:20–20:23, 2.9 min): leg 1 green (2.3 min), the levels leg green (4.9 s); leg 2
  past its checkpoint (axe clean) and RED on the golden band:** "COLUMN|RCC_CONCRETE|GF: product
  16.975 · golden 16.828 · 0.87 %", 1F/2F 15.433 vs 15.225 (1.37 %), 3F/4F 12.224 vs 12.017
  (1.72 %), 5F/6F 9.967 vs 9.761 (2.11 %). Read against the generator's model
  (`fixtures/rcc6-bnbc/model.json`, members `COL:<stack>@<level>`): the model's GF sum is 16.974 —
  the product's figure — and the golden's 16.828 differs by exactly C7's circular area (π·0.45²/4 vs
  0.45²) × 3.3528 = 0.146 m³ (the drawing: "C7 %%C450 PORCH COLUMN", T-NOT-PCTC); on 1F..6F the
  product carries C7 (0.617 m³) over every storey and lacks C5 at B4 ("C5 FLOATING COLUMN OVER TG1
  (STARTS AT 1F)", 0.4115 m³): 0.617 − 0.4115 = 0.206 = the measured excess. Two doors of their
  own: the circular section (grammar + frame rail) and a member's own storey range (the
  placement/expansion stage). **Decision:** legs 2 and 3 return to the roster as `MISSING DOOR:`
  fixmes naming both; leg 1 is split into its own leg file `m3-measure-and-register.spec.ts`
  claiming "run the structural campaign on F-RCC6-BNBC; review the register" (the J-000 roster law
  admits no running test in a file that names a missing door), the bill file claiming the three
  document segments. `pnpm vitest run tests/journeys` "13 files / 136 tests" green; eslint and tsc
  clean.
- **M3 run 12 (20:56–20:59, the pre-split layout): "2 passed, 2 skipped" — leg 1 ✓ 2.2 min, the
  levels leg ✓ 3.9 s, the two fixmes skipped.** Commits `ef3bb0b5` takeoff(nav) and `c552d5da`
  craft(boq) landed at 20:55.
- **21:00 — the owner's message: stop after the final M3 run; the Fable allowance ends; the next
  session is Opus 5.** Final run 13 launched 21:02 over the three M3 leg files as committed;
  `~/.claude/settings.json` given `"model": "claude-opus-5"` (the worker model and the orchestration
  flags kept); CLAUDE.md given a "Standing facts from session 5" section at the owner's ask; the
  session-6 prompt rewritten for an Opus 5 orchestrator; the handoff §4 and §5 state plainly that
  the craft walk and `pnpm gate` were not run at the end.
- **M3 run 13 (21:02–21:05, the committed layout, `pnpm e2e --journeys J-000 --workers 1
  tests/e2e/journeys/j-000/m3-measure-and-register.spec.ts tests/e2e/journeys/j-000/m3-bill-and-schedules.spec.ts
  tests/e2e/journeys/j-000/m3-levels-and-notes.spec.ts`): "✓ J-000 m3-levels-and-notes …", "✓ J-000
  m3-measure-and-register: the structural campaign is measured on F-RCC6-BNBC and the register is
  reviewed", "2 skipped / 2 passed (2.3m)", "e2e J-000 workers=1 wall-time 138.41s", EXIT 0.** The
  M3 journeys commit and the documents commit close the session; the tree is clean but for the
  owner's untracked leavings.
- **Probes (D): the runbook's `pnpm probe -- signin` is wrong for pnpm 10 (the `--` reaches the
  script as "unknown mode"), and `probe.mjs` makes `--out` a DIRECTORY in every mode (line 180), so
  signin's `--out cookies.json` is created as a directory and the write fails EISDIR** — a
  toolchain finding in a script this session owns (f9d119b8); fixing it under the toolchain tag.
  Fixed (probe.mjs makes the directory for walk/run only, signin makes its file's parent; README
  drops the `--`), eslint clean; `pnpm probe signin … --out test-results/probe/d/cookies.json` →
  "OK signin tenant-w0@seeded.cubit.test cookies=test-results/probe/d/cookies.json".
- **Probe results (19:31–19:38, served product on 3211, the run's own database):**
  `http-tamper` — "OK tamper offset=128454 byte=0x31->0x30"; "OK digest-parity status=409
  refusal=DIGEST_MISMATCH expected=DIGEST_MISMATCH/409 receivedBytes=256909 sent=0"; "OK
  session-after-refusal status=200 state=refused … complete=false"; "OK stored status=200
  complete=true receivedBytes=256909 … format=dxf server-digest=e7bd56b8… matches-decl"; "OK
  http-tamper verdicts=2 red=0". `bnbc-viewports` — "OK roster sheets=27/27 views=53/53"; upload
  1,409,854 bytes stored in 531 ms; ingest succeeded; 28 cards, 28 layouts with a door; S-10, S-12,
  S-15, S-25 painted (first paint 230–308 ms, renderer webgl, every entity drawn; the partition panel
  read "ready views=54" on S-12/S-15/S-25 and "empty views=0" on S-10 — S-10 was opened first,
  seconds after the ingest, before the rebuild had settled; a timing read of the probe, not a
  product fact, re-read on the next walk); "OK total sheets-read=27/27 windows-with-paint=53
  declared-views=53 expected=53"; "OK bnbc-viewports verdicts=5 red=0". `reference-sheets` —
  ARCHITECTURE.dwg "RED ingest status=refused refusal=SHEET_NOT_INGESTABLE cad=HANDLES_NOT_UNIQUE"
  with D2's CONVERSION_SHORTFALL notes now in the cause (3DFACE 246 → 0, ARC …): the honest refusal,
  as ruled; ELECTRICAL.dwg ingested in 25.1 s, 2 cards, and painting its "model" layout CRASHED the
  tab ("mouse.move: Target crashed" — 10,583 entities, 122,285 derived under SwiftShader), after
  which the probe's one page was dead and PLUMBING, the General Note and the Structural drawing read
  "page.goto: Page crashed" without being walked: one real finding (the viewer on a 120k-record
  sheet in software GL) and three files still unwalked — the script opens one page for all five;
  a per-file page is the next probe's fix, recorded in the handoff. **Walked again one process each
  (`PROBE_REFERENCE_ONLY`, 19:40–19:44):** General Note_Edison Lavinia.dwg "RED ingest
  status=refused refusal=SHEET_NOT_INGESTABLE cad=HANDLES_NOT_UNIQUE … 16 handle(s) are stated more
  than once, first B07B" (D2's honest refusal, through the product); PLUMBING.dwg ingested in 17.9 s,
  2 cards, model layout 103,583 entities all drawn, first paint 673 ms, frame median 41.3 ms / p95
  47.4 ms (RED against the viewer's 16.7/33 ms budgets — software GL), Layout1 235 entities at
  16.7/17 ms (OK); Structural Working Drawing_Edison Lavinia_Final.dwg ingested in 23.0 s, 1 card,
  61,460 entities drawn, first paint 1,003 ms, median 79.9 ms / p95 86.6 ms (RED, software GL),
  "OK l-cad-09 biggest-sheet-entities=61460 pinned>=22000". Every reference sheet is now read: two
  refuse by name, three paint whole; the frame budgets are the card's to meet, not SwiftShader's.

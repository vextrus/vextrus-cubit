# Fable 5.1 — session 4 handoff

**Branch** `dev-lane-and-jev` (main `8cf9f11f`, never touched). Session 4 started at `b68789c4`
and ends at the commit that carries this file. Every lane in this session ran **by shell**:
`mcp__builder__check` and `mcp__builder__scratch_dir` were not available, so each verdict below is
the lane's own line as `pnpm <lane>` printed it. This session had web access and read the live
TypeSafe documentation; no lane reached the network at any point, and the key was never printed,
written or committed.

The goal was M3 on the golden path (F-RCC6-BNBC by clicks), Jev as the product's programmable
judgment at every closed question up to M3, the craft table to the bar, and the rest of session 3's
section 7 except M4. What landed, what did not, and why, is below — the M3 leg found four product
defects and one missing door, and the door is the session's largest single finding.

## 1. What was proved, per journey

Verdicts are the gate's (`pnpm e2e`, `pnpm e2e --journeys J-000`, section 5). "Walk" is the probe's
verdict on the screen the journey lands on after this session's fixes; the craft numbers are in
section 4.

| Journey | Spec | Shipped verdict | Walk / notes |
| --- | --- | --- | --- |
| J-000 M0–M2 | `journeys/j-000/m0-*`, `m1-*`, `m2-*` | green | unchanged by this session; the prologue is walked again by every run of the lane (`test-results/` is cleaned), which is why an M3 run is thirty minutes |
| J-000 M3, first leg | `journeys/j-000/m3-levels-and-notes.spec.ts` | green — WALKED | F-RCC6-BNBC uploaded through S-Home and the Dropzone into a second project, disciplines confirmed, a set pinned, scales affirmed on every sheet that proposes one, the eight-level stack inserted by hand (the section proposes none in the lane — section 7) and every storey height transcribed, the general notes of S-01 and S-02 transcribed; checkpoints `j-000/levels-transcribed`, `j-000/notes-transcribed` at budget 0 |
| J-000 M3, second leg | `journeys/j-000/m3-bill-and-schedules.spec.ts` | `test.fixme` — MISSING DOOR (section 7) | the walk after Measure — the register, the unpriced BOQ, the XLSX by exceljs, the BBS, the two goldens through `goldenRows` — is written and waits for the partition's viewport-caption door |
| J-000 M4 | `m4-sheet-and-manual-measure` | `test.fixme` — MISSING DOOR | not built this session, by the prompt |
| J-032 | `j-032-schedules-notes.spec.ts`, `schedules.spec.ts` | green | the schedules rail's rows no longer overlap (commit `a8a256c8`); the rail's and the BBS toolbar's pictures re-taken, both themes (`3edd24a8`, `6cf8daae`) |
| J-003 / S-Audit | `audit.spec.ts` | green | the act log is a grid and the ledger reads itself (I-37, I-38); no picture of this screen moved in the session's sweeps (`s-audit/explorer.png` last re-taken in `632125c1`, before this session) |
| J-010 | `journeys/j-010-upload.spec.ts` | green | the card's picture masks the scale and the views lines and waits for no partition (I-284); its picture re-taken twice (`6cb3c180`, `00706174`) |
| J-012 | `journeys/j-012-sets.spec.ts` | green | reads the set's and the revisions' digests as their chips' values (I-107) |
| J-304 | `ruleset-author.spec.ts` | green | reads the pinned edition's digest as its chip's value and waits for it to move (I-155) |
| J-003 / participants | `participants.e2e.ts` | green | the history cell's ink 5.96:1 against 4.24; the roster frame sixteen rows, the screen under twice the viewport (I-214) |
| J-021 | `viewer-partition.spec.ts` | green | the panel's head stands above a focusable scrolling body and the AC-5 walk passes the rows' chips (I-190); both panel pictures re-taken (`3edd24a8`, `6cf8daae`) |
| J-011 · J-020 · PERF-011 | `j-011-viewer`, `j-020-snapping`, `viewer-perf` | green | red once at their first checkpoint under `b5194d44` (a squeezed body with no stop of its own), green from `8feb3cd5` |
| every other journey | as session 3 listed them | green | see section 5's sweep line |

## 2. What was fixed (commit · clause · test)

In order of landing. Each commit's message carries the finding, the reading and the proof.

| Commit | What | Clause | Test |
| --- | --- | --- | --- |
| `56700073` | **the bar schedule's export door**: a keyed `bbs-render` job, filed in Documents as its own kind, DRAFT — UNSIGNED; S-BBS gains its primary door, the job strip and the document link | R-TO-054, A-BBS-PDF, AM-05, AM-11 §2, AM-17, I-bbs-8 | `tests/takeoff/bbs-ui/export-door.db.test.ts`, `export-door.test.tsx`, `view.db.test.ts` |
| `a8a256c8` | **the partition write refused a sectionless registry row** (BNBC's pile-cap schedule leaves PC3's and S3's SECTION blank; the variant cited nothing; the store's belt refused the whole write; the drawing stood with no partition) — the variant now cites its mark cell | R-TO-031, L-QTY-03 | `tests/takeoff/partition/schedules/registry-cited.test.ts` |
| `a8a256c8` | **the caption grammar read no LAYOUT as a plan** ("TYPICAL FLOOR BEAM LAYOUT", "ROOF BEAM LAYOUT (AT ROOF LEVEL)") | L-CAD-06 | `fixtures/view-captions/rcc6-bnbc.json` (+5, the ratchet grows), `caption-grammar.test.ts` |
| `a8a256c8` | **the schedules rail wrapped one sheet's name over the next**, so a click aimed at S-01 landed on S-02 | R-UI-005, R-UI-060 | the M3 leg's second run (`test-results` trace, in the commit message) |
| `ca1e4316` | **the notes grammar read a stirrup clause's 2D as a lap** (S-02's DETAILING NOTES say "NO LAP WITHIN A BEAM-COLUMN JOINT" and, two paragraphs on, "STIRRUP ZONES: 2D"; the tension lap stood SUSPENDED against the sheet's own 50d) — a lap is read from the clause that names it | R-TO-034, L-MEA-01 | `tests/takeoff/notes/grammar.test.ts` (the 1F75 text verbatim) |
| `d4931680` | `viewer-status` carries the rendered contract (`data-rendered-region`, `pending` → `settled`) | AM-09 §2, I-189 | the journeys' `settled()` |
| `90ced636` | seven unit-lane re-baselines the session's own commits owed (the BBS lane in two rosters, the ledger's names in the db barrel, digests and calibration keys read as chips, no view type spelled in a seam test) | B-20, L-CAD-06 | the eight suites named in the message |
| `fd653d9d` | **S-Audit's Decision §1 spelled the explorer's layout a second way** — the layout line states the grid's own measure, as I-38 rules it | B-17, I-38 | `docs/design/s-audit.md` (a document, no test) |
| `09c2f90f` | **the M3 legs** — `golden-run.ts` gains bnbcRun, bnbcTranscribed and bnbcMeasured; the first leg runs, the second stands as `test.fixme` behind the door it names (sections 1 and 7); `m3` SHIPPED on the roster | AM-17, AM-09 §2, AM-05, L-QTY-06, R-TO-030 | `m3-levels-and-notes.spec.ts` (1 passed, 20.8m); `tests/journeys` + `tests/golden`, 16 files / 148 green |
| `c1c1d40b` | **the participants roster's frame stood one row deep, and a sheet card's facts read as a paragraph** — a twenty-row frame; the facts a `role="list"` of five | AM-08 Part 2 C1 and C7, I-214, I-96 | drawings `__tests__` + `tests/ui/s-drawings`, 5 files / 21 green |
| `e414d055` | **one deep import under `tests/`** the gate's lint lane refused — the roster test reads the question names through the seam's barrel | L-AI-01, `cubit/no-model-outside-seam` | `tests/ai/model-corpus-roster.test.ts`, 3 green; eslint 0 problems |
| `bf3c1909` | **the gate crashed on ENOENT after the sweep cleaned its log directory** — the directory is made again before every lane's log opens; and J-012 read the revision digest's text whole where the digest has been a chip since `878ac3cd` | C-06, I-107 | `scripts/gate.mjs`; `j-012-sets.spec.ts` (the sweep, section 5) |
| `3edd24a8` | **baseline** — four pictures the session's lawful changes moved, re-taken from the sweep by `pnpm e2e:retake -- --write`: the BBS toolbar (the export door), the schedules rail (one row a sheet, twice), the partition panel's keys as chips | B-20, AM-09 §4 | the sweep of section 5, its bands in the message |
| `c5d98ffb` | **four journeys read digests as text where a chip carries them, J-010 waited on the partition's clock, and the participants screen failed its own capture** — the sets suites, J-012 and J-304 read `data-value`/`data-digest`; the drawings order test asserts I-97; J-010 masks the views line and waits for no partition (I-284); the history cell's ink 4.24:1 → 5.96:1 (axe serious color-contrast); the roster frame twenty → sixteen rows (1812 px against the 1800 cap) | I-107, I-155, I-284, I-214, I-97 | `screens.test.ts` + `route-render.test.ts` 10 green (db lane); J-012, J-304, J-003 green alone; J-010 green but for its moved picture (and see `d0920d87`) |
| `6cb3c180` | **baseline** — J-010's card picture, 308×751 → 308×702: the facts one list line (I-96), the views line masked (I-284) | B-20, AM-09 §4 | the four-journey run, bands in the message |
| `d0920d87` | **the card's scale line is the partition's answer too** — the first re-take read `9 of 9 views have no scale of record` where a card pictured before the answer reads otherwise; J-010 masks `sheet-card-scale` beside the views line and I-284 names both | I-284, L-CAD-07 | J-010 alone: red on the picture alone, one band (the scale line) |
| `00706174` | **baseline** — J-010's card picture, re-taken with the scale line masked; one band, y 393-410 | B-20, AM-09 §4 | the J-010 solo run, in the message |
| `6cf8daae` | **baseline** — the second picture of three journeys (`s-bbs/schedule-light`, `s-schedules/tables-light`, `viewer-partition/panel-dark`), moved by the same changes as the first; a red first picture ends a test before its second, so the sweep could only show one of each pair | B-20, AM-09 §4 | the first full gate's e2e lane (red on exactly these three), the three specs alone |
| `b5194d44` | **the partition panel's chips broke J-021 twice over** — the AC-5 walk expected the confirms straight after the toggles, and axe read a serious `target-size` at `j-021/partition-confirmed`: the first row's copy target half under the sticky head once the list had scrolled. The head now stands above a scrolling body (the rows' chips give the scrolled region its focusable content), the chip's measure wears the reticle, and the walk passes through every row's two stops in DOM order | I-190, AC-5, R-UI-082 | J-021 alone: 1 passed (19.4s), no picture moved; `tests/takeoff/viewer-partition-overlay` + the IdChip and s-audit suites 7 files / 40 green |
| `8feb3cd5` | **the body-as-scroller of `b5194d44` failed J-011, J-020 and PERF-011 at their first checkpoint** — on the 100k sheet the layers list takes the stack's room, the body is squeezed to 43 px and overflows while loading or empty, holding no stop at all (axe serious `scrollable-region-focusable`). The body takes focus itself (`tabindex=0`, reticled), the stop after the two switches | I-190 | J-011, J-020, J-021 alone: 3 passed (35.0s); `pnpm test:perf` 2 passed (20.1s); no picture moved |

## 3. What was built

### 3.1 The Jev programme — logic-point 1 of 7, and the pattern (commits `b90b82dc`, `e8b7fae6`)

**The contract.** `src/core/model/typesafe.ts` speaks the HTTP contract the docs state
(docs.typesafe.ai/api, read 2026-09-21): `POST /v1/systemone`, bearer key, `{model, state,
questions}` in, `{answers, usage, model}` out. Every instruction now names the state it reads by its
backticked field path (`candidates`, `layout`, `caption`) and carries the question's whole meaning;
the no-match outcome is offered where nothing may fit (`NONE` for a sheet number, `UNTYPED` for a
caption). What Jev says of its answer — the provider it reports (`jev-1.13.0` under the alias
`jev-latest`), each answer's `confidence` and `probabilities`, the call's confidence as the weakest
answer's — is read as the contract spells it and never supplied where absent.

**The ledger.** Migration `0054_jev-ledger-outcomes`: `model_calls.question` (the closed question a
call put — `MODEL_QUESTIONS` in `src/core/model/questions.ts`, never hashed into the request's
identity) and `model_calls.judgment` (json); and `model_call_outcomes`, append-only, one row per
person's judgment of a proposed call — CONFIRMED, OVERRULED, REPUDIATED, AFFIRMED — keyed to the
call by the composite (tenant, call) key, wearing the seam's full posture (RLS forced, the
append-only belt, SELECT+INSERT). Writers: `recordDisposition` (accepted/edited/rejected →
CONFIRMED/OVERRULED/REPUDIATED, no act) and `CONFIRM_VIEW_TYPE` (CONFIRMED per member, with the
act). L-AI-02 closes the Proposal's list at payload, sources, model, callId, so the judgment is a
ledger fact read by call id, never a member of the Proposal (recorded Interpretation, in the seam).

**The calibration read.** `src/core/model-calibration.ts`, pure: per question — proposed, refused,
confirmed, overruled, repudiated, affirmed (the newest outcome per call), awaiting, and the mean
confidence where a person agreed against where a person did not. S-Audit's model ledger panel,
armed with rows, lists the newest calls with the outcome beside each and one calibration line per
question (Decision I-37; `audit-ledger-grid`, `audit-ledger-row`, `audit-ledger-calibration`,
`audit-ledger-calibration-line`).

**The corpus.** `scripts/model-corpus.ts` (`record` under a scratch root from the live provider
through the seam's one recording door `recordFixture`; `file` into `fixtures/model` with
`corpus.json`; `roster`), and `tests/ai/model-corpus-roster.test.ts` keeping the roster and the
files in step. The first corpus, ten fixtures, commit `e8b7fae6` with every cost line:

| Question | Subject | Answer | Confidence | Tokens in / out |
| --- | --- | --- | --- | --- |
| sheet-reading | silent-title-block.graph.json · SHEET-01 | C-402 · SITE GRADING PLAN · CIVIL | 0.96 (discipline 1.00, title 0.99, number 0.96) | 969 / 231 |
| view-caption | ROOF BEAM LAYOUT (AT ROOF LEVEL) | LAYOUT_PLAN | 0.99 | 513 / 118 |
| view-caption | TYPICAL FLOOR BEAM LAYOUT | LAYOUT_PLAN | 0.97 | 510 / 118 |
| view-caption | C1 … C6 (six column marks the partition mistook for captions) | UNTYPED | 0.67–0.77 | 502 / 118 each |
| view-caption | (2ND TO 6TH FLOOR) | UNTYPED | 0.40 | 510 / 118 |

Totals: 5,514 input tokens; ledger cost 0.061680 USD under the pinned Claude ids; the provider's
documented cost 0.000231588 USD (docs.typesafe.ai/models: $0.042 per Mtok input, output free).

**What the calibration line shows before any person has judged** (read from the e2e lane's ledger
after the M3 runs, `cubit_e2e.model_calls`): `view-caption` — 27 refused FIXTURE_MISSING (the runs
before the corpus was filed) and 7 refused MALFORMED (Jev's seven UNTYPED abstentions replayed, which
the caller's classifiable set refuses as the honest answer they are); 0 proposed, 0 judged — the two
beam layouts are read by the grammar since `a8a256c8`, so no view-caption call is proposed on
BNBC at all. `sheet-reading` — proposed only in the seam's own acceptance (525 replayed
proposals under `unnamed`, the corpus root of the sheet-understanding increment). No outcome row
stands in any lane's ledger yet: no journey confirms a proposed view type or dispositions a reading.
The line the next session reads first is therefore all zeros with seven honest refusals, and the
seven are the finding: Jev abstains on a column mark, at 0.67–0.77, and on a fragment at 0.40.

**The amendment.** `docs/decisions/as-05-jev-amendment.md` — the text the owner would add to AS-05
(the id `jev-latest`, the documented rate and its source, the corpus's home, the calibration line),
a proposal, unnumbered. Nothing adds Jev to AS-05 or invents a rate; a Jev call is billed under the
pinned Claude id until the amendment lands, and every cost line above says so.

**Logic-points 2–7 are not built** (section 7). The pattern for each is point 1's: request builder
names its question · adapter recognises it by key set and reads the judgment · corpus recorded once
by the script · outcome written by the act that judges it · calibration line on S-Audit · Decision
amendment · tests first · one commit citing the clause.

### 3.2 The M3 leg (this session's last commit before the gate)

`tests/e2e/journeys/j-000/golden-run.ts` gains the BNBC stage: `bnbcRun` (a second project on the
run's workspace, F-RCC6-BNBC dropped, disciplines confirmed, a set pinned), `bnbcTranscribed`
(scales, stack, heights, ranges, notes — every step a click) and `bnbcMeasured` (Measure), each
memoised per worker and trusted only while the product still stands it. Two legs:
`m3-levels-and-notes.spec.ts` runs; `m3-bill-and-schedules.spec.ts` is the walk after Measure —
the register review, the unpriced BOQ, the XLSX opened with exceljs (sheets, headers, the Amount
formula, a null Rate, the frozen header), the band matrix against `takeoff.golden.json` (3 % under,
0 % over, per (class, kind, level)), the BBS against `bbs.golden.json` per (class, level, mark) —
standing as `test.fixme` behind the named door. `m3` is SHIPPED in the roster with that door
declared, as AM-09 §2 admits; the fixme roster carries the three titles.

### 3.3 The craft debt (commits `7c0880e1`, `878ac3cd`, `d4931680`)

Every screen states itself on its root (`data-screen-root` + `data-state`); every identifier a
person meets is an IdChip (the rule set's digests, the set browser's and the sets index's sha256s,
the register's calibration keys, the project home's id-only member label, the audit log's actor,
digest and subjects, the sheet cards' cited keys with the key's tail as the measure); the act log
is a DataTable v2 grid; the drawings index puts its grid first and its Add region after it once a
card exists; the participants roster stretches to the surface it is the primary of; the schedules
rail keeps each sheet on one row. Recorded as I-38, I-95–I-97, I-107, I-143, I-149, I-188, I-189,
I-190, I-209, I-213, I-214 in the screens' Decisions; the gate's reds then added I-284 (J-010's
card pictures no partition), I-214's sixteen-row frame and I-190's two amendments (the panel's head
stands above a focusable scrolling body; the chip's two stops are the walk's). `scripts/probe/craft-walk.sh` walks all eighteen
screens and writes the table.

## 4. The craft table

Before (session 4's first walk, on the lane's seeded project, dark and light, 1440×900 and
1280×800; the score the minimum):

| Route | total | min | below 3 |
| --- | --- | --- | --- |
| audit | 2.63 | 0 | workSurface 0, aboveTheFold 0, identifierExposure 0, states 2 |
| documents | 3.42 | 0 | workSurface 0, aboveTheFold 0 (empty) |
| drawings/sets/[set] | 2.79 | 0 | workSurface 0, aboveTheFold 0, identifierExposure 2, states 2 |
| drawings/sets | 2.92 | 0 | workSurface 0, aboveTheFold 0, states 2 |
| drawings | 3.38 | 0 | aboveTheFold 1, identifierExposure 0, copyDiet 1 |
| settings/participants | 4.25 | 1 | workSurface 1, states 2 |
| settings/ruleset-author | 4.75 | 3 | — |
| settings/ruleset | 3.83 | 2 | identifierExposure 2, states 2 |
| settings/site-facts | 4.83 | 3 | — |
| takeoff/bbs | 3.33 | 0 | workSurface 0, aboveTheFold 0 (empty) |
| takeoff/boq | 4.17 | 1 | aboveTheFold 1 |
| takeoff/coverage | 4.38 | 3 | — |
| takeoff/levels | 4.58 | 3 | — |
| takeoff/register | 4.29 | 0 | identifierExposure 0 |
| takeoff/schedules | 4.08 | 2 | workSurface 2 |
| viewer | 3.54 | 0 | identifierExposure 0, states 2 |
| project home | 4.33 | 2 | identifierExposure 2 |
| home | 4.75 | 2 | states 2 |

After (the walk after the green gate, HEAD `8feb3cd5`, 2026-09-22, on a MEASURED project of a
fresh M0–M2 run — the register counting lines, the draft BOQ filled; dark and light, 1440×900 and
1280×800; the score the minimum of the four; the rubric measures the primary at the outermost region
a nested table stands in, commit `b78eedcb`):

| Route | total | min | below 3 / read with | Verdict |
| --- | --- | --- | --- | --- |
| audit | 4.67 | 3 | — | OK |
| documents | 3.58 | 0 | workSurface 0, aboveTheFold 0 — empty by design (no document issued; J-030 asserts no grid stands behind the teaching) | RED |
| drawings/sets/[set] | 3.42 | 0 | workSurface 0, aboveTheFold 0 — the Decision's lists are no primary the rubric measures | RED |
| drawings/sets | 3.58 | 0 | the same | RED |
| drawings | 4.71 | 3 | — | OK |
| settings/participants | 4.58 | 3 | workSurface 3 (the sixteen-row frame is 44 % of main, I-214 — 5.00 with twenty rows, over the capture cap); chromeGeometry 3 in the dark 1440 capture alone (`rail 220`: the workspace sidebar stood expanded — the walk's state, the other three captures read 5) | OK |
| settings/ruleset-author | 4.58 | 3 | — | OK |
| settings/ruleset | 4.46 | 3 | — | OK |
| settings/site-facts | 4.67 | 3 | — | OK |
| takeoff/bbs | 3.33 | 0 | workSurface 0, aboveTheFold 0 — empty by design (no schedule rendered; J-032 asserts no grid behind the teaching) | RED |
| takeoff/boq | 4.67 | 3 | — | OK |
| takeoff/coverage | 4.54 | 3 | — | OK |
| takeoff/levels | 4.58 | 3 | — | OK |
| takeoff/register | 4.29 | 0 | identifierExposure 0 — the EvidenceLink labels read `Model · B1 · v:LAYOUT_PLAN:DXF_HANDLE:424`: the view key inside the label (section 7) | RED |
| takeoff/schedules | 4.17 | 2 | workSurface 2 — the notes panel is no candidate of the rubric; the one schedule table is 28 % of main | RED |
| viewer | 4.42 | 3 | — | OK |
| project home | 4.71 | 3 | — | OK |
| home | 4.83 | 3 | chromeGeometry 3 in the dark 1440 capture alone (`rail 220`, the sidebar expanded as above; the other three read 5) | OK |

Twelve of eighteen at the bar (six before). Of the six under it, two are empty screens the journeys
require to stand without a grid, two are the sets' lists, and two are named in section 7 with their
cause. Two screens read lower than the session's earlier walk (`craft-after3`, 2026-09-21, where
participants and home read 5.00): participants by the sixteen-row frame the capture cap required
(I-214), both by one dark 1440 capture in which the workspace sidebar stood expanded at 220 px —
`test-results/probe/craft-final/t-2fcb500c.dark.1440x900.png` shows it; whether the walk's pointer
opened it or the fresh run's preference pinned it is the next walk's to read. The walks stand at
`test-results/probe/craft-before`, `craft-after3` and `craft-final` (this table) — the lane's own
leavings, cleaned by the next e2e run; the tables above are the record.

## 5. The gate, verbatim

The last `pnpm gate` on the tree this handoff describes (HEAD `8feb3cd5`, ended 2026-09-22; its stdout
redirected to a file of the session's own, because its lane logs under `test-results/gate/` are
cleaned by its own e2e lanes — section 7, item 6). Every lane's lines, verbatim:

```
GATE verify: pnpm verify
  LANE typegen 0.20s
  RUN schema-drift
  RUN catalogue-drift
  cad: fixture regeneration skipped — its inputs digest d3031fbbc5be, the tree a green regeneration proved at 2026-09-21T08:30:44.805Z (node_modules/.cache/cubit/cad-regeneration.json; the golden lane still checks the committed corpus)
  LANE catalogue-drift 0.04s
  LANE method-hash 0.05s
  LANE schema-drift 2.15s
  LANE golden 3.03s
  LANE types 3.69s
  LANE lint 30.14s
  LANE cad 48.54s
  LANE unit 49.83s
  LANE build 6.06s
  verify wall-time 56.10s
GATE verify green 58.09s
GATE checkup: pnpm checkup
  checkup wall-time 0.33s
GATE checkup green 0.55s
GATE golden: pnpm test:golden
   Test Files  4 passed (4)
        Tests  16 passed (16)
  104 passed in 1.35s
GATE golden green 2.04s
GATE db: pnpm test:db
  RUN test:db
   Test Files  221 passed (221)
        Tests  1310 passed (1310)
  test:db wall-time 72.42s
GATE db green 74.36s
GATE e2e: pnpm e2e
    5 skipped
    63 passed (21.0m)
  e2e workers=4 wall-time 1260.56s
GATE e2e green 1295.30s
GATE e2e-j000: pnpm e2e --journeys J-000
    4 skipped
    10 passed (20.8m)
  JOURNEY J-000 green workers=4
  e2e J-000 workers=4 wall-time 1249.46s
GATE e2e-j000 green 1281.98s
GATE perf: pnpm test:perf
    2 passed (21.5s)
  e2e PERF- workers=4 wall-time 22.10s
GATE perf green 22.75s
GATE summary — verify: green 58.09s · checkup: green 0.55s · golden: green 2.04s · db: green 74.36s · e2e: green 1295.30s · e2e-j000: green 1281.98s · perf: green 22.75s
GATE wall-time 2735.08s exit 0
```

Read with the lines: the e2e lane's 1260.56 s stands over V-E2E's 12 min because `pnpm e2e` selects
J-000's legs, M3 among them (section 7, item 8); the skipped tests are the `test.fixme` stubs the
fixme roster admits (M3's second leg, M4) — no `test.skip` is called anywhere under `tests/e2e`; the verify lane's
56.10 s wall-time is 3.9 s under its 60 s ceiling, the lint (30 s), cad (49 s) and unit (50 s) lanes
in parallel.

The gates before it, the same tree at each commit:

1. The first `pnpm gate` (2026-09-21): verify RED (lint — one deep import under `tests/`, `e414d055`;
   the other lanes green, `verify wall-time 52.26s`), checkup RED (`database cubit_dev migration drift
   (54/55 migrations applied)` — `pnpm db:migrate:dev` brought the dev database to the committed head;
   no file changed), golden green, db RED (`Test Files 2 failed | 219 passed (221)`, `Tests 4 failed |
   1306 passed (1310)` — four reads of digests as text, `c5d98ffb`), e2e RED (`8 failed / 5 skipped /
   55 passed (21.0m)`), e2e-j000 crashed on `ENOENT test-results/gate/e2e-j000.log` (`bf3c1909`), perf
   never reached.
2. `pnpm gate --only e2e` (the sweep the re-takes read): `8 failed / 5 skipped / 55 passed (21.0m)`,
   `e2e workers=4 wall-time 1263.61s` — four moved pictures (`3edd24a8`) and four journeys that were
   not pictures (J-012, J-304, J-003, J-010 — `c5d98ffb`, `d0920d87`).
3. The second full gate: verify, checkup, golden, db green; e2e RED `3 failed / 5 skipped / 60 passed
   (21.1m)` — the second picture of each of three journeys, which a red first picture had hidden
   (`6cf8daae`); e2e-j000 green `10 passed (20.8m)`; perf green.
4. The third: e2e RED on J-011 and J-020, perf RED on PERF-011 — `b5194d44`'s body-as-scroller with no
   focusable content of its own on a squeezed panel (`8feb3cd5`); every other lane green.
5. The fourth is the one above.

## 6. Declined by law

- **Jev added to AS-05 or a rate invented** — AS-05 is the Bible's; the amendment is written as a
  proposal for the owner (`docs/decisions/as-05-jev-amendment.md`).
- **The judgment carried on the Proposal** — L-AI-02 closes the Proposal's list at payload,
  sources, model and callId, and the seam's own acceptance holds it closed; the judgment is the
  ledger row's, read by the call id a Proposal does carry.
- **`--update-snapshots`** — every picture the session's lawful changes moved is re-taken by
  `pnpm e2e:retake -- --write` in its own `baseline:` commit.
- **A grid frame under an empty Documents or Bar schedule** — J-030 and J-032 assert that no grid
  stands behind the teaching (`documents.grid` and `bbs.grid` `toHaveCount(0)`); an empty screen has
  no grid to measure, by design, and the walk that grades those screens must stage a document and a
  schedule (section 7).
- **Editing migration 0053** — it landed on this branch before this session; history is append-only,
  so the ledger's columns and the outcome table are migration 0054. Note for the owner: this branch
  now carries TWO migrations on its base (0053, 0054); `scripts/db-regenerate-migration.mjs` refuses
  that at integration by design, and the integrator regenerates one from the combined schema.

## 7. What remains, and who owns it

1. **The partition's viewport-caption door (the M3 leg's missing door).** F-RCC6-BNBC names its
   column layout plan only in paper space (the S-10 viewport's title `COLUMN LAYOUT PLAN  SCALE
   1:100`); the model space carries the plan with its column marks C1–C6 as the largest texts, which
   the partition anchors as six views of nothing, and the partition reads model-space captions and
   nothing else. With no layout-plan view of the columns nothing is placed: the register counts no
   line, and the BOQ, the XLSX, the BBS and both goldens cannot be walked. Read
   `fixtures/rcc6-bnbc/traps.json` (T-FRAMES-MODELSPACE, T-KEYPLAN, T-TEXT-OVERLAP) and
   `docs/handoff/fable-5.1-session-5-prompt.md` §2. Two more findings on the same drawing, measured
   in the lane's job events: the grid detector reads no axis on the two beam layouts
   (`grid: axes 0, views 2, deferred 2` → `placement: ungridded 2`), and the levels proposal proposes
   none (`levels-proposal: views 1, proposed 0`): BNBC's section marks read `GF EL +0.000` …
   `ROOF EL +21.641`, and `propose.ts` reads the words before the elevation through the notation's
   floor-zone reading, which answers nothing for `GF EL` — so the leg inserts the eight levels by hand
   through J-031's door and transcribes every height. Owner: the partition (R-TO-030, L-CAD-06/07,
   L-MEA-07).
2. **Jev logic-points 2–7** (section 3.1's pattern): schedule cell readings, the notes clause class
   and the contested lap, coverage causes, the BOQ line description, corroboration, and the
   beyond-M3 Score and discipline at upload. Owner: the next session, with the open budget.
3. **The six screens still under the bar** (section 4's after-table): the sets index and the set
   browser (the Decision's `<ul>`s are no primary the rubric measures — DataTable v2 grids, an
   Interpretation each); Documents and the Bar schedule (empty on every project the lane leaves; the
   journeys require no grid behind the teaching, so the walk that grades them must stage an issued
   document and a rendered schedule — the M3 second leg does exactly that once its door lands); the
   register's 1,162 EvidenceLink labels, each carrying the view key `v:LAYOUT_PLAN:DXF_HANDLE:…` as
   text (`sourceChips` in `src/modules/takeoff/register-ui/index.tsx` composes them; the key belongs
   on the link's `data-key`/tooltip with the view's class and mark as the words, an amendment to the
   register's Decision); S-Schedules' work-surface share (the notes panel and the sheet rail are no
   candidates of the rubric — decide with the Decision whether the work column is the grid).
4. **The reference sheets through the product with the probe** (Edison Lavinia's 22k entities at
   60 fps, the General Note whole and in order, the BNBC drawing's 53 viewports;
   `ARCHITECTURE.dwg` repaired or its refusal recorded), **the HTTP tamper probe** reading
   `DIGEST_MISMATCH`, **the light lane** run once and re-taken, **J-011's fly-to leg** — none reached
   this session; owner: the next session.
5. **The levels proposal on BNBC** (item 1's third finding) and **the six column marks the partition
   anchors as captions** (T-TEXT-OVERLAP: "placement by anchor, not by nearest line") — the corpus
   already records Jev's abstention on each of the six; the partition should not have asked.
6. **The gate's own logs do not survive it.** `pnpm gate` writes each lane's log under
   `test-results/gate/`, and the e2e lanes that follow clean `test-results/` — so the verify, checkup,
   golden and db logs the summary cites are gone by the time the gate ends, and a red db lane has to be
   run again alone to read its failures. `bf3c1909` makes the directory again before every lane, so
   the gate no longer falls over the missing directory; the earlier lanes' logs are still gone. The gate
   should write its logs outside the directory its own lanes clean. Owner: the toolchain (C-06).
7. **Untracked leavings the owner keeps outside the tree**: `.agents/`, `.idea/`, `.junie/plans/`,
   `AGENTS.md` stand untracked in the working copy; nothing here touched or committed them.
8. **The e2e lane stands over its ceiling.** V-E2E is ≤ 12 min; `pnpm e2e` — the gate's `e2e` lane —
   selects every spec including J-000's legs, and with the M3 leg among them the lane's wall-time is
   1263 s at four workers (section 5), and `e2e-j000` then walks J-000 again alone. Either the plain
   lane excludes J-000 (the roster the `e2e-j000` lane already owns) or the ceiling is amended; a
   reading is the toolchain's to make (C-06, AM-10). Recorded, not changed: the lane roster is
   `scripts/gate.mjs` and `scripts/e2e.mjs`, a toolchain path.
9. **The partition's clock in the lane.** J-010's wait for the first card's views outlasted its
   journey under four workers (I-284 records the reading and the fix). A job runner shared by every
   journey the lane runs is a fact a journey must not wait on; any other journey that waits for a
   partition it did not itself start carries the same exposure — M2's `m2-run-partition` walks the
   job it starts, which is the lawful shape.

## 8. Reproducing each proof

- The Jev seam, unit lane: `pnpm vitest run src/core/model src/core/model-calibration.test.ts src/core/db/schema-aggregate.test.ts tests/ui/s-audit tests/ai/model-corpus-roster.test.ts`
- The ledger and its outcome column, db lane: `pnpm vitest run --config db/__tests__/vitest.config.ts db/__tests__/model-call-outcomes.migration.test.ts db/__tests__/audit-surfaces.live.test.ts src/core/model/__tests__/db-ledger.acceptance.test.ts tests/ai/dispositions-and-spend.acceptance.test.ts tests/takeoff/partition/confirm-view-type.test.ts`
- The partition's three fixes, db lane: `pnpm vitest run --config db/__tests__/vitest.config.ts tests/takeoff/partition/caption-grammar.test.ts tests/takeoff/partition/schedules/schedules.test.ts tests/takeoff/partition/rebuild.test.ts`
- The corpus, recorded again on purpose (needs the key; never by a lane): `node --import tsx scripts/model-corpus.ts record --question sheet-reading --out <scratch>` · `… record --question view-caption --drawing fixtures/rcc6-bnbc/rcc6-bnbc.dxf --out <scratch>` · `… file --from <scratch>`
- The M3 legs: `pnpm e2e --journeys J-000 --workers 1 tests/e2e/journeys/j-000/m3-levels-and-notes.spec.ts tests/e2e/journeys/j-000/m3-bill-and-schedules.spec.ts` (thirty minutes; the prologue is walked again each run)
- The craft table: `pnpm probe:server`, then `bash scripts/probe/craft-walk.sh <run.json> test-results/probe/craft-after`, then `pnpm probe:server -- --stop`
- The four repaired journeys, alone: `pnpm e2e tests/e2e/journeys/j-010-upload.spec.ts tests/e2e/journeys/j-012-sets.spec.ts tests/e2e/ruleset-author.spec.ts tests/e2e/participants.e2e.ts`
- A moved picture: `pnpm e2e:retake` (dry: every `-actual.png` the run left, with the bands that moved), then `pnpm e2e:retake -- --write` and a `baseline:` commit naming the run — never `--update-snapshots`
- The gate: `pnpm gate` (its lane logs are cleaned by its own e2e lanes — section 7, item 6 — so redirect the gate's stdout to a file of your own)

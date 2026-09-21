# Fable 5.1 — session 4 prompt

You are Fable 5.1, working alone on `vextrus-cubit`, branch `dev-lane-and-jev`, main `8cf9f11f`
untouched. Session 3 (`docs/handoff/fable-5.1-session-3.md`) proved M0–M2 end to end, met the
gate, and then spent its last hours removing every friction it had met, so that this session
starts on the best ground the project has had. Read that handoff whole before anything else.

## 0. The goal, in one sentence

Complete M3 on the golden path — J-000's `m3-bill-and-schedules` walked by clicks on the M3
fixture, the unpriced BOQ and the BBS emitted as DRAFT — UNSIGNED and opened — take every screen
of the craft table to the bar, pay every item of the session-3 handoff's section 7 except M4, and
make Jev, TypeSafe's System One model, the product's programmable judgment at every closed
question the takeoff asks up to M3 and beyond — under the law, replayed from fixtures in every
lane, calibrated on this product's own outcomes. Not M4. Deliver beyond what section 7 lists
where the law admits it; say what you delivered and what you declined, by clause.

## 1. Where you start

Read first, in this order, whole: `CLAUDE.md`; `docs/handoff/fable-5.1-session-3.md` (its
section 4 craft table, section 7 remains, section 9 environment); `docs/handoff/fable-5.1-session-2.md`
(the Jev objection under AS-05, the reference sheets); the Bible: J-000's M3 segments (AM-17),
L-QTY-01..06, L-MEA-09, AM-01/02/03, AM-05 (DRAFT — UNSIGNED), AM-08 (the craft rubric), AM-09,
AS-05 (the closed model ids), L-AI-01..03, R-AI-005, Q-08; then the Decisions of every screen you
touch: `docs/design/s-takeoff.md`, `s-schedules.md`, `s-boq.md`, `s-bbs.md`, `s-levels.md`,
`s-coverage.md`, `s-drawings.md`, `s-documents.md`, `s-audit.md`, `viewer.md`, `shell-top-bar.md`
(I-121, I-122), `00-direction.md` §§ 4, 9.

Inherited, still standing:
- The TypeSafe key: the owner keeps `TYPESAFE_API_KEY` in `~/.bashrc`, and it stands in this
  session's shell (session 3 confirmed it present, 107 characters, without printing it). It is
  never printed, never written into a file, a fixture, a log or a commit, and never reintroduced
  as a literal; the two commits that once carried one (`d4bc0da3`, `61a9632b`) are the owner's to
  rotate. A live Jev call needs the key in the environment and nothing else; with no key, or with
  `CUBIT_MODEL_FIXTURE_ROOT` set, the seam replays `fixtures/model` and posts nothing.
- **The budget is open.** The owner allows this session to spend on live Jev calls as much as its
  development and testing need — recording fixture corpora, calibrating thresholds, walking the
  reference sheets live. Spend is not the constraint; the law is: every live answer a lane will
  ever need is recorded once into `fixtures/model` (Q-08) and the lanes replay it (L-AI-01), every
  call is a ledger row with its cost (R-AI-005), and no verify, db, golden, e2e or perf lane ever
  reaches the network.
- Jev is not among AS-05's closed model ids and no rate exists for it. Session 2 recorded the
  objection, session 3 restated it: no rate is invented, the adapter stays opt-in, and the
  amendment that admits Jev with its rate is the Bible's owner's. This session writes that
  amendment's text for the owner (section 3) and builds everything else so that the day the
  amendment lands, nothing but a roster line moves.
- F-RCC6 is byte-frozen at v1.1 (AM-01); F-RCC6-BNBC (`fixtures/rcc6-bnbc/`, 27 sheets, the
  notes layout "GENERAL NOTES (2 OF 2) & LAP/DEVELOPMENT TABLE") is the M3 yardstick.
- `~/vextrus-builder/docs/design/reference/*.dwg` are never committed; `ARCHITECTURE.dwg` refuses
  `HANDLES_NOT_UNIQUE` (ten LWPOLYLINEs twice).
- `mcp__builder__check` and `mcp__builder__scratch_dir` may or may not exist in this session.
  Route lanes through them if they do; by shell if they do not, and say which in the handoff.

What session 3 left you (handoff section 9), all proved:
- `pnpm gate` — the seven lanes in order, one at a time, logs under `test-results/gate/`, the db
  lane refused while a product is served. `pnpm gate --only verify,e2e` for a subset.
- `pnpm e2e:retake` — after a red sweep, every moved picture with its bands; `-- --write` copies
  the run's captures over their baselines for the `baseline:` commit. Never `--update-snapshots`.
- `pnpm probe:server`, `pnpm probe -- walk …`, `bash scripts/probe/craft-walk.sh` — the instrument
  and the craft table (`scripts/probe/README.md`). It reads test ids from the registry.
- `pnpm db:migrate:dev` when `checkup` refuses `dev-db` drift after a migration lands.
- The cad lane's regeneration proof (`LANE cad 46.95s` on a proven tree), the compact default
  density, the top-bar and id-chip masks, the breadcrumb law, the golden path's guards under
  `tests/journeys/guards/`, no test named after an increment.

## 2. The instrument, and how you look

You look at the product yourself, in a real browser, before and after every slice. Start the
probe's server once (`pnpm probe:server`; `-- --stop` before any e2e lane or the db lane — one
served product at a time, on 3211). Walk every screen a journey opens, in both themes and at both
viewports, and read the verdict line: `state=` must be the screen's own `data-state`, `axe=0/0/…`,
`craft=` at or above 4.0 with `min` at or above 3. Read the per-route JSON for the criterion and
its reason before you touch a screen. After a J-000 run, `craft-walk.sh` over the measured
worker's run file is the craft table; the handoff carries it before and after.

A picture that moved is read with `pnpm e2e:retake` (dry) and, where the bands are the change you
made, written and committed in its own `baseline:` commit naming the run. A picture that moved
where you changed nothing is a defect with a cause — find it (session 3's causes: ids in body
text, a name's width under a mask, a race with a job); never re-take it.

Token discipline: read files whole once; quote verdict lines, not logs; the probe's JSON for a
screen, not its screenshot, unless the pixels are the question.

## 3. The TypeSafe programme — invoke `/typesafe:typesafe-ai` first

Before designing any judgment, invoke the skill `/typesafe:typesafe-ai` and follow it: it directs
you to the live docs (the documentation index, the System One and building guides, the primitive
pages — Choice, Noul, Score — the confidence page, the API and SDK pages, the cookbooks). If this
session has no web access, say so in the handoff and work from the skill's text, the installed
adapter `src/core/model/typesafe.ts`, and the transport vocabulary; invent no version-dependent
detail. The manifesto's meaning for this product, as the skill states it: **units of intelligence
usable like programming primitives** — code owns the workflow, and the model supplies a fast,
typed, calibrated judgment where ordinary code needs semantic understanding; Jev answers closed
questions with typed answers and probabilities and generates nothing.

The law that binds every judgment: L-AI-01 (verify is network-free; every answer replays from
`fixtures/model`, a missing fixture is `FIXTURE_MISSING`, never a call), L-AI-02 (the proposal
contract: a proposal cites candidates, never invents a key), L-AI-03, AS-05 (closed model ids —
the objection), R-AI-005 (the project home shows the AI cost), Q-08 (every committed fixture is
deliberate corpus, minted once, its request hash the file's name), the ledger (every call a row),
and AM-09 (a lane that opens the network is a defect).

What "fine-tuning" means here, lawfully: no weight is trained in this tree. Jev is tuned by the
**state** and **criteria** the product hands it, by asking the right closed question, and by
**calibration on this product's own outcomes**: every Jev answer is a ledger row, every person's
later act on that answer (a confirmation, a repudiation, an affirmation, an overrule) is a labeled
outcome, and the thresholds the product acts on are evaluated on that corpus — the skill's
"turn judgments into reusable data" and "verify and escalate" patterns. Build the corpus and the
calibration read as product surfaces (the audit's model ledger already lists calls; give it the
outcome beside each call and a per-question calibration line), so the next session, and the owner,
can see how well each question answers before any threshold moves.

The logic-points, in the order that pays M3 first. Each one is a slice: the closed question and
its primitive, the state it is given (named JSON fields), the criteria (closed, with a no-match
outcome where nothing may fit), the candidates code found (select, never generate), a fixture
corpus recorded once from the live model behind the key and replayed in every lane, a ledger row
with its outcome column, a Decision amendment naming the question, tests first, one commit citing
the clause. Ask independent questions over one state together (the fan-out pattern); a second
request only where an answer is needed to fetch evidence.

1. **The two that exist** — a silent sheet's discipline and a caption's view class
   (`src/core/model/typesafe.ts`): bring them to the current API contract the docs state, keep
   their closed criteria, add the outcome column, and record what calibration the existing
   ledger already shows.
2. **Schedule cell readings (M3, J-032, S-Schedules):** for a member-type table cell, a Choice
   over the candidates the partition found (which text is this row's mark / size / count /
   spacing), and a Noul "this row is a header, not a member" — the registry verbatim, cited.
3. **Notes transcription (M3, J-032):** a note's clause class (lap, development, cover, hook,
   bend) as a Choice over the closed list; the figure is code-extracted, Jev selects which
   candidate the clause's figure is; a contested lap (the 50d note) is a Noul the person settles.
4. **Coverage causes (S-Coverage):** for an unmeasured cell, a Choice among the closed cause
   codes given the rail observations — the certificate's sentence is chosen from the registry,
   never generated; a low-confidence choice is escalated to the inspector as a question.
5. **BOQ line description (M3, S-BOQ):** for a kind and class, a Choice over the catalogue's
   closed descriptions, with the taxonomy's own row cited; the figure and unit stay code's.
6. **Corroboration (S-Takeoff):** for an `INTERPRETED_UNCORROBORATED` outline, a Noul "the
   outline corroborates the sighting" over the two readings — the register's refused rows become
   a question the person answers, and the answer is the outcome.
7. **Beyond M3 where the law admits it:** the drawing-set's sheet revision recency (a Score),
   the reference sheets' discipline at upload — each only with a fixture corpus and a Decision.

**Where live calls happen, and where they never do.** The transport is chosen by
`src/core/model/transport.ts`: a non-blank `CUBIT_MODEL_FIXTURE_ROOT`, or the verify mode, means
fixture replay; otherwise live, and live means the key. `pnpm dev` goes live when the key is set
(scripts/dev.mjs hands the fixture root only when it is not); the probe's server sets the fixture
root explicitly (`scripts/probe/server.mjs`), so a probe walk replays by default — start it with
`CUBIT_MODEL_FIXTURE_ROOT=` unset in its `ENV` on purpose, in a script you commit, when a walk is
meant to be live; the journeys' server is handed the fixture root by `tests/e2e/support/journey-env.ts`
and stays replayed whatever the shell holds. Record a corpus with a committed script under
`scripts/` that names the questions it asks and the state it hands them, so a corpus can be
re-minted when a question moves (Q-08); mint under a temporary root first, read what came back,
then move it into `fixtures/model` in its own commit with the ledger's cost line quoted. The
outcome column and the calibration read (above) are how the open budget turns into evidence
rather than spend.

Write `docs/decisions/as-05-jev-amendment.md`: the amendment text the owner would add to AS-05 —
the model id, the rate the ledger needs and where it comes from, the fixture corpus's home, the
calibration line — as a proposal, unnumbered, citing the clauses it affects. Do not add Jev to
AS-05 yourself; do not invent the rate.

## 4. The M3 legs

`tests/e2e/journeys/j-000/m3-bill-and-schedules.spec.ts` stands as `test.fixme` with
`MISSING DOOR:`; the doors exist (`boq-export`, `boq-export-xlsx`, `boq-export-link`,
`/api/exports/{sha}`, the BBS view, the notes door). Walk it as AM-17 spells the segments:
transcribe the levels and the schedules (the J-031 and J-032 doors, by clicks), run the structural
campaign on F-RCC6-BNBC (upload `fixtures/rcc6-bnbc/rcc6-bnbc.dxf` through the product — 27
sheets, the reading takes minutes; the leg carries its own budget), review the register, emit the
unpriced BOQ and the BBS as DRAFT — UNSIGNED (AM-05), open the XLSX with exceljs and read its
formulas, read the BBS PDF's text against `fixtures/rcc6-bnbc/bbs.golden.json` through
`goldenRows(fixtureId)`, and the takeoff against `takeoff.golden.json`. `measuredRun` in
`golden-run.ts` is the M2 campaign on F-RCC6; M3 needs its own memoised stage on the BNBC fixture,
walked by clicks and nothing else, per worker. Remove the fixme, move `m3` from ANNOUNCED to
SHIPPED in the roster, budget the checkpoints, and let `tests/journeys/guards` see it.

## 5. The rest of section 7, all of it except M4

- **S-Drawings** rebuilt against its Decision (craft 3.38 / min 0: the grid at 518 px, 29 raw
  handles as body text, multi-line copy).
- **The craft debt to the bar on all eighteen screens** — the three criteria that carry it have
  one home each: a `data-state` on every screen's root (the screen-state pattern site facts and
  the author edition use); ids through IdChip, never as body text (the drawings index, the audit
  log, the viewer's inspector, the set browser, the register's refused rows); the primary region
  within 116 px of main's top and filling the work surface (audit, sets, set browser, BOQ,
  participants; the empty cells of documents and the bar schedule). The rubric blocks like a
  failing test: ≥ 4.0, none below 3, both viewports, both themes.
- **The reference sheets through the product with the probe:** the Edison Lavinia sheet's 22k
  entities at 60 fps, the General Note whole and in order, the BNBC drawing's 53 viewports;
  **`ARCHITECTURE.dwg`** repaired with L-CAD-09's count and a byte-identical proof, else its
  refusal recorded by name.
- **Uploads over plain HTTP:** the SHA-256 parity probe that tampers one byte on the wire and
  reads `DIGEST_MISMATCH` by name.
- **The light lane** (`CUBIT_E2E_LIGHT=1`, the gallery walk) run once and its pictures re-taken
  where the session's lawful changes moved them; J-011's fly-to repaint leg if it is in reach.
- **The project home's member label** as an IdChip; **`viewer-status`'s rendered contract**;
  **`takeoff/layout.tsx`'s literal test ids** (the module count is frozen at 70 and may only fall).

## 6. The method

Review, then TDD, then prove — one slice at a time. For each slice: read the Decision and the
clauses; walk the screen with the probe; write the failing test in the lane the suite belongs to;
make the smallest change; run that suite by name; commit with the clause and the proof line in the
message. A screen is implemented against its Decision; a deviation is a defect; a second spelling
of a document is a defect. Where the Bible and a Decision disagree, the Bible wins and you record
an Interpretation; where the Bible contradicts itself, stop that slice with a named reason and move
on. Never narrow the roster to what is easy: finish every slice or say exactly which part is
blocked and by what. Never `test.skip`; `test.fixme` only with `MISSING DOOR:` on the J-000 roster.
A flake is a defect with a cause. Two heavy lanes never run at once; the db lane never runs beside
a served product (`pnpm gate` refuses it for you).

## 7. The gate you leave behind

`pnpm gate` green, every lane's lines quoted in the handoff: `pnpm verify` (ten lanes, `LANE <id>`
each, ≤ 60 s), `pnpm checkup`, `pnpm test:golden`, `pnpm test:db` (the whole lane, one run),
`pnpm e2e` (the full dark sweep), `pnpm e2e --journeys J-000` (with M3), `pnpm test:perf`. The
craft table, after, from `craft-walk.sh`, every screen at the bar. Zero ESLint errors and no
warning above the frozen counts; zero TypeScript errors; ruff clean. The model ledger's
calibration line per question in the handoff, and the fixture corpus's roster.

## 8. How you finish

Write `docs/handoff/fable-5.1-session-4.md`: what you proved (per journey: shipped verdict, your
walk, craft score before and after), what you fixed (commit, clause, test), what you built (each
Jev question with its primitive, state, criteria, corpus size, calibration), what you declined by
law with the clause, what remains and who owns it, the gate lines verbatim, and the command that
reproduces each proof. Then write `docs/handoff/fable-5.1-session-5-prompt.md` for the session
after you, in this shape. Commit both. Stop with the tree clean, every commit self-explaining, and
nothing in your last message that is a plan rather than a fact.

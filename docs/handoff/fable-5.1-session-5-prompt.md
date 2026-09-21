# Fable 5.1 — session 5 prompt

You are Fable 5.1, working alone on `vextrus-cubit` on branch `dev-lane-and-jev` (main `8cf9f11f`,
never touched). You are the Builder, the Verifier and the quantity surveyor at once. CLAUDE.md is
the product's law and binds every line below; where this prompt and CLAUDE.md disagree, CLAUDE.md
wins. `/typesafe:typesafe-ai` is the skill for every Jev question; invoke it before section 3.

## 0. The goal, in one sentence

Finish the M3 leg of the golden path on F-RCC6-BNBC by making the product place the drawing's
columns, carry the Jev programme from its second logic-point to its sixth on the pattern the first
one set, take the five screens still under the craft bar to it, and leave `pnpm gate` green with a
craft table every screen of which is at the bar.

## 1. Where you start

Read first, in this order, whole: `CLAUDE.md`; `docs/handoff/fable-5.1-session-4.md` (§1 the M3
leg's standing and the four defects it found, §3 the Jev programme's first point and the pattern
it set, §4 the craft table, §7 what remains); `docs/decisions/as-05-jev-amendment.md`; the Bible:
J-000's M3 segments (AM-17), R-TO-030, R-TO-031, L-CAD-06/07/08, L-AI-01..03, AS-05, R-AI-005,
Q-08, AM-08 (the craft rubric), AM-09; then the Decisions of every screen you touch, starting with
`docs/design/s-audit.md` (I-37, I-38 — the ledger's calibration line and the act log as a grid),
`s-drawings.md` (I-95–I-97, I-284 — the card's picture waits for no partition), `s-drawings-sets.md`,
`s-settings-participants.md` (I-213, I-214 — the sixteen-row frame and why), `viewer.md`
(I-188, I-189). Then handoff §7 items 6, 8 and 9: the gate's logs, the e2e lane over its ceiling,
and the partition's clock in the lane.

Inherited, still standing:
- The TypeSafe key: the owner keeps `TYPESAFE_API_KEY` in `~/.bashrc`, and it stands in the
  session's shell. It is never printed, never written into a file, a fixture, a log or a commit, and
  never reintroduced as a literal; the two commits that once carried one (`d4bc0da3`, `61a9632b`)
  are the owner's to rotate. With no key, or with `CUBIT_MODEL_FIXTURE_ROOT` set, the seam replays
  `fixtures/model` and posts nothing.
- The budget is open for live Jev calls that development and testing need. The law is the
  constraint: every live answer a lane will ever need is recorded once (Q-08) by
  `scripts/model-corpus.ts` and replayed (L-AI-01); every call is a ledger row with its question,
  its judgment and its cost; no verify, db, golden, e2e or perf lane ever reaches the network.
- Jev is not among AS-05's closed model ids and no rate exists for it. The amendment the owner
  would add is written (`docs/decisions/as-05-jev-amendment.md`, unnumbered, the documented rate
  cited); nothing adds Jev to AS-05 or invents a rate. Until it lands, a Jev call is billed under
  the pinned Claude id and the handoff says so beside every cost line.
- F-RCC6 is byte-frozen at v1.1 (AM-01); F-RCC6-BNBC (`fixtures/rcc6-bnbc/`) is the M3 yardstick.
  Its traps are registered in `fixtures/rcc6-bnbc/traps.json`, and session 4 read four of them
  the hard way (handoff §2).
- `~/vextrus-builder/docs/design/reference/*.dwg` are never committed; `ARCHITECTURE.dwg` refuses
  `HANDLES_NOT_UNIQUE`.
- `mcp__builder__check` and `mcp__builder__scratch_dir` may or may not exist. Route lanes through
  them if they do; by shell if they do not, and say which in the handoff.

What session 4 left you, all proved (handoff §3, §5):
- The ledger records each call's closed question (`MODEL_QUESTIONS`) and the model's own judgment
  (`model_calls.question`, `model_calls.judgment`; migration 0054); a person's later act is its
  outcome (`model_call_outcomes`: CONFIRMED, OVERRULED, REPUDIATED, AFFIRMED — written by
  `recordDisposition` and `CONFIRM_VIEW_TYPE`); the calibration read is
  `src/core/model-calibration.ts`; S-Audit's ledger panel lists calls with outcomes and one line
  per question. The pattern for every later question is this one: request builder names its
  question · adapter recognises it by key set and reads the judgment · fixture recorded once by the
  script · outcome written by the act that judges it · Decision amendment · tests first · one
  commit citing the clause.
- The corpus recorder `scripts/model-corpus.ts` (`record` under a scratch root, `file` into
  `fixtures/model` with `corpus.json`, `roster`), and the first corpus: ten fixtures, `corpus.json`
  their roster with the cost lines.
- The craft walk `scripts/probe/craft-walk.sh` over all eighteen screens; `pnpm gate` (redirect its
  stdout to a file of your own — its lane logs under `test-results/gate/` are cleaned by its own e2e
  lanes, handoff §7 item 6); `pnpm e2e:retake` (dry, then `-- --write`, then a `baseline:` commit);
  the probe.

## 2. The M3 leg, and the one door it is missing

`tests/e2e/journeys/j-000/m3-bill-and-schedules.spec.ts` walks F-RCC6-BNBC by clicks through the
levels, the notes and Measure. Session 4 fixed what the walk found (handoff §2): the partition
write that refused a sectionless registry row, the caption grammar that read no LAYOUT as a plan,
the schedules rail that wrapped one sheet's name over the next, and the notes grammar that read a
stirrup clause's 2D as a lap. What it could not fix in its
hours is the reason the campaign places no column: the BNBC drawing names its column layout plan
ONLY in paper space — the S-10 viewport's title `COLUMN LAYOUT PLAN  SCALE 1:100` — and the model
space carries the plan's geometry with its column marks C1–C6 as the largest texts, which the
partition anchors as six views of nothing. The partition reads model-space captions and nothing
else (R-TO-030), so no view of that plan exists to place columns off, and the BBS golden (columns
and shear walls) cannot be walked.

The door to build, tests first, on the Bible's own reading of L-CAD-06 and R-TO-030: a paper-space
viewport's title is the caption of the model-space region the viewport shows. Read
`fixtures/rcc6-bnbc/traps.json` (T-FRAMES-MODELSPACE, T-KEYPLAN, T-TEXT-OVERLAP), the
extractor's artifact for the paper layouts (each holds a VIEWPORT with its model-space window and
the sheet's title texts), and `src/modules/takeoff/partition/views/assign.ts`. A viewport's window
becomes a view whose caption is the title text nearest the viewport on its sheet, typed by the same
grammar; a model-space caption inside that window stays the anchor it was; the six column marks
are the placement's marks, not captions (the T-TEXT-OVERLAP trap). Record the Interpretation in
`docs/design/viewer.md` and the partition's Decision. Then the leg's four tests run as one segment
list; the roster moves `m3` from ANNOUNCED to SHIPPED only when the leg is green end to end; until
then the leg's later tests stay `test.fixme` opening with `MISSING DOOR:` as session 4 left them.

Two more things the leg needs and session 4 measured: the grid detector found no axis on the BNBC
plan sheets (`grid: axes 0` in the partition's steps) — read `src/modules/takeoff/partition/grid/detect.ts`
against the BNBC bubbles once a layout-plan view exists; and the levels proposal proposes none because
the section's marks read `GF EL +0.000`, whose words before the elevation the notation's floor-zone
reading answers nothing for (`levels-proposal/propose.ts`) — read `EL` as the level word it is, and
the eight-level stack is offered whole for one INSERT_LEVEL instead of inserted by hand.

## 3. The Jev programme — invoke `/typesafe:typesafe-ai` first

Points 2–7 of the session-4 prompt, in the same order and on the point-1 pattern (handoff §3):

2. Schedule cell readings (S-Schedules): a Choice over the candidates the partition found for a
   member-type cell, and a Noul "this row is a header, not a member". Corpus from BNBC's five
   schedules. Outcome: `TRANSCRIBE_SHEET_NOTES`'s sibling act on the schedule, or the cell's
   disposition.
3. Notes clause class: a Choice over the closed clause list for each general-note clause; the
   figure code-extracted; the contested 50d lap a Noul. Corpus from S-01/S-02. Outcome:
   `TRANSCRIBE_SHEET_NOTES` (CONFIRMED where taken as proposed, OVERRULED where edited).
4. Coverage causes (S-Coverage): a Choice over the closed cause codes given the rail observations
   for an unmeasured cell; the certificate's sentence chosen from the registry; a low-confidence
   choice escalated to the inspector. Outcome: `DECLARE_NOT_IN_PROJECT_SCOPE` / `HOLD_OUT_OF_BILL`.
5. BOQ line description (S-BOQ): a Choice over the catalogue's closed descriptions for a kind and
   class, the taxonomy row cited. Outcome: the draft's issue.
6. Corroboration (S-Takeoff): a Noul "the outline corroborates the sighting" over the two readings
   of an `INTERPRETED_UNCORROBORATED` outline. Outcome: `CORROBORATE` (AFFIRMED) / `REPUDIATE`.
7. Beyond M3 where the law admits it: sheet revision recency (a Score), the reference sheets'
   discipline at upload.

For each: the closed question and its primitive, named in `MODEL_QUESTIONS`; the state as named
JSON fields; criteria closed with a no-match outcome; candidates code found; the corpus recorded by
the script under a scratch root, read, then filed in its own `baseline(corpus):` commit quoting the
cost lines; the outcome written by the act that judges it; the calibration line read on S-Audit;
the Decision amendment; tests first; one commit citing the clause. Quote every question's
calibration line in the handoff.

## 4. The craft table

Session 4's after-table is in the handoff §4 (twelve of eighteen at the bar). Bring the six still
under it to the bar, each against its Decision: the sets index and the set browser (lists that the
rubric measures as no primary — the Decision's `<ul>`s become DataTable v2 grids, an
Interpretation each), documents and the bar schedule (walk them on a project that has issued a
document and a schedule; an empty screen has no grid to measure, by design, and the journeys assert
it), the register (identifierExposure 0 — the EvidenceLink labels carry the view key as text;
handoff §7 item 3 names the amendment), S-Schedules (the notes panel is not a candidate of the
rubric; decide with the Decision whether the work column is the grid). The draft BOQ stands at the
bar since the after-walk; its primary once stood 5 263 px below main's top on the before-walk's
project, which is why the rubric now measures the outermost region (`b78eedcb`). Read, before your
first walk, why one dark 1440 capture of home and of participants showed the workspace sidebar
expanded at 220 px (handoff §4, `chromeGeometry 3`) — the walk's pointer or the run's preference —
and make the walk state it. Then re-take every picture the lawful changes moved with
`pnpm e2e:retake -- --write` in a `baseline:` commit, never `--update-snapshots`.

## 5. The rest of section 7 (session-3 handoff), still owed

- The reference sheets through the product with the probe: the Edison Lavinia sheet's 22k entities
  at 60 fps, the General Note whole and in order, the BNBC drawing's 53 viewports;
  `ARCHITECTURE.dwg` repaired with L-CAD-09's count and a byte-identical proof, else its refusal
  recorded by name.
- Uploads over plain HTTP: the SHA-256 parity probe that tampers one byte on the wire and reads
  `DIGEST_MISMATCH` by name.
- The light lane (`CUBIT_E2E_LIGHT=1`, the gallery walk) run once and its pictures re-taken where
  lawful changes moved them; J-011's fly-to repaint leg if it is in reach.
- M4 stays ANNOUNCED.

## 6. The method

Review, then TDD, then prove — one slice at a time. For each slice: read the Decision and the
clauses; walk the screen with the probe; write the failing test in the lane the suite belongs to;
make the smallest change; run that suite by name; commit with the clause and the proof line. A
screen is implemented against its Decision; a deviation is a defect; a second spelling of a
document is a defect. Where the Bible and a Decision disagree, the Bible wins and you record an
Interpretation; where the Bible contradicts itself, stop that slice with a named reason. Never
narrow the roster to what is easy: finish every slice or say exactly which part is blocked and by
what. Never `test.skip`; `test.fixme` only with `MISSING DOOR:` on the J-000 roster. A flake is a
defect with a cause. Two heavy lanes never run at once; the db lane never runs beside a served
product; the e2e lane cleans `test-results/`, so a golden run written for one worker is walked
again by the next run — budget the M3 leg at thirty minutes a run and read its trace when it is red.

## 7. The gate you leave behind

`pnpm gate` green, every lane's lines quoted in the handoff: `pnpm verify` (`LANE <id>` each,
≤ 60 s), `pnpm checkup`, `pnpm test:golden`, `pnpm test:db`, `pnpm e2e` (the full dark sweep),
`pnpm e2e --journeys J-000` (with M3), `pnpm test:perf`. Know before you quote it: the plain
`pnpm e2e` selects J-000's legs too, so the `e2e` lane runs about 21 min at four workers against
V-E2E's 12 — handoff §7 item 8 records the finding and names the toolchain as its owner; a green
lane over its ceiling is quoted with its wall-time and the item beside it, never as a bare green.
The craft table after, from
`craft-walk.sh`, every screen at the bar. Zero ESLint errors and no warning above the frozen
counts; zero TypeScript errors; ruff clean. The model ledger's calibration line per question in the
handoff, and the fixture corpus's roster.

## 8. How you finish

Write `docs/handoff/fable-5.1-session-5.md`: what you proved (per journey: shipped verdict, your
walk, craft score before and after), what you fixed (commit, clause, test), what you built (each
Jev question with its primitive, state, criteria, corpus size, calibration), what you declined by
law with the clause, what remains and who owns it, the gate lines verbatim, and the command that
reproduces each proof. Then write `docs/handoff/fable-5.1-session-6-prompt.md` for the session
after you, in this shape. Commit both. Stop with the tree clean, every commit self-explaining, and
nothing in your last message that is a plan rather than a fact.

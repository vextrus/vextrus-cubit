# Session 6 handoff — Opus 5 orchestrating, closed on Opus 5.5

Branch `dev-lane-and-jev`, from `ec3b079e` (main `8cf9f11f`, never touched). Run by Claude Opus 5 as
orchestrator with Opus 5 workers through dynamic workflows and single agents; the owner switched the
session to **Claude Opus 5.5** (`claude-opus-5-5`, released 2026-09-22) for its close, and this
document, the session-7 prompt, `CLAUDE.md`'s standing facts and the settings were written on it.
The ledger is `docs/handoff/session-6-ledger.md` — every run, its proof lines, what I did with it.

`mcp__builder__check`, `mcp__builder__scratch_dir` and `mcp__builder__debt_rows` were ABSENT, as in
every interactive session so far; every lane ran by shell and every verdict below is the lane's own
line. `TYPESAFE_API_KEY` stood in the shell and was never printed, written or committed. No live Jev
call was made this session.

## 0. Where the programme stands — sessions 1 to 6

| Session | Model | What it moved |
|---|---|---|
| 1 | — | the dev lane (`pnpm dev`, `cubit_dev`), WSL2 origin/CSP, the SHA-256 fallback, DWG through the CLI, the viewer's select/pan, Jev's live transport — and a TypeSafe key committed to history (removed in 2; **rotation still owed by the owner**) |
| 2 | Fable 5.1 | real-world DWG healed (Edison Lavinia, 22,104 entities); F-RCC6-BNBC's viewports kept; the viewer projects model space through paper windows; Jev made lawful (fixture replay, nothing supplied where Jev supplied nothing) |
| 3 | Fable 5.1 | **M0–M2 proved end to end in a browser**; the re-expansion door; the signed object door; the probe, `pnpm gate`, `pnpm e2e:retake`; the gate green; craft 4 of 18 at the bar |
| 4 | Fable 5.1 | the first M3 leg walked (levels and notes); the BBS export door; Jev logic-point 1 with the ledger's outcome column and the calibration line; craft 12 of 18; the gate green |
| 5 | Fable 5.1 orchestrating Opus 5 | the viewport-caption door and five more (I-290…I-302); **`m3-measure-and-register` green** — the BNBC column campaign measured; Jev points 2–7 built and recorded (240 fixtures); six craft slices; the gate NOT run at the end |
| 6 | Opus 5 orchestrating Opus 5; closed on Opus 5.5 | the gate run first and every red read to a cause; the two M3 doors landed in code (a plan note is evidence about its member; a column may be a circle); the Jev confidence contract corrected; the owner's demo; the open defect's cause named |

What that adds up to, honestly: **M0–M2 are proved and green. M3 is measured but not billed** — the
BNBC campaign ingests, reads its levels, notes, schedules, grid and scales, places and measures its
columns, and presents them in the register, coverage and BOQ screens; the leg that reads the bill and
the bar schedule against the independent golden stands `test.fixme` on one named defect and one
missing door (§7 items 1 and 4). **M4 has not started.** The craft table has not been walked since
session 4.

## 1. What was proved, per journey

- **J-000 M0–M2** — green in the gate's `e2e-j000` lane (`GATE e2e-j000 green 165.55s`).
- **J-000 M3 `m3-levels-and-notes`** — green in the gate and again for the owner's demo (`✓ … (1.7m)`).
- **J-000 M3 `m3-measure-and-register`** — green in the gate and for the demo (`✓ … (34.9s)`). **Read
  with care:** it asserts the register's review, not its figures — "182 lines / 92.21 m³" in its
  docblock is prose — and after this session's doors the campaign measures **189 lines / 94.196 m³**,
  which the leg does not see (§7 item 1).
- **J-000 M3 `m3-bill-and-schedules`** — `test.fixme` on both tests, unchanged. The two doors its
  `MISSING DOOR:` text names are landed in code and proven in the db lane; the leg is not released,
  because the register ignores the notes in the journey path and the leg itself was never rewritten
  (§7 items 1–3).
- **The regression sweep** — `52 passed / 1 failed / 1 skipped` at the start; the one red was
  `s-takeoff/register.png`, re-taken (§2). The J-021 register spec passes after it.

## 2. What was fixed (commit · clause · proof)

- `d4aa70e7` **test(levels-ui)** — the unit lane had been red since session 5's `ef3bb0b5`, whose
  portal made `useTakeoffTabsAside` ANSWER a node its caller renders; the levels test stage still
  called it for an effect and rendered `null`, so the stack's one INSERT_LEVEL door stood nowhere.
  A second spelling of one contract. `tests/takeoff/levels-ui` 3 files / 13 tests green. (I-246)
- `4407612d` **baseline(s-takeoff)** — `register.png` re-taken after reading its bands and the image:
  the two moved regions are exactly where the register now draws object keys through `IdChip`. The
  sweep compared all 54 specs, so this was the ONE picture session 5 moved. (AM-09 §4)
- **checkup's dev-db drift** — `pnpm db:migrate:dev`; no commit, a state of the owner's database.
- **PERF-011** — not a red: my orientation fan-out loaded the box during the gate's perf lane, whose
  instrument is coarsened to 0.1 ms with a tolerance of half a tick. Green twice on a quiet box.
- `7689a117` **ai(seam)** — the handoff called `answerJudgmentOf` "reading a Noul's probability as its
  confidence" and implied a fix that is impossible: the provider states **no** confidence for a Noul
  (four sources). The defect was a call's confidence taken as the minimum over a quantity one answer
  does not have. A Noul now carries `confidence: null`; the call takes the weakest answer that states
  one; `outline-corroboration` bands the probability read from the answer's own `value`; the
  calibration line counts `confidenceStated` so a Noul question reads as judged-with-nothing-to-average
  rather than unjudged. (L-AI-01, L-AI-02)
- `67059246`, `a7c4c176`, `a46408b0` — **the two M3 doors**, §3.

## 3. What was built

**The law.** Three Interpretations, and the ruling that shaped them was the owner's, asked because the
drawing states no storey range for the porch column at all.
- **I-303** (`docs/design/viewer.md` §0) — a plan note that names a mark is evidence about that
  MEMBER; a member so noted is not expanded by the view's authored typical range. A note is read only
  where its remainder states a SHAPE or a range bounded by the one word `STARTS`; everything else
  leaves its member exactly as the typical range found it. That fence is what makes the rule safe: a
  note stating no range pins its member to the drawn level, so an unfenced reader would collapse the
  C4 family on `C4 SEE DETAIL 3/S-12`, and this drawing's own `C4 3RD-4TH BARS REVISED; ISSUED FO`
  and `C2 GF TO 2ND:` would do the same. I-303 only ever narrows.
- **I-304** (`viewer.md` §0) — the plan states the SHAPE, the schedule the SIZE, and `Ø450` beside
  `450x450` is not a disagreement. The drawn circle cannot decide it: the DXF carries an LWPOLYLINE
  450×450 (`994`) and a CIRCLE r 225 (`9B9`) at one centre and the merge keeps the square. The note
  key is CARRIED on the placement and not yet CITED by any offer — an IOU recorded in the text.
- **I-305** (`s-takeoff.md` §0) — a circular column is L-FRM-01's PRISM_POLY billed by its own rule,
  the bored pile's landed reading; today's 450×450 prism is the silent bounding-box fallback L-FRM-01
  forbids.

**The code**, in four commits over a green tree each time:
- `parseDiameter` beside `parseSizePair` — anchored, so a sentence answers null; a golden corpus of
  sixteen real strings. `readNotation` and the corpus ratchet (`read=3067 trap=8 allowed=27 of 3102`)
  untouched, deliberately.
- `rcc.column.circular.concrete@1` = `count × 3.14159265358979323846 × d × d × H ÷ 4`, `PI` hoisted
  to one home, and the edition it forces: **IS1200_IN @ 2027.03**, 37 methods, digest `0475191d…`
  computed and diffed against the module rather than transcribed. **Migration 0056** carries it and
  five nullable note columns on `placements` with three CHECKs.
- The note reader (`memberNoteOf`, `bandStatedIn`, `soleNotesAmong`) and the placement stage that
  uses it: C7's note BINDS to its mark's placement; C5's note MINTS one on the only unclaimed ring in
  reach — measured on the real EntityGraph, `9BB` at 806.23 mm against a reach of 2194.56, the next
  outline of any kind 3466.4 mm away. Census `noted: 2, minted: 1`, placements 204 → 205.
- The expansion cuts the band-cut set by the note; `lowestOf` by ordinal, never `levels[0]`;
  `placementRowOf` is the one stored-row conversion both readers use.
- The column rail branches on the shape and still computes nothing; `SECTION_NOT_CIRCULAR` is the one
  new refusal. Column formwork and rebar provably do not move.

## 4. The craft table

**NOT walked**, for the second session running. Session 4's table (12 of 18 at the bar) is the last
graded one. The owner stopped fixing mid-session for a demo, and the session closed on documents.

## 5. The gate, verbatim

**At the start** (`pnpm gate`, stdout to scratch, logs `node_modules/.cache/cubit/gate/`):

```
GATE summary — verify: RED exit=1 147.53s · checkup: RED exit=1 0.64s · golden: green 2.06s ·
  db: green 85.31s · e2e: RED exit=1 99.70s · e2e-j000: green 165.55s · perf: RED exit=1 15.98s
GATE wall-time 516.77s exit 1
```

Every red read to its cause (§2). Note `verify wall-time 143.29s` with `LANE cad 143.08s`: the cad
lane's regeneration proof (`node_modules/.cache/cubit/cad-regeneration.json`) is written only on a
GREEN verify, and this one was red on unit — so the next session's first green verify pays the
~140 s regeneration once and the ones after it skip to ~55 s. V-VERIFY's 60 s is met on the second.

**At the end** — the full `pnpm gate` was **NOT re-run**. What was, on the committed tree `a46408b0`:

```
pnpm test        Test Files 505 passed (505) / Tests 3302 passed (3302)
pnpm test:db     Test Files 231 passed (231) / Tests 1407 passed (1407)   81.12s
pnpm lint        0 errors, 161 warnings (the standing count)
npx tsc --noEmit exit 0
pnpm db:drift --scratch                clean
node scripts/method-hashes.mjs         8 manifest(s) match their recorded digests
pnpm e2e --journeys J-000 --workers 1 <m3-levels-and-notes, m3-measure-and-register>
                                       2 passed (2.7m)
pnpm checkup     database cubit_dev present at migration head (56/56 migrations applied)
```

0056 landed after that checkup, so `cubit_dev` fell one behind again — measured at the close,
`migration drift (56/57 migrations applied) — FAIL` — and `pnpm db:migrate:dev` brought it to
`present at migration head (57/57 migrations applied)` before this commit. Any later migration owes
the same step: it is the remedy `checkup` names, not a defect.

## 6. Not done, and why

- **The owner asked mid-session to stop fixing and give him the product in a browser.** Done (§1);
  what that left undone is §7 items 1–3 and 5.
- **The typical-range act's third spelling** — found and diagnosed after the demo (§7 item 1), not
  fixed, by the same instruction.
- **The leg's release** (S7 of the design) — designed exactly, not written.
- **The craft walk; Jev's unwired passes; the viewer on 100k sheets; the frame's slots** — not
  reached. Each is in §7 with what is already measured about it.
- **Never** `--update-snapshots`, a landed migration edited, or `test.skip`.

## 7. What remains, ranked — the next session's backlog

**P0 — M3's golden path, honestly green.**
1. **The register ignores the notes.** `src/core/acts/author-typical-range.ts` imports `placements`,
   `memberTypeVariants` and `registerObjects` directly, re-does the band cut with
   `bandCovers`/`placedBy`, never reads a note column, and registers every placeholder over the
   authored range with the drawn level MEASURED; register objects are never retracted. The journey's
   figure proves it to the litre: 90.833 (golden GF..6F) + 0.453 (C5 wrongly on GF) + 6 × 0.485 (C7,
   correctly a CIRCLE, wrongly on 1F..6F) = 94.195 against the measured 94.196, and 27 × 7 = 189 lines.
   The rail door works end to end; only the act's expansion is wrong. Fix shapes, in preference: the
   act stops registering and the router's `reexpandProject` (already called at `takeoff.ts:445,483,
   520`) registers through the one resolver; or the cut moves to ONE pure home in `src/core` that both
   import. Prove it with a db-lane case that authors a range over a NOTED placement through the act.
2. **Release the BOQ leg.** Move the BBS test whole to `m3-bar-schedule.spec.ts` (it claims "emit the
   unpriced BOQ and the BBS as DRAFT UNSIGNED"; the bill leg claims "generate BOQ PDF (draft); open the
   XLSX"); delete EVERY `MISSING DOOR:` string from the bill leg (`j-000-roster.test.ts:252-256` forbids
   any `test(` while one matches); give `insideBand` the document's own slack — a cell summing `n`
   lines each stated to `p` places may exceed the true sum by `n × ½·10⁻ᵖ`, plus one half-ulp for the
   golden: after the doors, five of seven cells are +0.001–0.002 m³ over on rounding alone; correct the
   spec's prose (1.35 %, not 1.37; C7 stands on FDN and GF, not GF alone); rewrite `fixme-roster.test.ts`.
3. **Assert what the band cannot see.** `matrix.declared` is computed and never asserted, so
   `COLUMN|RCC_CONCRETE|FDN` (3.060) and `|ROOF` (0.617) — 3.9 % of the golden — pass unchecked. Name
   the published and the declared cells and assert both.
4. **The rebar schedule reader** — `REBAR_SCHEDULE_UNREAD` stands on every column (S-11's banded rows;
   traps T-SCHED-TWO-TEXTS, T-REV-CLOUD, T-NOTE-OVERRIDE). This is the door the bar-schedule leg names,
   and the last one between M3 and done.
5. **The gate green and the craft table walked** on the committed tree, with the M3 project graded
   (`craft-walk.sh <run.json> <out> bnbc` — Documents and the Bar schedule need an issued document).

**P1 — what a demo needs.**
6. The frame's effect-handover slots (`useShellToolbar`, `useShellStatus`, `useInspector`, and
   `useShellPage` at 13 sites) — the class that cost the Measure door.
7. The viewer on a 100k-entity sheet: ELECTRICAL.dwg's model layout crashes the tab under SwiftShader;
   PLUMBING and the Structural drawing paint at 41 / 80 ms median against 16.7.
8. **The model ledger's rates** are wrong ($15/$75 and $3/$15 against the published $5/$25 and $2/$10;
   AS-05 names ids, not rates) — and the pins: `claude-opus-5-5` and `jev-latest` are both an AS-05
   change plus a migration re-closing `model_calls.model_id`.
9. **A demo that opens from Windows without a relay** — WSL2 runs NAT here (no `networkingMode`) and
   the served product binds 127.0.0.1. The owner's fix is `networkingMode=mirrored` under `[wsl2]` in
   **`%UserProfile%\.wslconfig` on the Windows side** (not `/etc/wsl.conf`, which I misstated to the
   owner mid-session); the product's is a documented demo runbook with seeded demo data.

**P2 — Jev's unwired passes, and the corpus.** Five passes are unwired: schedule-cell (asker, store,
surface), note-clause (`runNoteClausePass` into `runPartitionJob`; `schedules.proposalGoverns`),
outline-corroboration (store, server read), sheet-revision-recency part (b), and sheet-reading
(`understandSheet` has no caller outside its module). The grammar DOES read `LAP 50d TENSION / 40d
COMPRESSION U.N.O.` (session 5's claim otherwise came from a mislabelled recorder line); the gaps are
the 40d compression figure and the governs proposition. The corpus stores derived judgments, not raw
bodies — decide whether to re-record with the body kept.

**P3 — debts found.** `SEED_VERSION` in four places outside its one home; CONTROL_CODES twice
(`entitygraph/notation.ts` and `grammar.ts`); `NAMED_LEVELS` twice and **disagreeing** on `FOOTING`;
STOREY_WORDS twice; the one-word `STARTS` roster; the note key uncited (I-304); I-310 cited at
`j-032-schedules-notes.spec.ts:319` and defined nowhere; `register-workspace` resolving twice.

**Standing, the owner's.** Rotate the TypeSafe key in history (`d4bc0da3`, `61a9632b`).
`ARCHITECTURE.dwg` refuses HANDLES_NOT_UNIQUE (LibreDWG's page map). The branch carries **four**
migrations on its base (0053–0056); `db-regenerate-migration.mjs` refuses that at integration by
design, and the integrator regenerates one from the combined schema when this branch merges.

**M4** — `m4-sheet-and-manual-measure`: ingest and corroborate a PDF sheet, measure a manual
condition, take rooms and finishes, ask a question of the drawings. Not started; its segments are
AM-17's.

## 8. Reproducing each proof

- The gate: `pnpm gate > <scratch>/gate.out 2>&1` (logs survive under `node_modules/.cache/cubit/gate/`).
- The M3 legs: `pnpm e2e:clean && pnpm e2e --journeys J-000 --workers 1 tests/e2e/journeys/j-000/m3-levels-and-notes.spec.ts tests/e2e/journeys/j-000/m3-measure-and-register.spec.ts`.
- The notes, read back: `psql postgres://cubit_app:cubit_app@127.0.0.1:5544/cubit_e2e -c "set cubit.system_reason='read';" -c "select mark, note_key, note_from_label, note_shape from placements where project_id='<bnbc project>' and note_key is not null;"` — scope to the run file's `bnbc.projectId`.
- The I-303 corpus proof: `pnpm test:db tests/takeoff/partition/placement/journey-partition.test.ts --reporter=verbose`.
- The demo: `pnpm probe:server`; from Windows, `socat TCP-LISTEN:3211,bind=$(hostname -I | awk '{print $1}'),fork,reuseaddr TCP:127.0.0.1:3211`; sign in with the run file's email and `golden-path-legs-<stamp>`. Stop with `pnpm probe:server -- --stop` and `pgrep -ax socat` then `kill <pid>` — `pkill -f` with the relay's own arguments matches its own shell.

## 9. How the session was orchestrated

Three workflows and five single agents, 27 agents in all, ≈ 3.98 M subagent tokens (the ledger's
table). The orientation fan-out with a completeness critic, the design panel with a max-effort
integrator, and disjoint-file implementers were all worth their cost; the critic and the integrator
each overturned a premise the whole session had carried. Five times a worker caught a real error in
its brief — two stopped outright (the Jev seam, the rail), three reported it loudly rather than build
around it (the law, the method, the placement stage) — and each time the tree was better for it than
it would have been for compliance. What cost: a fan-out during the gate's perf lane; my own four-answer law; brief
figures taken from the generator rather than the EntityGraph; an unscoped database query. The scripts
are under `docs/handoff/workflows/session-6/` as `.js.txt`.

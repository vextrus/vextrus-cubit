# Session 8 — M3 complete, and M4 begun (orchestrator edition)

You are **Claude Opus 5.5** (`claude-opus-5-5`), the orchestrator of session 8 on `vextrus-cubit`,
branch `dev-lane-and-jev` (main `8cf9f11f`, never touched). Your workers are Opus 5.5.

Session 7, the first run end to end on this model, took the product from 7.7 % to 50.2 % of the
golden's RCC concrete compared COMPLETE on F-RCC6-BNBC. It put all 18 screens at the craft bar, with
every capture looked at on the final tree. It turned the viewer's performance proof honest and green,
and it built the demo command. It did not finish M3. Read `docs/handoff/session-7.md` first: §0 the
arc, §6 what was not done, §7 the ranked backlog, what stands the owner's, and the carried debts.

`CLAUDE.md` is the product's law and binds you and every agent you spawn. Its standing facts carry
what sessions 5–7 learned the hard way. Where this prompt and `CLAUDE.md` disagree, `CLAUDE.md` wins.

Abbreviations below:
- **J-BREADTH** is `~/.claude/projects/-home-riz-vextrus-cubit/bbdf46f0-385d-4fc3-97d1-873757ce4017/subagents/workflows/wf_d6a5de12-0ac/journal.jsonl`.
- **J-R6** is the same directory with `wf_96743886-20c/journal.jsonl`.
- **The ledger** is `docs/handoff/session-7-ledger.md`.

## 0. The goal, and the finish line

**Complete M3 against the golden the owner rules, and begin M4, at a quality the owner can
demonstrate without a caveat.** Done means these conditions, in this order. Each is proved by a lane's
own line, a figure read from the store, or a picture you looked at.

1. **R0 ruled.** One `AskUserQuestion` round early, carrying the breadth map's per-cell evidence:
   - ~78 golden cells are not reachable from the drawing as drawn;
   - ~15 cells disagree with it;
   - plus the R6 critic's golden corrections GC-1..GC-4 (session-7 handoff §7, "Standing, the owner's").
   The ledger keeps only the summaries; the per-cell detail survives in J-BREADTH and J-R6 (session-7
   handoff §6). The choice is a `baseline:` regeneration of F-RCC6-BNBC (not byte-frozen) or
   Deviations re-scoping AM-01's exit. The ruling decides what "M3 complete" means.
2. **M3 walks whole.** `pnpm e2e --journeys J-000` is green with `m3-bar-schedule` released: FRM-3
   places the vertical beams, and the column ties are derived from BNBC 2020's clauses (vendored in
   `docs/reference/bnbc-2020/`; D-003 is reserved for that ruling).
3. **The gate stays green, with verify ≤ 60 s.** The closing gate of session 7 (gate 8, on `7d4b69e8`,
   the final product tree) read `verify wall-time 59.01s`: cad 52.44 s (the wall), unit 47.08, lint
   40.98, types 8.49, build 6.37.
   - That build compiled cold on 7d4b69e8's source change. Since `ffdfdb1a` a warm build reads ~3 s
     whatever the journeys wrote.
   - The first verify after a reboot read 66.39 s on cold caches, so measure on a warm machine.
   - **The margin is thin.** The next margin is the cad lane's own: 461 pytest cases in one serial
     process.
     - `pytest-xdist` is not installed in `cad/.venv`.
     - pytest-xdist 3.8.0 and execnet 2.1.2 are already in the local uv cache, and
       `uv pip install --dry-run --offline` resolves them (checked at session 7's close), so adding
       them needs no web access.
     - It still moves a pin, so it is a `toolchain`-tagged increment.
4. **The craft table stays at the bar and the demo stays real, on the tree the session ends on.**
   - **The ground:** 18 of 18 on `7d4b69e8`'s tree over BNBC `1a78eafd`. 72 captures, 0 RED, axe
     0/0/0, every capture looked at (`wf_35743067-b04`): 4 lowerings, 10 demo-visible defects, 25
     polish (`docs/handoff/session-7-artifacts/relook-final.json`).
   - **Re-walked when:**
     - before committing any slice that changes what a screen renders — the routes it touches, both
       themes, both viewports. Session 7's craft wave 3 landed on its e2e lanes without a re-walk,
       and S-Project fell to min 1 (7d4b69e8's message);
     - once on the closing tree, after the closing gate, over that gate's J-000 BNBC project,
       followed by a re-look workflow over every capture. The commands: `pnpm probe:server`, then
       `PROBE_SHEET="S-10 COLUMN LAYOUT PLAN" bash scripts/probe/craft-walk.sh <run.json> <out> bnbc`.
       The perf lane deletes run files, so run J-000 alone for them, or find the project by name
       (session-7 handoff §8).
   - **The bar:** every route at ≥ 4.0 with no criterion below 3. A person may only lower a computed
     criterion. "18 of 18" is today's count: a screen M4 adds joins `craft-walk.sh`'s list in the
     slice that ships it.
   - **The demo** runs on the closing tree after the closing gate. `pnpm demo --no-open` serves that
     gate's newest billed BNBC project, proved as session 7 proved it:
     - the sign-in is proved against the stored hash;
     - Windows `curl.exe` gets 307 → `/sign-in`, then 200;
     - `pnpm probe signin` reads OK;
     - the register is walked at axe 0/0/0 and looked at, with its line count and totals matched to
       the store's read-back;
     - the AI spend is read at the pinned rate.
     When beam or slab lines turn COMPLETE, the demo's totals move with them: quote the store's
     figures, not session 7's.
5. **M4's first door walked**, on the committed tree. "Walked" requires all of these:
   - The one `test.fixme` in `m4-sheet-and-manual-measure.spec.ts` becomes a running `test` that
     clicks what a customer clicks and stages nothing, green in `pnpm e2e --journeys J-000`.
   - Its fixme-roster entry is deleted, and `m4` moves from ANNOUNCED to SHIPPED in
     `tests/journeys/j-000-roster.test.ts`.
   - The doors its header names have landed:
     - `docs/design/s-measure.md` is written first (C-13);
     - a manual measurement act with its L-ACT-02 pair and its permission;
     - the identity rule for a row with no mark;
     - a method pair over POLYLINE/POLYGON in an edition (a migration);
     - a condition store;
     - Linear and Area armed;
     - the measurement list;
     - a live-database test that `authorize()` refuses a caller without the permission.
   - The leg asserts a figure against a golden cell named by roster, read back from the run's own
     store. The header proposes GF SLAB × BLINDING (23.615 m³), but slab on grade sits in the map's
     unreachable group, so R0 should settle which cell it walks against. That is an inference, not a
     measurement.
   - The new screen is at the craft bar (condition 4).
   - **"Or the doors re-measured"** is the fallback, and it is a restatement, not progress: every
     file:line in the four m4 headers and their roster reasons is re-read on the closing tree, the
     stale ones are corrected in one commit, and the handoff says which of the two was reached.

## 1. Launch and Phase 0

Launch as session 7 did: `cd ~/vextrus-cubit && claude --effort xhigh`, with the settings of the
session-7 prompt §1. `worktree.baseRef: "head"` is essential.

**Phase 0: ground truth before any edit.** Make no product edit until Phase 0's exit condition
holds.
- **Verify the harness, and write it in the ledger:** the model, `claude --version`, the settings, the
  tool list and the skills.
  - If the demo is still running, run `pnpm demo --stop` before any lane.
  - Confirm the machine: `netsh.exe interface portproxy show all` is EMPTY, the scheduled task "WSL
    localhost sync" is Disabled, and 3210, 3211 and 3213 read free (`portState`).
- **Run `pnpm gate` alone, and read every red to a cause.** Session 7's closing gate ran on
  `7d4b69e8`. Its final commit added only documents and the D-003 citation fix in two test files.
- **`pnpm e2e:clean && pnpm e2e --journeys J-000`, then read the BNBC project back** with
  `docs/handoff/session-7-readback.sql`. Expect:
  - column concrete 208 COMPLETE lines, 93.892896 m³;
  - piles 89 / 372.848929 m³;
  - caps 26 / 128.781275 m³, cap formwork 254.132613 m²;
  - beams: 172 register objects and 344 lines, every line PARTIAL;
  - `orphan_lines 0`, `placeholder_lines 0` (the file's last query, I-368's invariant).
  If you see anything else, the ground moved.
- **Put R0's evidence in the repo before the round.** Build one table from J-BREADTH, J-R6 and
  `goldenRows('rcc6-bnbc')`. Its columns: class, kind, level, golden figure, group (reachable,
  unreachable as drawn, disagrees with the drawing, or GC), and evidence. Commit it under
  `docs/handoff/`; it is a document, not a product edit.
- **Allocate ids once, before any fan-out.** The next Interpretation is **I-370**. D-003 is reserved
  for the ties, so the next free Deviation is D-004. The next migration is **0062**.
- Read `CLAUDE.md`, `docs/handoff/session-7.md`, the ledger's breadth map and the R6 ties design
  (ledger "R6 ties design + critic"), and `docs/decisions/deviations.md`.

**Exit condition:**
1. The gate's verdicts on HEAD are quoted, with every red read to a cause.
2. The known state is reproduced by the read-back above, or the moved ground is explained.
3. R0's per-cell table is committed.
4. The ranked programme (§2b) is in the ledger, with each door's definition of done and read-back
   query written there before the door lands.
5. ONE `AskUserQuestion` round has been asked, carrying every question that is genuinely the owner's:
   - R0 per cell: regenerate the golden, or record a Deviation;
   - GC-1..GC-4;
   - the two R6 readings session 7 left open: one reading of S-12, recorded before GC-2 removes the
     3F–ROOF cross-tie rows (−554.960 kg), and the joint-spacing reading (265.804 kg);
   - what comes after R6: the remaining M3 breadth, or M4's first door (the owner ruled "M3 breadth
     first" for session 7 only).

Then work on your own; the owner is not watching in real time.

## 2. What you inherit — measured

- **The tree at session 7's close** (gate 8): unit 565 files / 3,806 tests; db 242 / 1,467 (two
  passes: the batch, then drift-lane-breaker alone); golden 4 / 16 plus 104 pytest; lint 0 errors /
  158 warnings; tsc 0; migrations 0000–0061, with `cubit_dev` at head.
- **Interpretations run to I-369 and Deviations to D-002.** D-003 is reserved for the ties ruling.
  - I-368 (`docs/design/s-levels.md`) owes an arm: `@unregistered:` placeholders still publish until a
    refusal there has a durable disclosure.
  - The law's gaps are listed in the session-7 handoff (§3, "The law"): I-306 was allocated and never
    minted, I-308 is cited and never defined, I-310 was never minted and is still cited, I-312 lives
    only in the reverted C2 artifact, and I-329 was skipped.
  - Allocate ids centrally before you fan out: parallel implementers collided on ids twice in
    session 7.
- **FRM-3's shape is measured** (session-7 handoff §7 item 2). Carry TEXT rotation through the
  L-CAD-05 seam — `cad/src/vextrus_cad/model.py`, the TS mirror `@/core/entitygraph/schema`, and an
  EntityGraph version bump — so a mark on its axis and turned along it names that member.
  *Prediction:* a re-ingest re-keys every graph, so the J-000 and Jev caption corpora may move.
- **FRM-4 needs:**
  - slab thickness per side (SLB-1 first);
  - lift-core walls as supports: 17 of 72 clears are over the golden.
    - The lift-core walls account for 15 of them.
    - The other 2 (EB1a and 1EB1a, +250) stay uncut until FRM-3 places the cantilevers carrying them
      (788c1e8a; FRM-2's Interpretation in `docs/design/s-schedules.md`).
  - support faces per storey;
  - slanted pairs.
  **No beam line may reach COMPLETE before those land.** F-RCC6-BNBC campaigns measured from
  788c1e8a up to 2846dcc7 keep 50 orphan beam lines: S-14's 25 typical beams × concrete and
  formwork, keyed `…@UNRESOLVED`. A reader that sums by campaign alone must join the register before
  beam figures are billed (session-7 handoff §7 item 6).
- **The golden reconciliation** is R0's. The breadth map (`wf_d6a5de12-0ac`) lists its slices as
  FRM-3 → SLB-1 → FRM-4 → WLS-1/2 → LEV-2 → COL-FW, with R0 in parallel throughout. But it also gives
  WLS-1 `dependsOn` LEV-2 (SRR), so LEV-2 goes before WLS-1.
  - FRM-4 depends on FRM-3, SLB-1 and R0's CB-taper ruling.
  - R6 (the ties) is not in the map. The session-7 handoff §7 ranks it right after FRM-3.

## 2b. The programme — ranked, each with its done

Session 7's handoff §7 sets the rank, and J-BREADTH adds each slice's dependencies and its definition
of done. A figure marked *(map)* is the breadth map's estimate on `20067339`, taken before FRM-1/2 and
the foundations landed; it is a prediction until a read-back confirms it. The map predicts about 100
cells reachable, 69.4 % of RCC concrete without the ruling and 91.5 % with it.

0. **R0, the golden reconciliation.** *Done:* a recorded ruling per cell — either a regenerated golden
   in a `baseline:` commit naming its proof (cad/tests/rcc6_bnbc selfcheck green, the db-lane BNBC
   bands re-staged green, the golden lane green), or a Deviation with its cost. A regeneration changes
   the generator's own model under `fixtures/gen/rcc6_bnbc/` and never copies the product's reading.
1. **FRM-3: a member named by its own mark.** *Done (map):* F31 places the golden's 57 members, 2116
   its 58, 10C1 its 48, and F-RCC6 is byte-identical. The re-keyed corpora are re-recorded in their
   own `baseline:` commit. The cantilevers EB1a and 1EB1a are placed. *Read-back:* beam objects per
   storey against a count measured on the drawing first; `orphan_lines 0`; every COMPLETE figure
   unchanged; no beam line COMPLETE yet.
2. **R6: the column ties, and the release of `m3-bar-schedule`.** D-003 is recorded in
   `docs/decisions/deviations.md` in the same commit. Ties are derived from BNBC 2020's §8.3.10.5, with
   the joint depth read from the placed framing. Session 7's rulings stand: no lower bound is ever
   published COMPLETE; C7 uses formula (iii); single-spacing statements stay
   `REBAR_TIE_ZONE_UNSTATED`, so F-RCC6 and the SAMPLE seed do not move.
   - **Rule on the critic's named change 2 before release, and record it.** The leg compares whole
     members with NET and LAP summed. The critic measured that this hides a 7–13 % tie shortfall and
     lets a LAP over-measurement hide inside it, and asked for grading per (level, diameter,
     component).
   - The bar-schedule preconditions carried in the session-7 handoff §7 land first: N1 (class-scoped
     notes), R2 (the stated lap, I-308 to be minted), and the edition choosing the synthesis code.
   - *Read-back:* bar rows per member against `bbs.golden.json`, and J-000 green with no M3 entry left
     on the fixme roster.
   - *Prediction:* the designer's 0.00 % over 42 cells was measured against the CORRECTED golden, so
     it can only hold after R0 rules on GC-1..GC-4.
3. **SLB-1, then FRM-4.** *SLB-1 done (map):* slab placements per panel, ROOF slab concrete COMPLETE
   inside its band (38.952 m³), no MRR or SRR ring registered at ROOF; 1F..6F wait for R0.
   *FRM-4 done (map):* beam lines COMPLETE with per-level sums inside the band, and the bill leg
   comparing all 14 cells (123.916 m³ and 1,297.601 m²). Before the first beam line goes COMPLETE:
   - one reader that joins the register, for `register-ui/server.ts` and `boq/server.ts`;
   - the `plateOf` / soffit check on BNBC, which is still unverified.
4. **LEV-2 → WLS-1 → WLS-2 → COL-FW.** *(map)* LEV-2: exactly two column rows at ROOF. WLS-1: SW
   lines COMPLETE inside the band except 3F, which waits for R0, with a Deviation from AM-06(4) in the
   same commit. WLS-2: stair lines COMPLETE for GF..6F and no ROOF stair. COL-FW: column formwork
   COMPLETE per level under the reading I-306 was allocated for (L-MEA-09 governs vertical formwork);
   mint it first.
5. **M4's first door**, as condition 5 defines it.
6. **The debts** (session-7 handoff §7 item 6, "Carried from session 6, and the ledger's own debts").
   Fix each where you touch its file anyway, with its test beside it. Session 8's first craft wave
   is the final re-look's ten demo-visible defects (`relook-final.json`).

**For every item:** the slice's own lanes before its commit, a read-back where it touches the store, a
re-walk where it touches a screen, and the closing gate.

## 3. The rules session 7 bought (add them to session 3–6's, which still stand)

- **A door is landed when the journey reads it back from the store.** Session 7's read-backs found the
  1F beams registered twice (195 objects where the stack gives 172), and 50 beam lines keyed on
  objects the register no longer held (I-368), on trees whose every lane was green.
- **A score without a look is half a grade, and a look without a re-walk is half again.** The craft
  table read 18 of 18 and the look still found 34 demo-visible defects. Then a craft wave that fixed a
  look landed without a re-walk, and cost a screen its work surface (I-369).
- **An honest proof may go red.** PERF-011 had measured a 55 px speck for sessions. Once the sheet
  opened at full size, it read 53.9 ms against 16.75. The budget did not move, and the renderer got
  fixed.
- **`git apply --3way` STAGES what it applies.** Unstage (`git restore --staged .`) before committing
  with explicit paths. One commit swept 152 staged files into a toolchain slice this way.
- **The harness's grep is ugrep with `-I`: a file holding a NUL byte is silently skipped.** Session 7
  escaped the seven NUL files it found (two more held other control bytes). Keep sources free of raw
  control bytes. When a search says "no match" somewhere it should not, `command grep` it.
- **A test that mutates tracked source** (drift-lane-breaker) runs ALONE after the db batch
  (`8a950e58`, `scripts/lib/db-passes.mjs`).
  - The drift lock (`withDriftLock` / `withDriftLockAsync`) holds only the readers that take it: five
    db/__tests__ suites and the acceptance build (`21e0e6d5`).
  - Every db suite imports the schema in-process, and locking them all would serialise the lane.
- **Worktree agents cannot run e2e** (Turbopack refuses the symlinked `node_modules`), and their db
  lanes share one Postgres. Hold their db and e2e lanes for yourself, and never run a db lane beside a
  served product.
- **Mirrored networking holds the previous run's port in TIME_WAIT on the Windows side** for up to
  ~20 s. Wait until `portState(3211)` reads free before the next served lane, or every journey goes
  red on EADDRINUSE.
- **A control the server painted is not live until the client hydrates, and `settled()` does not read
  hydration.** J-000's set toggle was clicked in that window twice under the gate's load, and the store
  held no member row. After a full load, a click waits for a fact only the client renders.
- **A runtime path the bundler can see is a build input.** `storage/`, the mail outbox and the
  recorded-answer fixtures were each a file pattern `next build` traced, so every journey turned the
  next build cold (36d16d6e, ffdfdb1a). Annotate runtime paths `turbopackIgnore`, and read the
  build's own warnings: it now builds with none, and
  `tests/toolchain/runtime-paths-untraced.test.ts` holds it there.
- **Commit, then `sync`.** A power cut emptied the newest commit's objects, which ext4 had not yet
  flushed. It was rebuilt byte-exact only because the index, the worktree and `COMMIT_EDITMSG`
  survived. `/tmp` (the scratchpad) does not survive a reboot, so draft what must survive in the repo
  or under `node_modules/.cache/cubit/`.
- **Parallel implementers need disjoint files AND disjoint ids.** Name the files a group owns and the
  files others hold. Integrate in an order that puts shared primitives first. Make the cross-group
  edits yourself.

## 4. How you orchestrate

Session 7's §5 stands: effort per agent; look at pictures; stop, decide, resume; worktrees for
parallel unit-lane implementers; workflows saved as `.js.txt`. Add:
- One read-back query per door, written in the ledger before the door lands.
- A re-walk of the touched routes before a screen-changing slice lands, and a re-look workflow after
  every craft wave.
- The gate run on a quiet machine: nothing spawned while verify's 60 s is being measured, and no
  fan-out during its e2e or perf lanes.
- An adversarial review of every product slice a worker writes. Session 7's reviewers blocked an arm
  that would have been an undisclosed under-measure (I-368).
- **Skills** (session-7 prompt §5, still in force): `/typesafe:typesafe-ai` before any Jev question;
  `workflow-authoring` before a workflow; `claude-api` for anything touching Claude's API;
  `update-config` for settings.
  - **Jev, by the owner's session-7 ruling:** "use Live Jev most of the time … load the typesafe-ai
    skill and directly use Jev live by calling my key". The lanes still replay fixtures (L-AI-01); live
    calls are for recording and development measurement, and the key is never printed or written.
    Session 7's one live re-record was 241 fixtures for about $0.023 (`e78849a5`).
  - **The web**, only on the owner's word, as session 7 fetched BNBC 2020. What is vendored carries
    its URL and sha256.
- **The owner's levers, which you cannot pull:** `/code-review ultra` at a milestone boundary (billed,
  user-triggered; the owner's settings carry `"code-review": "off"`, so suggest it and say why it may
  be unavailable); the R0 ruling; `--effort max` at launch; and clearing
  session 7's leftover worktrees under `.claude/worktrees/`, which `.claude/**`'s lock keeps from you.

## 4b. How you report

Before you report progress anywhere — the ledger, a commit, the handoff, a message — audit each claim
against a tool result from this session: a lane's own line, a figure read from the store, a picture
looked at. If something is not verified, say so in those words. Session 7's close fact-check
(`wf_89d8471a-1a1`, 47 agents) found 24 wrong or unsupported claims in its own draft documents.

- **The ledger:** keep `docs/handoff/session-8-ledger.md` from the first hour, as a timeline of every
  run, its runId, what it proved and what you did with it. It is your memory across compaction. Keep
  it in the repo: session 7's ledger survived the power cut in the worktree, and its scratch results
  did not.
- **Workflows:** save every script that worked under `docs/handoff/workflows/session-8/` as `.js.txt`,
  name each run's id in the ledger, and write each result where it survives a reboot (the repo, or
  `node_modules/.cache/cubit/`). A run's journal under `~/.claude/projects/…/subagents/workflows/` is
  the fallback.

## 5. How you finish

Write `docs/handoff/session-8.md` in session 7's shape, and `docs/handoff/session-9-prompt.md` in
this one. Run a fact-check workflow over them before committing. Update `CLAUDE.md`'s standing facts
only for facts a later session must not re-learn. Commit them with the ledger and the workflow
scripts. Stop with the tree clean, the finish line's conditions stated exactly, and nothing in your
last message that is a plan rather than a fact.

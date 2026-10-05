# Session 13: the M0 walk (G1 to PASS on main, then the owner's walk)

## Starting the session (the owner)
1. In a WSL terminal: `cd ~/vextrus-cubit && git pull`, then `df -h /` and `free -g`. Keep at least 40 GB free (the
   governor refuses every local unit under 30 GB and warns under 40); 41 GB were free at 11:00Z on 5 Oct (42 at 09:34Z). If it is under
   40, run the two cleanup steps below first.
   Session 12's cleanup (about 2 GB): `uv run python -m scripts.factory.sweep --apply` removes only clean, merged
   worktrees (its dry run at 11:00Z, 5 Oct, listed 0 removals and 4 `prune` lines for scratch worktrees that no longer exist, and kept 139 worktrees; read it again before `--apply`). Then clear the review slots: run
   `VEXTRUS_CLEAN_ROOTS=$PWD/.private/work/factory/review scripts/owner/clean.sh` (a dry run, 1.7 GB), then add `--yes`.
   The slots are rebuilt on demand. Never point `clean.sh` at `.claude/worktrees/`: it holds the carried branches
   (t182, t-readlock, t228, t229, t160, loop-iou).
   No custody re-run is owed at the start: none of the 15 paths in `scripts/real_drawings/runner.py`'s `FILES` changed
   since session 11's re-run on 1d949436 (`git diff --name-only`, 07:52Z); #345 changed only a test outside that list.
2. Start the orchestrator with `scripts/factory/orchestrator.sh`. It refuses (exit 3) while a G1 walk or a real-drawing
   run is live, starts the watcher, and loads the band and the status line.
3. `/effort`: your choice, for the orchestrator only (CLAUDE.md's default is medium; session 12 ran xhigh with
   Ultracode on your choice). Recommended: **xhigh with Ultracode on**, because every phase's gate decisions run through
   this one session. Then `/status` and `/plugin` ("You should know" on, `ralph-loop` off), and say: "Read
   docs/handoff/session-13-prompt.md and run it."
4. Keep this pane open. The session asks you, one at a time: Q13 first, then the rest of "Owner questions"; the custody
   re-run (one `!` line) after the reading-measures PR merges; and, only when `ready.py` exits 0, the walk.

---

You are the orchestrator of session 13. **This session takes M0 to the owner's walk: G1 passes twice on main's current
product code, `uv run python -m scripts.walk.ready origin/main` exits 0, and the owner walks M0 on the real drawings.**
Session 12 built the factory (its state at handover is under the command card); this session uses it and builds none. If the factory breaks: file an
issue labelled `factory`, work around it by hand with the same steps the runbook names, and keep going. Fix only what
blocks M0 work, as one small ticket. The reading is reported against the owner's 90 % bar, never claimed: no measurement
says 90 % is reachable in session 13 (`.private/work/session-12/research/bar-90.md` §0). Never hide the gap; never bend
a gate to close it.

## The owner's intent (verbatim; read it twice)
> "on session-13 at any cost we'll reach the ultimate version of M0 for me to walk and after my walk on M0 we can
> prepare for M1 from session-14 or session-15" (4 Oct 2026, session 12's brief)

> "Why not we finish up fixing of all factory issues and testing the factory works 100% as we planned before working in
> the Session 13 and reserve Session 13 only for M0 walk and our original intention as like before?" (5 Oct 2026, 03:12Z;
> `.private/work/session-12/STATE.md:168`)

> "if you run builders in cloud then this machine will have to bear less load, we have to use most of the cloud
> sessions system so that we can run as much sessions without burdening our local machine, on our local machine only
> the needed core sessions will run" (4 Oct 2026)

## Read first (delegate long reads to Sonnet `Explore` agents; keep your context for decisions)
1. This brief, and the factory state the orchestrator wrote under the command card below.
2. `.private/work/session-12/phase6/s13/outline.md` §A, §B and §E: M0's finish line by condition, why G1 fails, and the
   walk issues with no carrier (07:41Z, 5 Oct).
3. G1's verdict on 8b2b8d4df: `.private/work/walks/8b2b8d4dff733596fd7a0869c78ebd6bf7cd22c4/verdict.json` (counts, codes
   and issue numbers only), with `findings.json` and `evidence/` beside it for the triage (local only).
4. `docs/specs/M0.md` "Finish line" (the owner's 13 walk items) and `docs/specs/factory.md` §5 (G1, and the M0-FL1 to
   M0-FL13 table); the PASS rule in `docs/specs/factory/contracts/walk-verdict.schema.json`.
5. `.private/work/session-11/review-main/report.md` (D1–D11), `.private/work/session-12/research/bar-90.md` (the 90 %
   plan, its order and targets) and `verified-answers.md` beside it (D1–D10 per defect).
6. `CLAUDE.md`, `.claude/rules/` and `.claude/skills/orchestrate-wave/SKILL.md` (the runbook) and `.claude/skills/orchestrate-wave/commands.md` beside it (each command in the form the guard accepts; `tools.lint.docs_paths` lints it).

## Where M0 stands (tool results, 5 Oct 2026)
- **main** at session 12's handover is 3c62f67da or later. Since 8b2b8d4df (G1 #1's head), main's product paths changed
  in two factory PRs only: #377 added two test files under `web/src/acceptance/` (the web failure log), and #375
  (T-XDIST: pytest-xdist, a test database per worker) changed `pyproject.toml`, `uv.lock`, `vextrus/` test plumbing and
  `manage.py flush`. `scripts/walk/ready.py` counts those paths, so G1 #1's verdict no longer counts for main; G1 #2
  runs on the new head anyway. #375's posting real-drawing run was clean (every measure 0/0/0 against main), so the
  reading code is the code last scored.
- **Readiness:** `uv run python -m scripts.walk.ready origin/main` → "not walk-ready: 0 counted PASS verdict(s) on main,
  2 needed", exit 1 (07:51Z).
- **The PASS rule** (the schema): every check PASS; all 12 walked items (M0-FL1 to FL11 and FL13) PASS; 0 BLOCKS; 0
  misleading. `ready.py` needs the two newest verdicts on main to be PASS with no FAIL between them, the newer on main's
  current product code.
- **G1 #1 on 8b2b8d4df** (01:53:27Z → 02:39:20Z, 46 min; FAIL; leak hits 0):

| Set | Check | Measured | Limit (walk-expect) | Status | Carrier |
|---|---|---|---|---|---|
| Edison | reads complete | 6 of 7 files (1 held) | 7 | FAIL | none: #317 |
| Edison | act p95 while a read runs | 5200 ms, 42 acts | ≤ 1000 ms | FAIL | D1 `t-readlock` |
| Edison | Questions per Discipline | max 43 (5 Disciplines) | ≤ 3; bulk ≥ 0.8; 0 false continuations | FAIL | D2 `t228`, D3 `t229` |
| Sample | reads complete | 4 of 4 | 4 | PASS | — |
| Sample | act p95 while a read runs | 1864 ms, 29 acts | ≤ 1000 ms | FAIL | D1 |
| Sample | Questions per Discipline | max 20 (2 Disciplines) | as above | FAIL | D2, D3 |

- **Burden** (verdict.json): Edison Questions architectural 43, structural 29, electrical 27, plumbing 10; bulk-
  confirmable 20/57 structural and 0 in every other Discipline; one-source 87/87 architectural, 37/57 structural (D3
  carries the second source). Sample: structural 20 Questions, 0/38 bulk; architectural 3, 29/29 bulk.
- **Agent layer:** M0-FL1, FL2, FL3, FL11 PASS; FL4–FL10 and FL13 FAIL. 38 findings, 14 BLOCKS, 13 misleading, 24 open
  issues (#314–#337, label `walk`). BLOCKS by item: FL4 #317; FL5 #315, #318, #334; FL6 #314; FL7 #316, #335, #336; FL8
  #320, #333; FL9 #318, #320, #322, #333.
- **Check 2 measures what it says.** The act field is `read_running` (`web/e2e/real/walk.spec.ts:36,181`), and
  `scripts/walk/verdict.py:250-255` counts only those acts. Session 12's doubt about it was wrong.
- **Check 3** reads a false-continuation source (#294), merged on main as #387 (T-WALK-3). The owner ruled "Local list
  now"; the list is `.private/work/walk-expect/continuations.json`, schema 2: Edison 13 groups / 40 Sheets, Sample 4
  groups / 15 Sheets, plus each group file's full list of true Sheet numbers (Edison 4 files / 175 numbers, Sample 1 /
  37; 5 of 5 files equal the product's last read). A number its file does not hold is a misread and leaves the set
  unmeasured (check 3 fails closed). G1 judges by M0's one-title groups; the mark-range count is reported beside it.
- **CI's `e2e` workflow has failed on every main run on record** (32 of 32 since 01:53Z, 5 Oct; checked 11:00Z): the browser smoke
  `web/e2e/acceptance/t22/smoke.spec.ts` fails because `/opt/vextrus/acadsharp-dump` is missing on the runner. It is
  not a required check. It is M0's #31 (the Step 1 screen and the browser smoke test): Phase 2 decides it.
- **Expectations:** `.private/work/walk-expect/edison.json` (7 files) and `sample-project.json` (4 files), counts
  confirmed by the owner; every other limit is Q5's default. No `qs-critic` review of them is recorded.
- **Unverified, and the biggest risk:** whether G1's agent layer can pass FL5 and FL7 while main reads 45/217 Edison
  Sheets. FL5's own words ask for Edison's storey-bearing titles read "with 0 wrong" (`docs/specs/M0.md`, item 5).
- **M0's finish line** (`docs/milestones.md`, M0), by condition (outline §A):

| Condition | State | Evidence |
|---|---|---|
| Upload both sets' DWGs | partly: 1 of 7 Edison files held | FL2 PASS; check 1 FAIL; #317 |
| Every Sheet split correctly | unmet | Edison 45/217 Sheets, 429/739 Views; FL7 FAIL (#316, #335) |
| A proposed name and storey | unmet | FL5 FAIL; #318 storeys_wrong; D9 not started |
| Renders legibly in the viewer | unmet | FL6 FAIL (#314); D4 `t160` unmerged |
| The QS confirms the Sheet list | unmet | FL8 FAIL; up to 43 Questions in one Discipline against 3 |
| Markets as data (ADR 0038) | code present, not walked on its own | FL13 FAIL (#325, #329) |
| Python 3.14, PostgreSQL 18 | met | `pyproject.toml`; `.claude/rules/machine.md` |
| A Project's Buildings; Memberships scoped to Projects | met; the members screen is flagged | FL1, FL2, FL11 PASS; FL10 FAIL (#323) |
| The Live Model's empty tables | met (code present) | `vextrus/live_model/models.py` |
| Engine PRs checked by element diff | met | `.github/engine-paths.txt`; the posting run |

- **Scores** (blind scorer; main's code = scored head 40e86320; `verified-answers.md`). The bar is 90 % (Q4, ruled):

| | 90 % bar | 80 % (interim mark) | main | gap to 90 % |
|---|---|---|---|---|
| Edison Sheets | ≥ 196 / 217 | 174 | 45 | 151 |
| Edison Views | ≥ 666 / 739 | 592 | 429 | 237 |
| Sample Sheets | ≥ 61 / 67 | 54 | 8 | 53 |
| Sample Views | ≥ 376 / 417 | 334 | 215 | 161 |

  Best scored head: `loop-iou` ae25e64e (unmerged), Views 439 and 238, Sheets unchanged. The last three loops moved
  Edison Sheets +6, +1 and 0; even 80 % is estimated at 6–9 sessions (`bar-90.md` §0, §5).
- **D1–D11** (session 11's agent walk of main; G1 #1 measured D1 and D2 still there):

| D | Issue | What the QS meets | Carrier | State |
|---|---|---|---|---|
| D1 | #227 | Step 1's acts wait on a read job's transaction | `t-readlock` | fix round 1 committed; local, unpushed |
| D2 | #228 | a flood of "What kind of Sheet" Questions, none pre-picked | `t228` | fix round 1 committed; local, unpushed |
| D3 | #229 | a numbering gap removes every Sheet's second source | `t229` | fix round 1 committed; local; no real-drawing run |
| D4 | #160 | View outlines off their paper | `t160` | pushed; the owner's render_f1 trade is open |
| D5, D8 | #230 | no live refresh; Coverage says "Another Discipline" | #238 | merged (session 11) |
| D6 | #231 | no Plot, Compare or CAD-dark in Step 1 | #244 | merged (session 11) |
| D7 | #232 | "12 copies"; continuation runs raise Questions | — | not started |
| D9 | #233 | storeys missed on plain titles; a Sheet's only plan proposed as a duplicate | — | not started |
| D10 | #234 | presentation plans not proposed to leave out | — | not started |
| D11 | #235 | smaller Step 1 and admin items | — | not started (split into 2–3 tickets) |

- **Carried heads** (`git rev-parse`, 07:52Z): `t182` a28db350 (PR #237, pushed), `t-readlock` 675bdc7b, `t228`
  9800dc4b, `t229` 8738bfc4 (all three local only), `t160` d6f22236 (pushed), `loop-iou` 2973a919 local (99abbf56
  pushed). Conflicts (`git merge-tree --write-tree`, 07:53Z): `t229` conflicts with main
  (`web/src/takeoff/locales/en.po`) and with `t-readlock` (`vextrus/takeoff/services/step1.py`); every other branch merges
  main cleanly, and `t228` merges `t-readlock` and `t229` cleanly.
- **Other open M0 items:** #236 (the seed's Plot PDFs are stubs; after #237); #150 and #204 close with #237; #239–#241 and
  #218–#224 only if there is room. #133, #189–#192, #195, #197 and #199 carry the M0 label and no plan here: Phase 2's
  triage maps each to a walk item or leaves it open with a reason; #199 (a scored run of main refuses an export a PR's
  run cached) may bite Phase 5's scored run. #45 is the milestone record.

## The answers you build on (the owner's rulings, verbatim)
**Session 12** (`.private/work/session-12/STATE.md`, UTC):
- 20:2xZ, 4 Oct: "Q4 M0 bar - 90%, Q7 drawing data - I'm allowing to be more easy going on this case and cloud sessions
  may read drawing and enabling Remote Control for most cases if that means more power and performance by allowing some
  privacy issues that I'm allowing willingly, Q20 acceptance writers at high effort: yes for most scenario if it comes to
  quality." The same note asked to pair TypeSafe's Jev "more actively".
- 17:42Z, 4 Oct, plan and spend: "20x max account … is perfect for us and if further tokens or credit requires for our
  upgraded version I'm willing to spend which will comes later, for now go on with your full potential."
- 18:21Z, Q10: "Yes, account A for all (Recommended)". 23:16Z, ADR 0005: "Remove the legal name only (Recommended)".
- 23:40Z, the G1 file counts: "Confirm 7 and 4 (Recommended)". Edison is walked as 7 files (5 DWG, 2 Plot PDF), the
  Sample Project as 4 (2 DWG, 2 Plot PDF); only those two sets are walked.
- 03:12Z, 5 Oct: session 13 is "only for M0 walk and our original intention" (quoted above).
- 03:26Z: "don't worry about usage as I mentioned many times that token usage shouldn't be any kind of obstruction for our
  factory … I'll provide extra usage credits, additional max accounts if we get stopped for token limit usage ever: so
  this is the least concerning matter". Do not ask about usage; read `/usage` only for the governor.
- 03:29Z, #294: "Local list now (Recommended)". A local `drawing-analyst` wrote the true continuations as keys and counts
  under `.private/work/walk-expect/`; #249's Answer Key export replaces the list later. G1 judges false continuations by
  M0's one-title groups; the mark-range count is reported beside it (the orchestrator's decision, 03:41Z).
- 04:40Z, the review cap: "Allow a fix-regression round (Recommended)". A third review only when every finding left at
  round 2 was introduced by fix round 1, as its refuter confirms (merged in #358).
- 07:21Z: "keep going, full potential, yes continue per my 'until it reaches 100%' and we're 100% ready for session-13 to
  be worked on our project with our end to end verified factory harness setup".

**Session 11, still binding** (`.private/work/session-11/STATE.md`, 4 Oct):
- #229: "Plot match + gap local (Rec.)". A matched Plot page is a second source. A gap holds only the Sheets beside it.
  There is one Question per Discipline's gaps.
- #228: "Propose Jev's top kind (Rec.)". Jev's first choice is the proposed kind. A Question is raised only when the top
  two are close or the title contradicts. Add "Slab details". The round-1 review then ruled that the pre-pick is kept and
  shown, and m0-screens §5 was amended.
- The walk: "I walked through .private/work/session-10/walk-steps.md and the result was really poor, I would rather walk
  after session-11".
- 30 Sep: "the job is the scored reader". It stands unless Q17 changes it.

## The factory you drive (command card; run from `/home/riz/vextrus-cubit`; each tool prints its contract with `--help`; `.claude/skills/orchestrate-wave/commands.md` lists the runbook's commands in the forms the guard accepts, and says: what the guard or the classifier refuses is the owner's to run as `! <command>`)
- **Start:** `scripts/factory/orchestrator.sh [--resume <full session id>]`.
- **Clock:** `uv run python -m scripts.factory.stamp start --budget 11h --state .private/work/session-13/STATE.md
  --phases "p0=30,p1=300,p2=270,p3=180,p4=330,p5=45"` (the phases below; `stamp phase` refuses an unplanned
  name, and re-planning needs `start --force`); `… stamp "<text>"` (every STATE line); `… stamp phase <name>`; `… stamp elapsed [--ticket <t>]`;
  `… stamp budget --ticket <t> --minutes <n>`; `… stamp end` (closes the session). If `start` is refused because
  a clock is still open (session 12's ended at 10:39Z, 5 Oct, and `session.json` is absent at 11:00Z), run `… stamp end` first; never `--force` over a live clock.
- **Preflight:** `uv run python -m scripts.factory.governor check cloud-session|local-agent|review|pytest|web-tests|walk|rd-run`
  (exit 0 OK, 3 REFUSED; `--usage-checked "<your /usage lines>"` if it cannot read usage).
  A usage hold refuses launches at session 80% or week 85% (`governor.py`, fixed on main). It is the owner's
  spend line, never yours to move: when it refuses, tell the owner the week's %, then wait for the reset or cut
  scope to work that needs no launch. Whether and how the owner may move it is open (#401, not merged).
- **Launch:** `uv run python -m scripts.factory.launch cloud --branch <b> --prompt-file <f> --ticket <t> --effort
  medium|high [--role acceptance-writer] [--budget-minutes <n>]`; `… launch local --ticket <t> --branch <b> --effort <e>
  --name <n> --prompt-file <f> [--role builder|acceptance-writer] [--budget-minutes <n>]` (the branch must be on origin).
- **Message:** a cloud builder `uv run python -m scripts.factory.launch say <session_id> --file <f> --elapsed <n>/<m>`
  (it acts 1–3.5 min later); a local one `uv run python -m scripts.factory.say <full sessionId> --file <f> --elapsed <n>/<m>`.
  Write every prompt and message to a file with the Write tool first.
- **Watch:** Monitor on `tail -n0 -F .private/work/factory/events.log`, re-armed at its deadline;
  `uv run python -m scripts.factory.status age` (exit 0 while the watcher writes); `uv run python -m scripts.factory.watch ensure` starts the watcher when its pidfile is stale (`orchestrator.sh` already runs it).
- **Amend an acceptance test:** `uv run python -m scripts.factory.amend --subject "<text>" --red <n> --green <n> <path>…`.
- **Review:** `/review-pr <PR> <40-hex head> <round> [security75|crash|false-statement|fix-regression]`. If its Record
  step is refused, record the same decision file by hand: `uv run python -m scripts.ledger record <PR> --round <n> --head
  <sha> --from <file>`.
- **Push a local branch** (from the main checkout): `git merge-base origin/main <b>`, then `uv run python -m
  tools.leakscan range <base>..<b> --ref <b>` alone in its call, then `git push origin <b>`.
- **PR bodies:** `uv run python -m tools.leakscan file <f>`, then `gh pr create --body-file <f>` alone in its call.
- **Leak scans:** `uv run python -m tools.leakscan pr <n>`, `… dir <d>`, `… bodies --since <UTC>`, `… allow <file:line>`
  (a generic string, by hash, in a one-line PR). It prints locations and counts, never text.
- **Real drawings:** `uv run python -m scripts.factory.rdlock run --kind no-post|posting|scored --head <sha> --ticket <t>
  -- scripts/real-drawings <PR> --no-post` (then `--accept-if-clean`, or `--accept "<judged reason>"`, as the posting
  run); `… rdlock status`. Scored: `sudo -n -u vxkeys /usr/local/bin/vx-score <run id>`.
- **Gates:** `sudo -n -u vxkeys /usr/local/lib/vextrus/post-status design-gate <PR> <full sha> --passed <items> --failed
  <items> --not-applicable <items>`, alone on its line, from an independent verdict; read with `gh pr view <PR> --json
  statusCheckRollup` (gh 2.45 has no `gh pr checks --json`).
- **Land:** `uv run python -m scripts.merge_ready <PR>` (exit 0 ready), then `uv run python -m scripts.land <PR>` (ledger
  PASS, update-branch, CI, one listed-flake rerun, `merge_ready`, merge pinned to the head). It runs no posting run and
  posts no gate: do both on the head it will land. Until #398 is fixed, `land` can read a freshly updated head before its `ci` registers and refuse with `merge-ready: ci: not succeeded` (#391 and #393 on 5 Oct, 09:58Z and 09:59Z). So land one PR at a time: update its branch yourself (`gh api --method PUT repos/vextrus/vextrus-cubit/pulls/<n>/update-branch -f expected_head_sha=<sha40>`), wait until the new head's `ci` is green, then run `scripts.land <n>` while nothing else merges (it skips the update when main is already in).
- **G1:** `… governor check walk`; `uv run python -m scripts.walk.run <sha40> > .private/work/session-13/g1-<sha8>.log
  2>&1` (`run_in_background`); Monitor `events.log` until `WALK - <sha8> done`; then `/real-set-walk <sha40>`; then
  `uv run python -m scripts.walk.ready origin/main` (0 ready, 1 not, 2 malformed).
- **Sweep:** `uv run python -m scripts.factory.sweep` (a dry run; `--apply` removes only clean, merged worktrees).

## The factory at handover (session 12 phase 6, 5 Oct 2026; filled by the orchestrator)
**Landed in phase 6:** #339 /review-pr verdict outside the slot, #345 root-safe tests, #346 T-SETTINGS, #347 T-LEAK-CORPUS, #348 T-AMEND, #349 T-WALK-1, #350 T-LAND (scripts.land), #351 T-LEAK-PDF, #353 T-WATCH, #355 T-MOD, #356 T-LEAK-HOOK, #358 the fix-regression exception, #359 T-STAMP, #360 T-HOOKS, #361 T-PRECOMPACT, #362 T-JEV-DEDUPE, #363 T-JEV-CLIENT, #364 T-SWEEP, #371 T-LAUNCH, #372 T-WATCH-LOCAL, #377 T-WEB-REP, #378 and #381 (leak allowlist), #382 T-GUARD-NARROW, #386 T-LAND-PULL, #387 T-WALK-3. Each landed through `/review-pr` and `scripts.land`. Also merged: #375 T-XDIST (09:49Z), #391 T-JEV-LAUNCH (10:08Z), #393 T-LOCAL (10:16Z), #394 this brief (10:18Z), #400 T-DOCS-RUNBOOK (10:40Z; the re-submission of #392): 31 PRs in phase 6 in all (`.private/work/session-12/STATE.md`, 10:40Z). The end-to-end proof was T-GUARD-NARROW (#382): `launch cloud` writer → acceptance commit → `launch cloud` builder → `/review-pr` → a fix round through `launch say` → round 2 PASS → `scripts.land`. Body patching was the only manual step (gap 1).

**Not landed (each ticket file under `.private/work/session-12/phase6/tickets/` holds the redesign notes):**
- **Closed after their review cap, then deferred:**
  - T-GUARD-A (#357), the guard rework;
  - T-GUARD-WAITS (#383), the wait rule;
  - T-CUT-GATE (#354, #376): judge the GitHub-rendered HTML, not local markdown;
  - T-LINT-1 (#384), the time-bomb lint;
  - T-JEV-LEAK (#373, #379), Jev's leak advice.

  Each is a heuristic that no review round could close. Narrow, exact rules did converge.
- **Not started:** T-GUARD-B, T-WORKFLOWS, T-WALK-2, T-WEB-FAKES, T-LINT-2, T-LESSONS, the spec-rows ticket.
- **These are factory work, not session 13's.** Fix one only if it blocks M0.

**Known gaps and their workarounds** (each is a filed issue or a ticket note):
1. **`merge_ready`'s cut gate refuses builder-shaped bodies.** Any line after `None.` under `## Cut` counts as an item. Add a heading after `None.` and PATCH the body: `gh api --method PATCH repos/vextrus/vextrus-cubit/pulls/<n> -F body=@<file>`, after `leakscan file <file>`. `gh pr edit` fails on gh 2.45.
2. **Guard over-blocks.** These refusals are wrong but safe, so work around them; never route around a security refusal:
   - a loop and a `pgrep -f`/`ps | grep` in one call: run them in separate calls, and wait with Monitor;
   - heredocs or loops that name `leakscan` or the ledger, and `ls` of the ledger folder: write files with the Write tool, read review outcomes from the workflow's `journal.jsonl`;
   - a GitHub body over 72 characters inline: use `--body-file` after `leakscan file`;
   - a push in the same call as anything else: push alone, after `leakscan range <merge-base>..<head> --ref <b>`.
3. **The auto-mode classifier sometimes denies `/review-pr`'s Record step** ("Self-Approval", "CI Bypass", "Logging/Audit Tampering"). Record it from the main checkout with `uv run python -m scripts.ledger record <PR> --round <n> --head <sha> --from <file>`:
   - the file holds `VERDICT: <v> at <sha>`, one line per lens (lens 1 is pr-reviewer, lens 2 the adversary);
   - then `FINDING l<lens>-f<i> <score> <CONFIRMED|REFUTED|UNPROVEN|->` lines, sorted by score.

   If the classifier refuses that too, give the owner the exact `uv run python -m scripts.ledger record ...` line to type as `! <command>` (CLAUDE.md:59, `commands.md`:6). An owner classifier rule (R3) would end this; none is in `~/.claude/settings.json` yet (11:00Z).
4. **The leak corpus absorbs the factory's own words** from session notes: ticket ids, review vocabulary, commit SHAs from real-drawing outputs. A false hit is allowlisted by hash, in a one-line PR (#378, #381): `leakscan allow <file>:<line>`. T-LEAK-2 (#380: merge-base stamps, `allow commit:<sha12>:<n>`, whole-sha drops, slug reads) was capped and is split into an exact part and a heuristic part (ticket note). The class fix, skipping the orchestrator's cloud-bound tickets and prompts folders, is a ticket note.
5. **Local fix rounds use `uv run python -m scripts.factory.say <full uuid> --file <f> --elapsed n/m`.** T-LOCAL (#393, merged 10:16Z, the re-submission of #388) makes `say` judge liveness by a pid on any of the session's rows: a session with no pid on any row, whatever its state (`done`, `blocked` or `working` after a reboot), is resumed by `say` itself. It refuses a folder that is gone or outside `.claude/worktrees/`, no row, or `stopped`/`failed` with a pid. If `say` refuses because a row still holds a pid (`stopped`/`failed` with a pid), a process is recorded as alive: never resume beside it and never `claude rm` it (that deletes the session and may remove its worktree). Tell the owner the session id and wait; `say` resumes it once no row holds a pid. Only for a session whose rows hold no pid that `say` still cannot resume, with its worktree folder present, resume headless from the worktree:
   - `env -u CLAUDE_PROJECT_DIR -u CLAUDE_CODE_PLUGIN_DIRS -u CLAUDE_CODE_WORKFLOW_MAX_CONCURRENT_AGENTS VEXTRUS_ROLE=builder claude --resume <uuid> -p --agent builder --effort <e> --settings <main>/scripts/factory/builder.settings.json "<prompt>"`;
   - run it in the background; the guard refuses `--bg`.
6. **`/review-pr` does not read CI.** #377 passed review with a red web job. Check `gh pr checks <n>` before landing.
7. **Gates live on the exact head that lands.** For a web PR (design gate) or an engine PR (posting real-drawings run):
   - update the branch first, with `gh api --method PUT repos/vextrus/vextrus-cubit/pulls/<n>/update-branch -f expected_head_sha=<sha>`;
   - post the gate, or run the posting run, on the new head;
   - wait until that head's `ci` check is green (#398: `scripts.land` can read a new head before `ci` registers), then land it while nothing else merges.
8. **CI's `e2e` workflow has failed on every main run on record (32 of 32).** The browser smoke `web/e2e/acceptance/t22/smoke.spec.ts` fails because `/opt/vextrus/acadsharp-dump` is missing on the runner. It is not a required check. This is M0's #31: decide in Phase 2.
9. **A capped PR is closed and re-submitted complete** (#373→#379, #374→#387, #388→#393, #392→#400). Only the orchestrator amends acceptance tests, through `scripts.factory.amend` (2f654dafe, 131047313). Its lint refuses an amendment that pins nothing new.

**Open factory PRs at handover:** #401 only: the owner's usage-hold change, paused after review round 1 for the owner's decision. Do not land, fix or rebuild it unless the owner says so. Besides it, the only open PR is #237 (M0's). #391 T-JEV-LAUNCH (10:08Z), #393 T-LOCAL (10:16Z) and #400 T-DOCS-RUNBOOK (10:40Z) are merged; #392 was closed after its review cap and re-submitted as #400. Open factory issues you may meet: #398 (the lander, gap 7), #396 (guard: the gh write rule for local builders), #397 (`guard.test.mjs` fails in cloud sessions), #399 (`docs_paths` is not a CI step).

## Phase 0: orient, clock, machine (≤ 30 min)
Budget: ~11 h of work, cut at +8 h: at the cut, anything not on the finish line becomes an issue. Phases 1–4 overlap;
each heading carries its own budget; stamp each phase's start and end as a STATE line.

**The lock and the landing slot are the binding limits, not builders.** Lock demand: ~14–17 posting runs (Phase 1's 6,
#249, D7, about 1 of #235, D9, D10, J1, 1–3 walk-blocker tickets on engine paths (unmeasured), 1–2 G1 fixes) at ~27–30
min, ≈ 6.5–8.5 h, plus ≤ 4 scored runs (~2 h): over-subscribed in ~11 h. Lock order: #237, `t-readlock`, then #249's
run (Phase 3's S1 needs its `--agreement` and the custody re-run from hour 2), then `t228`, `t229`, `t160`, `loop-iou`,
the walk-blocker tickets, D9, D10, D7, #235, J1 last. Cut first at +8 h: J1 (to session 14), scored runs beyond 2,
#218–#224 and #239–#241, then S2/S3 loops. Landing: ~18–24 product PRs at ~8–13 min each (#362 landed through
`scripts.land` in ~8 min), one at a time on one main.

| Phase | Work | Where | Budget |
|---|---|---|---|
| 0 | clock, machine, questions, first launches | orchestrator | ≤ 30 min |
| 1 | #237 → `t-readlock` → `t228` → `t229` → `t160` → `loop-iou` | orchestrator + lock | ≤ 5 h |
| 2 | walk-issue triage and tickets; D7, D9, D10, #235, #236 | cloud (tests) + local (drawings) | ≤ 4.5 h, beside 1 |
| 3 | #249 + J2, S1 with the owner, Sheet fields, J1, ≤ 4 scored runs | local, high | ≤ 3 h + ≤ 2 h of lock |
| 4 | walk-expect review, J5, G1 #2–#4, fix tickets | local | ~1 h + 3 × ~60 min + ~1.5 h |
| 5 | readiness, scored run, #45 report, "walk now", session 14's brief | orchestrator | ≤ 45 min |

1. Start the clock (card); check `… stamp elapsed` reads about 0:00.
2. Read the machine: `governor check cloud-session` and `check local-agent`; `df -h /`, `free -g`, `git worktree list |
   wc -l` (133 at 07:51Z; 144 at 11:00Z), `… status age`, `… sweep` (dry run). At most 3 local agents at once.
3. Read the factory state above, `gh pr list`, and `… scripts.walk.ready origin/main` (expect exit 1). T-WALK-3 is on
   main (#387), so G1 #2 can judge check 3.
4. Ask Q13, then the others in "Owner questions" order, one at a time.
5. Launch at once, in parallel: the walk-issue triage (Phase 2, step 1); the `qs-critic` review of walk-expect (Phase 4);
   #237's acceptance writer (Phase 1, row 1). Merge main into `t-readlock` and `t228` in their worktrees (a recorded
   merge commit each), push them from the main checkout, open their PRs and start their round-2 reviews (Phase 1).

## Phase 1: the carried PRs, in order (≤ 5 h; lock-bound)
They land in this order: **#237 → `t-readlock` → `t228` → `t229` → `t160` → `loop-iou`**. All six are engine PRs: each
owes a posting run on its final head (~27–30 min under `rdlock`; T-XDIST's `--no-post` took 1597 s), and every engine
merge stales the next PR's head (a head whose engine code hash was already run is cached). A PR not ready at its turn
yields its slot to the next ready one: re-measure conflicts with `git merge-tree --write-tree` before swapping.

Review batch first, so each PR gets a ledger record: `t-readlock` and `t228` as **round 2** (session 11's round 1 and fix
round 1 count); `t160` and `loop-iou` as round 1; #237 after its fix round; `t229`'s round 2 only after `t-readlock` and
`t228` have landed and its conflicts are resolved. A conflict resolved after a PASS voids it.

| # | Branch / PR | What it fixes | Head | What it still needs |
|---|---|---|---|---|
| 1 | **#237 `t182`** | the demo seed is the real read job's recorded output (closes #150, #204) | a28db350, pushed | CI's cause was measured in session 12: the function-scoped demo fixture runs the real read job in every test that asks (88 → 103 seeding tests; one seed 2.6–2.9× slower). Whether it still times out under sharded CI is unmeasured. Fix round: (1) the acceptance writer (high) re-scopes the `demo` fixtures in `vextrus/takeoff/tests/acceptance/t19a/step1.py` and `vextrus/seed/tests/acceptance/t136/seeded.py` (once per module for read-only tests) through `scripts.factory.amend`; (2) the builder (cloud, tests only) does `vextrus/seed/tests/test_seed_drawings.py` and a savepoint helper. Then merge main, round 1, CI, posting run, land |
| 2 | **`t-readlock`** (#227, D1) | Step 1's acts never wait on a read job | 675bdc7b, local | fix round 1: the Plot match runs after the Proposals; progress writes serialised. Merge main, push, PR, round 2, posting run, land. It carries G3's first test (#251) |
| 3 | **`t228`** (#228, D2) | Jev's top kind proposed and shown; a Question only when close or contradicted; Slab details | 9800dc4b, local | fix round 1: the pre-pick shown, §5 amended. Merge main, push, PR, round 2, a `ux-critic` words review, the design gate, posting run, land |
| 4 | **`t229`** (#229, D3) | a matched Plot page is a second source; a gap holds only its neighbours | 8738bfc4, local | after rows 2 and 3 land: merge main, resolve `step1.py` and `en.po` by hand in that merge commit, run its tests, push, PR, round 2, words review, design gate with the m0-screens §8 keyboard walk; its first real-drawing run is the posting run |
| 5 | **`t160`** (#160, D4) | one paper scale: outlines lie on their paper | d6f22236, pushed | needs the #160 trade ruling; with none by its turn, it lands after `loop-iou`. Merge main, round 1, posting run under the accept rule (the ruling is its judged reason), land |
| 6 | **`loop-iou`** | scored loop 3: tighter View boxes | 2973a919 local (99abbf56 pushed) | +10 Edison / +23 Sample Views at ae25e64e; later heads unscored; PR body written, not reviewed. Push, PR, round 1, posting run (state the scored delta), land |

Each landing: merge main → CI (8–13 min) → posting run → `design-gate` (any `web/**` file, tests included) →
`merge_ready` → `scripts.land`. A UI PR walks m0-screens §8 by keyboard before its PR.

## Phase 2: the walk blockers and the D items not started (≤ 4.5 h, beside Phase 1)
1. **Triage the 24 walk issues (≤ 45 min, local, read-only).** One agent per item group reads `findings.json` and
   `evidence/` under G1 #1's folder and names, for each issue, its carrier or "none", the code site, and whether it
   touches engine paths. Output: `.private/work/session-13/triage/walk-issues.md`. Issue bodies hold only item, severity
   and delta; nothing from the evidence enters an issue or PR. Tentative carriers (outline §E, unverified): #337, #319 →
   D1; #315, #333, #320 → D2 and J5; #318 → D9; #321, #334, #324 → D7; #336 → D10; #314 → D4?
2. **No carrier: ticket them (`to-tickets`), BLOCKS first.** G1 passes only with every item PASS and 0 misleading, so every
   FAIL item's issues count, not only BLOCKS:
   - #317 read_quarantined (FL4, BLOCKS): one Edison file of 7 is held. Local, high, `diagnosing-bugs`.
   - #316 and #335 views_left_over (FL7, BLOCKS; delta 11 each): Coverage leaves Views unaccounted.
   - #322 misleading_display (FL9 BLOCKS; also FL4 and FL10).
   - Then: #323 (members, FL10), #325 and #329 (FL13), #326 and #327 (FL4), #331 (FL3 cancel and restart), #328 (FL1,
     FL2), #330 and #332 (FL5). Close any already fixed by a carrier, with the PR's link.
3. **The D items not started.** Acceptance writer (high) first, each:
   - **D7** #232 (engine, plus the words gate): continuation runs shown as groups, not copies, with no Question.
   - **D9** #233 (storeys on plain titles; a Sheet's only plan proposed as a duplicate) and **D10** #234 (presentation
     plans proposed to leave out): local, high, a refuter; `--no-post` runs local under `rdlock`. Up to 6 of Edison's 32
     storey failures (and 1 of the Sample Project's 11) may sit on unconfirmed key values: D9 states its target against
     Q13's answer and never tunes toward the key's open items.
   - **#235** (D11), split into 2–3 tickets; **#236** after #237.
   - Only if there is room: #218–#224, #239–#241.
4. Cloud for tickets provable by committed tests; local for anything that reads real drawings (≤ 3 local agents).
   Builders at medium; high for drawings, hostile input and security walls; writers at high.

## Phase 3: the reading toward the 90 % bar (≤ 3 h of work and ≤ 2 h of lock, from hour 2)
Order and targets from `bar-90.md` §2; state each target before the work. Realistically, session 13 reaches S1 and the
start of the Sheet fields.
1. **The reading-measures PR** (#249 with J2 #262; local, high, a refuter; ~2.5 h): a counts-only `burden` block in the
   export; S1's scorer diagnostics in `tools/scorer/` (kind-confusion pairs, box-error direction, failing Views by class,
   `--agreement`); S2's proxy cached by (content sha256, reader code hash); J2's Jev replay (a miss is `Unavailable` and
   counted; no key in the sandbox). Once it merges, ask the owner **once** for the custody re-run (Q6, Q16, Q24 ride it).
2. **S1, the key audit, with the owner** (~1 h; needs Q13 and `--agreement`): `drawing-analyst` re-keys ~15 Sheets
   blind, locally; the key user scores agreement in aggregate. Under ~97 % two-keyer agreement on Views, ask the owner
   to restate the convention before any further loop.
3. **The Sheet fields** from S1's diagnostics: storeys, title, Discipline, then date. J3 (#264) only if its 40-item probe
   beats the reader. Target: Edison all-six-right ≥ 205/217; Sample storeys ≥ 65/67.
4. **The 221 near-miss boxes** (overlap 0.5–0.8): S2 proxy loops run by hand, at most 3
   local (#252's scored-loop workflow is factory work for later: do not build it); S3, the Plot PDF as a second
   source for text extents, Sample Project first. **Misses and wrong kinds:** the J4 probe (#265); S4 only if Q8 is yes.
5. **J1** (#261, the `view_subject` Jev node; an engine PR): an estimated upper bound of +10–11 Edison and +2–3 Sample
   Sheets. Cut first to session 14 if the lock is full.
6. **Scored runs** only for heads that gain on the proxy: at most 4 (~2 h of lock); beyond 2 are cut first at +8 h.

## Phase 4: G1 to PASS (~1 h + 3 × ~60 min + ~1.5 h of fixes)
1. **Walk-expect:** a `qs-critic` review of the two files (by hour 1), and Q5's limits written into them once answered.
   They are never in git.
2. **J5** (#263, ~30 min, live, local key): re-measure `sheet_type` with View titles and per-Discipline options, and count
   its Question queue per Discipline: the measure behind D2 and Q5.
3. **G1 #2** on main after `t-readlock`, `t228` and `t229` land (about hour 5–6). Every BLOCKS finding
   becomes a fix ticket in this session; every other finding becomes an issue or a comment on its open issue.
4. **G1 #3** on the next head (about hour 8). **G1 #4 is budgeted:** `ready.py` needs two PASSes in a row, the newer on
   main's current product code.
5. A walk takes ~46 min (G1 #1: 17 min script layer, 28 min agent layer) and 5.6 GiB (the governor's figure). While it
   runs, the governor refuses web tests, a full pytest and a second walk. Product merges freeze only while the **final**
   walk runs.

## Phase 5: the close and the hand-over (≤ 45 min)
1. Two passing G1 verdicts; `uv run python -m scripts.walk.ready origin/main` exits 0.
2. One scored run on main's last head. Write the reading report in #45: counts against 196/217, 666/739, 61/67 and
   376/417, each gap, the 80 % marks beside them, and the plan for sessions 14+ (`bar-90.md` §5).
3. Leak scans: `… leakscan bodies --since <session start, UTC>` and `… leakscan dir .private/work/walks/<sha40>/public`
   for each walk: 0 hits.
4. Only then tell the owner "walk now", with both verdict paths, the burden numbers and the reading gap. The walk-gate
   hook blocks the words without `ready.py`'s exit 0. Record the owner's walk verdict verbatim in STATE.md.
5. Write session 14's brief (M1's preparation after the owner's walk, or M0's remaining work if G1 did not pass), then
   `… stamp end`. If G1 did not pass by the end, say so plainly, name each failing check and item, and never say "walk now".

## Finish line (session 13 is done when each holds, with a tool result)
1. The six carried PRs are merged in order, or each one not merged is named with its reason (`gh pr view`).
2. D1–D10 are each closed by a merged PR with a check on main (D4 per the #160 ruling). D7, D9, D10, #235 and #236 are
   merged, or each is linked to an open issue with a reason.
3. Every walk issue (#314–#337 and any G1 #2–#4 files) is closed by a merged PR, or open with its carrier and reason
   (`gh issue list --label walk`).
4. `uv run python -m scripts.walk.ready origin/main` exits 0: two passing G1 walks in a row, the newer on main's current
   product code, with the burden inside Q5's limits.
5. One scored run on main's last head, reported in #45 against the 90 % bars (196/217, 666/739, 61/67, 376/417) with each
   gap and the 80 % marks beside them; and the plan for sessions 14+ in #45.
6. S1's ceiling: Q13 answered and the two-keyer agreement measured by the key user, or named open with its reason. #249
   with J2 merged and the custody re-run done, or filed with its reason. J1 merged, or filed for session 14.
7. Every cut and every walk finding is an issue (cite the number), and the leak scans of Phase 5 show 0 hits.
8. Only then the owner is told "walk now", with the reading gap stated beside it, and their walk verdict is in STATE.md.

## Owner questions (one at a time; your recommendation first and its reason in a line; the default stands until answered)
Ask only what STATE.md does not already answer. Start the work on the defaults; don't wait.

| Q | Recommended default | Reason in a line |
|---|---|---|
| **Q13**, the Answer Key conventions (**ask first**) | Answer before any reading loop: turned title blocks; the slab-detail kind (keyed differently in the two sets); Edison's 6 storey Sheets (33 storeys open); the box convention for notes. Then measure two-keyer agreement. *Unanswered:* no reading loop; S2 only on classes the conventions do not touch | loops otherwise tune toward an inconsistent key; 48 of 57 missed Edison title blocks follow one keying pattern |
| #160's render_f1 trade | accept, with the reason "outlines on paper", if G1's FL6 passes on both sets; otherwise `t160` lands after `loop-iou` | Sheets off paper 117 → 5 is what the QS sees; render_f1 lost 46 and changed 84 |
| **Q5**, burden limits | ≤ 3 open Questions per Discipline after Proposals; ≥ 80 % of Sheets bulk-confirmable per Discipline; 0 false continuation Questions; act p95 ≤ 1 s while a read runs; every plan Sheet states its storey | G1 needs numbers to pass or fail; walk-expect holds these now |
| Continuation groups by member-mark range (new) | M0 keeps the one-title rule G1 judges by; mark-range grouping becomes an issue for session 14 | all 4 Sample groups are mark-range titles a QS groups but the one-title rule cannot; a new reading rule with no measure yet |
| **Q17**, a custody views-only scored mode for loop candidates (never for posting or the reported score) | yes. *Unanswered:* no; "the job is the scored reader" stands | ~2 scored heads an hour cannot tune the ~150 Sheets 90 % needs |
| Q24, Jev answers recorded and replayed inside the scored run (J2) | yes: keyed by the product's cache key; a miss is `Unavailable` and counted; no key in the sandbox | without it, every Jev gain scores 0 |
| Q16, a narrower posting cache key (the job's import closure) | yes, in the same custody re-run | the lock is over-subscribed; it would have saved ~1.4 h of lock in session 11 |
| Q6, custody re-run cadence | one batched re-run per wave; in session 13, after #249 merges | the re-run is root and your hands |
| Q23, drawing text to Jev from cloud sessions (amends ADR 0013) | yes, once the cloud key has a spending limit (unknown today); until then such calls stay local | your Q7 lets cloud sessions read drawings |
| Q8, the S4 vision prototype | development-time only: a 10-Sheet Sample Project prototype through Claude Code after S1; in the product it would amend ADR 0011 | the only strategy aimed at the 209–258 Views the rules miss or mis-kind |

## Laws that do not change (CLAUDE.md is the law; the guard enforces most)
- **Real drawings** and everything derived from them stay under `.private/` and local. The posting and scored runs, the
  scorer's keys, G1 and the walk-issue triage stay local. Held-out Sets never leave this machine.
- **The repository is public:** no drawing text in a commit, issue, PR, workflow file, mod, agent memory or cloud
  prompt; only verdicts and counts leave `.private/`. Every push and every `gh` body is leak-scanned first.
- **Never** print a secret, delete recursively, rewrite history, force-push, skip hooks, stage everything, change the
  ruleset or branch protection, admin-merge, use PowerShell, or edit permission settings or classifier rules.
- **Merges** follow the review loop (at most two fix rounds; a third only under a recorded exception), green required
  checks and `merge_ready`. Gates are posted only through `post-status` from the main checkout, from an independent
  verdict. The ledger is the record; a PR comment is not.
- **Acceptance tests come first,** by `acceptance-writer` at high. Builders never change them; only the orchestrator
  amends one, through `scripts.factory.amend`.
- **No "walk now" without `ready.py origin/main` exit 0.** Jev advises; it never decides a gate.
- **The owner decides** product, scope, spend and anything irreversible: one question at a time, recommendation first.
- **Every serious finding** (50 or more, or a repeated class) leaves a committed check.
- **The machine:** at most 3 local agents; the governor's floors (30 GB disk, 2 GB swap, memory); no local web tests
  while a walk or a real-drawing run is up; every suite's output in a file under `.private/work/` (pytest with `-rf`).

## Skills, tools and agents
- **Agents:** `acceptance-writer` (high); `pr-reviewer` and `refuter` (Opus, high); `ux-critic` (the walk, or the
  words-only gate) and `qs-critic` (G1's critics and the walk-expect review; they cannot edit); `drawing-analyst` (local:
  S1's second keyer, walk-expect); `Explore` on Sonnet 5.5 for look-ups.
- **Workflows:** `/review-pr` (the review loop, refuters, the ledger) and `/real-set-walk` (G1's agent layer).
- **Skills:** `orchestrate-wave` (the runbook), `verify`, `real-drawings`, `product-review`; `to-tickets` (the walk
  issues, #235's split); `diagnosing-bugs` (#317); `tdd`; `research`; `domain-modeling` (ADRs: Q23 amends 0013, S4 in
  the product would amend 0011); `writing-for-agents` for any agent or skill edit; `typesafe:typesafe-ai` for J1, J3, J4
  and J5.
- **MCP:** `chrome-devtools`. Select your own page by URL before every action; per-page viewport emulation only.

## Operating lessons (use them)
- **Wait on events.** Monitor on `events.log` or a log file, `notify_when_idle` for local builders, `run_in_background`
  for long runs. Never a `pgrep -f` or `ps | grep` loop: it matches itself (the guard refuses it).
- **Time from `scripts.factory.stamp` or `date -u`, never memory.** Every message to a builder starts with its elapsed
  time against its budget.
- **Message a local builder with `scripts.factory.say <full session id>`.** It prints the text for SendMessage when
  the session is live (a row with a pid) and resumes it otherwise. After a reboot a dead session's row can still read
  `done` or `blocked`: `say` resumes it itself when no row has a pid (#393); see gap 5 only if it refuses. Never message a running workflow agent: it starts a second
  copy (two measure strands ran twice in session 12, and one overwrote the other).
- **A capped PR is closed and re-submitted complete as a new PR** (#352 → #358, #365 → #377). A gate hand-built across
  review rounds thrashed (#354): pin the whole behaviour with an acceptance writer first.
- **Test the real producer against the real consumer.** The class "tested only against fakes" cost session 12 #312,
  #339 and #344, and #350's acceptance fake invented a `gh` subcommand: a fake must behave like the real tool here.
- **Pin every time a test compares with a commit's time** (`GIT_COMMITTER_DATE` or relative times): f5's tests went red
  10 min after their pinned time.
- **Factory trailers** count only in a commit message's last paragraph, with the attribution lines inside it.
- **The leak wall:** the scanner line runs alone in its call; a stamp covers only the head it scanned; the corpus
  absorbs whatever sits in private notes, so keep invented test literals out of them.
- **Check that "filed" is filed:** cite the issue number. Two "filed" issues did not exist in session 12.
- **CI** is sharded (4 python shards, ~7–8 min). `gh pr edit` fails on gh 2.45 here (projects-classic): patch a body
  through the REST API. `merge_ready` refuses any PR touching a web file, tests included, without `design-gate`: get a
  words-only `ux-critic` verdict and post "not applicable" where it fits.
- **The cloud VM:** 4 vCPU, 15 GB, no swap, runs as root; web tests need `export_openapi_schema`, `api:types` and
  `typecheck` first; nested bwrap fails there, so the real-drawing check and DWG-reading tests run locally only.
- **One checkout, one test database:** a killed run's rows break the next; set `VEXTRUS_DB_NAME=vextrus_<name>` for a
  clean run.
- **Disk:** review slots and scratch copies took 11 GB in 2.5 h in session 12; check `df` before every launch.
- **After a power cut or reboot,** `/tmp`, background loops and running reviews are gone: re-arm the Monitors, resume
  reviews from their journals, restart the lander, and re-check every head.

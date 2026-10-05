# Session 13: M0 to walk-ready with the factory (the product walk on the real sets; the reading reported against 90 %)

## Starting the session (the owner)
1. In a WSL terminal: `cd ~/vextrus-cubit && git pull`, then `df -h /` and `free -g`.
   - Keep at least 40 GB free: the governor refuses every local unit under 30 GB and warns under 40. At session 12's
     close the disk had 57 GB free and 21 GB of memory was available.
   - If it is under 40, run `scripts/owner/clean.sh` (a dry run: it lists the worktrees under `.claude/worktrees` with
     their sizes, and the test databases), then `scripts/owner/clean.sh --yes` at the terminal. It never drops a
     database: the `vextrus_s12ci_*` and `vextrus_walk_*` databases are yours to drop (#298).
   - Session 12's review copies hold 4.7 GB in 54 worktrees under `.private/work/session-12/review/`.
     `VEXTRUS_CLEAN_ROOTS=.private/work/session-12/review scripts/owner/clean.sh` lists them. **Do not run `--yes` on
     that root as it stands:** `--yes` deletes every entry it lists, and the same folder holds the `*-out` folders that
     session 12's measures cite as red evidence. Remove the review worktrees by name, or move the `*-out` folders first.
   - Keep the 10 red-proof worktrees under `.private/work/session-12/phase4/red/` until session 13's measures are
     recorded: they are the tier-1 checks' evidence.
   - Close VS Code during the session (it held about 10 GB on 4 Oct).
   - No custody re-run is owed at the start. Session 12 changed nothing under `tools/scorer/`, `scripts/real_drawings/`
     or `scripts/owner/post-status`, and no path in `.github/engine-paths.txt` (`git diff --name-only 111096094
     8b2b8d4df`: 267 files, none of them). One re-run is asked later, after the reading-measures PR merges.
2. Start the orchestrator with `scripts/factory/orchestrator.sh`.
   - It refuses (exit 3) while `.private/work/factory/g1.pid` or `rd.pid` names a live G1 walk or real-drawing run: a
     restart would orphan it. Session 12's G1 walk of 8b2b8d4df holds its stack until its verdict is written, or for
     120 min from 01:53Z (5 Oct).
   - It starts the watcher detached (`watch ensure`) and drops the two variables that turn Remote Control off.
   - It starts `claude --model claude-opus-5-5` with `scripts/factory/orchestrator.settings.json` (the status line) and
     `--plugin-dir tools/mod/vextrus-factory` (the band), with `VEXTRUS_ROLE=orchestrator` and 8 workflow agents at
     once.
   - If the band crashes the session twice, run `touch .private/work/factory/mod-disabled` and start again: the band
     is then left out, and the status line shows the same fields.
3. Set `/effort`. It is your choice, and it applies to the orchestrator only: builders get their effort per launch.
   - Recommended: **xhigh with Ultracode on**, the mode you chose for session 12. Four lanes and every gate decision
     run through this one session.
   - Then check `/status` and `/plugin` ("You should know" on, `ralph-loop` off), and say: "Read
     docs/handoff/session-13-prompt.md and run it."
4. Keep this pane open. The session asks you, one at a time, for:
   - two auto-mode classifier rules (the committed launcher; the drawings environment), in its first minutes;
   - the open questions, Q13 first among them;
   - the custody re-run (one `! …` line);
   - and, only when Part 1 below holds, the walk.

---

You are the orchestrator of session 13. **This session takes M0 to a product the owner can walk, using the factory
session 12 built.** It also reports the reading score against the owner's 90 % bar, honestly. Its first hour pays the
factory's own debts from session 12, because every later PR passes through those walls.

The goal, in the owner's words (4 Oct 2026): "on session-13 at any cost we'll reach the ultimate version of M0 for me to
walk and after my walk on M0 we can prepare for M1 from session-14 or session-15".

**"At any cost" meets the evidence here:** no measurement says 90 % reading can be reached in session 13.
- Main passes 45/217 Edison Sheets.
- The last three loops moved Edison by +6, +1 and 0.
- Even 80 % is estimated at 6–9 sessions (`docs/specs/factory.md` §1 Answer B, §6; `.private/work/session-12/research/bar-90.md` §0).

So the finish line has two parts, after a Part 0 for the factory's debts:
- **Part 1, the walk-ready product:** flow and QS burden pass on the real sets, proven by G1 passing twice.
- **Part 2, the reading:** reported against 90 % with every gap stated, and never claimed.

Never hide the gap. Never bend a gate to close it.

## The owner's words (verbatim; read them twice)
**Intent** (4 Oct 2026, session 12's brief and spec):
> "like a powerful software factory engine harness to develop this project with highest quality in shortest time
> possible without concerning tokens: focusing on quality output with lots of parallel sessions and agents mostly in
> cloud sessions possible"
>
> "if you run builders in cloud then this machine will have to bear less load, we have to use most of the cloud
> sessions system so that we can run as much sessions without burdening our local machine, on our local machine only
> the needed core sessions will run"

**Rulings in session 12** (`.private/work/session-12/STATE.md`, 4–5 Oct 2026, UTC):
- 17:21Z, Q1, lifting "no orchestrator code": "Yes, lift it (Recommended)".
- 17:22Z, Q2, session 12's budget: "~11 h as proposed (Recommended)".
- 17:26Z, Q11, the machine: "Cleanup; keep .wslconfig (Recommended)".
- 17:42Z, plan and spend: "20x max account, $500 credit's balance are already used and just forget about them, 20x max
  account is perfect for us and if further tokens or credit requires for our upgraded version I'm willing to spend
  which will comes later, for now go on with your full potential."
- 18:21Z, Q10, accounts: "Yes, account A for all (Recommended)".
- 20:05Z, the first approval question: "Not yet".
- 20:2xZ, notes on the draft:
  - selected **"More cloud, more parallel"**;
  - the full text: "Everything seems okay except I have additional requirements that you'll need more research and
    adding to the factory spec plan: mostly pairing with Typesafe AI Jev model into factory incorportation where Jev
    model invokation and actively using it will enhance the factory workflow more better and enhance performance as well
    as making sure of getting the best out of Jev inside our new vextrus software as originally planned; as I told
    before to use Typesafe AI API that is set on both local .bashrc and cloud also where I have enough tokens for you to
    use: don't hesitate to call typesafe API and use credits during research, testing and of course after
    implementation; it's just my opinion that pairing typesafe Jev model more actively into factory would bring us more
    robust performance. Additionally: Q4 M0 bar - 90%, Q7 drawing data - I'm allowing to be more easy going on this case
    and cloud sessions may read drawing and enabling Remote Control for most cases if that means more power and
    performance by allowing some privacy issues that I'm allowing willingly, Q20 acceptance writers at high effort: yes
    for most scenario if it comes to quality. That's the additional NOTE of mine for improving, updating, upgrading the
    factory spec plan before Phase 3 execution. Please go through this with additional workflow and agents run for ~30
    min more and finalize the factory spec plan and present it to me for approval and then after start Phase 3 for
    ultimate execution."
- 21:08Z, approval of the spec (6a0979b75): "Approve as written (Recommended)".
- 21:09Z, Q9, user settings: "Yes, Sonnet default (Recommended)". `CLAUDE_CODE_SUBAGENT_MODEL` is `claude-sonnet-5-5`;
  the gating agents stay Opus through their frontmatter.
- 23:16Z, the client name in ADR 0005: "Remove the legal name only (Recommended)". PR #292 merged it; "the Edison set"
  stays.
- 23:40Z, the G1 walk's file counts: "Confirm 7 and 4 (Recommended)". Edison is walked as 7 files (5 DWG and 2 Plot
  PDF), the Sample Project as 4 (2 DWG and 2 Plot PDF), and only those two sets are walked.

**Session 11 rulings that still bind** (`.private/work/session-11/STATE.md`, 4 Oct):
- #229: "Plot match + gap local (Rec.)". A matched Plot page is a second source. A gap holds only the Sheets beside it.
  There is one Question per Discipline's gaps.
- #228: "Propose Jev's top kind (Rec.)". Jev's first choice is the proposed kind. A Question is raised only when the top
  two are close or the title contradicts. Add "Slab details". The round-1 review then ruled that the pre-pick is kept
  and shown, and m0-screens §5 was amended.
- The walk: "I walked through .private/work/session-10/walk-steps.md and the result was really poor, I would rather walk
  after session-11".
- 30 Sep: "the job is the scored reader". It stands unless Q17 changes it.

**Owner actions done in session 12. Rely on these facts:**
- The worktrees were cleaned: 124 became 8, and 11 unpushed heads were archived under `refs/archive/s12/*`. (Session
  12's reviews and red proofs have since added 74; see "Starting the session".)
- The cloud environment `vextrus` has `BASH_DEFAULT_TIMEOUT_MS=600000` and `BASH_MAX_TIMEOUT_MS=2400000`, and it is
  the default remote environment.
- "You should know" is enabled, and `ralph-loop` is disabled (not re-checked at the close).
- The two Development Sets were pushed to the **private** repo `vextrus/vextrus-drawings`.
- A fine-grained read-only token for that repo is set as `VEXTRUS_DRAWINGS_TOKEN` in a second cloud environment,
  `vextrus-drawings`. Rotate it when M0 closes (O9).
- The owner merged #247 (spec, ADR 0042 and contracts).

## Read first (delegate long reads to Sonnet `Explore` agents; keep your context for decisions)
1. This brief, including Phase 4's results at its end.
2. `docs/specs/factory.md`:
   - §1, the two answers;
   - §2.2, every tool;
   - §5, G1–G5 and the definition of done;
   - §6, this plan;
   - §7, the questions;
   - §8, risks.
   Also ADR 0042 (`docs/adr/0042-the-software-factory.md`).
3. `.private/work/session-12/STATE.md` from 23:30Z on (Phase 3's tail and Phase 4), then
   `.private/work/session-12/phase4/measures.md` (read its "what is broken or unmeasured" first) and
   `phase4/red/INDEX.md`.
4. `CLAUDE.md` (one page, 88 lines), `.claude/rules/` and `.claude/skills/orchestrate-wave/SKILL.md` (f6's rewrite).
   Two of the runbook's lines do not match the code: see "Gaps between the runbook and the code" below.
5. Session 12's research, as each lane needs it:
   - `.private/work/session-12/research/verified-answers.md`: the two answers, D1–D10 per defect, the failure classes;
   - `bar-90.md`: the 90 % plan, its order and its targets;
   - `verified-measures.md`: CI, the machine and the lock;
   - `jev-product.md`: Jev on 130 real items.

## Where M0 stands at session 12's close (tool results)
- **main**: 8b2b8d4df (#293 merged at 01:53Z, 5 Oct). This brief's docs PR lands after it.
  - Session 12 changed **no engine path and no custody path**: `git diff --name-only 111096094 8b2b8d4df` (267 files)
    touches nothing listed in `.github/engine-paths.txt`, nor `tools/scorer/`, `scripts/real_drawings/` or
    `scripts/owner/post-status`.
  - So main's reading code is the code last scored, and its posting run is cached.
- **Scores** (blind scorer). Main's code, 111096094, is the same code as scored head 40e86320:
  - Edison 45/217 Sheets (20.7 %) and 429/739 Views (58.1 %);
  - Sample Project 8/67 (11.9 %) and 215/417 (51.6 %).
  - Best scored head: `loop-iou` ae25e64e, unmerged, at 439/739 and 238/417, with Sheets unchanged.

| | The bar: 90 % (Q4, ruled) | 80 % (session 08; now an interim mark) | main today | gap to 90 % |
|---|---|---|---|---|
| Edison Sheets | ≥ 196 / 217 | 174 | 45 | 151 |
| Edison Views | ≥ 666 / 739 | 592 | 429 | 237 |
| Sample Sheets | ≥ 61 / 67 | 54 | 8 | 53 |
| Sample Views | ≥ 376 / 417 | 334 | 215 | 161 |

- **D1–D11** (session 11's agent walk of main, `.private/work/session-11/review-main/report.md`). G1's first walk of
  main (02:10Z, 5 Oct) measured D1 and D2 still there (Phase 4's results).

| D | Issue | What the QS meets | Carrier | State |
|---|---|---|---|---|
| D1 | #227 | Step 1's acts wait minutes on a read job's transaction | `t-readlock` | fix round 1 committed, local, unpushed |
| D2 | #228 | a flood of "What kind of sheet" Questions, none pre-picked | `t228` | fix round 1 committed, local, unpushed |
| D3 | #229 | a numbering gap removes every Sheet's second source | `t229` | fix round 1 committed, local, unpushed; no real-drawing run yet |
| D4 | #160 | view outlines off their paper | `t160` | pushed; the owner's render_f1 trade is open |
| D5, D8 | #230 | no live refresh; Coverage says "Another Discipline" | #238 | merged in session 11; D8's class check is G2a (#250) |
| D6 | #231 | no Plot, Compare or CAD-dark in Step 1 | #244 | merged in session 11 |
| D7 | #232 | "12 copies"; continuation runs raise Questions | — | not started (lane B) |
| D9 | #233 | storeys missed on plain titles; a sheet's only plan proposed as a duplicate | — | not started (lane B, drawings) |
| D10 | #234 | presentation plans not proposed to leave out | — | not started (lane B, drawings) |
| D11 | #235 | smaller Step 1 and admin items | — | not started (lane B, split into 2–3 tickets) |

- **Carried branches** (unchanged in session 12): `t182` a28db350 (#237, the only open PR), `t-readlock` 675bdc7b,
  `t229` 8738bfc4, `t228` 9800dc4b (all three local), `t160` d6f22236 (pushed), `loop-iou` 2973a919 local (99abbf56
  pushed).
- **Other open items:**
  - #236: the seed's Plot PDFs are stubs. It goes after #237, which changes the seed.
  - #245: CI flakes. f1 shipped fixes for all three (two never reproduced locally). Close it with the run links once
    main's web job is green on 5 pushes in a row (`.github/flaky.txt` lists them until then).
  - #243: pytest basetemp. xdist (#248) fixes it.
  - #211: the literal scan. f2's leak wall (#291) refuses a push whose added lines match the corpus, and the corpus
    reads the cached exports: close #211 with #291's link.
  - #297 (G1's scratch worktree poisoned the corpus): fixed in #291 (`walk_skips` in `tools/leakscan/sources.py`,
    tested in `tools/leakscan/tests/test_round1.py`) but still open: close it with that link.
  - #239–#241, and the design-gate mays #218–#224: only if lane B has room.
  - #150 and #204 close with #237.
- **Factory issues:** 56 open, labelled `factory`: #248–#281, #283, #289, #290, #294–#298, #300–#303, #306–#313,
  #340 and #341. The first hour takes nine of them; lanes A to D pick up the ones the product needs.

## The factory as built (every component merged on main by 01:53Z, 5 Oct)
f0 #247 (spec, ADR 0042, contracts), f1 #286, f2 #291, f3 #288, f4 #287, f5 #293, f6 #284, f7 #299, f8 #282 and
f9 #285, plus #292 (ADR 0005 names no company) and #304, #305 (two leak-allowlist lines). Run everything from the main
checkout, `/home/riz/vextrus-cubit`. Every Python tool prints its own contract with `--help`.

**Start** (f3). `scripts/factory/orchestrator.sh [claude arguments…]`, e.g. `--resume <full session id>`. Refuses
(exit 3) on a live `g1.pid` or `rd.pid`.

**Clock** (f3, f6). `mkdir -p .private/work/session-13` first: `start` accepts a missing folder and the first line
then crashes (#340). `uv run python -m scripts.factory.stamp start --budget 11h --state .private/work/session-13/STATE.md
[--phases "hour1=60,a=300"] [--force]`; `… stamp "<text>"` appends `<UTC> <text>` to STATE.md; `… stamp phase <name>`;
`… stamp elapsed [--ticket <t>]`; `… stamp budget --ticket <t> --minutes <n>`. `start` cannot backdate, and a second
start is refused without `--force`. The clock hook prints `now … · session h:mm/h:mm` on every prompt.

**Preflight** (f3). `uv run python -m scripts.factory.governor check <unit> [--json] [--usage-checked "<lines>"]
[--running N] [--agents N] [--rate R --hours-to-reset H]`. Units: `cloud-session`, `local-agent`, `review`, `pytest`,
`web-tests`, `walk`, `rd-run`. Exit 0 `OK`, 3 `REFUSED <unit>: <reason>`, 2 usage. It fails closed on an unreadable
usage reading; `--usage-checked` takes your own `/usage` lines. Launches are held at session ≥ 80 % or week ≥ 85 %;
cloud sessions are capped at 8 while session < 50 % and week < 70 %, else 4, or by the measured rate with `--rate`.

**Watch** (f3). Started by `orchestrator.sh` (`uv run python -m scripts.factory.watch ensure`; one watcher at a time).
It writes `.private/work/factory/status.json` and appends to `.private/work/factory/events.log`. Wake on Monitor with
`tail -n0 -F .private/work/factory/events.log`, re-armed at 30 min. `uv run python -m scripts.factory.status age`
exits 0 while `status.json` is at most 180 s old, 3 otherwise. It watches the branches named by launch records under
`.private/work/factory/launches/` (the launcher's default): never record launches elsewhere.

**Lock** (f3; one visible queue: `posting` > `scored` > `no-post`). `uv run python -m scripts.factory.rdlock run --kind
posting --head <sha> --ticket <t> -- scripts/real-drawings …`; `… rdlock status`. Exit 0, 4 queued, 5 a duplicate
waiter. The run's log is `.private/work/rd/<head8>-<kind>-<UTC>.log`.

**Launch, cloud** (f1). `uv run python -m scripts.factory.launch cloud --branch <b> --prompt-file <f> --ticket <t>
--effort low|medium|high [--role builder|acceptance-writer|reviewer|refuter] [--untestable "<why>"] [--usage-checked
"<lines>"] [--budget-minutes n]`. First line `OK … <session_id>`, or `REFUSED <code>: …` (exit 2: `bundled`,
`no-acceptance-commit`, `no-git-source`, `no-preflight`, `no-session`, `wrong-environment`, `wrong-repository`,
`wrong-revision`; a refused session is sent STOP and listed for the owner to delete), or exit 3 on the governor. Effort
stops at `high`: no `xhigh` for builders.

**Launch, local** (f1 + f3). `uv run python -m scripts.factory.launch local --ticket <t> --branch <b> --effort <e>
--name <n> --prompt-file <f> [--role builder|acceptance-writer] [--budget-minutes n]`. The branch must be on origin.
It makes `.claude/worktrees/<t>`, merges `origin/main` into a carried branch as a recorded merge commit (a conflict
aborts and removes the worktree), runs `ensure_database`, and starts `claude --bg --agent <role>` with
`scripts/factory/builder.settings.json` and `VEXTRUS_ROLE=builder`. `uv run python -m scripts.factory.local … --dry-run`
checks without creating anything.

**Message.** A cloud builder: `uv run python -m scripts.factory.launch say <session_id> --file <f> [--ticket <t>]
[--elapsed n/m]` (leak-scanned; it acts 1–3.5 min later). A local builder: `uv run python -m scripts.factory.say <full
sessionId> --file <f> (--elapsed n/m | --ticket <t>)`. For a live session it prints the prefixed text for you to send
with SendMessage; a `stopped` or `failed` session with no pid is resumed by its full id; exit 6 and `ALARM-RESUME-COPY`
in `events.log` if the CLI copied the conversation.

**Builder** (f4 + f2). `.claude/agents/builder.md` and the `verify` skill: the builder stages by explicit path and runs
`uv run python -m scripts.verify > .private/work/<ticket>/verify.txt 2>&1; echo $?`. Exit 0 ends with `Factory-Verify:
<tree> ok`, which goes beside `Factory-State: READY` in the commit's trailers; or it finishes `Factory-State: BLOCKED`
with `Factory-Reason:`. The guard refuses to push a READY head with no green verify record for its tree.

**Review** (f4). `/review-pr <PR> <40-hex head> <round 1-3> [exception]` (the workflow
`.claude/workflows/review-pr.js`: round check, a review slot under `.private/work/factory/review/`, `pr-reviewer` plus
an adversary lens and `ux-critic` when words changed, a refuter on every finding of 50 or more, then the record). The
record of truth is `.private/work/factory/ledger/<PR>-<head>.json`, written once, by `uv run python -m scripts.ledger
record <PR> --round n --head <sha> --from <file> [--exception security75|crash|false-statement --reason "<text>"]` from
the main checkout. `… scripts.ledger check <PR> --round n` refuses a round 3 without an exception. Jev's triage sits in
shadow beside it and never decides. **This workflow has never run:** session 12's rounds went through an interim script
or by hand. Treat its first run as a trial: read the ledger record and the PR's marker comment before relying on it.

**Merge gate** (f4). `uv run python -m scripts.merge_ready <PR>`: exit 0 ready, 1 not. Beside the statuses, it refuses
(a) no ledger PASS for the head (a newer head passes only if every commit since is a merge of main with an empty
resolution), (b) round 3 with no exception, (c) a `## Cut`, `## Not done` or `## Deferred` item that links no open
issue, (d) a leak-scan hit, or no scan, on any part of the PR. A PR touching any web file needs a `design-gate` status,
test files included.

**Land: `scripts/land.py` cannot land a PR on this machine yet.** `uv run python -m scripts.land <PR> [<PR> …]` checks
the ledger PASS, marks the PR ready, runs `gh pr update-branch`, waits for CI, runs `merge_ready` and merges pinned to
the head. But:
- it reads CI with `gh pr checks --json`, and gh 2.45 here has no `--json` on `gh pr checks`: the call fails;
- its one-rerun step always raises ("a rerun needs the failed tests' ids");
- its PASS check is for the exact head, so a second call after `update-branch` moved the head is refused, while
  `merge_ready` would accept that clean merge. An engine PR needs its posting run on the updated head before
  `merge_ready` passes, so it lands through `scripts.land` only if main does not move between its review and its
  landing.
Its tests use a fake GitHub, so none of this failed in CI. Until a fix lands (#312, in the first hour), land the
way session 12 landed its factory PRs: `.private/work/session-12/cloud/land.sh <PR> <branch>`. It merges `origin/main` in
the landing worktree on a detached HEAD, takes the leak stamp and pushes that head to the branch from the main
checkout, waits on `gh pr view --json statusCheckRollup`, runs `merge_ready`, and merges pinned to the head. Its last
line writes the MERGED line through session 12's own `stamp.sh` into session 12's STATE.md: copy it to
`.private/work/session-13/land.sh` and change that line to `uv run python -m scripts.factory.stamp "<text>"` before
its first use.
- **Its first version moved branches under their worktrees** (`git checkout -B`; #338's round 1): the worktree's
  index stayed on the old tree, and its next commit would undo main's merge. `.claude/worktrees/s12-f5` is in that
  state (176 staged reversals): never commit there. f5 is merged, so ask the owner to remove it
  (`! git worktree remove --force .claude/worktrees/s12-f5`).
- **After any landing step pushes a merge to a carried branch** and then stops (red CI, `merge_ready` refusing), run
  `git -C .claude/worktrees/<t> pull --ff-only` before the next fix commit there. Otherwise the push is refused as
  not a fast-forward.

**Gates** (unchanged). `design-gate`, from an independent verdict, never the builder's: `sudo -n -u vxkeys
/usr/local/lib/vextrus/post-status design-gate <PR> <full sha> --passed <items> --failed <items> --not-applicable
<items>`, alone on its line, in the main checkout. `real-drawings`: `scripts/real-drawings <PR> --no-post` first (under
`rdlock`), then `--accept-if-clean` or `--accept "<judged reason>"`.

**Leak wall** (f2). `uv run python -m tools.leakscan <command>`: `build [--force]`, `range <base>..<head> --ref <b>`
(writes the stamp the guard needs to push `<b>`), `file <f>` (the stamp for a `gh` body file), `text --stdin`, `pr <n>`,
`dir <d>`, `bodies --since <date>`, `allow <file:line> …`, `verify-stamp <name>`. It prints locations and counts, never
text. The guard accepts only `uv run python -m tools.leakscan <command> …` with nothing else in front (session 12's
first `build` line, which had more, was refused): run it alone in its call, with any merge base computed first and
passed as a sha. The pre-push hook runs on every push (`core.hooksPath` is `scripts/git-hooks`, set at 00:48Z on 5 Oct,
when the corpus was rebuilt from main: 5,510 strings).

**Guard** (f2). `.claude/hooks/guard.mjs`. `node --test .claude/hooks/guard.test.mjs` passed 48/48 from the main
checkout after the merge, and all hook tests passed 367/367 (`phase4/guard-test-main.txt`, `phase4/hooks-all-main.txt`).
Its rules include `LEAK_STAMP`, `READY_UNVERIFIED`, `SELF_MATCHING_WAIT`, `RAW_SESSION` (no raw `--cloud` or `--bg`;
resume only by a full UUID), `RECORD_FORGED`, `HOOKS_PATH` and `GH_BODY`. Three over-blocks are known (#303, #307).

**G1** (f5). `uv run python -m scripts.walk.run <sha40> [--hold-minutes N] [--set <slug>] [--print-plan]`, detached;
then `/real-set-walk <sha40>` (`.claude/workflows/real-set-walk.js`); the verdict is written by `uv run python -m
scripts.walk.verdict <sha40> --leak-hits N` and issues by `uv run python -m scripts.walk.issues draft|record <sha40>`,
both run by the workflow's agents. Readiness: `uv run python -m scripts.walk.ready origin/main` (exit 0 ready, 1 not,
2 malformed). Details under "The close".

**Session hooks** (f6, `.claude/settings.json`). SessionStart: `state.mjs`, the clock, `watch-start.mjs` (restarts a
stale watcher), `selftest.mjs`, and `precompact.mjs restore` after a compaction. UserPromptSubmit: the clock.
PreToolUse: the guard. Stop: `stop-gate.mjs` (builders) and `walk-gate.mjs` (blocks "walk now" without `ready.py`'s
exit 0). SubagentStop: `verdict-gate.mjs`. PreCompact: `precompact.mjs`.

**Band** (f8). `tools/mod/vextrus-factory` and `scripts/factory/statusline.mjs`, loaded only by `orchestrator.sh`;
never on builders.

**Jev** (f9; pinned `jev-1.13.0`, cache, call log `.private/work/factory/jev.log`, 6 s deadline, `Unavailable`). `uv
run python -m scripts.factory.jev triage --from <json>`; `… jev same-issue --text "<public words>" --issues <json>`;
`… jev models-check` (the watcher runs it daily).

**CI** (f1). `.github/ci-shards.json` (4 python shards) and `.github/flaky.txt`. Python ran 6.5–7.4 min wall (the whole
`ci` run 7.2–8.2 min) against a 24.6-min median before. Read checks with `gh pr view <n> --json statusCheckRollup`.

**Laws and docs** (f7). CLAUDE.md is 88 lines, with detail in `.claude/rules/`. `uv run python -m tools.lint.docs_paths`
runs in CI: paths in the living docs exist, CLAUDE.md stays at most 90 lines, and every lesson from session 08 on ends
with a check's path or "No check yet:" and an issue.

**Cleanup** (f3). `scripts/owner/clean.sh`: the owner's, a dry run, then `--yes` at a terminal (refused for agents).

### Gaps between the runbook and the code
- `orchestrate-wave` step 6 says `uv run python -m scripts.land order` picks the landing order. There is no such
  subcommand (`scripts.land` takes PR numbers only; `order` is a usage error). It orders the PRs you give it: engine
  PRs with a ledger PASS first, then the rest, by number.
- The same step says the lander "prints the gates still owed". It prints none: post `design-gate` and run the
  posting run yourself before landing.
- Fix both lines with the lander's fix (#312), with `writing-for-agents`.

### What each factory PR's review caught (records: `.private/work/session-12/ledger/`, `.private/work/factory/ledger/`)
Rounds: f0 2 (by hand), f8 1, f2 and f5 3 each (both under a recorded round-3 exception), every other PR 2. 48 distinct
findings of 50 or more were caught before merge.
- **f0:** round 1 found 9 (two at 75: the ADR index and history not updated; `node --test` on a folder fails on Node
  24); round 2 found 1 at 50, fixed by the orchestrator.
- **f1:**
  - the launcher refuses a session that ran in the wrong cloud environment;
  - it refuses outside the main checkout (a clone or a subfolder no longer passes);
  - every CLI call has a time limit;
  - the proven-CLI lock survives a kill.
  - Round 2's only finding (75) was the orchestrator's own acceptance amendment (E501).
- **f9:** the 6 s deadline reaches the socket, and the cache tells question orders apart.
- **f6:**
  - the verdict gate reads the handed-back report;
  - the runbook keeps the full-id resume rule;
  - the gate-posting lines are exact.
- **f4:**
  - the legacy acceptance list carries 7 commits that have no counts (#237's four, t160's, f2's and f8's);
  - a PR no longer counts as "an open issue";
  - `verify` hands an absolute schema path to `api:types`.
  - Round 2's only finding (60) was the orchestrator's own amendment (ruff E501 and SIM300).
- **f3:**
  - one watcher only, and it runs on Python 3.12 too;
  - `rdlock run` honours a duplicate waiter;
  - review launches are not counted as builders.
- **f2:**
  - round 1, 10 confirmed: a glob over-blocked; only the net diff was scanned, not each commit in a push; a `++` line
    was misread as a header; heredoc substitution, `push.followTags`, word-splitting, stdin pushes, binary blobs and
    corpus-emptying spellings were open;
  - round 2, 9 confirmed, among them a **regression from round 1** (any interpreter code containing "push" was refused:
    57 of 84 replayed real commands; score 80) and a **repeated class** (git's long-option prefixes bypassed the push
    rules; a real `--mirr` push deleted remote branches). Round 3 ran under a recorded exception;
  - round 3: the 6 items fixed (red proofs: guard 6/6, scanner 5/5); three left at 45–50 became #303.
- **f5:**
  - round 1: one walk judged twice counted as two PASSes (60); G1's own outputs poisoned the leak corpus (70, fixed in
    f2 as #297). Round 2 passed at edb30fdb6;
  - then CI went red after the merge of main: the acceptance tests pinned verdict times at 01:00Z on 5 Oct, and
    `ready.py` rightly drops a verdict more than 10 min older than its head (a **time bomb**). The orchestrator's
    amendment ae8fdd97c pinned the commit dates. Round 3 (exception "crash") found the same bomb in the builder's own
    `test_walk.py` (75), fixed in 547ab2c13.
- **f7:** round 1 found 3 (50, 50 and 55: wrapped code spans escaped `docs_paths`; two lessons pointed at checks that
  do not fail; CLAUDE.md's effort line contradicted Q20); round 2 passed.
- **f8:** no finding of 50 or more.

Findings scored under 50 are issues #283 (band), #289 (Jev client), #290 (session hooks) and #300 (G1); f1's are in
#310. f7's review filed #301 (the launcher and accounts), f2's are #302 and #303, and f5's builder filed #294–#298.

**Known blockers to a passing G1. Clear them before G1 #2:**
1. **Expectations exist, with Q5's defaults.** `.private/work/walk-expect/edison.json` (7 files) and
   `sample-project.json` (4 files) were written at 23:38Z and the owner confirmed the counts at 23:40Z. Every other
   limit is Q5's default (act p95 1000 ms, ≤ 3 open Questions per Discipline, ≥ 0.8 bulk-confirmable, 0 false
   continuations) until Q5 is answered. No `qs-critic` review of the files is recorded: run it in lane D.
2. **#294: false continuation Questions have no source.** The scripted walk records null, and the verdict fails check 3
   on null while Q5 sets a limit. So G1 cannot PASS until #294 counts them from the Answer Key's continuation groups,
   or until the owner drops that limit.
3. **D1, D2 and D3 are on main** until t-readlock, t228 and t229 land. G1 #1 failed on them, as it had to (Phase 4's
   results). G1 can pass only after those three land.
4. **Check 2 may not measure what it says.** `walk.json` marks no act as `during_read` (the field is null on every
   act), so "act p95 while a read runs" was judged over all acts. Settle check 2's semantics before G1 #2: a fix
   ticket if it is wrong (#300 holds G1's hardening).
5. **Brittle selectors:** #295 and #296 (test ids for the drawing set and for Step 1). G1 #1's script layer ran to its
   end; fix them if a later walk trips on them.
6. **Disk:** #298 (walk databases are never dropped). Have the owner list them with `clean.sh`.

## Session 13's plan (`docs/specs/factory.md` §6)
- **Budget** (the owner sets it; ask only if the first message did not): about 11 h of work, with the cut at +8 h.
  - At the cut, anything not on the finish line becomes an issue.
  - Over budget: cut scope and say what. Never overrun silently.
- **The binding limits are the real-drawing lock and the landing slot**, not builders. More cloud sessions move
  neither.

### First act (≤ 30 min, inside the first hour)
1. `mkdir -p .private/work/session-13`, then `uv run python -m scripts.factory.stamp start --budget <owner's> --state
   .private/work/session-13/STATE.md --phases "hour1=60"`. Every STATE line goes through `uv run python -m
   scripts.factory.stamp "<text>"`. `/review-pr` records its own verdict in the ledger since #339 (merged 5 Oct,
   03:03Z): if a Record step reports a refusal, record by hand with `scripts.ledger record` and file it.
2. Read the machine:
   - `uv run python -m scripts.factory.governor check cloud-session` and `… check local-agent`;
   - `/usage` (pass its lines with `--usage-checked` if the governor cannot read them);
   - `df -h /` and `free -g`;
   - `git worktree list | wc -l` (82 at session 12's close);
   - `uv run python -m scripts.factory.status age` (0: the watcher is writing).
   Do not check `core.hooksPath` with `git config --get`: the guard's `HOOKS_PATH` rule refuses any `git config`
   naming it except the one setting line (an over-block for #307).
3. Read Phase 4's results below, `gh pr list` and the G1 walk of 8b2b8d4df: its `verdict.json`, or the slot below if
   it is still empty.
4. Close #211 and #297 with their links (above).
5. Ask the owner, **one question at a time**, each with your recommendation first and its reason in a line: the two
   classifier rules (R1, R2), then **Q13**, Q5 and Q17, then the rest of "Owner questions" below. Don't wait on the
   answers: start with the defaults.

### The first hour: session 12's factory debts (tier 1, in this order)
These are the walls every later PR passes through, so they are built first and land before any product PR. Each is
an acceptance-writer (high) then a builder; the guard and leak-wall tickets are hostile-boundary tickets (high effort
and a refuter). Launch them through the committed launcher in the first 30 min, cloud unless the ticket says local.
1. **#306, the pre-push base and worktree pushes.** The hook scans from the remote's old sha, so after a merge of main
   it re-scans main's already-public commits (it refused f4's push on 7 hits of an allowlisted test literal). It also
   takes its corpus and venv from the pushing checkout, so a push from a worktree fails closed. Scan from
   `merge-base(local, origin/main)`, and read the corpus and venv from the main checkout. **Until it lands,** push
   only from the main checkout; after merging main into a branch, an allowlist line by hash (as #304 and #305 did) is
   the only way past a generic-word hit on main's commits.
2. **#307, the guard's scanner-mention over-block.** Any shell or Python text that names the scanner or its records
   is refused (stamp lines, heredocs, and `RECORD_FORGED` on a read-only listing that names both ledger folders).
   Add the `HOOKS_PATH` refusal of a `git config --get core.hooksPath` read to the same ticket. Judge writes, not
   mentions.
3. **#303, the f2 round-3 items:** a push through a dashed `GIT_DIR` spelling (50), the commit-message over-block (50),
   and the wait-rule over-block (45). One guard ticket with #307 if the builder prefers; then high and a refuter.
4. **#310, launcher hardening** (from #286's round 2): kill the CLI's whole process group on a timeout, report git
   failures, `--untestable`, the log.
5. **#311, the corpus skips test outputs** in the private build notes. f2's invented test literal entered the corpus
   from a builder's notes and blocked a push (#305 allowlisted it).
6. **#308, a lint for time bombs:** a test that pins a fixed wall-clock time against commits made now (f5's
   acceptance tests and `test_walk.py`, both caught only after the deadline passed).
7. **#309, the lessons without checks:** a SendMessage to a running workflow agent starts a second copy (two measures
   strands ran twice in session 12, and one overwrote the other's file); and the classifier denials below. `say.py`'s
   `ALARM-RESUME-COPY` exists but has never been proven live.
8. **The owner's two permission rules, for the auto-mode classifier** (R1 and R2 under "Owner questions"). The
   classifier refused writing the cleanup script and launching the drawings probe ("Data Exfiltration"); the owner ran
   both with `!`. Classifier rules are plain sentences kept in the owner's user settings: the CLI ignores them in
   project settings ("only user/flag/managed settings may set classifier rules"). So the owner adds them; an agent
   never edits permission settings. Draft each sentence, ask once, and record the owner's answer verbatim.
9. **Also found while writing this brief: the lander and the runbook** (above). Fix `scripts/land.py` (CI read through
   `gh pr view --json statusCheckRollup`, a real rerun of listed flakes, and a PASS that accepts what `merge_ready`
   accepts), add a test against gh's real output shape, and fix the runbook's two lines. This is **#312**.
10. **#313, orchestrator acceptance amendments pass ruff before commit.** Twice the orchestrator's own amendment broke
   CI (E501 on #286; E501 and SIM300 on #287). Give it a committed check: a script the amendment goes through, or a
   pre-commit refusal for `acceptance:` commits.

Filed at session 12's close, not in the first hour: **#340** (`stamp start` accepts a missing state folder; the
brief's `mkdir -p` covers it) and **#341** (nothing refuses a STATE line typed by hand; a guard change, so a
hostile-boundary ticket).

### Lane A, the critical path (lock-bound; ~5 h)
The carried PRs land **in this order: #237 → t-readlock → t228 → t229 → t160 → loop-iou**, then xdist. Lane A starts
as soon as the first hour's launches are out: its review batch needs no launch.

All six are **engine PRs**: each owes one posting run on its final head, about 30 min under `rdlock`. Every engine
merge changes the code hash, so the next PR needs a fresh run. A head already run is cached.

Run one `/review-pr` batch first, so each PR gets a ledger record:
- t-readlock and t228 as **round 2**: session 11's round 1 and fix round 1 count.
- t160 and loop-iou as round 1.
- #237 joins after its fix round.
- t229's round 2 waits until t-readlock and t228 have landed and its conflicts are resolved (see its row).

Measured with `git merge-tree --write-tree` on 5 Oct at 02:55Z, at the heads below: t-readlock, t228, t160, loop-iou
and t182 each merge main cleanly, and t228 merges t-readlock and t229 cleanly. **t229 conflicts with t-readlock** in
`vextrus/takeoff/services/step1.py` and **with main** in `web/src/takeoff/locales/en.po`. Re-measure before each
review: a conflict resolved after a PASS voids it.

You push the local branches from the main checkout. Before each push: `git merge-base origin/main <b>`, then `uv run
python -m tools.leakscan range <base>..<b> --ref <b>` on the exact head, then `git push origin <b>`.

| # | Branch / PR | What it fixes | Head (4 Oct) | What it still needs |
|---|---|---|---|---|
| 1 | **#237 `t182`** | the demo seed is the real read job's recorded output (absorbs #150, #204) | a28db350, pushed | **The CI cause is measured:** the function-scoped demo fixture now runs the real read job in every test that asks for it (88 → 103 seeding tests; one seed 2.6–2.9× slower; cancelled at 35 min at 53 % and 34 %). **The fix round has two steps:** (1) the acceptance writer, at high effort, re-scopes `vextrus/takeoff/tests/acceptance/t19a/step1.py:35` and `vextrus/seed/tests/acceptance/t136/seeded.py:28` (seeded once per module for read-only tests) in a one-path `acceptance:` commit with counts; (2) the builder does `vextrus/seed/tests/test_seed_drawings.py:26` and a savepoint helper (cloud: tests only). Then: merge main, `/review-pr` round 1 (session 11's PASS is not in the ledger), CI (4 shards), posting run, land. Close #150 and #204. Its four count-less acceptance commits are in `tools/lint/acceptance_legacy.txt` (f4). |
| 2 | **`t-readlock`** (#227, D1) | Step 1's acts never wait on a read job | 675bdc7b, local | Fix round 1 is committed: the Plot match runs after the proposals, and progress writes are serialised. It is a carried branch: merge main (a recorded merge commit), push, open the PR, round-2 review, posting run, land. It carries G3's first test (#251): an act returns while the read's finishing step is held. |
| 3 | **`t228`** (#228, D2) | Jev's top kind proposed and shown; a Question only when close or contradicted; Slab details (the owner's ruling) | 9800dc4b, local | Fix round 1 is committed: the pre-pick is shown, §5 is amended, subject-sharing titles are handled. Its count-less acceptance commits (449fd7956 and the E501 re-wrap 050b96e60) are on the legacy list. It merges main, t-readlock and t229 cleanly (measured above), so its round-2 review runs in the first batch. Merge main (a clean merge keeps the PASS), push, PR, the words gate, the design gate, the posting run, land. |
| 4 | **`t229`** (#229, D3) | a matched Plot page is a second source; a gap holds only its neighbours (the owner's ruling) | 8738bfc4, local | Fix round 1 is committed: the title is read in order near the number; keep-open is carried by gaps. **It conflicts with t-readlock** (`vextrus/takeoff/services/step1.py`) **and with main** (`web/src/takeoff/locales/en.po`). So, after t-readlock and t228 land: merge main into t229, resolve both by hand in that merge commit, run its tests, push, PR, and only then the round-2 review. A conflict resolved after the PASS voids it (`merge_ready` (a)), and a round 3 needs an exception that none of the three covers. It changes `web/src/messages/**`: a `ux-critic` words review, and a design gate with the m0-screens §8 keyboard walk. Its first real-drawing run is the posting run. Land. |
| 5 | **`t160`** (#160, D4) | one paper scale: outlines lie on their paper | d6f22236, pushed | Sheets off paper went from 117 to 5, but render_f1 lost 46 and changed 84 (the structural A0 guess without Plot paper). **It needs the owner's #160 trade ruling** (below). With no ruling by its turn, it lands after loop-iou. Merge main (session 11 hit conflicts in the harness and buffers), round 1, posting run under the accept rule (its render_f1 loss needs the ruling as its "judged" reason), land. |
| 6 | **`loop-iou`** | scored loop 3: tighter view boxes | 2973a919, local (99abbf56 pushed) | +10 Edison / +23 Sample Views at ae25e64e; later heads unscored. Its PR body is written; it has not been reviewed. Push, PR, round 1, posting run (state the scored delta), land. |
| 7 | **xdist** (#248) | a database per worker and checkout; stable ids; the acceptance plugin aware of xdist; `tmp_path_retention_policy = "failed"` (#243) | — | An engine PR (`uv.lock`, `pyproject.toml`), last in the lane. Measured 1,276 s → 385 s at `-n 8`. **Cut first at +8 h.** |

Each landing is:
1. merge main;
2. CI, 8–13 min (read it with `gh pr view <n> --json statusCheckRollup`);
3. the posting run (`rdlock`);
4. `post-status` for the design gate, from an independent verdict;
5. `merge_ready`;
6. merge, pinned to the head.

Until the lander's fix lands, `land.sh` (above) runs steps 1, 2, 5 and 6; the posting run and the gate are yours
between them. A UI PR walks m0-screens §8 by keyboard before its PR, as the CLAUDE.md lesson says.

### Lane A, beside it: the reading-measures PR with J2 (local, high, a refuter; 2.5 h build, then the owner's re-run)
This is #249 together with #262. It contains:
- **Export-level G5:** `vextrus/takeoff/services/export.py` gains a counts-only `burden` block. The MEASURES in
  `scripts/real_drawings/diff.py` gain Questions per Discipline, the bulk-confirmable share, the one-source share,
  continuation Questions, plan Sheets with no storey, and proposed leave-outs. Each has Q5's limit.
- **S1's scorer diagnostics** in `tools/scorer/`, counts only: kind-confusion pairs, box-error direction, failing Views
  by class, and an `--agreement` mode for a second keyer.
- **S2's proxy**, new in `tools/proxy/` (not custody; it does not exist on main yet): its cache keyed by (content
  sha256, reader code hash), not by file path as the measured prototype did (18 s a candidate, warm).
- **J2, the Jev replay seam.** Jev answers are recorded outside the sandbox, keyed by the product's own cache key, and
  replayed inside the scored run. A miss answers `Unavailable` and is counted. No key enters the sandbox. Q24 asks
  the owner.

Once it merges, ask the owner **once** for the custody re-run (Q6). Q16's narrower cache key and J2 ride the same
re-run.

### Lane B, cloud (after the first hour's launches; the governor's ramp, 8 → 16 at once; 3–4 h, beside lane A)
In order. Every writer runs at high effort (Q20); a builder at medium, or at high for walls and hostile input.
1. **#257, the drawings environment** (~45 min). Route A's probe passed the clone at 21:52Z on 4 Oct: 17 files, 72 MB
   in 3 s, and the cloud Jev key is set. The ticket adds:
   - `scripts/cloud/session-start.sh`'s clone (never in `setup.sh`);
   - `launch.py --drawings`: an `rd/` branch, a prompt that forbids PR comments, and the `vextrus-drawings`
     environment. The environment was chosen with `--settings '{"remote":{"defaultEnvironmentId":"<id>"}}'` (proven
     once, by the probe, `.private/work/session-12/cloud/drawings-probe-213652.screen.txt`). `judge()` accepts that
     environment only for `--drawings`;
   - the watcher's scan of those PRs' comments and bodies.
   Its first launch is the one R2 is for.
2. **G2a's web half** (#250): fakes validated against the exported OpenAPI schema at test time. The web tickets after
   it are then not built on unchecked fakes.
3. **D7** (#232: an engine PR, plus the words gate), **#235** (split into 2–3 tickets) and **#236** (after #237). Their
   writers use G2a's validated fixture helpers.
4. **J1, the `view_subject` Jev node** (#261). It is an engine PR, so it owes a posting run. Its ~30-item spot check
   runs locally under the local key. Estimated +10–11 Edison and +2–3 Sample Sheets, as an upper bound. **Cut first to
   session 14** if the lock is full.
5. **Jev wiring:**
   - J-d (#258): `jev same-issue` in `/real-set-walk` and in cut-issue filing.
   - J-e (#259): leak advice beside the literal wall. It is **built locally** with the local key, before the first
     drawing-environment session.
6. **G2a's closed `Literal` keys** (an engine path) last. Cut it at +8 h if needed.
7. Only if the lane has room: #218–#224 and #239–#241.

Reviews run in-process through `/review-pr`. Cloud reviewers through the verdict file
(`uv run python -m scripts.ledger fetch-verdict <PR> --launch <record> --round n`) are tier 2: one trial first, and
only on a big diff.

### Lane B, drawings (3 h; their posting runs queue after lane A's)
D9 (#233: storeys on plain titles; a sheet's only plan proposed as a duplicate) and D10 (#234: presentation plans
proposed to leave out).
- Run them in the cloud in `vextrus-drawings` once #257 lands; until then, locally (at most 3 local agents in all).
  High effort, with a refuter.
- **Their `scripts/real-drawings --no-post` runs stay local under `rdlock`.** Nested bwrap fails in the cloud VM (the
  probe: `-m needs_bwrap` 78 passed, 1 failed nested, plus 3 errors setting up DWG reads through the job or CAD worker).
  Cloud builders run the engine directly on the sets.
- Up to 6 of Edison's 32 storey failures (and 1 of the Sample Project's 11) may sit on unconfirmed key values. So D9
  states its target against Q13's answer. It must not tune toward the key's open items.

### Lane C, reading (after Q13, from hour 2; the order of `research/bar-90.md` §2; each target stated before the work)
1. **S1, the key audit, with the owner** (~1 h). It needs Q13 answered.
   - `drawing-analyst` re-keys about 15 Sheets blind, **locally**, because no private return channel from the cloud
     exists.
   - The key user scores agreement in aggregate (`--agreement`, which needs #249). That gives the true ceiling.
   - **If two-keyer agreement comes back under about 97 % of Views,** 90 % of Sheets may be out of reach under today's
     box rule. Ask the owner to restate the convention before any further loop.
2. **The Sheet fields**, from S1's diagnostics: storeys, title, Discipline, then date. J3 (#264, storeys as a span
   choice) only if its 40-item probe beats the reader. Target: Edison all-six-right ≥ 205/217, Sample storeys ≥ 65/67.
3. **The 221 near-miss boxes** (overlap 0.5–0.8):
   - **S2:** proxy loops (#252), run in the cloud only if the private proxy key can reach the VM through the drawings
     repo; otherwise at most 3 local loops.
   - **S3:** the Plot PDF as a second source for text extents, Sample Project first (67/67 Plots match; Edison about
     135/217).
4. **Misses and wrong kinds:**
   - the J4 probe (#265: kind from the texts inside an untitled view's box);
   - **S4 only if Q8 is yes:** a 10-sheet Sample Project prototype with recorded responses, through Claude Code (the
     plan's quota), development-time only.
5. **Scored runs** only for heads that gain on the proxy: at most 4 (about 2 h of lock). At the +8 h cut, any beyond 2
   go first. In session 13, realistically S1 and the start of item 2.

### Lane D, gates (local; ~1 h + 3 × 60–75 min + ~1.5 h of fixes)
1. **Walk-expect: written and confirmed** (23:38Z and 23:40Z, 4 Oct). Owed: a `qs-critic` review of the two files, and
   Q5's limits written into them once Q5 is answered. They are never in git.
2. **J5** (#263, ~30 min, live, local key): re-measure `sheet_type` with view titles and per-Discipline options, and
   count its Question queue per Discipline. This is the measure behind D2 and Q5.
3. **Check 2's semantics** (blocker 4 above) and **#294** (blocker 2), before G1 #2.
4. **G1 #2** on main after lane A's first three merges (t-readlock, t228, t229; about hour 5).
   - Every BLOCKS finding becomes a fix ticket in this session.
   - Every other finding, of any severity, becomes an issue, or a comment on its open issue.
5. **G1 #3** on the next head (about hour 8). **G1 #4 is budgeted,** because `ready.py` needs the newer PASS on main's
   current product code. (G1 #1 was session 12's walk of 8b2b8d4df.)
6. A walk takes about 17 min for the script layer (G1 #1: 01:53Z to 02:10Z) plus the agent layer, and 5.6 GB
   (estimate). The governor refuses web tests, a full pytest and a second walk while it runs. Product merges freeze
   only while the **final** walk runs.

### The lock and the landing slot (over-subscribed: plan the cuts now)
- **Lock demand.** About 15–16 posting runs at ~30 min each, 7.5–8 h:
  - lane A: 6, plus xdist;
  - the reading-measures PR: 1;
  - lane B's engine PRs (D7, the `Literal` keys, about 1 of #235, J1): ~4;
  - D9 and D10: 2;
  - G1 fix tickets: 1–2.

  Lane C adds up to 4 scored runs (~2 h). That is about 9.5–10 h of lock in an ~11 h session. The first hour's
  tickets need no posting run unless one touches `pyproject.toml` or `uv.lock` (engine paths): keep them out of both.
- **Lock order:** lane A in order, then D9 and D10, lane B's engine PRs, the reading-measures PR, J1, and xdist last.
  Cloud `--no-post` relief does not exist yet (nested bwrap). Q16 would cache more.
- **Cut first at +8 h:** xdist, J1 (to session 14), G2a's `Literal` keys, then lane C's scored runs beyond 2.
- **Landing slot:** about 30 PRs (the first hour's ~8 and lanes A and B's ~23) × ~13 min ≈ 6.5 h, one at a time on
  one main. Q21 keeps "branches must be up to date".

| Lane | Work | Where | Budget (estimate) |
|---|---|---|---|
| First act | clock, governor, questions | orchestrator | ≤ 30 min |
| First hour | #306, #307, #303, #310, #311, #308, #309, R1 and R2, #312 (the lander), #313 | cloud (high, refuters) + the owner | launched by 0:30; landed by ~2:30 |
| A | #237 → t-readlock → t228 → t229 → t160 → loop-iou → xdist | orchestrator + lock | ~5 h |
| A, beside | the reading-measures PR + J2; then the custody re-run | local, high, a refuter | 2.5 h + the owner's re-run |
| B, cloud | #257, G2a (web), D7, #235, #236, J1, J-d, J-e (local), `Literal` keys | cloud (ramp 8 → 16) | 3–4 h, in parallel |
| B, drawings | D9, D10 | `vextrus-drawings` cloud, else local | 3 h |
| C | S1 (with the owner), Sheet fields; ≤ 4 scored runs | local | S1 ~1 h; loops ≤ 3 h; ~2 h of lock |
| D | walk-expect review, J5, check 2, G1 #2–#4, fix tickets | local | ~1 h + 3 × 60–75 min + ~1.5 h |
| Landing | ~30 PRs | orchestrator (`land.sh` until the lander is fixed) | ~6.5 h |
| Close | scored run, report, handover, "walk now" only if Part 1 holds | orchestrator | 0.5 h |

## Finish line (session 13 is done when each holds, with a tool result)
*Part 0, the factory's debts:*

0. The first hour's tickets (#306, #307, #303, #310, #311, #308, #309, #312 and #313) are merged, each with a check
   that fails on its class, or each not merged is named with its reason; R1 and R2 are answered by the owner.

*Part 1, the walk-ready product. All must hold before "walk now".*

1. The six carried PRs are merged in order, or each one not merged is named with its reason.
2. D1–D10 are each closed by a merged PR with a check on main (D4 per the #160 ruling). D7, D9, D10, #235 and #236
   are merged, or each is linked to an open issue with a reason.
3. `uv run python -m scripts.walk.ready origin/main` exits 0. That means two passing G1 walks in a row, the newer on
   main's current product code, with G5 within Q5's limits (or each excess reported, if Q5 is open).

*Part 2, the reading, reported and not claimed:*

4. One scored run on main's last head, stated against the 90 % bars, **196/217, 666/739, 61/67, 376/417**, with each
   gap in Sheets and Views and the 80 % marks (174, 592, 54, 334) beside them.
5. S1's ceiling: Q13 answered and the two-keyer agreement measured by the key user, or named open with its reason.
6. The seams merged or filed as issues: the proxy re-keyed by content and code hash, J2, and the scorer diagnostics.
   J1 merged, or filed for session 14.
7. The plan for sessions 14+ is in milestone issue #45, each phase with its target (`bar-90.md` §5):
   - session 14: the Sheet fields, and J1 if not landed;
   - sessions 15–16: the near-miss boxes;
   - sessions 17–19: misses and wrong kinds;
   - session 20 onward: the tail, against a held-out set.

*Every part:*

8. Every cut and every walk finding is an issue.
9. Only then is the owner told "walk now", with the reading gap stated beside it.

## The close: G1 twice, then the owner's walk
1. **Governor, then the head:**
   `uv run python -m scripts.factory.governor check walk`, then `git rev-parse origin/main` (the full 40-hex sha).
2. **Start the script layer detached** (`run_in_background`; its output kept in a file):
   `uv run python -m scripts.walk.run <sha40> > .private/work/session-13/g1-<sha8>.log 2>&1`.
   - It takes `g1.pid` and serves that head from `.private/work/walks/_src`, with database `vextrus_walk_<sha8>` and
     two free ports.
   - It uploads both Development Sets through the UI, runs the three measured checks against
     `.private/work/walk-expect/`, and writes `walk.json`.
   - It appends `WALK …` lines to `events.log` and holds the stack (and `g1.sign-in`) for the agent layer.
3. **Wait** with Monitor on `events.log` until `WALK - <sha8> done …`. Never wait with a `pgrep` loop (the guard
   refuses it).
4. **Run the agent layer:** `/real-set-walk <sha40>`.
   - `ux-critic` and `qs-critic` walk M0-FL1–FL11 and FL13, each on its own browser page selected by URL.
   - Triage drafts issues from `sanitize.py`'s allowlisted fields only (`scripts.walk.issues draft`), deduped on
     (class, screen) against open `walk` issues.
   - Each draft is leak-scanned, then `verdict.json` is written under `.private/work/walks/<sha40>/`, and run.py stops
     the stack.
5. **Repeat on the next head.** Then check readiness with `uv run python -m scripts.walk.ready origin/main`: exit 0
   means ready.
6. **Run one scored run on main's last head.** Write the Part 2 report in #45: counts, gaps and the plan.
7. **Run the leak scans:** `uv run python -m tools.leakscan bodies --since <session start, UTC>`, and `uv run python -m
   tools.leakscan dir .private/work/walks/<sha40>/public` for each walk.
8. **Tell the owner "walk now"** with both verdict paths, the burden numbers and the reading gap. The walk-gate hook
   blocks the words without `ready.py`'s exit 0.

   Then write session 14's brief: M0's reading plan, or M1's preparation after the owner's walk. At M0's close the
   owner rotates the drawings token (O9 step 4).

## Owner questions still open (ask one at a time; recommendation first; the default stands until answered)
Ask only what STATE.md does not already answer. The walk-expect counts were answered at 23:40Z on 4 Oct.

| Q | Recommended default | Reason in a line |
|---|---|---|
| **R1**, a classifier rule for the committed launcher (**ask first**) | yes: the owner adds a plain-sentence rule saying that `uv run python -m scripts.factory.launch cloud\|local\|say …`, run from `/home/riz/vextrus-cubit`, is the project's reviewed launcher and may run | the launcher leak-scans every prompt and judges every launch; a denial today costs an owner `!` round trip per launch |
| **R2**, a classifier rule for the drawings environment | yes, once #257 lands: a rule saying a cloud launch into `vextrus-drawings` through `launch.py --drawings` sends the Development Sets only to the owner's private `vextrus/vextrus-drawings`, as Q7 allows; until then such launches stay the owner's `!` | the classifier read the probe's launch as data exfiltration; Q7 already allows it, and only the reviewed path should carry it |
| **Q13**, the Answer Key conventions | Answer before any reading loop: turned title blocks; the slab-detail kind (keyed differently in the two sets); Edison's 6 storey Sheets (33 storeys open); the box convention for notes. Then measure two-keyer agreement. *Unanswered:* no reading loop; S2 only on classes the conventions do not touch (box boundary, Sample Project first) | loops otherwise tune toward an inconsistent key; 48 of 57 missed Edison title blocks follow one keying pattern |
| **Q5**, burden limits | ≤ 3 open Questions per Discipline after proposals; ≥ 80 % of Sheets bulk-confirmable per Discipline; 0 false continuation Questions; act p95 ≤ 1 s while a read runs; every plan Sheet states its storey | G1 and G5 need numbers to pass or fail (walk-expect holds these defaults now). The continuation limit needs #294 before G1 can pass check 3 |
| **Q17**, a custody views-only scored mode for loop candidates (never for posting or the reported score) | Recommend **yes**: ~30–60 scored heads an hour against ~2 (estimate). *Unanswered:* no; your 30 Sep ruling "the job is the scored reader" stands | at ~2 an hour, the ~150 Sheets 90 % needs cannot be tuned against the real key |
| #160's render_f1 trade | accept, with the reason "outlines on paper", if G1's outline check passes on both sets; otherwise t160 lands after loop-iou | Sheets off paper 117 → 5 is what the QS sees |
| Q24, Jev answers recorded and replayed inside the scored run (J2) | yes: keyed by the product's cache key; a miss is `Unavailable` and counted; no key in the sandbox; rides the one custody re-run | without it, every Jev gain scores 0 |
| Q16, a narrower posting cache key (the job's import closure) | yes, in the same custody re-run | the lock is over-subscribed; it would have saved ~1.4 h of lock in session 11 |
| Q23, drawing text to Jev from cloud sessions (amends ADR 0013) | yes, once the cloud key has a spending limit (the key is set: probe 21:52Z; the limit is unknown); until then such calls stay local | your Q7 lets cloud sessions read drawings |
| Q8, the S4 vision prototype | development-time only: a 10-sheet Sample Project prototype through Claude Code after S1; inside the product it would amend ADR 0011, decided after the prototype | the only strategy aimed at the 209–258 Views rules miss or mis-kind |
| Q6, custody re-run cadence | one batched re-run per wave; in session 13, after the reading-measures PR | the re-run is root and your hands |
| Q21, landing throughput | keep "branches must be up to date"; budget ~6.5 h of landing; a merge-queue trial later (#279) | changing the ruleset mid-milestone risks main's green |
| Q22, account B as a second usage pool | not yet: the week projection for session 13 is ~71–78 % (85 % only at Phase 3's peak rate for 11 h). Ask once if the measured rate under the 16-session ramp projects past 85 % | A's orchestrator cannot message B's cloud sessions |
| Q12 (App-pinned statuses), Q14 (stay public with the leak wall), Q15 (no client walk counts leave `.private/`), Q18 (ultrareview: free runs only), Q19 (no corpus secret in CI) | as written in `docs/specs/factory.md` §7 | — |

## Laws that do not change (CLAUDE.md, ADR 0041, ADR 0042; the guard enforces most)
- **Real drawings** and everything derived from them stay under `.private/`.
  - The two Development Sets may reach cloud sessions **only** through the `vextrus-drawings` environment (route A, the
    owner's Q7).
  - Held-out Sets never leave this machine.
  - No drawing text in a commit, issue, PR, workflow file, mod, agent memory or cloud prompt.
  - The posting and scored runs, the scorer's keys and the G1 gate walk stay local.
- **The repository is public.**
  - Every push from the main checkout needs the leak stamp for its exact head (`tools.leakscan range`), and the
    pre-push hook scans it again. Every `gh` body goes through `--body-file`, scanned first with `uv run python -m
    tools.leakscan file <f>`, and the `gh` write runs alone in its call.
  - Only verdicts and counts leave `.private/`.
- **Never** print a secret; never delete recursively (the owner runs `! rm -rf …` or `scripts/owner/clean.sh --yes`);
  never rewrite history or force-push; never skip hooks; never stage everything; never change the ruleset or branch
  protection; never admin-merge; never use PowerShell; never edit permission settings or classifier rules (R1 and R2
  are the owner's).
- **Merges** happen after the review loop: at most two rounds, recorded in the **local** ledger (a PR comment is never
  the record). Then green required checks and `merge_ready`. Gates are posted only through `post-status` from the
  main checkout, from an independent verdict.
- **Acceptance tests come first,** from `acceptance-writer` at high effort (Q20), with red/green counts. Builders never
  change them. Only the orchestrator amends one, in a one-path, lint-clean `acceptance:` commit.
- **No "walk now" without `ready.py origin/main` exit 0.** Every walk finding and every cut becomes an issue.
- **Jev advises; it never decides a gate.** READY/BLOCKED is an exact trailer. Drawing text goes to Jev only from local
  steps, under the owner's local key, until Q23.
- **The owner decides** product, scope, spend and anything irreversible: one question at a time, your recommendation
  first with its reason in a line.
- **Every serious finding** (a score of 50 or more, or any repeated class) leaves a committed check. **Changing the
  guard** is a hostile-boundary ticket: high effort and a refuter.
- **The machine:**
  - at most 3 local agents;
  - the governor's floors (30 GB of disk, 2 GB of swap, memory at 80 %);
  - no web-test run locally while a walk or a real-drawing run is up;
  - every suite's output kept in a file under `.private/work/` (pytest with `-rf`).

## Operating lessons from session 12 (use them)
- **Amend acceptance tests only through a lint-clean, one-path commit.** Use `git commit -- <path>` with the
  `acceptance:` prefix and the counts. Before committing, run `uv run ruff check . && uv run ruff format --check .`,
  `uv run mypy` and `uv run python -m tools.lint.acceptance origin/main HEAD`.
  - Twice in session 12 the orchestrator's own amendment broke CI: E501 on #286; E501 and SIM300 on #287. After the
    rule, ae8fdd97c and 547ab2c13 ran ruff, format and mypy first and passed. The class still owes a check (the first
    hour's "also owed").
- **Pin every time a test compares with a commit's time.** f5's tests pinned verdict times and made commits at the wall
  clock; they went red 10 min after the pinned time. Pin the commit dates too (`GIT_COMMITTER_DATE`), or use relative
  times (#308).
- **Never SendMessage a running workflow agent.** It starts a second copy: two measures strands ran twice, and one
  overwrote the other's file. Wait for the workflow, or stop it and relaunch (#309).
- **The CLI's unknown-environment fallback picks the first environment, `vextrus-drawings`,** which carries the
  drawings token. `launch.py` judges every log and refuses `wrong-environment`. A drawing launch chooses its environment
  explicitly (#257).
- **Drawings reach the cloud only through the `vextrus-drawings` environment.** Its sessions are told not to comment on
  PRs. The watcher and `merge_ready` scan their PRs, because built-in GitHub tools post outside Bash and the guard never
  sees them.
- **Nested bwrap fails in cloud VMs.** The 3 tests that read a DWG through the job or the CAD worker errored there too.
  So the real-drawing check and those tests run locally only.
- **The leak wall in practice.**
  - The exact scanner form is `uv run python -m tools.leakscan <command> …` with nothing else in front, alone in its
    call; the guard refused a `build` line that had more, and a heredoc that merely names the scanner (#307).
  - A stamp covers only the head it scanned: any new commit needs a new scan.
  - Push from the main checkout only (#306). After merging main into a branch, the hook re-scans main's public commits
    (#306); a hit on a generic string there is allowlisted by hash in a one-line PR (#304, #305).
  - The corpus absorbs what sits in the private notes, a builder's invented test literals among them (#311); G1's
    `walks/_src` is skipped (#297, fixed).
  - The guard refuses some reads that merely name the scanner, the ledger or `core.hooksPath` (#307). List one folder
    at a time; never route around a refusal.
- **Cloud red proofs vanish with the VM.** Session 12's cloud-built checks had no reachable red output until they were
  regenerated locally (`phase4/red/INDEX.md`). A cloud builder commits its red run's output summary in the PR body
  with counts, and the orchestrator re-runs one red proof locally per tier-1 check.
- **Check that "filed" is filed.** Two issues reported as filed did not exist (#286's round 2, #305's body); they are
  now #310 and #311. Cite the issue number, never "filed".
- **CI is sharded: 4 python shards, about 7–8 min.** Budget 10–13 min per landing.
  - Read checks with `gh pr view <n> --json statusCheckRollup`; `gh pr checks` has no `--json` here (gh 2.45).
  - `merge_ready` refuses a PR that touches any web file without a `design-gate` status, even test files. Get a
    words-only `ux-critic` verdict and post "not applicable" (#286 and #293 did).
- **The auto-mode classifier refused** writing the cleanup script and launching the drawings probe (as data
  exfiltration). Never route around it: the owner ran both with `!`. R1 and R2 are the owner's fix.
- **The guard's SECRET_PRINTED fired** on a heredoc prompt that only named the token variables. Write prompts to a file
  with the Write tool, then use `--prompt-file`.
- **All test runs in one checkout share one test database.** `--create-db` is a no-op. A killed parallel run left rows
  that broke another agent's run. For a clean run, set `VEXTRUS_DB_NAME=vextrus_<name>`; xdist (#248) fixes it for
  good. The throwaway `vextrus_s12ci_*` and `vextrus_walk_*` databases are the owner's to drop (`clean.sh` lists them).
- **The cloud VM:**
  - it has 4 vCPU, 15 GB and no swap, and setup takes 278 s of the ~300 s cache budget (#254);
  - web tests need `export_openapi_schema`, `api:types` and `typecheck` (routes) first;
  - `dates.tz` and `test_post_status`'s root-user test fail there for VM reasons (it runs as root), not code;
  - `launch say` messages act 1–3.5 min later;
  - a refused launch keeps running: STOP is sent, and the owner deletes it (O8).
- **Wait on events, never on `pgrep -f`** (the guard refuses it). Use Monitor on `events.log`, `notify_when_idle` for
  local builders, and `run_in_background` for long runs.
  - Resume a local builder only by its full session id (`scripts.factory.say`). A `done` session is alive:
    SendMessage it.
- **Stamp times with `scripts.factory.stamp` or `date -u`; never estimate them.** Every launch's record and agents
  snapshot go under `.private/work/factory/launches/` (the launcher's default). Session 12's went under
  `session-12/launches/`, so the watcher never saw them and its Monitor expired silent.

## Phase 4's results (session 12)
**f1's cycle, the first cloud ticket** (`.private/work/session-12/phase4/f1-cycle.md`). Spec budget: write 25, build
60, review 20 min; planned to land at T+150 (T0 = 21:08:14Z, 4 Oct).

| Step | UTC (4 Oct) | From the writer's launch |
|---|---|---|
| Acceptance writer launched (cloud, Opus high) | 21:39:43 | 0 |
| Acceptance pushed (ba8fdf5b1; 46 red / 46 green) | 22:00:06 | 20 min |
| Builder launched (cloud, Opus medium) | 22:00:23 | 21 min |
| READY 13aa4aa3c → PR #286 | 22:16:23 | 36 min (build 16 min against 60) |
| Review round 1: FIX, 3 launcher findings (70, 55, 55; 62, 50, 50 after the refuters), each confirmed | 22:27:18 | 48 min |
| Fix round 1: BLOCKED on a fixture → the orchestrator's amendment 80508bb6e | 22:37:53 | 58 min |
| Fix round 1 READY e73e08698 | 22:42:14 | 62 min |
| Review round 2: the builder's fixes verified; the only blocker (75) was the amendment's E501, fixed in 8c30eb4d7 | 23:04:02 | 84 min |
| Main merged in (0ae8bb3c1); sharded CI | 23:04:30 → 23:12:34 | CI 8.0 min (median before: 24.6) |
| design-gate "not applicable" (independent words-only `ux-critic`; test files only) | 23:20:47 | |
| MERGED d5ddca0f5 | 23:21:23 | **102 min**; T+133 (planned T+150) |

The dogfood: f7's builder was launched through f1's merged `scripts.factory.launch cloud` at 23:21:48Z, was READY at
23:30Z and merged at 23:53Z after two rounds. Finish line 3 of session 12 was met.

**All 13 PRs** (`phase4/measures.md` §1–§2): launch to merge against budget, per PR: f1 102/105 min, f2 184/195, f3
119/210, f4 215/180, f5 252/225, f6 226/210, f7 133/105 (89 min of it the planned hold for f1), f8 58/100, f9 110/80.
Phase 3 ended at T+285 against T+330. A builder's launch to its READY took 9–80 min (f5's 80 the longest).

**G1's first run on main**
- Head: 8b2b8d4df (main after #293). Started detached at 01:53:27Z (5 Oct), `--hold-minutes 120`; the governor said
  OK walk. Outputs under `.private/work/walks/8b2b8d4dff733596fd7a0869c78ebd6bf7cd22c4/`.
- **The script layer finished at 02:10Z: FAIL**, as it had to with D1 and D2 on main (`WALK - 8b2b8d4d done FAIL` in
  `events.log`). The red proof holds.
  - Edison: reads complete FAIL (6 files done and 1 held, of 7); act p95 FAIL (acts took 1.7–5.9 s against 1 s);
    Questions per Discipline FAIL: structural 29, architectural 43, electrical 27, plumbing 10 (limit 3);
    bulk-confirmable 20/57, 0/87, 0/40 and 0/28 (limit 80 %).
  - Sample Project: reads complete PASS (4/4); act p95 FAIL (0.7–1.9 s); Questions FAIL: structural 20, architectural
    3; bulk-confirmable 0/38 and 29/29.
  - `walk.json` marks no act as `during_read` (blocker 4).
- run.py's hold and the critics' sign-in file both ran: the stack stayed served for the agent layer, and `g1.sign-in`
  was written.
- **The agent layer** (`/real-set-walk`, the first real run of a committed factory workflow) started at 02:10:59Z. Its
  verdict (`verdict.json` in the folder above), its ranked list (counts, defect classes and screens only, never drawing
  text), the `walk` issues it filed and the leak scan's count over its `public/` folder (must be 0) go here:

- **Verdict: FAIL** (02:39Z), as T7's red proof requires. Finish-line items M0-FL1, FL2, FL3 and FL11 PASS; FL4, FL5,
  FL6, FL7, FL8, FL9, FL10 and FL13 FAIL. 38 findings: 14 BLOCKS, 13 misleading. The leak scan over its `public/`
  folder: 0 hits (507 lines); over every issue and PR body edited since 02:00Z: 0 hits (817 lines).
- **Ranked list** (the walk issues it filed; closed defect classes and screens only):
  - BLOCKS: #317 read_quarantined (drawing-set, FL4); #315 too_many_questions, #318 storeys_wrong, #334
    false_continuation (takeoff.step1, FL5); #314 misleading_display (takeoff.step1.sheet, FL6); #316 views_left_over
    (takeoff.step1, FL7), #335 views_left_over (status-bar, FL7), #336 proposed_exclusion_wrong (takeoff.step1.views,
    FL7); #320 not_bulk_confirmable (takeoff.step1, FL8), #333 too_many_questions (takeoff.step1.questions, FL8); #322
    misleading_display (takeoff.step1, FL9).
  - Other: #337 act_waits_on_read and #319 slow_screen (FL8); #321 false_continuation, #330 key_missing, #332 other
    (FL5); #324 number_wrong (FL7); #326 report_missing, #327 other (FL4); #331 cancel_restart_broken (FL3); #328 other
    (FL1); #323 misleading_display (members, FL10); #325 data_shape_mismatch, #329 words_wrong (FL13).
- Read with the script layer above: D1 (acts wait on reads) and D2 (the Question flood) still hold on main, because
  their fixes ride the carried branches (t-readlock, t228). Triage the 24 issues against D1-D10 first; many are the
  same defects measured.

This list is lane D's and lane B's input.

**The week's usage** (`phase4/measures.md` §4)
- Readings: week 27 % at 17:55Z (4 Oct), 44 % at 23:21Z, **47 % at 01:56Z (5 Oct)**; the watcher's `usage.log` held
  47 % from 00:27Z on. The week resets on 9 Oct at 08:59Z (14:59 Dhaka).
- Rates: 2.49 points/h on average over session 12's 8 measured hours; 3.13/h through Phase 3's launches (up to 7 cloud
  writers at once, the peak); 1.16/h while landing and reviewing. Session 12 used at least 20 points.
- **Projection for session 13: ~71–78 % of the week** (the same 20 points as session 12 gives ~71 %; 11 h at the
  average rate ~78 %; 11 h at Phase 3's peak ~85 %). Session 13 fits with no extra usage, so Q22 is not asked now.
- Unmeasured: "% per builder-hour" (the governor's `--rate`), and any rate with more than 7 cloud sessions at once. If
  the ramp to 16 doubled the peak rate (6.26/h, an estimate), the week would run out after ~7.8 h: record the rate at
  8 sessions before ramping further.

**The rest**
- **Tier-1 red proofs, regenerated locally** (`phase4/red/INDEX.md`): every tier-1 acceptance file is red at the base
  and green at the merge. f1 42/42 (plus 1/34 web); f3 138/138; f4 150/150; f6 130/156, plus the after-bash mutation
  6/14; f8 8/8 and 4/5, and its kit tests. f2's and f5's red outputs are cited on their PRs (`f2/`, `f5/red/` under
  session 12's folder).
- **The first committed `/review-pr` run:** none in session 12. f4's ledger holds 3 records written with `scripts.ledger
  record` from the interim reviews (#284 round 2, #293 rounds 2 and 3), each with its marker comment.
- **`jev.log`:** 1 call, the watcher's daily `models-check` at 23:41:31Z (ok, 379 ms, 290 input tokens, cache miss).
  Cost is not logged. Jev's review triage never ran.
- **Harness net:** +31,778 / −411 summed over the nine code PRs; every one grew, none is net negative, and at least
  12,023 of the added lines are acceptance tests. "Remove as much as it adds" was not met.
- **Unmeasured:** the PONG round trip by SendMessage to a cloud session (Remote Control's two-way path); whether "You
  should know" is still on.

## Skills, tools and agents
- **Agents** (models pinned in frontmatter):
  - `builder` (the contract);
  - `acceptance-writer` (high);
  - `pr-reviewer` and `refuter` (Opus, high);
  - `ux-critic` and `qs-critic` (G1's critics; they cannot edit);
  - `drawing-analyst` (local, for S1's second keyer and any change to walk-expect);
  - `Explore` on Sonnet 5.5 for look-ups.
- **Workflows:** `/review-pr` (the review loop with refuters and the ledger) and `/real-set-walk` (G1's agent layer).
  `workflow-authoring` before writing any new one.
- **Skills:**
  - `orchestrate-wave` (the runbook), `verify`, `real-drawings`, `product-review`;
  - `tdd` and `diagnosing-bugs`;
  - `to-tickets` (for #235's split and G1's fix tickets), `research`, `domain-modeling` (ADRs: Q23 amends 0013; S4 in
    the product would amend 0011);
  - `writing-for-agents` for every agent or skill edit;
  - `typesafe:typesafe-ai` for J1, J3, J4 and J5.
- **MCP:** `chrome-devtools`. Select your own page by URL before every action; per-page viewport emulation only.

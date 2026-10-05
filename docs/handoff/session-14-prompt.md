# Session 14: rebuild the factory to be fast and lean (Part A), then sweep M0 to its walk (Part B)

## Starting the session (the owner)
1. In a WSL terminal: `cd ~/vextrus-cubit && git pull`, then `df -h /` and `free -g` (keep 40 GB free; 69 GB were free at the
   close of session 13). Check https://www.githubstatus.com: session 13 ended inside a GitHub Actions outage, and nothing lands
   while Actions is down.
2. Start the orchestrator with `scripts/factory/orchestrator.sh`. **Plain Opus 5.5 at `medium` for the whole session; no
   Ultracode, never `xhigh`** (your instruction of 5 Oct 2026). Then say: "Read docs/handoff/session-14-prompt.md and run it."
3. Keep the pane open. The session asks you, one at a time, the questions in "Owner questions" first (the first two decide the
   rules everything else is built under), then:
   - after #443 (T-W317) lands: `! cd ~/vextrus-cubit && git pull && sudo bash scripts/owner/toolchain.sh`;
   - after the Q16 redesign and T-249 A land: `! cd ~/vextrus-cubit && git pull && sudo bash scripts/owner/keys-custody.sh`.

---

You are the orchestrator of session 14. **Part A rebuilds the factory with what session 13 measured, so that a PR goes from READY
to merged in minutes, at a fraction of the tokens, with no dynamic workflow and with Sonnet 5.5 doing most ordinary work. Part B
then sweeps every remaining M0 ticket and takes G1 to PASS twice on main, so the owner can walk M0.** M1 starts in session 15.
Part A takes about 5 hours and is not skipped for product work. No "walk now" without `uv run python -m scripts.walk.ready
origin/main` exit 0.

## The owner's intent (verbatim, 5 Oct 2026)
- 19:12Z: "this session-13 is the learning/verifying/measuring-performance of the factory … we'll attempt to work on the factory
  harness fix, optimization on the next session-14 first before starting working on our main product to finish off M0 … with our
  powerful fixed, optimized factory harness orchestrator we'll be able to finish all remaining tickets, issues, tasks for M0 100%
  completion and ready for walk M0 with highest production grade clean code quality … and from session-15 we'll be able start
  working on M1"
- 21:24Z (CI): "in session 14, just build A and no need of others; so we've to make the workflow basically faster and smoother
  that will bring most of the quality results"
- 21:25Z: "the review-pr workflows usually take so much time and consume too much tokens … if we have any alternative better fast
  solutions for pr-review without dynamic workflows and without the Ultracode as I intend to run the factory orchestrator on plain
  Opus 5.5 default medium mode and or we can run it on high … but not xhigh Ultracode dynamic workflow … Also incorporate Sonnet 5.5
  in the factory workflow replacing some of Opus 5.5 sessions … saving both token consumption and fast delivery with production
  grade highest code quality … Also previously you didn't leverage any Claude Mode UI implementation … status bar and other things
  for me in the bottom that can be done with mods easily, that should be attempted on session-14 … upon the completion of executing
  the factory fix, upgradation and optimization we'll sweep of all remaining tickets, issues for M0 walk."
- 21:28Z: "we'll walk after session-14"

## Read first (delegate long reads to Sonnet `Explore` at low; keep your context for decisions)
All under `.private/work/session-13/close/` (private, this machine):
- `factory-next.md`: **the Part A plan** (target state, model map, review design, mods, cloud, the ticket list, a checker's notes).
  Its research files are in `research/` (changes, mods, review, models, cloud, critic), each with official sources.
- `measures.md` (session 13 in counts and minutes), `friction.md` (13 ranked frictions), `m0-remaining.md` (every G1 #1 failure
  mapped to its PR or ticket; the waves for Part B).
- `.private/work/session-13/STATE.md` (every stamped line, the owner's rulings) and the ledger
  (`.private/work/factory/verdicts/`); this brief's Handover section is newer than RESUME.md.
- Issues `gh issue list --label factory --state open` (#448-#463, #466): Part A's tickets reuse them (`factory-next.md` §7 says which
  survive, merge, change or die).

## What session 13 measured (the numbers Part A must beat)
- 9 PRs merged in about 11 h (#414 #415 #422 #433 #438 allowlists and docs; #237 the demo seed; #419 the words lint; #417 lands when
  CI returns); 7+ closed at the review cap; about 13 open at the close. G1 walks run: 0. The reading did not move (#45: Edison
  Sheets 45/217 against a bar of 196).
- Review is the biggest cost: 43+ reviews, median 27 min, p90 75 min; 8 agents and roughly 250k-560k subagent tokens each.
  Refuters added about 28 min and refuted 3 of 79 findings. The classifier refused the LLM Record step 8 of 40 times; reviewers were
  refused 138 times running tests (the brief contradicts the guard).
- Builders hand in defects: 7 of 22 first rounds passed (5 of those were allowlist or docs). 11 BLOCKED (8 acceptance-test defects,
  3 one root-only test in cloud containers). Cross-PR breakage was found late, by reviewers.
- Too much in flight: 16-18 open PRs on the same hot files (`step1.py`, `proposals.py`, `views.py`, `model.ts`, `en.po`).
- The watcher missed a READY (2 h 20 min idle) and, across a compaction and a power cut, 11 READY or BLOCKED states.
- CI: jobs cancelled after 15 min in the Actions queue under load, then a GitHub Actions outage from about 20:55Z.
- What worked and stays: acceptance-first with `scripts.factory.amend` (red and green counts), `scripts.land` + `merge_ready`, the
  leak wall, the real-drawing lock and accept rule, the event log + Monitor, the governor's floors, the guard's hard walls.

## Part A: the factory (first; about 5 h)

### The target (from `factory-next.md` §2)
A builder's last commit carries `Factory-Verify` and `Factory-State: READY`, read by one shared trailer reader. CI (now light) is
green first. The orchestrator runs one background command, `uv run python -m scripts.factory.review run <PR>`: code resolves the
head from the PR (nobody types a sha), checks the round, refuses a red-CI head, claims a slot under a lock, makes a read-only slot
plus a runnable `rv<N>` worktree, runs the mechanical passes, and picks a tier (allowlist-only or docs-only: no model; small: one
lens; normal: two lenses as headless `claude -p` processes with a JSON schema; the words lens when `web/src/messages/**` changed).
Code replays each finding's failing test; one batched Sonnet refuter handles the rest; code writes the verdict and records it in the
ledger. Target: **10-16 min and 120-250k tokens per normal PR** (estimate), allowlist or docs PRs about 1 min and no model.

### Models and effort (owner question 1 approves the CLAUDE.md text in `factory-next.md` §3)
| Role | Model | Effort |
|---|---|---|
| orchestrator | Opus 5.5 | `medium`, the whole session (one effort keeps the cache); never `xhigh`, never Ultracode |
| acceptance-writer | Opus 5.5 | high (the owner's Q20) |
| builder, ordinary ticket with committed tests | Sonnet 5.5 | medium (high when long or multi-module) |
| builder, hard ticket (drawing reading, hostile input, guard, ledger, security wall) | Opus 5.5 | high |
| review lens A (depth), qs-critic, drawing-analyst, ux-critic browser walk | Opus 5.5 | high |
| review lens B (adversary), refuter, ux-critic words | Sonnet 5.5 | high |
| Explore, look-ups, log reading | Sonnet 5.5 | low |
| round check, slot, Record, watchers | scripts | none |
Evidence and prices are in `research/models.md` (Sonnet 5.5 leads Opus 5.5 on Terminal-Bench 4.0, 70.6 % against 66.4 %, at half the
token price; Opus leads on the hardest long-horizon work). The first three ordinary Part A tickets are the Sonnet pilot; kill switch:
if first-round PASS or findings per PR is clearly worse than session 13's, builders go back to Opus medium. `builder.md` gains
Anthropic's "keep working until everything asked is done" and "run a real check" paragraphs. Set effort explicitly everywhere.

### The mods UI (the owner's terminal)
Mods need Claude Code 2.1.287+ (local is 2.1.289), are not sandboxed (ours stay read-only), and run commands with no model turn.
First prove the existing band loads (`claude --plugin-dir tools/mod/vextrus-factory`; `/plugin` shows it). Then: the status line
(WIP against the cap, reviews running, the last review's cost, elapsed against budget), a band with the last high-signal events
(READY, BLOCKED, LEAK-HIT, BUDGET, CI red), toasts for anything the owner must act on (a ruling, a `!` command), and a `/factory`
pane plus a `/wip` command (Builders | Reviews | Lock | PR queue) that answer status questions without a model turn. No button that
submits a prompt; no prompt-blocking gate. Use the `plugin-authoring` skill; `claude plugin validate` and `node --test` with mocks.

### The tickets, in order (detail, sizes and acceptance checks: `factory-next.md` §8)
| # | Id | Title | Builder | Closes |
|---|---|---|---|---|
| 0 | S14-A0 | Probes (a note, no PR): band loads; `claude -p --agent --json-schema --allowedTools --permission-mode dontAsk` works under our guard (and whether lenses load our mod); `/code-review` and `id -u` in a cloud session; cloud setup time | orchestrator + two Sonnet low agents | none |
| 1 | S14-M1 | Model and effort map in agent files, `launch.py`, `orchestrator.sh`, `builder.md` | Sonnet 5.5 medium (pilot 1) | none |
| 2 | S14-F1 | One trailer reader for watcher and gates; LOCAL-IDLE alarm | Sonnet 5.5 medium (pilot 2) | #448 |
| 3 | S14-F2 | Root-only tests: skipif, `flaky-root.txt`, a lint | Sonnet 5.5 medium (pilot 3) | #450, #397 |
| 4 | S14-R1 | `review.py` core, no model: head from the PR, round check, red-CI refusal, slot lock, `rv<N>`, tiers, Record by code, cost log | Opus 5.5 high | #452, #406, #420 |
| 5 | S14-W1 | WIP cap 5 and at most 2 per hot-file area in the governor | Sonnet 5.5 high | #455 |
| 6 | S14-R2 | `review.py` lenses: `claude -p` runners, replay, batched refuter, fix messages from the verdict, `--where cloud` | Opus 5.5 high | #453, #342 |
| 7 | S14-AL | `acceptance-lint`: imports, mypy, red for the stated reason on main, passes as non-root, ruling register, union of open tickets | Opus 5.5 high | #458 |
| 8 | S14-S1 | `state.py`: the open-work table from tools, not memory; RESUME generated | Sonnet 5.5 medium | #449 |
| 9 | S14-B1 | Builder self-review before READY: checklist, `/code-review medium`, cross-PR merge-tree and test run | Sonnet 5.5 medium | #454 |
| 10 | S14-U1 | Mod: band, event feed, toasts, status-line fields | Sonnet 5.5 high, local | #366, #283 |
| 11 | S14-R3 | Replay gate and cutover: `review.py` on 12+ session-13 heads, recall at least 90 % of confirmed findings; then delete `review-pr.js`, the prechecked fork and the skill | Sonnet 5.5 high, local | #368 |
| 12 | S14-G3 | Guard replay table; narrow false positives only | Opus 5.5 high | #451 |
| 13 | S14-L6 | `land update`, `land order`; wait for the new head's CI | Sonnet 5.5 medium | #456, #398 |
| 14 | S14-P7 | `publish.py`; watcher auto-`say` on LEAK-HIT; allowlist batch tool | Sonnet 5.5 medium | #457, #461, #412 |
| 15 | S14-C14 | Less CI load (A only): cancel superseded runs, heavy jobs only on READY heads, path filters inside the always-running `ci` job | Sonnet 5.5 medium | #466 |
| 16 | S14-U2 | Mod: `/factory` pane, `/wip` command, spinner elapsed/budget | Sonnet 5.5 high, local | none |
| 17 | S14-D1 | ADR 0043 (supersedes ADR 0042's review part), spec 3.8 and 4, runbook command card, lessons with checks, CLAUDE.md text | Sonnet 5.5 medium | #463 |
| 18 | S14-C1 | Cloud environment: setup script under 5 min, Postgres 18 and roles at session start | Sonnet 5.5 high + an owner checklist | none |
| 19 | S14-F9 | `recover.py`: dead-pid list and resume lines | Sonnet 5.5 medium | #459 |
| 20 | S14-F10/12/13 | Composers, machine hygiene, command-card extras | Sonnet 5.5 medium | #460, #462, #463 |
Until R2 lands, PRs are reviewed by the old workflow, at most 3 at once; from then on every PR goes through `review.py`. **Cut first if
Part A runs long:** 20, 19, 18, 16, 17's card, 15, 14's tooling half, 13. **Never cut:** A0, M1, F1, F2, W1, R1, R2, R3, AL, B1, G3.
At T+5:00 whatever has not landed is filed with its issue, and Part B starts.

## Part B: sweep M0 to the walk (after Part A, with the new factory)
Start from `m0-remaining.md` §1 (every G1 #1 failure and its owner) and §5 (the waves), with the Handover table below as the newer
state. WIP cap 5; serial on hot files; Sonnet builders for ordinary tickets.
1. **Wave 1 (cache and toolchain):** #443 (T-W317) -> owner `toolchain.sh`; the Q16 redesign (below) and T-249 A -> owner custody re-run.
2. **Wave 2 (the Step 1 chain, serial):** t-readlock (#425's re-submission) -> t228 (#426's) -> t229 (a new PR from the local branch
   `t229`; it collides with T-W320's `gap_linked`: one owner of the gap rule) -> T-W320 (#428's) -> #427 -> T-W315 (new).
3. **Wave 3 (the reading chain):** #431 -> #436 -> T-W334 -> #434 -> #432 -> T-W326 (new) -> #435.
4. **Wave 4 (web, parallel, no lock):** T-W322 (re-submitted squashed), #444, #445, #418, #464 (T-WALK-4, before any G1), then #437
   (only on G1 FL6, by the owner's trade).
5. **Wave 5:** G1 #2 on main; every BLOCKS finding a fix PR; G1 until two consecutive PASS; `ready.py origin/main` exit 0; then ask
   the owner to walk.
Lock-hours owed: about 9-16 (6-10 if the Q16 cache hits). If Part B cannot fit, cut T-W330, #416, T-236 and T-249 B first and say so.

**Q16 redesign (Part B wave 1, Opus 5.5 high):** the static import closure failed open in every review round (#429, #446: aliased
importers, computed names, `fromlist`, loop variables, function-scope rebinding). Key the posting cache instead on the modules the
read job actually loads: the job records its loaded repo files (`sys.modules`) and their hashes inside the sandbox; the key is the
hash of that set, with the whole-tree hash as the fallback whenever the record is missing. Prove it on a PR that changes a lazily
loaded reader (the cache must miss) and on a docs-only change (it must hit).

## Handover (5 Oct 2026, about 21:40Z; from `gh`, the ledger and a branch sweep)
| PR / branch | Ticket | Head | Last verdict | Next |
|---|---|---|---|---|
| #417 | T-235a admin time | 3ff13d9e | r2 PASS; real-drawings posted | CI (Actions outage), then `scripts.land 417` |
| #418 | T-235b bar | 97ae9483 | r3 PASS | CI rerun; design-gate needs a ux-critic walk |
| #427 | T-W319 act cost | 85644ff5 | r2 PASS | update-branch, posting run, CI, land (after T-W320 by the merge order) |
| #432 | T-W323 events | 004f1cc1 | r2 PASS (4 "may" words to file) | posting run was running at the close (read its log), CI, land |
| #434 | T-W332 view title | 75154c83 | r2 PASS; real-drawings posted (1 sheet changed, accepted) | CI, land |
| #443 | T-W317 ACadSharp | d3c4cfec | r1 PASS | update-branch, posting run, land, then the owner's `toolchain.sh` at once (until then every DWG read fails `decoders_agree`) |
| #435 | T-W327 Drawing Set | fdbb08d3 | r2 running at the close | read its ledger record |
| #431 | T-W316 views home | f0a4aa89 | r1 FIX; builder BLOCKED: the seed pins t19a/t182 (68 proposed, 2 unaccounted -> 70, 0) need an acceptance amendment | amend, unblock, r2 |
| #436 | T-W318 storeys | 39c514da | r1 FIX (70: words promise a storey edit the product lacks; 70: an answered storey Question is asked again) | local builder ended; relaunch the fix |
| #437 | t160 D4 paper | 42df53c2 | r1 FIX (60: the binding window gives a bordered A1 sheet its border's paper) | local builder ended; relaunch the fix; land only on G1 FL6 |
| #444 | T-W324 header count | ad16ce13 | r1 FIX; fix pushed | r2 |
| #445 | T-W325 Projects list | 5f7ff2e8 | r1 FIX; fix pushed | r2 |
| #464 | T-WALK-4 (G1's checks) | e653afa3 | r1 FIX; fix READY with the owner's bulk-share amendment 46b0e8f9a | r2; lands before any G1 |
| t-readlock (#425 closed) | D1 | builder's fix 2 | capped | re-submit as a new PR, r1 |
| t228-s13 (#426 closed) | D2 | builder's final fix | capped at r3 (100: the seed loses Q4 on merge) | re-submit, r1 |
| s13-w320 (#428 closed) | T-W320 | 3ef70325 | capped; t182's seed pin 17 -> 20 needs an acceptance amendment | amend, re-submit, r1 |
| s13-w322 (#447 closed) | T-W322 | cb322f62 | capped at r3 (only finding: a corpus-matching literal in an earlier commit) | re-submit **squashed** (one commit, no literal in history) |
| s13-q16b (#446 closed) | T-Q16 | 94ad2a05 | capped; static closure fails open | the Q16 redesign above |
| s13-249, s13-w334, s13-236 | T-249 A, T-W334, T-236 | pushed, BLOCKED | T-249 A waits on Q16; T-W334 and T-236 only on the root-only test (S14-F2 fixes it) | after F2: verify, PR, r1 |
| t229 (local branch) | D3 gaps | 8738bfc46 | never in a PR; conflicts with main | wave 2 |
| not started | T-W315, T-W326, T-W330, T-249 B, T-W314b, #416 | | | Part B; cut candidates named above |
Branches pushed but unused: `s13-allow-5` (the allowlist #447 needed before its squash). Worktrees under `.claude/worktrees/s13-*`:
leave them; `sweep` lists them by name.

## Owner questions (one at a time; recommendation first, its reason in a line)
1. Approve the CLAUDE.md "Effort and models" text in `factory-next.md` §3 and ADR 0043 (superseding ADR 0042's review part)?
   Recommended: yes, it carries your instruction of 5 Oct and keeps your Q20 line for acceptance-writers.
2. Orchestrator at Opus 5.5 `medium` or `high` for the session? Recommended: `medium` throughout; never switch mid-session (the cache).
3. The light path: an allowlist-only PR (only 64-hex lines added) gets code checks and no model. Recommended: yes (4 full reviews spent
   on them in session 13).
4. Spend on `claude ultrareview` ($5-25 a review after 3 free runs)? Recommended: no in Part A; keep the free runs for the riskiest PR
   before the walk.
5. Which plan are you on? Recommended: tell me; nothing depends on it (it only decides whether managed Code Review exists, unused).
6. Mod buttons that submit prompts? Recommended: no; the UI stays read-only for the guard's sake.
7. Keep `real-set-walk` (the last dynamic workflow) for the M0 walk and replace it in session 15? Recommended: keep.
8. Run Part A's ordinary builders as the Sonnet pilot (3 first, then by the kill switch)? Recommended: yes.
9. The bulk-share rule's two edges your ruling of 5 Oct left open: Sheets of no Discipline, and a Discipline the key does not name.
   Recommended: Sheets of no Discipline are judged as one row under half (b); a Discipline the key does not name counts toward the total.
10. Is the 90 % reading bar part of the M0 walk, or M1's first goal? Recommended: M1's (M0.md puts scoring in M1; main reads 45/217).

## Laws that do not change
CLAUDE.md is the law. Nothing from a real drawing enters git, an issue, a PR or a cloud prompt. No "walk now" without
`scripts.walk.ready origin/main` exit 0. Every gate's status through `post-status` only, from an independent verdict. Never bend a
gate; every cut is an issue. Reviews never see or write the ledger; code records verdicts. Read every sha with `git rev-parse`.

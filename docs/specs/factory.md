# The Vextrus software factory

- **Status:** accepted 2026-10-04T21:08:14Z by the owner: "Approve as written (Recommended)" (ADR 0042); consistency
  fixes after review in this PR.
- **Date:** 2026-10-04 UTC (5 Oct in Dhaka), on main 111096094.
- **Decisions:** ADR 0042, `docs/adr/0042-the-software-factory.md`, drafted beside this file.

**The owner's intent (4 Oct 2026, verbatim):**
> "like a powerful software factory engine harness to develop this project with highest quality in shortest time
> possible without concerning tokens: focusing on quality output with lots of parallel sessions and agents mostly in
> cloud sessions possible; in a word a complete customized upgraded updated sdlc for agentic coding software factory
> with leveraging "Claude Mods" and other major updated of Claude Code recently"
>
> "if you run builders in cloud then this machine will have to bear less load, we have to use most of the cloud
> sessions system so that we can run as much sessions without burdening our local machine, on our local machine only
> the needed core sessions will run"
>
> "on session-13 at any cost we'll reach the ultimate version of M0 for me to walk"

**The owner's rulings this session** (STATE.md, verbatim):
- Q1, 17:21Z: "Yes, lift it (Recommended)". Factory code is committed, tested and reviewed like product code;
  "a harness change should remove as much as it adds" stays.
- Q2, 17:22Z: "~11 h as proposed (Recommended)". Phase 3 is 5.5 h; at Phase 3 + 4 h, every item that is not tier 1
  becomes an issue labelled `factory`.
- Q11, 17:26Z: "Cleanup; keep .wslconfig (Recommended)".
- Plan, 17:42Z: "20x max account is perfect for us … for now go on with your full potential."
- Q10, 18:21Z: "Yes, account A for all (Recommended)". The default login runs the orchestrator and every builder.
- The owner's notes on the draft, 20:2xZ (verbatim; they amend this spec):
  - Selected **"More cloud, more parallel"**: more than 6 cloud builders at once, reviewers and refuters in the cloud
    too, fewer local agents (§2.1, §2.3).
  - "Everything seems okay except I have additional requirements that you'll need more research and adding to the
    factory spec plan: mostly pairing with Typesafe AI Jev model into factory incorportation where Jev model invokation
    and actively using it will enhance the factory workflow more better and enhance performance as well as making sure
    of getting the best out of Jev inside our new vextrus software as originally planned; as I told before to use
    Typesafe AI API that is set on both local .bashrc and cloud also where I have enough tokens for you to use: don't
    hesitate to call typesafe API and use credits during research, testing and of course after implementation; it's
    just my opinion that pairing typesafe Jev model more actively into factory would bring us more robust
    performance." (§3.14)
  - "Q4 M0 bar - 90%" (§1, §6).
  - "Q7 drawing data - I'm allowing to be more easy going on this case and cloud sessions may read drawing and
    enabling Remote Control for most cases if that means more power and performance by allowing some privacy issues
    that I'm allowing willingly" (§2.1, §5, §7).
  - "Q20 acceptance writers at high effort: yes for most scenario if it comes to quality" (§2.1, §7).

**How this spec was made.** Three designs (quality-first, speed-first and risk-first) were scored by three judges.
This spec starts from the **risk-first design**, which two of the three judges picked. It reads the engine paths
correctly, so Phase 3 owes no posting run and no custody re-run. I added the other designs' best ideas and fixed every
flaw the judges named. Three critics (completeness, facts, hostile) then checked it; every finding is applied or
answered in `.private/work/session-12/design/revision-log.md`. Section 8 lists the flaws I could not fully remove.
The second revision rests on five research strands run after the owner's notes, each checked by a refuter:
`research/jev-api.md` (60 live Jev calls on invented factory tasks), `research/jev-product.md` (130 live Jev calls on
real items, under the owner's local key), `research/cloud-max.md`, `research/cloud-drawings.md` and
`research/bar-90.md`. Where a refuter corrected a number, the corrected number is used; `design/revision-2-log.md`
lists each change.

**How to read it.**
- `VCC:n` is line n of `.private/work/session-12/research/verified-cc.md`. It is the only source used for Claude Code
  settings, flags, fields, hook events and environment variables.
- `WF:n` is line n of `research/docs-raw/workflows.md`: a raw doc line, **not in VCC**, so each WF fact is
  doc-quoted and unverified (Unverified 20); no tier-1 check rests on a WF fact alone.
- Remote Control facts come from VCC:297-299, 344, 381 and 383-385; anything quoted only from
  `docs-raw/remote-control.md` or `docs-raw/cross-session-messaging.md` beyond those lines is doc-quoted and
  unverified (Unverified 13).
- `M/` is `.private/work/session-12/measures/`.
- **Estimate** marks every number no tool measured.
- **Tier 1 rests only on VCC facts or a Phase-1 live proof.** `--on-branch`, `--model` and `--debug-file` are
  live-proven once (`cloud/verify.md` #2–#3; `cloud/launch-2.debug.log:271-277`). `statusLine` is doc-quoted
  (`docs-raw/statusline.md:44`; VCC:265-266). Each is re-tested at Phase 3's first judged launch or in its PR's tests,
  with the §8 fallback. Everything else not in VCC is marked **unverified (one test in Phase 3)** and is no tier-1
  foundation.

**Read first: what is broken or unmeasured today**
1. **No git hook runs in the main checkout.** `core.hooksPath` points at the old product's empty folder
   (`M/ratchet.md` "Read first" 3). Any pre-push scan is dead until it points at the repo's folder (§5, after f2).
2. **One of the guard test's 16 cases fails from the main checkout** (15 pass: the empty `CLAUDE_PROJECT_DIR` case,
   `M/guard-test-main.txt`). 27 commands from known gap classes pass the guard, and the Read tool reads `~/.pgpass`
   unchecked (`M/guard-gaps-probe.txt`). A hook that times out or whose script is missing lets the call through
   (VCC:212, 216-217).
3. **The leak wall checks paths, not text.** The drawing-literal scan (#211) is still an uncommitted session script.
   That script prints the text it finds.
4. **The python CI job is 24.6 min at the median and climbing 3–5 min a day** (1.8 min on 28 Sep). #237 hit the
   35-min limit twice (at 53 % and 34 % of its tests; a full run would take 39–41 min, estimate). The cause is
   measured: on #237's branch every test that seeds the demo now runs the product's real read job, so one seed is
   2.6–2.9× slower (timed twice: 13.9 / 9.8 s against 5.3 / 3.4 s), and #237 adds 15 seeding tests to main's 88
   (`M/ci.md` §4–5).
5. **Every test run and every xdist worker share one test database** (`vextrus/testing/database.py:18-28`). A killed
   parallel trial left rows that broke another agent's run (STATE 18:02Z). Under xdist, ADR 0041's acceptance
   tripwire would also stop failing on deselected tests (`M/xdist.md` problem 3).
6. **`pyproject.toml`, `uv.lock` and `vextrus/drawings/**` are engine paths** (`.github/engine-paths.txt`). A CI fix
   that adds pytest-xdist owes a ~28-min posting run. This shapes the Phase 3 plan: xdist moves to session 13.
7. **The machine reached 80 % of its memory with no builder running.** VS Code held about 10 GB (its Tailwind helper
   alone 6.4 GiB) and one local web-test run took 9.5 GB (`M/machine.md`).
8. **Cloud works, but through a flag no document names** (`--on-branch`; VCC:17-18, 28-30). It was proven live
   once (`cloud/verify.md`, refuter: PROVEN). Cloud setup took 278 s of its ~300 s cache budget (VCC:326-327).
   The CLI installed a new version on each of the last three days (`~/.local/share/claude/versions/`: 2.1.287 on
   2 Oct, 2.1.288 on 3 Oct, 2.1.289 on 4 Oct), so a hidden flag can change any day.
9. **Plan usage is the shared ceiling.** At ~17:55Z the plan read "session 12 %, week 27 %"
   (`audits/slash-usage.json`). Local and cloud sessions draw on the same limits (VCC:331-332). Background and `-p`
   workflow agents fail at the limit instead of pausing (VCC:366-368).
10. **Cloud sessions can post PR comments under the owner's GitHub name** through built-in GitHub tools that are not
    Bash, so the guard never sees them (`docs-raw/cloud-environments.md:242,318`). A review marker in a PR comment is
    therefore not proof of a review (§2.2).
11. **Your user settings turn off two things the first draft assumed on** (`~/.claude/settings.json`, read today):
    `includeGitInstructions: false` drops Claude Code's run-`verify`-before-commit instruction in local sessions
    (VCC:502), and `subagentPromptCacheTtl: "1h"` is already set.
12. **Unmeasured:** memory per in-process workflow agent; whether `waitingFor` ever shows live (VCC:88); whether
    `/usage` counts cloud sessions; the CI runner's time per shard; the G1 walk's browser memory (2.6 GB for a gate
    walk is an estimate, likely low); the peak number of cloud sessions the plan allows. Two of #245's three flakes
    never reproduced locally; their causes rest on CI logs and timings (`research/verified-measures.md` §2.2).
13. **Jev moves the reading score by 0 today.** The product has one Jev node (`sheet_type`) and the scorer scores no
    sheet kind; the scored run is offline, so Jev answers `Unavailable` there (`research/jev-product.md:10-14`;
    `research/bar-90.md:17-21`).
14. **`judge()` passed a cloud launch on a branch that does not exist on origin** (`cloud/launch-3.debug.log:268`
    against an empty `git ls-remote`; `research/cloud-max.md:9-16`). Nothing came back from that session in 7 min, so
    the two-way Remote Control route to cloud sessions is documented but **not yet proven live**.
15. **CLAUDE.md's "Accounts" line is wrong:** the default config `~/.claude` is account A, not B (account hashes match
    `~/.claude-a`; refuter's correction to `research/cloud-max.md:21-22`). Q10 already put everything on account A; f7
    fixes the line.
16. **No route for real drawings into a cloud session is proven** (`research/cloud-drawings.md:9-14`): whether a
    session may clone a private repo not attached to it, and whether bwrap runs in the VM, are both untested.

---

## 1. The owner's two questions, answered

### ANSWER A: "Why were D1–D10 not found before the owner's walk, and what should we have done to prevent that?"

**Why they were not found.**
- **No check between merges did a QS's job on a real set.**
  - Web tests used fakes.
  - Design reviews walked the demo seed, where no file is ever really being read.
  - The real-drawing check compares the reader's output with its own last run. It has no right answer and no limit.
  - The scorer checks Sheets and Views against the Answer Key.
  - None of them counted Questions, Sheets that can be confirmed in bulk, or how long a QS's act waits.
- **The two halves were tested apart.** The web test and the server test each invented their own version of the
  Coverage data, and no test ran them together (D8).
- **One agent did walk the real sets, on 30 Sep, and saw early forms of D2, D3, D4, D5 and D7.** Five of its findings
  got no ticket. F6, the flood of "what kind of sheet" Questions, was only a side note in #158, which closed without
  it.
- **Then nobody walked the real sets for about 4 days.** In that time #157 added D1, and three changes combined into
  D3. The owner was told "walk now" twice with no agent walking first. The agent walk after the owner's verdict found
  D1–D10 in about 50 minutes.
- **Some were known, decided or cut, not missed.**
  - D4 was filed on 30 Sep (#160) and stuck on an unanswered trade.
  - D9's storeys were a failing score that no loop worked on for 4 days.
  - D6 was a budget cut with no follow-up issue.
  - D3 is the spec's own rule.

**What we should have done.**
- **A real-set walk gate (G1).** After each fix wave, and before any "walk now", an agent walks main on the real sets
  as a QS would. The owner is asked to walk only once it passes, twice in a row. It is the named catcher for 9 of the
  10.
- **QS-burden measures with limits (G5):** Questions per Discipline, the share of Sheets that can be confirmed in
  bulk, false continuation Questions, and proposed leave-outs checked against a truth (D2, D3, D7, D9 in part, D10).
- **A test that a QS's act never waits on a read job (G3)** (D1).
- **Fakes checked against the real server's data shapes, or closed key types (G2a)** (D8).
- **No silent cuts.** Every budget cut and every walk finding gets its own issue before the ticket closes. A refused
  trade goes to the owner at once (D6, D2's F6, D4).

This spec builds G1 (with G5's burden counted inside it) and the "no silent cuts" rule as committed checks (§5,
tier 1). The export-level G5 measures, G2a and G3 come in session 13 with the PRs that carry them.

### ANSWER B: "Why is the real-drawing reading quality so low, and what would make it 90 %+ on real drawings?"

1. **What 90 %+ needs per View:** about 97–98 % of Views fully right (Edison 96.8–96.9 %, Sample Project 98.3 %), and
   all six Sheet fields right on almost every Sheet; today a View is fully right 44–46 % of the time on Edison and
   50 % on the Sample Project, and all six fields are right on only 75 % of Edison Sheets.
2. **What can reach it (all estimates):** no strategy has evidence that it reaches 90 %, alone or paired, S1 + S4
   included; it needs every failure class fixed together: S1 (Answer Key audit, owner ruling Q13), S2 and S3 (fast box
   loops, the Plot as a second source) for the 221 near-miss boxes, S4 (a Claude vision proposer, owner ruling Q8) for
   the 209–258 Views the reader misses or mis-kinds, and rules or Jev for titles, subjects and storeys. Jev, measured
   live on 130 real items against one builder's labels (not the Answer Key): **view subject** is the one clear win
   (37/40 where the reader left none, reader 12/40); storeys 33/40 with no gain over the reader; kind from title text
   is worse than the reader on the 30 independently labelled views (27/30 against 30/30) (`research/jev-product.md:63-70`
   with the refuter's corrections). No scored run confirms any of these (§3.14).
3. **What it costs, and when (estimates; `research/bar-90.md` §5):** session 13: S1 (Q13, two-keyer agreement,
   scorer diagnostics), the reading-measures PR, the Jev replay seam, and the view-subject Jev node (J1) if the lock
   allows (it is cut first to 14, §6); session 14: the Sheet fields (storeys, title, Discipline, date) and J1 if not
   landed; sessions 15–16: the near-miss boxes (S2, S3); 17–19: misses and
   wrong kinds (J4, S4 in the product only after an ADR 0011 ruling); 20+: the tail against a hold-out. An honest 80 %
   is about 6–9 sessions away. **No measurement supports a date for 90 %**; if every phase hits its target the
   earliest is about session 19–22 (low confidence), and if S1's agreement comes back under ~97 % of Views, 90 % of
   Sheets may be out of reach under today's box rule. Spend: Jev about $0.02–0.04 a full two-set pass (refuter's
   correction: $0.02 batched, ~$0.04 one item per request); $0 outside the Max plan if S4 runs through Claude Code;
   only if S4 runs on an API key, about $1 for a 10-sheet prototype, then about $30 (Opus 5.5) or $15 (Sonnet 5.5) a
   full 284-sheet pass, up to about $142 / $71 if answers run long. Q8's default uses Claude Code (the plan).

**The ruled 90 % bar** (Q4, the owner, 4 Oct 20:2xZ: "Q4 M0 bar - 90%"; `ceil(0.9 × total)`, `research/bar-90.md:31-39`):

| | Ruled bar, 90 % (Q4) | The old 80 % bar (session 08), now an interim mark | Main's code today | Gap to 90 % |
|---|---|---|---|---|
| Edison Sheets | ≥ 196 / 217 | 174 | 45 (20.7 %) | 151 |
| Edison Views | ≥ 666 / 739 | 592 | 429 (58.1 %) | 237 |
| Sample Project Sheets | ≥ 61 / 67 | 54 | 8 (11.9 %) | 53 |
| Sample Project Views | ≥ 376 / 417 | 334 | 215 (51.6 %) | 161 |

**Plainly: 90 % is not reachable in session 13** by any evidence (45/217 and 8/67 today; the last three loops moved
Edison by +6, +1 and 0). Session 13 delivers the walk-ready product and an honest reading report against the 90 % bar
(§6); the bar itself is closed in sessions 14 onward.

**Why it is low, in plain words.**
- **One fault fails a Sheet.** A Sheet passes only if all six fields are right and every View is found with the right
  kind, title and subject. Errors multiply: 58 % of Views found becomes 21 % of Edison Sheets passing.
- **The reader misses Views.** Of the 479 Views missed at the best head, 221 (46 %) are found but boxed a little off
  (overlap 0.5–0.8 where 0.8 is needed). The rest are merged or not found (98), of a kind the reader never produces
  (69), grouped wrong (49), or given the wrong kind (42).
- **Storeys are wrong on 32 Edison and 11 Sample Sheets.** Even with every View perfect, Edison could pass at most 163
  of 217 Sheets (75 %) until the Sheet fields, storeys first, are fixed.
- **The hand-written rules have levelled off.** The last three loops moved Edison Sheets by +6, +1 and 0. Each loop got
  only 1–2 scored tries, because one scored run takes 25–30 minutes on one lock.
- **Some misses may be the Answer Key's.** 48 of 57 missed Edison title blocks follow a keying pattern on turned
  Sheets; the slab-detail kind is keyed differently in the two sets. Nobody has measured whether two keyers would
  agree, so the reachable ceiling is unknown. That is S1's first job.

Every number above comes from `research/verified-answers.md` §2, which re-derived it, or from `research/bar-90.md`
and `research/jev-product.md` as corrected by their refuters; refuted claims were dropped.

---

## 2. The factory's shape

### 2.1 Who runs where

One account (account A, the default login; Q10) runs everything, so the orchestrator and its local builders share
one config folder and can message each other (VCC:496).

| Role | Where | Model, effort | Starts with | At once |
|---|---|---|---|---|
| Orchestrator | local, main checkout | Opus 5.5; effort the owner sets | `scripts/factory/orchestrator.sh` | 1 |
| Builder for a ticket proved by committed tests | **cloud** | Opus 5.5 (`builder.md`); `--effort medium`, `high` for walls, gates and hostile input | `uv run python -m scripts.factory.launch cloud …` | the governor's ramp: 8 cloud sessions at once to start (writers and cloud reviewers included), up to 16 (§2.3) |
| Acceptance writer | **cloud**, on the ticket's branch; local for local tickets | Opus 5.5; **`high`** (Q20, the owner: "yes for most scenario if it comes to quality"); `medium` only for a docs-only ticket, named in the launch record | same launcher, `--role acceptance-writer` | one per ticket, before its builder |
| Reviewers, refuters | **cloud by default once f4's verdict-file check is merged and one trial passes** (§2.2 "Launch, cloud review"); in-process inside `/review-pr` for small diffs, before that, and as the fallback | Opus 5.5, high, named per stage (WF:423) or per launch | `scripts.factory.review_cloud`; `/review-pr` | count in the cloud ramp; ≤ 8 in-process agents |
| Words gate (`ux-critic` on `web/src/messages/**`) | in-process inside `/review-pr` | Opus 5.5, high | `/review-pr` | — |
| Builder for a ticket that reads real drawings (D9/D10-type), `--no-post` runs, proxy loops, `drawing-analyst` for conventions | **cloud, in the `vextrus-drawings` environment, once the route-A probe passes** (§2.4); local until then | Opus 5.5, high, a refuter | `… launch cloud --drawings …` (or `… launch local …` before the probe passes) | in the cloud ramp; ≤ 3 local agents in all |
| The guard ticket (f2) and G1's builder (f5) in Phase 3 | **local** worktree | Opus 5.5, high, a refuter | `… launch local …` | inside the ≤ 3 |
| Posting runs and scored runs (custody) | local, one lock | — | `scripts/real-drawings` under the lock | 1 |
| G1 gate walk (script layer + agent layer) and its verdict; `drawing-analyst` work whose output is drawing content | local, on main | Opus 5.5 | `scripts/walk/run.py` (detached), then `/real-set-walk` | 1 walk |
| Jev calls (`scripts/factory/jev.py`) | a function called by scripts and workflows, never an agent or a gate (§3.14) | `jev-1.13.0`, pinned | the calling script | ≤ 10 concurrent calls |
| Look-ups, exploration | anywhere | **Sonnet 5.5** (the committed `Explore` agent, low effort) | automatic | — |

**Reviewers and refuters move to the cloud (the owner's "More cloud, more parallel"), as far as the verdict channel
holds.** The first draft kept them in-process because nothing but a push was proven to come back
(`cloud/verify.md`). `research/cloud-max.md` §3 gives a channel that a PR commenter cannot forge: the verdict is
**one pushed file** on a review branch, recorded by the local ledger only after a local check of its parent, its
single path, a 128-bit nonce that only the launch record and that reviewer's prompt hold, and an unmoved PR head
(§2.2). A push needs write access to the repository; a PR comment does not. What the channel does not stop: a
prompt-injected reviewer writing PASS, the same risk as in-process, held by CI, `merge_ready` and the second lens.
- **In the cloud a reviewer runs the full Python and web suites on its own VM** (the VM ran the takeoff suite, 556
  passed in 897 s, `cloud/verify.md` #5), at no local memory cost.
- **Not yet run end to end** (the PONG probe was inconclusive, `research/cloud-max.md:9-16`), so Phase 3 reviews stay
  in-process (by hand until f4 merges, then `/review-pr`), and cloud review is tier 2 in f4 with one trial; small diffs
  stay in-process, because a cloud reviewer pays ~278 s of setup plus its suite (estimate, `cloud-max.md:125-128`).
- **Only the orchestrator's main conversation may list or message cloud sessions** (ListAgents, SendMessage); a
  workflow subagent cannot (`cloud/NOTES.txt` 17:47:01Z). A Remote Control message is a doorbell, never the record.

**The local machine's rule (fewer local agents):** only what must stay runs here: the orchestrator, the ledger,
`merge_ready`, `post-status` (key user), the blind scorer and its keys, posting and scored runs under the lock, the
governor, the launcher and `judge()`, the leak scan and its corpus, the G1 gate walk and its verdict, Held-out Sets,
Jev calls that carry drawing text from any set but the two Development Sets (Q23, ruled 5 Oct 2026), and
drawing-content analyst work (no private return channel from the
cloud yet, `research/cloud-drawings.md:25-28`). In Phase 3, f2 (it builds and tests the literal corpus from the real
drawings, and its stamp must be proven from the main checkout before it merges, §8) and f5 (G1 is built and smoked on
the real sets, and the gate walk stays local) are local too. A web test suite (9.5 GB) never runs locally while a walk
or a real-drawing run is up; builders and reviewers rely on cloud and CI for web tests.

### 2.2 Launch → watch → review → gate → merge, as committed code

Every step is a committed, tested file (Q1). Nothing in `.private/` is code any more. Files under
`.private/work/factory/` are private run records, never code. The data each file passes to another (status, verify
record, trailer, walk verdict, ledger record, leak-scan command line) is fixed first in
`docs/specs/factory/contracts/` (PR f0), and every producer and consumer tests against those fixtures.

| Step | File (PR) | What it does | Replaces |
|---|---|---|---|
| Start | `scripts/factory/orchestrator.sh` (f3) | Refuses while a `.private/work/factory/*.pid` names a live G1 or real-drawing run it would orphan. Starts `scripts/factory/watch.py` detached (`setsid nohup … &`, pidfile `.private/work/factory/watch.pid`) if it is not running, then `exec env VEXTRUS_ROLE=orchestrator CLAUDE_CODE_WORKFLOW_MAX_CONCURRENT_AGENTS=8 claude --model claude-opus-5-5 --settings scripts/factory/orchestrator.settings.json --plugin-dir <repo>/tools/mod/vextrus-factory "$@"`. It drops `--plugin-dir` when `.private/work/factory/mod-disabled` exists. It never sets `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` or `DISABLE_GROWTHBOOK`, either of which turns Remote Control off (VCC:383-385; `docs-raw/remote-control.md:31`); the orchestrator needs Remote Control to list and message cloud sessions (VCC:297-299; Q7, ruled). | the owner's hand-typed launch |
| Clock | `scripts/factory/stamp.py` (f3) | `stamp start --budget 11h --phases …` writes `.private/work/factory/session.json`; `stamp "<text>"` appends `<UTC now> <text>` to the session's STATE.md; `stamp elapsed [--ticket t]`; `stamp budget --ticket t --minutes m` (a builder writes its own budget into its git folder) | `.private/work/session-12/stamp.sh` |
| Preflight | `scripts/factory/governor.py` (f3) | `check <unit>` exits 0, or 3 with the reason. Units: `cloud-session`, `local-agent`, `review`, `pytest`, `web-tests`, `walk`, `rd-run`. It reads `/proc/meminfo`, `df` and the usage reading (§2.3). It **fails closed**: unreadable usage text refuses, printing the raw lines. | none |
| Launch, cloud | `scripts/factory/launch.py cloud` (f1; `judge()` moves here from `scripts/cloud/launch.py`, which is deleted) | Refuses unless: `git ls-remote --heads origin <branch>` returns a sha (`judge()` alone passed a launch on a branch missing from origin, `cloud/launch-3.debug.log:268`; a stale local `origin/<branch>` ref does not count); the cwd is the main checkout (an untrusted folder hung at the trust dialog, `cloud/verify.md` #1); `origin/<branch>` carries an `acceptance:` commit, or `--untestable "<why>"` is given; the governor says yes (before f3 lands: `--preflight "<df, free and /usage lines>"`, recorded); the prompt passes the leak scan (`python -m tools.leakscan text --stdin`; before f2 lands, `--prompt-scanned "<lits2 count line>"`, recorded). The prompt's first lines tell the session to check `git remote get-url origin` and its branch and to stop without pushing if either is wrong. It runs exactly the proven argv `["claude", "--debug-file", <log>, "--model", <m>, "--effort", <e>, "--on-branch", <branch>, "--cloud", <prompt>]` (`cloud/launch_probe.py:65-72`). `judge()` then reads the log and refuses a bundled upload, another repo or another revision. **A refused launch keeps running** (VCC:463), so on REFUSED with a session id the launcher at once sends `claude -p "STOP: launched wrongly. Do nothing; push nothing." --cloud <id> --output-format json < /dev/null`, records it, and adds the id to the owner's list to delete in claude.ai/code. A CLI version not yet in the private list `.private/work/factory/proven-cli.txt` is allowed one launch, which is judged; OK adds the version. `--drawings` (tier 2, session 13) marks a drawing ticket: its branch must start `rd/`, its prompt forbids PR comments and every push but code, and it runs in the `vextrus-drawings` environment (§2.4). | bare `claude --cloud` in orchestrate-wave (VCC:473); `launch_probe.py` |
| Launch, cloud review | `scripts/factory/review_cloud.py` (f4; tier 2, cut first inside f4) | For PR `<pr>` at `<head_sha>`: makes a 128-bit nonce (`secrets.token_hex(16)`, kept only in the launch record), pushes `<head_sha>` to `refs/heads/review/<pr>-<nonce8>` (a subprocess, after the head's leak stamp), and launches `pr-reviewer` or `refuter` through `launch.py cloud` on that branch with `pr`, `head_sha`, the nonce and (refuter) the claim in the prompt. The prompt's first lines: check `git remote get-url origin` and `git rev-parse HEAD == head_sha`, else stop without pushing. The reviewer commits exactly one file, `.review/<pr>-<nonce8>.json` (`{pr, head_sha, nonce, agent, verdict, findings}`, public words only; a refuter writes `.review/refute-<pr>-<nonce8>-<n>.json` with `CONFIRMED`, `REFUTED` or `UNPROVEN`), as a child of `head_sha`, pushes only that branch, and ends with the same `VERDICT … at <sha>` line. Optional doorbell: the orchestrator's main conversation (Remote Control connected) sends the session one SendMessage after launch, so it may reply `DONE <nonce8>`; the fallback is `watch.py`'s poll of `git ls-remote origin 'refs/heads/review/*'` (`research/cloud-max.md` §3). | in-process review only |
| Message a cloud builder | `scripts/factory/launch.py say <session> --file <f>` (f1) | Leak-scans the text, prefixes `[elapsed n/m min]` (ADR 0041 item 4), sends `claude -p "<msg>" --cloud <session_id> --output-format json < /dev/null` and reads `{ok}` (VCC:119-121; shown once at 18:12Z, `cloud/NOTES.txt:17-19`). One message per review round. A CLI-sent message has no reply address (VCC:119-121, 297-299; `docs-raw/cross-session-messaging.md:153`); a two-way exchange needs the orchestrator's main conversation, Remote Control connected, using SendMessage (VCC:297-299; `:116,142,180`; documented, not yet run live: one test in Phase 3). | hand nudges |
| Launch, local | `scripts/factory/launch.py local` (f1 parses it; f3's `scripts/factory/local.py` runs it) | Governor first; `git fetch origin`; a worktree at `origin/<branch>` under `.claude/worktrees/<ticket>`; if the branch lacks `.claude/agents/builder.md` (a carried branch), it merges `origin/main` into it first as a recorded merge commit, and refuses on a conflict; `ensure_database` for it; refuses a second live session with the same `--name`. From inside the worktree (a `--bg` there stays put, VCC:192) it runs `claude --bg --agent builder --name <t> --effort <e> --settings /home/riz/vextrus-cubit/scripts/factory/builder.settings.json "<prompt>"` (an absolute path, so a carried branch's own tree cannot lose it). The child env sets `VEXTRUS_ROLE=builder` and drops `CLAUDE_CODE_WORKFLOW_MAX_CONCURRENT_AGENTS` and `CLAUDE_CODE_PLUGIN_DIRS`. It never passes `--plugin-dir`. | hand-run `claude --bg` lines |
| Launch record | both launch paths | `.private/work/factory/launches/<ticket>-<utc>.json` (ticket, branch, where, budget, session id, CLI version, governor reading, judge verdict) and a `claude agents --json --all` snapshot beside it: the brief's per-launch evidence | hand notes |
| Talk to a local builder | `scripts/factory/say.py` (f3; tier 2) | Prefixes `[elapsed n/m min]` and prints the text for the orchestrator's SendMessage. It resumes a local builder only by its full `sessionId`, only when its state is `stopped` or `failed` **and** the `claude agents --json --all` row has no `pid`, passing `--settings` again (VCC:97-100, 174, 494-495). It refuses and alarms if the resume prints the copy `note:` line. A `done` session is alive and waiting (VCC:294-296): it gets a SendMessage, never a resume. | short-id resumes |
| Builder's finish | `builder.md` (f4) + the guard's READY push gate (f2) | The builder runs `verify` on the staged tree, then commits with the trailers `Factory-State: READY` and `Factory-Verify: <tree> ok` (printed by `verify`), or `Factory-State: BLOCKED` with `Factory-Reason: <one line>`. Its body is the PR body: what was not verified comes first, then the verify summary (each check's exit code), and every cut item names the issue title to file. **The guard refuses to push a READY head** (a cloud builder's push, or the orchestrator's push of a local builder's head) unless `<git-common-dir>/vextrus/verify-<HEAD's tree>.json` exists with every exit code 0 (VCC:168: a PreToolUse exit 2 blocks). One channel for both, read by git. **READY/BLOCKED stays this exact trailer, never a Jev reading of free text:** Jev read "All checks pass but I am blocked on review" literally (case b9, `research/jev-api.md:102`), and the trailer is exact. | inferred from silence |
| Watch | `scripts/factory/watch.py` (f3) | Every 60 s: `git ls-remote` per ticket branch (a push is a heartbeat; a new head is fetched, its trailers read, and its diff and commit messages leak-scanned); `claude agents --json --all` for local sessions (`state`, `waitingFor`; VCC:494). Every 5 min: `gh pr list` (CI state). Every 15 min: the usage reading. Every pass: the lock, `df`, `/proc/meminfo`, the ledger folder. It writes **one** `.private/work/factory/status.json` (atomically, by f0's schema) and appends one line per change to `events.log`. Alarms: a cloud builder with no push for 30 min (estimate); a local builder `blocked`; a READY head without a matching `Factory-Verify` tree; a READY head waiting 10 min; any new `claude/*` branch on origin; a leak-scan hit on a cloud head; a budget passed; a floor crossed. It fires on a READY head already present at start. A SessionStart hook (main checkout only) restarts it when its pidfile is stale. Also (tier 2): every 60 s, `git ls-remote origin 'refs/heads/review/*'` (a new verdict file raises `REVIEW-READY <pr>`); once a day, `python -m scripts.factory.jev models-check` (`JEV-MODEL-MOVED` when a one-question `jev-latest` call's `model` field leaves the version pinned in `docs/knowledge/jev-nodes.md`, or `GET /v1/models`' `jev-latest` release date changes: that list names only the aliases `jev-latest` and `jev-preview`, never a version, measured live 4 Oct 21:02Z, §3.14; which adds a "re-run `jev_spot_check`" item to the milestone issue, ADR 0011 rule 3); and, once drawing-environment sessions run, the leak scan over their PRs' comments and bodies (§2.4). | `pgrep` loops; manual `ls-remote` |
| Wake the orchestrator | Monitor, `notify_when_idle` | Monitor on `tail -n0 -F .private/work/factory/events.log`, re-armed at its 30-min deadline (VCC:497). `notify_when_idle` for local builders (VCC:496). Long runs (G1, real-drawing runs) are started detached and report through `events.log`, so they survive an orchestrator restart. | sleeping; hand polling |
| Real-drawing lock | `scripts/factory/rdlock.py` (f3; tier 2) | One lock, one visible queue in `.private/work/factory/rdlock.json` (holder, waiters, head, kind, since). Priority: posting > scored > `--no-post`; first in, first out within each. Refuses a second waiter for the same head and kind (S11 13:57Z). Output unbuffered, kept under `.private/work/rd/`. It runs `scripts/real-drawings` unchanged, so no custody code moves. If cut: the session `flock` stays, with its known faults. | the session `flock` and its invisible queue |
| Review | `.claude/workflows/review-pr.js` (f4), run as `/review-pr` with `args` (VCC:302-303) | §3.8. Named `review-pr` because `/review` is the bundled alias of `/code-review`, which a project command cannot take (`docs-raw/commands.md:133`; `docs-raw/skills.md:192`; doc-quoted, not in VCC: the distinct name avoids the question either way). Stage 0 runs `scripts/ledger.py check <PR> --round n [--exception …]` (the signature in the next row). Every decision (the round cap, which findings need a refuter, the verdict from the reviewers' `VERDICT` lines) lives in `ledger.py`, which is unit-tested; the workflow only fans out and passes lines. | hand-run reviews; a cap that lived in prose |
| Review record | `scripts/ledger.py` (f4) | `check <PR> --round n [--exception security75\|crash\|false-statement\|fix-regression --reason "<text>"]` (round 3 refused without the exception; `fix-regression`, the owner's ruling of 5 Oct 2026: every finding left at round 2 was introduced by fix round 1, as its refuter confirms); `decide --from <file of reviewers' final lines>` (computes PASS, FIX or BLOCK; never transcribed by an agent); `record <PR> --round n --head <sha> --from <file> [--exception security75\|crash\|false-statement\|fix-regression --reason …]`. **The record of truth is local:** `record` writes `.private/work/factory/ledger/<PR>-<head>.json` (verdict, counts, the decision input's sha256, the posted comment's id) in the main checkout, which no cloud VM can reach. It leak-scans its text, then posts one PR comment with a fixed marker for display: `<!-- vextrus-review round=N head=<sha> verdict=V findings=k -->`. The guard refuses `ledger record` outside the main checkout's project folder, and any Write or Edit under the ledger folder. **`fetch-verdict <PR> --launch <record>`** (tier 2, with `review_cloud.py`) records a cloud verdict only after `git fetch origin review/<pr>-<nonce8>` and a local check: the tip's parent is `head_sha`; the tip changes exactly the one verdict path; the file's nonce equals the launch record's; its `head_sha` equals the PR's current head (`gh pr view --json headRefOid`), which did not move during the review (the proxy does not limit which branches a cloud push updates, `docs-raw/cloud-environments.md:242`, so a moved head voids the verdict). Then it deletes the review branch as a subprocess (the cloud proxy refuses deletions). A Jev shadow sidecar (`.private/work/factory/ledger-jev/`, §3.14) is never read by `decide`. | none |
| Land | `scripts/land.py` (f4; tier 2) | `land.py order`: engine PRs as soon as their posting run is done (they are the long pole, lessons.md:327-329), with no-gate and web PRs landing in the gaps (their merges leave the engine code hash, and so the cached posting run, valid). `land.py <PR>`: refuses without a ledger PASS for the head; marks the PR ready; `gh pr update-branch`; waits for CI; reruns a failed job once, and only if every failed test is listed in `.github/flaky.txt` (recorded); prints the `post-status` lines still owed (it never calls `sudo`; the orchestrator types them); runs `merge_ready`; merges; `git pull --ff-only`; appends measures. It runs detached and reports through `events.log`. If cut: the orchestrator lands by hand with the same steps. | `land.sh`, `premerge*.sh` |
| Gate to merge | `scripts/merge_ready.py` (f4, changed) | Adds four refusals, each with a test, and keeps today's: (a) no ledger file for the head says PASS, or the newest marker's comment id differs from the ledger's; a newer head is allowed only if every commit since the ledger's head is a merge of main whose `git diff-tree --cc` resolution is empty (a resolved conflict is unreviewed code: "re-review the resolution"); (b) a round-3 record with no exception; (c) an item under a `## Cut`, `## Not done` or `## Deferred` heading that does not link an open issue; (d) the leak scan fails on the PR's added lines, commit messages, file names, branch name, title, body or comments. | — |
| Gate posting | `scripts/owner/post-status` (unchanged) | From the main checkout, as the key user: `design-gate` from an independent verdict; `real-drawings` from a lock run under the accept rule | — |
| Jev client | `scripts/factory/jev.py` (f9; an obligation: the owner's explicit ask) | `ask(state, questions, *, model="jev-1.13.0") -> Answers \| Unavailable` over `httpx` (already locked); constants imported from `vextrus.settings.jev` (URL, deadline, backoff, cool-off, maximum body), not the product's tenant-bound client; the key read from `$TYPESAFE_API_KEY` into the header only, never logged; no key → `Unavailable` with no call. Answers cached in `.private/work/factory/jev-cache/<sha256(state, questions, model)>.json` (replayable; a recorded answer is a test fixture); one log line per call in `.private/work/factory/jev.log` (task, model id, latency, input tokens; never the state). `Unavailable` within `VEXTRUS_JEV_DEADLINE_SECONDS` (6 s) with a cool-off after 3 failures; **every caller then runs exactly as without Jev.** Subcommands: `triage`, `same-issue`, `models-check` (§3.14). | none |

There is no mutable state store. Launch and ledger records are append-only. The truth is git, GitHub, the local
ledger and `claude agents --json`. A workflow cannot run shell commands itself (WF:363), so every rule that matters
lives in `merge_ready`, the guard or a script, never only in a workflow. **Jev never decides a gate:** it advises,
sorts and routes; the guard, `merge_ready`, the ledger and the leak wall decide (§3.14).

### 2.3 Capacity and the governors

**Local memory** (27,054 MiB; the 80 % ceiling is 21.6 GB; `M/machine.md` §4). Unit costs, measured unless marked:

| Unit | GB | Source |
|---|---|---|
| Base load, VS Code closed | 3.0 | measured 2.1–3.1 |
| Orchestrator + browser MCP | 0.8 | 0.55 + 0.25 |
| One local agent (idle or editing) | 0.9 | measured |
| One in-process review agent | 0.3 | **estimate**, unmeasured (Unverified #4) |
| One pytest run: a narrow module / the full serial suite | 0.2 (3 packages) / 3.3 | measured (`research/verified-measures.md` §3.3) |
| One web-test run | 9.5 | measured, about 1 min |
| One real-drawing run | 3.0 | 1.0 measured + room for a 3 GiB reader spike (estimate) |
| One G1 walk (stack, browser, CAD worker reading) | 5.6 | 1.1 measured + 1.5 browser (estimate) + 3.0 CAD reading (estimate) |

| Session 13's local plan | GB |
|---|---|
| base 3.0 + orchestrator 0.8 + one `/review-pr` run (8 agents × 0.3 + changed tests 0.7) 3.1 + 3 local agents 2.7 + 1 real-drawing run 3.0 + 1 G1 walk 5.6 | **18.2 of 21.6** |
| room left | 3.4: **far less than one web-test run (9.5)**, so the governor refuses `web-tests` while a walk or a real-drawing run is up; a full pytest (3.3) runs only when no walk runs |
| with VS Code open on this repo (+10) | 28.2: **over**. Owner action O4: close VS Code during sessions |

**Review scratch.** `/review-pr` reuses 8 fixed linked worktrees, `git worktree add --detach
.private/work/factory/review/slot<k>`, checked out per round with `git checkout --detach <sha>`, sharing one `.venv`
through `UV_PROJECT_ENVIRONMENT`. A linked worktree gets its own database name (`vextrus/settings/db.py:40-45`), and
every reviewer command also sets `VEXTRUS_DB_NAME=vextrus_rv_slot<k>`, so no reviewer shares the main checkout's test
database. Disk: about 0.9 GB a slot (`M/worktree-sizes.txt`: 0.87–0.89 GB per checkout), about 7 GB once, never a new
folder per round (the guard refuses recursive deletes, so nothing would reclaim it).

**Floors** (the governor refuses the unit if any fails; all estimates, tuned in Phase 3):
- Memory: `MemAvailable − the unit's cost ≥ 5.4 GB` (keeps use ≤ 80 %). The `review` unit costs agents × 0.3 + 0.7.
- Swap: refuse above 2 GB used; warn above 1 GB (4.2 GB was in use at 17:44Z, just before trouble).
- Disk: refuse when free space after the unit's cost is under 30 GB (the brief's rule); warn under 40 GB. Today 67 GB
  is free, minus ~7 GB of review slots; `.private/work` grows ~8–9 GB a day (estimate), so ~3 days to the floor
  without cleanup.
- Local agents ≤ 3 (session 11 filled swap at 8).

**Usage.** `claude -p "/usage" --output-format json` works headless and costs nothing (VCC:438-440). Its text is
undocumented, so the parser fails closed. The format seen today: `Current session: 12% used · resets …` and
`Current week (all models): 27% used · resets …` (`audits/slash-usage.json`).
- Refuse a new launch only at a used-up limit, session or week ≥ 100 %. The owner's ruling (5 Oct 2026):
  "don't make those threshold of week 85% or session 80%, make them 100% both and I'll take actions
  whatever needed for usage tokens expansion" (usage is the owner's concern; #404).
- At ≥ 100 %, `/review-pr` drops to `pr-reviewer` only, and refuters run only on findings ≥ 75, recorded in the
  ledger as an exception. Local work does not save quota: local and cloud sessions share one plan's limits
  (VCC:331-332).
- Unreadable text refuses and prints the raw lines. The orchestrator may pass `--usage-checked "<lines>"` after reading
  `/usage` itself; the launch record keeps the lines.
- After the first hour the governor computes "% per builder-hour" from its own readings and caps cloud sessions at
  `min(16, floor((100 − session %) / (rate × hours to the reset)))`. Worked example (estimate): at 1.5 % of the session
  window per Opus builder-hour, `s` = 40 and 3 h to the reset give `floor(60 / 4.5)` = 13.
- **Week projection.** Phase 4 projects session 13's week use from Phase 3's rate × session 13's planned
  builder-hours. The week resets on 9 Oct at 14:59 Dhaka, so Phase 3 and all of session 13 fall in one window. If the
  projection passes 100 %, the owner adds usage (credits or accounts): usage is the owner's concern (the ruling of
  5 Oct 2026, #404).
- **The cloud cap is a governor-driven ramp** (the owner's "More cloud, more parallel"; every number an estimate
  until Phase 3 measures "% per builder-hour", `research/cloud-max.md` §4). Builders, writers and cloud reviewers all
  count.
  - **Start at 8** at once, whatever `/usage` reads (the owner's usage ruling, #404).
  - **Raise by 2 every 30 min, to 12, then 16**, while the projected session % at the reset
    (`s + rate × n × hours to the reset`) stays under 100 % (the owner's usage ruling, #404). 16 matches the workflow concurrency
    ceiling (VCC:304) and what one main conversation can track (estimate).
  - **Hold** (no new launch) only at a used-up limit, session or week ≥ 100 %; **shed** there too (the degrade
    above).
  - No per-account cap on concurrent cloud sessions is documented; they share the account's limits, and "running
    multiple tasks in parallel consumes more rate limits proportionately" (`docs-raw/claude-code-on-the-web.md:428`;
    VCC:331-332). Ten background sessions use quota about ten times as fast as one (VCC:365;
    `docs-raw/agent-view.md:960`). The binding limit is the usage window, not a session count.
- **What more cloud buys, and what it does not** (`research/bar-90.md` §4, estimates): more builders and reviewers at
  once, and, once drawings reach the cloud (§2.4), about 60–100 proxy-checked reading candidates an hour instead of
  ~10. It does **not** raise scored heads: scoring needs the custody keys, behind one local lock, at ~2 an hour at best
  and ≤ 0.4 an hour in session 13's plan. Only Q17 multiplies scored heads.
- The status line's `rate_limits` field (VCC:270-272) is a cheaper reading when fresher than 15 min. Its sub-field
  names are unverified (one test in Phase 3), so `/usage` stays the source the governor trusts.

**Cloud VM** (VCC:328; `cloud/RESULT.md`): 4 vCPU, 15 GB RAM, no swap, 27 GB free disk (docs: ~16 GB, 30 GB).
A builder never runs web tests and pytest at once. The owner raised `BASH_MAX_TIMEOUT_MS` to 2,400,000 in the
`vextrus` environment (STATE 18:24Z; VCC:329-330), so builders run long suites in the foreground with a timeout, never
in a wait loop. Setup takes 278 s of the ~300 s cache budget; if it passes 300 s, every VM pays full setup
(VCC:326-327; tier 3 fix).

**The real-drawing lock is session 13's critical path:** 25–34 min per run with main cached (1,520–2,030 s over
session 11; `research/verified-measures.md` §4.2). §6's lock budget counts every engine PR. Session 11 spent 3.45 h of
its lock on `--no-post` runs that were neither scored nor posted, and 1.85 h on posting runs that changed nothing. The
queue's priority, the proxy loop (session 13) and, once §2.4's probe passes, `--no-post` runs in the cloud give that
time back.

### 2.4 Real drawings in the cloud (the owner's Q7 ruling; route A, after a probe)

The owner now lets cloud sessions read drawings. The public repository still never holds drawing content.
`research/cloud-drawings.md` recommends **route A**, and **nothing is proven yet**:
- **Route A:** a private GitHub repo `vextrus/vextrus-drawings` holding only the two Development Sets (72 MB raw,
  64.25 MB gzipped; largest file 26.6 MB, so no LFS); a fine-grained token (Contents read-only, that repo only, 90-day
  expiry) as `VEXTRUS_DRAWINGS_TOKEN` in a second cloud environment `vextrus-drawings`. `scripts/cloud/session-start.sh`
  clones it in the background into `.private/reference/` only when the token is set, skips when the files are there,
  never echoes the token and prints `drawings: ok|missing`. **Never in `setup.sh`**: setup already takes 278 s of its
  ~300 s budget, and setup requests get no credentials (`docs-raw/cloud-environments.md:143,389,414`). Download time
  3–15 s is an unmeasured estimate.
- **The probe (Phase 3, ~5 min, after the owner's O9):** one cloud session with the token clones the repo with the
  token as an `http.extraheader`, then runs `uv run pytest -m needs_bwrap`. It records "clone ok / 403" and "bwrap ok /
  refused". The docs do not say whether the GitHub proxy lets a session clone a repo not attached to it
  (`:240,243`); bwrap 0.9.0 is in the VM but `-m needs_bwrap` never ran there.
- **Choosing the environment is unverified:** `--environment` is documented only for self-hosted `ccpool_` ids
  (VCC:124). One test at the probe. Fallback: the token lives in the one `vextrus` environment and `session-start.sh`
  clones only on `rd/*` branches (every session could then read a read-only, one-repo token; the owner's Q7 accepts
  that).
- **What moves once it passes:** D9/D10-type builders; `--no-post` runs and proxy loops (only if bwrap works);
  `drawing-analyst` for convention findings; practice runs of G1's script layer. **What stays local**, with reasons:
  the blind scorer and its keys (ADR 0041:29-30, 94-97); `post-status` (ADR 0041:14-17); posting runs under the accept
  rule (ADR 0041:22-24); the G1 gate walk and its verdict (its screenshots are content; its verdict feeds a status
  only the local poster sets); Held-out Sets (ADR 0013:25-27); Jev calls carrying drawing text from any set but
  the two Development Sets (ADR 0013, as amended
  by Q23 on 5 Oct 2026); content-bearing results, because no private return channel from the cloud is proven
  (Remote Control +
  SendMessage has not run live).
- **Guards with it:** a drawing ticket's prompt forbids PR comments and every push but code; `watch.py` leak-scans the
  PR comments and bodies of drawing-environment sessions with the local literal scan (built-in GitHub tools post
  outside Bash, `docs-raw/cloud-environments.md:318`); the owner rotates the token each milestone.
- **Rejected routes:** attaching the drawings repo as a second repository (a multi-repo session loads no repo hooks,
  so the guard is off, `:272,492`); an encrypted archive in a release (403 for an unattached repo, `:243`; in the
  public repo's releases it breaks the public-repo law); a bundle upload (tracked files only). **If the probe gets a
  403:** route C, a non-GitHub store whose key is an API credential the session never sees (a new vendor: the owner's
  call), or drawing work stays local.

---

## 3. Every component, before → after

Each row names its tier (§9), its PR (§10), who builds it, and the check that proves it (red without its fix).
"Cloud" = a cloud builder; "local high" = a local builder at high effort with a refuter.

### 3.1 CLAUDE.md and `.claude/rules/`

| Part | Before | After | Files, PR, builder | Check | Tier |
|---|---|---|---|---|---|
| Five law lines | Account B for cloud (wrong since Q10); no line for the clock (C7: 4 of 6 sessions) or `pgrep` waits (C8: three times: S07, S09, and S12's cloud probe, STATE 18:10Z), though CLAUDE.md's own rule asks for one after two | "Account A runs the orchestrator and every builder." "Builders start, and cloud builders are messaged, only through `scripts.factory.launch`." "Time comes from `date -u`, never from memory." "Never wait with `pgrep -f` or `ps \| grep`; use Monitor on a log." "No 'walk now' to the owner without a passing G1 verdict on main's current product code." Each names only paths on main when f7 merges; the pointers to f2–f6's tools (`stamp`, the event log, `ready.py`, the walk-now hook) are added by the Phase 5 handover PR. | `CLAUDE.md`; f7; cloud | `tools/lint/docs_paths.py` (below) + review | obligation (finish line 6) |
| Two stale lines | CLAUDE.md:137 "The built-in `/code-review` and `/code-review ultra` review PRs" (the owner's `skillOverrides` turns it off, VCC:476); CLAUDE.md:43 Sonnet effort "defaults to `high`" (VCC:354: both default to medium) | "Second review lens: the adversary agent inside `/review-pr` (ADR 0042)"; "both models default to medium (VCC:354); set effort explicitly" | `CLAUDE.md`; f7 | review | obligation |
| One page | 149 lines: laws, commands, machine and harness detail mixed | **≤ 90 lines: the laws and a map.** Detail moves to `.claude/rules/*.md` with `paths:` frontmatter, which load only when matching files are touched (VCC:313); cloud sessions load rules too (VCC:337). `backend.md` (`paths: vextrus/**, engine/**, scripts/**, tools/**`), `web.md` (`paths: web/**`), `real-drawings.md` (`paths: engine/**, vextrus/takeoff/**, scripts/real_drawings/**, tools/scorer/**`), `factory.md` (`paths: scripts/factory/**, .claude/**`), `machine.md` (no `paths:`; always loaded: WSL, 127.0.0.1, the two Postgres roles). Every law stays in CLAUDE.md. | `CLAUDE.md`, `.claude/rules/**`; f7; cloud | `tools/lint/docs_paths.py`: every repo path named in CLAUDE.md, the rules and the skills exists (green on f7's head because f7 also fixes `real-drawings`' `scripts/score/`); CLAUDE.md ≤ 90 lines | path rule: obligation; length rule: 2 |

### 3.2 `docs/sdlc.md`

| Before | After | Files, PR | Check | Tier |
|---|---|---|---|---|
| `sdlc.md:112-114`: "three hooks … no orchestrator code, ledger, state store or evidence packs"; account B; "builders never push"; design gates on the seed | The owner's Q1 ruling: "Factory code is committed, tested and reviewed like product code. A harness change should remove as much as it adds." Cloud builders push their own branch only; local builders never push. The review cap is enforced by `merge_ready`. The definitions of done (§5). "Every walk finding of any severity becomes an issue." Names only paths on main when f7 merges (as §3.1). | `docs/sdlc.md`; f7; cloud | `docs_paths.py` | 2 |

### 3.3 Agents (`.claude/agents/`)

Model order is per-invocation, then frontmatter, then `CLAUDE_CODE_SUBAGENT_MODEL`, then the main model (VCC:501).
So every gating agent pins `model: opus`, and the workflows also name the model per stage (WF:423). A user-level
Sonnet default (Q9) therefore cannot downgrade a gate. Frontmatter `effort` overrides the session's level but not
`CLAUDE_CODE_EFFORT_LEVEL` (VCC:357, 199-200).

| Agent | Before | After | PR | Tier |
|---|---|---|---|---|
| **`builder`** (new) | `.private/work/session-11/common.md`, copied each wave; cloud cannot read `.private/` | `.claude/agents/builder.md`: `model: opus`; **no `effort` field** (frontmatter effort would override the launch's `--effort`, VCC:357); `skills: [verify, tdd]` (preloading on a main-session `--agent` is unverified, so the body also says "run the verify skill on the staged tree before each commit": your user setting turns Claude Code's own reminder off locally, VCC:502). The contract: make the acceptance tests pass and never change them; commit with explicit paths; cloud pushes only its own branch, at each milestone (a heartbeat) and at READY; local never pushes; finish with the `Factory-State` and `Factory-Verify` trailers; run long suites in the foreground with a timeout, never a wait loop; keep each suite's output in a file; the cloud web-test order (`export_openapi_schema` → `api:types` → `typecheck` → test, `cloud/RESULT.md` (h)); past the deadline, cut scope and name each cut. Cloud launch prompts begin "Follow `.claude/agents/builder.md`" (cloud loads the repo's agents, VCC:337); `--agent builder` with `--cloud` is unverified and not relied on. | f4 | **1 (T5)** |
| `tdd` skill line 22 | "confirm them with the user. No test is written at an unconfirmed seam." (prompt-audit finding 14: an unattended builder would stall) | "In an autonomous session the committed acceptance tests are the agreed seams: add tests at those seams or the module's public interface; never wait for the user." A lint test: no skill preloaded by a builder-facing agent says "confirm … with the user". | f4 | **1 (T5)** |
| `acceptance-writer` | `model: inherit`, `effort: medium`; `writer-common.md` in `.private/` | `model: opus`; **`effort` removed** (the launch sets it); `writer-common.md` folded in. Each `acceptance:` commit message carries `red-on-main: <n failed>` and `green-on-throwaway: <n passed>` (C3: ~29 amendments in six sessions). Writers launch at `high` by default (Q20, ruled); `medium` only for a docs-only ticket. Until f4 merges, a local writer at high effort is launched with `CLAUDE_CODE_EFFORT_LEVEL=high` (it outranks frontmatter, VCC:199-200) | f4 | **1 (T5)** |
| `pr-reviewer` | `inherit`; "sub-agents if you have them" (dead at spawn depth 1, VCC:500); "Run the suites on this machine … run the full suite together" (`pr-reviewer.md:33-42`) | `model: opus`, `effort: high`; the dead line goes; **locally it runs only the PR's changed test files and its own attack tests** (`pytest -rf <files>`), inside its review slot, through `flock .private/work/factory/pytest.lock` and the governor's `pytest` unit; full and web suites are CI's; where the PR meets another, it runs both PRs' changed tests on the merged slot; the session-04 history lines go (prompt-audit 8); the last line is `VERDICT: PASS\|FIX\|BLOCK at <40-hex sha>`; findings in public words. **In the cloud** (§2.2 "Launch, cloud review"; tier 2) it runs the full Python and web suites on its own VM instead, and writes the same last line into its verdict file | f4 | **1 (T6)**; cloud mode 2 |
| `refuter` | `inherit` | `model: opus`, `effort: high`; the same local-test rule (full suites in the cloud); last line `CONFIRMED`, `REFUTED` or `UNPROVEN`, also written into its verdict file in the cloud | f4 | **1 (T6)**; cloud mode 2 |
| `ux-critic` | ":26 walk on the seeded demo project unless told otherwise" (the C1 class) | `model: opus`, `effort: high`, `disallowedTools: [Edit, Write, NotebookEdit]`. G1's agent layer walks the real sets; the seed proves only a UI ticket's mechanics; session-04 history lines go (prompt-audit 8) | f5 | **1 (T7)** |
| `qs-critic` | `inherit`; "Rod Basis" | `model: opus`, `effort: high`, `disallowedTools: [Edit, Write, NotebookEdit]`; "Rebar Basis" (CONTEXT.md); the G1 burden lens | f5 | 2 |
| `drawing-analyst` | `inherit` | `model: opus`, `effort: high`; local, and in the `vextrus-drawings` cloud environment for convention-only findings once §2.4's probe passes | f4 | 2 |
| **`Explore`** (new) | the built-in, on the main model (Opus) | `.claude/agents/Explore.md`, `model: sonnet`, `effort: low`, read-only tools. A project agent named `Explore` overrides the built-in (VCC:314-315). Light look-ups go to Sonnet with no user-settings change | f4 | 2 |

**Out, with the reason:**
- `omitClaudeMd` (VCC:275-277): every reviewer must apply the laws (public repo, no drawing text). `qs-critic` may
  take it later (tier 3).
- `--restricted` (VCC:107-109): reviewers run as workflow agents, not CLI sessions, and `--restricted` ignores project
  settings, so the guard would not load. Read-only reviewers get `disallowedTools` instead.
- `memory:` (VCC:278-280): `memory: project` writes into the public checkout, and that folder is neither gitignored
  nor refused (VCC:472). f2 adds `.claude/agent-memory*/` to `.gitignore` and to the guard's staging refusal anyway.
- `isolation: worktree` (VCC:284-286): it takes the `worktree.baseRef` base; the launcher pins bases instead.
- `maxTurns`: a review cut off part-way is worse than a long one; the time budget bounds runaways.

### 3.4 Skills

| Skill | Before | After | PR | Check | Tier |
|---|---|---|---|---|---|
| **`verify`** (new) | none | `.claude/skills/verify/SKILL.md` calls `uv run python -m scripts.verify`. The script maps changed paths to the fast check: the changed modules' `pytest -rf`, `ruff`, `mypy`, `lint-imports`; web: `export_openapi_schema` → `api:types` → `typecheck`, then `lint`, `messages:check`, related tests (the cloud order, `cloud/RESULT.md` (g)–(h)); hooks: `node --test '.claude/hooks/**/*.test.mjs' 'scripts/factory/**/*.test.mjs'` (globs: Node 24 fails on a folder argument with "Cannot find module '<dir>'"). A failure of a test listed in `.github/flaky.txt` is recorded as `flake`, not a failure. Each run's output goes to a file. It writes `verify-<tree>.json` (`git write-tree` and every exit code) into `$(git rev-parse --git-common-dir)/vextrus/`, shared by every worktree of the clone and never committed, and prints the `Factory-Verify: <tree> ok` trailer only when all pass. In cloud, Claude Code also tells Claude to run a skill named `verify` before each commit (VCC:519; off locally by your user setting, VCC:502). That is an instruction, not enforcement (VCC:63): **the guard's READY push gate enforces it** (§2.2). | f4 | `scripts/tests/test_verify.py` (path → checks; record written; a listed flake recorded as flake) | **1 (T5)** |
| `orchestrate-wave` | 149 lines of prose (plus `states.py`, 46 lines); bare `claude --cloud` under account B (VCC:473); hand flocks; `pgrep` | **f6, always:** line 49's launch becomes `scripts.factory.launch cloud`, and account B goes (prompt-audit 13); f6 lands even if the rewrite is cut, because it carries the clock hook. **f6, tier 2:** rewritten as the orchestrator's runbook around §2.2's commands: governor → writers → launch → watch → `/review-pr` → land → G1 → measures; budgets; when to ask the owner; the G1 rule. About half its length. `states.py` stays (it prints run states without drawing text). | f6 | `docs_paths.py`; headless prompt-audit shows no conflict with CLAUDE.md | line 49: obligation; rewrite: 2 |
| `real-drawings` | gives the posting run to the owner; names `scripts/score/` (VCC:446-450; it makes `docs_paths.py` red) | `tools/scorer/`; the orchestrator runs posting and scored runs under the accept rule (ADR 0041); the lock's command is added by the Phase 5 PR | **f7** | `docs_paths.py` | obligation |
| `product-review` | "Rod Basis"; `resize_page` (against CLAUDE.md's shared-browser rule) | "Rebar Basis"; per-page `emulate` only; it is G1's agent layer, starting from the script's state | f5 | review | **1 (T7)** |
| Matt Pocock's set and other prompt-audit findings | `/setup-matt-pocock-skills` (deleted) named in `ask-matt`, `spec-review`, `to-spec`, `to-tickets`, `triage`, `wayfinder` and `MATT-POCOCK-SKILLS.md`; `/grill-me` in `ask-matt`; `resolving-merge-conflicts/SKILL.md:14` "Stage everything"; `handoff`'s `/tmp` (7); `diagnosing-bugs`' pressure line (9); `spec-review`'s word cap (10); `to-spec`'s shouting (11); outside its scope, `docs/agents/issue-tracker.md` "private" and `docs/architecture.md:149` `scripts/score/` | the audit's proposed hunks for findings 2–11 applied; named paths only. Flags 15–21 go to the owner as one list in the Phase 5 handover (decisions, not edits) | f7 | headless `/doctor prompt-audit` shows 0 high findings | 2 |
| Unused skills | `/skill-doctor` lists 14 project skills with 0 uses, but it ran in a fresh headless session, so the counts do not show disuse | The owner looks once; model-unused ones get `disable-model-invocation: true` (VCC:310-312). Nothing is deleted without the owner. | — | — | 3 |

### 3.5 Hooks (each only as VCC says it behaves)

`.claude/settings.json` is owned by f6, with one exception: f2 owns its `permissions` block (the secret and stamp
denies, §3.7). The guard's registration is pinned: `tools/lint/hook_paths.py` (f2, tier 1) asserts the PreToolUse
entry equals the expected literal (matcher `Bash|Edit|Write|NotebookEdit`, command, timeout), the deny list holds
every secret rule, and every hook command file exists. f6 lands after f2, so its CI runs that lint, and its
`settings.json` diff goes to a refuter. A conflict between the two blocks is resolved in a merge commit, which
`merge_ready` sends back for review (§2.2 (a)).

| Hook | Behaviour relied on | After | PR | Check (red without the fix) | Tier |
|---|---|---|---|---|---|
| **Clock** (`clock.mjs`) on UserPromptSubmit and SessionStart | stdout reaches Claude on both; UserPromptSubmit also fires on background reports and cross-session messages; 30 s default (VCC:237-245) | prints `now <UTC> · session h:mm/<budget> · phase <name> h:mm/<budget>` from `.private/work/factory/session.json`, or `ticket <t> n/m min` from the builder's own budget record; one quiet line when neither exists. It is the only surface that puts the time in the model's context; the status line and the band are for the owner's eyes. | f6 | `clock.test.mjs`: elapsed from a fixture budget; missing file → "no budget set", never a crash | **1 (T8)** |
| **Watcher restart** (`watch-start.mjs`) on SessionStart | stdout reaches Claude (VCC:237-242) | main checkout only: restarts `watch.py` detached when its pidfile is stale, and says so | f6 | `watch-start.test.mjs`: a stale pidfile → one start; a live one → none | **1 (T8)** |
| **Status line** (`scripts/factory/statusline.mjs`, f8) | `statusLine {type: "command", command, refreshInterval}`; refreshes on each assistant message (VCC:265-269) | set **only for the orchestrator**, in `scripts/factory/orchestrator.settings.json` (passed with `--settings`, which outranks user settings, VCC:154), so your own status line stays in every other session. One line from `status.json` and stdin: clock vs budget, disk, swap, lock holder and waiters, builders by state, open review rounds, G1 state of main, "status n min old"; it prints **WATCHER DOWN** when `status.json` is over 3 min old | f8 (script), f3 (`orchestrator.settings.json`) | `statusline.test.mjs` on a recorded stdin and f0's sample `status.json`; a missing or stale file prints the clock and WATCHER DOWN | **1 (T8)** |
| Builder Stop nudge (`stop-gate.mjs`) | Stop: `decision: "block"` + `reason`; Claude Code overrides after 8 blocks in a row (VCC:223-228); a timed-out hook fails open (VCC:212) | Only when `CLAUDE_PROJECT_DIR` is not the main checkout (keyed on the project folder, not `cwd`, which follows `cd`, VCC:252-253). A stop with uncommitted tracked changes and no trailer, or a READY trailer with no green verify record, is blocked once with "commit with explicit paths and run verify, or finish `Factory-State: BLOCKED` with a reason". **A nudge, not the wall:** the guard's push gate is the wall (§2.2). | f6 | `stop-gate.test.mjs`: READY with no verify record → block; BLOCKED → allow; main checkout → no-op | 2 |
| Walk-now gate (`walk-gate.mjs`) | Stop input `last_assistant_message` (VCC:223) | Only in the main checkout. A message matching "walk now", "ready for your walk" or "please walk" is blocked unless `python -m scripts.walk.ready origin/main` exits 0. If `scripts/walk/ready.py` is absent it blocks, saying G1 is not installed (fails closed). The law line and `ready.py` stand without it. | f6 | `walk-gate.test.mjs` | 2 |
| PreCompact dump (`precompact.mjs`) + SessionStart `compact` | PreCompact (manual\|auto), command type (VCC:254); SessionStart `compact` stdout reaches Claude (VCC:237-242) | writes the branch, head, budget, open rounds and the last STATE lines to `.private/work/factory/precompact-<utc>.md`; SessionStart `compact` prints the newest back | f6 | `precompact.test.mjs` | 2 |
| Guard self-test (`selftest.mjs`) on SessionStart | a missing or mistyped hook path silently disables a gate (VCC:216-217) | feeds `guard.mjs` one known refusal (`git push --force`); prints a loud warning if it is allowed | f6 | `selftest.test.mjs` with a stub guard that allows → warning | 2 |
| `after-bash.mjs` test | `after-bash.mjs` has no test (ratchet 1c) | `after-bash.test.mjs` | f6 | the test | 2 |
| SubagentStop verdict gate | `agent_type`, `last_assistant_message`; a block sends the reason to the subagent (VCC:229-232) | `pr-reviewer` must end with its `VERDICT` line; `refuter` with its verdict; `acceptance-writer` with both counts | f6 | `verdict-gate.test.mjs` | 2 |
| StopFailure log (`stop-failure.mjs`) | output ignored, no decision (VCC:233) | appends `<UTC> STOP-FAILURE - <error_type> <session8>` to `events.log` (`VEXTRUS_FACTORY_DIR`, else the main checkout's `.private/work/factory`; nothing in the cloud without it), so an API-error death is told from a finished turn; never the error text | T-SETTINGS | `stop-failure.test.mjs` | 3 (done) |
| Notification `agent_needs_input` | fires mainly while the agent view is open (VCC:234-236) | **OUT**: the watcher reads `state` and `waitingFor` instead | — | — | — |
| WorktreeCreate (a database per worktree) | it replaces git's default and fails on any non-zero exit (VCC:246-247) | **OUT**: one bug would block every worktree. The local launcher makes the worktree and its database itself; tests name their own database (xdist, session 13) | — | — | — |

CI runs every node test (f1 changes the harness step to `node --test '.claude/hooks/**/*.test.mjs'
'scripts/factory/**/*.test.mjs'`; globs, because Node 24 fails on a folder argument with "Cannot find module
'<dir>'"), and f1's shard and coverage lint (`tools/lint/ci_shards.py`, tested in `test_ci_shards.py`) parses those
globs from `ci.yml`'s harness step (line by line, no YAML parser, §3.9) and fails if any `*.test.mjs` under
`.claude/` or `scripts/` matches none of them. Writers put node tests
under `.claude/hooks/tests/acceptance/` and python tests under `scripts/**/tests/acceptance/` and
`tools/**/tests/acceptance/`, which `tools/lint/acceptance.py`'s pattern already guards (`(^|/)tests/acceptance/`), so
a builder cannot change them.

### 3.6 The guard, repaired (PR f2; local, high effort, a refuter; tier 1, T3)

Every rule below is a case in `guard.test.mjs`, red before the change. Every `ALLOWED` line of
`M/guard-gaps-probe.txt` becomes a refused case. A refuter attacks the new rules with other spellings before the PR.
- **The empty project folder:** `||` instead of `??` for `CLAUDE_PROJECT_DIR` (`guard.mjs:9`, `state.mjs:9`); the
  key-user lines are refused when it is empty. The test runs with `cwd` = the main checkout and
  `CLAUDE_PROJECT_DIR=""`, and again from `/tmp` (cwd-independent).
- **Secrets:** `.pgpass` and `.config/gh/hosts.yml` join `SECRET_FILES`. Any verb naming a secret file is refused, not
  only readers (`cp`, `base64`). `os.environ[…KEY…]` and `process.env.*KEY*` inside `-c`/`-e` code are refused.
- **Pushes:** a refspec starting `+`, a `:<ref>` refspec, `--delete`/`-d`, `--mirror`; `git -c k=v` or `--git-dir=`
  before the verb no longer hides it. **Local builders never push** (project folder is not the main checkout and the
  session is not cloud). **Cloud sessions** (`CLAUDE_CODE_REMOTE=true`, which settings cannot fake, VCC:416) push only
  `HEAD` to their own branch, never `main` (GitHub's proxy does not limit branches, VCC:324-325). **The main checkout**
  pushes only with a leak stamp for the pushed range (T2). **Any push of a head whose message carries
  `Factory-State: READY`** needs `<git-common-dir>/vextrus/verify-<HEAD's tree>.json` with every exit code 0 (T5).
- **Hooks:** `core.hooksPath` set through `-c` or `git config` is refused, except `git config core.hooksPath
  scripts/git-hooks` in the main checkout (the orchestrator sets it once after f2 merges, so the pre-push hook runs);
  `--no-verify` stays refused.
- **Local discards:** `reset --hard`, `checkout -- <dir|.>`, `restore <dir|.>`, `branch -D`, `worktree remove
  --force`, `stash drop|clear`, each refused with the lawful path (ask the owner).
- **Recursive deletes:** `/bin/rm -r…`, `\rm`, `find … -delete`, `find … -exec rm`, `shutil.rmtree`,
  `rmSync(…recursive…)`, at any position and inside `-c`/`-e` code.
- **Self-matching waits (C8):** `pgrep -f` or `ps … | grep` inside `while`/`until` is refused, pointing to Monitor on
  a log.
- **Sessions:** every raw `claude … --cloud` (with or without `-p`), so all cloud traffic passes the launcher's leak
  scan; `--resume <id>` whose id is not a full UUID (C9); raw `claude … --bg|--background` once
  `scripts/factory/local.py` exists in the main checkout (so f2 can land before f3): "use `scripts.factory.launch`"
  (the launcher runs `claude` as a subprocess, which the guard never sees).
- **Review and stamp records:** `scripts.ledger record` (or `scripts/ledger.py record`) outside the main checkout's
  project folder; any command naming `leakscan/ok` that is not `python -m tools.leakscan`; `npm … test` and `vitest`
  inside `.private/work/factory/review/`.
- **GitHub writes:** `gh pr|issue create|edit|comment` with inline `--body`/`-b` text longer than a short title is
  refused; `--body-file <f>` needs the leak stamp for the file's hash (T2). In cloud sessions every `gh pr|issue
  comment|create|edit|review` and `gh api … /comments` is refused. **This is defence in depth only:** cloud's built-in
  GitHub tools post comments outside Bash (`docs-raw/cloud-environments.md:318`), so the local ledger, not any
  comment, is what `merge_ready` trusts.
- **Staging:** `.claude/agent-memory*/` joins the staging refusal, and so does staging a whole folder that holds
  drawings (`git add vextrus/seed/` passes today); stage files by name.
- **The Read tool** is outside the guard's matcher, so `~/.pgpass` can be read with it today; the deny rules (§3.7)
  close that.

**Dropped from the base design:** its `HARNESS_EDITED` rule (refuse harness edits unless an env var reached the
session). Whether an env var reaches a `--bg` session is unverified, and it would have blocked every cloud harness
ticket. Its job moves to the pinned hook registration (`hook_paths.py`), the guard self-test and the review. The
first draft's `harness` label in `merge_ready` is also dropped: the orchestrator set it for itself, so it proved
nothing.

### 3.7 Permissions

| Item | Decision | Why (VCC) | PR | Tier |
|---|---|---|---|---|
| Secret reads | **IN** (project `permissions.deny`): `Read(~/.pgpass)`, `Read(~/.bashrc)`, `Read(~/.bash_profile)`, `Read(~/.profile)`, `Read(~/.zshrc)`, `Read(~/.claude/.credentials.json)`, `Read(~/.config/gh/**)`, and the same as `Edit(…)` | a Read deny also covers `cat`, `head`, `tail`, `sed`, `tee` and redirections, but not scripts (VCC:165-167); the guard covers scripts; a deny wins at every level (VCC:158-161) | f2 | **1 (T3)** |
| Stamp and ledger records | **IN** (project `permissions.deny`): `Edit(//home/riz/vextrus-cubit/.private/work/leakscan/ok/**)` and `Edit(//home/riz/vextrus-cubit/.private/work/factory/ledger/**)` (an Edit deny also covers `tee` and redirections, VCC:165) | a stamp an agent could write would make the leak wall one write deep; the scanner and `ledger.py` write them as subprocesses, which the deny does not touch | f2 | **1 (T2, T6)** |
| Local builders' pushes and posts | **IN** in `scripts/factory/builder.settings.json` (passed with `--settings` as an absolute path): deny `Bash(git push *)`, `Bash(gh api *)` and the write verbs of `gh pr` and `gh issue` (`create`, `edit`, `comment`, `review`, `merge`); reads stay allowed | `--settings` is carried into background sessions and across supervisor restarts, not by `--resume` (VCC:170-174), so `say.py` passes it again; such a deny "isn't a security boundary" (VCC:162-163), so the guard is the wall | f3 | **1 (T4)** |
| Builders' plugins | **IN** in the same file: `enabledPlugins: {"vextrus-factory@inline": false}` (VCC:422; keeps the orchestrator-only mod off a builder even if `--plugin-dir` leaks), and `"cc-plugin-you-should-know@builtin": false` (**unverified** key form: one test, `claude plugin list` in a session started with that `--settings`) | command-line settings outrank user settings (VCC:154-155) | f3 | 2 |
| Local builders' prompts | **IN, one test first:** `--permission-mode dontAsk` on local `--bg` builders | VCC:493 documents it as the background alternative ("auto-denies every call that would otherwise prompt", VCC:179-180), so a refused call shows in the transcript instead of leaving the builder `blocked` | f3 | 2 |
| Shared browser | **IN** in `.claude/settings.json` and `builder.settings.json`: `permissions.deny` `mcp__chrome-devtools__resize_page` (the bare form; a rule with parentheses on an `mcp__` name is skipped at load) | the guard does not judge MCP calls (PreToolUse matcher), and a deny wins over the server-wide allow: measured on Claude Code 2.1.289 on 5 Oct 2026. Probe: a stub stdio MCP server named `chrome-devtools` exposing `resize_page` and `emulate`; `claude -p --mcp-config <stub> --strict-mcp-config --settings <file> --output-format stream-json --verbose`; read the `init` tool list. With allow `mcp__chrome-devtools` and the deny, only `emulate` was listed and a `resize_page` call got "No such tool available"; with the allow only, both were listed and both ran | T-SETTINGS | 2 |
| `Bash(git push *)` deny in project settings | **OUT** | it would bind the orchestrator too, and it is no boundary (VCC:162-163) | — | — |
| Sandbox (`sandbox.*`, `sandbox.credentials`) | **OUT** | on WSL2 a sandboxed `127.0.0.1` does not reach host servers, and a call with a file redirect stays sandboxed (VCC:188-190), so `uv run pytest -rf > .private/work/…` (a CLAUDE.md rule) would lose PostgreSQL; `mask` is dropped from project files (VCC:185-187) | — | — |
| `permissions.blockReadsOutsideWorkingDirectories` | **OUT** | it gates file tools, not the shell (VCC:175), and would block real-drawing agents reading the real-drawings cache | — | — |

### 3.8 Workflows (`.claude/workflows/`, run as `/<name>`, input in `args`; VCC:302-305)

`Date.now()`, `Math.random()` and a no-argument `new Date()` throw in a workflow (VCC:302-303), so times come from
`args` or from the agents. `tools/lint/workflows_js.py` (f4) refuses those calls, runs `node --check`, and refuses a
workflow named like any built-in command or alias in `docs-raw/commands.md`'s list (`review`, `help`, `run`, …).

The review itself is no longer a workflow: ADR 0043 supersedes ADR 0042's review part with
`uv run python -m scripts.factory.review run <PR> --round <n>` (no model on allowlist-only or docs-only PRs).

| Workflow | What it does | PR | Check | Tier |
|---|---|---|---|---|
| **`review-pr.js`** (`/review-pr <PR> <head> <round> [exception]`) | 0. An agent runs `scripts/ledger.py check <PR> --round n [--exception security75\|crash\|false-statement\|fix-regression --reason "<text>"]` (round 3 refused without an exception) before any other agent starts. 1. An agent checks out the head merged with main (and any PR it meets) in a free review slot (§2.3). 2. In parallel: `pr-reviewer` with the ticket's authority and its trust-boundary focus; a **second, differently prompted adversary lens** ("find the failing scenario a QS meets"); `ux-critic` as the words gate when `web/src/messages/**` changed, or the walk for a UI PR. Each runs only changed and attack tests locally. 3. A `refuter` on **every finding scored 50 or more**, before it reaches the builder (refuted findings no longer cost a round). 4. One ranked list and one fix message. 5. An agent writes the reviewers' final lines to a file and runs `scripts/ledger.py record --from <file>`; `ledger.py` computes the verdict. Then (tier 2, shadow, once f9 is on main) it runs `python -m scripts.factory.jev triage --from <file>`, which writes Jev's P(real) and severity per finding to the sidecar; nothing reads it for a decision (§3.14). Every stage names `model: 'opus'` (a model the script names counts as the per-invocation model, WF:423). Several PRs go through one run with `parallel()`. | f4 | `scripts/tests/test_ledger.py` (round 3 refused; exception recorded; `decide` from fixture lines; a PASS with a finding ≥ 50 unrefuted is refused); `test_merge_ready.py` (a well-formed marker comment with no ledger file is refused); `workflows_js.py`; the live proof is the first review run through it after f4 merges, cited in Phase 4 | **1 (T6)** |
| **`real-set-walk.js`** (`/real-set-walk <sha>`) | Starts only when `.private/work/walks/<sha40>/walk.json` exists (the orchestrator started `scripts/walk/run.py <sha>` detached and watched it through `events.log`; no long shell inside a workflow agent). Takes the served URLs from `walk.json`. `ux-critic` (by eye) and `qs-critic` (burden) walk the same served stack, each on its own browser page selected by URL. A triage agent drafts issues **only from `scripts/walk/sanitize.py`'s allowlisted fields** (finish-line item, defect class, screen, numeric delta; no free-text field) and dedupes on (class, screen) against open `walk` issues, commenting the new sha on an existing one (session 13, tier 2: when the exact key finds no match, `jev same-issue` asks one noul per open issue title in one call; ≥ 0.8 comments, 0.3–0.8 opens a new issue saying "possibly the same as #n", < 0.3 opens a new issue; `Unavailable` opens a new issue). Evidence stays in `.private/work/walks/<sha40>/` under a finding id. The leak scan runs on every draft; then the verdict file is written. | f5 | `scripts/walk/tests/`: findings counted = issues drafted + dedup comments; a free-text field in a draft is refused | **1 (T7)** |
| `scored-loop.js` | proxy candidates (18 s each locally, `M/lock.md` §3; in the cloud once §2.4's probe passes) → only a head that gains on the proxy queues one scored run → each scored head records proxy delta against scored delta (the proxy's own accuracy, never measured until now). A class loop that could use Jev first runs a 40-item live Jev probe (~$0.005, ~1 min, estimate) and ships a node only if it beats the reader on labels (§3.14) | session 13, with S2 | `tools/proxy/tests/` | 2 |
| `research.js` | one question per Sonnet agent, a refuter per load-bearing claim, one cited file | — | — | 3 |

### 3.9 CI

| Item | Before | After | PR | Check | Tier |
|---|---|---|---|---|---|
| **Python job split** | one serial job, 24.6 min median (1.8 min on 28 Sep, `M/ci-python-trend.txt`); #237 cancelled at 35.3 min | **`ci.yml` and `.github/ci-shards.json` only**, with **no new dependency** (no YAML parser: `tools/lint/workflows.py:23` reads workflows without one, and adding one would touch `pyproject.toml`/`uv.lock`, engine paths). `python` becomes a 4-shard matrix read with `fromJSON` from the shard file, under the existing required `ci` aggregator (`needs.python.result` covers every leg), so no ruleset change. Shards by measured seconds on main (`M/ci-main-by-module.txt`: takeoff 729 s, seed 217, platform 104, drawings 71, the rest ~292): takeoff acceptance; takeoff rest; seed + platform + drawings; everything else via `--ignore` of the others, so a new folder can never drop out. Lints, mypy and migrations run once. Each shard keeps `-p tools.lint.acceptance_pytest` and `timeout-minutes: 25`. Estimates: ~9 min wall on main (largest shard ~390 s of tests + ~1.3 min setup); ~15 min on #237's head as it stands, less after its seed fix. Billed minutes stay about the same (public-repo runners are free). The harness step runs every node test (§3.5). | f1; cloud, medium | `tools/lint/tests/test_ci_shards.py` reads the JSON: the shards' union equals every test root, no folder in two (red if a folder is in none); f1's diff touches no file in `.github/engine-paths.txt`; python wall time before/after in the PR body | **1 (T1)** |
| **#237 diagnosed** | "times out" | In f1's body: #237's job was cancelled at 35 min at 53 % (attempt 1) and 34 % (attempt 2) of its tests; a full run would take 39–41 min (estimate). To the cancel point it spent 14–15 min more than main: +644–655 s in files that seed the demo (`test_step1_confirm` 128 → 285–315 s, `test_seed_drawings` 47 → 168–178 s, `test_step1_api` 70 → 163–183 s, `test_every_row_state` 97 → 233–257 s) and +195–213 s in its own new files (`research/verified-measures.md` §0.1, §1.2). **Cause (confirmed by profile):** the demo seed is a function-scoped fixture rebuilt for every test that asks for it (88 tests on main, 103 on #237), and on #237 each rebuild runs the product's real read job: its drawings step takes 18.3 s against 4.6 s under the profiler, with 11,229 SQL calls against 3,633. The shards let #237 land. **The fix** (seed once per module for the tests that only read it; a savepoint per test for the rest; estimate ~8–9 min saved on #237, ~3–4 on main, up to ~19 / ~6.5 min with savepoints, not yet checked) lands with #237 in session 13's lane A, in two steps (§6). Cheaper read-job queries (488 `_no_plot_yet` and 965 access-check calls per seed) also speed real reads: an issue. | f1 (diagnosis); session 13 (fix) | the numbers are tool output | **1 (T1)** |
| **#245 flakes** | 18 of 262 web jobs failed, 16 of them flakes; main failed 6 of 101 pushes, all flakes; the web job tripled in a week (p50 94 → 319 s) | Root causes found (`M/web.md` §2): the t16 pan test reads a half-drawn frame as "settled" (reproduced locally); the Plot test's `openSheet` and the acts toast wait on Testing Library's 1 s default under CI's load. **Fixed in f1, so every Phase 3 PR lands through a quieter web job:** `configure({ asyncUtilTimeout: 5000 })` in `web/src/test/setup.ts` (one line, covers the class); `acts.test.tsx` waits up to 5 s (the builder); the t16 pans wait for the condition and `openSheet` gets an explicit timeout (acceptance files: **f1's writer only**, a one-path `acceptance:` commit). `.github/flaky.txt` lists the three until main's web job is green on 5 pushes in a row; `land.py` (or the orchestrator by hand before it) reruns a job at most once for a listed flake, recorded. Splitting the normal and slowed Vitest runs into two jobs (~100–125 s off the critical path, estimate) is an issue. | f1 | a test that holds the frame mid-drag and asserts the helper waits; main's web job green on its next 5 pushes (a measure, not a gate) | **1 (T1)** |
| **Slow-file report** | none (a 35-min timeout named nothing) | each shard writes JUnit XML; `tools/lint/slow_files.py` (not `test_*.py`, which pytest would collect: `pyproject.toml:83` lists `tools` in `testpaths`) prints the 20 slowest files and raises a GitHub warning for any file over 180 s; it fails only above 600 s (estimate) | f1 | `tools/lint/tests/test_slow_files.py` on a fixture XML | 2 |
| **xdist with a database per worker** | every run and worker share one test database | `vextrus/testing/database.py` takes pytest-django's per-worker suffix and adds a short hash of the checkout path; fixed ids for the 2 random-id tests (`M/xdist-unstable-ids.txt`); `acceptance_pytest` made xdist-aware (today it **fails open** under xdist, `M/xdist.md` problem 3); `tmp_path_retention_policy = "failed"` (#243); `pytest-xdist` locked; `-n auto` per shard. Measured with an untracked shim: the whole suite 1,276 s → 385 s at `-n 8` (3.3×), 0 failures, about 3 GB more memory (`M/xdist-n8all.txt`). **An engine PR (uv.lock, pyproject.toml, vextrus/drawings), so it moves to session 13's lane A**, beside #237's test-database seam | session 13 | `vextrus/tests/test_test_database_names.py` (two workers and two checkouts get four names; red on main); the acceptance plugin's deselection test under `-n 2` exits 1 (red today, `M/xdist-accplugin-n2.txt`) | 2 |
| **e2e** | `workflow_dispatch` only; never run (0 runs, `M/e2e.runs.txt`) | `push: main` and nightly first. It moves to PRs (path-filtered to Step 1 and drawing paths) only after 5 green runs on main, because `merge_ready` refuses any failed check | f5 (`e2e.yml`) | 5 green runs | 2 |
| **Leak structural check** | none | `tools/leakscan/tests/test_tracked_tree.py` in the normal pytest run: no tracked file starts with DWG or DXF magic bytes, no tracked path under `.private/`. It cannot see drawing text: the corpus is drawing text and must never reach CI | f2 | the test with a planted fixture | **1 (T2)** |
| GitHub Actions self-hosted runners | — | **OUT**: a public repo would run untrusted PR code on this machine | — | — | — |

### 3.10 The real-drawing check: G5, S1 and S2 in one custody re-run

- **For session 13's walk, G5 is measured by the G1 script** from the screen and the API on a real read (§5):
  Questions per Discipline by kind, bulk-confirmable share, act time while a read runs. That needs no export change in
  an engine path and no custody re-run. It is part of T7 (tier 1).
- **The export-level G5, S1's scorer diagnostics and the S2 proxy come as one PR in session 13's lane A** (local,
  high, a refuter), beside the critical path, not on it:
  - `vextrus/takeoff/services/export.py` gains a counts-only `burden` block; `scripts/real_drawings/diff.py`'s
    MEASURES gain Questions per Discipline, bulk-confirmable share, one-source share, continuation Questions, plan
    Sheets with no storey stated, proposed leave-outs; each has a limit from Q5, and a measure past its limit counts
    as "lost" under the accept rule unless judged.
  - `tools/scorer/` gains, counts only: kind-confusion pairs, box-error direction, failing Views by class, and an
    `--agreement` mode scoring a second keyer's blind drafts against the keys in aggregate (S1's true ceiling).
  - `tools/proxy/` (not custody): the cached decode keyed by file hash and reader code hash, `sheets.find` +
    `views.find` only, a private proxy key from the analyst's boxes. Measured: 18 s warm; it matched the job's 288
    Sheet numbers and 1,184/1,184 Views (kind, box, title); the other Sheet fields and View subjects were not
    compared, and today it keys its cache by file path, which must become (content hash, reader code hash) first
    (`research/verified-measures.md` §4.4).
  - **The Jev replay seam (J2, §3.14):** Jev answers recorded outside the sandbox, keyed by the product's own
    content-addressed cache key (`vextrus/platform/services/jev.py:306-313`), in a per-run answer file under
    `.private/`; the scored run replays them, and a miss answers `Unavailable` and is counted. No key enters the
    sandbox. Without it every Jev node scores as `Unavailable` (`scripts/real_drawings/sandbox.py:3`;
    `engine/harness.py:58`). Q24 asks the owner.
  - **One custody re-run**, asked once after it merges (Q6). If Q16 is yes, the narrower cache key rides the same
    re-run; so does J2.
  - **S1's scorer diagnostics gate every Sheet-field loop:** no storeys, title, Discipline or date loop starts before
    they name the failing convention (`research/bar-90.md` §2.1).
- **Why not in Phase 3:** it touches engine and custody paths, so it would owe a posting run, a builder's `--no-post`
  run and the owner's root re-run inside Phase 3. Another design estimated about 2 h of serial lock for that
  (`design/design-quality.md:615`). The walk's burden numbers do not need it.

### 3.11 Decide IN or OUT

| Item | Decision | Why (VCC) |
|---|---|---|
| `worktree.baseRef` | **OUT** | `fresh` is a cached `origin/HEAD` refetched only after 24 h; `head` is the launching checkout (VCC:490). No component uses `--worktree` or `isolation`; the launcher fetches and pins `origin/<branch>`, and a `--bg` inside a linked worktree stays there (VCC:192) |
| `/goal` as builder completion | **OUT** | `claude --bg "/goal …"` is undocumented; the evaluator reads no files and runs no commands; it is skipped while a background shell runs (VCC:492). Completion = acceptance green + the verify record + the guard's push gate + review |
| `--permission-prompts none` | **IN for `-p` utility calls only** (the usage reading, headless checks) | print mode only; `--bg` rejects `-p` (VCC:114-115, 493). For local `--bg` builders, `--permission-mode dontAsk` (§3.7, one test) |
| `claude agents --json` (`waitingFor`) + resume by full id | **IN** for local sessions | the supported read of session state; `sessionId` is the full UUID; `done` is not `blocked`, and a `done` session with a `pid` is still alive (VCC:125-129, 294-296, 494-495). `waitingFor` was never seen live: one test in Phase 3; until then `blocked` is the signal |
| SendMessage `notify_when_idle` and Monitor | **IN**: notify for local builders; Monitor on the event log for everything | notify is refused for cloud targets (VCC:336, 496); Monitor's deadline is ≤ 30 min, re-armed (VCC:497) |
| `CLAUDE_CODE_TOOL_MEMORY_LIMIT` for CAD runs | **OUT** | "the kernel kills a command, and nothing in its result names the cap"; it may count child Claude Code processes; uncapped if the cgroup fails (VCC:498). A lost failure name is a mistake already made twice (CLAUDE.md). The CAD worker's own 4 GiB cap and the governor stay |
| `workflowSizeGuideline` | **OUT** | advice only (VCC:499) |
| `CLAUDE_CODE_WORKFLOW_MAX_CONCURRENT_AGENTS` | **IN = 8**, orchestrator only (`orchestrator.sh`; launchers drop it from children) | the runtime cap; more concurrency raises memory (VCC:499). 8 is an estimate pending one memory sample during a `/review-pr` run |
| Spawn depth | **keep the user's 1** | `pr-reviewer` stops relying on sub-agents (VCC:500); workflows fan out from the top |
| `CLAUDE_CODE_SUBAGENT_MODEL` + `Agent(model:…)` rules, `/tasks` as proof | **Frontmatter pins + per-stage models in workflows + a Sonnet `Explore` agent.** The env value is Q9. `Agent(model:…)` rules **OUT**. `/tasks`: optional, the owner types it once while `/review-pr` runs | frontmatter outranks the env; a named stage model is per-invocation (VCC:501; WF:423); `Agent(model:opus)` matches only the literal alias and never an omitted parameter (VCC:176-177); `/tasks` is interactive only (VCC:317) |
| A mod's `agent.spawn` setting a subagent's model | **OUT** | it can (VCC:428-429), but the mod is a display and crash-prone; routing must not depend on it. The mod registers no `agent.spawn` handler (§4) |
| `includeGitInstructions` | **No project override.** Your user setting is `false`, so the 2.1.286 run-`verify`-before-commit instruction is off in local sessions (VCC:502); cloud sessions do not read user settings and keep it. `builder.md` carries the rule, and the guard's push gate is the wall | overriding your user setting from the repo is your call, not the factory's, and the instruction is not a wall anyway (VCC:63) |
| PreModelSwitch hooks | **OUT** | they gate user model switches only and cannot route subagents (VCC:503) |
| `claude ultrareview <PR> --json` as a second gate | **OUT as a routine gate**; one free run on f2 (the guard) as reviewer input, if the owner agrees (Q18) | 3 free runs, then $5–25 each in usage credits; exit 0 "with or without findings"; the payload schema is undocumented (VCC:504) |
| `/code-review --max-findings` with a committed `REVIEW.md` | **OUT** | local `/code-review` does not read REVIEW.md (VCC:505); the bundled skill is turned off by the owner's `skillOverrides` (VCC:476). The second lens is the adversary agent inside `/review-pr` |
| Claude Code self-hosted environments (`claude self-hosted-runner`) | **OUT** | public beta for Team and Enterprise only; this account is Max (VCC:506) |
| `subagentPromptCacheTtl: "1h"` | **No change needed** | already set in your user settings (read today); subagents and workflow agents otherwise default to a 5-min cache (VCC:361-363) |
| PR auto-fix | **OUT** | it pushes outside the two-round loop under the owner's name (VCC:346-347) |
| Remote Control for the orchestrator | **IN** (Q7, ruled: "enabling Remote Control for most cases"); `remoteControlAtStartup: true` is already in your user settings (`~/.claude/settings.json:162`, read today; the key is not in VCC, Unverified 13) | it stores the transcript on Anthropic servers while connected (VCC:381); it is what lets the orchestrator's main conversation list cloud sessions and message them with a reply address (VCC:297-299; `docs-raw/cross-session-messaging.md:116,153,180`); the two variables that make it unavailable are never set (VCC:383-385). That it connects interactive sessions only is doc-quoted (`docs-raw/remote-control.md:182,197,221`; Unverified 13); a `-p` or `--bg` builder does not auto-connect (inference) |
| Ultracode on builders | **OUT** | the owner's mode for session 12 only (brief); builders take their ticket's effort |

### 3.12 What this removes, and what it adds

The owner's rule (Q1) is "a harness change should remove as much as it adds". **Phase 3 does not meet it: it adds far
more committed code than it removes** (about 60 new files against one committed file deleted). What it retires:
- `scripts/cloud/launch.py` and its test → `scripts/factory/launch.py` (one launcher, not two).
- `.private/work/session-11/common.md` and `writer-common.md` → `builder.md` and `acceptance-writer.md`.
- `.private/work/session-11/{land.sh, premerge.sh, premerge-tc.sh}` → `land.py`, `ledger.py`, `merge_ready.py`.
- `.private/work/session-12/stamp.sh` → `stamp.py` and the clock hook.
- `.private/work/session-11/lits2.py` (prints the text it finds) → `tools/leakscan` (never prints it).
- `.private/work/session-12/cloud/launch_probe.py` → `scripts.factory.launch cloud`.
- orchestrate-wave's launch, watch and review prose and its "Session 06's additions" → the scripts; the skill halves.
- About 60 lines of CLAUDE.md → `.claude/rules/`; every mention of account B.
- `docs/sdlc.md`'s "no orchestrator code" (Q1) and "builders never push" (cloud builders push their own branch).
- `ux-critic.md:26`'s "the seeded demo project unless told otherwise" for Step 1 and engine work.
- Builders' `--no-post` runs on the custody lock (3.45 h of session 11's lock) → the proxy, in session 13.
- `pgrep -f` wait loops, short-id resumes, hand-typed "elapsed n / budget" and memory-stamped STATE lines.
- Not added, after review: a committed proven-CLI list, a `harness` label rule, a project status line that would
  replace yours, and a subagent cache setting you already have.

**The accounting is measured, not claimed:** every Phase 3 PR body carries `Harness net: +a / −r` from `git diff
--numstat origin/main...HEAD -- .claude scripts tools .github` (three dots: the PR's own changes since its merge
base). Phase 4's table sums them and names each net-positive PR to the owner once.

### 3.13 The ratchet's debts (every N or P row of `M/ratchet.md` §1)

f7 posts this list to milestone issue #45, as ADR 0041 item 7 requires. "Issue" rows are filed at approval (§8).

| Lesson or class (ratchet row) | Covers today | Its check in this spec, or the issue |
|---|---|---|
| Recursive deletes (1a) | P | the guard's delete rules (f2, T3) |
| Shared chrome-devtools browser (1a) | N | `test_p6_settings.py` (the `resize_page` deny, T-SETTINGS) |
| Design gate: keys and empty routes (1a) | P | issue "factory: route sweep (every route non-empty; tab order reaches each primary act)" |
| Words gate (1a, C5, the reading ticket in 1c) | P | issue "factory: merge_ready words-review marker for web/src/messages" |
| A failure's name lost (1a) | P | issue "factory: Vitest and Playwright failure-log reporters" |
| C1 proved on our own seed | N | G1 (f5, T7); `ux-critic.md:26` changed (f5) |
| C2 contract drift | P | G2a (session 13): issue "factory: G2a: fakes validated against OpenAPI; closed Literal keys"; f0's contracts for the factory's own seams |
| C3 wrong acceptance tests | N | the counts lint (f4, T5) |
| C4 a fix regresses the next blocker | P | G1 after every wave (T7) |
| C6 a check that cannot fail | P | export-level G5 (session 13): issue "factory: reading measures (export G5, S1 diagnostics, S2 proxy) in one custody re-run" |
| C7 clock from memory | N | `stamp.py` + the clock hook (T8) + a law line (f7) |
| C8 self-matching waits | N | the guard's wait rule (f2) + a law line (f7) |
| C9 resume duplicates | N | the guard's short-id rule (f2); the launcher's `--name` refusal (f3); `say.py`'s pid rule (tier 2) |
| C11 drawing text near git | P | the leak wall (T2) |
| C12 CI and local differ | P | #245 fixed (f1); shards (f1); issue "factory: shellcheck in the toolchain; its test fails instead of skipping" (`tools/scorer/tests/test_custody.py:59-61`) |
| C13 leftover test state | P | xdist's retention policy (session 13); issue "factory: session-start sweep of stale vextrus-test-storage dirs" |
| C14 each merge stales the next PR | N | `land.py` (tier 2); Q21; issue "factory: merge queue trial" |
| "Walk now" without walking first (1c) | N | a law line (f7) + `ready.py` (T7) + the walk-now hook (tier 2) |
| lessons.md stops at session 07 (1c) | N | f7 (an obligation); issue "factory: lessons.md Check-path lint" if `docs_paths.py`'s lesson rule is cut |
| Rounds past the cap (1c) | N | `ledger.py` + `merge_ready` (b) (T6) |
| The custody re-run blocks scoring (1c) | N by design | Q6 |
| D6 silent cuts (1c) | N | `merge_ready` (c) (T6) |
| Memory exhaustion (1c) | N | the governor (T4) |
| Disk full, no lawful cleanup (1c) | P | the governor's disk floor (T4); `scripts/owner/clean.sh` (f3) |
| CI flakes under load (1c) | N | f1 (#245 fixed; `flaky.txt`) |
| A duplicate score waiter (1c) | N | `rdlock` (tier 2); issue "factory: visible real-drawing lock queue" if cut |
| Commit, then sync: `after-bash.mjs` untested (1c) | P | `after-bash.test.mjs` (f6, tier 2) |
| "Resource-bound helpers" claimed, not found (1c) | N | issue "factory: find or write the resource-bound test helper lessons.md:180 claims" |
| Runbook debts (1c): `;`-chained commit after a failing edit | N | issue "factory: guard refuses `; git commit` after an edit command" |
| Runbook debts: `claude --bg -w` makes a branch; cloud `claude/<slug>` branches; messaging cloud builders | N | the launchers (f1, f3); the watcher's `claude/*` alarm (f3); `launch.py say` (f1) |
| Runbook debts: merge order; adversaries after each merge wave; scored branches frozen; "not pinned" rulings | N | `land.py order` (tier 2); G1 per wave (T7); `rdlock` (tier 2); `acceptance-writer.md` (f4) |

### 3.14 Jev in the factory and in the product (the owner's 20:2xZ requirement)

**What Jev is** (live docs, `research/jev-api.md` §1): a System One model that "does not generate text, write code, or
hold a conversation" (`introduction/coding-agents.md:13`); one endpoint, typed `noul` / `choice` / `score` answers
with probabilities, $0.042 per million input tokens, output free (`models.md:13,18`). So in the factory it is **a
function called by scripts and workflows, never an agent, a reviewer or a gate.** Its documented weak spots are
literal reading and adversarial state ("an injected instruction … can move the answer",
`model-jaggedness/jev-1.13.md:106`), and diffs and reports are attacker-reachable text in a public repo: **Jev
advises, sorts and routes; the guard, `merge_ready`, the ledger and the leak wall still decide.**

**Measured on invented factory tasks** (60 logged calls, all HTTP 200 from `jev-1.13.0`, plus one unrecorded smoke
call; refuter-corrected, `research/jev-api.md` §2 and `jev-api-raw.jsonl`): serial medians 0.31–0.34 s, p90 ≤ 0.37 s;
10 concurrent calls median 0.39 s, p90 0.43 s, all done in 0.51 s; about $0.0013 for the whole run. Accuracy against one
agent's labels on 8–18 items per task: is-the-finding-real 9/10; severity 4/5; READY/BLOCKED from free text 9/10
(literal); project-specific-vs-generic strings 18/18; where (cloud/local) 8/8; effort 7/8 (8/8 against the rubric
sent); same-defect-as-an-issue 10/10. **Not settled:** 8–18 items is a smoke test, not ADR 0011's ~30-item spot check;
the Sonnet comparison (1.3–1.7 s, ~$0.036 a call) is an unrecorded proxy with n = 2 and is not relied on.
**Re-checked live at this spec's final check** (4 Oct 21:02Z, the owner's local key, invented text): `GET
/v1/models` → HTTP 200 in 0.30 s, listing `jev-latest` and `jev-preview` (release 10 Sep) and no versioned id; one
`noul` call on `jev-latest` → HTTP 200 in 0.39 s, `"model":"jev-1.13.0"`, 299 input tokens. The pin still holds, and
the model watch must read a call's `model` field, not the model list (J-c).

**The factory's Jev steps** (each only where the measure shows it beats a rule or a model call; `Unavailable` always
equals the no-Jev run):

| # | Step | Beats | Where (tier, PR) | Check (red without it) | Fallback | Cost (estimate) |
|---|---|---|---|---|---|---|
| J-a | **The client** `scripts/factory/jev.py` (§2.2): pinned `jev-1.13.0`, cache, call log, 6 s deadline, cool-off | — | f9 (an obligation: the owner's explicit ask; exempt from the cut line), cloud, medium | `scripts/factory/tests/test_jev.py` on recorded answers: body over the limit refused, not cut; 429 retried inside the deadline; a missing key → `Unavailable` with no call; shapes validated; the key never in the log | — | — |
| J-b | **Review triage in shadow** (`jev triage`): P(real) and severity per finding, written to `.private/work/factory/ledger-jev/` beside the refuter's verdict | a model call: ~0.34 s against a Sonnet agent's seconds, typed | f9 (obligation); `/review-pr` stage 5 calls it | `scripts/tests/test_ledger_jev.py` (f4, needs no Jev import): `ledger decide` gives the same verdict with and without a sidecar present; f9's `test_jev.py`: a recorded `Unavailable` writes no sidecar | no sidecar | < $0.01 a session |
| J-c | **Jev model watch** (`jev models-check`): daily, one one-question `jev-latest` call whose `model` field names the version, plus `GET /v1/models`' `jev-latest` release date (the list names only the aliases `jev-latest` and `jev-preview`, never a version: measured live 4 Oct 21:02Z), plus every factory call's `model` field; `JEV-MODEL-MOVED` when the version leaves the one pinned in `docs/knowledge/jev-nodes.md` or the release date changes | nothing watches it today; ADR 0011 rule 3 asks for a re-measure on a model change | f9 (obligation); `watch.py` (f3) calls it daily | `test_jev.py` on a recorded `/v1/models` body | no alarm | ~0 |
| J-d | **Walk and cut-item dedupe** (`jev same-issue`) after the exact (class, screen) rule finds no match | the rule alone misses reworded duplicates (10/10, margins 0.73–0.93 vs ≤ 0.22) | helper in f9; wiring into `real-set-walk.js` and the cut-issue filing: session 13 (tier 2) | `scripts/walk/tests/test_dedupe_jev.py`: findings counted = issues drafted + dedup comments; `Unavailable` → every non-exact finding a new issue | a new issue | ~0 |
| J-e | **Leak advice** beside the wall: code extracts non-corpus proper-noun candidates; one batched noul call; P ≥ 0.8 prints `ADVISE <id>` (never the text) and `watch.py` alarms; **local only**, local key | the literal corpus cannot see a new or re-spelled proper noun (18/18 on invented strings) | `tools/leakscan`, session 13 (tier 2), local, before the first drawing-environment cloud session | `tools/leakscan/tests/test_jev_advice.py`: a corpus hit with P = 0.01 still refuses; an invented non-corpus noun with P = 0.97 prints ADVISE and no text; `Unavailable` = the no-Jev exit and output | the wall alone | ~0 |
| J-f | **Launch warning** (`JEV-DISAGREES` in the launch record when Jev's where/effort differs at confidence ≥ 0.9) | — (a warning, never a refusal) | `launch.py`, tier 3 | a launcher test on recorded answers | `jev=unavailable` recorded | ~0 |
| — | **Not Jev:** READY/BLOCKED (the trailer is exact), flaky tests (`.github/flaky.txt` is exact), anything that counts or compares numbers or dates, a PASS, dropping a finding | | | | | |

- **Routing by Jev comes only after a shadow wave:** J-b may send findings to a refuter (P(real) in 0.2–0.8, or
  severity ≥ high) only after ≥ 90 % agreement with refuter verdicts on ≥ 30 findings, recorded in ADR 0042's History.
  Jev never drops a finding or yields PASS.
- **Keys:** local steps use the owner's local key (`$TYPESAFE_API_KEY`, never printed). A cloud session may call Jev on
  public text (diffs, findings, invented text) once the cloud key is verified by one cloud session running
  `[ -n "$TYPESAFE_API_KEY" ] && echo set` (f9's writer does it; ADR 0013 gives cloud sessions their own key). Drawing
  text from the two Development Sets may go to Jev from cloud sessions too since the owner's Q23 ruling of 5 Oct 2026
  ("Yes, now"; ADR 0013's History); every other set's text only from local steps. Held-out text never.
- **Budget:** a few thousand factory calls a session at ~500 tokens is about $0.06 (estimate); far under the current
  limits of 100K tokens/s and 80 requests/s, which "can change without notice" (`models.md:14,24`). Cost is not the
  constraint; correctness and the leak boundary are. `jev.log` makes the spend a measure.

**Jev in the product, toward 90 %** (`research/jev-product.md`, refuter-corrected; ADR 0011's rule holds: code finds
candidates and computes every number, Jev picks with a confidence, the QS confirms; ADR 0013: development calls with
drawing text under the owner's local key, or under the cloud key for the two Development Sets since Q23 of
5 Oct 2026):
- **Today: one node (`sheet_type`) on an unscored field, so Jev moves the score by 0.** Its only effect is the QS's
  Question queue (D2).
- **Measured live** (130 real items, `jev-1.13.0`, local key; one builder's labels, not the Answer Key; every gain is
  an estimate until a scored run): view subject 37/40 where the reader had none (reader 12/40; at confidence ≥ 0.9, 31
  of 32 right; with the view title alone 17/40, so the sheet-title fact matters, ADR 0011 rule 2); kind from title
  text 27/30 against the reader's 30/30 on the independently labelled views (the other 60 compare Jev with the
  reader's own output); storeys 33/40 with no gain over the reader; Discipline 40/40 both. Saved run: median 0.335 s,
  p90 ~0.40 s, 109,922 input tokens = $0.0046 for 130 calls.
- **Tickets:**
  - **J1 `view_subject` node** (session 13, lane B, cloud; tests on recorded answers, its ~30-item spot check run
    locally under the local key): facts {view title, sheet title, Discipline, view kind}; the 14 subjects + `none`
    with descriptions; propose at a spot-checked threshold (start 0.9), else leave empty (no Question); one request per
    sheet; pinned and cached like `sheet_type`. Estimated gain about +10–11 Edison and +2–3 Sample Sheets, an upper
    bound (a Sheet passes only when every subject on it is right, and filling empty subjects fixes no wrong ones). It
    is an engine-path PR, so it owes a posting run; it is cut first to session 14 if the lock is full (§6).
  - **J2 the replay seam** (session 13, lane A beside, with the reading-measures PR and its one custody re-run; §3.10).
    Without it J1's gain cannot be scored.
  - **J5 re-measure `sheet_type`** with view titles and per-Discipline options, and count its Question queue per
    Discipline (session 13, lane D, local, live under the local key, ~$0.01): it is the G5 measure behind D2 and Q5's
    "≤ 3 Questions per Discipline".
  - **J3 storeys as a span choice** (code lists candidate spans from the convention words; Jev picks one or none; code
    expands and checks the range, ADR 0011 rule 1): only after S1's diagnostics name the failing convention (session
    14).
  - **J4 kind from the texts inside an untitled view's box** (a 40-item probe first, ~1 h; session 14). Jev on title
    text is not the fix for kind on titled views.
- **How the scored loop uses Jev:** a node per failing class the scorer names, never a free-text call; a 40-item live
  probe before any node ships (~$0.005, ~1 min, estimate), shipped only if it beats the reader on labels; every new or
  changed node carries its spot-check row (counts only) in `docs/knowledge/jev-nodes.md` before its PR, and J-c's
  alarm re-runs every row on a model change. Cloud builders may call Jev live on the Development Sets' text
  (Q23, ruled 5 Oct 2026); tests use recorded answers. A full
  two-set pass costs about $0.02 batched or ~$0.04 one item per request (estimate), so cost never limits probes.

---

## 4. Claude Mods (both required: the owner's explicit ask)

### (a) "You should know" (built in), Phases 3–4 — required
- The owner types `/plugin enable cc-plugin-you-should-know@builtin` in the orchestrator session at Phase 3's start
  (owner action O2; VCC:432; `/plugin` does not work headless, VCC:442-443). It is off by default and its cost is
  undocumented, so `/usage` is read before and after.
- Builders are covered either way: their `--settings` file sets it `false` (§3.7, unverified key form). Whether the
  enable persists to user settings is unverified (one test: `claude plugin list` in a new shell, VCC:444).
- At Phase 4's end the orchestrator records in STATE what it showed, and the owner keeps or disables it.

### (b) `vextrus-factory` (committed; orchestrator only; PR f8) — required, not cuttable
- **Where:** `tools/mod/vextrus-factory/`: `.claude-plugin/plugin.json`, `hooks/hooks.json` with
  `modules: ["./register.js"]`, `register.js` exporting `register(on, options)`, `types/index.d.ts`, `*.test.ts`
  (VCC:392-393). Not under `.claude/skills/`, which would load it in any trusted local session (VCC:418-421), and
  not under `.claude/plugins/`, which is never scanned (VCC:418).
- **Built early in its own small PR (f8)**, against f0's `status.json` contract, so it lands before the cut line and
  does not wait for the watcher's PR.
- **What it shows:** a band above the prompt with one or two lines, for example:
  `19:42Z 3h12/5h30 · lock: post t228 14m (+2 waiting) · disk 61G swap 0.0G avail 14G · cloud 4 working, 1 READY, 1 quiet 31m · local 1 · reviews #250 r1, #251 r2 · G1 main: FAIL ca2e1c4 · status 0m old`.
  - It covers the five things the brief asks for: the clock against the budget, the real-drawing lock queue, disk
    and swap headroom, builders' states, and open review rounds.
  - It draws the band through the mod interface's `AbovePrompt` site. That name is quoted in the docs
    (`docs-raw/plugins_mods_interface.md:206`) but not in VCC, so it is unverified; `claude plugin test` proves it.
  - If that fails, it falls back to `$.ui.status(text)`, one verified line under the prompt (VCC:394).
- **Its only data:** it reads `.private/work/factory/status.json` every 15 s with `$.clock.every` and `$.fs.read`
  (VCC:402-403). It makes **no `$.process.run` calls**, so it stays far from the 10 s hook limit and the hooks-worker
  crash rules (VCC:426-427). `watch.py` is the single source, so the band and the status line cannot disagree.
- **It intercepts nothing.** It registers no `tool.check`, `prompt.edit` or `agent.spawn` handler: a mod can approve a
  call the guard blocked (VCC:407-408). Its test asserts the exact list of events it registers.
- **How it stays off for builders (four walls):**
  1. It loads only through `--plugin-dir`, which is session-only and writes no settings (VCC:409-411). Only
     `orchestrator.sh` passes it. The launchers never do, and builders are never started with `/bg` or
     `claude agents --plugin-dir` from the orchestrator's session (both would carry it, VCC:412).
  2. `builder.settings.json` sets `"vextrus-factory@inline": false` (VCC:422).
  3. It draws nothing when `$.env.get("CLAUDE_CODE_REMOTE") === "true"` (cannot be faked, VCC:416-417). Cloud loads no
     repo- or user-enabled plugins anyway (VCC:337-339, 397-399).
  4. It draws nothing unless `$.env.get("VEXTRUS_ROLE") === "orchestrator"`; the launchers set `VEXTRUS_ROLE=builder`
     in every child's env, so an inherited value cannot reach a builder.

  Proof: the mod records each session id where it activated in `$.store`; after Phase 3's first local launch that
  set must hold only the orchestrator's id.
- **Validated:** `claude plugin validate --json --strict tools/mod/vextrus-factory` exits 0 and
  `claude plugin test tools/mod/vextrus-factory` exits 0 (VCC:139-142). The builder runs both in `verify` and cites
  their output in the PR body. Running them in GitHub Actions is unverified, so CI does not depend on it.
- **Getting it into session 12's running orchestrator** (finish line 4): once f3 and f8 are merged, the orchestrator
  is restarted as `scripts/factory/orchestrator.sh --resume <full session id>`, which brings both the status line
  (`--settings`) and the band (`--plugin-dir`). Long runs were started detached, so they survive the restart, and
  `orchestrator.sh` refuses while a pidfile names a run it would orphan. Whether `--resume` combines with
  `--plugin-dir` and `--settings` is unverified (one test: restart once, read the band). Session 13 starts with both.
- **Fallback, only after two recorded crashes** (the brief's rule): if the mod ends the session twice, or Claude Code
  turns all mods off after 3 untraced stops (VCC:424-425):
  - the orchestrator records both crashes' evidence in STATE with `stamp`;
  - it writes `.private/work/factory/mod-disabled`, which makes `orchestrator.sh` drop `--plugin-dir`;
  - it tells the owner. The status line already carries every field of the band.

---

## 5. Quality gates G1–G5 and the definition of done

| Gate | What | Where, when | Tier |
|---|---|---|---|
| **G1** the real-set walk | **Script layer** (`scripts/walk/run.py <sha>`, started detached): it serves that head from a scratch worktree with its own database (`vextrus_walk_<sha8>`), its own ports (`VEXTRUS_WEB_PORT`, `VEXTRUS_API_URL`) and both workers. `web/e2e/real/walk.spec.ts` (Playwright, its own config) uploads the Development Sets through the UI and makes **three measured checks**: (1) every file's read completes; (2) **act p95 while a later file is still reading** (confirm, answer, exclude, undo; where D1 lived); (3) **Questions per Discipline by kind** (D2), with the burden counts beside them (one-source, bulk-confirmable, continuation Questions; G5). It writes them to `walk.json`. Selectors use roles and test ids, never a title. **Agent layer:** `/real-set-walk` (§3.8) walks the finish-line items M0-FL1–M0-FL11 and M0-FL13 (the codes' table below) by eye; M0-FL12 (the real-drawing check on main; in G1 it would be `scripts/real-drawings --no-post`) is dropped from G1 because each merged engine head's posting run already covers it. **Expectations:** `.private/work/walk-expect/<set>.json`, from Q5's limits and the Answer Key's counts (the scorer's counts-only output: Sheets, Views and continuation groups per Discipline), never from a walk's own recording; prepared by `drawing-analyst`, reviewed by `qs-critic`, the counts confirmed by the owner in one question; never in git. A check with no expectation is **UNSET, and UNSET fails PASS**. **Verdict:** `.private/work/walks/<sha40>/verdict.json` (`walk-verdict.schema.json`) follows **the one PASS rule** below. **`scripts/walk/ready.py <ref>`** passes only when the two most recent G1 verdicts on main are both PASS with no FAIL between them, and the newer one is on `<ref>`'s current head or on an earlier head whose diff to it touches no product path (`vextrus/`, `engine/`, `web/src/`, `pyproject.toml`, `uv.lock`). A second walk on the same product code counts (a repeat). Each case has a test. **Red proof:** Phase 4's run on main must FAIL on checks (2) and (3), because D1 and D2 are still on main (t-readlock and t228 are unmerged); a G1 that passes that head is a failed gate. Sizing (estimates): ~28 min of reading, 60–75 min in all, 5.6 GB. | local, on main after each merge wave | built in 12 (T7); passes twice in 13 |
| **G2** fidelity | G2a: fakes validated against the exported OpenAPI schema at test time; the keys the screen switches on become closed `Literal` types (`step1.py:149`'s `by_step` first). G2b: the seed from the real job (#237). G2c: e2e (§3.9) with two real-stack cases (D5: Step 1 refreshes when a second file finishes reading; D1: a bulk confirm returns while a read is held) | CI | session 13, lane B (2) |
| **G3** acts never wait | a two-connection test: the job's finishing step paused inside its transaction; confirm, answer, exclude and undo each return within 500 ms (proposed); `lock_timeout` on API connections as a tripwire. t-readlock carries the first | CI | session 13 (2) |
| **G4** spec coverage | every key in m0-screens §6.15's table is bound and listed by the `?` overlay | CI | 3 |
| **G5** QS burden | measured by G1 for session 13 (above); in the real-drawing check from session 13's lane A (§3.10), with Q5's limits | local | inside T7; export-level 2 |

**G1's one PASS rule** (the same words as `walk-verdict.schema.json`'s description, whose `if`/`then` enforces the PASS
direction): a verdict's `result` is **PASS if and only if** (1) every scripted check's status is PASS (UNSET, a check
with no expectation, fails); (2) every agent-layer item's status is PASS (NOT_WALKED fails, as does FAIL) and all
twelve walked items are listed once each; (3) `blocks` is 0; and (4) `misleading` is 0. Otherwise it is FAIL; there is
no third result. An agent-layer item's status is one of three: **PASS** (walked, and the item holds as `docs/specs/M0.md`
words it; findings of severity OTHER may stand under it), **FAIL** (walked, and it does not hold; a finding under it
says why) or **NOT_WALKED** (not walked: no time, a crash, a screen that would not open).

**The finish-line item codes.** `M0-FLn` is item n of "The owner's walk" in `docs/specs/M0.md`'s "Finish line" (n = 1
to 13, the same numbering; session 11 research (private) called them FL1–FL13, and its walk steps, numbered from 4,
are not the item numbers). The `M0-` prefix keeps them apart from the finish codes FL1 and FL2 (floor finish,
skirting) of `docs/research/qs-defaults.md` and `docs/specs/M2.md`.

| Code | `docs/specs/M0.md` "Finish line" item | In G1 |
|---|---|---|
| M0-FL1 | 1. Staff create two Developers; the first gets its MD and QS Memberships | walked |
| M0-FL2 | 2. The QS creates the Edison project and drops in its drawings | walked |
| M0-FL3 | 3. Progress in words; one file cancelled and restarted; a second drop duplicates nothing | walked |
| M0-FL4 | 4. Two decoders agree, none quarantined; font reports, Bangla-ANSI flags, PDF upload reports | walked |
| M0-FL5 | 5. The sheet list: number, title, Discipline, storey range; exceptions and Questions first | walked |
| M0-FL6 | 6. Every sheet paged by the arrow keys in Paper, spot-checked in CAD-dark and with the Plot; legible | walked |
| M0-FL7 | 7. Coverage on the status bar: every view given its Part or put out of scope, none left over | walked |
| M0-FL8 | 8. Questions answered, fixes, exclusions with reasons, bulk confirmation; the MEP Parts added after | walked |
| M0-FL9 | 9. Steps 2–8 repeated for the Sample Project | walked |
| M0-FL10 | 10. The MD's read-only view; the Vextrus Engineer's and the Guest's access and refusals | walked |
| M0-FL11 | 11. A user of the second Developer sees none of it | walked |
| M0-FL12 | 12. The real-drawing check on main records the baseline | dropped: each merged engine head's posting run covers it |
| M0-FL13 | 13. Every screen worded as m0-screens; Dhaka time; no building, market or currency choice | walked |

**Definition of done, per PR:**
1. Acceptance tests by `acceptance-writer`, pushed before the builder starts, red on main and green on a throwaway,
   with both counts in the commit (`tools/lint/acceptance.py`; the carried branches' existing acceptance commits are
   listed by full sha in `tools/lint/acceptance_legacy.txt` and exempt). An untestable ticket says why.
2. HEAD carries `Factory-State: READY` and `Factory-Verify: <its own tree> ok`; the guard refused any push of a READY
   head without its green verify record.
3. `ci`, `web`, `engine` green, with at most one recorded rerun of a listed flake.
4. Review recorded in the local ledger in at most two fix rounds; every finding of 50 or more passed a refuter, was
   fixed and left a committed check whose red output path is in the body. Round 3 only with a recorded exception (a
   security hole of 75 or more, a crash, a false statement a QS meets, or `fix-regression`: every finding left
   at round 2 was introduced by fix round 1, as its refuter confirms; the owner, 5 Oct 2026).
5. `design-gate` (web) and `real-drawings` (engine paths) posted through `post-status`.
6. The body leads with what is not verified, including "not walked on a real set" where true. Every cut item links
   an open issue. It carries `Harness net: +a / −r` for harness PRs.
7. `merge_ready` green, including the ledger and the leak scan.

**Per wave:** G1 on main after the wave's last merge. A BLOCKS finding or a regression against the last walk becomes
a fix ticket in the same session. **Every other finding, of any severity, becomes an issue (or a comment on its open
issue)** (F6 was dropped and became D2). Measures go to the milestone issue.

**Per milestone:** `ready.py origin/main` passes; G5 within Q5's limits (or each excess named to the owner); main's
reading score measured by one scored run and stated against Q4's ruled 90 % bar, not claimed; then, and only then, "walk now",
with both verdict paths. Product merges freeze only while the final walk runs.

**"No 'walk now' to the owner without a passing G1 report on that head":** a CLAUDE.md law line and `ready.py`
(tier 1), and the walk-now Stop hook (tier 2). No check can stop a sentence typed in another way, so the law line
stays.

**How walk outputs and drawing text stay out of git (T2; committed before any real-set walk runs and before any PR
carries walk output, PR f2):**
1. **The corpus.** `tools/leakscan` builds it locally into `.private/work/leakscan/corpus` from every TEXT, MTEXT and
   ATTRIB entity of each DWG under `.private/reference/` (through the engine's own reader, locally), the Plot PDFs'
   text, `~/.cache/vextrus-real-drawings/exports/`, `.private/work/walks/*/` and `.private/work/**/*.md` notes
   (strings of 8+ characters, normalised). The committed allowlist holds **sha256 hashes** of normalised generic
   strings, never the strings; additions go only through `python -m tools.leakscan allow <file:line>`, which hashes
   them.
2. **What it scans:** a push range's added lines, **commit messages, file names and the ref name**; a body file; a
   PR's title, body and comments; a launch prompt or cloud message; a folder of walk outputs; issue bodies changed
   since a date. It prints `file:line` and a count, **never the text**.
3. **The guard requires a stamp.** A clean scan writes `.private/work/leakscan/ok/<sha or sha256>`, whose content is
   the corpus hash and the scanned range (`leakscan-cli.md` §4). A stamp is valid only if the corpus hash is current
   **and**, for a push, the range's base is an ancestor of both `origin/main` and the head (`git merge-base
   --is-ancestor <base> origin/main` and `git merge-base --is-ancestor <base> HEAD`) **and** the range's end equals
   the head; a body stamp's sha256 must equal the body file's. The guard refuses `git push` from the main checkout and
   every `gh` body write without a valid stamp. It is a file check plus those two git calls, so it is fast and cannot
   fail open on the 10 s hook timeout (VCC:212). Scans that only decide for themselves (the watcher, the pre-push
   hook) run with `--no-stamp`. Inline `--body` text is refused. The stamp folder is denied to Edit
   (§3.7) and to any command but the scanner (§3.6).
4. **A pre-push hook**, `scripts/git-hooks/pre-push`, runs the same scan for pushes the guard never sees (the owner's,
   a script's). It runs once `core.hooksPath` points at `scripts/git-hooks` (the orchestrator sets it after f2
   merges; the guard allows exactly that value).
5. **`merge_ready` re-scans** the PR's added lines, commit messages, file names, branch name, title, body and
   comments before every merge.
6. **Issue and PR bodies:** each wave, `python -m tools.leakscan bodies --since <date>` scans every issue and PR body
   edited since the last scan. Walk issues carry only `sanitize.py`'s allowlisted fields (§3.8).
7. **Prompts:** the cloud launcher and `launch.py say` scan every prompt and message (§2.2); the watcher scans each
   new cloud head's diff and commit messages and raises an alarm on a hit.
8. **The CI step** checks bytes and paths only (§3.9). The literal corpus is drawing text, so it never goes to CI (a
   keyed corpus as a GitHub secret is Q19, default no). Cloud sessions have no corpus; the scan skips there with a
   printed reason. Drawing-environment cloud sessions (§2.4) do see drawings, so the local walls cover them: the
   launcher scans their prompts, `watch.py` scans each new head and their PRs' comments and bodies, `merge_ready`
   re-scans, and their prompts forbid PR comments. Jev's leak advice (§3.14 J-e, local only) adds a second opinion on
   new proper nouns; a corpus hit refuses whatever Jev says.
9. **G1's outputs** (Playwright's `outputDir`, traces, screenshots, `walk.json`) go to `.private/work/walks/<sha40>/`.
   The real walk never runs in GitHub Actions. The public summary comes only from `scripts/walk/sanitize.py`'s
   allowlist: a verdict per finish-line item, numeric deltas, defect classes.
10. **Until f2 merges,** every push and PR body in Phase 3 is scanned with session 11's `lits2.py`, its output piped to
    a count only, and the count logged under `.private/work/session-12/`.

---

## 6. Session 13's plan and finish line

**The goal, in the owner's words:** "on session-13 at any cost we'll reach the ultimate version of M0 for me to walk".

**The honest limit.** The owner ruled the M0 bar at 90 % ("Q4 M0 bar - 90%", 4 Oct 20:2xZ): Edison 196/217 Sheets
and 666/739 Views, Sample Project 61/67 and 376/417. **By the evidence, 90 % reading is not reachable in session 13:**
main's code passes 45/217 and 8/67 Sheets; the last three loops moved Edison by +6, +1 and 0; even 80 % is estimated
at 6–9 sessions; scored heads run at ≤ 0.4 an hour in this plan (`research/bar-90.md` §0, §4). So session 13 delivers
two things, and its finish line says which is which: **the walk-ready product** (flow and QS burden on the real sets)
and **an honest reading report** against the 90 % bar, with the seams and the plan that close it in sessions 14+.

**First act (≤ 30 min):** `scripts/factory/orchestrator.sh`; `stamp start --budget <the owner's>`; the governor and
usage reading; then ask, one at a time and only if still open: Q5, Q13, Q23, Q24, the #160 trade, Q16, Q17, Q21.

**Defaults if unanswered** (Q4, Q7 and Q20 are ruled, §7):
- **Q5:** ≤ 3 open Questions per Discipline after proposals; ≥ 80 % of Sheets bulk-confirmable per Discipline; 0 false
  continuation Questions; act p95 ≤ 1 s while a read runs; every plan Sheet states its storey.
- **Q13:** no reading loop until it is answered; S2 loops only on classes the conventions do not touch (box boundary
  on the Sample Project first).

| Lane | Work | Where | Budget (estimate) |
|---|---|---|---|
| **A, the critical path** (lock-bound, from minute 0) | Carried PRs in order **#237 → t-readlock → t229 → t228 → t160 → loop-iou**. Minute 0: one `/review-pr` batch for t-readlock, t229 and t228 (fix round 1 re-checked), t160 and loop-iou, so each gets a ledger record; #237 joins after its fix round. **#237's fix round in two steps:** (1) the acceptance writer (high) re-scopes the demo fixtures in `vextrus/takeoff/tests/acceptance/t19a/step1.py:35` and `vextrus/seed/tests/acceptance/t136/seeded.py:28` in a one-path `acceptance:` commit with counts; (2) the builder does the non-acceptance fixtures (`vextrus/seed/tests/test_seed_drawings.py:26`) and the savepoint helper. Then land each: merge main, CI (~10–13 min after f1), one posting run, merge. t160 waits for the render_f1 trade ruling; with none by its turn, it lands after loop-iou. **Then xdist** (database per worker and checkout; moved from Phase 3), last in the lane. | orchestrator + lock | ~5 h |
| **A, beside it** | The reading-measures PR (§3.10: export-level G5, S1 diagnostics, S2 proxy re-keyed by content and code hash) **with the Jev replay seam J2** (§3.14); the custody re-run asked once after it merges | local, high, refuter | 2.5 h build; the owner's re-run |
| **B** (cloud, from minute 15) | First, if Phase 3's route-A probe passed: the drawings-environment ticket (`session-start.sh` clone, `launch.py --drawings`, the drawing-environment comment scan; ~45 min, estimate). **G2a's web half** (fakes validated against the exported OpenAPI schema at test time), so the web tickets after it are not built on unchecked fakes; then D7 (#232), #235 (split into 2–3 tickets), #236, their writers using the validated fixture helpers; **J1 `view_subject`** (§3.14); the Jev wiring tickets (J-d dedupe; J-e leak advice, built locally); G2a's `Literal` keys (an engine path) last. The design-gate mays #218–#224, #239–#241 only if the lane has room. Reviews by cloud reviewers once trialled (§2.1) | cloud builders and reviewers (the governor's ramp, 8 → 16) | 3–4 h, parallel with A |
| **B, drawings** | D9 (#233 storeys), D10 (#234 presentation plans): real sets | **cloud `vextrus-drawings` if the probe passed**, else local, high | 3 h; their posting runs queue after lane A's |
| **C, reading** (after Q13), in `research/bar-90.md` §2's order | **S1 first** with the owner (Q13; inter-keyer agreement by `drawing-analyst`, kept local, gives the true ceiling; the scorer diagnostics). Then, each with its target stated before the work: (1) **Sheet fields** (storeys, title, Discipline, then date; rules from the diagnostics; J3 only if its probe beats the reader); (2) the **221 near-miss boxes** (S2 proxy loops, in the cloud if the probe passed; S3 the Plot as a second source, Sample first); (3) **misses and wrong kinds** (J4 probe; **S4 only if Q8 is yes**, a 10-sheet development-time prototype). Scored runs only for heads that gain on the proxy. In session 13 realistically S1 and the start of (1) | local, plus cloud loops if the probe passed | from hour 2: S1 ~1 h with the owner; loops ≤ 3 h; ≤ 4 scored runs (~2 h of lock) |
| **D, gates** | First, walk-expect (§5: `drawing-analyst` from Q5 and the Answer Key's counts, `qs-critic` reviews, the owner confirms the counts in one question; ~45 min), and **J5** (re-measure `sheet_type`, Questions per Discipline; local, live; ~30 min). G1 #1 on main after lane A's and B's first merges (~hour 5); fix tickets for BLOCKS; G1 #2 on the next head (~hour 8); **G1 #3 budgeted**, because `ready.py` needs the newer PASS on main's current product code. Product merges freeze only while the final walk runs | local | ~1.25 h + 3 × 60–75 min + ~1.5 h of fixes |
| **Lock budget** | Posting runs, one per engine PR head, ~30 min each, serial: lane A's 6 + xdist 1; the reading-measures PR 1; lane B's engine PRs (D7, G2a's `Literal` keys, ~1 of #235, J1) ~4; D9 and D10 2; G1 fix tickets ~1–2: **~15–16 runs ≈ 7.5–8 h**, plus lane C's ≤ 4 scored runs (~2 h), **against an ~11 h session: over-subscribed.** Cloud `--no-post` runs (if the probe passed) take no lock time. Each engine merge changes the code hash, so the next engine PR needs a fresh run (a head already run is cached); Q16 would cache more of them. Order: lane A in order, then D9 and D10, then lane B's engine PRs, the reading-measures PR, J1, xdist last. **Cut first at +8 h:** xdist, J1 (to session 14), G2a's `Literal` keys, lane C's scored runs beyond 2 | the lock | ~9.5–10 h of demand |
| **Landing slot** | ~23 PRs × ~13 min (update-branch, CI, statuses, merge), one at a time on one main, shared by lanes A and B (Q21) | orchestrator (`land.py` detached, or by hand) | ~5 h |
| Close | handover; "walk now" only if Part 1 holds | orchestrator | 0.5 h |

**Budget proposal:** ~11 h of work (estimate, for the owner to set), cut at +8 h: anything not on the finish line
becomes an issue. The lock and the landing slot are the binding limits, not builders; more cloud sessions do not move
either.

**Finish line, in two parts (session 13 is done when each holds, with a tool result).**

*Part 1, the walk-ready product (all must hold before "walk now"):*
1. The six carried PRs are merged in order, or each one not merged is named with its reason.
2. D1–D10 are each closed by a merged PR with a check on main (D4 per the #160 ruling). D7, D9, D10, #235 and #236
   are merged, or each is linked to an open issue with a reason.
3. `scripts/walk/ready.py origin/main` exits 0 (two passing G1 walks in a row, the newer on main's current product
   code), with G5 within Q5's limits (or reported, if Q5 is open).

*Part 2, reading, reported and not claimed:*
4. One scored run on main's last head, stated against the 90 % bars **196/217, 666/739, 61/67, 376/417** with each
   gap in Sheets and Views, and the 80 % marks (174, 592, 54, 334) beside them.
5. S1's ceiling: Q13 answered and the two-keyer agreement measured by the key user, or named open with its reason.
6. The seams merged or filed as issues: the proxy re-keyed by content and code hash; the Jev replay seam (J2); the
   scorer diagnostics. J1 merged, or filed for session 14.
7. The plan for sessions 14+ (§1 Answer B item 3) in the milestone issue, each phase with its target.

*Both:* 8. Every cut and every walk finding is an issue. 9. Only then is the owner told "walk now", with the reading
gap stated beside it: what the owner walks after session 13 is a product whose flow and QS burden pass on the real
sets, with a reading score shown against 90 %, not hidden.

---

## 7. Owner questions

**Ruled on the draft (20:2xZ, verbatim):** Q4 "Q4 M0 bar - 90%"; Q7 "I'm allowing to be more easy going on this case
and cloud sessions may read drawing and enabling Remote Control for most cases if that means more power and
performance by allowing some privacy issues that I'm allowing willingly"; Q20 "yes for most scenario if it comes to
quality"; "More cloud, more parallel"; and the Jev requirement (header). Their rows below say what each now means.

**List A (blocking before Phase 3).** Answered: Q1 (17:21Z), Q2 (17:22Z), Q10 (18:21Z), Q11 (17:26Z). **Q9 remains**,
and is asked alone, after approval and before Phase 3's first launch:
- **Q9, user-level settings.** *Recommend:* set `CLAUDE_CODE_SUBAGENT_MODEL` to `claude-sonnet-5-5` in
  `~/.claude/settings.json`, so ad-hoc spawns run on Sonnet (your 29 Sep "Sonnet 5.5 for light work"); keep spawn
  depth 1, the `EnterWorktree` deny and `autoMemoryEnabled: false`. *Reason:* every gating agent is pinned to Opus in
  the repo and named per stage in the workflows, which outranks the env (VCC:501; WF:423), so no gate can be
  downgraded. *If unanswered:* change nothing; the committed `Explore` agent still routes light look-ups to Sonnet.

**List B (asked one at a time after approval, while Phase 3's builders run; the default stands until answered).**

| Q | Recommended default | Reason in a line |
|---|---|---|
| Q4 the M0 bar | **Ruled: 90 %** (Edison 196/217 and 666/739; Sample 61/67 and 376/417). Session 13's walk is the product walk (Part 1 of §6's finish line) with the reading gap reported (Part 2); M0 closes on reading only when a scored run shows the four bars | no evidence reaches 90 % in one session (`research/bar-90.md` §0) |
| Q5 burden limits | ≤ 3 Questions per Discipline; ≥ 80 % of Sheets bulk-confirmable; 0 false continuation Questions; act p95 ≤ 1 s during a read; every plan Sheet states its storey | G1 and G5 need numbers to pass or fail |
| Q6 custody re-run cadence | one batched re-run per wave at a fixed point (session 13: after the reading-measures PR) | the re-run is root and your hands |
| Q7 drawing data through Claude Code | **Ruled: relaxed.** Cloud sessions may read the two Development Sets through route A (§2.4) once its probe passes; Remote Control stays on (`remoteControlAtStartup: true`, `~/.claude/settings.json:162`; the key's effect is Unverified 13), and the orchestrator uses it to list and message cloud sessions (VCC:297-299). Still never: drawing content in git, an issue, a PR or a workflow file; Held-out Sets in any build session; drawing text from any set but the two Development Sets to Jev under the cloud key (Q23, ruled 5 Oct 2026: the Development Sets' text may go). Recommended, not required: model training off at claude.ai/settings/data-privacy-controls (retention 30 days instead of 5 years, VCC:378-381) | Remote Control stores the transcript while connected (VCC:381; `docs-raw/remote-control.md:221`); you accepted that |
| Q8 S4 vision | **Development-time** (prototype, labelling, proxy-key help): yes to a 10-sheet Sample Project prototype with recorded responses, through Claude Code (the plan's quota), after S1; no ADR change. **In the product's read:** it would amend ADR 0011's "no LLM in the MVP"; you decide after the prototype | the only strategy for the 209–258 Views rules miss or mis-kind; ADR 0011 keeps Claude out of the MVP |
| Q12 App-pinned statuses in the ruleset | yes (your ruleset edit; the guard refuses agents) | closes "who posted the gate" by rule, not only in `merge_ready` |
| Q13 Answer Key conventions | answer before any reading loop: turned title blocks, the slab-detail kind, Edison's 6 storey Sheets, the box convention for notes; then measure two-keyer agreement | loops otherwise tune toward an inconsistent key |
| Q14 repo visibility | stay public through M0, with the leak wall (f2) merged before any real-set walk | going private once stopped CI |
| Q15 walk counts for client sets | no: only verdicts leave `.private/` | counts can identify a client's set |
| #160's render_f1 trade | accept, with the reason "outlines on paper", if G1's outline check passes on both sets; otherwise t160 lands after loop-iou | Sheets off paper 117 → 5 is what the QS sees (render_f1: 46 lost, 84 changed) |
| Q16 (new) a narrower posting cache key (the job's import closure, not every engine path) | yes, batched into session 13's one custody re-run | session 13's lock is over-subscribed (§6); it would have saved ~1.4 h of lock in session 11 (`M/lock.md` §3); it weakens "read the head" only for code the job never imports |
| Q17 (re-asked for the 90 % goal) a custody views-only scored mode for loop candidates, never for posting or the milestone's reported score | *Recommend:* yes, ~30–60 scored heads an hour against ~2 (estimate). *If unanswered:* no; your 30 Sep ruling ("the job is the scored reader") stands | at ~2 scored heads an hour, the ~150 Sheets 90 % needs cannot be tuned against the real key; the proxy's own agreement with the key is unmeasured |
| Q18 (new) `claude ultrareview` beyond the 3 free runs | free runs only, on the guard PR; ask again with a cap if they find real faults | $5–25 each in usage credits (VCC:504) |
| Q19 (new) a keyed literal corpus as a GitHub secret, so CI can scan text | no | the local walls (guard stamp, pre-push, `merge_ready`) sit before the leak |
| Q20 acceptance writers at high effort | **Ruled: yes for most.** Every writer at high, reading tickets included; medium only for a docs-only ticket (none in Phase 3) | wrong acceptance tests cost ~29 amendments in six sessions |
| Q21 (new) landing throughput | keep "branches must be up to date" for session 13 and budget the landing slot (~5 h, §6); trial a GitHub merge queue later (an issue; `ci.yml` would need a merge-queue trigger first, untested here) | changing the ruleset mid-milestone risks the gate that keeps main green; the slot is known and budgeted |
| Q22 (new) account B as a second usage pool | no for now: stay on account A until the governor has measured "% per builder-hour" (Phase 4); usage is the owner's concern (the ruling of 5 Oct 2026, #404): the owner decides when to add accounts or credits | B would double capacity, but A's orchestrator could not list or message B's cloud sessions (`docs-raw/remote-control.md:195`) |
| Q23 (new) amend ADR 0013 so cloud sessions may send drawing text to Jev under the cloud key | **Ruled 5 Oct 2026: "Yes, now".** Cloud sessions may send the two Development Sets' text to Jev under the cloud key, before it has a spending limit; ADR 0013 is amended (its History) | your Q7 lets cloud sessions read drawings |
| Q24 (new) recorded Jev answers inside the scored run (J2) | yes: answers recorded outside the sandbox, keyed by the product's own cache key, replayed inside; a miss is `Unavailable` and counted; no key in the sandbox; rides the one custody re-run | without it every Jev gain is invisible to the score (`scripts/real_drawings/sandbox.py:3`) |

**Owner actions (one checklist, given once at Phase 3's start):**
- O2: `/plugin enable cc-plugin-you-should-know@builtin` in the orchestrator session (mod (a), required).
- O3: `/plugin` to disable `ralph-loop` (its Stop-hook loop would fight the builder Stop nudge); optionally `hookify`
  and `mcp-server-dev`.
- O4: close VS Code during sessions (it held about 10 GB at 17:44Z).
- O5 (optional): `/tasks` once while `/review-pr` runs (proof that gates run Opus and `Explore` runs Sonnet).
- O7: run `scripts/owner/clean.sh` (dry run first) when the band shows disk under 40 GB; it also lists stale test
  databases.
- O8: delete in claude.ai/code any cloud session the launcher refused (it prints the id and has already sent it a
  STOP message). Now: archive Phase 2's PONG probe session (its id is in the approval pack and in
  `.private/work/session-12/cloud-max/launch.out`; STOP sent, the CLI cannot archive).
- O9 (route A for drawings in the cloud, one time, ~10 min; §2.4): (1) on GitHub, create the **private** repo
  `vextrus/vextrus-drawings` (no README, no Actions); the orchestrator then pushes only the two Development Sets to it
  from a scratch copy under `.private/work/`; (2) create a fine-grained token: resource owner `vextrus`, repository
  access only `vextrus-drawings`, Contents read-only, 90-day expiry; never paste it into a chat; (3) at claude.ai/code,
  create a second cloud environment `vextrus-drawings` with the builders' network level and setup script plus
  `VEXTRUS_DRAWINGS_TOKEN=<token>`; (4) revoke and rotate the token at each milestone's end.
- O10 (only if f9's writer reports the cloud key unset): paste a separate TypeSafe key, with a spending limit if
  TypeSafe offers one, into the `vextrus` cloud environment (ADR 0013 "Cloud sessions").
- Q7: Remote Control stays on (your ruling); model training off is recommended, not required.
- No longer owner actions: `core.hooksPath` (the orchestrator sets it after f2; the guard allows only that value);
  `/effort medium` (the project already pins medium in this repo, VCC:80-82; builders get `--effort`); the status line
  (orchestrator-only `--settings`).

---

## 8. Risks and cuts

| Risk | Wall | Fallback |
|---|---|---|
| `--on-branch` changes in a CLI update (a new version installed on each of the last three days) | every launch is judged from its own log; an unlisted CLI version gets one judged launch before it joins the private list; the prompt's first lines make the session check its remote and branch and stop | the documented route: `claude --cloud` from a linked worktree on the ticket's branch clones "your current branch" (VCC:320-322; one test in Phase 3); then local builders, ≤ 3, with finish line 3 recorded as unmet and the failure named |
| A refused cloud session keeps running and pushes (S07, S10; VCC:463) | the launcher sends it a STOP message at once; the watcher alarms on any new `claude/*` branch | the owner deletes the session (O8) |
| Weekly usage runs out (27 % on day 3 of the week) | the governor, fail-closed at a used-up limit (100 %, the owner's ruling of 5 Oct 2026) | usage is the owner's concern: the owner adds usage credits or accounts; at 100 %, reviews drop to `pr-reviewer` and refuters to findings ≥ 75 (recorded); local work saves nothing, because local and cloud share one plan |
| The lock is session 13's critical path, over-subscribed (§6) | the queue's priority; the proxy (session 13); the lock budget's cut order | Q16 |
| A cloud builder stalls unseen (session 12's `pgrep` wait) | pushes as heartbeat; 30-min quiet alarm; the guard refuses the wait; `launch.py say` nudges | relaunch on the same branch (the clone carries its pushes) |
| Walk issues leak drawing text | allowlisted fields only, the stamp, `merge_ready`'s re-scan, the wave body scan | the guard refuses the `gh` write |
| G1's script crashes on real sets | f5 is built locally, on the real sets; a 10-min smoke of `scripts/walk/run.py` on one real file as soon as f5 is READY, before its review; a local high-effort fix ticket reserved in Phase 4 | finish line 5 recorded as unmet, naming the failure |
| Drawing text as prompt injection into `ux-critic`/`qs-critic` | they cannot edit or write (`disallowedTools`); their issue drafts pass the leak scan, and only the triage agent's allowlisted template reaches `gh` | the finding is dropped and recorded |
| The guard change locks the orchestrator out when f2 merges (stamp-only pushes and bodies) | before f2 merges: build the corpus, take one stamp, push one stamped throwaway branch; the raw-`--bg` refusal turns on only once the local launcher exists; the SessionStart self-test (tier 2) | the owner runs `! git -C /home/riz/vextrus-cubit revert -m 1 <f2's merge>` and pushes the revert; recorded in STATE |
| The orchestrator restart (for the band) kills running work | G1, the watcher and real-drawing runs start detached with pidfiles; `orchestrator.sh` refuses while one would be orphaned | restart after the walk's verdict exists |
| Carried branches predate the factory (no `builder.md`, old guard) | the local launcher merges main into such a branch first, as a recorded merge commit; `--settings` by absolute path | a hand merge by the orchestrator, then the launcher |
| The new acceptance lint fails the carried PRs' old acceptance commits | their full shas are listed in `tools/lint/acceptance_legacy.txt` and exempt, with a test | an orchestrator amendment, as today |
| The mod crashes the orchestrator | the status line | §4 (b), after two recorded crashes |
| Phase 3's first launches come before the launcher is merged | the Phase-1-proven argv, judged by the same `judge()` | local writers, ≤ 3 |
| Acceptance tests are wrong (C3) | the red/green counts lint; every writer at high effort (Q20, ruled), medium only for a docs-only ticket | one-path orchestrator amendment, as today |
| GitHub's concurrent-job limit with 4 shards per PR (unverified) | — | 3 shards |
| Jev reads state literally and non-adversarially (`model-jaggedness/jev-1.13.md:31,106`); diffs and reports are attacker-reachable text | Jev output is advice only: it never decides a gate, drops a finding or yields PASS; READY/BLOCKED stays the trailer (§3.14) | `Unavailable` = the no-Jev run |
| TypeSafe's limits fell to 100K tokens/s and 80 requests/s and "can change without notice" (`models.md:14,24`) | the client retries 429/529 inside the 6 s deadline; ≤ 10 concurrent calls | `Unavailable`; every step runs without Jev |
| A cloud session launched on a missing branch is accepted and its fate is invisible locally (Phase 2's PONG probe) | the launcher's `git ls-remote` refusal (T4) | the owner archives it (O8) |
| A cloud reviewer pushes to the PR branch | `fetch-verdict` voids a verdict whose PR head moved; `merge_ready` (a) needs a ledger PASS for the exact head | an in-process review of the new head |
| Drawings in the cloud leak through built-in GitHub tools (they post outside Bash) | drawing tickets' prompts forbid comments; `watch.py` scans their PRs' comments and bodies locally; `merge_ready` re-scans; the token is read-only and one-repo | the orchestrator deletes the comment and files the leak; the owner rotates the token |
| Route A's probe gets a 403, or bwrap is refused in the VM | §2.4's probe in Phase 3, before any drawing ticket | drawing work stays local (≤ 3 agents); route C is the owner's call |
| 90 % is not reached in session 13 | §6's two-part finish line: the product walk on Part 1; the reading gap reported in Part 2 with the plan for 14+ | — (this is the expected outcome, not a failure) |
| Landing is serial: each merge stales the next PR (~12–15 min a landing, estimate) | the landing order; tier-1 PRs first | at the cut line, tier-2 PRs wait for session 13 |

**Flaws the judges and critics named that this spec could not fully remove:**
1. **The cloud half of T4 still rests on a flag no document names** (`--on-branch`). It is live-proven once and
   every launch is judged. The documented fallback route and the local fallback keep session 13 able to run without
   it.
2. **Nine Phase 3 PRs against the brief's "~6".** xdist left Phase 3; the band (f8) took its slot so the owner's
   required mod lands before the cut line, and the docs PR (f7) is finish line 3's dogfood. The Jev client (f9) is
   tier 2 and small, and lands in the landing gap before f2 is READY; at the cut line it becomes an issue like any
   tier-2 item.
3. **Landing is tight.** PRs land between ~T+150 and ~T+300 (estimates); one extra fix round on f3 or f5 pushes past
   the 330-min line.
4. **G1's first real run (60–75 min, estimate) cannot fit inside Phase 4's hour alone.** It starts in Phase 3's tail,
   once f2 and f5 are merged.
5. **Export-level G5, S1 and S2 move to session 13's lane A.** The walk's burden numbers come from G1.
6. **The harness grows** (§3.12): the owner's "remove as much as it adds" does not hold for Phase 3. Each PR states
   its net; the owner is told once.
7. **Session 13's lock is over-subscribed** (§6): not every engine PR can land in one session without Q16 or cuts.
8. **Cloud review and cloud drawings are designed, not proven.** The verdict-file channel uses only proven git
   pushes, but has never run end to end; route A rests on an untested clone and an untested sandbox. Both have a
   Phase 3 test and a local fallback.
9. **Every Jev accuracy figure in the factory rests on 8–18 invented items per task;** each step needs ~30 labelled
   items or a shadow wave before it routes anything.

**Cut items and deferred work.** At approval, before any launch, the orchestrator runs `gh label create factory` and
files every title below with a one-line reason in its body (bodies through the interim count scan); the numbers go
into STATE and the Phase 5 PR, and §8 is updated with the links in that PR. Items marked "at 240" are filed only if
not merged by Phase 3 + 4 h.
- At 240, if not merged: "factory: CLAUDE.md to one page with .claude/rules" (reason: tier 2; the law lines stay);
  "factory: docs/sdlc.md to the factory" (tier 2); "factory: PreCompact dump, guard self-test, SubagentStop verdict
  gate, after-bash test" (tier 2); "factory: walk-now Stop hook" (tier 2; the law line and `ready.py` stand);
  "factory: builder Stop nudge" (tier 2; the guard's push gate is the wall); "factory: orchestrate-wave rewritten
  around the factory" (tier 2; line 49 fixed in f6); "factory: visible real-drawing lock queue" (tier 2; the session
  flock stays); "factory: say.py local resume and messages" (tier 2); "factory: land.py" (tier 2; landing by hand);
  "factory: slow-file report in CI" (tier 2); "factory: Explore on Sonnet and agent pins beyond the gating set"
  (tier 2); "factory: prompt-audit fixes (Pocock set, handoff, diagnosing-bugs, spec-review, to-spec)" (tier 2);
  "factory: e2e on push and nightly, then PRs" (tier 2); "factory: --permission-mode dontAsk for local builders"
  (tier 2, one test); "factory: lessons.md Check-path lint" (tier 2); "factory: cloud reviewers and refuters through a verdict file" (tier 2; in-process review
  stays).
- Filed at approval (session 13 or tier 3): "factory: xdist with a database per worker and checkout" (engine PR;
  session 13 lane A); "factory: reading measures (export G5, S1 diagnostics, S2 proxy) in one custody re-run" (engine
  and custody paths; session 13); "factory: G2a: fakes validated against OpenAPI; closed Literal keys" (session 13
  lane B); "factory: G3: a two-connection test that acts never wait on a read" (session 13, with t-readlock);
  "factory: scored-loop workflow with proxy fidelity" (needs S2); "factory: research fan-out workflow" (tier 3);
  "factory: cloud setup under 300 s" (tier 3); "factory: StopFailure event log" (tier 3); "factory: G4 key-map
  coverage" (tier 3); "factory: drawings cloud environment (route A: session-start clone, launch --drawings, comment
  scan)" (session 13 lane B, if the probe passes); "factory: Jev dedupe for walk findings and cut items" (session 13,
  tier 2); "factory: Jev leak advice beside the literal wall" (session 13, tier 2, local); "factory: Jev launch
  warning" (tier 3); "reading: J1 view_subject Jev node" (session 13 lane B, cut to 14 first); "reading: J2 Jev replay
  in the scored run" (session 13, with the reading-measures PR); "reading: J5 re-measure sheet_type and its queue per
  Discipline" (session 13 lane D); "reading: J3 storeys as a span choice" (after S1's diagnostics); "reading: J4 view
  kind from box contents, probe first" (session 14); "factory: review verdict as an
  App-posted status" (needs a custody change to post-status); "factory: omitClaudeMd trial for qs-critic" (tier 3);
  "factory: builders' plugin deny for the You-should-know mod, key form tested" (tier 2, unverified key);
  "factory: merge_ready words-review marker for web/src/messages" (ratchet); "factory: deny resize_page on the shared
  browser" (ratchet); "factory: Vitest and Playwright failure-log reporters" (ratchet); "factory: route sweep (every
  route non-empty; tab order reaches each primary act)" (ratchet); "factory: shellcheck in the toolchain; its test
  fails instead of skipping" (ratchet); "factory: session-start sweep of stale vextrus-test-storage dirs" (ratchet);
  "factory: find or write the resource-bound test helper lessons.md:180 claims" (ratchet); "factory: guard refuses
  `; git commit` after an edit command" (ratchet); "factory: read-job query count (seed and real reads)" (#237's
  profile); "factory: split the normal and slowed Vitest runs" (web job time); "factory: merge queue trial" (Q21);
  "factory: skill pruning after the owner's look" (tier 3); "factory: ultrareview second gate" (Q18).

---

## 9. Tiers

**Tier 1 (session 13 cannot run without it; 8 items, listed per component):**

| # | Component | Why session 13 needs it | PR(s) | The check, red without its fix |
|---|---|---|---|---|
| **T1** | **CI speed:** the python job in 4 shards from `.github/ci-shards.json`; the shard-union lint; #245's flake fixes; every node test in CI | #237 cannot land at 35 min; the web job turned 6 of 101 main pushes red | f1 | `test_ci_shards.py`; python wall time before/after; the t16 mid-drag test |
| **T2** | **Leak wall (#211):** `tools/leakscan` (lines, commit messages, file names, refs, prompts; hashed allowlist), the guard's unforgeable stamp, the pre-push hook, `merge_ready`'s re-scan, the CI byte/path test | G1's outputs and walk issues in a public repo | f2 (+ f4's `merge_ready` step) | a synthetic corpus literal in a push range, a commit message, a file name, a body file and a prompt is refused and printed only as `file:line` + count; a push without a stamp is refused; a hand-written stamp is refused |
| **T3** | **Guard repair:** every gap class, the cwd-independent test, secret-read denies, the guard's registration pinned | the guard test fails from main; secrets are readable; a mistyped hook path disables the guard silently | f2 | `node --test .claude/hooks/guard.test.mjs` from the main checkout and from `/tmp`; every `ALLOWED` probe line refused; `hook_paths.py` with a changed matcher fails |
| **T4** | **Launch and govern:** one launcher, `scripts.factory.launch` (cloud: the proven argv, a branch `git ls-remote` must list on origin, `judge()`, STOP on refusal, prompt scan, `say`; local: worktree, database, carried-branch merge, builder settings), and the fail-closed governor | cloud is the owner's intent; C9 happened 5 times; 8 local builders filled swap | f1 (cloud), f3 (local, governor) | `test_launch_cloud.py` (argv equals the proven list; refuses outside the main checkout, without an `acceptance:` commit, on a branch `git ls-remote` does not list (a stale local ref present), on a prompt with a planted corpus string; a REFUSED verdict sends STOP); `test_launch_local.py` (absolute `--settings`; `VEXTRUS_ROLE=builder` in the child env); `test_governor.py` (fake `/proc/meminfo`, `df`, `/usage` text; unreadable usage refuses) |
| **T5** | **The builder contract:** `builder.md`, the `verify` skill and its record, the guard's READY push gate, the acceptance writer's red/green counts, the `tdd` fix | cloud cannot read `.private/`'s `common.md`; C3's ~29 amendments | f4, f2 | `test_verify.py`; a READY push with no verify record is refused (`guard.test.mjs`); `tools/lint/tests/test_acceptance.py` (an `acceptance:` commit without counts fails; a listed legacy commit passes) |
| **T6** | **Review record and merge gate:** `/review-pr` with refuters on findings ≥ 50 and named models; `ledger.py` (local record of truth, unit-tested decisions); `merge_ready`'s four new refusals | the cap broke in 5 sessions; D6's silent cut; a PR comment is forgeable | f4 | `test_merge_ready.py`: a PR with green checks and no ledger PASS passes today and must be refused; a forged marker with no ledger file is refused; a resolved-conflict merge is refused; each refusal red without its rule; `test_ledger.py` |
| **T7** | **G1, the real-set walk gate:** the walk script's three measured checks with G5's burden counts, `ready.py`, `sanitize.py`, issue drafts from allowlisted fields | Answer A: nothing between merges did a QS's job on a real set | f5 | `sanitize` test (a title in a synthetic `walk.json` is dropped); `ready.py` tests (one PASS; a FAIL between; the newer PASS on stale product code; each refused); Phase 4's run on main FAILS on act latency and Questions (D1, D2 still on main), and the leak scan over its outputs = 0 hits |
| **T8** | **Clock and watcher:** `stamp.py`, the clock hook, `watch.py` → `status.json` + `events.log` (detached, restarted), the status line | C7 (4 of 6 sessions) and C8 (three times); the band's only data | f3, f6, f8 | `clock.test.mjs`, `watch-start.test.mjs`, `statusline.test.mjs`; `test_watch.py` (a trailer fixture → event; a READY already present fires; a stale pidfile restarts) |

**Finish-line obligations (exempt from the cut line; not components):** f0 (spec, ADR and contracts; finish line 1);
f7's five law lines, its stale-line fixes, `real-drawings`, `lessons.md` through session 12 and §3.13's list on #45,
and f6's orchestrate-wave line 49 (finish line 6); mod (a) enabled by the owner and mod (b) running in the orchestrator, or
its status-line fallback after two recorded crashes (f8 + f3; finish line 4); G1's first run on main (finish line 5);
the Jev client with shadow triage and the model watch (f9; the owner's explicit ask of 4 Oct: "pairing typesafe Jev
model more actively into factory").

**Tier 2 (wanted in Phase 3, cut first; each becomes a `factory` issue at 240):** the `rdlock` priority queue;
`say.py`; the slow-file report; `land.py`; the walk-now Stop hook; the builder Stop nudge; PreCompact; the guard
self-test; the SubagentStop verdict gate; the `after-bash.mjs` test; orchestrate-wave's full rewrite; CLAUDE.md to
one page with `.claude/rules`; `docs/sdlc.md`; `docs_paths.py`'s length and lesson rules; `Explore` and the
non-gating agent pins; the Pocock and other prompt-audit fixes; e2e on push and nightly; `--permission-mode dontAsk`;
**cloud reviewers and refuters through the verdict
file** (`review_cloud.py`, `ledger.py fetch-verdict`; f4, cut first inside it).
Session 13: xdist, the reading-measures PR with the Jev replay seam (J2), `scored-loop.js`, G2a, G3, the drawings
cloud environment (if the probe passes), J1, J5, Jev dedupe (J-d), Jev leak advice (J-e).

**Tier 3 (an issue at approval):** `research.js`; StopFailure log; G4; ultrareview; the Jev launch warning (J-f); the
App-posted review status; skill pruning; cloud setup under 300 s; `omitClaudeMd` for `qs-critic`.

---

## 10. Phase 3 plan (≤ 5.5 h = 330 min; the cut line at 240 min)

Tickets are drafted under `.private/work/session-12/tickets/` during the approval wait (read-only), with f0's
contracts. Branches are made from `origin/main` after f0 merges and pushed first. Acceptance tests are written by
`acceptance-writer`, committed and **pushed before the builder launches**; their commits carry the red/green counts
from the start. **Cloud writers push their own `acceptance:` commits; the orchestrator pushes local writers'
commits** from the main checkout (local builders never push). Builders run in the cloud for everything that does not
touch `.private/`; the guard ticket (f2) and G1 (f5) are local. Every launch's record and `claude agents --json
--all` snapshot go under `.private/work/factory/launches/`.

| PR | Files | Where, effort | Tier | Budget: write / build / review (min) | Lands at (estimate) |
|---|---|---|---|---|---|
| **f0 Spec, ADR and contracts** (docs only, first) | `docs/specs/factory.md`; `docs/adr/0042-the-software-factory.md` (Status: "accepted <UTC> by the owner: "<verbatim words from STATE.md>""); `docs/specs/factory/contracts/{status.schema.json, status.sample.json, verify-record.schema.json, trailers.md, walk-verdict.schema.json, ledger-record.schema.json, leakscan-cli.md, launch-cli.md, review-verdict.schema.json, jev-cli.md}` | the orchestrator; one review round by hand (`/review-pr` is not merged yet) | obligation (finish line 1) | — / 10 / 10 | T+25 |
| **f1 CI speed, flakes, cloud launcher** | `.github/workflows/ci.yml`; `.github/ci-shards.json`; `.github/flaky.txt`; `tools/lint/{ci_shards,slow_files}.py` + tests; `web/src/test/setup.ts`; `acts.test.tsx` (builder); the t16 and `openSheet` acceptance files (writer only); `scripts/factory/{__init__,launch}.py` (`cloud`, `say`, and the `local` arguments that call f3's `local.py`); `scripts/factory/tests/test_launch_cloud.py`; deletes `scripts/cloud/launch.py` and `scripts/tests/test_cloud_launch.py` | cloud, medium | 1 (T1, T4's cloud half) | 25 / 60 / 20 | T+150 |
| **f2 Walls** | `.claude/hooks/{guard,guard.test,state}.mjs`; `tools/leakscan/**` (incl. `test_tracked_tree.py`); `scripts/git-hooks/pre-push`; `.gitignore`; `.claude/settings.json`'s `permissions` block; `tools/lint/hook_paths.py` + test; an appended "Test seams" section of `docs/specs/factory/contracts/leakscan-cli.md` | **local, high, a refuter** | 1 (T2, T3, T5's push gate) | 30 / 120 / 45 | T+230 |
| **f3 Local launch, govern, watch, clock data** | `scripts/factory/{local,watch,governor,rdlock,stamp,say,status}.py`, `orchestrator.sh`, `orchestrator.settings.json`, `builder.settings.json`, `tests/**`; `scripts/owner/clean.sh` | cloud, high | 1 (T4's local half, T8's data) + 2 (rdlock queue, say.py; cut first inside the PR) | 30 / 150 / 30 | T+285 |
| **f4 Review, merge gate, builder contract** | `.claude/workflows/review-pr.js`; `scripts/{ledger,land,verify,merge_ready}.py` + tests; `scripts/factory/review_cloud.py` + test (tier 2, cut first); `scripts/tests/test_ledger_jev.py`; `tools/lint/{acceptance,workflows_js}.py` + tests; `tools/lint/acceptance_legacy.txt`; `.claude/agents/{builder,pr-reviewer,refuter,acceptance-writer,drawing-analyst,Explore}.md`; `.claude/skills/{verify,tdd}/SKILL.md` | cloud, high | 1 (T5, T6) + 2 (`land.py`, cloud review) | 30 / 120 / 30 | T+245 (after f2: the leak seam) |
| **f5 G1 walk gate** | `web/e2e/real/**` (own Playwright config, spec, schema); `scripts/walk/**` + tests (`run`, `sanitize`, `ready`, `issues`); `.claude/workflows/real-set-walk.js`; `.claude/skills/product-review/SKILL.md`; `.claude/agents/{ux-critic,qs-critic}.md`; `.github/workflows/e2e.yml` | **local, high, a refuter** (real-drawing work, built on the real sets; a 10-min real-set smoke before review) | 1 (T7) | 30 / 150 / 45 | T+300 (design-gate: "no screen changed") |
| **f6 Session hooks** | `.claude/settings.json` (hooks; f2 owns `permissions`); `.claude/hooks/{clock,watch-start,stop-gate,walk-gate,precompact,selftest,verdict-gate,after-bash.test}.mjs` + tests; `.claude/skills/orchestrate-wave/SKILL.md` (the full rewrite) | cloud, high; **a refuter on its `settings.json` diff** | 1 (T8's clock and restart hooks) + 2 (the rest) | 30 / 150 / 30 | T+270 |
| **f7 Laws and docs** (**the dogfood**) | `CLAUDE.md`; `.claude/rules/**`; `docs/sdlc.md`; `docs/knowledge/lessons.md`; `docs/architecture.md`; `docs/agents/issue-tracker.md`; `tools/lint/docs_paths.py` + test; `.claude/skills/{real-drawings,ask-matt,resolving-merge-conflicts,spec-review,to-spec,to-tickets,triage,wayfinder,handoff,diagnosing-bugs}/SKILL.md`; `.claude/skills/MATT-POCOCK-SKILLS.md` | cloud, medium; **its builder launched through f1's merged launcher at ~T+150** | obligation + 2 | 25 (from T+25) / 60 / 20 | T+255 |
| **f8 The band** | `tools/mod/vextrus-factory/**`; `scripts/factory/statusline.mjs` + test | cloud, medium; built against f0's `status.sample.json` | obligation (mod b) + 1 (T8's status line) | 20 / 60 / 20 | T+165 |
| **f9 Jev client** | `scripts/factory/jev.py` (`ask`, `triage`, `same-issue`, `models-check`); `scripts/factory/tests/test_jev.py` (incl. `triage` writing only the sidecar); recorded answers under `scripts/factory/tests/fixtures/jev/` (invented text only) | cloud, medium; its writer first runs `[ -n "$TYPESAFE_API_KEY" ] && echo set` (the cloud-key check) and records invented-text answers live under it | obligation (the owner's ask; exempt from the cut line) | 20 / 45 / 15 | T+195 (in the landing gap after f8) |

f2 and f6 share `.claude/settings.json` in separate blocks (§3.5); f0 and f2 share `contracts/leakscan-cli.md`, where f2
owns only an appended "Test seams" section. Every other file has one owner. `lessons.md` points only at checks already on main when f7 merges;
pointers to f2–f6's new checks are added by the Phase 5 handover PR (docs only).

**Order and clock (minutes after Phase 3 starts; estimates):**
- **0–10:** `stamp start`; the governor by hand (`df -h /`, `free -g`, `/usage`); Q9 asked alone; the owner's
  checklist (O2–O4, O8–O10, Q7); `gh label create factory`; the §8 issues filed.
- **10–25:** f0 reviewed by hand and merged (docs only). Branches f1–f9 cut from the new main and pushed (each
  confirmed by `git ls-remote` before its launch).
- **25–55:** writers, all at high (Q20). Seven in the cloud through the Phase-1-proven argv (main checkout,
  `--on-branch`, judged, `--effort high`): f1 first, then f3, f4, f6, f7, f8, f9; f2's and f5's writers locally,
  launched with `CLAUDE_CODE_EFFORT_LEVEL=high`. The ramp starts at 8 cloud sessions if `/usage` allows (§2.3).
- **~30 (once O9 is done), ~5 min each, in the cloud budget:** route A's probe (§2.4: clone ok/403, bwrap ok/refused,
  environment choice); and, from the orchestrator's main conversation, one PONG round trip by SendMessage to a cloud
  session on an existing branch (Remote Control's two-way path, `research/cloud-max.md` §5). Results go to STATE.
- **55–65:** builders: f1, f3, f4, f6, f8 and f9 in the cloud, 2 min apart, as writers finish; f2 and f5 locally.
  Watching is a `run_in_background` loop over `git ls-remote` (no `pgrep`) until f3 lands, then Monitor on the event
  log.
- **~120:** f1 READY → review by hand-run agents (`review-pr.js` is not merged yet) → land at ~150. Every later PR then
  gets the sharded CI and the quieter web job.
- **~150:** **f7's builder launches through the merged `scripts.factory.launch cloud`**: finish line 3's dogfood.
  f8 lands at ~165; f9 at ~195, in the gap before f2 and f4 are READY.
- **~180–215:** f2, f4, f3, f6 and f5 come READY; reviews by hand until f4 merges, then `/review-pr` with the ledger;
  f5's 10-min real-set smoke runs before its review.
- **230–300:** landing, one at a time (each merge stales the next): f2 → f4 → f7 → f6 → f3 → f5.
- **240: the cut line.** Unmerged tier-2 items become `factory` issues (§8). A tier-1 PR or an obligation still open
  keeps going to 330, and the owner is told which.
- **After f3 and f8 merge (~285):** the orchestrator restarts through `orchestrator.sh --resume <id>` (detached runs
  survive): the band and the status line come on.
- **~300 onward:** once f2 and f5 are merged, **G1's first run on main** starts locally, detached (60–75 min,
  estimate), running into Phase 4.

**Machine during Phase 3:** the orchestrator, f2's and f5's writers then builders, in-process review agents (changed
tests only), f2's full test run (3.3 GB), f5's smoke walk and later one G1 walk (5.6 GB): about 17 GB of 21.6 at the
peak (estimate); the governor holds a walk while a full pytest runs. Phase 3 owes no posting run. Cloud: the ramp
(§2.3), 8 at once to start: seven cloud writers (25–55) with the two ~5-min probes, then six cloud builders at once
(55–65), then f7's at ~150. Phase 3's peak is set by its seven cloud tickets, not by the cap; more than 6 cloud
builders at once (your "More cloud, more parallel") first runs in session 13's lane B, under the ramp to 16. The usage
reading is taken at every launch.

**Finish line 3's local set:** the orchestrator (with its in-process `/review-pr` agents), f2's writer and builder
(the guard ticket, the brief's exception), f5's writer and builder and G1's run (real-drawing work). Any other local
session in a launch snapshot fails the line.

**Phase 4 (60 min) reuses the factory:**
- It tabulates f1's cycle (the first cloud ticket, which also unblocks #237): elapsed against budget, review rounds,
  findings, CI time before and after.
- It records the peak number of cloud sessions at once, with `/usage` read before and after (the governor's % per
  builder-hour), as session 13's starting cap, and the week projection (§2.3).
- It records route A's probe (clone, bwrap, environment choice), the PONG round trip, the cloud-key check, and, if f9
  merged, `jev.log`'s call count, latency and cost.
- It sums each PR's `Harness net` line and names the net-positive PRs.
- It cites at least one review that ran through `/review-pr`, with its ledger file and marker.
- G1's first run on main completes. It must FAIL on act latency and Questions per Discipline (T7's red proof); its
  ranked list is session 13's input. The leak scan runs over its outputs and must find 0 hits.
- Every tier-1 check's red run is cited in its PR body by output path. The guard's test passes from the main
  checkout. The audit outputs stay saved under `.private/work/session-12/audits/`.

---

## Evidence

All paths are under `/home/riz/vextrus-cubit/` unless they start with `~`. `W/` = `.private/work/`.
- **Header, rulings:** `W/session-12/STATE.md` (17:21Z, 17:22Z, 17:26Z, 17:42Z, 18:21Z, 18:24Z);
  `docs/handoff/session-12-prompt.md`; the critics' findings and their dispositions,
  `W/session-12/design/revision-log.md`.
- **§1 (the answers):** `W/session-12/research/verified-answers.md` §1–§3 (built from `answers-escape.md`,
  `answers-score.md`, `answers-compound.md`, `answers-strategies.md` and their refuter folders).
- **§2 (shape, capacity):** `W/session-12/measures/machine.md` §2–§4; `M/lock.md` §1–§4; `M/worktree-sizes.txt`;
  `W/session-12/cloud/{verify,RESULT}.md`, `cloud/NOTES.txt:8-19` and `cloud/launch_probe.py:65-72` (no
  `report.md`: the harness refused it); `W/session-12/audits/slash-usage.json`; `research/verified-cc.md` §1.1, §1.5,
  §1.6, §3; `research/docs-raw/{cloud-environments.md:242,318, commands.md:133, skills.md:192, agent-view.md:960}`;
  `~/.claude/settings.json` (read today: `includeGitInstructions`, `subagentPromptCacheTtl`, `statusLine`,
  `remoteControlAtStartup`); `~/.local/share/claude/versions/` (install dates).
- **§3 (components):** `CLAUDE.md` (:43, :137); `docs/sdlc.md:112-114`; `.claude/{settings.json,agents,skills,hooks}`;
  `.claude/agents/pr-reviewer.md:33-42`; `.claude/agents/acceptance-writer.md:6`; `.claude/skills/tdd/SKILL.md:22`;
  `M/ratchet.md`, `M/guard-gaps-probe.txt`, `M/guard-test-main.txt`; `M/xdist.md`, `M/xdist-n4c.txt`,
  `M/xdist-n8all.txt`, `M/xdist-accplugin-*.txt`, `M/xdist-unstable-ids.txt`; `M/ci-python-trend.txt`,
  `M/ci-main-by-module.txt`, `M/ci-perfile-main-vs-t182a1.txt`, `M/ci-seedcost.txt`, `M/seed1-main.txt`,
  `M/seed1-t182.txt`, `M/ci.md` (§1–§6), `M/ci.NOTES.txt`; `M/web.md` (§1–§5), `M/web.NOTES.txt`,
  `M/web.durations-by-day.txt`, `M/e2e.runs.txt`; `.github/engine-paths.txt`; `.github/workflows/ci.yml` (harness
  job); `pyproject.toml:83`; `tools/lint/acceptance.py:27`; `tools/lint/workflows.py:23`; `vextrus/settings/db.py:40-45`;
  `scripts/merge_ready.py`; `W/session-12/audits/{slash-doctor-prompt-audit,slash-skill-doctor}.json`;
  `research/docs-raw/workflows.md:363,423`; `research/docs-raw/plugins_mods_interface.md:206`; `docs/knowledge/lessons.md:327-329`.
- **§4 (mods):** `research/verified-cc.md` §1.7 (VCC:390-433); `research/mods.md`.
- **§5 (gates):** session 11 research (private), its §2 (the G1 table, the source of §5's M0-FL codes; "two
  consecutive clean walks"); `docs/specs/M0.md` "Finish line"; `verified-answers.md` §1.
- **§6 (session 13):** `docs/handoff/session-12-prompt.md` ("Where M0 stands"); `M/lock.md` §4; `verified-answers.md`
  §2; `docs/adr/0041-sessions-are-autonomous.md` item 1 (up-to-date branches); the carried branches' `acceptance:`
  commits (`git log` in their worktrees: 0a72a25d3, 0383e734b, 449fd7956, 050b96e60 carry no counts).
- **§7–§8:** `W/session-11/s12-research/critic.md` (Q1–Q15); the three designs in `W/session-12/design/` (the judges'
  scores were not saved to a file, so none is quoted).
- **Measures:** `W/session-12/research/verified-measures.md`. The strand files above are its sources.
- **Revision 2 (the owner's 20:2xZ notes):** `W/session-12/research/{jev-api.md, jev-api-raw.jsonl, jev-product.md,
  jev-product/, cloud-max.md, cloud-drawings.md, bar-90.md}` and their refuters' verdicts (corrections used, refuted
  claims dropped); `research/docs-raw/{remote-control.md, cross-session-messaging.md, claude-code-on-the-web.md,
  cloud-environments.md, settings-reference.md}`; `docs/adr/0011-mvp-ai-is-jev-no-llm.md`;
  `docs/adr/0013-typesafe-may-receive-development-data.md`; the change list, `W/session-12/design/revision-2-log.md`.
  (`W/session-12/cloud/report.md`, named in the revision brief, does not exist; `cloud/RESULT.md` and
  `cloud/verify.md` are the cloud sources.)

## Unverified, or proven only once (Phase 3 tests each first)
1. `--on-branch` still clones and pushes on the CLI version in use at Phase 3's start (proven once; every launch is
   judged). Also the documented fallback: `claude --cloud` from a linked worktree on the ticket's branch
   (VCC:320-322) passes the trust check.
2. `waitingFor` shows live in `claude agents --json` (start a local builder that hits a permission prompt).
3. A `claude --bg --agent builder` started inside a linked worktree loads that worktree's `.claude/settings.json` and
   the guard (VCC:156-157 says yes; confirm with one refused command in its log).
4. Memory per in-process workflow agent (sample `ps` during one `/review-pr` with 8 agents) → confirm or lower the cap
   of 8 and the 0.3 GB estimate.
5. The python shards' wall time on a GitHub runner, and GitHub's concurrent-job limit for 4 shards per PR.
6. `/plugin enable cc-plugin-you-should-know@builtin` is session-only or user-wide (`claude plugin list` in a new shell);
   and the `"cc-plugin-you-should-know@builtin": false` key form in `builder.settings.json`.
7. The mod's `AbovePrompt` band (doc-quoted, not in VCC), proven by `claude plugin test`; `$.ui.status` is the
   verified fallback.
8. `--resume <full id>` combined with `--plugin-dir` and `--settings` (one restart).
9. `--permission-mode dontAsk` on a `--bg` builder (VCC:493 documents it; one run with a refused command).
10. `skills:` preload on a main-session `--agent builder` (the body repeats the rule, so nothing rests on it).
11. Whether `/usage`'s percentages include cloud sessions (read before and after the first cloud launches), and the
    status line's `rate_limits` sub-field names.
12. `claude plugin validate` and `claude plugin test` inside GitHub Actions (not relied on).
13. `remoteControlAtStartup` (in your user settings): the docs say it connects each interactive session
    (`docs-raw/settings-reference.md:5427-5435`); not in VCC. Phase 3's PONG round trip from the orchestrator's main
    conversation to a cloud session (the documented two-way path); and whether a cloud session can message an
    RC-connected local session unprompted (undocumented).
14. Names this spec uses that VCC does not list, each backed by another tool result and pinned in a test: `claude
    --model`, `--debug-file` and `--version` (the proven launch used the first two, `cloud/launch-2.debug.log`); the
    settings key `statusLine` (VCC:265-266 gives its shape and cites `settings-reference.md:3530`; the name is quoted
    at `docs-raw/statusline.md:44`), pinned by f8's test and proven at the restart.
15. Route A (§2.4): a cloud session's clone of a private repo not attached to it; bwrap (`-m needs_bwrap`) in the VM;
    choosing the `vextrus-drawings` environment from the CLI (`--environment` is documented for self-hosted ids only,
    VCC:124). Download time (3–15 s) is an estimate.
16. The cloud review channel end to end (one trial after f4 merges); "% per builder-hour" for the ramp.
17. The cloud TypeSafe key (`[ -n "$TYPESAFE_API_KEY" ] && echo set` in one cloud session; f9's writer).
18. Jev's factory accuracy: 8–18 invented items per task (`research/jev-api.md` §2.2); each step needs ~30 labelled
    items or a shadow wave before it routes anything. The Sonnet comparison is unrecorded (n = 2) and not relied on.
19. Jev's product gains (`research/jev-product.md`): one builder's labels, not the Answer Key; no scored run confirms
    them.
20. Workflow facts cited as `WF:n` (raw docs, not in VCC): a stage's named model counts as the per-invocation model
    (WF:423), and a workflow has no shell of its own (WF:363). Nothing rests on WF:423 alone: every gating agent also
    pins `model: opus` in its frontmatter, which outranks the env (VCC:501); O5's `/tasks` shows each agent's model
    (VCC:317). WF:363 only moves rules into scripts, which is safe either way.

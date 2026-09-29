# Session 06: M0 wave 4, built locally, on a clock

## Starting the session (the owner)
In a terminal, from the main checkout on `main`, pulled:

```bash
cd ~/vextrus-cubit && git switch main && git pull --ff-only
```

```bash
claude --model claude-opus-5-5 --effort xhigh
```

This is the CLI's default config, signed in to account B's account and organisation. Session 05's orchestrator ran
from it, and the builders must run from the same config: messages do not cross config dirs. Check that `/status`
shows Opus 5.5 at xhigh and permission mode auto, then say: "Read docs/handoff/session-06-prompt.md and run it."

---

You are the orchestrator of the fourth build session of the new Vextrus, in the CLI at **xhigh**. **Everything
runs on this machine** (the owner, 29 Sep 2026: "everything will be run in locally"). Each ticket is built by its
own background Claude Code session in its own worktree; local agents review and verify; you keep your own context
for decisions, contracts and the owner.

**This session is judged on pace as well as quality.** Session 05's wave 3 merged four of its five tickets 6 h
13 min after launch, and the owner stopped its review rounds (29 Sep 2026):

> "It's been couple of hours, almost 6 hours + you're continuing this wave 3 session, my expectations was you'd
> deliver much faster results instead taking full day and even I'm not sure remaining tickets can be merged or not .
> Nevertheless please don't go more further rounds, let's finish the running rounds and try to finishing the session
> as soon as possible."

**Before you launch anything,** put "How session 06 goes faster" to the owner, one question at a time, your
recommendation first, and record each ruling in STATE.md and #45. Quality on every merge still comes first (28 Sep
2026: "focus on producing production grade highest code quality on every merge, every wave and every sessions");
the rulings on pace say where the review loop stops.

## How session 06 goes faster (recommendations; the owner rules)
**What wave 3 cost** (times UTC). Launched locally at 20:13 on 28 Sep. Four of its five tickets merged by 02:26 on
29 Sep, 6 h 13 min after launch (15 at 22:26, 20a at 02:10, 13 at 02:16, 14 at 02:26); 19b's posting run and
merge were left to the owner at the session's close. The owner's ruling on pace came at 01:2x, about five hours
in, when only 15 had merged. Its rounds (a code review is one `pr-reviewer` run, first or re-check; a fix round is
one message back):

| Ticket | Code reviews | Fix rounds | Words gate or walk |
|---|---|---|---|
| 13 | 4 | 3 (8 findings; then the hostile-file bounds twice) | 2 (failed, passed) |
| 14 | 2 | 1 | 2 (failed, passed) |
| 15 | 2 | 1 (and its planned renumbering) | 2 (passed, passed) |
| 19b | 2 | 1 (and its planned part 2) | 3 (failed, failed, passed) |
| 20a | 3 | 2 (the walk's 7 musts; then a fault the fix brought) | 3 walks (failed, failed, passed) |
| #75, #82, #93 | 2 each | 1 each | none |

- **Second continuations:** 13 and 20a, 2 of the wave's 5 tickets (2 of 7 with #75 and #82), against ADR 0025's
  "at most one in four". The widening gate is not met for the third wave running; decided: do not widen.
- **Session 04's three causes, measured:**
  - words failing their first gate: not met; the fresh gate failed 4 of 5 catalogues whose builder's own gate had
    passed;
  - fixes bringing new faults: found by the re-checks, not prevented (13 twice, 20a once), a round each;
  - bugs passing CI's 4 cores and failing on 24: met; none this wave (two single unnamed failures under load).
  - A new cause: contract drift between two tickets in flight, caught only by runs of the merged tree.

**Where the time went:**
- **13's limits on hostile input:** each re-check found the next unbounded walk (per space, then sheets per file,
  then the whole file).
- **Builders' own loops before READY:** 14 ran five refuter rounds (175 min to READY), and the review still found
  three findings at 50 or above; 19b ran its own words gate four times, then the fresh gate failed it on five musts.
- **Two contract drifts,** a round in both tickets each: 13's judgement facts against 15's node; 13's sheet-number
  rule against 19b's stand-in.
- **Gate walks:** 20a's second walk found a fault its first fix brought.
- **Merges in series:** `main`'s ruleset requires an up-to-date branch, so each merge put the next PR behind; the
  owner updated each and posted its gate again (four merges, 01:54 to 02:26).

**Recommendations, each for the owner's yes or no:**
1. **A time budget.** STATE.md logs each ticket's clock (launch, first READY, each round, PR, merge). Recommended:
   3 hours per ticket from launch to a PR ready to merge; at the budget the running round finishes, nothing new
   starts, and the rest is filed. The wave's length is its longest chain (19b, then 19a, 21a, 20b).
2. **At most two review rounds per ticket.** A third round's finding is filed as an issue and named in the PR body,
   not sent back, unless it is a security hole scoring 75 or more.
3. **Contract keys written exactly in both prompts before launch:** every shared shape's keys, forms, one example
   and the merge edge, in both tickets' prompts.
4. **One independent review instead of long self-loops:** a builder runs one refuter pass on its trust boundary and
   one words gate, then says READY; the `pr-reviewer` and the fresh gate do the rest.
5. **The partner's branch merged before READY:** `git merge-tree` against the partner's committed head, then both
   suites on the merge in a scratch copy, reported with READY. Every wave-3 contract fault showed only merged.
6. **20b builds against 21a's reviewed head,** not its merge: it starts once 21a's upload operation passes review,
   with API types generated from that head, and still merges after 21a. (The plan starts 20b after 21a merges.)
   This saves one build on the longest chain.

## Where wave 3 stands
- **Merged in session 05** (UTC, 28–29 Sep): #86 (the wave's contracts, docs) 21:32; #89 (#82) 22:00; #90 (#75)
  22:09; #91 (15) 22:26; #96 (#93) 01:54; #97 (20a) 02:10; #98 (13) 02:16; #99 (14) 02:26. `main` is 1216e7f3.
- **Posting runs accepted:** #89 on its first run (7 report counts gained); #98 (run
  20260929T015643Z-f314630f6e7d-707c): sheets +288, register +29, 0 failed stages, every stage ok on all 11 files,
  no cap reached.
- **19b:** #101 at 80c428b2 (its part 2 wired 13's real `storeys.read` and `sheets.sequence`; `main` 1216e7f3
  merged); first READY at 21:28 (74 min). Its posting run and merge: the owner's step at the session's close. Its
  real-set findings, judged by a drawing analysis against 13's analysts' counts: conflicts 5 true, 0 false; gaps 18
  true; drawing-list results 58 true; continuations 10 true, **7 false**, 3 unclear (copied title blocks read as
  continuations, and a continuation raises no Question, so those title errors go unseen); a file with no
  Discipline has its sheets left out of every comparison, so a real number collision is missed. Filed as #102.
- **Filed, not sent back:** #87, #88, #92, #93 (fixed by #96), #94, #95, #100, #102.
- **14 does not store 13's `sheet_report`:** it merged before the report existed in its services (item 21a below).

## Done means (check each, and keep checking until all hold)
1. **The rulings on pace** are in STATE.md and #45 before the first launch.
2. **19b (#101) merged,** its posting run accepted: the owner's step at session 05's close; if either is still
   owed, it comes first.
3. **Wave 4 merged:** 16, 17, 18, 19a, 20b, 21a (docs/plans/M0.md, "Wave 4"). Each PR went through the review loop
   within the rulings on pace, and has its local step done: 16's design gate and its walk of every sheet of one real
   set; 17's and 18's posting runs; 20b's design gate; the words gate on 19a's and 21a's catalogues.
4. **Wave 4's measures in #45:** per PR and per wave, each ticket's clock against its budget, and the widening gate
   decided.
5. **Session 07's brief written,** the lessons added, the PR opened.

**Do not end your turn while any of these is owed.** A summary, a question you could answer yourself, a finished
milestone and a background session still running are not done. When you must wait for the owner, say exactly what
you need, then keep every other track moving.

## Wave 4: order and edges
| Ticket | Starts when | Merges after | Its local step |
|---|---|---|---|
| 16 Sheet viewer | now (03, 11 and 13 in) | none | design gate; walk of one real set |
| 17 Views within sheets | now (13 in) | none | posting run |
| 18 Plot registration and the render check | now (13 in) | none | posting run |
| 19a `takeoff` Step 1 | 19b merged (14 is in) | 14, 19b | words gate |
| 21a The read job, per file | now (14 in) | 19a (its seed file) | words gate (no posting run: A4) |
| 20b Screens: the Drawing Set | 21a merged, or its reviewed head (item 6) | 21a | design gate |

One migration this wave: takeoff's, 19a's (21a adds none). 17's and 18's posting runs go one at a time. 18 never
changes the buffer format's version while 16 decodes it, and keeps 16's pixel test green (A7).

## What wave 4's prompts must carry
**Every prompt:** session 05's `wave3/common.md` (the local one), with the wave-4 ticket list, the rulings on pace,
the exact keys of every contract the ticket meets and its merged run with the partner (items 3, 5), every suite
run's output kept in a file under `.private/work/session-06/<ticket>/` (pytest `-rf`), the READY and BLOCKED lines,
and commit, never push. A UI ticket walks m0-screens §8 by keyboard before READY; a ticket that words codes gets
the words gate.
- **16:** the buffer format as on `main`; its development-only route `web/src/routes/dev/sheet/` (m0-screens 4.6);
  its walk on 13's sheets from the harness.
- **17:** 13's storey keys (D7), "typical" only beside a floor or plan word; view titles to 15's node as
  `view_titles`, a JSON-array text, `"[]"` when none (the ruling on 15's keys). Storey keys have no display words
  yet (13's words gate): the first ticket to show one on a screen adds its words to a catalogue first. 17 checks a
  continuation's inner (view) title against its title block (#102: 7 of 20 continuations on the real sets were
  copied title blocks).
- **18:** `render_f1.py` declares `CODE`, `VERSION`, `MILESTONE`, `KIND` and `MESSAGE`, or 18 names it in
  `catalogue.py` as a non-Check (D9; 19b's scan fails loudly otherwise). #87 (an inch layout's paper read in mm)
  is 18's: it meets the page-to-sheet scale. #88 (the renderer ignores a text style's width factor and oblique
  angle) is the renderer's, which 18 edits; a change to the buffer waits for 16's merge.
- **19a:** a pasted list or typed range comes back parsed, and the QS sees the numbers before confirming (22's
  paste dialog; the ruling on 19b's conservative serial-column rule). 19b owns that parser and 13 the number-parts
  rule (19b mirrors it): 19a calls them. The confirm service calls 15's `record_override` for each change to Jev's
  pick (D10); it writes confirmation, exclusion and confirmed kind on 14's printed sheet (`SheetRevision`);
  `set_register` is its (D5). The seed's "Held, answered" is 19a's; 14 seeded only the states that need no job.
  19a and 21c decide how a sheet with no Discipline is compared (#102).
- **21a:** its read job runs on the CAD queue with no memory cap until 24 measures one
  (`VEXTRUS_CAD_WORKER_MEMORY_BYTES = None`); 13 now bounds its own finder, one budget per file. 21a and 14 record
  13's `sheet_report` with the Drawing File: 14 merged before the report existed and has no place for it, so 21a's
  job records it and a follow-up to 14 stores it (a drawings migration: name its owner before launch; 21a adds
  none). A limit above 0 tells the QS the file was not read in full, by which limit, never a bare "no
  sheets" (20b's words). The seed's job-borne 4.5 states on BP-02 and MG-01 ("Reading a PDF"; "Interrupted,
  retrying") go in a named shared edit to 19a's `vextrus/seed/takeoff.py` after 19a merges. The upload operation's
  shape (path, request, every refusal body) is written in both 21a's and 20b's prompts. The `--job` mode edits
  `scripts/real_drawings/`: the owner reads it in full.
- **20b:** that upload shape; the Market's Disciplines as Library data; 14's rulings on the file summary (it counts
  only files being read; a waiting file's "next" stays per Developer, for privacy: an owner's-walk item); a file
  not read in full, from 21a.
- **Later (21c and 23):** decide whether the sheet-kind options carry descriptions. In 15's live check, 2 of 7
  invented sheets changed answer without them.

## How the local build runs (session 05's way, corrected)
- **One config.** The orchestrator and every builder run from the CLI's default config; SendMessage and idle notices
  do not cross config dirs. A session on another config (13 ran on `~/.claude-b`) is reached only by stopping and
  resuming it.
- **Launch** each ticket from the main checkout:
  ```bash
  claude --bg -w <ticket>-<slug> --name w4-<ticket> --settings .private/work/session-06/wave4/builder-settings.json "$(cat .private/work/session-06/wave4/final/<ticket>.prompt)"
  ```
  - `-w` starts it in its own worktree (branch `worktree-<ticket>-<slug>`): the default config refuses
    `EnterWorktree` and `ListAgents`, and asks the owner for push, reset, checkout, worktree and recursive deletes.
  - `builder-settings.json` is a copy of session 05's `wave3/builder-settings.json` (account B's
    `autoMode.environment`, `workflowSizeGuideline: large`, `autoContinueAtUsageLimit`). The project settings give
    Opus 5.5 at xhigh.
  - Start the independent tickets together; watch `free -g` (24 cores, 26 GB).
- **Watch:** `SendMessage` with `notify_when_idle` (it fires once: subscribe again after each notice); `claude
  agents --json`; `claude logs <id>`; a background Monitor loop on heads, states and memory (session 05's
  `watch-w3.sh`), re-armed after each wake.
- **A stopped or idle session:** never `claude --bg --resume <id> "<message>"` while it runs (that starts a copy in
  your directory). Run `claude stop <id>`, then, from its worktree, `claude --bg --resume <id> "$(cat <fix>.md)"`.
- **Engine builders run the check one at a time,** by absolute path, never with a `cd` out of the worktree:
  `flock /home/riz/vextrus-cubit/.private/work/session-06/real-drawings.lock
  /home/riz/vextrus-cubit/scripts/real-drawings <branch> --no-post`.
- **Reviewers keep every run's output in a file** too, under `.private/work/session-06/`.
- **Builders commit and never push.** You review the committed head, then push and open the PR with the owner's yes
  (the standing yes below, if the owner confirms it holds). `gh pr edit` fails: set a body with `gh api -X PATCH
  repos/vextrus/vextrus-cubit/pulls/<n> -F body=@<file>`.
- **The review loop and the owner's steps are unchanged** (the `orchestrate-wave` skill; `docs/sdlc.md`), within the
  rulings on pace: one message of owner steps with exact commands for exact SHAs; every posting run's table and
  `states.py` read before the owner accepts. A posting run against a cached export from before 13's merge shows
  13's new `sheets …` report counts "gained" at 0: noise, not a gain (the owner kept 13's line in the check's diff).
- **Merges go in one ordered pass.** `main`'s ruleset requires an up-to-date branch with every check and
  `design-gate`, so each merge puts the next PR behind. After each merge, merge `main` into the next PR's branch
  yourself (no rebase), confirm the new head changes only what `main` brought, and give the owner the gate for that
  head.

## State lives in files, not in your context
Keep `.private/work/session-06/STATE.md` current after every event: the ticket table (session name and id,
worktree, head, round, clock, next step), the rulings and the open questions. To resume: read STATE.md, then #45's
newest comments, then `claude agents --json`, then `gh pr list`, then each agent's NOTES.txt.

## Read first
1. `CLAUDE.md`, `docs/sdlc.md` ("Waves", "The review loop"), `docs/knowledge/lessons.md` (sessions 03–05).
2. The `orchestrate-wave` skill: your runbook.
3. `.private/work/session-05/STATE.md` (decisions D1–D10, of which D5–D10 reach wave 4; the rulings; the log from
   "Session 05 resumed"; "Lessons gathered"), and #45's newest comments (wave 3's measures).
4. Session 05's prompts as your template: `.private/work/session-05/wave3/common.md`, `wave3/final/*.prompt`, and
   the fix messages `reviews/fix-*.md`.
5. `docs/plans/M0.md`: "Wave 4", "Wave 5" (who builds on wave 4), "The contracts fixed here", "The tickets at a
   glance", "Labels".
6. `docs/research/opus-5-5-agentic-orchestration.md` §7.

## The owner's rulings in force
Dates are Dhaka's; #45 and session 05's STATE.md have each in full.
- **Where the work runs** (29 Sep): "instead of Cloud sessions the main sessions on xHigh will orchestrate
  everything just like we planned, the multi-agent sessions can do whatever extend to accomplish the goal,
  everything will be run in locally."
- **Push and PRs** (29 Sep): "And yes for everything except merging": a standing yes to push and open PRs; the
  owner merges. It was given in session 05: ask at the start whether it holds for session 06.
- **Account** (28 Sep): "From the next session the local and all cloud sessions will be run on Account B until I
  told you to switch." The default config is signed in to B's account.
- **Pace** (29 Sep, quoted above): no further rounds in session 05; session 06's rulings on pace come first.
- **Review minutes:** "Under 30 min a wave" (29 Sep).
- **Sheet kinds:** "Per-Discipline kinds (Recommended)" (29 Sep): per Discipline as conventions data, plus cover or
  index, general notes and other in each; 13 drafts them, `qs-critic` checks them, 14 stores the kind as read and as
  confirmed.
- **4.2's forgot-password line:** "Ask Vextrus only (Recommended)" (29 Sep): "Forgot your password? Ask Vextrus to
  set a new one."
- **4.4's end-access line:** "Split by role (Recommended)" (29 Sep): the MD keeps "You can end it at any time."; a
  QS sees "You can end the access you gave; your MD can end any."
- **#93** (a Building moved to another Project by deleting and re-inserting its row): "Fix now via #75's session
  (Recommended)" (29 Sep).
- **13's line in the check's diff:** "Keep it (Recommended)" (29 Sep): `scripts/real_drawings/diff.py` counts
  `sheet_report` among the report counts.
- **Session 04's (28 Sep), still in force.** Access: a Vextrus Engineer must be staff; staff reach in the admin is
  accepted for M0 (#74 before the beta); Activity is for the MD and the QS; the unusable-link words name no
  Developer. Reading: a DWG read once shows 4.5's "Failed" row; an item the second reader cannot read holds the
  file ("Hold it"); `failed_stages` counts a killed file; BLAS runs on one thread per file.

## What is broken, unmeasured or waiting
- **19b:** #101's posting run and merge are the owner's step at session 05's close. #102: 7 of 20 real
  continuations were copied title blocks, and a file with no Discipline is left out of every comparison. #100
  holds three small findings from its review (continuation order, pasted control characters, a revision in the
  number).
- **The widening gate** is not met for the third wave running; decided: do not widen.
- **13's `sheet_report` is not stored:** 21a records it and a follow-up to 14 stores it (above).
- **Engine test failures with no name:** #82's builder saw one once in 19 runs, 14's one under load; both names
  were lost. With output now kept, diagnose one that comes back before loosening anything.
- **The CAD worker has no memory cap** until 24 measures one.
- **Before the beta:** #92 (a write can land in the Developer another tab switched to), #94 (an over-long
  Content-Type header answers 500 before any middleware), #73 (rate limits), #74 (staff reach).
- **Before the next demo reset:** #95 (`flush` then `seed_demo` fails: the Markets are not put back).
- **#77:** the harness's direct path gives a file's process no namespace of its own; real drawings go only through
  the check. **Before M1:** the U+2068/U+2069 isolates.
- **Clean-up for the owner** (the guard refuses `rm -r`: give the commands): session 05's merged worktrees (13,
  14, 15, 20a, #75, #82, #93, the docs); the `scratch-*` folders under `.private/work/session-05/` (keep
  `reviews/`, `log/` and the reports); the diagnostic cloud sessions on B and A. Leave the stray copy `4d83537e`
  stopped and never `claude rm` it: its directory is the main checkout.

## Law in force
- Secrets are never printed or written.
- Real drawings stay in `.private/`; only conventions and counts leave.
- OpenConstructionERP is AGPL: learn, never copy. No AGPL library (PyMuPDF). No proprietary converter is run.
- The product's word is **Rebar**.
- No market literal in code; every visible string through a catalogue; logical CSS only.
- Push only with the owner's yes; only the owner merges.

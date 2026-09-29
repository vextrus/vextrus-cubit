# Session 06: finish M0, autonomously, on a clock

## Starting the session (the owner)
Once, before the session (the owner's one-time steps, below), then in a terminal from the main checkout
on `main`, pulled:

```bash
cd ~/vextrus-cubit && git switch main && git pull --ff-only
claude --model claude-opus-5-5 --effort medium
```

Check that `/status` shows Opus 5.5 at **medium** and permission mode auto, then say: "Read
docs/handoff/session-06-prompt.md and run it." After that the session runs without you until it
asks for the keys' confirmation (24s) or ends.

---

You are the orchestrator of session 06, at **medium** effort. Your target is **M0's finish**: every
remaining ticket merged, the scorer's first Development-Set scores recorded, and M0 handed to the
owner's walk. You will not finish all of it in one budget (the plan's critical path is 13–15 hours):
merge as much as the budget allows, in the plan's order, then hand off. **You run the whole loop
yourself:** launch, review, gate, merge. The owner is not waiting to approve anything but the keys.

## The owner's rulings (verbatim; #45 and STATE.md hold each in full)
**29 Sep 2026, the reason for this session's shape:**
> "I want quality with speed, I'm the only one person beside you working on this project and the Real
> Drawing from Edison have us full permission, so there is nothing to be extra cautious about security
> and other things. … I want the next sessions to be fastest to deliver results with quality, not
> waiting for my approval of push or even merge I would say: I want complete autonomous sessions and I
> insist that."

> "Every serious finding leaves a committed check, not a lesson; repeated fault can't be stay forever …
> Acceptance tests are written before the builder starts, by a separate agent. Bring the drawing-reading
> scorer forward from M1. With the Answer Keys and the blind scorer in place, reading work becomes
> compiler-shaped: many agents, each on a different failing sheet, looping until the score rises. Give
> every session a time budget. … Default effort medium for Opus 5.5, not xhigh or high … in some
> situations we can run in high for hard tasks but in most cases we'll be in default mode. … our Cloud
> Sessions on account B working now again so from next session can leverage both local and cloud
> sessions … I want you to update, upgrade, make major changes on our workflow, sdlc, all over our
> codebase and Next Session prompt to finish up the M0, that's the target."

**On the scorer** (the chosen option, "Dev per-sheet, held-out blind (Recommended)"): agents run the
scorer password-free, but only on the pipeline's own export of a committed head (never a hand-made
file); on Development Sets (Edison, the Sample Project) it answers per sheet (pass/fail and what is
wrong in general terms); Held-out Sets are scored only in aggregate at milestone gates; keys stay with
the key user, never readable by agents.

**What stays, and why** (the answer the owner accepted): the independence of gates moves from the owner
to separate agents (a reviewer and a gate that did not build the ticket post the statuses; you merge
when the ruleset's required checks are green); the ruleset keeps enforcing CI; the owner's walk at M0's
finish line stays; the Answer Keys stay fenced (measurement honesty, not security).

**Still in force from earlier sessions:**
- **Pace** (29 Sep): "please don't go more further rounds" — now the rule of at most two rounds.
- **Account** (28 Sep): "From the next session the local and all cloud sessions will be run on Account
  B until I told you to switch." The CLI's default config is signed in to B's account.
- **Quality** (28 Sep): "focus on producing production grade highest code quality on every merge,
  every wave and every sessions".
- **Sheet kinds:** "Per-Discipline kinds (Recommended)"; **4.2's forgot-password line:** "Ask Vextrus
  only (Recommended)"; **4.4's end-access line:** "Split by role (Recommended)"; **13's line in the
  check's diff:** "Keep it (Recommended)" (all 29 Sep).
- **Session 04's (28 Sep):** a Vextrus Engineer must be staff; staff reach in the admin is accepted for
  M0 (#74 before the beta); Activity is for the MD and the QS; the unusable-link words name no
  Developer; a DWG read once shows 4.5's "Failed" row; an item the second reader cannot read holds the
  file ("Hold it"); `failed_stages` counts a killed file; BLAS runs on one thread per file.
- **Superseded by the rulings above:** "everything will be run in locally" (now cloud and local), "yes
  for everything except merging" (now you merge), xhigh for the orchestrator (now medium).

## The time budget
- **The session: 8 hours** from your first launch. Stop launching new tickets at 7 h; at 8 h the running
  rounds finish, nothing new starts, and you write the hand-off.
- **Per ticket:** the plan's table ("Finishing M0", docs/plans/M0.md), from the acceptance-writer's
  launch to the merge: 1.5 h (23), 3 h (24s, 16, 20b), 3.5 h (19a, 21a), 4 h (17, 18, with at most
  90 minutes of scored loop).
- **Per step:** acceptance tests 20 min; the review with the words gate or walk beside it 30 min; each
  fix round 30 min including its re-check; merge `main` in, statuses, merge: 15 min.
- **At a ticket's budget:** the running round finishes, nothing new is sent, what remains is filed as an
  issue and named in the PR body; if the ticket cannot merge, say why in #45.
- **State elapsed against budget in every message to a builder**, first line, e.g. "Session 3 h 10 of
  8 h; 18: 2 h 05 of 4 h." It is the one measured speed lever (docs/research/opus-5-5-agentic-orchestration.md §7).
- STATE.md logs each ticket's clock: acceptance launch, builder launch, first READY, each round, PR,
  merge.

## Effort and where each ticket runs
- **Medium** for you and every builder and agent, set per launch (`--effort medium`); **high** only for
  **17, 18, 19a, 21a, 21c and 24s** (reading; hostile input; security walls). Reviewers at high.
- **Cloud** (account B) where committed tests prove the ticket: 16, 19a, 21a's build, 20b, 21b, 22.
  **Check one cloud launch's git remote before fanning out** (session 05: account B's sessions came up
  with no remote; the signs were a 30–39 s launch and the session filed under "other"). If the remote is
  missing, build that ticket locally and say so in #45; do not debug the cloud for more than 15 minutes.
- **Local** where real drawings are needed: 24s (the key drafting), 17, 18, 23, and every
  `cloud+local` ticket's local step (16's walk of one real set, 20b's design gate, 21a's peak-memory
  run, every posting run and score).
- At most six local builders at once (24 cores, 26 GB; watch `free -g`). Launch builders from your own
  config (messages do not cross config dirs).

## The loop, per ticket (ADR 0041; docs/sdlc.md; the `orchestrate-wave` skill)
1. **Acceptance tests first.** An `acceptance-writer` agent reads the ticket's plan entry, its contracts
   and m0-screens' words, and commits failing tests on the ticket's branch (`acceptance:` commits) under
   the acceptance path. The builder starts on that branch and may not weaken them (a committed lint
   refuses a non-`acceptance:` commit touching them).
2. **Build** to the budget. The builder runs one refuter pass on its trust boundary and, if it words
   codes, one words gate; merges its partner's committed head in a scratch copy and runs both suites
   (the merged tree is where contract faults show); keeps every suite run in a file; commits, says READY.
3. **One review, one gate, in parallel:** a `pr-reviewer` on the committed head; beside it the
   `ux-critic` words gate (a catalogue) or walk (a screen, m0-screens §8 by keyboard). Neither built
   the ticket.
4. **At most two fix rounds,** one combined message each, each fix re-checked. A later finding is filed
   and named in the PR body, unless it is a security hole scoring 75 or more, or a crash or false
   statement a QS meets. **Every finding scoring 50 or more, or of a class seen before, leaves a
   committed check** (a test, lint or scan failing on the class) in the same PR, or a filed debt.
5. **Merge.** You push and open the PR, merge `main` into the branch (never rebase) and confirm the new
   head changes only what `main` brought; post `design-gate` from the independent gate's verdict; run
   the posting run on an engine PR and accept it by the accept rule (no failed stage gained; nothing lost
   or changed without a judged reason; gains judged: read the table and `states.py`); on a reading
   ticket, score it; merge when the required checks are green. Then merge `main` into the next PR in
   line yourself.

**The scored loop** (17, 18, any reading fix; docs/plans/M0.md, "The scored loop"): after the first
READY, score the head, then fan out many agents, each on a different failing sheet, looping until the
score rises; stop when two scored heads in a row gain no sheet, or at the budget. A head may not lose a
passing sheet without a judged reason. Record each head's score in #45.

## Session 06's order (docs/plans/M0.md, "Finishing M0", is the source)
| Ticket | Where · effort | Budget | Starts | Merges after | Its local step | Issues on it |
|---|---|---|---|---|---|---|
| 24s Scorer and keys | local · high | 3 h + owner | now | — | key drafting; the owner's confirm and custody | — |
| 16 Sheet viewer | cloud+local · medium | 3 h | now | — | design gate; walk of one real set | — |
| 17 Views within sheets | local · high | 4 h | now; loops once 24s merges | 24s | posting run, score | #102 false continuations; #100 |
| 18 Plot registration, render check | local · high | 4 h | now; loops once 24s merges | 24s; 16 if the buffer format changes | posting run, score | #87; #88 only if F1 shows it |
| 19a `takeoff` Step 1 | cloud · high | 3.5 h | now | — | words gate | #95; #102 Discipline-less (with 21c) |
| 21a Read job, per file | cloud+local · high | 3.5 h | now | 19a | words gate; peak-memory run | the CAD worker's provisional cap |
| 23 Jev spot check | local · medium | 1.5 h | now | — | the whole ticket | — |
| 20b Screens: the Drawing Set | cloud+local · medium | 3 h | 21a's reviewed head | 21a | design gate | — |
| 21b, 22 | per the plan | | launch when their edges clear | | | |

Launch all seven acceptance-writers together at the start, then each builder as its tests land. Rough
shape: 16, 19a, 21a and 23 merge in hours 3–4; 24s by hour 3 if the owner confirms the keys promptly;
17 and 18 after their scored loops, hours 5–6; 20b hour 6; 21b and 22 launched if their edges clear
before 7 h.

## The owner's one-time steps (ask for each once, with the exact command)
1. **Done on 29 Sep 2026, before this session:** session 05's close-out PRs are merged (#105 and #106,
   ADR 0041 and its harness; #108, the committed checks; #109, the owner's allow rules; #104, this plan
   and brief), and the owner ran `scripts/owner/autonomy-setup.sh` as root: all 10 of its checks passed,
   installing `/etc/sudoers.d/92-vextrus-autonomy`. #108 was the first PR merged end to end by a session
   (its posting run and gates posted through the App, `merge_ready`, then merged). Nothing to ask here.
2. **When 24s reaches it:** the owner confirms the drafted keys on 24s's review page (1–2 hours for both
   sets), then runs `scripts/owner/keys-custody.sh` (and, if 24s proposes it, the third user's setup
   for the pipeline's own exports). Until then no scored loop starts; 17 and 18 build and tune with
   `--no-post` meanwhile.
3. **Nothing else is the owner's** in session 06. 24's run and the walk are session 07's or later.

## Done means (check each, and keep checking until all hold or the budget ends)
1. **As many of M0's remaining tickets merged as the budget allows,** in the order above, each through
   the loop, each with its local step done and every serious finding's committed check in its PR.
2. **The scorer's first Development-Set scores recorded** in #45 (sheet and view level on `main`'s
   head: the baseline), then each scored head of 17 and 18.
3. **M0 ready for the owner's walk,** or, if tickets remain (expected: 21b, 22, 21c, 26, 24), **session
   07's brief written** from this one: its order, budgets and what is broken. If all merged, write
   M0's close instead: the walk's steps and exact commands for the owner.
4. **The measures in #45:** each ticket's clock against its budget, its rounds, its gate results, its
   scores; lessons in `docs/knowledge/lessons.md`, **each naming the committed check that guards it**,
   or listed as a debt.
5. **The hand-off PR merged** (brief, lessons, plan updates) by you, with its checks green.

**Do not end your turn while any of these is owed and the budget remains.** A summary, a question you
could answer yourself and a background session still running are not done.

## What is broken or waiting
- **#102** (19b on real sets): 7 of 20 real continuations were copied title blocks (17 fixes the class,
  checking a continuation's view title against its title block); a file with no Discipline is left out of
  every comparison (19a decides how such a sheet is compared; 21c raises its Questions).
- **#100:** continuation order, pasted control characters, a revision in the number (on 17).
- **#95:** `flush` then `seed_demo` fails, the Markets not put back (on 19a, which touches the seed).
- **#87:** an inch layout's paper read in mm (on 18). **#88:** the renderer ignores a style's width
  factor and oblique angle (18 only if its render check shows the cost).
- **The CAD worker has no memory cap** (`VEXTRUS_CAD_WORKER_MEMORY_BYTES = None`): 21a sets a
  provisional cap from one local run's peak memory per real file; 24 sets the final one.
- **13's `sheet_report` is not stored:** 21a's job records it and a follow-up to 14 stores it (a
  drawings migration: name its owner before launch; 21a adds none).
- **The posting run's non-interactive accept** was taken out of the checks session's scope as the
  owner's change: if `scripts/real_drawings/command.py` still asks at the terminal when 17 first needs a
  posting run, ask the owner once (with the change written for them) and keep the rest moving.
- **Engine test failures with no name** (#82's, 14's under load): the failures log now keeps each one;
  diagnose one that comes back before loosening anything.
- **Before the beta, not M0:** #92, #94, #73, #74. **#77** (the direct path's namespace): real drawings
  go only through the check. **Before M1:** the U+2068/U+2069 isolates.
- **Clean-up for the owner** (the guard refuses `rm -r`; give the commands): session 05's merged
  worktrees, the `scratch-*` folders under `.private/work/session-05/` (keep `reviews/`, `log/` and the
  reports). Leave the stray copy `4d83537e` stopped and never `claude rm` it: its directory is the main
  checkout.

## What each prompt must carry (keys written exactly in both prompts of a shared shape)
**Every prompt:** the ticket's plan entry and its "Finishing M0" row; its budget and elapsed; its
acceptance tests' path; the exact keys, forms, one example and the merge edge of every contract it meets;
every suite run kept under `.private/work/session-06/<ticket>/` (pytest `-rf`); READY and BLOCKED lines;
commit, never push. A UI ticket walks m0-screens §8 by keyboard before READY.
- **16:** the buffer format as on `main`; its development-only route `web/src/routes/dev/sheet/`
  (m0-screens 4.6); its walk on 13's sheets from the harness.
- **17:** 13's storey keys (D7), "typical" only beside a floor or plan word; view titles to 15's node as
  `view_titles`, a JSON-array text, `"[]"` when none. Storey keys have no display words yet: the first
  ticket to show one adds its words to a catalogue first. The view-level export fields 24s scores.
- **18:** `render_f1.py` declares `CODE`, `VERSION`, `MILESTONE`, `KIND` and `MESSAGE`, or 18 names it in
  `catalogue.py` as a non-Check (19b's scan fails loudly otherwise). Never changes the buffer format's
  version while 16 decodes it; keeps 16's pixel test green.
- **19a:** a pasted list or typed range comes back parsed and the QS sees the numbers before confirming;
  19b owns that parser and 13 the number-parts rule: 19a calls them. The confirm service calls 15's
  `record_override` for each change to Jev's pick (D10); it writes confirmation, exclusion and confirmed
  kind on 14's `SheetRevision`; `set_register` is its (D5). The seed's "Held, answered" is 19a's.
- **21a:** runs on the CAD queue; 13 bounds its own finder, one budget per file. A limit above 0 tells
  the QS the file was not read in full, by which limit, never a bare "no sheets". The seed's job-borne
  4.5 states on BP-02 and MG-01 go in a named shared edit to 19a's `vextrus/seed/takeoff.py` after 19a
  merges. The upload operation's shape (path, request, every refusal body) is written in both 21a's and
  20b's prompts. The `--job` mode edits `scripts/real_drawings/`: the reviewer reads it in full.
- **20b:** that upload shape; the Market's Disciplines as Library data; 14's rulings on the file summary
  (it counts only files being read; a waiting file's "next" stays per Developer); a file not read in full,
  from 21a. API types from 21a's reviewed head.
- **24s:** the plan's entry in full; the drafting agents never read the pipeline's export or code for the
  sheets they key, and no builder is pointed at the drafts; the refuter's first attack is scoring a
  hand-made export.
- **Later (21c and 23):** decide whether the sheet-kind options carry descriptions (in 15's live check,
  2 of 7 invented sheets changed answer without them).

## How the build runs
- **Launch** local tickets from the main checkout:
  `claude --bg -w <ticket>-<slug> --name s6-<ticket> --effort <medium|high> --settings
  .private/work/session-06/builder-settings.json "$(cat .private/work/session-06/final/<ticket>.prompt)"`
  (a copy of session 05's `wave3/builder-settings.json`). Cloud tickets per the runbook, after the
  remote check.
- **Watch:** `SendMessage` with `notify_when_idle` (it fires once: subscribe again after each notice);
  `claude agents --json`; `claude logs <id>`; a background Monitor loop on heads, states and memory.
- **A stopped or idle session:** never `claude --bg --resume <id> "<message>"` while it runs. `claude
  stop <id>`, then from its worktree `claude --bg --resume <id> "$(cat <fix>.md)"`.
- **Posting runs and scores one at a time,** by absolute path, never with a `cd` out of a worktree:
  `flock /home/riz/vextrus-cubit/.private/work/session-06/real-drawings.lock
  /home/riz/vextrus-cubit/scripts/real-drawings <branch> --no-post` while tuning.
- `gh pr edit` fails: set a body with `gh api -X PATCH repos/vextrus/vextrus-cubit/pulls/<n> -F
  body=@<file>`.

## State lives in files, not in your context
Keep `.private/work/session-06/STATE.md` current after every event: the ticket table (session name and
id, worktree, head, round, clock against budget, next step), the scores, the open questions. To resume:
STATE.md, #45's newest comments, `claude agents --json`, `gh pr list`, each agent's NOTES.txt.

## Read first
1. `CLAUDE.md`, ADR 0041, `docs/sdlc.md`, `docs/knowledge/lessons.md` (sessions 03–05 and the
   debts list).
2. The `orchestrate-wave` skill: your runbook.
3. `docs/plans/M0.md`: "Finishing M0" (all of it), then the waves' ticket texts, "The contracts fixed
   here", "Labels".
4. ADRs 0026 and 0030 with their newest History entries; #8's key-matching contract (for 24s).
5. `.private/work/session-05/STATE.md` (decisions D1–D10; the rulings) and #45's newest comments.
6. Session 05's prompts as templates: `.private/work/session-05/wave3/common.md`, `wave3/final/*.prompt`,
   `reviews/fix-*.md`.

## Law in force
- Secrets are never printed or written. Real drawings stay in `.private/`; only conventions and counts
  leave. The keys are never read by an agent; only the scorer reads them.
- OpenConstructionERP is AGPL: learn, never copy. No AGPL library (PyMuPDF). No proprietary converter.
- The product's word is **Rebar**. No market literal in code; every visible string through a catalogue;
  logical CSS only.
- You push, open PRs and merge after the loop, with the required checks green. Never force-push,
  rewrite history, skip hooks or merge a red check.

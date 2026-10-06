# Session 15: rebuild M0 from a measured map, on the full-width factory

## Starting the session (the owner)
1. In a WSL terminal: `cd ~/vextrus-cubit && git pull`, then `df -h /` and `free -g` (keep 40 GB free). Check
   https://www.githubstatus.com: nothing lands while Actions is down.
2. Stop every finished background session in the agent view (the governor counts live local agents).
3. Start the orchestrator with `scripts/factory/orchestrator.sh`: Opus 5.5 at `medium` for the whole session (CLAUDE.md;
   the owner kept medium on 6 Oct 2026 after research found no evidence `high` helps an orchestrator). Use `high` per role
   through each agent's own effort setting. Never `xhigh` or Ultracode; no dynamic workflow but `real-set-walk`. Then say: "Read docs/handoff/session-15-prompt.md and run it."
4. Keep the pane open for the owner-only steps, each given as an exact `! <command>`:
   - after #443's rebuild lands: `! cd ~/vextrus-cubit && git pull && sudo bash scripts/owner/toolchain.sh`;
   - after the cache redesign and T-249 A land: `! cd ~/vextrus-cubit && git pull && sudo bash scripts/owner/keys-custody.sh`;
   - once, before the first cloud wave: the checklist in `docs/runbooks/cloud-env.md` (S14-C1).

---

You are the orchestrator of session 15. **Rebuild M0 from a measured map. First find out, with evidence, what the product
is today and where the engine is weak (Phase 0). Then write a fresh, non-overlapping M0 ticket set from that map
(Phase 1). Sweep it at full factory width (Phase 2). Take G1 to PASS twice in a row on main, walk both real sets yourself in
a browser, and only then tell the owner the product is ready for their walk (Phase 3).** M0 must leave at production-grade code
quality, ready for M1. Product work only: the factory is the tool.

## Finish line (each condition is checked by its command; the evidence goes where it says)
1. The gap map exists, with evidence for every M0 clause: `.private/work/session-15/gap-map.md`.
2. Every open M0 issue is mapped into a new ticket or closed with its reason:
   `gh issue list --label M0 --state open --search '-label:factory' --limit 500 --json number` lists exactly the new set's
   numbers (compare the two lists; never trust the default page of 30).
3. G1 passes twice in a row on main's current product code: `uv run python -m scripts.walk.ready origin/main` exits 0.
4. Your own browser walk of both real sets finds no open BLOCKS:
   `.private/work/session-15/walk/` holds the defect list, and each finding is fixed or filed.
5. Both scored real-drawing runs are recorded on main's head (`.private/work/rd/`), with each M0 measure against its bar.
6. `docs/handoff/session-16-prompt.md` is merged.
The session ends when all six hold, or when the time budget runs out. In that case, write what holds, what does not, and why.

## Working through a long session
- **Keep `.private/work/session-15/STATE.md` as the source of truth.** It holds the finish line above with each condition's
  state, the owner's rulings in their words, the decisions, the open PRs and the exact next step. Update it at every phase
  change and before any risky step. Context compacts automatically when it fills, and this file plus CLAUDE.md is what you
  keep, so never stop or summarise early to save tokens.
- **Keep going until the finish line holds.** The stops wanted are the owner-only steps (exact `! <command>` lines), a
  question only the owner can answer (one at a time, your recommendation first), and the finish line. A progress report is
  not a stop: write it to STATE.md and continue.
- **Write `elapsed X / Y` in every message to a builder and to the owner** (the session's budget is set by the owner at the
  start). It paces the work and shows when to cut scope.
- **Delegate when the work is independent, read-heavy, or needs its own context:** one question per agent, its output as one
  file. Keep your context for decisions. Do not send a subagent to re-check your own work; the factory's gates (review.py,
  merge_ready, G1) are the independent checks.

## The owner's intent (verbatim, 6 Oct 2026)
- 11:34Z: "we'll work on our real product but from scratch as if at first researching the current state of the product and gaps
  with architectural reviewing along with having a clean code structure; mainly focusing on the gaps and weak point we've in the
  engine system for 100% production grade code quality of M0 and fully prepared to move on to build M1 next … at first addressing
  with in-depth exploration, tesing and researching of the own product's current state at initial phase of the session and then
  writing the tickets, issues in such way with maximum parallelism … actually be able to produce the M0 production build
  resolving all current gaps, issues fixed and upgraded to the most ambitious state for M0 before start building M1."
- 11:39Z: "rewrite the session 15 brief this way, with the old issues closed as superseded during Phase 1 rather than now"
- 08:22Z: "concurrently we can run 16 cloud sessions that we should take full leverage with 4-6 local sessions … resolving
  everything with real-drawings walk at first from your side and deliver the final output for me to walk M0 finally"
- 07:23Z: "no more loops, I can't afford that at all"
- 5 Oct, Q9 (bulk-share edges): Sheets with no Discipline are one row under half (b); a Discipline the key doesn't name counts
  toward the total. Q10: the 90 % reading bar is M1's goal, not M0's.

## The factory you have
Session 14 rebuilt the factory: 17 PRs merged (#467-#517). Each line is on main; check it with `gh pr view <n>`.

| Area | What you have | PR |
|---|---|---|
| Review | `scripts.factory.review run <PR> --round <n>`: the lens models per CLAUDE.md, allowlist-only and docs-only PRs judged by code, one refuter, the verdict recorded by code, git hooks off in review trees, the ledger checked under its lock. About 6 min and $2 a round. ADR 0043. | #489, #506, #511 |
| Scale | No count of PRs in progress; 16 concurrent cloud sessions (the platform's limit); 6 local agents; 8 review slots; 3 tickets per hot-file area | #517 |
| Builders | crosspr self-review (another open PR is "ok" only on a fully green baseline), the READY checklist, the acceptance lint (run it on each acceptance commit before launch), Sonnet 5.5 for ordinary tickets (`--tier ordinary`) | #509, #514, #487 |
| Watching | one trailer reader, LOCAL-IDLE, `scripts.factory.state [--resume-md <f>]` (the open-work table from tools), the mod's `/wip` and `/factory` pane (facts only), band, toasts, status line | #468, #516, #475, #500 |
| Landing | `scripts.land <PR>` (merges main, waits for the new head's ci, merge_ready); root-only tests no longer block builders; CI's heavy jobs run only on READY heads | #480, #470, #497 |
| Leaks | `scripts.factory.publish`, the watcher's leak message through `launch say`, the allowlist batch (resumable), publish pushes only a verified READY head | #512 |
| Cloud | the `vextrus` cloud environment (PG18 and its roles, passwords only from the environment); browser walks are local-only in cloud sessions (they report and never fall back to Playwright) | #515 |

Not landed, and carried in:
- R3: the replay gate, and deleting `.claude/workflows/review-pr.js`. Until it lands, `/review-pr` still exists: never use it.
- F10/12/13: the old-sessions sweep, hardlinked venvs and command-card extras.
- F9: `recover.py`, narrowed, with #503.
- G3: the guard narrowing was closed at the cap with two bypasses found; re-scope it or drop it.
- Open factory issues: #488 (review sandbox), #503, #504, #507, #513, #518.

Check whether R3 and F10 merged at the close (`gh pr list --state all --head s14-r3`); if not, finish them first, in parallel with Phase 0.

**How a ticket runs:**
1. `acceptance-writer` (Opus 5.5 high) commits failing tests on the ticket branch.
2. `scripts.factory.launch` starts the builder:
   - cloud (`--tier ordinary`, Sonnet 5.5 medium; `--tier hard` for drawings, hostile input and security);
   - local for real drawings.
3. On READY, open the PR. In the body, a heading always follows the Cut list before the footer, and Cut holds "None." or
   `#n` items only.
4. Review it: `uv run python -m scripts.factory.review run <PR> --round <n>`.
   - About 6 min and $2; it records its own verdict.
   - Up to 8 run at once.
5. On FIX, send the fix message to the builder's session at once:
   `scripts.factory.launch say <session> --file <f> --elapsed <m>/<budget>`.
6. On PASS, run `uv run python -m scripts.land <PR>` in the background.

**Binding lessons of session 14** (`docs/knowledge/lessons.md`, Session 14):
- **Two rounds, then simplify.** When a round finds a new edge of the same rule, do not patch the edge. Replace the rule
  with a simpler one that closes the class (one source of truth, no derived guesses), or narrow the ticket and file the rest.
  - Patching edges cost R2 nine rounds, and S1, AL and K1 four to six each.
  - A third round needs an exception (security75, fix-regression).
  - Past the cap, close the PR and re-submit it as a new one.
- **Acceptance pins that contradict a ruling** are amended by an acceptance-writer with `scripts.factory.amend`.
- **After a merge moves main,** a conflicting branch merges main before its review (review.py refuses otherwise).
- **The PR's code runs unsandboxed during review (#488).** Review only our own builders' PRs.
- **Restart the watcher after any watch.py merge** (#507).
- **Two power cuts in session 14** left empty `.git` object files. After any cut:
  - run `find .git/objects -type f -empty`;
  - move each empty file aside by name;
  - re-fetch and run `git fsck --connectivity-only`.
  - `/tmp` does not survive a reboot: keep PR bodies under `.private/work/`.

Caps (S14-K1, if merged; check `scripts/factory/governor.py`): no count of PRs in progress, 16 concurrent cloud sessions (the
platform's limit), 6 local agents, 8 review slots, 3 tickets per hot-file area. The memory, swap and disk floors still refuse
first (24 cores, 26 GB RAM).

## Phase 0: discovery (about 2 h; all read-only and parallel; start at once)
Fan out background agents, one question each, each writing one evidence file under `.private/work/session-15/discovery/`
(no drawing content in any file meant for git):
1. **Engine architecture review** (Opus 5.5 high, `codebase-design` vocabulary): `engine/` module by module.
   - Map the module boundaries, the seams, duplicated logic and shallow modules.
   - Find where reading, recognition, storeys, paper scale and Question generation are weak *structurally*.
   - Name each weak point with file:line evidence and the G1 failures it explains.
2. **App architecture review** (Opus 5.5 high): `vextrus/` (Django apps, Step 1, proposals, acts, DomainEvents). Same output.
3. **Web review** (Sonnet 5.5 high): `web/src` structure, the state model (model.ts), and the m0-screens §8 gaps.
4. **G1 baseline on main** (local, the real-drawing lock):
   - first re-submit #464 (G1 judges the owner's Q5 limits) through the factory, so the walk judges correctly;
   - then `scripts/walk/run.py <main sha40>` and the `real-set-walk` workflow.
   - The verdict is the M0 scoreboard.
5. **Scored real-drawing runs** on both sets (local): sheets, views, storeys, titles, render_f1, Questions per Discipline, act p95.
6. **Test-suite health** (Sonnet medium):
   - flakes (#245, #142, and session 14's test_launch_round1 SIGTERM test);
   - slow shards and skipped tests;
   - acceptance coverage per M0 clause.
7. **Code-quality audit** (Sonnet high): lint debt, dead code (#423), import-linter contracts, type holes, the largest
   functions.
8. **Backlog triage** (Sonnet medium): for every open M0 issue (`.private/work/session-14/close/m0-state.md` §2 lists 195 open)
   and the 12 closed PRs (§3), say what each still claims, and whether main shows it today.
   - The 12 closed PRs carry proven work. Triage each as keep, rebuild or drop against the map; never discard one blind.
     - Proven: #443 (ACadSharp, unblocks the held Plumbing DWG), #434 (posted on the real sets), #417 and #432 (passed review),
       #464 (needed before any G1).
     - Not in a PR: t229 (local branch 8738bfc46), T-W334, T-249 A, T-236, T-W315, T-W326, T-W330, T-W314b.
   - Unowned flags, each needing a Step 0: f-11 (#322), f-12 (#324, delta 192), and Edison structural's zero Question headroom.

Then write **the gap map**, `.private/work/session-15/gap-map.md`:
- each M0 finish-line clause (docs/milestones.md), with its measured state and evidence;
- each structural weak point;
- what fixes it and which files it touches.
Lead with what is broken.

## Phase 1: the ticket set (about 1 h)
1. From the gap map, write a fresh M0 ticket set with the `to-tickets` skill.
   - **Each ticket owns its files.** Two tickets never touch one hot file at once (`step1.py`, `proposals.py`, `views.py`,
     `model.ts`, `en.po`); serial chains are named.
   - **Each ticket has one finish check tied to a clause,** a budget, a tier and a model.
   - **Structural fixes come first,** where one fixes many symptoms.
   - **The kept closed PRs re-enter** as tickets in this set, re-submitted from their branches.
2. **Close the old issues as superseded.** For each open M0 issue, either:
   - map it into a new ticket and close it with "Superseded by #<new>" (a short comment; keep the issue's history);
   - or, if the gap map shows it fixed or obsolete, close it with the evidence.
   - Factory issues stay open unless fixed. The 13 issues labelled both `factory` and `M0` (#249-#252, #256, #261-#265, #269,
     #272, #277: reading-measurement tooling, which Q10 makes M1's) move from the M0 label to M1.
   - Do it in batches and say the count.
3. Write each ticket's acceptance tests (acceptance-writer, Opus high), as many in parallel as the floors allow.

## Phase 2: the sweep (full width)
1. Launch every unblocked ticket at once, up to 16 cloud and 6 local.
   - Real-drawing work runs under the one lock: posting runs take 25-50 min.
   - The cache redesign (key the posting cache on the modules the read job loads) comes early, if the map confirms it.
2. Review every READY head at once, up to 8 slots. Fix at once. Two rounds, then simplify.
3. Land as each passes. Re-run the scored real-drawing check after every engine merge.

## Phase 3: the walk
1. G1 on main, repeated until two consecutive PASS and `uv run python -m scripts.walk.ready origin/main` exits 0. Each
   BLOCKS finding becomes a fix ticket in Phase 2's loop.
2. Your own walk of the running product on both real sets: the `product-review` skill with chrome-devtools, by keyboard,
   m0-screens §8. Fix or file every finding.
3. Only then tell the owner the product is ready for their walk, with the G1 verdicts, what was measured and anything not
   proven.
4. Write `docs/handoff/session-16-prompt.md` for M1.

Cut first if the session runs long: T-W330, #416, T-236, T-249 B. Say what was cut.

## Laws that do not change
CLAUDE.md's Law section, in full:
- account A;
- launches only through `scripts.factory.launch`;
- time from `date -u`;
- Monitor on a log, never pgrep;
- no 'walk now' without a passing G1 on main's current product code;
- secrets never printed or committed;
- nothing from real drawings in git, an issue, a PR or a cloud prompt;
- OCE is AGPL, never copied;
- cad2data's converters are never run;
- the repo is public;
- statuses only through post-status;
- explicit paths; no force push, history rewrite or recursive delete.

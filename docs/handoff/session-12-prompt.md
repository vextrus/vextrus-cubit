# Session 12: rebuild the harness into Vextrus's software factory (research → spec → owner approval → build → prove)

## Starting the session (the owner)
1. In a WSL terminal: `cd ~/vextrus-cubit && git pull`, then `df -h /` (keep ≥ 30 GB free; session 11 filled the disk) and
   `free -g`. No custody re-run is owed (session 11's ran 16/16 on main 1d949436; nothing under `tools/scorer/`,
   `scripts/real_drawings/` or `scripts/owner/post-status` changed since).
2. `claude --model claude-opus-5-5`, then `/effort` → **xhigh** with **Ultracode** on, check `/status`, and say:
   "Read docs/handoff/session-12-prompt.md and run it."
3. Keep this session's pane open: some steps need you to type a built-in command (`/usage`, `/doctor prompt-audit`,
   `/skill-doctor`, `/plugin …`) or a `! <command>`; the session asks for them once, as one checklist.

---

You are the orchestrator of session 12. **This session builds the factory, not the product.** You change the harness —
Claude Code setup, agents, skills, hooks, workflows, mods, settings, permissions, CI, scripts and the SDLC docs — so that
session 13 can take M0 to a walk-ready state fast and at quality. You touch product code only where a factory check needs a
product hook, and then through the normal review loop. The owner chose this session's mode (4 Oct 2026): "Opus 5.5
xhigh+dynamic workflow "Ultracode" mode for maximum output". It overrides CLAUDE.md's medium default for this session only;
builders you launch still take the effort their ticket needs.

## The owner's intent (verbatim, 4 Oct 2026; read it twice)
> "systematically end session-11 and prepare for next session-12 which will be major harness upgradation, not directly acting
> on our project … after we're done with our harness, claude code setup and our overall workflow sdlc for this project with all
> the learnings till session-11 and additionally adapting latest updated Claude Code features that would tremendously affect
> on our sdlc of this project, every sessions quality and systematically converting Claude Code into specialized customized
> harness version just for this project; like a powerful software factory engine harness to develop this project with
> highest quality in shortest time possible without concerning tokens: focusing on quality output with lots of parallel
> sessions and agents mostly in cloud sessions possible; in a word a complete customized upgraded updated sdlc for agentic
> coding software factory with leveraging "Claude Mods" and other major updated of Claude Code recently"
>
> "I want the next session-12 to be very in-depth at first at exploring and in research before planning the harness
> upgradation; synthesizing everything it'll ultrathink with maximum depth thinking to produce the spec file and wait for me
> for the approval and upon my approval it'll start executing and finish up executing the most ambitious upgradation of our
> entire setup; upon finishing up the execution the session-12 will guide me and prepare us for session-13 where with all
> upgradation we'll act on remaining M0 and hopefully on session-13 at any cost we'll reach the ultimate version of M0 for me
> to walk and after my walk on M0 we can prepare for M1 from session-14 or session-15"
>
> "if you run builders in cloud then this machine will have to bear less load, we have to use most of the cloud sessions
> system so that we can run as much sessions without burdening our local machine, on our local machine only the needed core
> sessions will run"

The owner's two questions from session 11's close, which the spec must answer **as asked**, in plain words to the owner:
1. **Why were D1–D10 not found before the owner's walk, and what should we have done to prevent that?**
2. **Why is the real-drawing reading quality so low, and what would make it 90 %+ on real drawings?**

## Read first (delegate long reads to agents; keep your context for decisions)
1. This brief.
2. `.private/work/session-11/s12-research/critic.md` (the completeness critic: contradictions X1–X16, owner questions
   Q1–Q15, the 15 ranked changes). **Its §0 rule binds you:** take a settings key, flag or frontmatter field only from
   `cc-changelog.md` (quoted from the changelog), from a raw docs page that `agentic-sdlc.md`/`cloud-capacity.md` fetched or
   that you fetch, or from `claude --help`; `cc-docs.md` is orientation only.
3. The eight research files beside it, as each phase needs them: `cc-changelog.md` (Claude Code 2.0 → 2.1.289 by theme,
   ranked top 10), `cc-docs.md` (orientation), `harness-inventory.md` (every component today: keep/change/replace),
   `lessons.md` (sessions 06–11, failure classes C1–C14, the D1–D10 trace), `cloud-capacity.md` (why cloud stopped, the
   hidden `--cloud --ref/--on-branch` flags, what runs where), `reading-quality.md` (why the score is low; strategies S1–S7),
   `quality-gates.md` (gates G1–G5), `agentic-sdlc.md` (2025–26 practice, cited).
4. `.private/work/session-11/review-main/report.md` (D1–D11 from the agent's walk of main on the real sets) and
   `.private/work/session-11/STATE.md` from 15:55Z on (the close, with the CLOSE section's heads).
5. `CLAUDE.md`, `docs/sdlc.md`, `.claude/` (settings, agents, skills, hooks), `docs/knowledge/lessons.md`: what you change.

## Where M0 stands at session 11's close (facts from tool results, 4 Oct 2026)
- **main** de5b2373. Merged in session 11: #214 (the job's export keeps each sheet's paper), #216 (#206 set-aside chip),
  #217 (#202 Ctrl Z / one post per answer), #225 (#167 Step 1 words), #213 (scored loop 2), #226 (guard: the seed's synthetic
  DWGs by exact path), #244 (#231 Plot/Compare/CAD-dark in Step 1), #238 (#230 Step 1 live refresh, Coverage step names).
  **#242** (each test process's storage folder removed at exit) was landing at close: check `gh pr view 242`; if open, land
  it first (Phase 0).
- **Scores** (blind scorer; counts): main 1d949436: Edison sheets 44/217, views 418/739; Sample 8/67, 203/417. Loop 2's head
  0e30dc9a (merged as #213): 45/217, 429/739; 8/67, 215/417. Loop 3 `loop-iou` ae25e64e (unmerged): views 439 / 238, sheets
  unchanged. **main de5b2373 is unscored.** The ruled bar (session 08): Edison ≥ 174/217 sheets and ≥ 592/739 views; Sample
  ≥ 54/67 and ≥ 334/417 (80 %). The owner now asks about 90 %+ (critic X8: not yet a ruling).
- **Carried: built, reviewed, not merged** (heads at close; "local" = not pushed, in its worktree under `.claude/worktrees/`):
  | PR / branch | What | Head | State |
  |---|---|---|---|
  | #237 `t182` | demo seed = the real read job's recorded output (absorbs #150, #204) | a28db350 (pushed) | review PASS, posted clean; **CI python times out at 35 min twice** (main takes 23–27): diagnose first |
  | `t-readlock` (#227) | Step 1 acts never wait on a read job (D1) | 675bdc7b (local) | review FIX 2×50 → fix round 1 committed (match writes after propose; advisory lock in record_progress); needs re-check + posting run |
  | `t229` (#229) | a matched Plot page is a second source; gaps hold only their neighbours (D3; owner ruling) | 8738bfc4 (local) | review FIX 70 (title words anywhere on the page) + 50 (keep-open lost) → fix round 1 committed (title read in order near the number; keep-open by gaps); needs re-check; no real-drawing run yet |
  | `t228` (#228) | Jev's top kind proposed; Question only when close or contradicted; Slab details (D2; owner ruling) | 9800dc4b (local) | review FIX 75 (pre-pick not shown → ruling: keep and show it, amend §5) + 50 → fix round 1 committed; needs re-check + posting run |
  | `t160` (#160) | one paper scale: outlines on their paper (D4) | d6f22236 (pushed) | sheets off paper 117 → 5; **render_f1 46 lost / 84 changed** (structural A0 guess without Plot paper): **the owner's trade question**; unscored (the disk filled) |
  | `loop-iou` | scored loop 3: tighter view boxes | 2973a919 (local; 99abbf56 pushed) | +10 / +23 views at ae25e64e; later heads unscored; PR body written; not reviewed |
- **Not started:** D7 (#232 continuation runs shown as copies), D9 (#233 storeys), D10 (#234 presentation plans), #235 (D11
  smaller items), #236 (the seed's Plot PDFs are stubs), #239 (Zoom to view / Outlines), #240 (Plot CropBox), #241 (one-commit
  empty state), #243 (pytest basetemp retention), #245 (CI flakes under load), #211 (guard: the real-drawing literal scan),
  and the design-gate mays #218–#224.
- **Open issues:** 52 (`gh issue list --state open`): 30 labelled M0, 10 needs-triage, 11 before-beta.

## The answers you build on (the research's, cited there; verify before relying on them)
**Why D1–D10 escaped** (`lessons.md` §4, `quality-gates.md` §1). Every gate between merges measured something other than a
QS doing the job on a real set:
- acceptance tests ran on fakes (the web fixture even used number keys the API never sends: D8);
- design gates walked the synthetic demo seed, where no file is ever reading (D1, D5);
- the real-drawing check and the scorer measure exports (sheets, views, render F1), not Questions, bulk-confirmability or
  waits (D2, D3);
- a session-07 agent walk on the real sets found the precursors, but only its BLOCKS/WRONG items became tickets (its F6
  became D2);
- a ticket's "cut for the budget" spec items were closed with no follow-up issue (D6);
- fixes were never re-walked together on the real sets, and the owner was told "walk now" twice without an agent
  rehearsing the walk.

**The fix is a gate, not more care:**
- a real-set walk gate (G1) that must pass before the owner is asked to walk;
- QS-burden measures in the real-drawing check (G5): Questions per Discipline, bulk-confirmable share, act-during-read
  latency;
- fixtures recorded from the real API, or closed schema types (G2a);
- no silent cuts, and every walk finding becomes an issue.

**Why the score is low** (`reading-quality.md` §1–3). Views are 57–59 % joined; the sheet-level fields other than storeys are
93–100 % right. A sheet passes only if every one of its views joins with its title and subject right, so the metric
compounds: 80 % of sheets needs ≈ 94–97 % per view, and 90 % needs ≈ 97–98 %.

Rule-based view finding (`engine/recognise/views.py`, 2,278 lines, ~60 thresholds) has plateaued:
- each rule shifts boxes elsewhere;
- the two sets' conventions pull opposite ways;
- refuters keep finding counterexamples;
- each loop gets 2–4 scored heads through one ~29-minute lock.

Part of the residue may be key-side: box conventions, turned title blocks, the slab-detail kind.

**The path:**
- **S1:** a key audit, blind scorer diagnostics and inter-keyer agreement (the true ceiling), done with the owner.
- **S2:** a fast local proxy loop, so only heads that gain get posted.
- **S3:** the Plot PDF as a second source.
- **S4:** a hybrid vision proposer (Claude vision on rendered sheets, snapped to vectors) for kinds and missing views. It is
  the only strategy the research expects to reach the sheet bar; its gains are labelled estimates.
- **S6:** a held-out set before any claim.

## Laws that do not change (CLAUDE.md, ADR 0041; the guard enforces most)
- **Real drawings** and anything derived from them stay under `.private/` and local.
- **The repo is public:** no drawing text in commits, issues, PRs, workflow files, mods or agent memory.
- **Never** print secrets, delete recursively (ask the owner for `! rm -rf …`), rewrite history, change the ruleset or branch
  protection, or admin-merge.
- **Gates** are posted only through `post-status`, from the main checkout.
- **The owner decides** product, scope, spend and anything irreversible: one question at a time, your recommendation first
  with its reason in a line.
- **Changing the guard** is a hostile-boundary ticket (high effort plus a refuter).
- `docs/sdlc.md`'s "a harness change should remove as much as it adds" stands. Its "no orchestrator code" half is the
  critic's Q1.

## Owner questions: two lists (don't ask what the owner already answered)
The owner's "without concerning tokens" covers plan usage: don't re-ask it. Ask spend only for money outside the
subscription (the $500 credit, API-key vision runs).
- **(A) Blocking — asked one at a time before Phase 3:**
  - Q1, before Phase 1: lift `docs/sdlc.md:111-113`'s "no orchestrator code". Recommend yes: factory code is committed,
    tested and reviewed like product code.
  - Q2: this session's budget and cut line.
  - Q9: user-level settings. Recommend: subagent default Sonnet 5.5, Opus pinned in the gating agents.
  - Q11: machine limits. WSL memory/swap, and one cleanup of stale worktrees and `/tmp`.
  - Q10: only if cloud needs money outside the plan.
- **(B) Everything else — in the spec with your recommended default; asked one at a time after approval, while Phase 3's
  builders run:**
  - Q4 and Q5: the M0 bar (sheets and/or views; does 90 % replace 80 %?) and QS-burden targets.
  - Q6: custody re-run cadence.
  - Q7: drawing data through Claude Code.
  - Q8: the S4 vision prototype's data and spend.
  - Q12: App-pinned statuses in the ruleset.
  - Q13: key conventions.
  - Q14: repo visibility.
  - Q15: may walk counts for client sets leave `.private/`?
  - #160's render_f1 trade.

## Phase 0: orient, clock, machine (≤ 30 min)
- Before anything else, make a STATE helper, `.private/work/session-12/stamp.sh`, that appends
  `$(date -u +%FT%TZ) <text>` to `.private/work/session-12/STATE.md`. Use it for every STATE line: session 11 stamped from
  memory and drifted twice. The committed hook or status line that replaces it is a tier-1 Phase 3 item.
- Ask Q1, then Q2. Recommend for Q2: ~11 h of work, with the owner's approval wait not counted:
  - Phase 1 ≤ 2.5 h;
  - Phase 2 ≤ 1.5 h;
  - Phase 3 ≤ 5.5 h;
  - Phase 4 ≤ 1 h;
  - Phase 5 ≤ 45 min.

  Cut line: at Phase 3 + 4 h, anything not tier-1 moves to an issue labelled `factory`.
- If #242 is still open, land it first (merge main in, green CI, `merge_ready`). Refuse every launch while `df -h /` shows
  < 30 GB free.
- Measure the machine: `df`, `free`, `git worktree list | wc -l`, the size of `.claude/worktrees`, stale `claude agents`
  and bg-spare processes. Then ask Q11 with the owner's one cleanup command ready.

## Phase 1: deepen and verify the research (Ultracode workflows; ≤ 2.5 h)
The research is broad but has gaps (critic §0, §2, §3). Close them with tool results, not more opinion, and record each in
`.private/work/session-12/research/verified.md`:
- **The Claude Code surface you will configure.**
  - Run `claude --help` and each `claude <sub> --help` the spec will use.
  - Fetch the raw docs pages the critic marks as not fetched: permissions, settings, sandboxing, the hooks reference with
    each event's I/O, monitoring/usage/costs, data usage, cloud environments, routines and checkpointing.
  - Read plugins and **Claude Mods**: load the `plugin-authoring` skill and read it end to end, and read
    `claude plugin validate/test`.
  - Settle X1–X16 (critic §1), each with one tool result.
- **Built-in slash commands.** For each one the spec relies on (`/usage`, `/cost`, `/doctor prompt-audit`, `/skill-doctor`,
  `/plugin …`), first try it headless (`claude -p "/<command>" --output-format json` in a scratch directory). Whatever does
  not work goes on **one owner checklist**, asked once with the exact lines; save the outputs under
  `.private/work/session-12/audits/`.
- **Prove cloud.** `scripts/cloud/launch.py` takes only `--branch/--prompt-file/--model/--effort/--log/--repository`
  (lines 60–65), so it must first pass `--on-branch`, falling back to `--ref` (cloud-capacity.md §6). Do that as a throwaway
  local patch for the test, then as a reviewed Phase 3 change.
  - One test launch on a throwaway branch must prove: a clone from GitHub, a push to the ticket's own branch, `setup.sh`'s
    toolchain, the suite running, and how you watch it. Record setup time and limits.
  - If it fails twice, try the documented routes (`--teleport`, the `&` prefix), then account A's environment.
  - If cloud is still unproven at Phase 1 + 2 h, tell the owner. Phase 3 then runs locally, capped at 3 builders, and
    finish line 3 is recorded as unmet, naming the failure.
- **Measure what nobody measured.**
  - `/usage` (via the checklist).
  - CI's python job: `pytest --durations=50`; is the suite xdist-safe; why #237 takes over 35 min.
  - The machine's ceiling, computed rather than provoked: RSS per builder, per posting run and per gate walk from
    `ps -eo rss,cmd` samples of one of each, against `free -g` (never launch past 80 % RAM to find out).
  - The real-drawing lock's time per head, and what a proxy loop could skip.
- **The ratchet's debts** (critic §4): every lesson without a committed check.

Run a workflow per strand, with adversarial verification on every claim the spec will rest on.

## Phase 2: the spec (ultrathink; ≤ 1.5 h; then the owner's approval)
Write `docs/specs/factory.md`, with an ADR for the decisions (`domain-modeling`). Use a judge panel: three independent designs
(quality-first, speed-first, risk-first), scored by parallel judges against the evidence, then synthesised from the winner
with the best of the rest. **Tier every component 1/2/3:** 1 = session 13 cannot run without it, at most 8 tier-1 items. The
spec contains:
1. **The answers to the owner's two questions, as asked.**
   - Q2 in three lines: what 90 %+ needs per view (≈ 97–98 %); which strategies the evidence says can reach it (S1 + S4,
     labelled estimates); what it costs in sessions and spend.
   - Then the ruled 80 % bar beside it.
2. **The factory's shape.**
   - Who runs where. Cloud: builders, acceptance writers, reviewers and refuters for work proved by committed tests.
     Local: only real-drawing work (posting runs, scored loops, the real-set walk, drawing-analyst) and the orchestrator.
   - Launch → watch → review → gate → merge as committed code and workflows, not hand-run scripts in `.private/`.
   - Capacity (cloud ~8–10 builders plus 2–3 local, confirmed by Phase 1) and the resource governor.
3. **Every component, before → after:**
   - **CLAUDE.md:** toward one page of laws and a map; `.claude/rules` with `paths:` for the rest.
   - **`docs/sdlc.md`.**
   - **Agents:** a committed `builder` agent replaces `.private/.../common.md`. Pin model and effort per agent, plus
     `maxTurns`, `isolation`, a `skills` preload, `omitClaudeMd`/`--restricted` for read-only reviewers, and `memory:` only
     where the public repo is safe (gitignore first).
   - **Skills:** a `verify` skill, run before every commit; `orchestrate-wave` rewritten around the workflows; the stale
     `real-drawings` and `product-review` fixed; the prompt-audit and skill-doctor outputs acted on.
   - **Hooks:** time and budget stamps; Notification for `agent_needs_input`; Stop/SubagentStop completion gates;
     StopFailure; a PreCompact state dump; WorktreeCreate for a per-worktree DB.
   - **The guard, repaired:** `~/.pgpass`, `+ref` pushes, `reset --hard`, `find -delete`, rmtree, a cwd-independent test,
     and a refusal of self-matching `pgrep -f` waits.
   - **Permissions:** `deny` for local builders' pushes and for secret reads; `sandbox.credentials` masking and
     `permissions.blockReadsOutsideWorkingDirectories` where they close guard gaps.
   - **Workflows** committed under `.claude/workflows/`:
     - the review loop, with the two-round cap enforced and its rounds recorded;
     - the scored loop;
     - research fan-out;
     - the real-set walk.
   - **CI:** the python job split or run under xdist; #237's timeout and #245's flakes fixed; e2e on PRs.
   - **The real-drawing check:** QS-burden measures (G5), scorer diagnostics (S1) and the proxy loop (S2), all in one
     custody re-run.
   - **Decide each of these in or out, with a `verified.md` citation:**
     - `worktree.baseRef` (builders' base; push acceptance commits first);
     - `/goal` as the builder's completion condition;
     - `--permission-prompts none` for headless builders;
     - `claude agents --json` (`waitingFor`) and resume-by-full-id (`claude --resume <id> --bg`, `claude --resume <id>
       "prompt"`) as the watcher's primitives;
     - `SendMessage notify_when_idle` and Monitor until-loops instead of polling;
     - `CLAUDE_CODE_TOOL_MEMORY_LIMIT` for CAD runs;
     - `workflowSizeGuideline` and `CLAUDE_CODE_WORKFLOW_MAX_CONCURRENT_AGENTS`, and the spawn-depth setting's effect;
     - `CLAUDE_CODE_SUBAGENT_MODEL` plus `Agent(model:…)` rules, with `/tasks` as proof;
     - `includeGitInstructions:false`;
     - PreModelSwitch hooks;
     - `claude ultrareview <PR> --json` and `/code-review --max-findings` as a second review gate, with a committed
       `REVIEW.md`;
     - self-hosted runners.
4. **Claude Mods** (the owner's explicit ask; a required minimum):
   - (a) the built-in "You should know" mod enabled in the orchestrator session for Phases 3–4;
   - (b) a committed `vextrus-factory` mod for the orchestrator only, validated with `claude plugin validate --json` and
     `claude plugin test`, and off for unattended and cloud builders. It shows a band with:
     - the clock against the budget;
     - the real-drawing lock queue;
     - disk and swap headroom;
     - builders' states;
     - open review rounds.

   If (b) crashes the session twice, record the evidence, ship the same data through the status line, and tell the owner.
5. **The quality gates G1–G5,** with a definition of done per PR and per milestone. It includes "no 'walk now' to the owner
   without a passing G1 report on that head", and how walk outputs stay out of git: the #211 literal scan committed first,
   as a pre-push hook and a CI step, and run over issue and PR bodies too.
6. **Session 13's plan and finish line, in the owner's words:**
   - the Q4/Q5 rulings, and the reading work that reaches the bar (S1 with Q13 answered, S2, S3; S4 only if Q8 is yes);
   - the carried PRs in landing order: #242 → #237 → t-readlock → t229 → t228 → t160 → loop-iou;
   - D7, D9, D10, #235, #236 and #245;
   - G1 passing twice on consecutive heads, then the owner's walk;
   - budgets for all of it.
7. **The owner questions** (the two lists above), each with its recommended default.
8. **Risks and cuts:** every cut item linked to an issue.

**Stop and ask the owner to approve** with one AskUserQuestion. It carries:
- the spec's path;
- the two answers in two lines each;
- a 10-line summary;
- the tier-1 list;
- the defaults you will take for every open question unless told otherwise.

If the owner asks for changes, revise once (≤ 30 min) and ask again. Record the owner's words verbatim in STATE.md. While
waiting, do only read-only preparation (draft the ticket files under `.private/work/session-12/tickets/`). Launch nothing
and merge nothing.

## Phase 3: build the factory (≤ 5.5 h; after approval)
- **First, the CI-speed ticket:** #237's timeout diagnosed, and the python job sped up. Every later merge waits on it.
- **Tickets** from the spec (`to-tickets`), grouped into at most ~6 PRs by disjoint file ownership, not one PR per component.
  Keep them off engine paths where possible, so no posting run is owed.
- **Acceptance tests first,** by `acceptance-writer`, for every ticket whose behaviour is testable (hooks, guard, scripts,
  workflows, measures). Commit and push them before the builder launches: cloud and `fresh`-based worktrees cannot see
  unpushed commits. A ticket marked untestable says why.
- **Dogfood:** launch builders through the new path.
  - Cloud: everything that does not touch `.private/`.
  - Local: only the real-drawing measures and the guard (high effort plus a refuter).
  - Save a `claude agents --json` snapshot and the launcher's log per launch under `.private/work/session-12/`.
- **Every PR:** the review workflow (two rounds), green CI, `merge_ready`. Batch every change to `tools/scorer/` or
  `scripts/real_drawings/` into **one** custody re-run, asked once.
- **The `lessons.md` update** (it stops at session 07) is a docs-only cloud ticket here. Each lesson that gains a check moves
  from prose to a pointer.

## Phase 4: prove it (≤ 1 h)
- **Tabulate the first cloud ticket launched in Phase 3** (it is the factory cycle): elapsed against budget, review rounds,
  findings, CI time. Prefer one that unblocks session 13 (#237's timeout or #245's flakes).
- **Run the G1 real-set walk gate once on main.** It will fail; its ranked list is session 13's input. It must show that it
  runs end to end and leaks nothing: run the scan over its outputs.
- **Every tier-1 check** red without its fix (the run's output path cited in its PR body). The guard's test passes from the
  main checkout. The audit outputs are saved.

## Phase 5: hand over to session 13 (≤ 45 min)
- Write and merge `docs/handoff/session-13-prompt.md`: M0 to walk-ready with the factory. It carries:
  - the carried PRs in order;
  - D7/D9/D10 and the rest;
  - the reading work;
  - G1 passing twice;
  - budgets;
  - every owner ruling, verbatim;
  - the exact commands.

  If Q4, Q5 or Q13 are still open, session 13's first act is to ask them.
- Tell the owner, in plain words:
  - what changed;
  - what to run before session 13;
  - what you still need from them;
  - the two answers.

## Finish line (session 12 is done when each holds, with a tool result)
1. The spec and its ADR are merged, and the owner approved them in their words (in STATE.md).
2. Every tier-1 component is merged on main, reviewed, with its check shown red without its fix. Every tier-2/3 item is
   merged, or linked to an open `factory` issue with a reason.
3. A cloud builder launched by the new path delivered a reviewed, merged PR. The local machine ran only real-drawing work and
   the orchestrator, shown by the per-launch `claude agents --json` snapshots. Or this line is recorded as unmet, naming the
   failure (Phase 1's fallback).
4. The `vextrus-factory` mod (or its status-line fallback) is running in the orchestrator session.
5. The G1 walk gate ran on main, produced a ranked list, and put no drawing text in git.
6. Session 13's brief is merged, `lessons.md` is current, and Q4/Q5/Q13 are answered or are session 13's first act.

## Skills, tools and agents
- **Plugins / built-in:**
  - `workflow-authoring`: every fan-out, and the committed workflows.
  - `plugin-authoring`: Claude Mods (bands, panes, toasts, function hooks). Read it before designing the mod.
  - `update-config`: settings, permissions, hooks, env.
  - `claude-md-management:claude-md-improver` and `claude-md-management:revise-claude-md`: CLAUDE.md to one page.
  - `claude-api`: model ids and prices for the spend questions.
  - `code-review` / `/code-review` and `claude ultrareview <PR> --json`: a second review gate.
  - `hookify`: only to *draft* a rule. Every adopted rule lands in `guard.mjs` or a committed hook, with a test.
  - `mcp-server-dev`: only if a project MCP server, such as the lock queue or the scorer's blind diagnostics, earns its place.
  - The `claude-code-guide` agent: docs questions.
- **The project's:**
  - `research`: cited files.
  - `grilling`: stress-test the spec. `grill-with-docs` and `to-spec` are owner-typed (`/grill-with-docs`, `/to-spec`); the
    model cannot invoke them.
  - `to-tickets`.
  - `writing-for-agents`: every agent, skill and CLAUDE.md edit.
  - `codebase-design`: factory module seams.
  - `domain-modeling`: ADRs.
  - `spec-review`: spec vs implementation.
  - `tdd`.
  - `diagnosing-bugs`: the CI timeout, the flakes.
  - `product-review` and `real-drawings`: the G1 gate.
  - `orchestrate-wave`: to be rewritten.
- **Agents:**
  - `refuter`: on every claim the spec rests on.
  - `pr-reviewer`: on every PR.
  - `acceptance-writer`: before each testable ticket.
  - `drawing-analyst`: for S1's inter-keyer work, if Q13 allows it in this session.
  - Sonnet 5.5 for look-ups, once routing is fixed.

## Operating lessons from session 11 (use them)
- **Waiting:** stamp times from `date -u`, never estimate. Wait with `notify_when_idle` or `run_in_background` plus Monitor
  until-loops. Never use a `pgrep -f` loop: it matches itself, which cost an hour in session 11.
- **Resuming builders:** `claude --bg --resume <short id>` opens a picker and blocks. Resume by the **full** session id.
- **The real-drawing lock:** one real-drawing run per engine head, on one lock (~29 min). Every engine merge stales the next
  PR's head. A posting run on an engine code hash already run is cached and quick.
- **The machine's limits:**
  - Eight local builders filled swap.
  - Parallel suites filled the disk: 38 GB of test leftovers in `/tmp`. #242 fixes one leak, #243 the other.
  - `git bundle` (posting runs) dies when the disk is full.
  - Check `df` and `free` before every launch.
- **Before pushing any engine branch,** run the literal scan (`.private/work/session-11/lits2.py`, with
  /opt/vextrus/python). Generic titles are fine; specific drawing text is not.
- **An orchestrator's acceptance amendment** is a one-path `acceptance:` commit (`git commit -- <path>`), checked with
  `python3 -m tools.lint.acceptance origin/main HEAD`.
- **CI flakes under load:**
  - t16's middle-drag pan;
  - tviewerplot's P cycle;
  - acts.test's "bulk act, half refused" toast in the slowed run.

  A rerun on main passed. They are #245, and they may block #237 and the carried web PRs until fixed.

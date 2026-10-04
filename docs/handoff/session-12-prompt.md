# Session 12: rebuild the harness into Vextrus's software factory (research → spec → owner approval → build → prove)

## Starting the session (the owner)
1. Before starting, in a WSL terminal: `cd ~/vextrus-cubit && git pull`. No custody re-run is owed (session 11's ran 16/16 on
   main 1d949436; nothing under `tools/scorer/`, `scripts/real_drawings/` or `scripts/owner/post-status` changed since).
   Check the disk: `df -h /` (session 11 filled it; keep ≥ 30 GB free).
2. `claude --model claude-opus-5-5`, then `/effort` → **xhigh** with **Ultracode** on, check `/status`, and say:
   "Read docs/handoff/session-12-prompt.md and run it."

---

You are the orchestrator of session 12. **This session builds the factory, not the product.** You change the harness
(Claude Code setup, agents, skills, hooks, workflows, settings, CI, scripts, the SDLC docs) so that session 13 can finish M0
to a walk-ready state fast and at quality. You touch product code only where a factory check needs a product hook (and then
through the normal review loop). The owner chose this session's mode (4 Oct 2026): "Opus 5.5 xhigh+dynamic workflow
"Ultracode" mode for maximum output" — it overrides CLAUDE.md's medium default for this session only; builders you launch
still take the effort their ticket needs.

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

And the two questions the owner asked at session 11's close, which this session's design must answer in the spec:
1. **Why were D1–D10 not found before the owner's walk, and what process prevents that class?**
2. **Why is the real-drawing reading score so low, and what gets it to 90 %+?**

## Read first (in this order; delegate the long ones to agents, keep your context for decisions)
1. This brief.
2. `.private/work/session-11/s12-research/critic.md` (the completeness critic: contradictions, owner questions, the 15
   ranked changes). **Its §0 rule binds you: take a settings key, flag or frontmatter field only from `cc-changelog.md`
   (quoted from the changelog), from a raw docs page you fetch, or from `claude --help`; `cc-docs.md` is orientation only.**
3. The eight research files beside it, by agent, as each phase needs them: `cc-changelog.md` (Claude Code 2.0 → 2.1.289,
   17 themes, its ranked top 10), `cc-docs.md` (orientation), `harness-inventory.md` (every component today, keep/change/
   replace), `lessons.md` (sessions 06–11, failure classes C1–C14, the D1–D10 trace), `cloud-capacity.md` (why cloud stopped,
   the hidden `--cloud --ref/--on-branch` flags, what runs where), `reading-quality.md` (why the score is low, strategies
   S1–S7), `quality-gates.md` (gates G1–G5 that make green mean "the walk passes"), `agentic-sdlc.md` (2025–26 practice,
   cited).
4. `.private/work/session-11/review-main/report.md` (D1–D11, what the walk on real sets found) and
   `.private/work/session-11/STATE.md` (the last 60 lines: the close).
5. `CLAUDE.md`, `docs/sdlc.md`, `.claude/` (settings, agents, skills, hooks), `docs/knowledge/lessons.md` — what you change.

## Where M0 stands at session 11's close (facts; numbers from tool results)
- **main** de5b2373 (+ #242 if it landed; check). Merged in session 11: #214 (job export keeps sheet paper), #216 (#206
  set-aside chip), #217 (#202 Ctrl Z / one post), #225 (#167 Step 1 words), #213 (scored loop 2), #226 (guard: the seed's
  synthetic DWGs by exact path), #244 (#231 Plot/Compare/CAD-dark in Step 1), #238 (#230 Step 1 live refresh + Coverage
  names), #242 (test storage removed at exit; landing at close).
- **Score** (blind scorer, main 1d949436 → loop 2 merged): Edison sheets 45/217, views 429/739; Sample 8/67, 215/417. Loop 3
  (branch `loop-iou`, ae25e64e, unmerged): views 439 / 238, sheets unchanged. The ruled bar: Edison ≥ 174/217 sheets,
  ≥ 592/739 views; Sample ≥ 54/67, ≥ 334/417 (80 %). The owner now asks about 90 %+ (critic X8: not yet a ruling).
- **Carried, built and reviewed but not merged** (exact heads in STATE.md's CLOSE section):
  | PR / branch | What | State |
  |---|---|---|
  | #237 `t182` | demo seed = the real read job's recorded output (absorbs #150, #204) | review PASS, posted clean; **CI python times out at 35 min twice** (main takes 23–27): diagnose the replay's cost first |
  | `t-readlock` (#227) | Step 1 acts never wait on a read job (D1) | review FIX 2×50 (a let-go row lock through propose; a StepProgress lost update); fix round 1 at close |
  | `t229` (#229) | a matched Plot page is a second source; gaps hold only their neighbours (D3; owner ruling) | review FIX 70 (title words anywhere on the page) + 50 (keep-open lost); fix round 1 at close; no real-drawing run yet |
  | `t228` (#228) | Jev's top kind proposed; a Question only when close/contradicted; Slab details (D2; owner ruling) | review FIX 75 (pre-pick not shown → ruling: keep and show it, amend §5) + 50; fix round 1 at close |
  | `t160` (#160) | one paper scale: outlines on their paper (D4) | merged with main, sheets off paper 117 → 5; **render_f1 46 lost / 84 changed** (structural A0 guess without Plot paper): **the owner's trade question**, unscored |
  | `loop-iou` | scored loop 3: tighter view boxes | +10 / +23 views; later heads unscored; PR body written; not reviewed |
- **Not started:** D7 (#232 continuation runs as "copies"), D9 (#233 storeys), D10 (#234 presentation plans), #235 (D11
  smaller items), #236 (seed Plot PDFs are stubs), #239 (Zoom to view / Outlines), #240 (Plot CropBox), #241 (one-commit
  empty state), #243 (pytest basetemp retention), #245 (CI flakes: viewer drag, P cycle, the bulk-half-refused toast under the
  slowed run), #211 (guard: real-drawing literal scan), plus the design-gate mays #218–#224.
- **52 open issues** at close (31 labelled M0, 9 needs-triage, 11 before-beta).

## The answers you build on (the research's, cited there; verify before you rely on them)
**Why D1–D10 escaped (lessons.md §4, quality-gates.md §1).** Every gate between merges measured something other than a QS
doing the job on a real set: acceptance tests ran on fakes (the web fixture even used number keys the API never sends: D8);
design gates walked the synthetic demo seed, where no file is ever reading (D1, D5); the real-drawing check and scorer measure
exports (sheets, views, render F1), not Questions, bulk-confirmability or waits (D2, D3); a session-07 agent walk on the real
sets found the precursors, but only its BLOCKS/WRONG items became tickets (F6 → D2 was dropped as FRICTION); a ticket's
"cut for budget" spec items closed with no follow-up issue (D6); fixes were never re-walked together on real sets; and the
owner was told "walk now" twice without an agent rehearsing the walk. **The fix is a gate, not more care:** a real-set
walk gate (G1) that must pass before the owner is asked to walk; QS-burden measures (Questions per Discipline, bulk-
confirmable share, acts-during-read latency) in the real-drawing check (G5); fixtures recorded from the real API or closed
schema types (G2a); no silent cuts; every walk finding becomes an issue.

**Why the score is low (reading-quality.md §1–3).** Views are 57–59 % joined; sheet-level fields other than storeys are
93–100 % right. A sheet passes only if *every* view joins with title and subject right, so the metric compounds: 80 % of
sheets needs ≈ 94–97 % per view, 90 % needs ≈ 97–98 %. Rule-based view finding (`engine/recognise/views.py`, 2,278 lines,
~60 thresholds) has plateaued: each rule shifts boxes elsewhere, the two sets' conventions pull opposite ways, refuters find
counterexamples, and each loop gets 2–4 scored heads through one 29-minute lock. Part of the residue may be key-side (box
conventions, turned title blocks, the slab-detail kind). **The path:** S1 key audit + blind scorer diagnostics + inter-keyer
agreement (the true ceiling, with the owner); S2 a fast local proxy loop so only gaining heads get posted; S3 the Plot PDF as a
second source; S4 a hybrid vision proposer (Claude vision on rendered sheets, snapped to vectors) for kinds and missing views
— the only strategy the research expects to reach the sheet bar; S6 a held-out set before any claim.

## Laws that do not change (CLAUDE.md, ADR 0041; the guard enforces most)
Real drawings and anything derived stay under `.private/` and local; the repo is public (no drawing text in commits, issues,
PRs, workflow files or agent memory); never print secrets; no recursive delete (ask the owner for `! rm -rf …`); no history
rewrites, no ruleset/branch-protection changes, no admin merges; gates posted only through `post-status` from the main
checkout; the owner decides product, scope, spend and anything irreversible — **one question at a time, your recommendation
first with its reason in a line**. Changing the guard is a hostile-boundary ticket (high effort + refuter). A harness change
should remove as much as it adds where it can (`docs/sdlc.md`); the critic's Q1 asks the owner to lift its "no orchestrator
code" half.

## Phase 0 — Orient and set the clock (first 20 min)
- Write `.private/work/session-12/STATE.md` first, stamping every line from `date -u` (session 11 stamped from memory and
  drifted twice). Ask the owner, one at a time: **the session's time budget and cut line** (recommend: one long working day,
  ~10 h; Phase 1 ≤ 2.5 h, Phase 2 ≤ 1.5 h, Phase 3 ≤ 5 h, Phases 4–5 ≤ 1 h), then the critic's **Q1** (lift the "no
  orchestrator code" rule: recommend yes — factory code committed, tested and reviewed like product code).
- Check the machine: `df -h /`, `free -g`, `git worktree list | wc -l` (123 at close, 26 GB under `.claude/worktrees`), stale
  `claude agents`. Propose the owner's one cleanup command if needed (critic Q11).

## Phase 1 — Deepen and verify the research (Ultracode workflows; ≤ 2.5 h)
The research is broad but has gaps (critic §0, §2, §3). Close them with tool results, not more opinion:
- **Prove the Claude Code surface you will configure**: `claude --help` and `claude <sub> --help` for every command and flag
  the spec will use; fetch the raw docs pages the critic lists as not fetched (permissions, settings, sandboxing, hooks
  reference with per-event I/O, monitoring/usage/costs, data usage, plugins and **Claude Mods / plugin-authoring** — load the
  `plugin-authoring` skill and read it end to end, checkpointing, cloud environments, routines); settle contradictions X1–X16
  in `critic.md` §1 each with one tool result; record each in `.private/work/session-12/research/verified.md`.
- **Prove cloud launches** (owner said yes to cloud): one test launch through `scripts.cloud.launch` on a throwaway branch with
  `--on-branch`/`--ref` (critic Q10: confirm spend once with the owner), proving clone-from-GitHub, branch push, setup.sh
  toolchain, the test suite running, and how the orchestrator watches it. Record the measured setup time and limits.
- **Measure what nobody measured**: `/usage` and `/cost` now; the CI python job's duration breakdown (`--durations`), whether
  the suite is xdist-safe; the local machine's real ceiling (how many builders before swap); the real-drawing lock's run
  time per head and what a proxy loop could skip.
- **Mine the history for the ratchet's debts** (critic §4): every lesson without a committed check.
- A workflow per strand (research is a fan-out; use adversarial verification on any claim the spec will rest on).

## Phase 2 — The spec (ultrathink; ≤ 1.5 h; then the owner's approval)
Write `docs/specs/factory.md` (or `docs/adr/00NN-software-factory.md` + a spec; your call, say why). Use a judge panel: three
independent designs (quality-first, speed-first, risk-first), scored by parallel judges against the evidence, synthesised
from the winner with the best of the rest. The spec must contain:
1. **The answers to the owner's two questions**, with the evidence and the gates/strategies that follow.
2. **The factory's shape**: who runs where (cloud: builders, acceptance writers, reviewers, refuters for committed-test work;
   local: only real-drawing work — posting runs, scored loops, the real-set walk, drawing-analyst — plus the orchestrator);
   the launch → watch → review → gate → merge pipeline as committed code and workflows (not hand-run scripts in `.private/`);
   capacity (cloud ~8–10 builders + 2–3 local, per `cloud-capacity.md`, to be confirmed by Phase 1); the resource governor.
3. **Every component, before → after**: CLAUDE.md (toward one page, laws + map), `docs/sdlc.md`, agents (a committed
   `builder` agent replacing `.private/.../common.md`; model and effort pinned per agent; `maxTurns`, `isolation`, `skills`
   preload, memory only where the public repo is safe), skills (a `verify` skill run before every commit; `orchestrate-wave`
   rewritten around the workflows; stale `real-drawings`/`product-review` fixed; `/doctor prompt-audit` and `/skill-doctor`
   run), hooks (time/budget stamps, Notification for needs-input, Stop/SubagentStop completion gates, PreCompact state dump,
   WorktreeCreate per-worktree DB; the guard repaired: `~/.pgpass`, `+ref` pushes, `reset --hard`, `find -delete`, rmtree,
   cwd-independent test), permissions (`deny` for builder pushes and secret reads; sandbox where it closes guard gaps),
   workflows committed under `.claude/workflows/` (review loop with the two-round cap enforced, scored loop, research fan-out,
   real-set walk), Claude Mods (a status band/pane for clock vs budget, the lock queue, machine headroom, builders' states —
   only if Phase 1 proves them stable; the changelog calls them young), CI (python job split or xdist; flakes fixed; e2e on
   PRs), the real-drawing check (QS-burden measures G5; scorer diagnostics S1; proxy loop S2; one batched custody re-run).
4. **The quality gates G1–G5** with their definition of done per PR and per milestone, including "no 'walk now' to the owner
   without a passing G1 report on that head", and how walk outputs stay out of git (the #211 scan committed first).
5. **The reading-quality programme** for session 13+: S1 (with the owner's key conventions), S2, S3 and the S4 prototype
   (data and spend questions to the owner), each with its measure.
6. **Session 13's plan**: the carried PRs in landing order (above), D7/D9/D10/#235/#236/#245, the G1 walk until it passes
   twice on consecutive heads, then the owner's walk; with time budgets.
7. **Owner questions**, one at a time, recommendation first (critic §5: Q2 budget, Q4 the bar and burden targets, Q5 burden
   numbers, Q6 custody cadence, Q7 drawing data through Claude Code, Q8 the vision prototype, Q9 user-level settings —
   subagent default Sonnet, Opus pinned in gating agents, Q10 cloud spend, Q11 machine limits, Q12 App-pinned statuses, Q13
   key conventions, and #160's render_f1 trade).
8. **Risks and what is cut**, each cut item linked to an issue.

**Stop and ask the owner to approve the spec** (ExitPlanMode or one AskUserQuestion with the spec's path and a 10-line
summary). Do not start Phase 3 without the owner's words, recorded verbatim in STATE.md.

## Phase 3 — Build the factory (≤ 5 h; after approval)
- Turn the spec into tickets (`to-tickets` skill) with disjoint file ownership; acceptance tests first where behaviour is
  testable (hooks, guard, scripts, workflows, measures). **Dogfood**: launch the builders through the new path — cloud for
  everything that does not touch `.private/`; local only for real-drawing measures and the guard (high effort + refuter).
- Every PR through the review loop (two rounds), green CI, `merge_ready`; harness PRs touching engine paths take a posting run;
  batch every change to `tools/scorer/` or `scripts/real_drawings/` into **one** custody re-run, asked once.
- Keep CLAUDE.md's ratchet: each lesson that gains a check is moved from prose to a pointer.

## Phase 4 — Prove it (≤ 45 min)
- One full factory cycle on a small real ticket from the M0 backlog (e.g. #245's flakes or #243), end to end through cloud
  builder → review workflow → gates → merge, measured (elapsed, rounds, findings).
- The G1 real-set walk gate run once on main (it will fail: that list is session 13's input), proving it runs and leaks
  nothing.
- `/doctor prompt-audit`, `/skill-doctor`, the guard's test, every new check red without its fix.

## Phase 5 — Hand over to session 13 (≤ 20 min)
- Write `docs/handoff/session-13-prompt.md`: run M0 to walk-ready with the factory (the carried PRs, D7/D9/D10 and the rest,
  G1 passing twice), budgets, the owner's rulings verbatim, the exact commands. Update `docs/knowledge/lessons.md` (it stops
  at session 07). Tell the owner what changed, what to run, and what you need from them before session 13.

## Finish line (session 12 is done when, each with a tool result)
1. The spec is committed and the owner approved it in their words.
2. The factory's components in the approved spec are merged on main, each reviewed, each with its check red-without-fix.
3. A cloud builder launched by the new path delivered a reviewed, merged PR; the local machine ran only real-drawing work.
4. The G1 walk gate ran on main and produced a ranked list with no drawing text in git.
5. Session 13's brief is merged, and lessons.md is current.

## Skills and tools to use this session
- **Built in / plugins:** `workflow-authoring` (every fan-out; committed workflows), `plugin-authoring` (Claude Mods: status
  bands, panes, toasts, function hooks — read before designing the dashboard), `update-config` (settings, permissions, hooks,
  env), `claude-md-management:claude-md-improver` and `revise-claude-md` (CLAUDE.md to one page), `hookify` (behaviours from
  this session's transcript), `claude-api` (model ids, pricing for the spend questions), `code-review` / `/code-review` and
  `claude ultrareview <PR> --json` (a second review gate), `/doctor prompt-audit`, `/skill-doctor`, the `claude-code-guide`
  agent (docs questions), `mcp-server-dev` only if a project MCP (e.g. a scorer or lock-queue server) earns its place.
- **The project's:** `research` (cited files), `grilling` / `grill-with-docs` (stress-test the spec with the owner), `to-spec`,
  `to-tickets`, `writing-for-agents` (every agent, skill and CLAUDE.md edit), `codebase-design` (where a factory module's
  seam goes), `spec-review` (spec vs implementation), `tdd`, `diagnosing-bugs` (the CI timeout, the flakes), `product-review`
  and `real-drawings` (the G1 gate), `orchestrate-wave` (to be rewritten), `domain-modeling` (ADRs).
- **Agents:** `refuter` on every claim the spec rests on; `pr-reviewer` on every PR; `Explore`/Sonnet 5.5 for look-ups once
  routing is fixed.

## Operating lessons from session 11 (use them)
- Stamp times from `date -u`; never estimate. Wait with `notify_when_idle`, `run_in_background` + Monitor until-loops, never a
  `pgrep -f` loop (it matches itself: a lost hour in session 11).
- `claude --bg --resume <short id>` opens a picker and blocks: resume by **full session id**.
- One real-drawing run per head on one lock (~29 min): every engine merge stales the next PR's head; the posting run on the
  same engine code hash is cached and quick.
- Eight local builders filled swap; parallel test suites filled the disk (`/tmp`: 38 GB of test leftovers; #242 fixes one leak,
  #243 the other). Watch `df`/`free` before every launch.
- The literal scan (`.private/work/session-11/lits2.py`) before pushing any engine branch; generic titles are fine, specific
  drawing text is not.
- An acceptance amendment the orchestrator makes is a one-path `acceptance:` commit (`git commit -- <path>`), checked by
  `tools.lint.acceptance`.

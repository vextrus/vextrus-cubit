# Session 31: the prototype made right, in the Vextrus Studio

**The owner, 15 Oct 2026:**
- "our next biggest goal should be critically reviewing the protype locally and then with multi-agentic
  orchestration leveraging all the learnings from the 'Claude Managed Agents' session ... fixing,
  upgrading and making the prototype perfectly"
- "100% focus on local Claude Code raw ... not following the path of our factory setup"
- "without making it perfect as I intended it to be, Outcome 3 spec generation is pointless"

**Where:** `~/vextrus-studio`, made by `studio/bootstrap.sh`. It is a private, local-only git repo with
its own small `CLAUDE.md`, agents and workflows (`studio/README.md`). Not in `~/vextrus-cubit`: the
factory's hooks, gates and launch scripts are not used in this session and are not changed by it.

**Lead:** the main session, Opus 5.5 `high`. Advisor `/advisor opus` when stuck. `/advisor fable` is for
the hardest calls only; it bills usage credits.

**Budget:** the owner sets the hours at the start; the recommendation is 8 h. The Max plan's limits are
the other budget: read `/usage` at each phase's end, and write `elapsed / budget` in every brief to an
agent.

**Read first:** `CHECKPOINT.md`, `OWNER-REVIEW.md`, `cma/CHECKPOINT.md` (what the Managed Agents session
did and deferred), and, in the product repo, `docs/research/2026-10-15-cma-session-lessons.md` and
`docs/research/2026-10-15-local-harness.md`.

## Start
```sh
cd ~/vextrus-cubit && git fetch origin && git checkout claude/vextrus-m1-prototype-spec-ew6hgy  # or its worktree
studio/bootstrap.sh            # once; picks the newest .private/work/cma/outputs/sesn_*/tree
cd ~/vextrus-studio && claude
```
First message to paste:

> Read CLAUDE.md, CHECKPOINT.md and ~/vextrus-cubit/docs/handoff/session-31-prompt.md, and run session 31.
> My budget today is <N> hours.

## Phase 0: ready to work (at most 45 min)
1. **Read the owner's four posts** on this machine (they did not resolve from the cloud):
   - claude.dev/blog/building-effective-agent-automations
   - claude.dev/blog/claude-code-in-the-cloud
   - claude.dev/blog/getting-started-with-claude-code-mods
   - claude.dev/blog/spending-your-effort

   Write what they change about this harness into `CHECKPOINT.md`, and make the change if it is small.
2. **Prove the baseline runs:**
   - Serve `proto/` on 127.0.0.1 and open it in the browser with no console errors.
   - Run `generator/` on `data/` and get the same model hash as the session's README (it recorded
     `33e397d6…`). If its paths point at the cloud sandbox (`/mnt/session/...`, `/workspace/...`), make them
     relative, and record that.
   - Run the generator's tests.
3. **The owner's review, at most 15 min:** the owner lists what they saw in `OWNER-REVIEW.md` (misplaced
   and detached Elements, poor parts), with screenshots under `shots/owner/`. Ask, one question at a
   time, only what you need to place each issue. These are severity 1 unless the owner says otherwise.
4. **Two rulings to ask for**, each with your recommendation first:
   - **The 18 figures** that open sheets or Questions rather than an Element. Recommended: keep them, since
     linking them to Elements would invent a Trace.
   - **A private GitHub repo as the studio's off-machine backup.** Recommended: yes, private, with no
     collaborators; the owner decides, since it puts Edison-derived data off this machine.

## Phase 1: the critical review
Run `/proto-audit` with `{"out": "outcomes/01-audit"}`. It runs every lens:
- code checks of geometry and relations;
- fidelity per Discipline, storey by storey against the drawings;
- the QS critic;
- UX;
- performance.

Then it tries to refute each defect and ranks the survivors, with the owner's issues first. Write
`outcomes/01-audit/DEFECTS.json` and a one-page `SUMMARY.md`: counts per lens and severity, the ten worst,
and what no lens covered. Read 5 defects yourself in the browser before trusting the list, and tune
the lens prompts if they are noisy.

Start with a small slice if the plan's usage is a concern: run the geometry lens and one fidelity lens
first.

## Phase 2: checks before fixes
The Managed Agents rubric judged files, not the building, which is why detached Elements passed. Before
any fix, outcome `02-checks` (builder: `model-auditor`'s checks, `builder` for the harness around them)
must land `checks/` that fail on today's model for every geometry class the audit found. The classes
are supports, stacking, hosts, levels and units, relations, clashes and totals. It also needs a
plan-view render per storey and Discipline that the visual judge compares with the drawing's sheet. The
grader judges "each check fails on the baseline, for the reason the audit gives".

## Phase 3: fix by cause, one outcome per cluster
Use the `outcome` skill: cluster the defects by cause, write each cluster's `RUBRIC.md` from
`outcomes/RUBRIC-TEMPLATE.md`, and run `/outcome`. Order:
1. **The structural frame:** piles and caps, columns stacked and standing, beams bearing, slabs bounded.
   Everything else hangs on it.
2. **The architecture on the frame:** walls on slabs and grids, openings in walls, rooms closed.
3. **MEP on its hosts:** fixtures in rooms, risers through slabs, points on walls.
4. **The figures:** the Priced BOQ and Material Schedule from the corrected model, with the QS critic's
   sign-off.
5. **The screens and the budgets.**

Fix causes in the generator or the reading rule, never by moving coordinates by hand. Outcomes that
touch different files may run at the same time. Every defect fixed gets a check, and the full
`checks/` suite runs at the end of every outcome. Re-run `/proto-audit` after every 2-3 outcomes, to
measure what is left and catch what fixes broke.

## Phase 4: upgrade, then the owner's walk
When the audit returns no severity 1-2 defect:
- Take the owner's upgrade list (ask for it; the CMA session's deferred items are in `cma/CHECKPOINT.md`)
  as further outcomes.
- Then ask the owner to walk the prototype. **The owner's walk is the finish line, not the grader.**

## Finish line for the prototype (it may take more than one session)
- [ ] Every check in `checks/` passes.
- [ ] The latest audit has no severity 1-2 defect, and every owner issue is fixed or ruled out by the owner.
- [ ] Fidelity: for every storey and Discipline, the grader passes the plan-view comparison against the
      drawing.
- [ ] The QS critic would sign the Priced BOQ and the Material Schedule.
- [ ] The budgets in `docs/research/viewer-3d-budgets.md` are met, or the misses are measured and accepted
      by the owner.
- [ ] The owner has walked it and said it is right.

## What to measure (this session judges the studio as well as the prototype)
For each outcome, record in `CHECKPOINT.md`:
- the rounds to pass;
- the agents used;
- the wall clock;
- `/usage` before and after;
- the defects fixed;
- the defects a later audit found the fix had broken.

Compare with the factory's record: 24% of PRs passed their first review round, and 77% of later-round
findings came from the fixes before them (`docs/research/2026-10-13-why-m0-dragged.md`).

## Don't
- **Don't use the factory here:** no PRs, `scripts.factory.*`, G1 walks, ledgers or review rounds. Git
  commits in the studio are the record.
- **Don't write to `~/vextrus-cubit`.** Moving work into it is a later session's job, by hand, with no
  drawing content.
- **Don't loosen a rubric to make it pass,** and don't let the grader read the builder's notes.
- **Don't run Outcome 3 (the spec) yet.** It waits for the owner's walk of the prototype.

## After the prototype (sessions 32+, the owner decides when)
- Move the studio's way of working into the product repository: a short `CLAUDE.md`, the studio's agents,
  and its two workflows. Retiring the factory's ceremony is the owner's call (Q14).
- Port the prototype's viewer and generator into `web/` and `engine/`, as code with synthetic fixtures.
- Then write the spec (Outcome 3, `docs/runbooks/cma-prototype-session/outcomes/3-spec.rubric.md`) from the
  finished prototype, and amend `docs/specs/M1.md` and `docs/milestones.md`.

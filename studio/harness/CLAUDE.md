# Vextrus Studio

Vextrus is an AI-native platform for the AEC business, starting with Bangladeshi real-estate Developers.
A QS turns a Developer's 2D AutoCAD drawings (structural, architectural, MEP) into the **Live Model**:
one confirmed 3D dataset of every Building's Elements. The Priced BOQ, the Material Schedule and every
later module are readings of it. The owner is a civil engineer, and the CEO and co-founder.

This workspace exists to make the **prototype** production-quality: a 3D BIM Live Model read from the
real Edison drawings, with the Takeoff, Priced BOQ and Material Schedule built on it. Once the owner's
walk passes, the prototype and this way of working move into the product repository.

**Start here:** `CHECKPOINT.md` (state, decisions, next step), then the newest `outcomes/*/RUBRIC.md`.

## Where things are
- `proto/`: the prototype (static web app, three.js 0.184), as the Managed Agents session built it.
- `generator/`: the code that builds the prototype's model data from `data/`, with its synthetic fixture
  and tests. Never hand-edit generated model data: fix the generator and regenerate.
- `data/`: the Edison dissection (inventory with Traces, storeys, grid, relations, quantities).
- `drawings/`: the Edison originals, read-only (a link into the product repo's `.private/`).
- `cma/`: the Managed Agents session's output as delivered, read-only. It is the baseline we compare against.
- `checks/`: code that judges the model: geometry invariants, renders, budgets. A defect fixed gets a check here.
- `outcomes/<NN-name>/`: one unit of work each: `RUBRIC.md` (what done means), `DEFECTS.json` (its items,
  status only changes), `grades/` (each grading round's verdict).
- `~/vextrus-cubit`: the product repository, **read-only from here** (read it by absolute path). Its
  `CONTEXT.md` (the domain's words), `docs/adr/`, `docs/intent.md`, `docs/specs/` and `docs/design/` are
  the plan; `engine/` holds M0's drawing readers. A path such as `docs/...` or `CONTEXT.md` in an agent
  file means that repository's copy.

## How we work (the owner, 15 Oct 2026: "100% focus on local Claude Code raw ... not following the path of our factory setup")
- **The main session is the lead.** It plans, delegates, merges results and keeps `CHECKPOINT.md`
  current at every milestone. It does synthesis and decisions itself; reading, building, judging and
  checking go to agents (`.claude/agents/`).
- **Work comes as outcomes.** An outcome is a rubric of explicit criteria, each one checkable. The builder
  sees the rubric before it starts. The **grader** (a fresh context, read-only) judges the live files
  against it, and the work is revised until it passes or the round limit is reached (`/outcome`).
- **Code is the first judge.** Anything code can measure (positions, supports, hosts, sums, counts, frame
  time) is a check in `checks/`, run before any model looks. Models judge what code can't: does this
  storey look like its drawing, and would a QS sign this figure?
- **Look at the product.** Every change to the 3D view is checked in the browser by an agent that takes
  screenshots, crops and zooms, and compares against the drawing's own sheet render.
- **Evidence, not claims.** Only a tool result is evidence. Every Element keeps its Trace and its state:
  `read`, `inferred` (with its rule) or `placeholder`. Never present invented geometry as read.
- **Models and effort** (the owner, 15 Oct 2026: agents and workflows "with Claude's next level Opus 5.5,
  Sonnet 5.5 and Haiku 5.5 models and if needed as /advisor using Fable 5.1"):
  - **Lead:** Opus 5.5 `high`.
  - **Opus 5.5 `high`:** the grader, the model auditor, the visual judge, the QS critic and builders on
    geometry or three.js.
  - **Sonnet 5.5:** builders on UI and ordinary work (`medium`), and the adversary (`high`).
  - **Haiku 5.5 `medium`:** the scout, for look-ups and mechanical steps.
  - **`xhigh`:** only where a run measured a gain.
  - **Advisor:** `/advisor opus` when stuck; `/advisor fable` for the hardest calls (it bills usage credits).
- **Budget.** The Max subscription's limits are the budget. State `elapsed / budget` in every brief to an
  agent. Fan out when the work splits; don't when it doesn't. Read `/usage` at each milestone.
- **The owner decides product and scope; everything else runs without waiting.** Ask one question at a
  time, recommendation first, reason in a line. Plain words. Lead every report with what is broken or
  unmeasured.

## Law (unchanged from the product repository)
- **The Edison set and everything derived from it stay private.** This workspace is a local git repo that
  is never pushed to `vextrus/vextrus-cubit`, which is public. Nothing from here enters that repo, an
  issue, a PR or a commit message, except conventions stated generically and code with synthetic fixtures.
- **Held-out Sets, clients' sets and the Hand Takeoff never come here.**
- **OpenConstructionERP is AGPL-3.0:** learn from it, never copy its code, schemas, strings or data.
  cad2data's and ODA's converters are never run.
- **Secrets** are never printed, written or committed.
- **Time comes from `date -u`.**
- **No recursive deletes:** delete files by name.
- Use CONTEXT.md's words exactly; propose new terms in `outcomes/*/glossary-delta.md`.

## Compact instructions
Keep: the current outcome and each criterion's state, the owner's rulings in their words, open
questions, decisions, defects open and fixed, the exact next step. No narrative.

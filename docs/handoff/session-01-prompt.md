# Session 01: finalise the plan, cross-verified, before any code

The first session after the reset. Session 10 of the old numbering (25 Sep 2026) laid the foundation:
25 ADRs, the glossary, 14 research files, the intent, the architecture, the milestones and the SDLC.
This session **grills that plan again, in depth, against new evidence**, until the owner judges it
solid enough to build a complex MVP on without ever abandoning it. Then it writes M0's spec, plan and
tickets so execution can start.

Read first, in order: `CLAUDE.md`, `docs/intent.md`, `CONTEXT.md`, `docs/adr/` (0001–0025),
`docs/architecture.md`, `docs/milestones.md`, `docs/sdlc.md`. Read `docs/research/` only where a
question needs it; each file opens with its conclusions.

## New evidence this session brings
1. **An adversarial review of the plan from the owner's other project.** In it, Opus 5.5 drives AutoCAD
   and Revit 2027 through MCP tools. It extracted the Edison DWGs into a structured dataset and
   reproduced every sheet exactly. It merged the structural and architectural datasets into an IFC
   ("okay"), and then produced high-quality Revit models from the dataset. Its feedback on our plan is
   at `.private/reference/plan-review/` (the owner places it there). Treat it as evidence, and weigh it:
   - Its extraction was exact because it ran inside AutoCAD, which a hosted product cannot do under
     Autodesk's desktop licences.
   - Its lessons about the dataset, merging disciplines and building the model carry over, whatever
     reads the DWG.
2. **The Sample Project DWGs** at `.private/reference/sample-project/`, drafted by the team in AutoCAD
   as a Dhaka consultant would (ADR 0004).
3. **Edison vector PDFs**, if exported, beside the Edison DWGs (ADR 0014).

## The finish line (each item agreed by the owner and written in the repo)
1. **The review is grilled.** For each point in the plan-review feedback, record whether it confirms,
   challenges or adds to an ADR, then grill the owner on each challenge with `/grill-with-docs`, one
   question at a time. Amend or supersede ADRs as decided.
2. **The DWG reader is decided with evidence.** Compare LibreDWG 0.14 (the prototype's path:
   `docs/research/2d-to-bim-prototype-lessons.md`) with Autodesk Platform Services Design Automation
   for AutoCAD (licensed cloud automation of real AutoCAD) and the ODA SDK: accuracy on real sets,
   licence, cost per drawing, latency from Dhaka, lock-in. Prototype on the Sample Project and Edison.
3. **The takeoff pipeline is proven on the Sample Project,** not only Edison: sheet segmentation first
   (M0's finish line), then grid, columns, beams and slabs, with counts. Run a vector-PDF read if a PDF
   set exists.
4. **The business logic is cross-verified with the owner, as a QS would check it:**
   - the default Rule Set's first rules (PWD practice);
   - the shape of a Rate Analysis and the starting library's first items;
   - the default Rod Ratios;
   - the Priced BOQ's item structure and sections;
   - the Material Schedule's breakdown.

   Record terms in `CONTEXT.md`, not code.
5. **The data model is drafted** from `docs/research/stack-data.md` §sketch, in `CONTEXT.md` terms, and
   checked against the Takeoff flow (ADR 0007) and Revisions (ADR 0015).
6. **M0 is ready to build:** `docs/specs/M0.md` (owner signs off), `docs/plans/M0.md` (plan mode), and
   tickets in GitHub Issues labelled `cloud` or `local`. The cloud environment is set up and tested
   (setup script, Python 3.13 via uv, Postgres, the TypeSafe cloud key, whose field the owner is shown
   when setting it). CI builds LibreDWG once.
7. **The owner's in-depth review** of the old Cubit demo and of OpenConstructionERP, if they still want
   to bring it, is grilled too. Session 10 never received it.

## Owner actions pending
- **Claim the $250 cloud credit by 7 Oct 2026** (`/claim-credit` or claude.ai/code/claim-credit).
  Reports say it expires in early November, so execution should start by mid-October. That comes from
  secondary sources; check it on the claim page.
- Create the separate TypeSafe key for cloud sessions (ADR 0013).
- A Bangladeshi lawyer's check of data handling before the beta (ADR 0023).
- The Hand Takeoffs of a typical floor of the Sample Project and the Edison set (ADR 0005).
- `~/.claude/settings.json`:
  - `modelSettings` pins Opus 5.5 to `high` effort, so sessions start high despite the project's
    `medium`;
  - `skillOverrides` turns off `code-review`, which may hide the built-in `/code-review`.

  Both are the owner's to change.

## How to run it
- `/grill-with-docs`, one question at a time, recommendation first. Suggest `/effort high` for the
  reader decision and anything architectural, then drop back to `medium`.
- Research and prototypes run as background agents, one question each, returning cited files.
  Prototypes on real drawings write only to `.private/work/`.
- Commit documents as they settle, with explicit paths. Push only with the owner's yes.

## Starting state
- **Branch:** `foundation`, reset on 25 Sep 2026. The old product is on `dev-lane-and-jev`, and
  `main` is older still.
- **Machine:**
  - Postgres 16 on 5544 holds no Cubit databases. Four older ones remain: `vextrus`, `vextrus_dev`,
    `vextrus_e2e_scratch` and `fixprobe`.
  - LibreDWG 0.14, built by the session 10 prototype, is at `.private/work/proto-2d-bim/tools/`.
  - OpenConstructionERP runs at :8080. Its converter download was deleted; never upload files to it.

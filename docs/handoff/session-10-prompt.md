# Session 10 — brief: the reset, the grill, the foundation

## Where we are

- **Cubit is being reset to zero.** Five weeks of work are behind this repository, and it came after a
  year of vextrus-erp and several earlier attempts. It produces a partial, unpriced takeoff of one
  drawing set we authored ourselves. The owner has decided to start again from zero.
- **This is not a bug-fix decision.** The core approach will not carry the product to production
  quality. The reasons are written in `docs/handoff/session-9-critical-review.md`; read it first.
- **Nothing in the old code is kept by default.** Its knowledge and lessons are carried; its code is not.
- **Do not argue for keeping the old codebase or "fixing the blockers to reach M4".** The owner has
  weighed that option and rejected it. Your job is to make the next plan strong enough that it is never
  abandoned.

## This session

This session works on a **new branch cut from the pushed `dev-lane-and-jev`** (session 9 pushes it at
close). It builds no product code. It is a long session with the owner, the CEO and co-founder:
grilling, researching and going through everything. It ends with **the first conclusion of our next
course of action**. That conclusion is the foundation the final plan stands on, even if it is not
the whole plan.

## The finish line

1. **The owner's thinking is grilled whole.** Grill with `/grill-with-docs`, one question at a time,
   recommendation first. The inputs:
   - their in-depth review of the Cubit demo;
   - their review of OpenConstructionERP;
   - their broader ideas for the product and the industry;
   - their business thinking.

   Terms settle into `CONTEXT.md` and decisions into ADRs in `docs/adr/` as they land.
2. **OpenConstructionERP is understood and critically judged.** Its three sources:
   - the running product at http://127.0.0.1:8080 (left running; "Try demo" signs in; `~/reference/oce.sh`
     starts and stops it);
   - its documentation at https://openconstructionerp.com/docs;
   - its code at `~/reference/openconstructionerp/` (start with its `DEVELOPING.md` and `MODULES.md`).

   The judgement covers what it solves and how: its domain model, algorithms, business logic, CAD/BIM
   takeoff, BOQ, cost database, AI. It also covers where it falls short: flows, UI/UX, AI autonomy,
   local standards. cad2data (`~/reference/cad2data-Revit-IFC-DWG-DGN/`) is read the same way, through
   its MIT docs and pipelines only.
3. **What we will build is stated.** The product we will build at any cost:
   - its users;
   - the job it does end to end;
   - how it beats OpenConstructionERP on quality, creativity, frontend design and autonomous AI;
   - the owner's broader, industry-changing ideas, placed where they belong in the sequence.
4. **The business plan's foundation is stated.** Who pays, for what, how we reach them, and how our
   model differs from OpenConstructionERP's open-source strategy (and how that strategy actually makes
   money).
5. **The foundation for building is stated.** It covers:
   - the stack;
   - how we will build: a process proportionate to our stage, and how Claude Code sessions, agents
     and the harness are used;
   - real drawings from day one;
   - the money in the loop early;
   - what we carry from Cubit, as knowledge and lessons only (the review's list);
   - what the first milestones are, each with a finish line the owner can judge in the running product.
6. **It is written down and the owner agrees.** The conclusion lives in the repo on the new branch (the
   ADRs, `CONTEXT.md`, and a plan document). Where the course is too big for one session, it becomes
   `/wayfinder` tickets on GitHub Issues. The repo is public: no secrets, nothing from `.private/`, no
   Edison content in an issue.

## How to run it

- **The owner is in the loop all session.** Batch nothing that is theirs to decide; ask one question
  at a time, with your recommendation first.
- **Research runs in the background.** Use the `research` skill or read-only agents at `medium` effort,
  one question each and a cited file each: how OpenConstructionERP does X, what a standard says, what
  the market looks like. Keep your own context for the owner.
- **Walk both products with the owner.** OpenConstructionERP is at :8080. The Cubit demo is at :3213
  (sign-in in session-9's close report); keep it as the reference of what not to repeat.
- **The law on the references:**
  - OpenConstructionERP is AGPL-3.0: learn its domain knowledge, algorithms and business logic, and
    never copy its code, schemas, strings or data into our repo.
  - cad2data's converter binaries are proprietary and stay unrun unless the owner rules otherwise.
  - See `~/reference/README.md`.
- **Reuse the new skills.** Matt Pocock's skills are installed (`/ask-matt` routes among them). The
  most relevant here: `/grill-with-docs`, `/grilling`, `research`, `/wayfinder`, `/to-spec`,
  `domain-modeling`, `prototype` (for a quick UI or logic question), and `codebase-design`.
- **CLAUDE.md describes the old product and process.** Once the foundation is agreed, the new
  CLAUDE.md is one of this session's outputs.

## The owner's final thoughts from session 9's close

OWNER_THOUGHTS_PLACEHOLDER

## The starting state

- **Branch.** `dev-lane-and-jev` pushed at session 9's close. This session's new branch is cut from
  its tip.
- **Running products.**
  - OpenConstructionERP: :8080.
  - Cubit demo: :3213, run with `pnpm demo --stop` to stop it.
- **Held and unmerged.** Wave 3e's branches, which the reset makes moot.
- **Worktrees.** Old worktrees under `.claude/worktrees/` are the owner's to remove.

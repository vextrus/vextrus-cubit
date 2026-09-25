# Session 01: the definitive grilling. Finalise the plan we build the MVP from.

You are the orchestrator of the first session of the new Vextrus. The owner (CEO and co-founder, a
practising civil engineer) and you will turn the foundation laid on 25 Sep 2026 into **the final,
cross-verified plan and the first specs**. It must be solid enough to build a complex MVP at full
speed without ever abandoning it. It may run over more than one sitting. Effort is `high`.

This session is not a repeat of the foundation. Its focus, in the owner's words:
- **What we missed and what we miscalculated,** not the business side, which is settled.
- **Building the product as fast as possible, at any cost,** to a quality that speaks for itself like a
  brand.
- **An MVP with Revit-grade visual quality in its UI, 2D sheets and 3D model, and completely smooth to
  operate.** The owner calls this "complex, near-impossible, and doable"; it is the breakthrough this
  session must plan for.

Every other module waits until the MVP is finished, verified by real users, and at that level.

## Read first, in this order
1. `CLAUDE.md`, then `docs/postmortem.md` (once: what must never repeat).
2. `docs/intent.md`, `CONTEXT.md`, `docs/adr/` (0001–0025), `docs/architecture.md`,
   `docs/milestones.md` and `docs/sdlc.md`.
3. **`docs/research/`, the evidence. Use it much more than last time.** Each file opens with its
   conclusions. Cite them in every recommendation, and say when a question goes beyond them:

   | File | Use it for |
   |---|---|
   | `2d-to-bim-approaches.md` | the reading pipeline, prior art (Glodon GTJ), libraries and licences |
   | `2d-to-bim-prototype-lessons.md` | what a real set does to the pipeline: sheet segmentation, blocks, layers, Storey Bands |
   | `jev-system-one.md` | which nodes Jev owns, measured accuracy, gating, cost |
   | `stack-backend.md` | Django modular monolith, module map, import-linter, the parallel-agent rules |
   | `stack-frontend.md` | React/Vite, BOQ grid, dxf-viewer/pdf.js, Three.js + GLB, Excel/PDF, lakh formatting |
   | `stack-data.md` | the data-model sketch, one Postgres, jobs, tenancy, events |
   | `stack-deploy.md` | the stages, costs, latency, hardening |
   | `sdlc-claude-code.md` | Claude Code features, cloud sessions, credit, Builder's 12 failure modes |
   | `oce-product-walk.md`, `oce-algorithms.md`, `oce-data-model.md` | what to beat and what to learn |
   | `glodon-bim-2.md`, `ddc-thesis-and-cad2data.md` | the data-spine thesis, and what shipped vs aspiration |
   | `oce-business-model.md` | settled; read only if a decision touches the business |

## New evidence to bring in first
1. **The plan review**, at `.private/reference/plan-review/vextrus-plan-review.md`, is an adversarial
   review from the owner's other project. There, Opus 5.5 drives AutoCAD and Revit 2027 through MCP
   tools. It extracted the Edison set exactly into a structured dataset, merged the disciplines into an
   IFC, and built high-quality Revit models.
   - Read it in full, yourself: it is the most important input.
   - Weigh it honestly. Its extraction ran inside AutoCAD, which a hosted product cannot run under
     Autodesk's desktop licences. Its lessons on the dataset, merging disciplines and model assembly
     carry over whatever reads the DWG.
2. **The Sample Project** (ADR 0004), at `.private/reference/sample-project/`: structural and
   architectural DWGs, each with its PDF, drafted by the team as a Dhaka consultant would. Run the
   prototype pipeline (`.private/work/proto-2d-bim/`, LibreDWG 0.14 in `tools/`) on it early, and a PDF
   read too. Measure; don't assume.
3. **The old design work**, on branch `dev-lane-and-jev` (read with `git show dev-lane-and-jev:<path>`,
   never restored wholesale). The owner found its tokens helpful and the implemented UI only "okay":
   - `docs/design/00-direction.md` and the 80 files beside it;
   - `src/ui/tokens.css` and `src/ui/tokens.ts`.
4. **The cloud credit** is $500 across two Max accounts, claimed. Plan how both are used.

## The finish line (each written in the repo and agreed by the owner)
1. **The plan review is grilled.** Every point is recorded against the ADRs (confirms, challenges or
   adds), and every challenge is put to the owner with `/grill-with-docs`, one question at a time,
   recommendation first.
2. **What we missed or miscalculated is found and fixed.** Sweep the plan adversarially: run `refuter`,
   `qs-critic` and a fresh architecture critic in parallel over intent, ADRs, architecture and
   milestones. Grill the owner on what survives.
3. **The DWG reader is decided with evidence:** LibreDWG 0.14, Autodesk Platform Services Design
   Automation for AutoCAD, or the ODA SDK. Weigh accuracy on the Sample Project and Edison, licence,
   cost per drawing, latency from Dhaka, and lock-in, with a prototype where argument won't settle it.
4. **The UI/UX is designed, not left to chance.** Last time it was never discussed, and it is where
   quality will be judged. Decide and record:
   - **The design direction and a design system:** tokens (start from the old ones), type, density,
     grid, iconography, motion, the dark/light stance. Use the `frontend-design` skill.
   - **The key screens as prototypes before any build:** the Takeoff with bulk Confirmation and
     Questions; the 2D sheet with the Trace; the 3D Building Model; the Priced BOQ grid; the Project
     Summary. Run the `prototype` skill, then have the owner judge them in the browser.
   - **"Revit-grade" in the browser, made measurable:**
     - the 3D stack (Three.js + GLB, That Open, or WebGPU) with edges, sections, levels, isolate and
       colour-by-status;
     - the 2D sheet renderer's fidelity and speed on the real sets;
     - frame-rate and load budgets on a G+10 model.
   - **A design-quality gate in the SDLC:** every UI PR is walked by `ux-critic` in the running
     product with screenshots, at 1440x900 and 1280x800, and checked against the design system.
5. **The SDLC is upgraded for speed and accuracy.** Tokens are plentiful, and the $500 credit is real.
   - **Replace the weak step.** "Plan in plan mode" is a single interactive context. Make the plan a
     committed document drafted by the orchestrator, attacked in parallel by reviewers
     (architecture, QS, UX, refuter), and resolved before tickets.
   - **Decide how waves run:**
     - the Workflow tool fanning out ready tickets to worktrees and cloud sessions across both
       accounts;
     - `ultrareview` on risky PRs;
     - continuous verification: CI plus the real-drawing check plus the design gate.
   - Size waves by what the owner can review, since only the owner merges.
   - Keep the harness small (docs/sdlc.md's Builder rules still hold).
   - Update `docs/sdlc.md` and ADR 0025.
6. **Business logic is cross-verified with the owner, as a QS would check it:**
   - the default Rule Set's first rules (PWD);
   - a Rate Analysis's shape and the starting library's first items;
   - the default Rod Ratios;
   - the Priced BOQ's structure;
   - the Material Schedule's breakdown.

   Terms go into `CONTEXT.md`.
7. **The data model is drafted** from `stack-data.md`, in `CONTEXT.md` terms, and checked against the
   Takeoff (ADR 0007) and Revisions (ADR 0015).
8. **The ADRs are brought up to date.**
   - Every ADR is re-read against this session's rulings, then amended, superseded or merged where
     related decisions belong together (for example: the business decisions 0001, 0002, 0012 and
     0017; the architecture decisions 0020–0023).
   - Keep ADRs short, one decision each, with superseded ones marked.
   - Update `docs/intent.md`, `docs/architecture.md` and `docs/milestones.md` to match.
9. **The MVP is specified and M0 is ready to build:**
   - `docs/specs/` for the MVP (M0–M2 at least), signed off by the owner;
   - `docs/plans/M0.md`, reviewed as above;
   - M0's tickets in GitHub Issues (`cloud` or `local`, each with its effort);
   - the cloud environments on both accounts set up and tested: setup script, Python 3.13 via uv,
     Postgres, the TypeSafe cloud key (show the owner where to paste it), and LibreDWG built in CI.

## How to run it
- **Grill** with `/grill-with-docs`. One question at a time, recommendation first with its reason and
  its research citation. Record terms in `CONTEXT.md` and decisions in ADRs as they land. Carry on
  with everything that doesn't wait on an answer.
- **Fan out** research, prototypes and critiques to background agents: one question each, each
  returning a cited file. Read their conclusions, not their transcripts. Prototypes on real drawings
  write only to `.private/work/`.
- **Be honest.** Lead with what is broken, unmeasured or doubtful. A prototype that fails is a
  finding, not a setback.
- **Commit** documents as they settle, with explicit paths. Push only with the owner's yes.

## Law in force
- Secrets are never printed or written.
- Real drawings (Edison, the Sample Project, the plan review's Edison content) stay in `.private/`.
  Only conventions and counts leave it, never content. Their text may go to Jev (ADR 0013).
- OpenConstructionERP is AGPL: learn from it, never copy it. No proprietary converter is ever run.
- Only the owner merges. PowerShell is denied.

## Starting state
- **Branch:** `main`, at the reset. The old product is on `dev-lane-and-jev`, and `foundation` equals
  the reset commit.
- **Machine:**
  - Postgres 16 on 5544 holds no Cubit databases. Four older ones remain: `vextrus`, `vextrus_dev`,
    `vextrus_e2e_scratch` and `fixprobe`.
  - OpenConstructionERP runs at :8080. Never upload files to it; it downloads proprietary converters.
- **Owner actions still pending:**
  - the separate TypeSafe cloud key (ADR 0013);
  - a Bangladeshi lawyer's check before the beta;
  - the Hand Takeoffs (ADR 0005);
  - the user-level `~/.claude/settings.json`, whose `skillOverrides` switches off `code-review` and
    may hide the built-in `/code-review`.

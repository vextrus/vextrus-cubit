# Session 10 — the foundation: the plan we build Vextrus from

You are the orchestrator of a long working session with the owner of Vextrus, the CEO and
co-founder, a professional civil engineer. The session may run into sessions 11 and 12. Its purpose
is to produce the **first solid, agreed foundation for the product we will actually build**, and for
how we will build it. It covers the product, the business, the system design and stack, and our
AI-native development lifecycle. It is the foundation the full plan grows from. It is not
necessarily the whole plan, but it must be solid enough that we never abandon it.

Read first, in this order:
1. `CLAUDE.md`: how we work in this phase.
2. `docs/postmortem.md`: why the previous product was reset, and the rules the new plan must
   satisfy.
3. `docs/handoff/session-9-critical-review.md`: the walk of the old product that led to the reset.
4. The owner's thoughts, at the end of this brief, in full.

## Why this session matters

Vextrus has been attempted five or six times. The latest attempt, Vextrus Cubit, took five weeks,
931 commits and billions of tokens. It was built by an autonomous build engine and then by direct
Claude Code sessions. It ended with a partial, unpriced takeoff of one drawing set we authored
ourselves, and investor deadlines missed. The owner has ruled a full reset.

The failure was in the plan and the process, not in effort:
- we proved the product against our own drawings;
- we bet on full automation that refused instead of asking;
- the process and the build engine became the product;
- the domain model was the machine's, not the user's.

This time the plan comes first, and it is systematic. The owner will not accept a sloppy plan.
Don't argue for keeping the old code or for "fixing the blockers to reach M4"; that option was
weighed and rejected.

## The product the owner envisions (to be grilled, sharpened and decided, not assumed)

- **Beyond a construction ERP.** An intelligent, AI-native system for the whole AEC business, from
  the business owner to civil engineers and every professional on a project. It runs complex tasks
  autonomously and solves the industry's real pain points.
- **One dataset at the centre.** Like OpenConstructionERP, one project dataset flows coherently
  through every module and department. OpenConstructionERP centres it on BIM:
  - you drop RVT or IFC files in, with no plugin;
  - the BIM data then feeds 4D schedule, 5D cost, BOQ and more.
- **Our market does not use BIM.** Bangladesh first (the MVP market), then South Asia, the Middle
  East and Africa, with the UK and Australia later. There, projects run on **2D AutoCAD drawings**
  and generic business software, and the workforce is not trained in Revit.
- **The core challenge, and our moat.** Turn a client's 2D AutoCAD drawings into an operational BIM
  model that our system runs on:
  1. A takeoff layer extracts geometry, metadata and entities from the 2D drawings.
  2. A quantity surveyor confirms what was read.
  3. The confirmed data is assembled into a real 3D BIM dataset.

  This is the MVP and the core function. Every other module is built around that dataset. No one has
  done this well.
- **Better than OpenConstructionERP** on quality, creativity, frontend design and UX (where it ranks
  lowest), and on autonomous AI. The owner has broader, industry-changing ideas to place in the
  sequence.
- **A different business model** from OpenConstructionERP's open-source strategy. The business plan
  is part of this session.

## The finish line

Each condition is written down in the repo and agreed by the owner.

1. **The owner's thinking is grilled whole.**
   - **How.** Use `/grill-with-docs`, one question at a time, recommendation first, across the
     vision, users, the job, the modules, the business and the constraints.
   - **Where it lands.** Terms settle in `CONTEXT.md` and decisions in `docs/adr/` as they land.
   - **The owner's review.** They bring an in-depth review of the old Cubit demo and of
     OpenConstructionERP; grill it too.
2. **OpenConstructionERP is understood and critically judged.** From four sources:
   - the running product at http://127.0.0.1:8080 (walk it, with the owner where they want to);
   - its documentation at https://openconstructionerp.com/docs;
   - its code in `~/reference/openconstructionerp/`, starting with `DEVELOPING.md` and `MODULES.md`;
   - the book `~/reference/DataDrivenConstruction_Book_2ndEdition_ArtemBoiko_2025_en-US.pdf`,
     pages 11–26, then more only as needed.

   The output, in `docs/research/`, covers:
   - its concepts: the single data flow, the dataset-centred design, BIM/CAD ingestion without
     plugins, its database and data model, the cost database and resources, 4D and 5D, BOQ,
     validation, AI;
   - its algorithms and business logic;
   - what it solves only partly, where its flows and UI/UX fall short;
   - its business model, and how its open-source strategy actually makes money.

   cad2data (`~/reference/cad2data-Revit-IFC-DWG-DGN/`) is read the same way, through its MIT docs
   and pipelines only.
3. **The product is defined.**
   - the users and their jobs;
   - the end-to-end flow of the MVP (2D drawings → QS-confirmed takeoff → BIM dataset → the first
     modules on it);
   - the module map beyond the MVP;
   - how we beat OpenConstructionERP;
   - where the owner's broader ideas sit in the sequence.

   **The 2D→BIM approach gets its own research and prototype.** It is the hardest technical risk.
   Before committing, research how it can be done and prove it on a real drawing: reading layers,
   blocks, dimensions and text; inferring levels and heights; assembling IFC; the libraries and
   their licences. Real drawings come from day one: the owner's drawings and the Edison set, locally
   and never committed.
4. **The business plan's foundation is stated:** who pays, for what, the pricing model, how we reach
   the first clients in Bangladesh, and the path to the next markets.
5. **The system design and architecture are decided.** Enterprise-grade and able to scale, yet
   designed so AI agents can build it fast with little friction. Three stages:
   - free to move during development;
   - hardened for a beta with a few clients;
   - upgradeable as we grow.

   **The backend is Python.** CAD, BIM, geometry, engineering calculations and AI all live there.
   Research and choose the framework for production-grade enterprise Python; don't default to
   TypeScript.

   Decide the frontend, including 3D/BIM viewing in the browser. Decide data, storage, jobs, search,
   the AI layer, deployment and observability. Each choice is weighed against the two stacks that
   failed us, listed in the owner's thoughts below.
6. **The AI-native SDLC and the harness are designed.** This decides how the plan becomes
   production-grade code quickly, with as much parallel, mostly unattended (AFK) work as quality
   allows.
   - **Built on:**
     - Anthropic's AI-native SDLC playbook (https://claude.com/blog/the-ai-native-sdlc-playbook:
       `intent.md` → `spec.md` → `plan.md` → build with plan mode → continuous verification →
       review gates → maintain);
     - Matt Pocock's skills, already installed;
     - Opus 5.5's strengths: long autonomous runs, parallel subagents, strong code review.
   - **What it covers:**
     - the Claude Code features to use: plan mode, auto mode, worktrees, subagents, skills, hooks,
       Code Review;
     - cloud sessions (https://code.claude.com/docs/en/claude-code-on-the-web): environments, setup
       scripts, `--cloud` and `--teleport`, auto-fix of PRs;
     - routines (https://code.claude.com/docs/en/routines);
     - ultrareview (https://code.claude.com/docs/en/ultrareview).
   - **The $250 cloud-session credit.** It is reserved for the execution phase, and the plan should
     use it fully and wisely.
   - **What this harness replaces.** It replaces the old one, including the old Cubit agents, skills,
     rules and workflows in `.claude/`.
   - **What it must avoid.** The failure of `~/vextrus-builder/docs/specs/builder.spec.md` (read it):
     an engine that became the product. No over-engineering.
   - **Effort policy.** `medium` by default and higher only for hard decisions (the Opus 5.5
     guidance:
     https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5
     and https://platform.claude.com/docs/en/build-with-claude/effort).
7. **The first milestones are stated,** each with a finish line the owner can judge in the running
   product, on real drawings.
8. **The reset is executed, with the owner's confirmation.** Once the foundation is agreed, clear this
   branch of the old product: everything except `.claude/` (pruned and rewritten for the new harness)
   and `docs/postmortem.md`. Then write the new `CLAUDE.md` and the plan documents, and commit. The
   old product survives on `dev-lane-and-jev` in git history and on GitHub.

## How to run it

- **Phases.**
  - Start with the owner's thinking.
  - Run the OpenConstructionERP study and the 2D→BIM research in the background while you grill.
  - Converge on product, business, architecture and SDLC.
  - Record as you go.
  - Where the course is larger than a session, map it with `/wayfinder` on GitHub Issues. The repo
    is public: no secrets, nothing from `.private/`, no Edison content.
- **Research agents.** One question each, at `medium` effort, each returning a cited file under
  `docs/research/`. Read their conclusions, not their transcripts. Use `prototype` for a quick proof
  of an idea (for example, reading one real DWG into a crude 3D model) when that settles a decision
  faster than argument.
- **Owner decisions.** Recommendation first, one question at a time. Carry on with everything that
  doesn't depend on the answer.
- **Effort.** Raise it for hard decisions (suggest `/effort high` to the owner), then drop back.
- **Commits.** Commit the documents as they settle, with explicit paths.

## The law in force

- **Both repos are public.** Secrets are never printed, written or committed, and `.private/` never
  enters git.
- **OpenConstructionERP is AGPL-3.0.** Learn from it and never copy its code, schemas, strings or
  data. cad2data's converter binaries stay unrun unless the owner rules otherwise.
- **Real drawings** are analysed locally and never committed.
- **Irreversible or outward-facing actions** (pushes, deletions, spending beyond small experiments,
  new paid services) are the owner's.

## Starting state

- **Branch.** `foundation`, cut from `dev-lane-and-jev` at session 9's close. Both are pushed. The old
  product lives on `dev-lane-and-jev`; `main` is older still.
- **Running.**
  - OpenConstructionERP at :8080: `~/reference/oce.sh status|stop|start`.
  - The old Cubit demo at :3213: `pnpm demo --stop`. Its sign-in is `j000-legs-mufzf9bciit@cubit.test`
    / `golden-path-legs-mufzf9bciit`.
- **Installed and configured.**
  - Matt Pocock's skills.
  - The issue tracker: GitHub Issues with the default triage labels, and `docs/agents/`.
  - `~/reference/` with its README.
- **Owner's housekeeping.**
  - Old worktrees in `.claude/worktrees/` (8.8 GB, gitignored) are the owner's to remove.
  - `~/.claude/settings.json` was backed up to `settings.json.bak-session9` before its auto-mode
    description was updated for this phase.
- **Harness to review.**
  - `~/.claude/settings.json` switches off a skill named `code-review` (`skillOverrides`). That may
    also hide Matt's `code-review` skill, and it shares a name with the built-in `/code-review`
    (ultrareview).
  - The guard hook `.claude/hooks/guard.mjs` imports `scripts/harness/guard-rules.mjs`, which the
    reset removes. Port its universal rules (secrets, `git add -A`, `--no-verify`, force-push,
    `git clean`, PowerShell, `.private/`) into `.claude/hooks/` before the reset, or the hook will
    fail.
  - The same goes for the SessionStart hook's `scripts/harness/state.mjs` and the `cubit` MCP server
    in `.mcp.json`.

## The owner's thoughts at the close of session 9 (their words, condensed)

- **The plan comes first.** "At the end of this session you'll push everything of current
  dev-lane-and-jev and start a new branch on top of it where we'll grill, research and go
  extensively through everything, so that at the end we have the very first final conclusion of our
  next course of action. It might not be the final, full plan of everything, but it will definitely
  establish a strong foundation." It may take one or two more sessions. "The final plan we're going
  to establish must be 100% solid", so it never lets us down in execution.
- **The reset is total.** "We will completely reset everything on that branch. We're going to have a
  completely new stack, and everything is going to change from top to bottom. The only folder worth
  keeping is our Claude Code `.claude/` folder, and in docs maybe a single file about what happened
  before and why everything went so wrong." They want no trace of the old mistakes.
- **The biggest mistake was the process.** "We must establish our SDLC for the new plan, and this
  time it can't be messed up." Vextrus Builder "was showing off tests passed with screenshots and
  journey videos, and I thought everything was going well; in reality we were drowning." Face that
  reality.
- **An AI-native SDLC for Opus 5.5.** A mostly autonomous way of running sessions unattended (AFK).
  It follows Anthropic's playbook and combines it with Matt Pocock's skills, without
  over-engineering. The product is complex enterprise software (heavy drawings, takeoff, engineering
  calculations, BIM and native 3D). "I believe Opus 5.5 is capable of it if the planning is solid and
  the AI-native SDLC is ready."
- **Cloud sessions.** The $250 reserved credit is to be used at the highest useful rate once
  execution starts, for an initial boost to production and a production-grade MVP in a short time.
- **OpenConstructionERP.** It is "great, honestly". Its author founded datadrivenconstruction.io and
  wrote the 500+ page book the owner has read in full; it broadened their concept. It is close to
  the product they dreamed of building, but it has downsides, with UI/UX the lowest. We will not
  steal its code. We will gather its information, algorithms and business logic, since the domain is
  the same.
- **The vision.** Not just another construction ERP: "the ultimate solution every businessman of the
  AEC industry dreams of but never saw coming". It is the smartest AI-native, autonomous system for
  complex tasks, solving the industry's pain points for owners, civil engineers and beyond.
- **The idea to build on.**
  - **The data spine.** Take OpenConstructionERP's fundamental concept (its stack logic, above all
    its database and a single flow of data through every module), so every department and person on
    a project is bound to one dataset, established first from the project's BIM.
  - **Our dilemma.** Our markets (Bangladesh first for the MVP, then South Asia, the Middle East and
    Africa, the UK and Australia later) barely use BIM. They rely on 2D AutoCAD, and the workforce is
    not skilled in Revit.
  - **The core of the MVP.** Convert clients' 2D AutoCAD drawings into a 3D BIM model that runs in
    our system. Use takeoff to extract geometry, metadata and entities, then QS confirmation, then
    enough data to build a real BIM model.
  - **Architecture.** Every other module surrounds that dataset, and the system design and
    architecture must be enterprise-capable.
- **Architecture: enterprise and progressive.** The owner disagrees with "the architecture is heavy
  for a product with no users". Design it as enterprise software with heavy work, but progressive:
  - free to operate during development;
  - upgradeable for a production beta;
  - able to scale over time.

  Enterprise design must not cripple fast agentic development, and you must solve that technically.
  Two stacks failed us before:
  - the ERP's: workspaces/monorepo tooling, NestJS/CQRS/DDD, GraphQL with generated clients, Prisma,
    Redis, a Python web service, Electron/native desktop, a separate design-system package, an
    unstyled component library, AGPL PDF libraries, the ODA File Converter, Docker in dev;
  - Cubit's opposite: "one application, one schema lane, one verification command, one obvious
    place for everything", which also did not go well.
- **Python for the backend.** "Our backend needs Python badly, or we're bound to fail." Choose a
  framework in which you write production-grade enterprise Python.
- **CLAUDE.md** is rewritten for this phase, so the old one does not degrade the session.
- **Effort.** Opus 5.5 runs at `medium` by default, raised during hard decisions.

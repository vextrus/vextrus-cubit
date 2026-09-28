# Vextrus — how we build (the AI-native SDLC)

Agreed by the owner on 25 Sep 2026, rewritten after session 01's rulings (26 Sep 2026) and levelled in
session 02 (28 Sep 2026): ADRs 0025, 0026 and 0030. Evidence: docs/research/sdlc-claude-code.md and sdlc-waves-and-cloud.md. The harness is
configuration and prose, not code. It must never become the product (docs/postmortem.md, cause 3).

## Per milestone
1. **Grill** the milestone with the owner (`/grill-with-docs`, effort high). Write
   `docs/specs/M<n>.md`; the owner signs it.
2. **Draft the plan** as a committed document, `docs/plans/M<n>.md`: modules, slices, order, test
   seams, the Checks it brings (ADR 0027), risks.
3. **Attack the plan in parallel:** an architecture critic, `qs-critic`, `ux-critic` (against the
   prototypes and the design system) and `refuter`, each writing a findings file under
   `docs/reviews/`.
4. **Resolve every finding:** fixed in the plan or put to the owner, one question at a time. The owner
   signs the plan; only then is it cut into tickets.
5. **Ticket** with `/to-tickets` into GitHub Issues, the only work state: vertical slices that own
   disjoint files, with blocking links. Labels:
   - the five triage states;
   - **`cloud`**: built in a cloud session and fully provable by committed tests;
   - **`cloud+local`**: built in a cloud session, but it cannot merge without the owner's machine:
     the real-drawing check (every engine PR), a check on the real files, the design gate, or a walk
     on a real set. The ticket names its local step and who does it;
   - **`local`**: needs real drawings or the owner's eyes throughout (reading, recognition, model
     assembly); built in a local session;
   - **`owner`**: the owner does it; an agent may prepare it;
   - the effort: `high` by default, `medium` for small, fully specified `cloud` tickets.
6. **Build each ticket:** `/implement`, then `/tdd`, then the fast check (the module's tests, mypy,
   `lint-imports`), then `/code-review`, then a PR that closes the issue. The PR body **leads with what
   was not verified**, then what was verified and how.
7. **Gate each PR** (ADR 0025's ruleset: a PR, CI green, up to date with `main`):
   - **engine PRs** (by path: `engine/**` and the reading modules, the list in the milestone's plan)
     carry the `real-drawings` status, which the owner starts with one command: the pipeline runs as
     the owner inside bwrap (no network, neither home mounted) and writes its export to a drop
     folder; in M0 the status reports the element-by-element change against the last merged run
     (regression, no Answer Keys); from M1 the scorer also runs as the key user, with the owner's
     password, and the owner's GitHub App posts the status (ADR 0030, amended in session 02). A PR
     that touches no engine path gets `real-drawings` "not applicable" from a job that runs on
     `pull_request_target`, so `main`'s copy of the workflow runs, reading only the changed-file list;
     and a CI check fails any workflow that requests `statuses: write` or names `real-drawings`, so a
     PR's own workflow cannot post the status (s02 review R3);
   - **every PR** keeps markets as data (ADR 0038): no market literal, every visible string a message,
     every figure through its formatter, logical CSS only (CI's lint and the shared expected-strings
     table);
   - **UI PRs** pass the design gate: `ux-critic` reads docs/design/system.md, docs/design/screens.md
     and docs/design/m0-screens.md (the behaviour spec), runs the PR on the seeded demo project and
     walks it at 1440×900 and 1280×800 (and 390×844 for the Project Summary and share link) with
     screenshots; findings above minor block; the screenshots go in the PR body. After the pass, the
     owner's GitHub App posts a **`design-gate`** status carrying the checklist's items passed and
     failed (docs/design/m0-screens.md §8, which marks each item automated or judged by eye), not the
     screenshots; the ruleset requires it for any PR touching `web/**` (s02 review U10);
   - ultrareview (free runs only) on risky PRs: money, geometry, the data spine;
   - **the owner merges.** Only the owner; the guard refuses agent merges. The owner reviews evidence
     and behaviour, and reads in full only `.github/`, `.claude/`, migrations and tests, and the
     harness scripts and the sandbox (`scripts/real-drawings`, `scripts/real_drawings/`,
     `scripts/score/`, `scripts/owner/`, `scripts/cloud/`, `engine/read/sandbox.py`; ADR 0025).
8. **Close the milestone:** the owner and the team walk the running product on the Development Sets
   and Held-out Sets, with a timed Takeoff, and score against the Hand Takeoff blind (ADRs 0005,
   0033, 0026). Only that walk says "done".

## Waves (ADR 0025)
- **Cloud tickets:** one `claude --cloud` command each (it needs a terminal: the orchestrator runs it
  under `script`), on **account A** (`CLAUDE_CONFIG_DIR=~/.claude-a`); follow-ups go into the running
  session with `claude -p "<message>" --cloud <session>`. Account B runs the local sessions while its
  plan lasts (the owner, 28 Sep 2026; the record in the M0 milestone issue, #45). **Cost is not the
  constraint:** the cloud credit is promotional and cloud sessions continue on the subscription after
  it; what limits a wave is the quality of every merge (the owner, 28 Sep 2026: "focus on producing
  production grade highest code quality on every merge, every wave and every sessions").
- **Unattended local tickets:** the Workflow tool, as a launcher with no state of its own, one
  worktree per ticket, each ending in a PR. Local tickets that need the owner run interactively.
- **Size:** wave 1 is four cloud and one or two local tickets, measuring cost per merged PR, time to
  PR, the owner's review minutes and second continuations. Widen to 6–8 cloud once the review queue
  stays under a day, at most one PR in four needs a second continuation, and conflicts stay trivial.
  The ceiling (about 10–12) is the owner's review.
- **Collisions:** tickets in a wave own disjoint files; at most one ticket per wave adds migrations to
  a given module. Record the account and cost of each merged PR in the milestone's issue.

## Rules against the Builder's failure modes
- **The harness stays small:** three hooks (guard, state, after-bash) and the blind scorer; no
  orchestrator, ledger, state store, locked paths or evidence packs. A harness change needs an
  owner-approved issue and should remove as much as it adds.
- **Green is not done.** CI is necessary, never sufficient; the owner's walk decides.
- **Real drawings from M0.** Synthetic fixtures only for unit mechanics, never offered as proof. The
  clean Sample Project flatters a reader: it read through all fourteen steps while Edison read nothing
  until 31 fittings (docs/research/edison-check-session-02.md), so a consultant office's conventions go
  into its Drafting Profile, never into reader code, and Held-out Sets are scored first as an unknown
  office's first read.
- **Answer Keys are out of reach** (ADR 0026): a separate user, `sudo` with a password, a blind scorer
  that returns aggregates; no session reads the laboratory.
- **Plan one milestone at a time.** Everything later stays rough until its turn.
- **One implementing session per ticket,** plus the read-only reviewers (`refuter`, `qs-critic`,
  `ux-critic`) and `drawing-analyst` for local work. Reviewers flag correctness and stated-requirement
  gaps, top five findings per PR.
- **The stop rule.** A `cloud` ticket that fails its checks after two continuations goes back to
  `needs-triage` for a human re-spec. A `local` reading ticket stops when its n / N stops improving.
- **Lessons, not machinery.** `docs/knowledge/lessons.md` by area, written in the same PR as the fix.
  A mistake Claude makes twice goes into `CLAUDE.md`.
- **Pinned model and effort** in the committed settings (high); a ticket may lower it to medium.
- **Every external fact** in the product (a price, an API shape, a rate) cites a source.
- **Reports lead with what is broken or unmeasured.**

## The harness
- **`CLAUDE.md`** under one page, with `CONTEXT.md`, `docs/adr/`, `docs/intent.md`,
  `docs/architecture.md`, `docs/milestones.md` and this file.
- **Hooks:** the guard (secrets printed; staging everything; `.private/` or drawings staged; deleting
  untracked files; history rewrites; skipped hooks; PowerShell; agent merges and posted statuses;
  raising privilege; reading the laboratory; editing reference drawings), a SessionStart status that
  also runs in the cloud, and `sync` after commit. Deny rules on the laboratory and the key user's
  home.
- **Skills:** Matt Pocock's planning and building set (`grill-with-docs`, `grilling`,
  `domain-modeling`, `to-spec`, `to-tickets`, `triage`, `wayfinder`, `implement`, `tdd`,
  `diagnosing-bugs`, `codebase-design`, `prototype`, `research`, `handoff`,
  `resolving-merge-conflicts`, `writing-for-agents`, `wizard`, `ask-matt`,
  `improve-codebase-architecture`; his review skill is `spec-review`), plus `product-review` and
  `real-drawings`. The built-in `/code-review` and ultrareview review PRs.
- **MCP:** `chrome-devtools`, through the small wrapper in `.claude/mcp/`.
- **Jev:** in the product per ADR 0011, and in development sessions where a closed question helps.

## Environments (session 02)
Python 3.14 and PostgreSQL 18.6 everywhere before wave 0: locally (the owner installs PostgreSQL 18 from
the PostgreSQL apt repository), in the cloud environments (`apt.postgresql.org` on their allowlist; one
before wave 0, the other after it, below) and in CI (a `postgres:18.6` service container); ids through
`ids.new_id()` (docs/research/stack-versions.md). Revised by the M0 plan's reviews (s02 review A3, R5,
R8; docs/reviews/M0-plan-s02-resolution.md):
- **Locally, the toolchain lives outside home:** an owner script installs Python 3.14, LibreDWG and
  .NET under `/opt/vextrus/{python,libredwg,dotnet}` before ticket 06a, so the real-drawing sandbox can
  bind them read-only (docs/architecture.md, Stages).
- **ezdxf** has no cp314 wheel: a `toolchain-ezdxf` workflow builds one once per pin with pinned, hashed
  build constraints, installed by hash (the check builds nothing); if that build fails, the pure
  `py3-none-any` wheel is used and its speed cost recorded.
- **One cloud environment is rebuilt before wave 0,** on Python 3.14 and PostgreSQL 18 with a throwaway
  setup script: the owner's step, which keeps Q18's "before wave 0" and times the setup against its
  five-minute budget (docs/research/sdlc-waves-and-cloud.md §1.4). The other environment follows after
  wave 0, before any cloud ticket builds in it.

Background agents keep a `NOTES.txt` progress log so an app restart cannot lose their work
(docs/knowledge/lessons.md).

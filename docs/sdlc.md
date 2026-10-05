# Vextrus — how we build (the AI-native SDLC)

Agreed by the owner on 25 Sep 2026, rewritten after session 01's rulings (26 Sep 2026) and levelled in
session 02 (28 Sep 2026); sessions made autonomous in session 05 (29 Sep 2026): ADRs 0025, 0026, 0030
and 0041; the software factory since session 12 (ADR 0042). Evidence: docs/research/sdlc-claude-code.md,
sdlc-waves-and-cloud.md and opus-5-5-agentic-orchestration.md. The harness is the factory: committed
code, prose and checks. It must never become the product (docs/postmortem.md, cause 3), and the owner's
Q1 ruling holds it: "Factory code is committed, tested and reviewed like product code. A harness change
should remove as much as it adds."

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
   - the effort: `medium` by default, `high` for hard tickets (reading, hostile-input boundaries,
     security walls).
6. **Build each ticket** (the review loop below): acceptance tests first, then `/implement`, `/tdd`,
   the fast check (the module's tests, mypy, `lint-imports`), then a PR that closes the issue. The PR body **leads with what
   was not verified**, then what was verified and how.
7. **Gate each PR** (ADR 0025's ruleset: a PR, CI green, up to date with `main`):
   - **engine PRs** (by path: `engine/**` and the reading modules, the list in the milestone's plan)
     carry the `real-drawings` status, which the orchestrator starts with one command and accepts
     under the accept rule (ADR 0041): the pipeline runs as the owner's user inside bwrap (no network,
     neither home mounted) and writes its export to a drop folder; the status reports the
     element-by-element change against the last merged run (regression); the scorer, brought forward
     from M1, runs as the key user without a password on the pipeline's own export only; the owner's
     GitHub App posts the status (ADR 0030). A PR
     that touches no engine path gets `real-drawings` "not applicable" from a job that runs on
     `pull_request_target`, so `main`'s copy of the workflow runs, reading only the changed-file list;
     and a CI check fails any workflow that requests `statuses: write` or names `real-drawings`, so a
     PR's own workflow cannot post the status (s02 review R3);
   - **every PR** keeps markets as data (ADR 0038): no market literal, every visible string a message,
     every figure through its formatter, logical CSS only (CI's lint and the shared expected-strings
     table);
   - **UI PRs** pass the design gate: `ux-critic` reads docs/design/system.md, docs/design/screens.md
     and docs/design/m0-screens.md (the behaviour spec), runs the PR on the seeded demo project, which
     proves the ticket's mechanics only (G1's agent layer walks the real sets), and walks it at 1440×900 and 1280×800 (and 390×844 for the Project Summary and share link) with
     screenshots; findings above minor block; the screenshots go in the PR body. After the pass, the
     orchestrator posts, through the owner's GitHub App, a **`design-gate`** status carrying the
     checklist's items passed and failed (docs/design/m0-screens.md §8, which marks each item automated or judged by eye), not the
     screenshots; the ruleset requires it for any PR touching `web/**` (s02 review U10);
   - ultrareview (free runs only) on risky PRs: money, geometry, the data spine;
   - **the orchestrator merges** after the review loop and green required checks (ADR 0041).
8. **Close the milestone:** the owner and the team walk the running product on the Development Sets
   and Held-out Sets, with a timed Takeoff, and score against the Hand Takeoff blind (ADRs 0005,
   0033, 0026). Only that walk says "done".

## Waves (ADRs 0025, 0041)
Sessions are autonomous (the owner, 29 Sep 2026: "I want complete autonomous sessions and I insist
that"). The orchestrator runs the wave with the `orchestrate-wave` skill; the owner decides product and
scope and walks the milestone.
- **A time budget first:** the session's and each ticket's, written in the brief. The orchestrator writes
  `elapsed <n> min / <budget> min` in every message to a builder (the research's one measured speed
  lever: docs/research/opus-5-5-agentic-orchestration.md §7 item 15). Over budget: cut scope, say what.
- **Where tickets run:** cloud sessions for tickets provable by committed tests; local background
  sessions (`claude --bg`, one worktree each) for anything touching real drawings. Account A runs the
  orchestrator and every builder. Every builder starts through `scripts.factory.launch`, from the main
  checkout; it judges each cloud launch's debug log and refuses a bundled session or one cloned at the
  wrong branch (session 05's cloud launches uploaded copies with no remote). Cloud builders push their
  own branch only; local builders commit and never push.
- **Effort per launch:** `medium` (the committed default); `high` for hard tickets (reading drawings,
  hostile-input boundaries, security walls), for every `acceptance-writer` (the owner's Q20, 4 Oct 2026:
  "yes for most scenario if it comes to quality"; `medium` only for a docs-only ticket) and for
  `pr-reviewer` and `refuter`.
- **Size:** as many tickets as own disjoint files and the machine's memory allows; the measures below
  decide whether to widen. (History: wave 1 was four cloud and one or two local tickets, widened to 6–8
  once the owner's review queue stayed under a day; ADR 0041 removed that queue; the measures continue.)
- **Collisions:** tickets in a wave own disjoint files; at most one migration per module per wave,
  unless a declared merge edge orders them (the second renumbered after the first merges).
- **Reading work is a scored loop.** Once the scorer and the Answer Keys are in place, many agents work
  at once, each on a different failing sheet of a Development Set, looping until its per-sheet score
  rises; the Held-out Sets are scored only in aggregate at milestone gates (ADRs 0026, 0041).
- **Cost is not the constraint:** what limits a wave is the quality of every merge (the owner, 28 Sep
  2026: "focus on producing production grade highest code quality on every merge, every wave and every
  sessions").

## The review loop (ADR 0041; the `orchestrate-wave` skill runs it)
Session 04's loop found a real fault in ten of eleven PRs, three of them in fixes of earlier findings; it
stays, capped, and the orchestrator does what the owner did.
1. **Acceptance tests first.** `acceptance-writer` turns the ticket's plan entry, its contracts and
   m0-screens' verbatim words into failing tests under an acceptance path, committed (`acceptance: …`)
   on the ticket's branch before the builder starts. The builder may not change them: CI's acceptance
   check fails any other commit that does.
2. **Build, budgeted.** The builder makes the acceptance tests pass, with its own tests, the fast check
   and a PR body that leads with what was not verified.
3. **One independent review:** `pr-reviewer` on the committed head, merged with `main` and any PR it
   meets, scoring 0–100; in parallel, `ux-critic` as the words-only gate for a PR whose words reach a QS,
   or the walk for a UI PR.
4. **At most two fix rounds,** enforced by `merge_ready`, one message each, every fix re-checked by the same agents on the new
   head. Findings at 50 and above are fixed; each serious finding (50 or more, or a repeated class) leaves
   a committed check. A finding after the second round is filed as an issue, unless it is a security hole
   scoring 75 or more, a crash or false statement a QS meets, or a regression the first fix round introduced
   (`fix-regression`, the owner, 5 Oct 2026).
5. **The orchestrator gates and merges:** pushes and opens the PR; merges `main` into it; posts
   `design-gate` from the independent gate's verdict and, on engine PRs, runs `scripts/real-drawings` and
   accepts only under the accept rule (no failed stage gained; nothing lost or changed without a judged
   reason; gains judged), posting through `post-status` as the key user from the main checkout; then
   merges when `python -m scripts.merge_ready <PR>` passes (each gate posted by the App or main's
   not-applicable workflow, every check green).
6. **Measures** go to the milestone issue per PR and per wave: time to first PR against budget, review
   rounds, findings filed after the cap, gate and posting-run outcomes, checks added.

## Definition of done (ADR 0042; the factory spec §5)
**Per PR:**
1. Acceptance tests by `acceptance-writer`, pushed before the builder starts, red on main and green on a
   throwaway, with both counts in the commit (`tools/lint/acceptance.py`). An untestable ticket says why.
2. The head carries `Factory-State: READY` and `Factory-Verify: <its own tree> ok`.
3. `ci`, `web` and `engine` green, with at most one recorded rerun of a listed flake (`.github/flaky.txt`).
4. Review in at most two fix rounds; every finding of 50 or more passed a refuter, was fixed and left a
   committed check whose red output path is in the body. Round 3 only with a recorded exception (a
   security hole of 75 or more, a crash, a false statement a QS meets, or `fix-regression`: every finding left
   at round 2 was introduced by fix round 1, as its refuter confirms; the owner, 5 Oct 2026).
5. `design-gate` (web) and `real-drawings` (engine paths) posted through `post-status`.
6. The body leads with what is not verified, including "not walked on a real set" where true. Every cut
   item links an open issue. A harness PR carries `Harness net: +a / -r`.
7. `merge_ready` green.

**Per wave:** G1, the real-set walk, on main after the wave's last merge: a script layer measures the
reads, the acts' wait and the Questions; an agent layer walks the milestone's finish-line items on the
real sets. A blocking finding or a regression becomes a fix ticket in the same session. Every walk
finding of any severity becomes an issue (or a comment on its open issue).

**Per milestone:** two passing G1 verdicts on main's current product code, the QS-burden measures within
the owner's limits, and main's reading score measured, not claimed; only then "walk now" to the owner.

## Rules against the Builder's failure modes
- **The factory is product-grade code** (the owner's Q1 ruling, above): committed, tested and reviewed
  like product code, and a harness change should remove as much as it adds. Every harness PR states its
  `Harness net: +a / -r` from `git diff --numstat` over `.claude`, `scripts`, `tools` and `.github`.
- **Green is not done.** CI is necessary, never sufficient; the owner's walk decides.
- **Real drawings from M0.** Synthetic fixtures only for unit mechanics, never offered as proof. The
  clean Sample Project flatters a reader: it read through all fourteen steps while Edison read nothing
  until 31 fittings (docs/research/edison-check-session-02.md), so a consultant office's conventions go
  into its Drafting Profile, never into reader code, and Held-out Sets are scored first as an unknown
  office's first read.
- **Answer Keys are out of reach** (ADRs 0026, 0041): a separate user; one password-free rule for the
  scorer and the poster only; a blind scorer that answers per sheet on Development Sets and in aggregate
  on Held-out Sets; no session reads the laboratory.
- **Plan one milestone at a time.** Everything later stays rough until its turn.
- **One implementing session per ticket,** plus the read-only reviewers (`refuter`, `qs-critic`,
  `ux-critic`) and `drawing-analyst` for local work. Reviewers flag correctness and stated-requirement
  gaps, top five findings per PR.
- **The stop rule.** A ticket that fails its checks after two fix rounds goes back to `needs-triage` for
  a re-spec. A reading ticket stops when its score stops rising.
- **Checks, not lessons** (ADR 0041). Every serious finding leaves a committed check in the PR that fixes
  it; `docs/knowledge/lessons.md` is an index pointing each lesson at its check, and a lesson without one
  is a debt listed in the milestone issue.
- **Pinned model and effort** in the committed settings (medium); a hard ticket is launched at high.
- **Every external fact** in the product (a price, an API shape, a rate) cites a source.
- **Reports lead with what is broken or unmeasured.**

## The harness
- **`CLAUDE.md`** under one page (90 lines: the laws and a map; detail in `.claude/rules/`, loaded when
  matching files are touched), with `CONTEXT.md`, `docs/adr/`, `docs/intent.md`,
  `docs/architecture.md`, `docs/milestones.md` and this file.
- **Hooks:** the guard (secrets printed; staging everything; `.private/` or drawings staged; deleting
  untracked files; history rewrites; skipped hooks; PowerShell; statuses posted through the API;
  raising privilege, but for the poster's and the scorer's exact lines; reading the laboratory; editing reference drawings), a SessionStart status that
  also runs in the cloud, and `sync` after commit. Deny rules on the laboratory and the key user's
  home.
- **Skills:** Matt Pocock's planning and building set (`grill-with-docs`, `grilling`,
  `domain-modeling`, `to-spec`, `to-tickets`, `triage`, `wayfinder`, `implement`, `tdd`,
  `diagnosing-bugs`, `codebase-design`, `prototype`, `research`, `handoff`,
  `resolving-merge-conflicts`, `writing-for-agents`, `wizard`, `ask-matt`,
  `improve-codebase-architecture`; his review skill is `spec-review`), plus `product-review`,
  `real-drawings` and `orchestrate-wave` (the orchestrator's runbook). Second review lens: the adversary
  agent inside `/review-pr` (ADR 0042).
- **Agents:** `acceptance-writer` (a ticket's failing acceptance tests, before its builder),
  `pr-reviewer` (every PR, and every fix round), `refuter` (one claim), `ux-critic` (a walk,
  or the words-only gate), `qs-critic` and `drawing-analyst` (local, real drawings).
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

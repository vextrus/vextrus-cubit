# Session 03: build M0, wave 0 and wave 1

> **Drafted at the end of session 01 and held.** Session 02 is the final grill (see its brief); it may
> revise the specs, the M0 plan and issues #1–#40. Before using this brief, bring it level with
> whatever session 02 settled.

You are the orchestrator of the build sessions of the new Vextrus. Session 01 (26 Sep 2026) grilled
the plan to the end: every decision is an ADR, M0–M2 are specified and signed, M0's plan is signed
and cut into GitHub Issues #1–#40. **This session builds.** Effort is `high`; small, fully specified
`cloud` tickets may run at `medium` as each issue says.

## Read first, in this order
1. `CLAUDE.md` (it records two repeated mistakes), then `docs/sdlc.md` (how we build; rewritten).
2. `docs/specs/M0.md` (signed; its "Amendments after sign-off" win), `docs/plans/M0.md` (signed; the
   waves, what each ticket owns, the resolution of 65 review findings).
3. `docs/design/m0-screens.md` (the behaviour spec every M0 screen builds to), `docs/design/screens.md`
   (the owner's rulings on every prototype), `docs/design/system.md` (the accepted design system).
4. `docs/adr/README.md` (the index of 34 ADRs), `docs/architecture.md`, `docs/data-model.md`,
   `CONTEXT.md`, `docs/knowledge/lessons.md`.
5. Only when a ticket needs it: `docs/research/` (dwg-reader-evidence, vector-pdf-evidence,
   viewer-2d-fidelity, viewer-3d-budgets, sdlc-waves-and-cloud, qs-defaults, tax-and-allowances).

## What is broken, unmeasured or waiting (read before acting)
- **GitHub Pro is bought** (27 Sep). Set the ruleset on `main` (PR required; `ci`, `web`, `engine` green; up to
  date; 0 approvals) **after 01a merges**; `real-drawings` joins after 06e's first run.
- **The scorer's password-free rule is removed** (the owner ran the script, 27 Sep).
- **The cloud environments exist on both accounts** (27 Sep): Python 3.13, Node 24, .NET 10.0,
  Postgres (on 5432 in the cloud, not 5544) and LibreDWG 0.14 all ok; the LibreDWG release asset did
  not download in the setup script, so it built from source within the time budget; the TypeSafe
  credential returned 422 on an empty body (likely attached; a real-body 200 would confirm). The rest
  of the first-session checklist (§6.5) needs 01a merged.
- **The cloud credit** ($500 across two accounts) reportedly expires on 4 Nov 2026 (secondary sources).
  Waves 1–4 are cloud-heavy so it is spent, not saved.
- **No real GPU number on the reference setup is recorded** (the owner said the prototypes "hold up";
  figures not captured). Ticket 25 (#38) records them.
- **Nothing proves reading an unseen consultant's drawings yet.** M0 runs on the Development Sets
  only; M1 needs one Held-out Set before it closes (the owner is obtaining it), M4 a real revision pair.
- **The session-01 prototypes** (private, `.private/work/session-01/proto-*`) are throwaway references;
  their decisions are written in the committed design docs. Never copy their code wholesale.

## The finish line of this session
1. **Wave 0 merged:** #1 01a backend skeleton (first), then #2 01b web scaffold, #3 01c toolchain CI,
   #4 01d cloud setup and database roles. All `local`. CI green on an empty product; a wrong import
   fails `lint-imports`; `CLAUDE.md` gains the build and test commands.
2. **The ruleset set** (if GitHub Pro is bought) and **the cloud first-session checklist** run on both
   accounts, with its eight answers recorded in the M0 milestone issue.
3. **Wave 1 launched and reviewed:** the four cloud-built tickets (#5 02 tenancy and #8 05 vx-score,
   `cloud`; #6 03 app shell and #7 04 DWG reader, `cloud+local`) and the two `local` ones (#9 06a the
   `real-drawings` command, #10 06d1 the Edison key at sheet level), each ending in a PR the owner
   reviews by evidence. Measure: cost per merged PR, time to PR, the owner's review minutes, second
   continuations. Widen only if ADR 0025's gates hold.
4. **The owner's parallel work:** 06c (#39) the Sample Project's key from its generating inputs (the
   owner, or a throwaway session outside the repo), 06d1 (#10) the Edison key at sheet level.

## How to run it
- **Each ticket:** `/implement`, then `/tdd`, then the fast check, then `/code-review`, then a PR that
  closes the issue and **leads with what was not verified**. Only the owner merges; the guard refuses
  agent merges and agent-posted statuses.
- **Waves:** `cloud` tickets launch one `claude --cloud` each (about two-thirds on account B); the
  Workflow tool only launches unattended `local` tickets, with no state of its own (ADR 0025).
- **Engine PRs** need the `real-drawings` status; until 06e's first run it is not required, and those
  PRs say "not measured on real drawings".
- **UI PRs** pass the design gate: `ux-critic` on the seeded demo project at 1440×900 and 1280×800,
  against `screens.md` and `m0-screens.md`.
- **Ask one question at a time, recommendation first.** Push only with the owner's yes, every time
  (session 01 pushed once without asking; it must not happen again).

## Law in force
- Secrets are never printed or written. Real drawings stay in `.private/`; only conventions and counts
  leave it. Never read `~/vextrus-cad` or the key user's home; the guard refuses privilege raising,
  recursive deletes, the key user's name and the scorer anywhere in a command (write such text with
  the Write tool).
- OpenConstructionERP is AGPL: learn, never copy. No proprietary converter is ever run.
- The product's word is **Rebar**. Money and quantities group in lakh and crore; coordinates never.

## Suggested skills
`implement`, `tdd`, `diagnosing-bugs`, `codebase-design` (for 01a's anatomy), `real-drawings` (engine
tickets), `product-review` and the `ux-critic` agent (UI tickets), `/code-review`, `wizard` (owner steps:
the GitHub App for the status, 06c).

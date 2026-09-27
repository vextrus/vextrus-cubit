# Session 03: build M0, wave 0 and wave 1

You are the orchestrator of the first build session of the new Vextrus. Session 01 (26 Sep 2026)
grilled the plan; session 02 (27–28 Sep 2026), the final grill, settled what Vextrus is and redrew
everything around it: the product is the **Live Model** (ADR 0035), every discipline including MEP is
read into it (ADR 0040), markets are data from the first line (ADR 0038), and the build targets Python
3.14 and PostgreSQL 18 (ADR 0034). The M0 plan was revised, attacked by four reviewers and re-signed
under the owner's delegation; the issues were re-cut. **This session builds.** Effort is `high`; small,
fully specified `cloud` tickets may run at `medium` as each issue says.

## Read first, in this order
1. `CLAUDE.md`, then `docs/intent.md` (the final intent) and `docs/sdlc.md` (how we build).
2. `docs/plans/M0.md` (revised in session 02: its "Session 02 revision" section, the 32 tickets, the
   waves, "Before wave 0", the mapping to the issues, the resolution of every review finding) and
   `docs/specs/M0.md` (revised: stories 91–104 are session 02's).
3. `docs/design/m0-screens.md` (the behaviour spec every M0 screen builds to; rules 1.7–1.10 are new),
   `docs/design/screens.md` (the owner's rulings on every prototype), `docs/design/system.md`.
4. `docs/adr/README.md` (40 ADRs; 0035–0040 are new), `docs/architecture.md` (the module map with
   `live_model`), `docs/data-model.md` (revised), `CONTEXT.md`, `docs/knowledge/lessons.md` (session 02's
   lessons at the end).
5. Only when a ticket needs it: `docs/reviews/session-02-grill.md` (every ruling in the owner's words),
   `docs/research/` (stack-versions, global-markets-foundation, edison-check-session-02,
   dwg-reader-evidence, viewer-2d-fidelity, viewer-3d-budgets, sdlc-waves-and-cloud).

## What is broken, unmeasured or waiting (read before acting)
- **PostgreSQL 18 is not installed locally yet** (only 16 on 5544). 01a needs it: the owner installs it
  from the PostgreSQL apt repository (the command is in docs/research/stack-versions.md) and says its port.
- **The cloud environments are on Python 3.13 and PostgreSQL 16.** They are rebuilt on 3.14 and 18 after
  wave 0 (`apt.postgresql.org` on each environment's allowlist), before wave 1's cloud tickets.
- **ezdxf has no Python 3.14 wheel:** it is built from source (hash-pinned, the one source build the
  sandbox allows) until upstream ships one.
- **The cloud credit** must be claimed on both accounts by 7 Oct 2026 and reportedly expires on 4 Nov;
  waves 1–4 are cloud-heavy so it is spent, not saved.
- **The GitHub ruleset** is set after wave 0 merges; the private GitHub App that posts the
  `real-drawings` status is created before the baseline run; `real-drawings` joins the ruleset after it.
- **M0 has no Answer Keys:** engine PRs are checked for regression by element diff against the last
  merged run (ADR 0030 as amended); the blind scorer and the keys arrive in M1's first wave.
- **Nothing proves reading an unseen consultant's drawings yet.** Session 02's readers took the Sample
  Project through all fourteen steps in three seconds and read **nothing** of Edison until 31 fittings
  (docs/research/edison-check-session-02.md). M1 needs one Held-out Set (the owner is obtaining it), M3
  one with MEP drawings.
- **No real-GPU figure on the reference setup is recorded;** ticket 24 records it with the owner.
- **The session-02 prototypes** (`.private/work/session-02/`: the read, the viewer tools on 5310, the
  component store on 5320, global on 5330, priced on 5340, the MEP read) are throwaway references; their
  decisions are written in the committed docs. Never copy their code wholesale.

## The finish line of this session
1. **The owner's steps before wave 0** done or recorded: PostgreSQL 18 installed; the credit claimed on
   both accounts; the GitHub App created (any time before the baseline run).
2. **Wave 0 merged:** 01a (backend skeleton, settings, ids, i18n settings, Python CI on 3.14 and 18)
   first, then 01b (web scaffold, message catalogues, logical CSS and its lint, canvases fixed left to
   right) and 01c (toolchain CI, cloud setup and database roles, merged with the old 01d), all `local`.
   CI green on an empty product; a wrong import fails `lint-imports`; a market literal fails its scan;
   `CLAUDE.md` gains the build and test commands.
3. **The ruleset set**, the cloud environments rebuilt on 3.14 and 18, and the first-session checklist
   run on both accounts, its answers recorded in the M0 milestone issue.
4. **Wave 1 launched and reviewed:** the four cloud-built tickets (02 tenancy and the Market, 03 app
   shell with formatters and messages, 04 the DWG reader, 06b the engine harness and export) and the local
   06a (the `real-drawings` command, regression only), each ending in a PR the owner reviews by evidence;
   then the baseline run on `main`. Measure cost per merged PR, time to PR, the owner's review minutes,
   second continuations; widen only if ADR 0025's gates hold.

## How to run it
- **Each ticket:** `/implement`, then `/tdd`, then the fast check, then `/code-review`, then a PR that
  closes the issue and **leads with what was not verified**. Only the owner merges; the guard refuses
  agent merges and agent-posted statuses.
- **Waves:** `cloud` tickets launch one `claude --cloud` each (about two-thirds on account B); the
  Workflow tool only launches unattended `local` tickets, with no state of its own (ADR 0025).
- **Background agents keep a `NOTES.txt` progress log** (an app restart kills them; CLAUDE.md).
- **Engine PRs** carry the `real-drawings` status from the baseline run on; before it, they say "not
  measured on real drawings".
- **UI PRs** pass the design gate: `ux-critic` on the seeded demo project at 1440×900 and 1280×800,
  against `screens.md`, `m0-screens.md` and ADR 0038's rules.
- **Ask one question at a time, recommendation first.** Push only with the owner's yes, every time.

## Law in force
- Secrets are never printed or written. Real drawings stay in `.private/`; only conventions and counts
  leave it. Never read `~/vextrus-cad` or the key user's home; the guard refuses privilege raising,
  recursive deletes, the key user's name and the scorer anywhere in a command (write such text with the
  Write tool).
- OpenConstructionERP is AGPL: learn, never copy. No proprietary converter is ever run.
- The product's word is **Rebar**. Money and quantities group as the Market does (lakh and crore in
  Bangladesh); coordinates never. No market literal in code.

## Suggested skills
`implement`, `tdd`, `diagnosing-bugs`, `codebase-design` (for 01a's anatomy), `real-drawings` (engine
tickets), `product-review` and the `ux-critic` agent (UI tickets), `/code-review`, `wizard` (owner steps:
PostgreSQL 18, the GitHub App, the cloud environments' rebuild).

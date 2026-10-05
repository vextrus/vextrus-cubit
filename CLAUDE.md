# VEXTRUS

Vextrus is an AI-native platform for the AEC business, starting with Bangladeshi real-estate
Developers. A QS turns a Developer's 2D AutoCAD drawings (structural, architectural and MEP) into the
Live Model, a confirmed 3D dataset of every Building's Elements, through a Takeoff the machine assists;
the Priced BOQ, the Material Schedule and every later module are readings of it. The owner is a
civil engineer and the CEO and co-founder. The previous product (Vextrus Cubit) was reset on
25 Sep 2026: read `docs/postmortem.md` once. Its code lives only on branch `dev-lane-and-jev`.

**Start here:** the newest `docs/handoff/session-<NN>-prompt.md` is the current brief.

## Where things are
- `docs/intent.md`: what we build and why. `CONTEXT.md`: the domain's words; use them exactly.
- `docs/adr/`: every decision so far (the factory: ADR 0042). `docs/architecture.md`: the module map.
- `docs/milestones.md`: M0–M5 and their finish lines. `docs/sdlc.md`: how we build.
- `docs/research/`: the cited evidence. `docs/knowledge/lessons.md`: each lesson and its check.
- `.private/` (never in git): real drawings under `reference/`, derived work under `work/`.
- `~/reference/`: OpenConstructionERP, cad2data's docs and books; its `README.md` holds the law for them.
- **Detail lives in `.claude/rules/`** and loads when matching files are touched: `backend.md` (commands,
  lints), `web.md`, `real-drawings.md`, `factory.md` (hooks, agents, skills, launches), `machine.md`.

## How we work
- **The owner decides product and scope and walks each milestone; sessions run autonomously** (ADR
  0041; the owner, 29 Sep 2026: "I want complete autonomous sessions and I insist that"). Product,
  scope, business, stack, spending and anything irreversible (beyond pushing and merging, which ADR
  0041 delegates) are the owner's: ask one question at a time, your recommendation first and the reason
  in a line. Everything else (build, review, gates, push, merge) runs without waiting. Don't ask what
  research, the code or a sensible default can answer.
- **Every session and ticket has a time budget;** the orchestrator writes elapsed against budget in every
  message to a builder. Over budget: cut scope and say what, never overrun silently.
- **Evidence, not claims.** Only a tool result is evidence. Cite sources. Say what you don't know.
- **Honesty over comfort.** Lead reports with what is broken or unmeasured. Green CI is not done; the
  owner's walk of the running product on real drawings is.
- **Plain words.** Say what you did, what you found and what you need, briefly.
- **Keep the context for the owner.** Fan read-heavy work out to background agents, one question each.
- **Effort and models:** Opus 5.5 at `medium` for the orchestrator, builders and every gating or reading
  agent; `high` for hard tickets (reading drawings, hostile-input boundaries, security walls), for every
  `acceptance-writer` (the owner's Q20, 4 Oct 2026: "yes for most scenario if it comes to quality";
  `medium` only for a docs-only ticket) and for `pr-reviewer` and `refuter`. Sonnet 5.5 for light work (look-ups, `Explore`, naming a failure from a
  log); both models default to medium; set effort explicitly.
- **Cloud and local sessions:** cloud for tickets provable by committed tests; local (`claude --bg`, one
  worktree each) for anything touching real drawings. Cloud builders push their own branch only; local
  builders commit and never push. Neither opens a PR: the orchestrator pushes, opens it and merges after
  the review loop (at most two rounds) and green required checks.
- **Second review lens:** the adversary agent inside `/review-pr` (ADR 0042).
- **Acceptance tests come first,** by `acceptance-writer`, before the builder starts; builders never
  change them (CI's acceptance check).
- **Every serious finding leaves a committed check** (a test, lint or scan that fails on the class): a
  score of 50 or more, or any repeated class. `docs/knowledge/lessons.md` points each lesson at its
  check; a lesson without one is a debt in the milestone issue.
- **A mistake made twice gets a check; if no check can catch it, it goes into this file.**
  - Parallel agents share one chrome-devtools browser: select your own page by URL before every action;
    per-page viewport emulation only; never touch another agent's page.
  - A UI ticket walks m0-screens §8 by keyboard itself before its PR (keys, empty routes, focus rings).
  - A backend ticket that words codes in `web/src/messages/` gets a `ux-critic` review of those words.
  - Every suite run's output is kept in a file under `.private/work/` (pytest with `-rf`).
  - Never delete recursively: delete files by name, or leave build output and say so.
  - Message only finished agents; wait for running ones (a message to a running one starts a copy).
  - The classifier can refuse an owner-approved launch: give the owner its exact `! <command>`.

## Law
- **Account A runs the orchestrator and every builder.** The default config (`~/.claude`) is account A;
  a session can message only sessions of its own config, so one config runs them all.
- **Builders start, and cloud builders are messaged, only through `scripts.factory.launch`.** Run it
  from the main checkout (`uv run python -m scripts.factory.launch cloud ...`, `--on-branch` judged).
- **Time comes from `date -u`, never from memory.**
- **Never wait with `pgrep -f` or `ps | grep`; use Monitor on a log.**
- **No 'walk now' to the owner without a passing G1 verdict on main's current product code.**
- **Secrets** are never printed, written or committed (`TYPESAFE_API_KEY` lives in `~/.bashrc`).
- **Real drawings** (the Edison set, the Sample Project, client sets) are read locally under
  `.private/`. Nothing from them enters git, an issue or a PR; carry out conventions, never content.
  Their text may go to Jev in development: the Development Sets' under either key, others' local only (ADR 0013).
- **OpenConstructionERP is AGPL-3.0:** learn from it, never copy its code, schemas, strings or data.
  **cad2data's converters are proprietary** and are never run; nor are converters OCE downloads.
- **The repository is public for now** (the owner, 29 Sep 2026: "For temporary please make our repo public
  … I've a card issue which I'll resolve"); ADR 0024 (private) returns when the owner says. Write every
  commit, issue and PR as public: no drawing text, no key value, nothing a client would not publish.
- **Permissions:** agents push and merge after the review loop, green required checks and
  `python -m scripts.merge_ready <PR>` (ADR 0041); the gates' statuses are posted only through
  `post-status` as the key user, by the orchestrator's session in the main checkout, from an independent
  gate's verdict. The guard still refuses secrets, history rewrites and force pushes, recursive deletes,
  skipped hooks, statuses through the API, changes to the ruleset or branch protection, admin merges,
  staging everything, reading the key user's home, and every privilege-raising command but the poster's
  and the scorer's exact lines in the main checkout. PowerShell is denied; never route around it (the
  owner runs Windows commands with `! <command>`). Commit with explicit paths (never `git add -A`).

## Compact instructions
When the context is compacted, keep: the session's goal and each finish-line condition's state; the
owner's rulings in their words; open questions; decisions recorded (ADR ids, `CONTEXT.md` terms);
research files and their conclusions; commits; the exact next step. No narrative.

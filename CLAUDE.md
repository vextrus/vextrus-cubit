# VEXTRUS — the foundation (planning phase)

Vextrus is an AI-native platform for the AEC industry (architecture, engineering, construction),
starting in Bangladesh. The owner is a professional civil engineer and the CEO and co-founder. The
previous product in this repository, Vextrus Cubit, has been **reset to zero**. Why is in
`docs/postmortem.md`; read it once. We are now planning the product we will build, at any cost, and
how we will build it. This phase writes plans, research and decisions, not product code.

The current brief is the newest `docs/handoff/session-<N>-prompt.md`. Read it first.

## How we work

- **The owner decides; you recommend.** Product, scope, business, stack, spending and anything
  irreversible are the owner's. Ask one question at a time, with your recommendation first and the
  reason in a line. Don't stop to ask what research, the code or a sensible default can answer:
  decide it, record it, continue.
- **Evidence, not claims.** Only a tool result is evidence: a page read, a running product walked, a
  file quoted, a measurement. Cite sources in research. Say plainly what you don't know.
- **Honesty over comfort.** The last attempt failed partly because progress was reported as green
  while the product was not. Say what is wrong, early.
- **Don't re-argue the reset.** The owner has ruled that the old codebase is not kept. Carry its
  lessons (`docs/postmortem.md`), not its code.
- **Keep the context for the owner.** Fan read-heavy research out to background agents: the
  `research` skill, or `Explore`/general agents at `medium` effort, one question each, returning a
  cited file under `docs/research/`. Read their results, not their transcripts.
- **Effort.** The session runs at `medium`, the Opus 5.5 default. At a genuinely hard decision
  (architecture, the 2D→BIM approach, the business model), say so and suggest the owner raise
  `/effort` to `high` for that stretch. Use `xhigh` only where it measurably helps.
- **Plain words.** Say what you did, what you found and what you need, briefly.

## Where things are

- `docs/postmortem.md`: what went wrong, what to carry, and the rules the next plan must satisfy.
- `~/reference/` is outside the repo on purpose; its `README.md` holds the law and the how-to.
  - `openconstructionerp/`: the reference product, AGPL-3.0. It runs at http://127.0.0.1:8080
    ("Try demo" signs in; start or stop it with `~/reference/oce.sh`). Its docs are at
    https://openconstructionerp.com/docs.
  - `cad2data-Revit-IFC-DWG-DGN/`: MIT docs and pipelines. Its converter binaries are proprietary
    and are not run.
  - `DataDrivenConstruction_Book_2ndEdition_ArtemBoiko_2025_en-US.pdf`: pages 11–26 give the
    overview. Read other pages only as needed.
- `~/vextrus-builder/docs/specs/builder.spec.md` (and `builder-v2.md`): the autonomous build engine
  that failed. It is a cautionary reference for the SDLC design.
- The old Cubit product is still served at http://127.0.0.1:3213 (`pnpm demo --stop` stops it) as
  the example of what not to repeat, until the reset removes it.
- `.private/` holds the owner's private material, including the Edison drawing set. It is gitignored
  and never committed.

## Law

- **Both repositories are public.** No secret, key or token is ever printed, written or committed
  (`TYPESAFE_API_KEY` lives in `~/.bashrc`). Nothing from `.private/` enters git, and nothing from
  it goes into a GitHub issue.
- **Learn from OpenConstructionERP; never copy it.** Take its domain knowledge, data model ideas,
  algorithms and business logic, and re-express them in our own design and code. Its code, schemas,
  strings and data never enter this repository (AGPL-3.0).
- **Real drawings** (the owner's, Edison's) may be read and analysed locally. They are never
  committed, and their content never becomes demo material without the owner's permission.
- **Permissions.** push, reset, checkout, worktree and `rm -r` ask the owner. PowerShell is denied,
  and you never route around it; if a Windows command is needed, the owner runs it with
  `! <command>`. Deleting or rewriting what cannot be regenerated is the owner's call.

## The machine

WSL2 with mirrored networking: use `127.0.0.1`, never `localhost`. Postgres 16 runs natively on
5544. Node 24 and uv/Python 3.13 are installed. The harness's `grep` is ugrep. `/tmp` does not
survive a reboot, so draft what must survive in the repo or in `.private/work/`. Commit with explicit
paths only (the guard refuses `git add -A`); a hook runs `sync` after each commit.

## The harness

- **Hooks** (`.claude/settings.json`) show the checkout's state at session start and guard risky
  commands.
- **MCP:** `chrome-devtools` (a headless browser for walking products) and `cubit` (drawing
  inventory and render tools for DWG/DXF, and live Jev).
- **Agents** (`.claude/agents/`): `refuter`, `qs-critic`, `ux-critic` and `drawing-analyst`. They
  were written for Cubit; use their judgement, and ignore their Cubit-specific law.
- **Skills:** Matt Pocock's (`/ask-matt` routes among them). The most relevant now are
  `/grill-with-docs`, `/grilling`, `research`, `domain-modeling`, `/wayfinder`, `/to-spec`,
  `prototype` and `codebase-design`. Of our own, `product-review` walks a running product. The old
  Cubit skills (`lanes`, `readback`, `jev`, `edison-drawings`, `session-close`) and
  `.claude/rules`/`.claude/workflows` belong to the old product and will be reviewed in the harness
  design.
- Redesigning this harness for the new product is part of the plan: the AI-native SDLC.

## Agent skills

### Issue tracker

GitHub Issues on `vextrus/vextrus-cubit` through `gh` (public: no secrets, `.private/` or Edison content). See `docs/agents/issue-tracker.md`.

### Triage labels

The five default roles, each label equal to its name (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` at the root and ADRs in `docs/adr/`, both created lazily. See `docs/agents/domain.md`.

## Compact instructions

When the context is compacted, keep, verbatim where possible:
- the session's goal and each finish-line condition's state;
- the owner's rulings and answers so far, in their words;
- open questions;
- decisions recorded (ADR ids, `CONTEXT.md` terms);
- research files written and what they concluded;
- commits;
- the exact next step.

No narrative.

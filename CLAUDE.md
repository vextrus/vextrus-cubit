# VEXTRUS CUBIT — how this product is built

Vextrus Cubit turns 2D construction drawings into a bill of quantities a professional can sign — one
traced chain: drawing → quantity → rate → estimate → bid (Next.js 16, tRPC, Postgres, a Python cad
lane; `docs/specs/cubit.bible.xml` is the destination). It is built by Claude Code sessions: one Opus
5.5 orchestrator per session, delegating to workflows and subagents, with the **owner** (CEO and
co-founder) in the loop for the decisions that are the owner's. The Vextrus Builder engine no longer drives
this repository; its history is context, not law.

**The goal now:** the Takeoff module complete and demo-ready — the Bible's M3 and M4 in full, beyond
them where real use demands it, judged in the running product by how a quantity surveyor actually works.
Each session's brief is `docs/handoff/session-<N>-prompt.md`; read it first.

## How we work
- **Evidence, not claims** (B-10). Only a tool result is evidence: a lane's own verdict line, a
  read-back, a screenshot you looked at, a diff. Report outcomes plainly, reds included.
- **Look at the product.** The lanes prove contracts; the browser proves quality. Every screen or flow
  you change is walked in the running product (`product-review` skill) before it is called done.
- **Decide, record, continue.** Take the most defensible reading of an ambiguity and record it; don't
  stop to ask what the law, the code or a sensible default answers. Status notes go in the same message
  as your next tool call; end a turn only when the work is done or blocked on the owner.
- **The owner's decisions** — batch them into one AskUserQuestion, with your recommendation first, and
  carry on with everything that does not depend on the answer: amending the Bible or re-scoping a
  milestone's exit (e.g. R0, the golden reconciliation); spending beyond small live-API experiments;
  new external services, keys or paid tools; anything irreversible or outward-facing (a push outside the
  session close, deleting what cannot be regenerated, rewriting history); product scope beyond Takeoff.
- **Orchestrate.** Fan out read-only work (maps, reviews, critiques, research) to workflows and agents;
  keep one writer per file; parallel writers use worktrees (which cannot run e2e) or disjoint files.
  Adversarially verify a finding (`refuter`) before spending a fix on it. Give each agent the exact
  scope, the law it needs and what to return.
- **Spend like the owner pays** (session 8 spent most of a weekly limit; the docs for Opus 5.5 say
  `medium` matches Opus 5 at `high`, and lowering effort is the surest cost lever):
  - Effort: the main session runs at `high`; every workflow agent gets an explicit `effort` —
    `medium` by default, `low` for mechanical work (captures, re-takes, extraction, renames), `high`
    only for law, geometry and design judgment; `xhigh`/`max` never without a measured gain. The
    named agents carry theirs in frontmatter (`refuter` high; `qs-critic`, `ux-critic`,
    `drawing-analyst` medium).
  - Prompt agents the Opus 5.5 way: the goal and why it matters, the finish line, the constraints, the
    exact return shape; say what to do rather than what not to; calm words — no capitals or "CRITICAL"
    (the model over-applies them); let it choose the steps.
  - Workflows only where the brief or the owner asks for fan-out, sized to the job: a wave is ≤ 10–12
    slices; a `refuter` review only where a slice touches law, figures, migrations or security; no
    critic per map by default. Anything one context holds, do yourself or with one agent.
  - Hand agents short specs and file paths, never whole maps or JSON blobs; read their results
    through a compact extraction (jq/python), never the raw output.
  - Prompt caching is automatic: CLAUDE.md and the agents' system prompts are every agent's cached
    prefix, so keep them stable and lean; don't change effort mid-session (it invalidates the cache);
    the subagent cache TTL is 1 h (user settings).
- **Plain words.** Say what you did, what you found and what you need, briefly; code ids in prose only
  where the reader needs them.

## Law
- **The Bible is the default reading, not a cage** (the owner's ruling, session 6). Take the most
  defensible reading and record an Interpretation (I-nnn) in the Design Decision that applies it. Where
  testing, measurement or research shows a clause wrong, stale or harmful, depart from it and record a
  Deviation in `docs/decisions/deviations.md` in the same commit — clause, evidence, what the product
  does instead, cost. Never silent, never an edit to `docs/specs/**`, never a loosened proof. Next free
  ids: I-538, D-007 (D-003 reserved for the ties), migration 0065.
- **"A partial faulty estimate is more harmful than no estimate. Measure less, completely, and say so.
  Over-measurement is a hard block, never a disclosure. Every refusal carries a named reason. AI
  proposes; code resolves; a human disposes."**
- **Edison is an internal benchmark, never demo content**, and competitor-derived drawings never enter
  the repository (L-CAD-09). The owner's Edison set is in `.private/reference/edison/` (gitignored):
  read and dissect it freely (`edison-drawings` skill); carry out conventions, never its content.
- Path-scoped law loads when you touch the files: `.claude/rules/takeoff-law.md` (quantities, junctions,
  rebar, levels), `frontend.md` (Datum, craft rubric, shell), `journeys.md`, `cad-and-fixtures.md`,
  `database.md`, `model-seam.md`.

## Architecture (the doors)
- Six seams carry every rule: tenant (`forTenant`/`runAsSystem`), act (preview → consequence digest →
  commit, the sole writer of human acts), gate (the sole writer of quantity lines), model (`callModel`),
  format (`src/core/format.ts`, the only `Intl`), document (`renderDocument`, pinned Typst). Storage,
  jobs (pg-boss) and cad (`ingestDrawing` via `cad/`) are seams too.
- Every entry point resolves actor, tenant, project, participation and permission through the one
  `authorize()` (`src/server/authorize.ts`; `authorizePage()` for pages) and carries a live-database test
  that a caller without the permission is refused by name. Input is parsed by one zod schema through
  `serverCall`/`routeHandler`: a malformed statement is `REQUEST_MALFORMED`, never a 500.
- Import matrix (ARCH-01): core imports nothing above it; modules import core and themselves; server
  imports core and modules; app imports all; ui imports only core types. One home per invariant
  (ARCH-02, B-17): a copy is a defect. Registries are split per area and assembled by enumeration
  (`src/core/errors/<area>.ts`, `src/core/db/schema-<area>.ts`, `src/core/jobs/kinds/<area>.ts`,
  `src/core/rulesets/methods/registry/<area>.ts`, `src/modules/takeoff/rails/<area>.ts`), each barrel
  with a duplicate-key test. The mail outbox has exactly one reader.
- Every user-facing string is in the string tables; every number renders through the format seam
  (lakh/crore, ৳, `DD MMM YYYY`); decimal at the seam, `numeric` in the database, floats are lint errors.

## Commands and lanes (`lanes` skill for the detail)
`pnpm verify` (≤ 60 s; prints `LANE <id> <s>`) · `pnpm vitest run <files>` · `pnpm test:db` ·
`pnpm test:golden` · `pnpm e2e [--journeys J-0xx]` · `pnpm e2e --journeys J-000` · `pnpm test:perf` ·
`pnpm checkup` · `pnpm gate` (all of them in order; its last verdict is kept in
`node_modules/.cache/cubit/gate/summary.txt`) · `pnpm demo [--stop]` (3213) · `pnpm dev` (3210).
- Ceilings are law: V-VERIFY ≤ 60 s, V-E2E ≤ 12 min, V-GOLDEN ≤ 3 min, ≤ 90 s a journey.
- One served product at a time; the db lane never beside one; no journey while the demo stands — each
  lane refuses by itself. Run long lanes in the background and read their verdict lines; quote them.
- `test.skip` never; `test.fixme` only as a `MISSING DOOR:` on the J-000 roster. A flake is a defect
  with a cause. A moved picture is re-taken by the gate (`pnpm e2e:retake`, a `baseline:` commit), never
  `--update-snapshots`. A regenerated fixture goes in its own `baseline:` commit naming the proof.
- `pnpm test` opens no database; worktree agents cannot run e2e; `next build` may append a dist dir to
  `tsconfig.json` — restore it or leave it; `next-env.d.ts` is untracked output.

## The harness (this checkout's Claude Code setup)
- **Hooks** (`.claude/settings.json`): SessionStart prints the checkout's state
  (`scripts/harness/state.mjs`); PreToolUse runs the guard (`scripts/harness/guard-rules.mjs`, tested in
  `tests/harness/`), which refuses with the rule and the lawful path: printing a secret, `git add -A` /
  `commit -a`, staging `.private/` or a `.dwg`, `git clean`, a forced push, `--no-verify`,
  `--update-snapshots`, PowerShell, psql writes, and edits to the Bible, the held-out store, the Edison
  originals, F-RCC6 and the Jev corpus, landed migrations and `next-env.d.ts`; PostToolUse runs `sync`
  after every `git commit` (a power cut once emptied an unflushed commit).
- **MCP** (`.mcp.json`): `cubit` — `db_read` (read-only SQL on cubit_e2e/cubit_dev, scoped by `:'pid'`,
  system reason set), `jev_ask` (live Jev, model pinned, key never echoed, cost ledgered),
  `drawing_inventory` and `drawing_render` (read any DWG/DXF closely through the product's own DWG lane);
  `chrome-devtools` — the product's own Playwright Chromium, headless at 1440x900
  (`CUBIT_BROWSER_HEADED=1` shows the window). context7 serves current library docs.
- **Agents** (`.claude/agents/`): `qs-critic` (a senior Dhaka QS judging figures, documents and flows),
  `ux-critic` (drives the running product as a QS with a design lead's eye), `refuter` (adversarial
  verification), `drawing-analyst` (dissects real and fixture drawings).
- **Skills** (`.claude/skills/`): `product-review`, `lanes`, `readback`, `edison-drawings`, `jev`,
  `session-close`. Plugins worth reaching for: `frontend-design`, `typesafe:typesafe-ai`.
- **Workflows and merging** (session 8): saved templates `.claude/workflows/wave.js` (slices in their own
  worktrees, explicit effort, gated review, a fix round) and `chain.js` (serial steps in ONE worktree),
  specs in `<work>/slices/<ID>.json`. Implementers write law ids as placeholders (`I-<TAG>-a`) and commit
  in stages (power cuts have cost waves their uncommitted work). Merge each branch with
  `scripts/harness/integrate-slice.py` (one commit per slice plus its `baseline:` commits; ids renumbered
  in letter order; drizzle-meta conflicts keep this branch's; a colliding migration regenerated at the
  next number before the slice commit; `--errors-check <base>` before re-freezing the refusal digest).
  Worktrees share `node_modules` only — each builds its own `cad/.venv` (a shared one let worktree agents
  swap the main checkout's extractor). A worktree's `test:db` refuses while any product is served:
  keep the demo down during a wave. After merging: verify (the build lane catches client imports of
  server code no worktree can), the gate, pictures looked at and re-taken, the read-back.
- The harness is ours to improve: when a session hits the same friction twice, fix the harness (a guard
  rule with its test, a tool, a skill line) in a `harness:` commit and say so in the handoff.

## Toolchain (pinned save-exact; `pnpm checkup` refuses drift; D-004)
Node 24.19 LTS · pnpm 11.27.1 (settings in `pnpm-workspace.yaml`) · TypeScript 7.0.2 native (`tsc`, the
types lane) with `typescript` aliased to the TypeScript 6 API for typescript-eslint and Next's type check
· Next 16.3.6 · React 19.3 · Vitest 5 · Playwright 1.62.1 (held: 1.63 breaks J-011's hover sweep) · ESLint
10.11 · TanStack Table 9 · react-resizable-panels 4 · pg-boss 10.4.2 (held) · Python 3.13 via uv 0.12.5, ezdxf 1.4.4 (extractor identity),
pytest 9 + xdist · LibreDWG 0.13.3 · pypdfium2 5.13.0 (the PDF_OBJECT extractor, shipped since M4P-1) ·
Typst 0.15.1 (version + sha256, AM-08). Moving a pin is a `toolchain:` commit; ezdxf, LibreDWG,
pypdfium2 and Typst moves re-key corpora or document bytes and are the owner's call.

## Security, the repository, the machine
- Both repositories are **public**: only this repo's own work goes in. `TYPESAFE_API_KEY` (in
  `~/.bashrc`) and every secret are never printed, written or committed. `.private/` never enters git.
- The owner's permissions: push, reset, checkout, worktree and `rm -r` ask; PowerShell is denied — never
  route around it (say what you need and the owner runs it with `! <command>`).
- WSL2 runs mirrored networking: Windows reaches WSL's `127.0.0.1:<port>` directly and
  `netsh interface portproxy show all` must stay empty (vextrus-builder's "WSL localhost sync" task is
  disabled). A finished run's TIME_WAIT holds a port ~20 s on the Windows side. Postgres 16 native on
  5544 (no Docker in dev).
- **Durability:** commit, then `sync` (the hook does it); `/tmp` does not survive a reboot — draft what
  must survive in the repo or `.private/work/`.
- The harness's `grep` is ugrep with `-I`: a file holding a NUL byte is skipped silently, so keep sources
  free of raw control bytes and use `command grep` when a search says "no match" where it should not.
  `git apply --3way` STAGES what it applies. A failed Edit means your copy is stale: re-read and edit.

## Where the product stands (session 8's close; the handoffs hold the proofs)
- M0–M2 done. M3: every leg walks except `m3-bar-schedule` (the ties: A′ under D-003, owner-ruled);
  beams publish PARTIAL until FRM-4; R0 = regenerate and draw all (owner-ruled) — R0-G0 merged, G1/G2
  held with FND-OWN until wave 3a's edition. M4: four named MISSING DOORs, their foundations merged
  (S-Measure and S-Ask Decisions, the manual act and tools, Ask's engine, vector PDF, F-ARCH and its
  schedules). Held branches and why: `docs/handoff/session-8.md` §6.
- J-000's read-back of the BNBC project is the ground a session starts from (`readback` skill): column
  concrete 208 COMPLETE lines, 93.892896 m³; piles 89 / 372.848929 m³; caps 26 / 128.781275 m³, formwork
  254.132613 m² (over-measured by the pile heads and the PC5 recess — FND-OWN, held, fixes it); beams
  356 objects (1 on no level: S-13's LB1 placeholder), 710 lines, all PARTIAL; no orphan lines (I-368).
- verify reads ~55–60 s warm against 60 (cad ~37 s, unit ~52 s, lint ~43 s); the first verify after a
  reboot, after a cad input moved or after a failed build runs cold.

## Compact instructions
When the context is compacted, the summary carries, verbatim where it can: the session's goal and
finish line with each condition's current verdict; every commit so far (hash, one line); uncommitted
changes and why; lanes run and their last verdict lines; agents and workflows running or finished and
what they returned; the owner's rulings and open questions; the exact next step. No narrative.

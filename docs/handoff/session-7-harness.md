# Session 7's extension — the harness, the toolchain, a clean tree (2026-09-23, evening)

The owner asked, after session 7's close and before session 8: build the most balanced, non-over-
engineered and powerful Claude Code harness around this product for Opus 5.5 sessions; move the
environment to the latest stable versions (TypeScript 7 named) without deprecated tools; copy the Edison
DWG set in for session 8 to dissect; plan deeper use of Jev (with a system-two partner where it helps);
read the whole Bible; rewrite CLAUDE.md; write the session-8 brief around one goal — the Takeoff module,
finished and demo-ready beyond M4, judged in the browser; remove the owner's obsolete untracked files;
end on a clean, pushed tree.

## What was done (commit → what)

- **18b689ab toolchain** — TypeScript 7.0.2 native as the types lane's `tsc` (the tree in ~2.4 s cold,
  0.6 s incremental, against 14.8 s on 5.9.3) beside `typescript` aliased to `@typescript/typescript6`
  (compiler 6.0.3) for typescript-eslint, Next's build check and the API readers; `baseUrl` dropped; two
  real TS 7 findings fixed. pnpm 11.27.1 (`pnpm-workspace.yaml`), Next 16.3.6 (three security releases
  since 16.3.1), React 19.3.0, Vitest 5.0.1 + Vite 8.3.0, ESLint 10.11, typescript-eslint 8.70.1, zod
  4.6.5, tRPC 11.19, every dependency save-exact. TanStack Table 9 (DataTableColumnDef; DOM unchanged)
  and react-resizable-panels 4 (sizes as `%`, useDefaultLayout behind server-safe storage), both
  migrated by agents with their Design Decisions amended. The cad lane on six pytest-xdist workers
  (pytest 9.1.1, ruff 0.16.8): LANE cad ~36 s inside verify, from ~50. D-004 records it all.
- **db0927e9 baseline** — the register JSON schema re-taken under zod 4.6.5 (same shape; `type
  [string, null]` for `anyOf`), declared as a lawful re-baseline in **98ca9d0d**.
- **b41eac71 lanes** — `pnpm test:db` and `pnpm e2e` refuse beside a served product by themselves (the
  gate did; a standalone lane did not); the gate keeps its last verdict in `summary.txt`.
- **77b62994 harness** — the guard hook and its 30-test proof, the session-state hook, commit-then-sync,
  the `cubit` MCP (db_read, jev_ask, drawing_inventory, drawing_render), the `chrome-devtools` MCP on the
  product's own Chromium, agents (qs-critic, ux-critic, refuter, drawing-analyst), skills (product-review,
  lanes, readback, edison-drawings, jev, session-close), path-scoped rules, `.gitignore` for `.private/`.
- **70d67aa7 toolchain** — Playwright holds at 1.62.1: on 1.63.0 J-011's hover sweep meets nothing under
  the pointer. Bisected: J-011 green on 1.62.1 with every other move in place; red on 1.63.0 with either
  Chromium; the panels (v2 restored), zod (4.4.3) and Next (16.3.4) each left it red. The product is not
  at fault; the cause in the runner is owed before the move (session 8, a small toolchain item).
- **ef3c5a98 toolchain** — the lint lane ignores `.scratch/` and `.private/` (ignored working space):
  this session's own repro scripts and unzipped traces there turned gate 2's verify red.
- **(the docs commit)** — CLAUDE.md rewritten whole; the session-8 brief; this note.

Not moved, on purpose: pg-boss (10.4.2 is npm's maintained `maint-v10`; v12 cannot migrate a v10 schema
and would rewrite the security-reviewed queue installer), ezdxf / LibreDWG / Typst (corpus and document
identity), pnpm 12 (a days-old Rust rewrite that downloads a native binary), Node (24.19 is the LTS line).

## Evidence

- `pnpm verify` on the toolchain commit: LANE types 0.60 s · lint 39.19 s · unit 44.52 s · cad 35.83 s ·
  build 8.30 s · **verify wall-time 53.01 s**, exit 0. `pnpm checkup` green on the new pins.
- Gate 1 (77b62994): db green 96.44 s (241 files / 1,465 tests, then the breaker 1 / 2), golden, checkup,
  J-000 (12 legs, 220 s) and perf green; verify red on AC-3 (fixed, 98ca9d0d); e2e red on J-011 alone,
  52 of 53 journeys green and every design picture inside tolerance (→ 70d67aa7).
- Gate 2 (70d67aa7): `GATE summary — verify: RED exit=1 46.97s · checkup: green 0.73s · golden: green
  2.06s · db: green 95.97s · e2e: green 100.22s · e2e-j000: green 234.50s · perf: green 18.85s` — e2e 53 of
  53 with J-011 green on Playwright 1.62.1; verify's red was lint over `.scratch/` (unit 566 files / 3,836
  tests green; lint 0 errors / 158 warnings once the scratch was ignored) → ef3c5a98.
- **Gate 3 (ef3c5a98), the final gate: every lane green.** `GATE summary — verify: green 51.59s · checkup:
  green 0.73s · golden: green 2.09s · db: green 93.38s · e2e: green 99.35s · e2e-j000: green 237.34s · perf:
  green 21.06s` — `GATE wall-time 505.59s exit 0`; `verify wall-time 47.51s` (types 0.72 s, cad 35.49 s,
  lint 39.22 s, unit 44.34 s over 566 files / 3,836 tests, build 2.98 s); e2e 53 / 53; J-000 12 / 12.
- The MCP tools, live: a scoped read-back of project bfc66e0b (172 beams, 208 columns, 89 piles, 26 caps);
  Jev `noul` 0.95 in 531 ms for $0.0000128 and 0.97 in 696 ms (ledgered in
  `node_modules/.cache/cubit/harness/jev-calls.jsonl`); the Edison structural set inventoried in ~12 s
  through the product's own DWG lane and a window of it rendered legibly; the browser server on
  HeadlessChrome at 1440x900 with 29 tools and a screenshot written.

## Decisions taken in the owner's absence (each reversible)

- **The Edison set** lives in `.private/reference/edison/` (gitignored, guarded): L-CAD-09 bars
  competitor-derived drawings from the repository and the thesis names Edison an internal benchmark,
  never demo content, while B-24 and the owner want it in the tree for sessions. Conventions leave
  `.private/`; content never does. The owner may rule otherwise (session-8 brief §4.5).
- **The marketplace chrome-devtools plugin is disabled for this project** (it looks for Google Chrome at
  `/opt/google/chrome`, which this machine lacks); the project runs the same server pinned, on
  Playwright's Chromium. Re-enabling it is one line in `.claude/settings.json`.
- **The 30 session-7 agent worktrees were removed** (2.8 GB; every branch was already in HEAD and was
  deleted with the safe `-d`). Each worktree's uncommitted diff was saved first to
  `.private/work/worktree-leftovers/<name>.patch`. The engine's own `inc/*` branches and its registered
  worktree under `~/vextrus-builder-work/` were left alone.
- **The owner's leftovers were removed at the owner's word**: `.agents/`, `.idea/`, `.junie/` (its
  tracked skill copy through `git rm`), `AGENTS.md`, `cov.html`. `/.idea/` is ignored from now on.

## Carried to session 8

- Playwright 1.63: find why J-011's hover sweep reads nothing, then move (D-004).
- The cad regeneration proof digests the index listing plus uncommitted bytes, so identical content reads
  differently once committed: committing a cad input after a green verify costs one extra ~80 s
  regeneration (seen once here). Content-address it (path + blob hash of the working bytes).
- A system-two model in the product needs the owner's `ANTHROPIC_API_KEY` and a Deviation (brief §4.4).
- The first start in this checkout asks the owner to approve the two `.mcp.json` servers (`/mcp` shows
  them); `skillOverrides["code-review"] = "off"` in `~/.claude/settings.json` still hides the
  code-review skill.
- `~/vextrus-builder/docs/design/reference/*.dwg` still hold the originals; `.private/` holds the copies.

# VEXTRUS CUBIT — session notes

This file is maintained by the Vextrus Builder engine; the lessons section is rewritten after
merges. Do not edit it inside a build session.

## Commands that must be green
pnpm verify · pnpm test:db · pnpm e2e --journey <J> · pnpm checkup

## Law
- The Bible (docs/specs/cubit.bible.xml) is immutable in sessions: take the most defensible reading and record an Interpretation; a contradiction stops the increment with a named reason.
- A screen is implemented against its Design Decision in docs/design/<screen>.md — layout, every state, copy, motion, tokens. Deviations are graded as defects.
- Never delete a test or weaken a check to green a build; raise an Objection in the handoff.

## Lawful paths (the hooks enforce these — don't rediscover them by denial)
- Scratch: `mcp__builder__scratch_dir` is the writable directory; `rm -rf` only there and on regenerable output (.next*/, dist/, coverage/, .turbo/, .vite/, *.tsbuildinfo) by relative path.
- Test runs are by name (`pnpm vitest run <files>`); `mcp__builder__check` runs the gate's fast lane in one call; `pnpm verify` once, before the handoff. `.builder-heldout/` is the Verifier's — never read by another role.
- A Bash output over 6,000 chars arrives compacted (head, tail, every verdict line, and the scratch file holding the whole text) — read that file, don't re-run the command.
- Before editing test config, tests/e2e/**, CLAUDE.md or .claude/**: confirm your increment's approved spec owns that path — locked by default, and each attempt costs a denial plus a structural red.
- Read-only roles (reviewer/skeptic/adversary/planner) verify with the allowlist only: git reads, tsc, `vitest run <file>`, pnpm verify/test/checkup, `psql -c` (read-only SQL), pg_isready, curl localhost — never node -e / python3 -c / heredocs.
- The cad lane (Python, uv): `uv run --project cad pytest cad`, `ruff check cad`, `dwgread <f.dwg>` and `dwg2dxf -m -o <scratch>/x.dxf <f.dwg>` are read-only; plain `dwg2dxf` writes beside its input (denied); `-m` is the form ezdxf reads.
- A Verifier-authored file (a binary `.dwg` fixture included) never yields to a Builder or Fixer: say so ONCE as an Objection and build around it; after two denials the engine raises the dispute itself with the toolchain's reading of the fixture.
- The Verifier never `git commit`s — the engine makes the `verifier:` commit; leave the tree dirty.
- Session memory: `~/.claude/projects/-home-riz-vextrus-cubit/memory/<name>.md` (frontmatter name/description/type) by Write or Bash — the one admitted path under `~/.claude/`; harvested after each merge. The rest of `~/.claude/` is locked.
- A debt sweep's worklist is `mcp__builder__debt_rows` (type, location, title per row): fix each where it lives, test beside it. The engine's CLI (`builder …`) is never reachable from a session.
- History is append-only: no amend, no rebase; a landed migration is superseded, never edited; a regenerated snapshot/baseline goes in its own commit whose subject starts `baseline:` and names the proof.
- Toolchain churn (`next build` rewrites tsconfig.json and next-env.d.ts): never hand-edit them; `git checkout main -- tsconfig.json next-env.d.ts` is always allowed (chained too), or leave the dirt — the engine restores them to main's form at the gate and at merge.

<!-- builder:lessons:start -->
## Standing lessons (engine-maintained)
### Locked ground & lawful paths
- cubit ships tsx, so a scratch script can drive server-tier product .ts directly — but it must be .mts or top-level await dies — `package.json`'s `worker` script pulls in `tsx`, so `<repo>/node_modules/.bin/tsx <scratch>/probe.mts` runs a throwaway script that imports product `.ts` by **absolute path** with extensionless relative specifiers resolved for you — no vitest config, no …
- A held-out set reads tenant-scoped rows by loading src/core/db.ts through productModule and chaining forTenant().select().from(table).where(and(eq(...))) under … — Proved from the gate's own mount on that increment (2026-09-06), by temporarily moving the missing-module guard below the reads and watching the dry run walk past them.
### Tests & acceptance
- Repeated gate red met with test edits instead of code fixes — Across several attempts on one increment, the session responded to the same recurring gate red by trying to rename or delete the failing test, weaken an assert, or edit inside tests/e2e — three denials of that shape landed before the increment finally fixed …
- userEvent.setup() overwrites navigator.clipboard with its own stub, so a vi.fn installed in beforeEach has no .mock by assertion time — `@testing-library/user-event` 14.6's `setup()` calls `attachClipboardStubToView(window)` unconditionally (`dist/cjs/setup/setup.js:58`), which does `Object.defineProperty(window.navigator, "clipboard", { get: () => stub })`.
- A new small top-bar occupant did NOT move any committed full-frame baseline — maxDiffPixelRatio 0.002 absorbed it — the job timeline increment added a permanent jobs tray to the top bar and planned re-baselines of `shell-light/dark.png`, `shell-tenant-switcher-open.png`, `shell-user-menu-open.png`, `j-001-auth/*`, `j-002-tenant-admin/*`, `j-003/*`, `s-audit/explorer.png` …
- A TEST_AMENDED ruling can order the Verifier to regenerate a baseline in its own `baseline:` commit — the role's commit hook refuses anyway; generate, prove, … — Hit on the viewer inspector increment (2026-09-05).
### Screens & design
- R-UI-020 binds secondary surfaces too — a tray/list row that says \"Refused\" owes the RefusalState, even when a Decision says that panel shows no refusal card — the job timeline increment shipped a jobs tray whose refused row showed only the status word, following `docs/design/shell-top-bar.md` §1 ("No refusal card, no fault id and no evidence link renders in the panel: a refused job is answered in place, by the …
<!-- builder:lessons:end -->

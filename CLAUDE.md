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
- Test runs are SCOPED: an unscoped runner discovers .builder-heldout/ and recurses. Run the exact files your task names (`pnpm vitest run <files>`), never the whole tree; never read or touch .builder-heldout/.
- Before editing test config, tests/e2e/**, CLAUDE.md or .claude/**: confirm your increment's approved spec owns that path — locked by default, and each attempt costs a denial plus a structural red.
- Read-only roles (reviewer/skeptic/adversary/planner) verify with the allowlist only: git reads, tsc, `vitest run <file>`, pnpm verify/test/checkup, `psql -c` (read-only SQL), pg_isready, curl localhost — never node -e / python3 -c / heredocs.
- The cad lane (Python, uv): `uv run --project cad pytest cad`, `ruff check cad`, `dwgread <f.dwg>` (stdout) and `dwg2dxf -m -o <scratch>/x.dxf <f.dwg>` are read-only; plain `dwg2dxf` writes beside its input — denied; `-m` is the form ezdxf reads.
- A Verifier-authored file (a binary `.dwg` fixture included) never yields to a Builder or Fixer: say so ONCE as an Objection and build around it; after two denials the engine raises the dispute itself with the toolchain's reading of the fixture.
- The Verifier never `git commit`s — the engine makes the `verifier:` commit; leave the tree dirty.
- Session memory: `~/.claude/projects/-home-riz-vextrus-cubit/memory/<name>.md` (frontmatter name/description/type) by Write or Bash — the one admitted path under `~/.claude/`; harvested after each merge. The rest of `~/.claude/` is locked.
- A debt sweep's worklist is `mcp__builder__debt_rows` (type, location, title per row): fix each where it lives, test beside it. The engine's CLI (`builder …`) is never reachable from a session.
- History is append-only: no amend, no rebase; a landed migration is superseded, never edited; a regenerated snapshot/baseline goes in its own commit whose subject starts `baseline:` and names the proof.
- Toolchain churn (`next build` rewrites tsconfig.json and next-env.d.ts): never hand-edit them; `git checkout main -- tsconfig.json next-env.d.ts` is always allowed (chained too), or leave the dirt — the engine restores them to main's form at the gate and at merge.

<!-- builder:lessons:start -->
## Standing lessons (engine-maintained)
### Locked ground & lawful paths
- A fixture the increment's testContract names under an owned path can still be Verifier-authored and hook-locked — check git log before planning to edit it — A support/fixture module the increment's own test contract names (e.g.
- Apply a PREFIX of cubit's committed migrations through the product's own lane — scratch copy + trimmed _journal.json + an import-less drizzle config — A migration-state acceptance ("what does a database look like halfway through the chain, and does a later run converge?") is stageable without touching the tree.
### Tests & acceptance
- Editing an unmerged migration file leaves already-migrated local databases (cubit_e2e) stale — drop them or the journey reds — drizzle-kit `migrate` decides what to apply from the journal's `when` timestamp of the last applied entry, not from the file's hash. Rewriting an unmerged migration (e.g.
- Spawning `pnpm worker` (or the bare `tsx` CLI) from test support leaks an orphaned worker — SIGTERM is not forwarded; spawn `node --import tsx <entry>` instead — Arbitrated 2026-09-04 (that increment, J-010): `tests/e2e/support/worker.ts` spawned `spawn("pnpm", ["worker"])` and its `stop()` waited for `worker: shutdown complete` after `child.kill("SIGTERM")`.
- A rAF-delta frame ledger reads 33.3 ms under Playwright unless the painter loops through a gesture — A viewer that draws one frame per input event publishes a median frame delta of exactly 33.3 ms in the journey lane (measured 2026-09-04 on J-011, `tests/e2e/viewer-perf.spec.ts`), whatever the paint costs: `page.mouse.wheel(...)` + `waitForTimeout(8)` costs …
### Screens & design
- Next 16 resolves dynamic segments already percent-decoded — a decodeURIComponent(param) in a page or route handler is a second decode — `params` from a Next App Router page, `generateMetadata` and a route handler arrive **decoded**. A `decodeURIComponent(layout)` on top of that decodes twice.
### Database
- CREATE SCHEMA IF NOT EXISTS is refused without CREATE on the database even when the schema already exists — pre-creating it in a migration does not remove the … — Postgres 16 checks the database's CREATE privilege *before* the `IF NOT EXISTS` bail-out.
### Process
- Once an app route reaches src/modules/takeoff/ingest, next build fails on cad/.venv's python symlink unless turbopack.root is \"/\" — `next build` fails with `Symlink [project]/cad/.venv/bin/python3 is invalid, it points out of the filesystem root` (a `DirAssetReference::resolve_reference` failure named on `src/modules/takeoff/ingest/cli.ts`) on any checkout where the CAD lane has run — i.e.
<!-- builder:lessons:end -->

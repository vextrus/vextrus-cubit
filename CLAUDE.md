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
- An unused import in a tests/**/*.ts file fails `next build`, which kills buildAndServe and the whole held-out browser set — `next build` runs the tree's tsc over everything tsconfig includes, and that includes `tests/**/*.ts`.
- cubit_jobs.job_claims / job_events are made at runtime by the first enqueue, so they do not exist in a scratch DB that never queued — read the jobs seam's … — `db/migrations/0018_job-store-schemas.sql` and `0019_job-store-repair.sql` create only the `cubit_jobs` SCHEMA and its grants — "its TABLES stay the seam's own shape".
- A held-out set that must drive `@/`-spelling product modules spawns a public .mts probe with the checkout's tsx and asserts over its JSON report — The held-out mount cannot resolve `@/` ([[heldout-mount-cannot-resolve-at-alias]]), and every module under `src/modules/**` spells its own layers that way — so `productModule("src/modules/…")` is dead on arrival for any live criterion.
- To infer what a held-out set asserts, subtract what the public suites import from the shared stage's exports — the remainder is the held-out's toolkit — When a shared acceptance stage (`tests/**/support/*-stage.ts`) says it "serves BOTH lanes", every export it publishes exists because some lane calls it.
### Tests & acceptance
- jobs-edges' \"close() gives every backend back within 5 s\" fails inside a full pnpm verify under load and passes in isolation — check before blaming a diff — `src/core/jobs/__tests__/jobs-edges.acceptance.test.ts` → *AC-4: close() on a store whose managing open is still in flight resolves and gives every backend back within 5 s* failed one `pnpm verify` on 2026-09-08 with `no backend but the prober's own remains: …
- A journey's dark screenshot is identical to its light one unless the page reloads after emulateMedia — cubit resolves the theme once at boot — `src/app/theme-resolver.ts` is an inline boot script: it reads `matchMedia("(prefers-color-scheme: dark)")` ONCE and sets `data-theme="dark"` on `document.documentElement`. Nothing listens for a later change.
### Process
- A gate build-lane tail ending in report.ts/instrumentation.ts warnings proves nothing — a green build prints the identical four — `next build` (Turbopack, Next 16) ends every run — green or red — with a summary block whose last entries are four warnings: `src/instrumentation.ts:32 (process.pid)`, `src/core/faults/report.ts:28 (process.stderr)` and `:4 (node:crypto)`, each followed by …
<!-- builder:lessons:end -->

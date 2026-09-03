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
- tests/spine/uploads/support/upload-stage.ts is the reusable live stage (scratch DB + STORAGE_ROOT + real accounts + projects) for any suite needing a tenant, … — `tests/spine/uploads/support/upload-stage.ts` (merged) is the one live stage to reuse rather than re-derive: `openStage()` provisions a scratch DB through `db/__tests__/harness.ts`, points `DATABASE_URL` at `urlApp` and `STORAGE_ROOT` at a fresh temp dir; …
- Derive a closed extractor-scheme list from SOURCE_SCHEMES + entityGraphSchema instead of freezing PDF_OBJECT/RASTER_TRACE as negatives — A `CHECK` closed to `('DXF_HANDLE')` must never be graded with `expect(def).not.toContain("PDF_OBJECT")`: R-TO-002/R-TO-003 (M4) mint `PDF_OBJECT` and `RASTER_TRACE` and will widen that list lawfully, reding the merged acceptance (audited 2026-09-03 on that …
### Tests & acceptance
- Adding a second JOB_KIND reds tests/jobs/enqueue-typing.accept.test.ts unless enqueue is declared as one overload per kind, the asked-about kind last — `tests/jobs/enqueue-typing.accept.test.ts` (merged) reads the payload a call site demands back off the signature: ```ts type ProbePayloadAtTheCall = JobsSeam["enqueue"] extends (kind: "probe", payload: infer P, ...rest: never[]) => unknown ? P : never; ``` …
- The merged jobs seam lists refused jobs in deadLetters() and a merged test pins it — an acceptance asserting a refusal is absent contradicts landed law — `deadLetters()` in `src/core/jobs/runtime.ts` calls `store.deadLetterRows(["failed", "refused"], …)` and its own doc says "every job that ended without succeeding, whether it was refused or ran out of attempts".
- cubit's eslint rule no-colour-literal reads any 6–8 digit hex NUMBER as a packed colour — binary format signatures in test support red the lint — `cubit/no-colour-literal` does not only look at CSS-ish strings: a numeric literal like `0x04034b50` (a zip local-header signature), `0xedb88320` (the CRC-32 polynomial) or `0xffffffff` reds `pnpm lint` with "a packed hex colour — colour literals exist only …
### Database
- A new tenant-scoped cubit table may only carry closed-list CHECKs, and INSERT-only grants oblige the append-only triggers — Two merged V-DB suites walk **every** tenant-scoped table the catalogue reports, so a new table in `src/core/db.ts` inherits their rules the moment its migration lands (found 2026-09-03 landing `files`/`drawings`/`uploads` for R-SPINE-020): - **CHECKs must be …
<!-- builder:lessons:end -->

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
- Scratch: never `rm -rf`; `mcp__builder__scratch_dir` answers with a writable directory in one turn. Regenerable build output (.next*/, dist/, coverage/, .turbo/, .vite/, *.tsbuildinfo) may be removed by relative path.
- Test runs are SCOPED: an unscoped runner discovers .builder-heldout/ and recurses. Run the exact files your task names (`pnpm vitest run <files>`), never the whole tree; never read or touch .builder-heldout/.
- Before editing test config, tests/e2e/**, CLAUDE.md or .claude/**: confirm your increment's approved spec owns that path — locked by default, and each attempt costs a denial plus a structural red.
- Read-only roles (reviewer/skeptic/adversary/planner) verify with the allowlist only: git reads, tsc, `vitest run <file>`, pnpm verify/test/checkup, `psql -c` (read-only SQL), pg_isready, curl localhost — never node -e / python3 -c / heredocs.
- The cad lane is Python under uv, and its read-side checks are on the allowlist exactly as the verify chain runs them: `uv run --project cad pytest cad`, `ruff check cad` (or `uv run --project cad ruff check`). The pinned LibreDWG tools read a drawing: `dwgread <file.dwg>` prints to stdout; `dwg2dxf -m -o <scratch>/<name>.dxf <file.dwg>` writes only to scratch (plain `dwg2dxf` writes beside its input and is denied; `-m` is the form ezdxf reads).
- A Verifier-authored file — including a BINARY fixture such as a `.dwg` — never yields to a Builder or Fixer. If you believe one is wrong, say so ONCE as an Objection in your handoff `{testId, claim, evidence, proposedChange}` and build around it; do not try the edit again. The engine also raises the dispute itself after two denials on one such file and puts the lane toolchain's reading of a binary fixture before the Arbiter.
- The Verifier never `git commit`s: the engine makes the `verifier:` commit after moving the held-out set out of the tree — leave the tree dirty.
- Session memory: write a durable lesson as its own file at `~/.claude/projects/-home-riz-vextrus-cubit/memory/<name>.md` (frontmatter `name`/`description`/`type: project|feedback`), with the Write tool or a Bash redirect — that directory (its MEMORY.md index too) is the one admitted path under `~/.claude/`, and the engine harvests it into the playbook after each merge. Everything else under `~/.claude/` (settings, hooks, transcripts) is locked for every tool.
- History is append-only: no amend, no rebase; a landed migration is superseded, never edited; a regenerated snapshot/baseline goes in its own commit whose subject starts `baseline:` and names the proof.
- Toolchain churn is not yours to keep OR to fight: `next build` rewrites tsconfig.json and next-env.d.ts as a side effect. Never hand-edit them; restore with `git checkout main -- tsconfig.json next-env.d.ts` (a pure restore of a toolchain path is always allowed, even chained after your other git commands), or simply leave the dirt — the engine restores these paths to main's form at the gate and again at merge.

<!-- builder:lessons:start -->
## Standing lessons (engine-maintained)
### Locked ground & lawful paths
- On a repeat held-out red, diff settled_rulings against the code before re-diagnosing — an unimplemented ruling is the failing assertion — On the cad dwg increment attempt 4 (2026-09-02) the gate had said "2 of 5 assertions" for two attempts running.
- A Verifier session that keeps reaching for product source — Across one increment the Verifier role was denied four separate times for touching product source — a migration, a package file, a build script, a test-db surface — each time the same rule fired: the Verifier writes acceptance only, never product source.
- Weakening or suppressing a failing check instead of fixing it — A build session added a structural suppression and removed an assert from a test to reach green, tripping ADDED_SUPPRESSION and TEST_INTEGRITY findings plus a locked-path-reverted flag — three separate detectors catching the same move.
- Read-only roles reaching for arbitrary execution to verify — Reviewer and skeptic sessions repeatedly reached for python3 -c, node -e, uv run pytest/ruff, iconv, dd — none on the read-only allowlist — trying to independently reproduce or inspect results, drawing denials nine-plus times in one increment.
- A sweep increment can graze the locked toolchain path by accident — A debt-sweep style increment touched the TypeScript configuration and was denied twice, then still picked up a non-blocking LOCKED_PATH_REVERTED finding — the sweep's breadth made it easy to touch a locked path without meaning to.
- Read-only psql means SELECT only, not 'non-destructive' — Three separate denials this increment came from roles under the read-only psql constraint reaching for statements that feel safe but aren't plain SELECT: PREPARE, SET enable_seqscan, and a bare touch outside the Bash allowlist.
- Exercise an acceptance scanner outside the tree — --config is denied; run the repo's vitest binary from the scratch dir — To prove a source-scanning helper answers correctly before the feature exists, run it against files that already ship — but the two obvious routes are both denied in a build session: - `pnpm vitest run --config <scratch>/…` → the discovery hook denies it (it …
### Tests & acceptance
- A \"recorded version/identity\" field is only bound by a stub tool reporting a distinctive version — re-probing the real tool at test time is vacuous — Acceptance for "`X.tool_version` is read from the toolchain's own `--version` output" cannot be graded by running the same real program again at test time and comparing: an implementation that hardcodes the machine's current version (`"0.13.3"`) passes both …
- LibreDWG 0.13.3's dwg2dxf default output is unreadable by ezdxf 1.4.4; only `-m` round-trips into ingest_dxf — Measured 2026-09-02 while minting `cad/tests/dwg/fixtures/basic.dwg` for that increment. `dwg2dxf` (LibreDWG 0.13.3) writes an `ENDBLK` record whose handle is `0`.
### Process
- ezdxf's log records escape to stderr via logging.lastResort and break any driver parsing `${stdout}\\n${stderr}` — Nothing under `cad/src/vextrus_cad/` configures `logging`, so every `WARNING`+ record ezdxf emits goes through `logging.lastResort` straight onto the process's stderr.
<!-- builder:lessons:end -->

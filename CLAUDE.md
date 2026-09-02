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
- A held-out regex over a refusal message must include the Bible clause's own verb; a Builder who echoes the clause (\"outran the budget\") is lawful and the … — On the cad dwg increment (AMEND round, 2026-09-02) the only residual held-out red was `RAN_OUT_OF_TIME = /time|timed|timeout|expire|exceed/i` against the message "…outran the 3s budget for converting this drawing, and was stopped".
- A binary fixture the Verifier authored is locked like any other acceptance artifact — Trigger: acceptance rests on a binary fixture (a converted drawing, an archive, a golden blob) that the Verifier wrote.
- An external native binary cannot be probed from a read-only role — Trigger: an increment whose acceptance depends on a third-party command-line converter invoked by a verify lane.
- A reviewer's psql probe must be a single bare SELECT — Trigger: a reviewer or skeptic wanting to check an ordering or comparison invariant against the live database.
### Tests & acceptance
- cubit/no-model-outside-seam refuses any import of src/core/model/__tests__/support/seam from outside src/core/model — define rejectionOf/RESOLVED locally; also … — Verified 2026-09-02 on that increment (model/jobs debt sweep): - `cubit/no-model-outside-seam` binds the whole tree, tests included: importing `src/core/model/__tests__/support/seam` (its `rejectionOf`, `RESOLVED`, `member`) from `src/core/__tests__/`, …
### Database
- postgres.js 3.4.9 facts that shape the jobs key lock — reserve() hangs on an ended pool, begin() masks a guarded failure with CONNECTION_CLOSED, and any … — Measured 2026-09-02 while building the jobs key lock (src/core/db.ts `withKeyLock`) against postgres.js 3.4.9: - `sql.reserve()` on a pool after `sql.end()` HANGS forever when the pool never connected, and resolves a dead connection when it had.
### Process
- dwgread -O JSON names entity classes in LibreDWG's own vocabulary (DIMENSION_LINEAR, POLYLINE_2D, VERTEX_2D, 3DFACE) while dwg2dxf's DXF read by ezdxf says … — Measured 2026-09-02 (LibreDWG 0.13.3, ezdxf 1.4.4) while breaking the cad DWG lane (that increment): a DWG minted with `dxf2dwg` from an ezdxf R2000 DXF holding a linear dimension, a 2D polyline, a 3DFACE, TEXT, CIRCLE, LINE: - `dwgread -O JSON` census …
- A subprocess budget is measured by the caller; wait for budget-minus-ending so the refusal lands strictly within timeout_seconds, and spell the budget as the … — On the cad DWG lane (that increment, 2026-09-02) `Popen.wait(timeout=budget)` ended the invocation ~2 ms *after* `timeout_seconds` (2.002 s for 2.0), and the timeout refusal spelled `2.0` as `2s` via `:g`.
<!-- builder:lessons:end -->

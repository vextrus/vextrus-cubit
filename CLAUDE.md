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
- Restoring from a ref must name files, not trees — An increment tried to restore prior state from a ref using `.` or a directory/glob, and was denied three times in a row.
- denied 5× on the schedule reconstruction increment: know the lawful path — Sessions on the schedule reconstruction increment were denied 5 times with: > the whole gate chain is run through `mcp__builder__check` — `{}` for the fast lane (tsc, eslint on your changed files, the unit tests your diff can move) between edits; `{ "full": …
- denied 4× on the register core increment: know the lawful path — Sessions on the register core increment were denied 4 times with: > the whole gate chain is run through `mcp__builder__check` — `{}` for the fast lane (tsc, eslint on your changed files, the unit tests your diff can move) between edits; `{ "full": true }` for …
- denied 4× on the kind catalogue units increment: know the lawful path — Sessions on the kind catalogue units increment were denied 4 times with: > rm -rf is denied (the exceptions: scratch under /tmp or $TMPDIR — mcp__builder__scratch_dir answers with a guaranteed-writable directory in one turn — and this lane's own regenerable …
- denied 4× on the scale engine increment: know the lawful path — Sessions on the scale engine increment were denied 4 times with: > the whole gate chain is run through `mcp__builder__check` — `{}` for the fast lane (tsc, eslint on your changed files, the unit tests your diff can move) between edits; `{ "full": true }` for …
- The session that re-runs the gate chain by hand — An increment repeatedly (4x) tried to run the whole gate chain tool-by-tool instead of calling the fast lane.
### Tests & acceptance
- A failing probe test is fixed by product code, not by thinning the assertions — An increment hit the same denial twice on the same probe file: assertions were stripped out of a test to make it pass instead of fixing the code under test.
- Scan-corpus exemptions need the corpus committed and armed, not just referenced — An increment writing a lint/scan-law test that excuses a NEVER via a named corpus can pass its own unit test while failing the AC that the corpus sits in an armed lane.
<!-- builder:lessons:end -->

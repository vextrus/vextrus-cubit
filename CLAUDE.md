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
- Prove a React-hook acceptance set is passable before the hooks exist — scratch stand-ins ported from the screen being refactored, staged and run by one … — Verified 2026-09-06 (viewer screen → hooks split).
### Tests & acceptance
- A next build that overlaps db/__tests__/drift-lane-breaker.test.ts bakes tenants.title into .next-cubit, and e2e-server reuses that bundle until it is deleted — Seen 2026-09-07 (that increment): every gate stage green except journeys, where J-000 sign-up died on a fault — `insert into "tenants" ("tenant_id", "title", "created_at")` — while `src/core/db/schema.ts` plainly declares `name: text("name")` and no migration …
- Rewriting src imports to the @/ alias reds the merged suites that follow a specifier by joining it to the importing file's directory — Spelling src/** imports through tsconfig's `@/` alias (that increment, 2026-09-07) left every runtime lane green but red three merged acceptance suites that read source TEXT and resolve what they find: - `tests/invitations/support/invitations-contract.ts` — …
- A barrel graded on \"adds no public name\" cannot `export *` from a module that also exports a shared internal — put the internal in a module the barrel never … — `src/core/db.ts` is a barrel whose acceptance freezes `Object.keys(await import(barrel))` against a frozen roster in BOTH directions — nothing dropped, nothing added.
- The harness reads slashes in a journey checkpoint's prose as routes — write 'fit and zoom', never 'fit/zoom' — The pre-build harness extracts the routes a journey checkpoint asserts by scanning its text for `/word` tokens, and grades them against the increment's declared routes.
### Process
- REGISTRY_ENTRY_LOST's export reader counts only bare identifiers in export lists and export-<kind>-Name declarations — no form of type re-export is visible to … — The engine's shared-registry reader (the one REGISTRY_ENTRY_LOST judges, and the one `mcp__builder__ground_brief` prints as "Shared registries today") collects a file's exports by text, and it counts exactly two shapes: - a bare identifier in an `export { … …
- A module split that orphans its registry entry costs a whole attempt — When a plan splits one module file into several, the structural gate's REGISTRY_ENTRY_LOST check fires once per extracted file that still points at the pre-split path — it fired a dozen-plus times in a single attempt here before a retry cleared it.
<!-- builder:lessons:end -->

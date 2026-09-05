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
- HELD-OUT criteria must ground in what the Builder can already read — A session drew three separate hook denials in one increment — reading the held-out set, touching Verifier-only acceptance surface, and probing product source from a grading role — all traceable to one cause: its spec's HELD-OUT criteria quoted literals …
- denied 3× on that increment1b-removal-member-has-acts: know the lawful path — Sessions on that increment1b-removal-member-has-acts were denied 3 times with: The lawful path is in the denial's own words — follow it instead of retrying the denied call.
- denied 5× on the density prefs increment: know the lawful path — Sessions on the density prefs increment were denied 5 times with: The lawful path is in the denial's own words — follow it instead of retrying the denied call.
- denied 4× on inc-sweep-src-app-1: know the lawful path — Sessions on inc-sweep-src-app-1 were denied 4 times with: The lawful path is in the denial's own words — follow it instead of retrying the denied call.
- Exercise an acceptance scanner outside the tree — --config is denied; run the repo's vitest binary from the scratch dir — To prove a source-scanning helper answers correctly before the feature exists, run it against files that already ship — but the two obvious routes are both denied in a build session: - `pnpm vitest run --config <scratch>/…` → the discovery hook denies it (it …
- A public test that scans a Builder-owned source file must be proven satisfiable against a mock tree in scratch, or its regexes ship false reds — Acceptance that judges a file the Builder has not written yet (a Playwright spec, a config key, a committed baseline) can only assert *about its text*.
### Tests & acceptance
- A jsdom acceptance that mounts a client screen without mocking next/navigation forbids useRouter — navigate with window.location — Next 16.3's `useRouter()` (`node_modules/next/dist/client/components/navigation.js`) throws `invariant expected app router to be mounted` when `AppRouterContext` is null.
- In cubit, a tenant-scoped table with a DELETE grant may not carry an FK to an append-only ledger — the merged TRUNCATE case reds — `db/__tests__/act-immutability.live.test.ts` (merged) truncates **every append-only ledger in one statement** and requires the refusal to match `/append-only/i`.
<!-- builder:lessons:end -->

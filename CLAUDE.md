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
- A held-out set can stage the journeys' own scripts/e2e-server.mjs on port 3211 and read wire headers with plain fetch — 13 s end to end when the build is warm — Proved on the security headers increment (2026-09-06), from the gate's own mount: a held-out live check that needs the BUILT product answering over HTTP does not need `buildAndServe()` — it can start the same server the journeys start, which is what an …
- cubit ships tsx, so a scratch script can drive server-tier product .ts directly — but it must be .mts or top-level await dies — `package.json`'s `worker` script pulls in `tsx`, so `<repo>/node_modules/.bin/tsx <scratch>/probe.mts` runs a throwaway script that imports product `.ts` by **absolute path** with extensionless relative specifiers resolved for you — no vitest config, no …
### Tests & acceptance
- the J-000 journeys' built stage states no CUBIT_STORAGE_SIGNING_SECRET and runs as NODE_ENV=production, so any 'sign fails closed without a key' law reds … — Verified 2026-09-06 on that increment (storage secret fails closed).
- A hand-built child environment must be typed NodeJS.ProcessEnv — the tree declares NODE_ENV required, so Record<string, string|undefined> fails tsc at spawn() — Building a child process environment in a test (`const environment: Record<string, string | undefined> = { ...process.env }`) reds `tsc` at the `spawn(cmd, args, { env: environment })` call: `TS2741: Property 'NODE_ENV' is missing in type 'Record<string, …
- tests/hotfix-j000/ac2-forward-only.test.ts freezes every LINE of tests/e2e/pages|support at 7af2a17 on any unmerged branch — a later increment's edit there … — `tests/hotfix-j000/ac2-forward-only.test.ts` (merged) reads `PRE_FIX=7af2a17 .. FIX_END`. `FIX_END` is "the oldest mainline commit containing HEAD" — and on an **unmerged branch no mainline commit contains HEAD, so FIX_END falls back to `HEAD`, i.e.
- A nonce CSP kills tests/e2e/support/checkpoint.ts's axe injection — page.addScriptTag({content}) is an inline script; page.evaluate(axe.source) is not — Once `src/proxy.ts` serves a nonce-based `script-src` with no `'unsafe-inline'` (that increment, 2026-09-06), every V-E2E named checkpoint dies: ``` Error: page.addScriptTag: Executing inline script violates the following Content Security Policy directive …
<!-- builder:lessons:end -->

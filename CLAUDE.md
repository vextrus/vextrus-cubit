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
- Test runs are by name: `pnpm vitest run <files>` for the files your task names, `mcp__builder__check` for the gate's fast lane (tsc, eslint on your changed files, the unit tests your diff can move) in one call; the whole `pnpm verify` once, before the handoff. `.builder-heldout/` is the Verifier's store — never read or touched by any other role.
- Bash outputs over 6,000 characters arrive compacted: the head, the tail and every verdict line are kept, and the marker names the scratch file holding the whole text — read it rather than re-run the command.
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
- a loop flag paired with the same denial category repeated across attempts — An increment took 8 attempts with a watchman loop flag while one denial category (a locked config, a locked path, a denied destructive command) fired 3, 5, or more times across those attempts.
- denied 5× on the sheet index increment: know the lawful path — Sessions on the sheet index increment were denied 5 times with: > the TypeScript configuration is locked unless the increment is tagged `toolchain` or its approved spec owns the path — a pure `git restore <file>` / `git checkout main -- <file>` restore back …
- denied 4× on inc-sweep-src-app-1: know the lawful path — Sessions on inc-sweep-src-app-1 were denied 4 times with: > the product's whole test runner would discover .builder-heldout/ inside the tree and recurse (gen-2 an earlier generation's run attempt 8).
- Whole-tree test runner recurses into heldout fixtures — A session invoked the product's whole-tree test runner and was denied four times in one attempt because that runner would discover .builder-heldout/ inside the tree and recurse into it.
- A fixture the increment's testContract names under an owned path can still be Verifier-authored and hook-locked — check git log before planning to edit it — A support/fixture module the increment's own test contract names (e.g.
- Apply a PREFIX of cubit's committed migrations through the product's own lane — scratch copy + trimmed _journal.json + an import-less drizzle config — A migration-state acceptance ("what does a database look like halfway through the chain, and does a later run converge?") is stageable without touching the tree.
### Tests & acceptance
- Editing an unmerged migration file leaves already-migrated local databases (cubit_e2e) stale — drop them or the journey reds — drizzle-kit `migrate` decides what to apply from the journal's `when` timestamp of the last applied entry, not from the file's hash. Rewriting an unmerged migration (e.g.
### Screens & design
- source-lex's code channel blanks import specifiers and CSS selector strings — read them back off the raw source at the same offsets — `lex(source).code` blanks every string literal, so an import specifier (`from "../../ui/shell"`) and a CSS attribute-selector value (`[data-entry$="/Dropzone"]`) are invisible in the code channel — a scan for either finds nothing and passes by not looking.
- Next 16 resolves dynamic segments already percent-decoded — a decodeURIComponent(param) in a page or route handler is a second decode — `params` from a Next App Router page, `generateMetadata` and a route handler arrive **decoded**. A `decodeURIComponent(layout)` on top of that decodes twice.
<!-- builder:lessons:end -->

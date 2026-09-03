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
- denied 3× on the server auth debt sweep increment: know the lawful path — Sessions on the server auth debt sweep increment were denied 3 times with: > the TypeScript configuration is locked unless the increment is tagged `toolchain` or its approved spec owns the path — a pure `git restore <file>` / `git checkout main -- <file>` …
- Locked toolchain config needs the tag before the touch — A session attempted to edit the TypeScript configuration three times and was denied each time: the config is locked unless the increment is tagged toolchain or its approved spec owns that path.
- A red test is fixed, never deleted — Twice in the same increment, assertions were removed from failing tests to force a green build, and both attempts were denied by the same rule: never delete a test or weaken a check to green a build.
- Acceptance-only writes mean acceptance-only, repeatedly ignored — A debt-sweep increment repeatedly tried to edit product source and locked toolchain configuration, drawing the same hook denial three times in one increment: acceptance writes are confined to tests, test support, fixtures and .builder-heldout/.
- An Object.keys exact-set assertion is lawful only where a Bible clause quotes the member list closed; for a type another increment owns, derive both sides in … — An arbitration (that increment, 2026-09-03) struck a nine-name `MODEL_ANSWER_KEYS` literal out of `src/core/model/__tests__/proposal.acceptance.test.ts` as the B-19 class — a transcribed literal standing in for a rule.
### Tests & acceptance
- Any :focus selector or outline declaration in a src/ stylesheet other than reticle.css reds tests/ui/primitives-core/reticle.test.ts — `tests/ui/primitives-core/reticle.test.ts` (AC-3, B-17) scans every `.css` under `src/` except `src/ui/primitives/core/reticle.css` and fails on any rule whose selector matches `/:focus(-visible|-within)?\b/` or contains `cx-reticle`, and on any `outline*` …
- A B-20 tamper digest must bound a test body by balanced delimiters, never by the first same-indent `});` — A B-20 re-baseline audit that digests "the test that stood before" must derive the body's extent, not guess it.
- Q-07's REFUSAL_SHAPE needs an underscore, so a Bible code like UNSOURCED or MALFORMED can never be \"exercised\" and fails taxonomy.test.ts's shape check — Found 2026-09-03 writing that increment's acceptance (L-AI-02: `UNSOURCED`, `SOURCE_UNRESOLVED`, `MALFORMED`). Both register suites transcribe `REFUSAL_SHAPE = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/`, which requires at least one `_`: - `src/core/errors/taxonomy.test.
<!-- builder:lessons:end -->

# VEXTRUS CUBIT — session notes

This file is maintained by the Vextrus Builder engine; the lessons section is rewritten after
merges. Do not edit it inside a build session.

## Commands that must be green
pnpm verify · pnpm test:db · pnpm e2e --journey <J> · pnpm checkup

## Law
- The Bible (docs/specs/cubit.bible.xml) is immutable in sessions: take the most defensible reading and record an Interpretation; a contradiction stops the increment with a named reason.
- A screen is implemented against its Design Decision in docs/design/<screen>.md — layout, every state, copy, motion, tokens. Deviations are graded as defects.

## Lawful paths (what the hooks admit — a denial only says no; these say what works)
- Scratch: `mcp__builder__scratch_dir` is the writable directory; `rm -rf` also takes this lane's own regenerable output named by a relative path (.next*/, dist/, coverage/, .turbo/, .vite/, *.tsbuildinfo) — the same directory spelled as an absolute path is refused, even inside your own worktree.
- Test runs are by name (`pnpm vitest run <files>`, every path spelled out); `mcp__builder__check` is the gate's fast lane in one call, and `{ "full": true }` the whole chain once, before the handoff.
- A Bash output over 6,000 chars arrives compacted (head, tail, every verdict line, and the scratch file holding the whole text) — read that file, don't re-run the command.
- A failed Edit means your copy of the file is stale, not that the string was wrong: re-Read the exact region and edit from what you just read — a re-guessed `old_string` fails again, and a whole-file Write to get around it buys SCOPE_CREEP.
- A restore from a ref names explicit files, one path at a time (`git checkout main -- <file>`, chained if you need several); `.`, a directory or a glob is refused because it can reach the acceptance tree.
- The cad lane (Python, uv): `uv run --project cad pytest cad`, `ruff check cad`, `dwgread <f.dwg>` and `dwg2dxf -m -o <scratch>/x.dxf <f.dwg>` are read-only; plain `dwg2dxf` writes beside its input (denied); `-m` is the form ezdxf reads.
- A Verifier-authored file (a binary `.dwg` fixture included) never yields to a Builder or Fixer: say so ONCE as an Objection and build around it; after two denials the engine raises the dispute itself with the toolchain's reading of the fixture.
- The Verifier never `git commit`s — the engine makes the `verifier:` commit; leave the tree dirty.
- Session memory: `~/.claude/projects/-home-riz-vextrus-cubit/memory/<name>.md` (frontmatter name/description/type) by Write or Bash — the one admitted path under `~/.claude/`; harvested after each merge. The rest of `~/.claude/` is locked.
- A debt sweep's worklist is `mcp__builder__debt_rows` (type, location, title per row): fix each where it lives, test beside it.
- History is append-only: a landed migration is superseded, never edited; a regenerated snapshot or baseline goes in its own commit whose subject starts `baseline:` and names the proof. A design picture your lawful change moved is the gate's to re-take — don't spend a turn on `--update-snapshots`.
- Toolchain churn (`next build` appends a dist dir to tsconfig.json): never hand-edit it; `git checkout main -- tsconfig.json` is always allowed (chained too), or leave the dirt — the engine restores it to main's form at the gate and at merge. A deliberate config change is lawful only where the increment is tagged `toolchain` or its approved spec names the path; otherwise it belongs to the increment that owns it. `next-env.d.ts` is untracked build output (`pnpm typecheck` regenerates it); never commit or restore it.

<!-- builder:lessons:start -->
## Standing lessons (engine-maintained)
### Locked ground & lawful paths
- Diagnosis that reaches for source introspection instead of read-only probes — A session tried to inspect runtime state by running arbitrary code (e.g. a code-evaluation flag) rather than a read-only probe, and was denied — diagnosis is read-only.
- Held-out criteria must quote only what the Builder reads — An increment's first attempt went HELDOUT_RED because its spec's held-out criteria quoted literal strings that appear nowhere in the goal, the public criteria, or the test contract — the only three places the Builder can check a quote against.
- UI-scoped work that reaches into a shared string table breaks the unrelated golden path — An increment scoped to one UI feature edited another module's shared string table and a locked path, drew SCOPE_CREEP findings, and the unrelated golden-path journey test went red on repeated attempts, not just its own feature's journey.
- UI string keys belong in the touching module's own file — An increment that needs new UI copy sometimes reaches for another module's existing string table and gets denied — twice in this increment alone.
- The session that re-runs the gate chain by hand — An increment repeatedly (4x) tried to run the whole gate chain tool-by-tool instead of calling the fast lane.
### Tests & acceptance
- Scan-corpus exemptions need the corpus committed and armed, not just referenced — An increment writing a lint/scan-law test that excuses a NEVER via a named corpus can pass its own unit test while failing the AC that the corpus sits in an armed lane.
- Prove 'this module imports only from X' behaviourally with a module.register resolve hook that refuses everything else — never by scanning the file's text — An acceptance criterion of the form *"`<module>` imports only from `@/core/**`"* is a **source-text** assertion if you scan it with `tests/support/source-lex` — and the engine's mechanical check flags it (v15 §7).
<!-- builder:lessons:end -->

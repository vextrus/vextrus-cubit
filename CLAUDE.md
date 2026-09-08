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
- A screen that reads a seam's answer must admit a refusal by asking REFUSALS, not by matching one hand-picked property, and must keep the rows the answer carried — A client-side reader that only accepts `answer.refusal` as a *string* (plus the core marker on a rejection) mis-reads every other lawful carrier as a fault, and shows a person whose session or permission is the reason a **retry button** — the wrong one of …
- An unused import in a tests/**/*.ts file fails `next build`, which kills buildAndServe and the whole held-out browser set — `next build` runs the tree's tsc over everything tsconfig includes, and that includes `tests/**/*.ts`.
- cubit_jobs.job_claims / job_events are made at runtime by the first enqueue, so they do not exist in a scratch DB that never queued — read the jobs seam's … — `db/migrations/0018_job-store-schemas.sql` and `0019_job-store-repair.sql` create only the `cubit_jobs` SCHEMA and its grants — "its TABLES stay the seam's own shape".
### Tests & acceptance
- Prove 'this module imports only from X' behaviourally with a module.register resolve hook that refuses everything else — never by scanning the file's text — An acceptance criterion of the form *"`<module>` imports only from `@/core/**`"* is a **source-text** assertion if you scan it with `tests/support/source-lex` — and the engine's mechanical check flags it (v15 §7).
### Database
- Comparing two tables' RLS policies as text needs polcmd::text — bare `polcmd || ' | '` fails with \"operator is not unique\" — The cleanest way to prove a new table "wears the policies <peer> wears" (B-19: derive, never transcribe) is to read both tables' policies as one comparable string per policy and compare the sorted lists — names ignored, substance compared: ```sql select …
### Process
- In jsdom navigator.onLine is always true, so an offline banner that re-reads it inside its own event handler can never be driven from a unit lane — jsdom implements `navigator.onLine` as a constant `true` and does not change it when you `window.dispatchEvent(new Event("offline"))`.
- A gate build-lane tail ending in report.ts/instrumentation.ts warnings proves nothing — a green build prints the identical four — `next build` (Turbopack, Next 16) ends every run — green or red — with a summary block whose last entries are four warnings: `src/instrumentation.ts:32 (process.pid)`, `src/core/faults/report.ts:28 (process.stderr)` and `:4 (node:crypto)`, each followed by …
<!-- builder:lessons:end -->

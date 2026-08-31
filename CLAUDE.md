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
- Read-only roles (reviewer/skeptic/adversary) verify with the allowlist only: git reads, tsc, `vitest run <file>`, pnpm verify/test/checkup, `psql -c` (read-only SQL), pg_isready, curl localhost — never node -e / python3 -c / heredocs.
- History is append-only: no amend, no rebase; a landed migration is superseded, never edited; a regenerated snapshot/baseline goes in its own commit whose subject starts `baseline:` and names the proof.

<!-- builder:lessons:start -->
## Standing lessons (engine-maintained)
### Locked ground & lawful paths
- An AMEND round can arbitrate test \"n/a (plan risk note: …)\" — nothing of yours is wrong; strengthen behaviour where the newly-lawful mechanism is weakest — An arbitration can name the test `n/a (plan risk note: "<the note>")` — the challenged item is the plan's *implementation caution*, not one of your tests.
- denied 3× on that increment1b-removal-member-has-acts: know the lawful path — Sessions on that increment1b-removal-member-has-acts were denied 3 times with: > the product's whole test runner would discover .builder-heldout/ inside the tree and recurse (gen-2 an earlier generation's run attempt 8).
- Full-suite test runs recurse into the heldout directory — When a session invokes the product's whole test runner with a repo-wide discovery pattern, it walks into .builder-heldout/ and the hook denies it — this happened three times in one increment before the session adapted.
- An AMEND round's dry run can red on a held-out assertion a settled design ruling made unsatisfiable — fix it there, despite \"touch nothing else\" — An AMEND round hands back a named test to amend plus the instruction "touch nothing else".
- A failing test is a spec to satisfy, not an obstacle to remove — While TEST_INTEGRITY findings piled up against a failing live test, the session attempted to delete or rename that test to get to green, and was denied under the standing rule against greening a build by editing the test itself.
- Cross-repo memory paths are locked, not just your own — A build session reached across repo boundaries with Bash to touch another repo's .claude memory file, and was denied twice for the same path before stopping.
- R-UI-050's refusal cell owes a registry code + remedy on EVERY screen, including ones whose Decision calls refusal impossible — On the seven-states matrix increment (that increment, 2026-08-31) the held-out AC-4 read: "for every screen, the mounted 'refusal' state's markup contains a refusal code that `src/core/errors` exports, alongside non-empty remedy text".
### Tests & acceptance
- Proving a table is system-only WRITE: an UPDATE a scope cannot see exits 0 with 0 rows, so 42501 needs the row visible and the WITH CHECK tightened — Acceptance that asks for "SQLSTATE 42501 on an UPDATE" (that increment1a AC-2, `memberships`) is only satisfiable one way.
- A screen's copy under src/app/**/strings.ts is unreachable from src/ui (ARCH-01, even type-only) — mirror it and pin the mirror with a test — `scripts/eslint/rules/boundaries.mjs` gives `ui` the reach `["ui", "core"]`, and `core` only `import type`.
- A \"the collator appears nowhere\" scan greps raw source, so naming localeCompare in a prose comment reds it — L-REG-05's acceptance (`src/core/identity/__tests__/identity.acceptance.test.ts`, AC-4) walks every `.ts` under `src/core/identity` and `src/modules/takeoff/register` and flags any file whose **raw text** contains the assembled name `locale` + `Compare` — …
<!-- builder:lessons:end -->

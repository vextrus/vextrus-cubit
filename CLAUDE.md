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
- R-UI-050's refusal cell owes a registry code + remedy on EVERY screen, including ones whose Decision calls refusal impossible — On the seven-states matrix increment (that increment, 2026-08-31) the held-out AC-4 read: "for every screen, the mounted 'refusal' state's markup contains a refusal code that `src/core/errors` exports, alongside non-empty remedy text".
- denied 5× on the density prefs increment: know the lawful path — Sessions on the density prefs increment were denied 5 times with: > the product's whole test runner would discover .builder-heldout/ inside the tree and recurse (gen-2 an earlier generation's run attempt 8).
- A seam's failure arm may not re-spell a code literal; REFUSALS needs a mapped-type annotation so entry.code keeps its key's literal type — Q-07's "spelled but not wired" is stricter than the public `tests/refusal-register/scan.ts`: that scan clears any file that imports `src/core/errors.ts`, but a held-out check parses the seam file and rejects a registered code spelled as a **string literal in …
- L-FRM-06's conversion-literal ban, scanned as a test: arbitration ruled the sweep must read RAW source (quotes change nothing) and forgive src/core/format.ts's … — L-FRM-06 says "a conversion literal outside the canon is a lint failure", but no eslint rule can be added (`scripts/eslint/**` is hard-locked), so it is enforced as an owned scan test in `src/core/units/__tests__/canon.test.ts`.
- rm -rf denied repeatedly has a named lawful path — rm -rf was denied four times in a single increment — well past a one-off, meaning a session kept reaching for a bare rm -rf instead of the sanctioned scratch flow.
- Unscoped test runners recurse into held-out material — When a build session's test runner walks the whole tree without an explicit scope, it discovers .builder-heldout/ and tries to recurse into it — the hook denies the recursion, and separately any read or touch of the held-out set is denied, because that set is …
### Tests & acceptance
- A screen's copy under src/app/**/strings.ts is unreachable from src/ui (ARCH-01, even type-only) — mirror it and pin the mirror with a test — `scripts/eslint/rules/boundaries.mjs` gives `ui` the reach `["ui", "core"]`, and `core` only `import type`.
- A \"the collator appears nowhere\" scan greps raw source, so naming localeCompare in a prose comment reds it — L-REG-05's acceptance (`src/core/identity/__tests__/identity.acceptance.test.ts`, AC-4) walks every `.ts` under `src/core/identity` and `src/modules/takeoff/register` and flags any file whose **raw text** contains the assembled name `locale` + `Compare` — …
- Q-07's orphan scan reads an ALL_CAPS interface property key in src/** as a refusal code — acceptance support under src/**/__tests__ can red the merged register … — `tests/refusal-register/scan.ts` classifies a name as *spelled* when it is a string literal **or a declared key** — `ts.isPropertySignature` included.
- Q-07 'spelled but not wired' acceptance must parse the product file with the checkout's own typescript — a text scan cannot tell a returned literal from the … — Found amending that increment's AC-6 after a discrimination audit (2026-08-30).
<!-- builder:lessons:end -->

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
- Toolchain churn is not yours to keep OR to fight: `next build` rewrites tsconfig.json and next-env.d.ts as a side effect. Never hand-edit them; restore with `git checkout main -- tsconfig.json next-env.d.ts` (a pure restore of a toolchain path is always allowed, even chained after your other git commands), or simply leave the dirt — the engine restores these paths to main's form at the gate and again at merge.

<!-- builder:lessons:start -->
## Standing lessons (engine-maintained)
### Locked ground & lawful paths
- Exercise an acceptance scanner outside the tree — --config is denied; run the repo's vitest binary from the scratch dir — To prove a source-scanning helper answers correctly before the feature exists, run it against files that already ship — but the two obvious routes are both denied in a build session: - `pnpm vitest run --config <scratch>/…` → the discovery hook denies it (it …
- A held-out mount can load the checkout's own test-support modules by absolute specifier — reuse a previous increment's live stage instead of re-deriving one — Proved from the gate's own mount on that increment (2026-08-31): `frame/index.ts`'s `productModule()` loads **test support** out of the checkout, not just product source. All three of these came up clean, before any database existed, in ~300 ms: ```ts process.
- A held-out-red is fixed in product code, not by editing the tests — Facing an acceptance-heldout gate red, a session moved test/expect assertions and attempted an rm -rf inside a scratch copy of the spec/test files — denied as TEST_INTEGRITY (never delete a test or weaken a check to green a build) and as a held-out set …
### Tests & acceptance
- next build rewrites the tracked next-env.d.ts to name NEXT_DIST_DIR — test support may NOT restore it (arbitrated); the cure lives at the shim's home — `next build` rewrites the **tracked** `next-env.d.ts`, replacing its `import "./.next-<dist>/types/routes.d.ts"` lines with whichever `NEXT_DIST_DIR` the build was given.
- An acceptance test reading git must bound its range at the increment's own merge, never `..HEAD` — the fault-83 \"extent-assertion anchored to a date\" — Any acceptance file that asks git a question (`diff PRE_FIX..HEAD`, "every `baseline:` commit carries only X", "these files are byte-identical") lives permanently in the unit lane and is re-run by every future increment.
- The that increment hotfix's fresh-cluster hypothesis is dead — a database migrated 0000→0011 from zero is schema-identical to the additive cubit_e2e, and the … — Measured 2026-09-01 while writing acceptance for `the invitations accept hotfix increment` (the J-000 red on main after merge `7af2a17`).
- A try/catch inside a *.test.ts under src/modules|server|app reds pnpm verify's lint (cubit/fault-or-refusal); rethrow via refusalCodeOf — `scripts/eslint/rules/fault-or-refusal.mjs` binds every file whose layer is `server`, `app`, `modules` or `worker` — **tests included**.
- Verifier mistakes support-shaped files for acceptance surface — A Verifier session repeatedly tried to write memory/state files, probe scripts, and typing helpers, each time hitting the same denial: the Verifier writes acceptance only — tests, test support, fixtures and .builder-heldout/ — never product source.
### Process
- R-SPINE-006's three facts can't separate an in-process driver from a Host-rewriting proxy — harden src/server/context.ts's arrival address, never the guard — `src/modules/spine/tenancy/guard/origin.ts` judges three facts (statedOrigin, requestOrigin, configuredOrigin).
- ORIGIN_NOT_VERIFIED cannot be provoked from a real browser: verifyStatedOrigin admits requestOrigin too, and Next blocks Origin≠Host on server actions first — `src/modules/spine/tenancy/guard/origin.ts`'s `verifyStatedOrigin` admits a stated origin that matches **either** the deployment's `CUBIT_PUBLIC_ORIGIN` **or** `requestOrigin` (the origin of the URL the request arrived at), and lets a request stating *no* …
<!-- builder:lessons:end -->

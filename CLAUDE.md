# VEXTRUS CUBIT — session notes

This file is maintained by the Vextrus Builder engine; the lessons section is rewritten after
merges. Do not edit it inside a build session.

## Commands that must be green
pnpm verify · pnpm test:db · pnpm e2e --journey <J> · pnpm checkup

## Law
- The Bible (docs/specs/cubit.bible.xml) is immutable in sessions: take the most defensible reading and record an Interpretation; a contradiction stops the increment with a named reason.
- A screen is implemented against its Design Decision in docs/design/<screen>.md — layout, every state, copy, motion, tokens. Deviations are graded as defects.
- Never delete a test or weaken a check to green a build; raise an Objection in the handoff.

<!-- builder:lessons:start -->
## Standing lessons (engine-maintained)
- Reviewer/skeptic sessions burn turns rediscovering the read-only allowlist: Across this increment, reviewer and skeptic sessions collectively hit ~35 denials for writes or non-allowlisted Bash (uv, python3 -c, node -e, pnpm install, mkdir, rm -rf, pnpm dev, etc.) before converging on the allowed
- a held-out roster assertion must derive the armed set by probing input roots, never freeze the set that was armed on delivery day: inc-000's held-out AC-6 originally carried a frozen `ARMED_STAGES = ['tsc','eslint','vitest','cad-ruff']` and asserted "the ok stages equal ARMED_STAGES". Once inc-001 founded `db/schema`, `pnpm verify` legitimately prin
- Declare every new dependency in the Increment Spec before build: Three denials this increment were 'dependency X is not declared in the Increment Spec' (vitest, typescript, @types/node, eslint) — each cost a wasted turn discovering the rule mid-build. The lawful path: a Scout note plu
- A fixture tsconfig that extends the root must set \"include\": [] — extends inherits include, while exclude never touches \"files\".: A one-file tsc-fixture project (`tests/lint-fixtures/<dir>/tsconfig.*.json`) that `extends: "../../../tsconfig.json"` still inherits the base's `include`, so `"files"` alone compiles the whole product tree with it — any 
- The Q-07 refusal register counts a code \"exercised\" wherever its name appears in a test file — comments included — so an acceptance test that quotes a code grants it a free pass.: CUBIT's Q-07 register (inc-002, `src/core/__tests__/refusal-register.test.ts`) collects "exercised" codes by scanning test files for the code grammar `/^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/`. It has to be a *text* scan, not a s
- Verifier-role source writes trip structural ADDED_ANY: In inc-002 the Verifier attempted a write outside acceptance, tests, fixtures and .builder-heldout, and was denied because Verifier writes acceptance only, never product source. The increment still surfaced a structural 
- A held-out test mounted beside the checkout can dynamic-import the checkout's TypeScript by absolute path and resolve bare deps, with or without node_modules linked into the mount.: Emulating the gate (`cd <checkout> && pnpm exec vitest run --root <mount> --config <mount>/vitest.heldout.config.ts`, `BUILDER_REPO_ROOT` set), a test file in the mount successfully did all three of: - `await import(`${R
- FORCE RLS applies to cubit_migrate too — an ad-hoc owner connection with no cubit.scope gets 42501, which looks like a broken grant.: The core tables are `ENABLE` **and** `FORCE` ROW LEVEL SECURITY, and `tenant_isolation` fails closed on a NULL `current_setting('cubit.scope', true)`. So a scratch `pg` script that connects as `cubit_migrate` to poke at 
- Skeptic read-only violations spanned four different operations: The skeptic role hit read-only denials on xargs fan-out (only cat/head/wc/grep/rg allowed), a `set -e` shell option, `cp -r` into /tmp, and a psql `begin` transaction — four distinct attempts to perform or set up mutatin
- Verifier role-boundary denials repeated across the increment: The 'Verifier writes acceptance only' denial fired 9 times across several sessions/paths ($mou, node_m, git, etc.), plus 3 denials for editing locked Verifier-authored files (pins.test.ts, rls-enumeration.test.ts) and 1 
<!-- builder:lessons:end -->

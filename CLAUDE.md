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
- Verifier sandbox blocks whole-dir vitest runs and scratch tree copies; how to mutation-test a lint rule instead: Two harness guards bite the Verifier role in this repo, and both have a sanctioned workaround: - `pnpm vitest run tests/toolchain` (a whole directory) is refused — the product runner would recurse into `.builder-heldout/
- Builder sessions have no network — npm deps only install from the local pnpm store with `pnpm install --offline`: Builder sessions on this machine have no network access. `pnpm install` only works as `pnpm install --offline` against the store at `~/.local/share/pnpm/store/v10` plus its metadata cache, using a lockfile recovered from
- The gate's structural stage flags the declared tests/lint-fixtures Q-08 corpus as ADDED_ANY/ADDED_SUPPRESSION/NEW_SKIP_OR_ONLY even with correct RECORDED REASON markers: On the cubit foundation series, the gate's `structural` stage reports blocking findings (`ADDED_ANY`, `ADDED_SUPPRESSION`, `NEW_SKIP_OR_ONLY`) on `tests/lint-fixtures/*/bad.*` even though each flagged line carries `// RE
- In cubit Verifier sessions the dependency/ownership hooks block staging node_modules, so heldout_dryrun cannot run before the Builder creates package.json — and how to prove the set anyway: In a cubit Verifier session, `mcp__builder__heldout_dryrun` reports `HELDOUT_DEPS_MISSING` whenever the lane worktree has no `node_modules` — the case for inc-000 (no `package.json` yet). The Verifier cannot fix this: th
- denied 6× on inc-000-foundation: know the lawful path: Sessions on inc-000-foundation were denied 6 times with: > rm -rf is denied (scratch under /tmp or $TMPDIR is the exception — mcp__builder__scratch_dir answers with a guaranteed-writable directory in one turn) The lawful
- Reviewer kept reaching for execution to verify, not analysis: 9 of 16 denials this increment were the reviewer role trying to run/write/move probe scripts (probe.mjs, mktemp -d, mv to .test.mjs, sed -i, writes to $D) — all blocked because reviewer is read-only. The lawful path, in 
- J-004 axe: the threshold has flipped between spec issues — a gen-3 increment (2026-08-23) gates on serious/critical via the journey's own page object; read the increment's AC-3, never this file, to choose.: The threshold is spec-issue-specific and has flipped twice. **a gen-3 increment (2026-08-23, latest)** settles it back to serious/critical: its AC-3 and test contract say J-004 gates on `impact ∈ {serious, critical}` via
- An axe scan run the instant an element becomes visible reads its colour mid-fade and reports color-contrast on a defect nobody can see.: `await expect(alert).toBeVisible()` resolves on the *first* rendered frame. If the element arrives with a `--motion-state-duration` fade (S-Auth §11: the auth-error line, the notice swap, the refusal block), `expectNoAxe
- How better-auth 1.7.1 can be wired to the SEAM-TENANT handle without tripping cubit/db-seam-only, and the exact table shape its adapter expects.: Wiring better-auth 1.7.1 (gen 3, 2026-08-23) into cubit without a lint denial: - `cubit/db-seam-only` binds to every `src/**/*.ts`, so `src/server/auth.ts` may NOT import `pg`, `drizzle-orm`, or `db/schema`. `better-auth
- auth.api.getSession over a hand-built Request fails on the dynamic baseURL unless a host header is present; passing `request` returns a Response, not the session.: cubit's `auth` resolves its base URL per request from the host header against an allowlist (`baseURL: { allowedHosts, protocol: 'auto' }`). A `Request` constructed in-process (`new Request('http://127.0.0.1:3210/api/trpc
<!-- builder:lessons:end -->

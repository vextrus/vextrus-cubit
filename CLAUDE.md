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
- A fixture tsconfig that extends the root must set \"include\": [] — extends inherits include, while exclude never touches \"files\".: A one-file tsc-fixture project (`tests/lint-fixtures/<dir>/tsconfig.*.json`) that `extends: "../../../tsconfig.json"` still inherits the base's `include`, so `"files"` alone compiles the whole product tree with it — any 
- The Q-07 refusal register counts a code \"exercised\" wherever its name appears in a test file — comments included — so an acceptance test that quotes a code grants it a free pass.: CUBIT's Q-07 register (inc-002, `src/core/__tests__/refusal-register.test.ts`) collects "exercised" codes by scanning test files for the code grammar `/^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/`. It has to be a *text* scan, not a s
- Verifier-role source writes trip structural ADDED_ANY: In inc-002 the Verifier attempted a write outside acceptance, tests, fixtures and .builder-heldout, and was denied because Verifier writes acceptance only, never product source. The increment still surfaced a structural 
- A held-out test mounted beside the checkout can dynamic-import the checkout's TypeScript by absolute path and resolve bare deps, with or without node_modules linked into the mount.: Emulating the gate (`cd <checkout> && pnpm exec vitest run --root <mount> --config <mount>/vitest.heldout.config.ts`, `BUILDER_REPO_ROOT` set), a test file in the mount successfully did all three of: - `await import(`${R
- FORCE RLS applies to cubit_migrate too — an ad-hoc owner connection with no cubit.scope gets 42501, which looks like a broken grant.: The core tables are `ENABLE` **and** `FORCE` ROW LEVEL SECURITY, and `tenant_isolation` fails closed on a NULL `current_setting('cubit.scope', true)`. So a scratch `pg` script that connects as `cubit_migrate` to poke at 
- Skeptic read-only violations spanned four different operations: The skeptic role hit read-only denials on xargs fan-out (only cat/head/wc/grep/rg allowed), a `set -e` shell option, `cp -r` into /tmp, and a psql `begin` transaction — four distinct attempts to perform or set up mutatin
- Verifier role-boundary denials repeated across the increment: The 'Verifier writes acceptance only' denial fired 9 times across several sessions/paths ($mou, node_m, git, etc.), plus 3 denials for editing locked Verifier-authored files (pins.test.ts, rls-enumeration.test.ts) and 1 
- How the CUBIT gate's held-out suite runs the app, and the leftover-server failure it produces: The held-out acceptance area copies the repo to `/tmp/builder-heldout-<id>/repo`, creates and seeds the database `cubit_heldout` on 127.0.0.1:5544, exports an absolute `MAIL_OUTBOX_DIR` (`/tmp/cubit-heldout-outbox-XXXXXX
- The lane app on $PORT runs against cubit_dev, which nobody re-migrates after a fix round — a missing trigger reads as a missing feature.: The lane's running app (dev server on `$PORT`, database `cubit_dev`) is not re-migrated when an increment adds a migration. On 2026-08-20 the fix round added `db/migrations/0003_system_scope_and_personal_tenant.sql` (the
- A loading.tsx above a session-gated Next route answers 200 with the page's shell and streams the redirect afterwards: Measured on the Foundation build (Next 16, production `pnpm start`): with `src/app/(auth)/loading.tsx` present, an anonymous request to `/account/sessions` got **HTTP 200 and the skeleton of that screen**, and only reach
<!-- builder:lessons:end -->

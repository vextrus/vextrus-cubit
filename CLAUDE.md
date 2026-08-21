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
- How the CUBIT gate's held-out suite runs the app, and the leftover-server failure it produces: The held-out acceptance area copies the repo to `/tmp/builder-heldout-<id>/repo`, creates and seeds the database `cubit_heldout` on 127.0.0.1:5544, exports an absolute `MAIL_OUTBOX_DIR` (`/tmp/cubit-heldout-outbox-XXXXXX
- The lane app on $PORT runs against cubit_dev, which nobody re-migrates after a fix round — a missing trigger reads as a missing feature.: The lane's running app (dev server on `$PORT`, database `cubit_dev`) is not re-migrated when an increment adds a migration. On 2026-08-20 the fix round added `db/migrations/0003_system_scope_and_personal_tenant.sql` (the
- A loading.tsx above a session-gated Next route answers 200 with the page's shell and streams the redirect afterwards: Measured on the Foundation build (Next 16, production `pnpm start`): with `src/app/(auth)/loading.tsx` present, an anonymous request to `/account/sessions` got **HTTP 200 and the skeleton of that screen**, and only reach
- The Verifier's ownership hook matches product-source filenames anywhere in a Bash command, including under /tmp, so scratch setups must avoid those names entirely.: The builder-work hook that keeps the Verifier off product source matches **filenames in the Bash command text**, not the resolved write target. In the inc-000 lane it refused `cat > package.json` inside `/tmp/vfy-scratch
- In a builder session curl is sandbox-denied but pnpm/uv/node fetch reach the real registries — don't conclude \"offline\" from a curl failure.: In a VEXTRUS CUBIT builder session (observed 2026-08-21, inc-000-foundation), `curl` is refused by the Bash sandbox with "no network from a build session", but `pnpm install`, `uv lock` and `node` scripts calling `fetch(
- pnpm runs scripts through /bin/sh, so a PATH-restricted spawn dies silently (exit 254) unless .npmrc sets shell-emulator=true: `pnpm run <script>` resolves `sh` through PATH. The inc-000 checkup acceptance test spawns `pnpm run checkup` with `PATH=dirname(process.execPath)` to hide `uv`; with only node's bin dir on PATH, pnpm prints its banner, 
- The gate's Q-08 structural scan greps text, so a rule or doc that spells a forbidden directive reports itself.: CUBIT's gate runs a structural diff over the increment and prints `ADDED_SUPPRESSION <file>: <line>`, `ADDED_ANY`, `NEW_SKIP_OR_ONLY` for every line matching `eslint-disable`, `@ts-ignore`, `@ts-expect-error`, `.skip(`, 
- A Playwright click awaits a document navigation but not a server action's fetch — why CUBIT's session revoke is a plain form POST: Playwright's `click()` returns once a navigation the click started has *committed*, but a React server action submits by background fetch, so the click is over as soon as the request is dispatched. CUBIT's `/account/sess
- handle.transaction() over the SEAM-TENANT ScopedPool commits the first write and drops the rest — use one statement (CTE) instead.: In cubit, `forTenant()` / `runAsSystem()` hand back a drizzle handle wrapping the seam's own `ScopedPool` (src/core/db.ts). Wrapping two writes in `handle.transaction(...)` *looks* right and passes typecheck, lint and th
- TMPDIR is unset in the CUBIT lanes, so `cd \"$TMPDIR\" || cd /tmp` silently keeps you in the repo: In the CUBIT builder-work lanes `TMPDIR` is not set, and bash's `cd ""` *succeeds* as a no-op. So the common scratch idiom `cd "$TMPDIR" 2>/dev/null || cd /tmp` never reaches the fallback: `mkdir -p scratch` then creates
<!-- builder:lessons:end -->

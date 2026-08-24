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
- A read-only pane taller than the viewport makes axe flag .shell-main serious (scrollable-region-focusable), because the shell's scroll container then holds nothing focusable.: Checked 2026-08-24 on `/t/{slug}/p/{id}/settings/ruleset` (inc-012). `.shell-main` carries `overflow-y: auto` (src/ui/shell/shell.css). Any area whose content overflows it and that mints no control at all — a purely read
- The held-out mount CAN build and serve cubit — real node_modules, NEXT_DIST_DIR=.next-e2e leaves git clean, and only db-migrate.mjs can make a database there.: Probed 2026-08-24 from inside a `heldout_dryrun` (inc-012). The mount is `/tmp/builder-heldout-<id>/heldout` beside `/tmp/builder-heldout-<id>/repo`, and in the repo: - `BUILDER_REPO_ROOT` = the checkout, `cwd` = the che
- State is the engine's own, not the product's: A session in inc-012 tried three times to read /home/riz/vextrus-builder/state/... from within a worktree session, each time denied with the same rule: state is the engine's own, not the product's (§10) — work in your wo
- A real signed-in session (and any route claim) in-process — call the exported route handler with a constructed Request; no next build, no next start, no fetch.: A Next route handler is just `(req: Request, ctx) => Promise<Response>`. Under vitest, importing `src/app/api/**/route.ts` by an absolute path and calling its `GET`/`POST` exercises the real product path with no server a
- Q-07's orphan half flags any SCREAMING_SNAKE string literal under src/ that the closed taxonomy does not carry — including tRPC's NOT_FOUND transport code.: `src/core/__tests__/refusal-register.test.ts` collects every string literal in `src/**` (excluding `src/core/errors/` and `__tests__`) matching `/^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/` and calls one the register does not carry 
- A held-out run inherits no usable database — cubit_dev has no schema and DATABASE_URL is unset; provision one by spawning scripts/db-migrate.mjs.: Checked 2026-08-24 (inc-011 dry run): in the held-out mount `DATABASE_URL` is unset, so `src/core/db.ts` falls back to `cubit_dev` — and `cubit_dev` has **no tables at all** (`42P01 relation "public.users" does not exist
- auth.api.getSession over a hand-built Request fails on the dynamic baseURL unless a host header is present; passing `request` returns a Response, not the session.: cubit's `auth` resolves its base URL per request from the host header against an allowlist (`baseURL: { allowedHosts, protocol: 'auto' }`). A `Request` constructed in-process (`new Request('http://127.0.0.1:3210/api/trpc
- denied 3× on inc-011-trpc-api: know the lawful path: Sessions on inc-011-trpc-api were denied 3 times with: > the product's whole test runner would discover .builder-heldout/ inside the tree and recurse (m0-01 attempt 8). Use the tool: `mcp__builder__heldout_dryrun` run Th
- Test runner recursion into .builder-heldout repeats until config excludes it: The same denial fired 3x in a single attempt (m0-01 attempt 8): the product's whole test runner discovering .builder-heldout/ inside the tree and recursing into it. This is a harness-shape fault, not a Builder mistake — 
- A .builder-heldout/tsconfig.json that extends ../tsconfig.json makes the whole set fail to transform at the mount — zero tests, not a failing claim.: Checked 2026-08-24 (Vitest 4.1.11 / Vite 8, oxc transform). At gate time `.builder-heldout/` is mounted as `/tmp/builder-heldout-<id>/heldout` beside `../repo`, so `"extends": "../tsconfig.json"` resolves to nothing. Vit
<!-- builder:lessons:end -->

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
- Stage talks to localhost:3210, but `pnpm start`/`pnpm build` are stub lanes — serve the app yourself with npx next build && npx next start -p 3210.: `scripts/lane.mjs` still stubs `dev`, `build` and `start`: `pnpm start` prints `start: SKIP LANE_NOT_YET_BUILT` and binds nothing, so `mcp__stage__open` answers `ERR_CONNECTION_REFUSED`. `pnpm verify` builds through its 
- mcp__stage__console_logs replays a buffer from earlier sessions — reproduce a console finding in a fresh chromium before believing it.: On 2026-08-23 (inc-007b) `mcp__stage__console_logs`, called immediately after a successful `mcp__stage__open('/design')` against a freshly started **production** server, returned `[HMR] connected`, React-DevTools chatter
- Setting data-theme in jsdom and re-rendering proves nothing — grade the dark scope off the token sheet via fs, and the paint via the screenshot suite.: jsdom applies no CSS and Cubit's theming is CSS-only (`src/ui/tokens.css` defines `:root, [data-theme="light"]` and `[data-theme="dark"]`; no product code reads the attribute). So a test that sets `document.documentEleme
- A literal import of a module the Builder has not written yet makes vitest report the whole file as \"0 test\" — assemble the specifier at run time so each test fails on its own.: In the public vitest stage (vitest 4 / vite 8), a *literal* specifier is resolved while the file is transformed — `import type` is erased and harmless, but `await import('../../index')` inside a test or its support modul
- `next dev` regenerates CLAUDE.md (agentRules), dirtying a hook-locked file; the hook refuses any command naming it, so restore with `git checkout -- .`: Starting the app with `npx next dev` in the cubit tree prints "Generated CLAUDE.md for AI agents" and rewrites `CLAUDE.md` — Next 16's `agentRules` feature. `CLAUDE.md` is Cartographer-owned, and the ownership hook scans
- denied 3× on inc-007b-design-gallery: know the lawful path: Sessions on inc-007b-design-gallery were denied 3 times with: > .claude/** is locked (Bash: /home/riz/.claude/projects/-home-riz-vextrus-cubit/memory/MEMORY.md) The lawful path is in the denial's own words — follow it in
- Locked-path denials cluster when a session hunts for a workaround: One session accumulated 8 denials across three different locked paths (.claude/**, CLAUDE.md, state/) plus two read-only-Bash denials — the pattern of a session retrying a blocked write against a new target rather than a
- A throwing beforeAll makes vitest report its tests as SKIPPED, not failed — so an acceptance suite proves no red; memoise the setup and call it from inside each test.: Vitest 4 reports every test in a `describe` whose `beforeAll` threw as **skipped** (`↓`), not failed. On inc-104 (2026-08-22) the first draft of the cad acceptance ran the CLI in `beforeAll`; with the CLI absent the run 
- db/__tests__/lanes-armed.test.ts froze STILL_STUBS, so arming a lane reddened `pnpm test:db`; the 2026-08-22 arbitration ruled TEST_AMENDED and it now derives the roster.: inc-001's acceptance file `db/__tests__/lanes-armed.test.ts` used to hardcode `STILL_STUBS` (eleven script names) and assert twice over it: every listed script must print `<script>: SKIP LANE_NOT_YET_BUILT`, and `tests/t
- A lane that drops a database `with (force)` crashes any vitest suite holding an idle pg Client on it — 7 green tests, exit 1.: `drop database … with (force)` terminates every other session on that database (57P01). A `pg.Client` with no `'error'` listener re-emits that as an **uncaught exception**, so a suite that opened a connection to the scra
<!-- builder:lessons:end -->

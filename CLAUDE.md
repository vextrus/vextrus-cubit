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
- After Escape, Radix restores focus from an unmount cleanup that runs after the surface has left the DOM, so toBeHidden returning does not mean the page is done moving focus.: A Playwright loop that dismisses one Radix overlay and immediately focuses the next trigger presses its key on the *previous* trigger. `expect(surface).toBeHidden()` resolves when the surface leaves the DOM, but Radix's 
- The /design theme flip is instant but every .datum-control transitions its colours for --motion-state-duration; a computed-style read right after the toggle returns an interpolated colour.: `s-design` §3 says the theme flip carries no transition, and that is true of the flip itself — but `primitives.css` gives `.datum-control` (so every field, trigger and button) `transition: background-color/border-color/c
- Verifier acceptance that spawns a lane (pnpm e2e / verify) belongs in db/__tests__ even though ownership_check calls it scope drift.: When an increment's own deliverable is a test lane (e.g. inc-007c ships `tests/e2e/j-004-design.spec.ts`), the Verifier cannot put acceptance in the increment's ownership paths — writing there locks the Builder out — and
- A full-page axe scan with a Radix menu/select open trips region, aria-hidden-focus and page-has-heading-one; Dialog/Sheet trip none of them.: Measured on J-004 (2026-08-23, radix-ui 1.6.7, axe-core via @axe-core/playwright 4.13.0), one `expectNoAxeViolations(page)` per open overlay on `/design`: - **DropdownMenu, ContextMenu, Select** (Radix `modal` by default
- eslint's seam block covers db/** as well as src/**, so a test there cannot write 0.002 — read a pinned config number as a string.: `eslint.config.mjs` binds `cubit/no-float-arithmetic` (and the other seam rules) to `src/**/*.ts` **and `db/**/*.ts`** — which includes `db/__tests__/**`, where the lane-spawning acceptance suites live. So `expect(config
- /design is axe-red before any overlay opens: the Select placeholder fails contrast and the DataTable selection columnheader is empty.: Measured on J-004 (2026-08-23, `pnpm e2e --journey J-004`, `expectNoAxeViolations(page)` on a plain `/design` navigation, both themes): - `color-contrast` (**serious**) on `.datum-select-trigger[data-placeholder] > span`
- The playwright CLI with --update-snapshots=all DOES run from Bash; point it at a hand-started next start on 3211 with the lane's env.: Capturing committed Linux baselines (inc-007e, 2026-08-23) does not need a bespoke `chromium.launch()` script. `node_modules/.bin/playwright test --config playwright.config.ts --grep <J> --update-snapshots=all` runs from
- db/__tests__ acceptance runs only via `pnpm test:db <filter>`; a bare `pnpm vitest run db/__tests__/x.test.ts` finds no test files and exits 1.: `mcp__builder__acceptance_status` prints the gate command for a db-hosted acceptance file as `pnpm vitest run db/__tests__/j-004-design.test.ts`. That command does not work from a session: the root vitest config's `inclu
- J-004 axe: the threshold has flipped between spec issues — inc-007e (2026-08-23) gates on serious/critical via the journey's own page object; read the increment's AC-3, never this file, to choose.: The threshold is spec-issue-specific and has flipped twice. **inc-007e (2026-08-23, latest)** settles it back to serious/critical: its AC-3 and test contract say J-004 gates on `impact ∈ {serious, critical}` via `expectN
- Stage talks to localhost:3210, but `pnpm start`/`pnpm build` are stub lanes — serve the app yourself with npx next build && npx next start -p 3210.: `scripts/lane.mjs` still stubs `dev`, `build` and `start`: `pnpm start` prints `start: SKIP LANE_NOT_YET_BUILT` and binds nothing, so `mcp__stage__open` answers `ERR_CONNECTION_REFUSED`. `pnpm verify` builds through its 
<!-- builder:lessons:end -->

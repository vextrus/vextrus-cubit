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
- A throwing beforeAll makes vitest report its tests as SKIPPED, not failed — so an acceptance suite proves no red; memoise the setup and call it from inside each test.: Vitest 4 reports every test in a `describe` whose `beforeAll` threw as **skipped** (`↓`), not failed. On inc-104 (2026-08-22) the first draft of the cad acceptance ran the CLI in `beforeAll`; with the CLI absent the run 
- db/__tests__/lanes-armed.test.ts froze STILL_STUBS, so arming a lane reddened `pnpm test:db`; the 2026-08-22 arbitration ruled TEST_AMENDED and it now derives the roster.: inc-001's acceptance file `db/__tests__/lanes-armed.test.ts` used to hardcode `STILL_STUBS` (eleven script names) and assert twice over it: every listed script must print `<script>: SKIP LANE_NOT_YET_BUILT`, and `tests/t
- A lane that drops a database `with (force)` crashes any vitest suite holding an idle pg Client on it — 7 green tests, exit 1.: `drop database … with (force)` terminates every other session on that database (57P01). A `pg.Client` with no `'error'` listener re-emits that as an **uncaught exception**, so a suite that opened a connection to the scra
- A Radix modal Dialog with no DialogTrigger returns focus to nothing on close — the consumer must refocus its own trigger.: Radix's modal Dialog content sets `onCloseAutoFocus` to `event.preventDefault(); context.triggerRef.current?.focus()`. When a screen drives the dialog with a controlled `open` prop and renders its own button instead of `
- mapping --breakpoint-* into @theme by var() makes next build fail parsing its own CSS: `@theme { --breakpoint-lg: var(--breakpoint-lg); }` in `src/ui/globals.css` compiles, but Tailwind 4 spends breakpoints inside media queries — `.container` and every responsive variant emit `@media (width >= var(--breakp
- one `import type { Metadata } from 'next'` makes ProcessEnv require NODE_ENV tree-wide: `node_modules/next/types/global.d.ts` declares `readonly NODE_ENV: 'development' | 'production' | 'test'` as a *required* member of `NodeJS.ProcessEnv`. Importing anything from `next` — even a type — pulls that augmentat
- A \"did the DOM grow?\" probe is graded as a vacuous assertion; observe the words a live region says, not the node count.: inc-007's J-004 keyboard journey classified a gesture as a "response" whenever the count of painted elements under `body` rose inside a 900 ms poll — and it tried focus-alone before any activation key, so a previous spec
- heldout_dryrun's repo mount holds only committed files, so a support file the Verifier just wrote reads as missing.: `mcp__builder__heldout_dryrun` stands the mount beside a *checkout*, not beside the working tree: on inc-100 (2026-08-22) a brand-new, still-untracked `src/core/__tests__/support/s3-fake.ts` reported `expected false to b
- In an AMEND round heldout_dryrun says \"GREEN against a tree that does not implement the feature\" — the tree does implement it; that verdict is not a defect.: `mcp__builder__heldout_dryrun` prints its verdict from the pass/fail counts alone and always narrates a green run as "the set is GREEN against a tree that does not implement the feature. A test that passes today is a non
- A TEST_AMENDED arbitration can name a file that is not a test (fonts.conf, a design doc) — the Verifier's amendment is acceptance encoding the upheld half, not an edit to that file.: An arbitration is titled by the *location of the dispute*, not by a test file: on 2026-08-22 inc-007 got "arbitration on tests/e2e/fonts.conf:1 — TEST_AMENDED", where the objection was a reviewer/skeptic TEST_INTEGRITY f
<!-- builder:lessons:end -->

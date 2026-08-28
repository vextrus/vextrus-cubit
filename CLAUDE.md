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
- Two acceptance-file traps in cubit — a hoisted vi.mock breaks new URL(import.meta.url) under jsdom, and a regex comment-stripper eats playwright's testMatch globs: Both found writing the shell increment's acceptance on 2026-08-28, both cost a debug cycle. **1. `new URL("../../", import.meta.url)` throws `TypeError: The URL must be of scheme file`** in a vitest 4.1.11 jsdom test *th
- A public test that scans a Builder-owned source file must be proven satisfiable against a mock tree in scratch, or its regexes ship false reds: Acceptance that judges a file the Builder has not written yet (a Playwright spec, a config key, a committed baseline) can only assert *about its text*. Those assertions go red today for the right reason and still be wron
- Bind \"selection = 3 px inset beam bar + beam-100 row fill\" by probing every mechanism that could paint it, plus a named token palette and an unselected control row: R-UI-030-style clauses name a *painted mark* ("selection = 3 px inset beam bar + beam-100 row fill"). Two traps: asserting only the row fill leaves an implementation with no bar passing, and asserting one CSS mechanism t
- A held-out set can stage a whole browser journey in cubit — own database, next build (~7 s), sign-up through the shipped doors — inside the frame's timeouts: Proved on the shell increment (2026-08-28): the frame's `buildAndServe()` + `launchChromium()` are usable in cubit for screen-level held-out acceptance, and the whole staged run (provision → build → serve → two accounts 
- tests/journeys/e2e-journey-tags-breaker.test.ts hardcodes GATE_JOURNEYS = [\"J-000\",\"J-001\"], so the first spec of any new journey reds pnpm verify: `tests/journeys/e2e-journey-tags-breaker.test.ts` (from the auth increment) asserts that every `tests/e2e/journeys/*.spec.ts` carries a tag the gate greps for, and reads that roster off a frozen constant: ```ts const GAT
- cubit's journey database `cubit_e2e` is named and additive, not per-run — a visual baseline needs a fixed identity plus idempotent enrolment: `tests/e2e/support/scratch-db.ts` provisions **one named database, `cubit_e2e`**, and says so: "named rather than randomised … Provisioning is additive". The global setup creates it only when `pg_database` lacks it and t
- User-supplied text as a link's only content fails axe link-name; cubit's \"take it as presented\" auth reading does not transfer to a screen whose contract names a refusal string: In cubit, the auth doors take names "as presented" (s-auth I-13: `workspaceName()` is just `storableText()`, no blankness judgement), so a sign-up or a rename can store a workspace name that trims to nothing. The shell t
- Grade painted CSS against cubit's tokens without spelling a value: resolve var(--token) through a hidden probe element inside page.evaluate: A browser test that wants to assert "this card's border is `--danger` and its padding is `--space-3`" cannot compare a computed style to the token: `getComputedStyle(el).borderBlockStartColor` is already resolved (`rgb(…
- Tagging users.email's stored key forces session.ts's mail() call sites onto the presented address — outbox.ts matches mail.to exactly: `src/server/auth/session.ts` used to pass the *stored* address (`storedAddress(...)`) straight into `mail(origin, to, …)`. That was invisible while the fold was untagged, because for every ordinary address the stored val
- A main merge can leave playwright.config.ts with a duplicate webServer key and a testMatch that collects only the other increment's spelling — re-run both journeys after any merge: On 2026-08-27, merging `origin/main` (the root document increment) into the the auth core increment branch left `playwright.config.ts` with **two `webServer` keys** (the later one wins, silently dropping `env: { DATABASE
<!-- builder:lessons:end -->

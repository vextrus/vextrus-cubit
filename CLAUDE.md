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
- Grade painted CSS against cubit's tokens without spelling a value: resolve var(--token) through a hidden probe element inside page.evaluate: A browser test that wants to assert "this card's border is `--danger` and its padding is `--space-3`" cannot compare a computed style to the token: `getComputedStyle(el).borderBlockStartColor` is already resolved (`rgb(…
- Tagging users.email's stored key forces session.ts's mail() call sites onto the presented address — outbox.ts matches mail.to exactly: `src/server/auth/session.ts` used to pass the *stored* address (`storedAddress(...)`) straight into `mail(origin, to, …)`. That was invisible while the fold was untagged, because for every ordinary address the stored val
- A main merge can leave playwright.config.ts with a duplicate webServer key and a testMatch that collects only the other increment's spelling — re-run both journeys after any merge: On 2026-08-27, merging `origin/main` (the root document increment) into the the auth core increment branch left `playwright.config.ts` with **two `webServer` keys** (the later one wins, silently dropping `env: { DATABASE
- Never file a FaultRecord from createContext — tests/server assert the sink is empty for a refusal, so a per-request config fault reddens them: `tests/server/seam-hardening.test.ts` (and its neighbours through `tests/server/support/wire.ts`'s `withFaultSink`) assert `expect(records).toHaveLength(0)` after driving a *refusal* through the wire. `wire.ts` builds it
- A held-out set can drive cubit's auth doors through the shipped route handler in-process — no next build, and newestMail still finds the mail: A held-out (or public) suite that needs the real auth doors does **not** need the frame's `buildAndServe()` (a `next build` inside a 120 s hook budget is the risk it looks like). The shipped route module is a fetch handl
- cubit's db/__tests__ auth acceptance calls createContext with http://cubit.test, so any seam keyed on \"the deployment named its own origin\" goes red unless the harness sets CUBIT_PUBLIC_ORIGIN: Every auth door test under `db/__tests__/` builds its context from `new Request("http://cubit.test/api/trpc/spine.auth", …)` — a **non-loopback** host — while `db/__tests__/auth-reset-supersedes-links-breaker.test.ts` us
- Playwright's default testMatch does not collect cubit's *.e2e.ts journeys, \"no tests found\" exits 1, and the --list --reporter=json shape: Probed with Playwright 1.62.1 (the pin in cubit's package.json) on 2026-08-27, from a scratch config with a `node_modules` symlink: - **Default `testMatch` is `**/*.@(spec|test).?(c|m)[jt]s?(x)`** — it does NOT match cub
- X comes from the string table, not a literal" is invisible to runtime equality — bind it with a marked, comment-stripped source scan: Audited defect on the root document increment (2026-08-27), AC-1. The criterion was "metadata.title comes from the typed string table, not a spelled literal", and the test asserted `metadata.title === strings.app_title`.
- In cubit, `next dev` appends an agent-rules block to CLAUDE.md — a hook-locked file — so use `next build && next start` to look at screens: Next 16.3.1's `next dev` runs `node_modules/next/dist/server/lib/generate-agent-files.js`, which appends a `<!-- BEGIN:nextjs-agent-rules -->` block to the repo's `CLAUDE.md` and re-adds it every start. In cubit `CLAUDE.
- scripts/e2e.mjs honours only the first --journey and forwards the rest to Playwright, whose commander CLI dies on \"unknown option '--journey'\" — a two-journey gate command is unclearable in-tree: `scripts/e2e.mjs` (hard-locked, `pnpm e2e`) reads the journey with `args.indexOf("--journey")` and filters out **only that one pair**; everything else in argv is passed straight through to `node node_modules/@playwright/
<!-- builder:lessons:end -->

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
- Q-11's \"never widened to any-impact\" must be read in comparison/membership position inside the axe-taint chain, never as a whole-source substring ban: Arbitration struck the same acceptance shape twice on that increment (2026-08-29): a negative substring scan over the concatenated journey spec + page object asserting the words "minor"/"moderate" appear nowhere in any q
- An acceptance constant pinning playwright.config.ts's snapshotPathTemplate cannot be satisfied once another increment's specs share the journey tag and its baselines already sit under the template's directory: the design gallery increment's locked acceptance (`tests/journeys/j-004-gallery-contract.test.ts`, `SNAPSHOT_TEMPLATE`) requires `snapshotPathTemplate === "tests/e2e/baselines/{arg}{ext}"`, written when the increment bel
- Three corrections to the held-out browser staging recipe: the nameplate door is unreachable after a fresh-context sign-in, sign-in needs a URL wait, and next build type-checks tests/**: Proved on the density prefs increment (2026-08-29). Companion to [[heldout-browser-journey-staging]] — believe these over that file where they disagree. - **`root-home-workspace-door` is NOT reachable after a fresh-conte
- Grade a shipped component's real, token-resolved geometry from a held-out set: render it in jsdom, transplant its markup into a live page, inject the stylesheet no route serves, measure the border box: Proved on the density prefs increment (2026-08-29): a held-out criterion of the form "component X handed prop P renders at token T's value" is gradeable end to end even when **no shipped route serves the component's styl
- A new cubit table cannot be added without writing db/schema/**, because the drift lane generates only from db/schema.ts: Every cubit table is *defined* in `src/core/db.ts`, but drizzle-kit only ever sees `db/schema.ts` → `db/schema/index.ts` → a per-area file (`identity.ts`, `acts.ts`, …) that **named**-re-exports the tables from `src/core
- /design sits under src/app/(app), whose layout redirects sessionless requests to /sign-in, and main's shell.spec.ts is also titled \"J-004\" so one --journey J-004 run executes two specs: After the shell increment merged (2026-08-29), `src/app/(app)/layout.tsx` calls `presentedSessionToken()` and `redirect("/sign-in")` when it is null. `/design` lives under that segment, so a journey that does `page.goto(
- A UI/e2e-heavy increment without the toolchain tag repeatedly hits locked config: An increment doing gallery/visual/e2e work but not tagged toolchain tried repeatedly to touch playwright.config.ts, the e2e test config, and toolchain scripts, drawing many locked-unless-tagged-toolchain denials across a
- Editing a Verifier-authored test file instead of objecting to it: A locked-path denial fired on a test file explicitly noted as Verifier-authored, alongside a cluster of TEST_INTEGRITY findings from both reviewer and skeptic. The tell: a builder session treats a Verifier-owned acceptan
- A rollback-wrapped probe INSERT through cubit_app proves \"this scope may write, that one may not\" without polluting the store: Arbitration on that increment (2026-08-29) ruled that a policy posture asserted only from `pg_policy` text is unfalsifiable: widening a policy left every lane green. A live suite proves a write posture *behaviourally*, t
- jsonb re-orders object keys on the way in, so a document whose own key order a screen renders must be stored as json: The rule-set edition store (`ruleset_editions`, `tenant_ruleset_editions` in `src/core/db.ts`) holds `parameters`/`methods` as **`json`, not `jsonb`**. **Why:** `jsonb` normalises — it sorts object keys by (length, byte 
<!-- builder:lessons:end -->

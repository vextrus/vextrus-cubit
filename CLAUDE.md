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
- B-20's re-baseline proof has two halves — a negative sha256 pin plus a real toHaveScreenshot — and the second half can run from a journey that does not own the screen by re-enrolling the baselined spec's fixed identity: Arbitrated on the projects increment (2026-08-30). A sha256 `not.toBe` against the pre-increment bytes proves only that regeneration *happened*; a truncated file, a re-encode or a capture of the wrong viewport satisfies 
- shell-settings-name holds only label, hint, notice and button — the workspace name lives in the Input's value, so toContainText over that section can never see it: `src/app/(app)/t/[tenant]/settings/rename-form.tsx` renders `<section data-testid="shell-settings-name">` containing exactly: the `shell_settings_name_label` label, the `shell_settings_name_hint` hint, the core `Input` (
- Reverting a locked migration edit doesn't un-stale the snapshot: A plan touched a locked migration file; the hook denied the write, but the file had already been touched once and reverted, leaving the schema snapshot out of sync with the locked source. The structural gate then fired S
- Q-11's \"never widened to any-impact\" must be read in comparison/membership position inside the axe-taint chain, never as a whole-source substring ban: Arbitration struck the same acceptance shape twice on that increment (2026-08-29): a negative substring scan over the concatenated journey spec + page object asserting the words "minor"/"moderate" appear nowhere in any q
- An acceptance constant pinning playwright.config.ts's snapshotPathTemplate cannot be satisfied once another increment's specs share the journey tag and its baselines already sit under the template's directory: the design gallery increment's locked acceptance (`tests/journeys/j-004-gallery-contract.test.ts`, `SNAPSHOT_TEMPLATE`) requires `snapshotPathTemplate === "tests/e2e/baselines/{arg}{ext}"`, written when the increment bel
- Three corrections to the held-out browser staging recipe: the nameplate door is unreachable after a fresh-context sign-in, sign-in needs a URL wait, and next build type-checks tests/**: Proved on the density prefs increment (2026-08-29). Companion to [[heldout-browser-journey-staging]] — believe these over that file where they disagree. - **`root-home-workspace-door` is NOT reachable after a fresh-conte
- Grade a shipped component's real, token-resolved geometry from a held-out set: render it in jsdom, transplant its markup into a live page, inject the stylesheet no route serves, measure the border box: Proved on the density prefs increment (2026-08-29): a held-out criterion of the form "component X handed prop P renders at token T's value" is gradeable end to end even when **no shipped route serves the component's styl
- A new cubit table cannot be added without writing db/schema/**, because the drift lane generates only from db/schema.ts: Every cubit table is *defined* in `src/core/db.ts`, but drizzle-kit only ever sees `db/schema.ts` → `db/schema/index.ts` → a per-area file (`identity.ts`, `acts.ts`, …) that **named**-re-exports the tables from `src/core
- /design sits under src/app/(app), whose layout redirects sessionless requests to /sign-in, and main's shell.spec.ts is also titled \"J-004\" so one --journey J-004 run executes two specs: After the shell increment merged (2026-08-29), `src/app/(app)/layout.tsx` calls `presentedSessionToken()` and `redirect("/sign-in")` when it is null. `/design` lives under that segment, so a journey that does `page.goto(
- A UI/e2e-heavy increment without the toolchain tag repeatedly hits locked config: An increment doing gallery/visual/e2e work but not tagged toolchain tried repeatedly to touch playwright.config.ts, the e2e test config, and toolchain scripts, drawing many locked-unless-tagged-toolchain denials across a
<!-- builder:lessons:end -->

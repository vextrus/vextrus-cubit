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
- The held-out mount DOES import product .ts modules outside its vite root — a scratch probe that says otherwise needs server.fs.allow [\"/\"]: Verified on that increment (2026-08-26), both directions: - **The real mount is fine.** `productModule("src/ui/primitives/overlay/index.ts")` — an existing `.ts` barrel with CSS imports, living in `/tmp/builder-heldout-*
- cubit's no-raw-intl lint flags String.prototype.localeCompare anywhere in the tree, tests included — sort by code point instead: In cubit, `cubit/no-raw-intl` is bound to `**/*.{ts,tsx,mts,mjs,js}` (not just `src/`), and it reads `localeCompare` as a call into the platform's locale machinery: "src/core/format.ts is the tree's sole caller of Intl; 
- How to make \"this prop is required by the component's type\" a real cubit assertion — a conditional type in a .ts (never .tsx) acceptance file: A criterion like "the evidence prop is required by the component's type" (that increment AC-4) is invisible to any runtime render. Make `tsc` the runner: ```ts import * as React from "react"; import type { RefusalState a
- Intl's en-IN/en-GB short month for September is \"Sept\" (ICU 78), so DD MMM YYYY month names are pinned as data in BD_DOCUMENT: Under Node 24 (ICU 78) `new Intl.DateTimeFormat("en-IN", { month: "short" })` renders September as **"Sept"**, not "Sep" — same for `en-GB`. Cubit's L-FMT-01 date format is `DD MMM YYYY` with English three-letter months,
- A stranded public test in cubit — widening the include in an OWNED vitest.config.ts is the fix; move and delete stay blocked: When the engine reports a public acceptance file "collected by NOTHING in this tree" and offers three fixes, verified on the datum tokens increment (`src/ui/tokens.test.ts` matched none of the root config's include globs
- A literal dynamic import of a not-yet-installed package kills the whole held-out mount at transform time; resolve it out of the checkout instead: In the held-out mount, `await import("some-pkg")` with a **literal** specifier is resolved by vite's `import-analysis` plugin at TRANSFORM time. If the package is not installed yet — which is normal for a Verifier, whose
- The /design gallery leaf owes a browser assertion that arrow keys change ResizableHandle's aria-valuenow — a required companion to that increment's arbitrated AC-8 amendment: Arbitration on that increment (2026-08-26) ruled TEST_AMENDED on the held-out assertion that arrow keys change `ResizableHandle`'s `aria-valuenow`: Q-11 scopes semantic observation of keyboard responses to **journey chec
- cubit's tsconfig include covers tests/**/*.ts but not tests/**/*.tsx, so .tsx test files run under vitest yet never reach tsc: `tsconfig.json`'s `include` is `["next-env.d.ts", "scripts/**/*.mjs", "tests/**/*.ts", "src/**/*.ts", "src/**/*.tsx", "db/**/*.ts", "*.config.ts", ...]` — note `tests/**/*.tsx` is absent, while `src/**/*.tsx` is present.
- Radix Tooltip opens and closes under jsdom with no ResizeObserver polyfill, and src CSS imports typecheck via Next's declare module '*.css': Verified while building `src/ui/primitives/core` (that increment, 2026-08-26): - `@radix-ui/react-tooltip@1.2.16` mounts, opens on keyboard focus and closes on Escape under jsdom 30 + React 19 **without** a `ResizeObserv
- Run a throwaway vitest probe against cubit's src/ without adding a file to the tree — scratch config + node_modules symlink: A temporary `*.test.ts` written inside the cubit worktree cannot be cleaned up: the hook refuses `rm` on any test path ("never delete or rename a test to green a build"), so the probe becomes a permanent stray. Probe fro
<!-- builder:lessons:end -->

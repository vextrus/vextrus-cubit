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
- Intl's en-IN/en-GB short month for September is \"Sept\" (ICU 78), so DD MMM YYYY month names are pinned as data in BD_DOCUMENT: Under Node 24 (ICU 78) `new Intl.DateTimeFormat("en-IN", { month: "short" })` renders September as **"Sept"**, not "Sep" — same for `en-GB`. Cubit's L-FMT-01 date format is `DD MMM YYYY` with English three-letter months,
- A stranded public test in cubit — widening the include in an OWNED vitest.config.ts is the fix; move and delete stay blocked: When the engine reports a public acceptance file "collected by NOTHING in this tree" and offers three fixes, verified on the datum tokens increment (`src/ui/tokens.test.ts` matched none of the root config's include globs
- A literal dynamic import of a not-yet-installed package kills the whole held-out mount at transform time; resolve it out of the checkout instead: In the held-out mount, `await import("some-pkg")` with a **literal** specifier is resolved by vite's `import-analysis` plugin at TRANSFORM time. If the package is not installed yet — which is normal for a Verifier, whose
- The /design gallery leaf owes a browser assertion that arrow keys change ResizableHandle's aria-valuenow — a required companion to that increment's arbitrated AC-8 amendment: Arbitration on that increment (2026-08-26) ruled TEST_AMENDED on the held-out assertion that arrow keys change `ResizableHandle`'s `aria-valuenow`: Q-11 scopes semantic observation of keyboard responses to **journey chec
- cubit's tsconfig include covers tests/**/*.ts but not tests/**/*.tsx, so .tsx test files run under vitest yet never reach tsc: `tsconfig.json`'s `include` is `["next-env.d.ts", "scripts/**/*.mjs", "tests/**/*.ts", "src/**/*.ts", "src/**/*.tsx", "db/**/*.ts", "*.config.ts", ...]` — note `tests/**/*.tsx` is absent, while `src/**/*.tsx` is present.
- Radix Tooltip opens and closes under jsdom with no ResizeObserver polyfill, and src CSS imports typecheck via Next's declare module '*.css': Verified while building `src/ui/primitives/core` (that increment, 2026-08-26): - `@radix-ui/react-tooltip@1.2.16` mounts, opens on keyboard focus and closes on Escape under jsdom 30 + React 19 **without** a `ResizeObserv
- Run a throwaway vitest probe against cubit's src/ without adding a file to the tree — scratch config + node_modules symlink: A temporary `*.test.ts` written inside the cubit worktree cannot be cleaned up: the hook refuses `rm` on any test path ("never delete or rename a test to green a build"), so the probe becomes a permanent stray. Probe fro
- next-env.d.ts's generated `import \"./.next-cubit/types/*.d.ts\"` lines do NOT break tsc on a clean checkout — verified with a control probe: In the cubit tree, `npx tsc --noEmit --incremental false` exits 0 with `.next-cubit/` absent even though `next-env.d.ts` carries `import "./.next-cubit/types/routes.d.ts"` and `import "./.next-cubit/types/root-params.d.t
- creating src/app arms checkup's storage-root lane, so storage/.gitkeep is required for pnpm verify even though no increment owns storage/: In cubit, `scripts/lib/lanes.mjs` arms the machine check `storage-root` as soon as `src/app` exists, and `scripts/checkup.mjs` fails it unless `$STORAGE_ROOT` (default `<repo>/storage`) is a writable directory. `tests/to
- vitest can instantiate one product module twice under racing concurrent imports, so module-scope singletons (fault memo, fault sink) must live on a globalThis symbol: A module-scope `const` is NOT a process singleton under vitest. When two importers race the same first import — e.g. `Promise.all([import(trpc.ts), import(root.ts)])`, where root.ts also imports trpc.ts, which is exactly
<!-- builder:lessons:end -->

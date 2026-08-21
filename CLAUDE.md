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
- react-virtual's default rect observer degrades to a zero-height viewport without ResizeObserver — override observeElementRect/Offset to window from props: `@tanstack/react-virtual` 3.x does not throw in a bare jsdom: `observeElementRect` checks `targetWindow.ResizeObserver` and, finding none, falls back to one `getBoundingClientRect()` — which jsdom answers 0×0. The table 
- A held-out dry-run reports \"Cannot find module\" as HELDOUT_MOUNT_UNRESOLVED (the Verifier's defect) — assert the barrel exists before importing it.: `heldout_dryrun` classifies the run by its error text. When a held-out suite imports a product barrel that the Builder has not written yet, `import(`${REPO}/src/ui/x/index.ts`)` throws `Cannot find module …`, and the dry
- Radix's Slider throws on mount in a bare jsdom (ResizeObserver via useSize), and CUBIT's held-out suites appear to run without the public suites' shims.: `@radix-ui/react-slider` measures its thumb with `useSize` → `ResizeObserver` in a layout effect, so `render(<Slider/>)` throws `ReferenceError: ResizeObserver is not defined` in a jsdom with no shims. Radix Select addit
- In a Verifier session pnpm add / npm install are denied outright — even in a scratch directory outside the repo — so there is no sandbox to validate a library API against: A Verifier session on inc-005 tried three ways to stand up a scratch project outside the repo and install the increment's declared deps (radix-ui, sonner, RTL) to sanity-check test mechanics before writing acceptance. Al
- A held-out vitest config with environment 'jsdom' reports 'no tests' when jsdom is a dependency the Builder has not installed yet — resolve it in the config and fall back to node: Vitest resolves `test.environment` before it loads a single test file, so if `jsdom` is a dependency this increment *declares* but the Builder has not installed yet, `heldout_dryrun` reports `SUITE_DID_NOT_RUN` — pool wo
- formatNumber(value, kind) throws unless the string carries exactly the kind's fraction digits — quantity 3, count 0 — so a free-precision UI field cannot format in one call: `src/core/format.ts` exports `formatNumber(value: string, kind: 'quantity' | 'count')`, and `render()` refuses any value whose shape is not `-?\d+` (count, 0 digits) or `-?\d+\.\d{3}` (quantity, 3 digits); `formatMoney` 
- Declare test/runtime deps before importing them: Three separate denials this increment were for using undeclared dependencies (vitest, jsdom, react/react-dom, @types/react*, typescript, radix-ui, sonner, @testing-library/*) inside acceptance or component code before th
- Deleting/weakening a red test is not a fix: Across this increment the Builder tried three times to delete or rename a failing test (zz-probe.test.tsx, bare-dom-probe.test.tsx twice) and once to strip 2 expect/assert calls, all after a HELDOUT_RED/REVIEW_BLOCKED at
- Reviewer/skeptic sessions burn turns rediscovering the read-only allowlist: Across this increment, reviewer and skeptic sessions collectively hit ~35 denials for writes or non-allowlisted Bash (uv, python3 -c, node -e, pnpm install, mkdir, rm -rf, pnpm dev, etc.) before converging on the allowed
- a held-out roster assertion must derive the armed set by probing input roots, never freeze the set that was armed on delivery day: inc-000's held-out AC-6 originally carried a frozen `ARMED_STAGES = ['tsc','eslint','vitest','cad-ruff']` and asserted "the ok stages equal ARMED_STAGES". Once inc-001 founded `db/schema`, `pnpm verify` legitimately prin
<!-- builder:lessons:end -->

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

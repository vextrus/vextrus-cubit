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
- Q-07's orphan scan reads an ALL_CAPS interface property key in src/** as a refusal code — acceptance support under src/**/__tests__ can red the merged register test: `tests/refusal-register/scan.ts` classifies a name as *spelled* when it is a string literal **or a declared key** — `ts.isPropertySignature` included. `REFUSAL_SHAPE` is `/^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/`, so any SCREAMIN
- Q-07 'spelled but not wired' acceptance must parse the product file with the checkout's own typescript — a text scan cannot tell a returned literal from the contract's own type union: Found amending that increment's AC-6 after a discrimination audit (2026-08-30). Q-07 makes a registered refusal code spelled as a bare literal in a file that does not import the register a finding — but **asserting only 
- A seam's failure arm may not re-spell a code literal; REFUSALS needs a mapped-type annotation so entry.code keeps its key's literal type: Q-07's "spelled but not wired" is stricter than the public `tests/refusal-register/scan.ts`: that scan clears any file that imports `src/core/errors.ts`, but a held-out check parses the seam file and rejects a registered
- L-FRM-06's conversion-literal ban, scanned as a test: arbitration ruled the sweep must read RAW source (quotes change nothing) and forgive src/core/format.ts's 10.7639 by name under R-SPINE-010: L-FRM-06 says "a conversion literal outside the canon is a lint failure", but no eslint rule can be added (`scripts/eslint/**` is hard-locked), so it is enforced as an owned scan test in `src/core/units/__tests__/canon.t
- rm -rf denied repeatedly has a named lawful path: rm -rf was denied four times in a single increment — well past a one-off, meaning a session kept reaching for a bare rm -rf instead of the sanctioned scratch flow. The hook's own denial names the exception: scratch under
- Unscoped test runners recurse into held-out material: When a build session's test runner walks the whole tree without an explicit scope, it discovers .builder-heldout/ and tries to recurse into it — the hook denies the recursion, and separately any read or touch of the held
- SNAPSHOT_REGENERATED reds the structural stage for any baseline png that shows as M against the base branch — including one a Verifier regenerated after arbitration: Seen on the model call ledger increment (2026-08-30). The gate's structural stage emits `SNAPSHOT_REGENERATED <path>: snapshot/baseline M without a baseline: commit` for **any** baseline whose bytes differ from the base 
- Drive cubit's shipped eslint.config.mjs from a held-out set with createRequire — and why new public lint acceptance goes in tests/lint/, not tests/toolchain/: Verified 2026-08-30 on that increment (the `cubit/no-model-outside-seam` seam ban). **Held-out mount, no literal imports.** The set is mounted outside the checkout, so `import { ESLint } from "eslint"` resolves from the 
- S-Audit's merged tests freeze \"neither panel's table exists\" — creating model_calls or jobs reds one db file (writable) and J-003's audit.spec.ts (locked): the audit surfaces increment merged two frozen-state assertions that the increment shipping `model_calls` (or `jobs`) inevitably reds: - `db/__tests__/audit-surfaces.live.test.ts` — a case asserting `tableExists(...)` is
- pkill -f \"next start\" in a Bash call matches the wrapper shell's own command line and kills the call (exit 144): `pkill -f "next start"` run as part of a Bash tool call matches the harness's own wrapper shell, whose full command line contains that literal string — so the call kills itself and returns exit 144 with empty output. On 
<!-- builder:lessons:end -->

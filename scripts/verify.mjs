/**
 * `pnpm verify` — V-VERIFY: "`next typegen` → `tsc --noEmit` → `eslint .` → `vitest run` →
 * schema drift → method-hash manifest → catalogue/bears table drift → `ruff check` +
 * `pytest` (cad) → `next build` cold into its own distDir. Fail-fast; exit code is the
 * whole contract; wall time printed."
 *
 * Two rules hold this file together:
 *
 *   1. The contract lives on stdout. One line per roster stage, in roster order, then the
 *      final line. Everything a stage says for itself is captured and re-emitted on
 *      stderr, so `pnpm verify 2>/dev/null` still reads the whole contract, and the
 *      gate — which reports stderr after stdout — never interleaves the two.
 *   2. A stage arms when its input root exists, and skips with the recorded reason when it
 *      does not (C-06). Never a config flag, never an env var: the tree decides, so an
 *      increment cannot arm a lane by wishing.
 *
 * The roster itself and the line grammar live in scripts/lib/verify-roster.mjs, where the
 * tree's own suite can read and drive them (tests/toolchain/verify.test.ts). This file is
 * the entry point and nothing else.
 */
import { detail, say } from './lib/lane.mjs';
import { STAGES, runRoster } from './lib/verify-roster.mjs';

process.exitCode = await runRoster(STAGES, { say, detail });

/**
 * inc-003-datum-tokens — the collected entry point for the token acceptance suite.
 *
 * The assertions live one directory up, in `src/ui/tokens.test.ts`, beside the source they judge:
 * R-UI-001 puts the generated stylesheet and its drift test beside `src/ui/tokens.ts`, and AC-1
 * names that path. The unit lane's `include` (vitest.config.ts) collects `src/**\/__tests__/*.test.ts`
 * but not a suite sitting directly beside its module, so that file is never asked its question.
 *
 * Importing a test module re-registers its `describe`/`test` calls into this file's collection, so
 * the suite runs unmodified and un-duplicated from the path the lane already reaches. This shim is
 * scaffolding for the lane, not a second copy of the acceptance: it holds no assertions of its own.
 *
 * It becomes redundant the moment `src/ui/tokens.test.ts` is collected directly (AC-1 requires the
 * unit lane to collect it); it is deliberately trivial so that removing it costs nothing.
 */
import "../tokens.test";

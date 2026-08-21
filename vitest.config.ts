import { defineConfig } from 'vitest/config';

/**
 * V-VERIFY's `vitest run` stage. Unit, contract, golden formulas, the refusal
 * register, document payload schemas and the EntityGraph mirror fixtures all
 * land under tests/ as later increments arrive; today the toolchain's own
 * acceptance and the guardrail fixture suite are what there is.
 *
 * Several of these tests spawn `pnpm run <script>` to read a contract off
 * stdout, so the hook budget is generous where the test budget is not.
 */
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    exclude: ['node_modules/**', 'tests/e2e/**', '.cubit-scratch/**'],
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 180_000,
    reporters: ['default'],
    clearMocks: true,
  },
});

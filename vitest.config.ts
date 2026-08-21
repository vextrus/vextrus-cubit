/**
 * Vitest (4.x) — unit, contract, seam, golden-vector and refusal-register tests.
 *
 * The config is a plain object rather than `defineConfig` from `vitest/config`:
 * `defineConfig` is identity, and importing it makes config load depend on resolving the
 * runner's own package from wherever the tree happens to be mounted.
 */
export default {
  test: {
    // tests/ holds the suites that judge the tree from outside it; src/**/__tests__ holds the
    // ones that belong beside their module (the refusal register, Q-07, is the first). Both
    // are the vitest stage V-VERIFY names — a law that runs nowhere is not applied.
    include: [
      'tests/**/*.test.ts',
      'tests/**/*.test.tsx',
      'src/**/__tests__/*.test.ts',
      'src/**/__tests__/*.test.tsx',
    ],
    // tests/e2e is Playwright's (V-VERIFY keeps the e2e lane out of the vitest stage);
    // tests/lint-fixtures/<rule>/ holds lint inputs, not tests.
    exclude: ['node_modules/**', 'tests/e2e/**', 'tests/lint-fixtures/*/**'],
    environment: 'node',
    // Several suites spawn `pnpm run <script>` and lint whole files; a lint-and-spawn test
    // is slow by nature, and a timeout that fires is a false red.
    testTimeout: 120_000,
    hookTimeout: 120_000,
    reporters: ['default'],
    passWithNoTests: false,
  },
};

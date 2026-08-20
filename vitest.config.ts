import { defineConfig } from 'vitest/config';

/**
 * Two lanes, one config (tests/README.md):
 *
 *  - default: `pnpm test` and verify's vitest stage — unit and contract only,
 *    no database, no browser.
 *  - `CUBIT_TEST_LANE=db`: `pnpm test:db` — the live Postgres seam tests, which
 *    throw at import when the role URLs are unset, so they never join the
 *    default lane.
 */
const lane = process.env.CUBIT_TEST_LANE ?? 'default';

const INCLUDE = {
  default: ['tests/contract/**/*.spec.ts', 'src/**/__tests__/**/*.spec.ts'],
  db: ['db/__tests__/**/*.spec.ts'],
} as const;

export default defineConfig({
  test: {
    include: [...(lane === 'db' ? INCLUDE.db : INCLUDE.default)],
    // the register and the ledger read the tree through git (scripts/vitest-global-setup.mjs)
    globalSetup: ['scripts/vitest-global-setup.mjs'],
    exclude: ['node_modules/**', 'tests/e2e/**', 'tests/lint-fixtures/**', '.next/**', '.scratch/**'],
    environment: 'node',
    reporters: ['default'],
    // the db lane opens live connections; one file at a time keeps the ledger honest
    fileParallelism: lane !== 'db',
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});

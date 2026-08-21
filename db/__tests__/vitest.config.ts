/**
 * The V-DB lane's own Vitest config (V-DB, C-07).
 *
 * Every test under db/__tests__ opens a live PostgreSQL connection, so the suite is kept
 * out of the root config's `tests/**` include: `pnpm verify` and CI run without a
 * provisioned database, and a live-DB test there would be red for a reason that has
 * nothing to do with the code under review.
 *
 * A plain object rather than `defineConfig` from `vitest/config`: `defineConfig` is
 * identity, and importing it makes config load depend on resolving the runner's own
 * package from wherever the tree happens to be mounted (as the root config already says).
 *
 * `fileParallelism: false`: the files share one provisioned database and several of them
 * spawn `pnpm` lanes against it. Serial files make the suite's reads repeatable.
 */
export default {
  test: {
    include: ['db/__tests__/**/*.test.ts'],
    exclude: ['node_modules/**'],
    environment: 'node',
    fileParallelism: false,
    // A file here can cold-provision a scratch database and spawn `pnpm verify`; a
    // timeout that fires on honest work is a false red.
    testTimeout: 600_000,
    hookTimeout: 600_000,
    reporters: ['default'],
    passWithNoTests: false,
  },
};

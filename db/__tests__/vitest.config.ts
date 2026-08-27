// The database lane's config (V-DB). `pnpm test:db` runs `vitest run --dir db`, and vitest resolves
// its include globs against `--dir` — so the root config's `tests/**` patterns can never collect a
// suite that lives under `db/`. This config is the one that can: its globs are relative to the same
// `--dir`, and it arms the lane the roster already derives from db/__tests__ (scripts/lib/lanes.mjs).
//
// It is wired in by package.json's test:db script: `node scripts/db-test.mjs --config db/__tests__/vitest.config.ts`.
import { defineConfig } from "vitest/config";

/**
 * The address this lane's deployment answers at (R-SPINE-001). The doors that mail a link build it
 * from the address the deployment named and never from the one a request carries — a `Host` is
 * written by whoever sent the request — so a deployment that has named none sends nothing at all
 * and says so. A run that drives those doors is a deployment, and names one here, where the run is
 * configured: it decides product behaviour for every suite in the lane, so it cannot depend on
 * which file imported which helper first. An operator's own value is never overwritten.
 *
 * Deliberately not the host a suite's own requests carry: were the two the same string, a run could
 * not tell a link built from the deployment's address from one built from the caller's.
 */
const PUBLIC_ORIGIN_VAR = "CUBIT_PUBLIC_ORIGIN";
const PUBLIC_ORIGIN = process.env[PUBLIC_ORIGIN_VAR] ?? "https://cubit.example";

export default defineConfig({
  test: {
    environment: "node",
    env: { [PUBLIC_ORIGIN_VAR]: PUBLIC_ORIGIN },
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**"],
    // Live Postgres work: provisioning a scratch database and applying the committed migrations is
    // slower than a unit test, and the suites must not race each other for the same cluster.
    fileParallelism: false,
    testTimeout: 120_000,
    hookTimeout: 240_000,
  },
});

// The database lane's config (V-DB). `pnpm test:db` runs `vitest run --dir db`, and vitest resolves
// its include globs against `--dir` — so the root config's `tests/**` patterns can never collect a
// suite that lives under `db/`. This config is the one that can: its globs are relative to the same
// `--dir`, and it arms the lane the roster already derives from db/__tests__ (scripts/lib/lanes.mjs).
//
// It is wired in by package.json's test:db script: `node scripts/db-test.mjs --config db/__tests__/vitest.config.ts`.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**"],
    // Live Postgres work: provisioning a scratch database and applying the committed migrations is
    // slower than a unit test, and the suites must not race each other for the same cluster.
    fileParallelism: false,
    testTimeout: 120_000,
    hookTimeout: 240_000,
  },
});
